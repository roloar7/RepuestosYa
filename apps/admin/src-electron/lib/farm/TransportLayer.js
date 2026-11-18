/**
 * TransportLayer - Gestor de comunicación bidireccional
 * Responsabilidades:
 * - IPC local (Electron → React) para actualización en tiempo real
 * - Realtime Broadcast (Supabase) para telemetría y comandos remotos
 * - Throttling configurable
 * - Fallback automático si Realtime falla
 */

class TransportLayer {
  constructor(options = {}) {
    this.mainWindow = options.mainWindow;
    this.supabaseClient = options.supabaseClient;
    this.farmManager = null;

    this.telemetryThrottle = options.telemetryThrottle || 2000; // 2 segundos
    this.lastTelemetryUpdate = new Map(); // printer_id -> timestamp

    this.realtimeChannels = new Map(); // name -> channel
    this.isRealtimeConnected = false;
  }

  /**
   * Inicializar transport
   */
  async initialize(farmManager) {
    this.farmManager = farmManager;

    // Escuchar cambios de telemetría desde el farm manager
    farmManager.on('telemetry', (telemetry) => {
      this.handleTelemetryFromFarm(telemetry);
    });

    farmManager.on('printer-connected', (data) => {
      this.handlePrinterConnected(data);
    });

    farmManager.on('printer-disconnected', (data) => {
      this.handlePrinterDisconnected(data);
    });

    // Inicializar Realtime (si está disponible)
    if (this.supabaseClient) {
      await this.initializeRealtime();
    }

    console.log('[Transport] Inicializado');
  }

  /**
   * Inicializar canales de Realtime
   */
  async initializeRealtime() {
    try {
      // Canal de telemetría: broadcast para todos los listeners
      const telemetryChannel = this.supabaseClient.channel('farm-telemetry');
      telemetryChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Transport] 📡 Realtime telemetry: SUBSCRIBED');
          this.isRealtimeConnected = true;
        }
      });

      // Canal de comandos: escuchar comandos remotos
      const commandsChannel = this.supabaseClient.channel('farm-commands');
      commandsChannel.on('broadcast', { event: 'command' }, (payload) => {
        this.handleRemoteCommand(payload.payload);
      });

      commandsChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Transport] 📡 Realtime commands: SUBSCRIBED');
        }
      });

      this.realtimeChannels.set('telemetry', telemetryChannel);
      this.realtimeChannels.set('commands', commandsChannel);
    } catch (err) {
      console.error('[Transport] Error inicializando Realtime:', err.message);
      this.isRealtimeConnected = false;
    }
  }

  /**
   * Manejar telemetría desde Farm Manager
   */
  handleTelemetryFromFarm(telemetry) {
    const printerId = telemetry.printer_id;
    const now = Date.now();
    const lastUpdate = this.lastTelemetryUpdate.get(printerId) || 0;

    // Throttle: solo enviar si pasaron N ms
    if (now - lastUpdate < this.telemetryThrottle) {
      return;
    }

    this.lastTelemetryUpdate.set(printerId, now);

    // 1. Enviar vía IPC (React en tiempo real)
    this.sendTelemetryViaIPC(telemetry);

    // 2. Enviar vía Realtime Broadcast (para otros agentes)
    this.broadcastTelemetryViaRealtime(telemetry);

    // 3. Persistir en BD (asincrónico, no bloquea)
    this.persistTelemetryToDB(telemetry).catch((err) => {
      console.error('[Transport] Error persistiendo telemetría:', err.message);
    });
  }

  /**
   * Enviar telemetría vía IPC
   */
  sendTelemetryViaIPC(telemetry) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('farm:telemetry', telemetry);
    }
  }

  /**
   * Broadcast telemetría en Realtime
   */
  broadcastTelemetryViaRealtime(telemetry) {
    if (!this.isRealtimeConnected) {
      console.warn('[Transport] Realtime no está conectado, saltando broadcast');
      return;
    }

    try {
      const channel = this.realtimeChannels.get('telemetry');
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'telemetry',
          payload: telemetry,
        });
      }
    } catch (err) {
      console.error('[Transport] Error en Realtime broadcast:', err.message);
    }
  }

  /**
   * Persistir telemetría en BD (asincrónico)
   */
  async persistTelemetryToDB(telemetry) {
    if (!this.supabaseClient) return;

    try {
      // Aquí irá la lógica para actualizar tabla printers con estado actual
      // Por ahora, solo logear
      console.log(`[Transport] Persistiendo telemetría de ${telemetry.printer_id}`);
    } catch (err) {
      console.error('[Transport] Error en persistTelemetryToDB:', err.message);
    }
  }

  /**
   * Manejar impresora conectada
   */
  handlePrinterConnected(data) {
    console.log(`[Transport] Impresora ${data.printer_id} conectada`);

    // Notificar a React
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('farm:printer-connected', data);
    }
  }

  /**
   * Manejar impresora desconectada
   */
  handlePrinterDisconnected(data) {
    console.log(`[Transport] Impresora ${data.printer_id} desconectada`);

    // Notificar a React
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('farm:printer-disconnected', data);
    }
  }

  /**
   * Manejar comando remoto desde Realtime
   */
  async handleRemoteCommand(command) {
    console.log('[Transport] Comando remoto recibido:', command);

    if (!command.printer_id) {
      console.error('[Transport] Comando remoto sin printer_id');
      return;
    }

    // Ejecutar comando a través del farm manager
    const result = await this.farmManager.executeCommand(
      command.printer_id,
      command.action,
      command.params
    );

    // Responder (opcional)
    if (command.request_id) {
      this.sendCommandResponse(command.request_id, result);
    }
  }

  /**
   * Enviar respuesta de comando
   */
  sendCommandResponse(requestId, result) {
    if (!this.isRealtimeConnected) return;

    try {
      const channel = this.realtimeChannels.get('commands');
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'command_response',
          payload: {
            request_id: requestId,
            result,
          },
        });
      }
    } catch (err) {
      console.error('[Transport] Error en command response:', err.message);
    }
  }

  /**
   * Métodos públicos para comunicación con farm manager
   */

  broadcastTelemetry(telemetry) {
    this.handleTelemetryFromFarm(telemetry);
  }

  onPrinterConnected(printerId) {
    this.handlePrinterConnected({ printer_id: printerId });
  }

  onPrinterDisconnected(printerId) {
    this.handlePrinterDisconnected({ printer_id: printerId });
  }

  /**
   * Cleanup
   */
  async shutdown() {
    console.log('[Transport] Apagando...');
    this.realtimeChannels.forEach((channel) => {
      try {
        channel.unsubscribe();
      } catch (err) {
        // Ignorar errores en unsubscribe
      }
    });
    this.realtimeChannels.clear();
  }
}

module.exports = TransportLayer;
