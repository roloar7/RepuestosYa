/**
 * PrinterFarmManager - Gestor central de todas las impresoras
 * Responsabilidades:
 * - Crear/destruir drivers según protocolo
 * - Coordinar telemetría de todos los drivers
 * - Publicar telemetría en Realtime Broadcast y BD
 * - Ejecutar comandos remotos en impresoras específicas
 * - Mantener estado global de la granja
 */
const { createPrinterDriver } = require('../printer-drivers');

class PrinterFarmManager {
  constructor(options = {}) {
    this.drivers = new Map(); // Map<printerId, BasePrinterDriver>
    this.telemetryThrottle = options.telemetryThrottle || 3000; // 3 segundos
    this.lastTelemetryBroadcast = new Map(); // Timestamp del último envío
    this.transport = null; // Se asigna desde fuera
    this.listeners = new Map();
  }

  /**
   * Inicializar transporte (IPC + Realtime)
   */
  setTransport(transport) {
    this.transport = transport;
  }

  /**
   * Conectar una impresora
   */
  async connectPrinter(printerConfig) {
    try {
      console.log(`[Farm] Conectando impresora ${printerConfig.name}...`);

      // Crear driver según protocolo
      const driver = createPrinterDriver(printerConfig.protocol, printerConfig);

      // Listener para telemetría
      driver.on('telemetry', (data) => {
        this.handleTelemetry(printerConfig.id, data);
      });

      // Listener para conexión
      driver.on('connect', () => {
        console.log(`[Farm] ✅ ${printerConfig.name} conectada`);
        this.emit('printer-connected', { printer_id: printerConfig.id });
        this.transport?.onPrinterConnected(printerConfig.id);
      });

      // Listener para desconexión
      driver.on('disconnect', () => {
        console.log(`[Farm] ❌ ${printerConfig.name} desconectada`);
        this.emit('printer-disconnected', { printer_id: printerConfig.id });
        this.transport?.onPrinterDisconnected(printerConfig.id);
      });

      // Listener para errores
      driver.on('error', (err) => {
        console.error(`[Farm] Error en ${printerConfig.name}:`, err);
        this.emit('printer-error', { printer_id: printerConfig.id, error: err });
      });

      // Conectar
      await driver.connect();

      // Registrar en mapa
      this.drivers.set(printerConfig.id, driver);

      return { success: true };
    } catch (err) {
      console.error(`[Farm] Error conectando ${printerConfig.name}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Desconectar una impresora
   */
  async disconnectPrinter(printerId) {
    try {
      const driver = this.drivers.get(printerId);
      if (!driver) {
        return { success: false, error: 'Printer not found' };
      }

      await driver.disconnect();
      this.drivers.delete(printerId);
      return { success: true };
    } catch (err) {
      console.error(`[Farm] Error desconectando impresora ${printerId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Maneja telemetría entrante con throttling
   */
  handleTelemetry(printerId, data) {
    const now = Date.now();
    const lastBroadcast = this.lastTelemetryBroadcast.get(printerId) || 0;

    // Throttle: solo enviar si pasaron N ms o si cambió el estado
    if (data.stateChanged || now - lastBroadcast > this.telemetryThrottle) {
      this.lastTelemetryBroadcast.set(printerId, now);

      // Obtener telemetría normalizada
      const driver = this.drivers.get(printerId);
      const normalizedTelemetry = driver?.getNormalizedTelemetry();

      if (normalizedTelemetry) {
        // Enviar vía transport (IPC + Realtime)
        this.transport?.broadcastTelemetry(normalizedTelemetry);

        // Emitir evento local
        this.emit('telemetry', normalizedTelemetry);
      }
    }
  }

  /**
   * Ejecutar comando remoto en una impresora
   */
  async executeCommand(printerId, command, params = {}) {
    try {
      const driver = this.drivers.get(printerId);
      if (!driver) {
        return { success: false, error: 'Printer not found' };
      }

      let result;
      switch (command) {
        case 'pause':
          result = await driver.pause();
          break;
        case 'resume':
          result = await driver.resume();
          break;
        case 'stop':
          result = await driver.stop();
          break;
        case 'print':
          result = await driver.uploadAndPrint(params.filePath, params.fileName);
          break;
        case 'camera:start':
          result = await driver.startCamera(params.onFrame);
          break;
        case 'camera:stop':
          result = await driver.stopCamera();
          break;
        default:
          return { success: false, error: `Unknown command: ${command}` };
      }

      return result;
    } catch (err) {
      console.error(`[Farm] Error ejecutando comando ${command}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Obtener estado de todas las impresoras
   */
  getStatus() {
    const status = {
      total: this.drivers.size,
      connected: 0,
      printers: [],
    };

    this.drivers.forEach((driver, printerId) => {
      if (driver.isConnected) {
        status.connected++;
      }

      status.printers.push({
        printer_id: printerId,
        name: driver.name,
        is_connected: driver.isConnected,
        telemetry: driver.getNormalizedTelemetry(),
      });
    });

    return status;
  }

  /**
   * Listener pattern para eventos
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[Farm] Error in listener for ${event}:`, err.message);
      }
    });
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Desconectar todas las impresoras (cleanup)
   */
  async shutdown() {
    console.log('[Farm] Apagando granja...');
    const promises = Array.from(this.drivers.keys()).map((printerId) =>
      this.disconnectPrinter(printerId)
    );
    await Promise.all(promises);
    console.log('[Farm] Granja apagada');
  }
}

module.exports = PrinterFarmManager;
