/**
 * BasePrinterDriver - Clase abstracta que define el contrato para todos los drivers
 * Cualquier protocolo de impresora debe implementar esta interfaz
 */
class BasePrinterDriver {
  constructor(printerConfig) {
    this.id = printerConfig.id;
    this.name = printerConfig.name;
    this.ip = printerConfig.ip;
    this.protocol = printerConfig.protocol;
    this.credentials = printerConfig.credentials || {};
    this.isConnected = false;
    this.lastTelemetry = null;
    this.listeners = new Map(); // event -> callbacks
  }

  /**
   * Conectar a la impresora
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Desconectar de la impresora
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * Subir archivo e iniciar impresión
   * @param {string} filePath - Ruta local del archivo
   * @param {string} fileName - Nombre del archivo en la impresora
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async uploadAndPrint(filePath, fileName) {
    throw new Error('uploadAndPrint() must be implemented by subclass');
  }

  /**
   * Pausa la impresión en curso
   */
  async pause() {
    throw new Error('pause() must be implemented by subclass');
  }

  /**
   * Reanuda la impresión pausada
   */
  async resume() {
    throw new Error('resume() must be implemented by subclass');
  }

  /**
   * Detiene la impresión en curso
   */
  async stop() {
    throw new Error('stop() must be implemented by subclass');
  }

  /**
   * Inicia el stream de cámara
   * @param {function} onFrameCallback - Callback que recibe frames JPEG en base64
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async startCamera(onFrameCallback) {
    throw new Error('startCamera() must be implemented by subclass');
  }

  /**
   * Detiene el stream de cámara
   */
  async stopCamera() {
    throw new Error('stopCamera() must be implemented by subclass');
  }

  /**
   * Obtiene telemetría normalizada
   * @returns {NormalizedTelemetry} Formato estándar de telemetría
   */
  getNormalizedTelemetry() {
    throw new Error('getNormalizedTelemetry() must be implemented by subclass');
  }

  /**
   * Listener pattern para eventos del driver
   * @param {string} event - Nombre del evento (connect, disconnect, telemetry, error)
   * @param {function} callback - Función a ejecutar
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Emitir evento
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[${this.name}] Error in listener for ${event}:`, err.message);
      }
    });
  }

  /**
   * Remover listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Log helper con nombre del driver
   */
  log(message) {
    console.log(`[${this.name}] ${message}`);
  }

  logError(message) {
    console.error(`[${this.name}] ❌ ${message}`);
  }

  logSuccess(message) {
    console.log(`[${this.name}] ✅ ${message}`);
  }
}

module.exports = BasePrinterDriver;
