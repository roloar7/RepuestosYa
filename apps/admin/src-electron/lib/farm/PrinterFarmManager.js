const { createPrinterDriver } = require('../printer-drivers');

class PrinterFarmManager {
  constructor(options = {}) {
    this.drivers = new Map(); // Map<printerId, BasePrinterDriver>
    this.telemetryThrottle = options.telemetryThrottle || 2000;
    this.lastTelemetryBroadcast = new Map();
    this.transport = null;
    this.listeners = new Map();
  }

  setTransport(transport) {
    this.transport = transport;
  }

  async connectPrinter(printerConfig) {
    try {
      // Si ya existía un driver para este ID, limpiarlo antes
      if (this.drivers.has(printerConfig.id)) {
        await this.disconnectPrinter(printerConfig.id);
      }

      console.log(`[Farm] Conectando impresora ${printerConfig.name}...`);
      const driver = createPrinterDriver(printerConfig.protocol, printerConfig);

      // ✅ 1. REGISTRAR EN EL MAP ANTES DE CONECTAR
      this.drivers.set(printerConfig.id, driver);

      driver.on('telemetry', (data) => {
        this.handleTelemetry(printerConfig.id, data);
      });

      driver.on('connect', () => {
        console.log(`[Farm] ✅ ${printerConfig.name} conectada`);
        const payload = { printer_id: printerConfig.id, status: 'idle', is_connected: true };
        this.emit('printer-connected', payload);
      });

      driver.on('disconnect', () => {
        console.log(`[Farm] ❌ ${printerConfig.name} desconectada`);
        const payload = { printer_id: printerConfig.id, status: 'offline', is_connected: false };
        this.emit('printer-disconnected', payload);
      });

      driver.on('error', (err) => {
        console.error(`[Farm] Error en ${printerConfig.name}:`, err);
        this.emit('printer-error', { printer_id: printerConfig.id, error: err });
      });

      // ✅ 2. AHORA SÍ CONECTAR (cuando llegue el primer paquete ya existe en this.drivers)
      await driver.connect();

      return { success: true };
    } catch (err) {
      console.error(`[Farm] Error conectando ${printerConfig.name}:`, err.message);
      this.emit('printer-disconnected', { printer_id: printerConfig.id, status: 'offline', is_connected: false });
      return { success: false, error: err.message };
    }
  }

  async disconnectPrinter(printerId) {
    try {
      const driver = this.drivers.get(printerId);
      if (!driver) return { success: false, error: 'Printer not found' };

      await driver.disconnect();
      this.drivers.delete(printerId);
      this.lastTelemetryBroadcast.delete(printerId);
      return { success: true };
    } catch (err) {
      console.error(`[Farm] Error desconectando impresora ${printerId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  handleTelemetry(printerId, data) {
    const now = Date.now();
    const lastBroadcast = this.lastTelemetryBroadcast.get(printerId) || 0;

    if (data.stateChanged || now - lastBroadcast >= this.telemetryThrottle) {
      this.lastTelemetryBroadcast.set(printerId, now);

      const driver = this.drivers.get(printerId);
      const normalizedTelemetry = driver?.getNormalizedTelemetry();

      if (normalizedTelemetry) {
        // ✅ Emitir una sola vez; TransportLayer escucha este evento
        this.emit('telemetry', {
          ...normalizedTelemetry,
          _stateChanged: Boolean(data.stateChanged),
        });
      }
    }
  }

  async executeCommand(printerId, command, params = {}) {
    try {
      const driver = this.drivers.get(printerId);
      if (!driver) return { success: false, error: 'Printer not found' };

      switch (command) {
        case 'pause':
          return await driver.pause();
        case 'resume':
          return await driver.resume();
        case 'stop':
          return await driver.stop();
        case 'print':
          return await driver.uploadAndPrint(params.filePath, params.fileName);
        case 'camera:start':
          return await driver.startCamera(params.onFrame);
        case 'camera:stop':
          return await driver.stopCamera();
        default:
          return { success: false, error: `Unknown command: ${command}` };
      }
    } catch (err) {
      console.error(`[Farm] Error ejecutando comando ${command}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  getStatus() {
    const status = { total: this.drivers.size, connected: 0, printers: [] };
    this.drivers.forEach((driver, printerId) => {
      if (driver.isConnected) status.connected++;
      status.printers.push({
        printer_id: printerId,
        name: driver.name,
        is_connected: driver.isConnected,
        telemetry: driver.getNormalizedTelemetry(),
      });
    });
    return status;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach((cb) => {
      try { cb(data); } catch (err) { console.error(`[Farm] Error in listener for ${event}:`, err.message); }
    });
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter((cb) => cb !== callback));
  }

  async shutdown() {
    console.log('[Farm] Apagando granja...');
    await Promise.all(Array.from(this.drivers.keys()).map((id) => this.disconnectPrinter(id)));
    console.log('[Farm] Granja apagada');
  }
}

module.exports = PrinterFarmManager;