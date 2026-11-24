class TransportLayer {
  constructor(options = {}) {
    this.mainWindow = options.mainWindow;
    this.supabaseClient = options.supabaseClient;
    this.farmManager = null;

    this.lastPersistedStatus = new Map(); // printer_id -> último status guardado en BD
    this.realtimeChannels = new Map();
    this.isRealtimeConnected = false;
  }

  async initialize(farmManager) {
    this.farmManager = farmManager;

    farmManager.on('telemetry', (telemetry) => {
      this.handleTelemetryFromFarm(telemetry);
    });

    farmManager.on('printer-connected', (data) => {
      this.handlePrinterConnected(data);
    });

    farmManager.on('printer-disconnected', (data) => {
      this.handlePrinterDisconnected(data);
    });

    if (this.supabaseClient) {
      await this.initializeRealtime();
    }

    console.log('[Transport] Inicializado');
  }

  async initializeRealtime() {
    try {
      const telemetryChannel = this.supabaseClient.channel('farm-telemetry');
      telemetryChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Transport] 📡 Realtime telemetry: SUBSCRIBED');
          this.isRealtimeConnected = true;
        }
      });

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

  handleTelemetryFromFarm(telemetry) {
    const { _stateChanged, ...cleanTelemetry } = telemetry;

    // 1. Enviar inmediato vía IPC a React (FarmManager ya aplicó el throttle)
    this.sendTelemetryViaIPC(cleanTelemetry);

    // 2. Enviar vía Realtime Broadcast
    this.broadcastTelemetryViaRealtime(cleanTelemetry);

    // 3. Persistir en BD SOLO si cambió el estado (printing/idle/paused/offline)
    const prevStatus = this.lastPersistedStatus.get(cleanTelemetry.printer_id);
    if (_stateChanged || prevStatus !== cleanTelemetry.status) {
      this.lastPersistedStatus.set(cleanTelemetry.printer_id, cleanTelemetry.status);
      this.persistTelemetryToDB(cleanTelemetry).catch((err) => {
        console.error('[Transport] Error persistiendo estado:', err.message);
      });
    }
  }

  sendTelemetryViaIPC(telemetry) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('farm:telemetry', telemetry);
    }
  }

  broadcastTelemetryViaRealtime(telemetry) {
    if (!this.isRealtimeConnected) return;

    try {
      const channel = this.realtimeChannels.get('telemetry');
      channel?.send({
        type: 'broadcast',
        event: 'telemetry',
        payload: telemetry,
      });
    } catch (err) {
      console.error('[Transport] Error en Realtime broadcast:', err.message);
    }
  }

  async persistTelemetryToDB(telemetry) {
    if (!this.supabaseClient) return;

    const { error } = await this.supabaseClient
      .from('printers')
      .update({
        status: telemetry.status,
        last_seen_at: telemetry.timestamp,
        updated_at: telemetry.timestamp,
      })
      .eq('id', telemetry.printer_id);

    if (error) {
      console.error('[Transport] Error actualizando BD:', error.message);
    }
  }

  handlePrinterConnected(data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('farm:printer-connected', data);
    }
  }

  handlePrinterDisconnected(data) {
    this.lastPersistedStatus.set(data.printer_id, 'offline');
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('farm:printer-disconnected', data);
    }
    this.persistTelemetryToDB({
      printer_id: data.printer_id,
      status: 'offline',
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  }

  async handleRemoteCommand(command) {
    if (!command?.printer_id) return;

    const result = await this.farmManager.executeCommand(
      command.printer_id,
      command.action,
      command.params
    );

    if (command.request_id) {
      this.sendCommandResponse(command.request_id, result);
    }
  }

  sendCommandResponse(requestId, result) {
    if (!this.isRealtimeConnected) return;
    const channel = this.realtimeChannels.get('commands');
    channel?.send({
      type: 'broadcast',
      event: 'command_response',
      payload: { request_id: requestId, result },
    });
  }

  async shutdown() {
    this.realtimeChannels.forEach((channel) => {
      try { channel.unsubscribe(); } catch (_) {}
    });
    this.realtimeChannels.clear();
  }
}

module.exports = TransportLayer;