/**
 * BambuDriver - Implementación para impresoras Bambu Lab (A1, P1, X1)
 * Maneja MQTT, FTPS, Cámara y normalización de telemetría
 */
const mqtt = require('mqtt');
const { Client: FTPClient } = require('basic-ftp');
const BasePrinterDriver = require('./BasePrinterDriver');
const {\n  MQTT_CONFIG,\n  POLLING_CONFIG,\n  FTPS_CONFIG,\n  GCODE_STATES,\n  PRINTER_STATUS,\n} = require('../utils/constants');

class BambuDriver extends BasePrinterDriver {
  constructor(printerConfig) {
    super(printerConfig);
    this.mqttClient = null;
    this.ftpClient = null;
    this.pollingInterval = null;
    this.cameraSocket = null;
    this.statefulTelemetry = {}; // Acumula estado, solo fusiona delta
  }

  /**
   * Conectar a impresora Bambu Lab vía MQTT
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.log(`Conectando a ${this.ip}:8883 (MQTT)...`);

        const mqttUrl = `mqtts://${this.ip}:8883`;
        this.mqttClient = mqtt.connect(mqttUrl, {
          username: 'bblp',
          password: this.credentials.access_code || '00000000',
          protocolVersion: MQTT_CONFIG.PROTOCOL_VERSION,
          clean: MQTT_CONFIG.CLEAN_SESSION,
          keepalive: MQTT_CONFIG.KEEPALIVE,
          reconnectPeriod: MQTT_CONFIG.RECONNECT_PERIOD,
          connectTimeout: MQTT_CONFIG.CONNECT_TIMEOUT,
          rejectUnauthorized: false, // Certificado autofirmado\n        });

        // Timeout para conexión inicial
        let connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            this.logError('Timeout conectando, cerrando...');
            this.mqttClient?.end(true);
            reject(new Error('Connection timeout'));
          }
        }, MQTT_CONFIG.CONNECT_TIMEOUT);

        this.mqttClient.on('connect', () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.logSuccess('Conectado vía MQTT');

          // Suscribirse a telemetría
          const serialNumber = this.credentials.serial_number || this.name;
          this.mqttClient.subscribe(`device/${serialNumber}/report`, { qos: 0 });

          // 🔄 Polling activo: obtener estado cada 3 segundos (como Bambu Studio)
          if (this.pollingInterval) clearInterval(this.pollingInterval);
          this.pollingInterval = setInterval(() => {
            if (this.mqttClient?.connected) {
              this.mqttClient.publish(
                `device/${serialNumber}/request`,
                JSON.stringify({
                  pushing: {
                    sequence_id: Date.now().toString(),
                    command: POLLING_CONFIG.COMMAND,
                  },
                }),
                { qos: 0 }
              );
            }
          }, POLLING_CONFIG.INTERVAL);

          this.emit('connect');
          resolve({ success: true });
        });

        this.mqttClient.on('message', (topic, message) => {
          try {
            const data = JSON.parse(message.toString());
            this.handleMQTTMessage(data);
          } catch (err) {
            // Silenciar errores de parseo
          }
        });

        this.mqttClient.on('error', (err) => {
          this.logError(`Error MQTT: ${err.message}`);
          this.emit('error', { error: err.message });
          reject(err);
        });

        this.mqttClient.on('close', () => {
          this.isConnected = false;
          this.log('Desconectado de MQTT');
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
          }
          this.emit('disconnect');
        });
      } catch (err) {
        this.logError(`Error en connect(): ${err.message}`);
        reject(err);
      }
    });
  }

  /**
   * Desconectar de impresora
   */
  async disconnect() {
    return new Promise((resolve) => {
      try {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        if (this.mqttClient) {
          this.mqttClient.end(true, () => {
            this.logSuccess('Desconectado');
            resolve();
          });
        } else {
          resolve();
        }
      } catch (err) {
        this.logError(`Error en disconnect(): ${err.message}`);
        resolve();
      }
    });
  }

  /**
   * Maneja mensajes MQTT entrantes
   * Implementa Stateful Merging: acumula estado, solo fusiona delta
   */
  handleMQTTMessage(data) {
    if (data.print) {
      // Fusionar solo los campos que vienen en el mensaje
      const newTelemetry = {
        nozzle_temp: data.print.nozzle_temper ? Math.round(data.print.nozzle_temper) : this.statefulTelemetry.nozzle_temp || 0,
        bed_temp: data.print.bed_temper ? Math.round(data.print.bed_temper) : this.statefulTelemetry.bed_temp || 0,
        progress: data.print.mc_percent ?? this.statefulTelemetry.progress ?? 0,
        gcode_state: data.print.gcode_state ?? this.statefulTelemetry.gcode_state ?? 'IDLE',
        status: this.mapGcodeStateToStatus(data.print.gcode_state),
      };

      // Detectar cambios de estado (para throttling)
      const stateChanged =
        this.statefulTelemetry.gcode_state !== newTelemetry.gcode_state ||
        this.statefulTelemetry.progress !== newTelemetry.progress;

      // Actualizar estado acumulado
      this.statefulTelemetry = { ...this.statefulTelemetry, ...newTelemetry };
      this.lastTelemetry = newTelemetry;

      // Emitir evento con telemetría
      this.emit('telemetry', {
        telemetry: newTelemetry,
        stateChanged, // Indica si hubo cambio importante
      });
    }
  }

  /**
   * Mapear gcode_state a status normalizado
   */
  mapGcodeStateToStatus(gcodeState) {
    if (!gcodeState) return 'idle';
    if (gcodeState === 'RUNNING' || gcodeState === 'PRINTING') return 'printing';
    if (gcodeState === 'PAUSE') return 'paused';
    return 'idle';
  }

  /**
   * Obtener telemetría normalizada
   */
  getNormalizedTelemetry() {
    return {
      printer_id: this.id,
      protocol: 'bambu_lan',
      is_connected: this.isConnected,
      status: this.statefulTelemetry.status || 'idle',
      nozzle_temp: this.statefulTelemetry.nozzle_temp || 0,
      bed_temp: this.statefulTelemetry.bed_temp || 0,
      progress: this.statefulTelemetry.progress || 0,
      gcode_state: this.statefulTelemetry.gcode_state || 'IDLE',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Subir archivo vía FTPS e iniciar impresión
   */
  async uploadAndPrint(filePath, fileName) {
    try {
      this.log(`Iniciando upload FTPS de ${fileName}...`);

      const ftp = new FTPClient();
      await ftp.access({
        host: this.ip,
        port: 990,
        user: 'bblp',
        password: this.credentials.access_code || '00000000',
        secure: 'implicit', // FTPS implícito
        secureOptions: { rejectUnauthorized: false },
        timeout: 30000,
      });

      // Cambiar a directorio de uploads
      await ftp.cd('/cache/');

      // Subir archivo
      const fs = require('fs');
      await ftp.uploadFrom(fs.createReadStream(filePath), fileName);

      this.logSuccess(`Archivo ${fileName} subido`);

      // Enviar comando para iniciar impresión
      const serialNumber = this.credentials.serial_number || this.name;
      this.mqttClient?.publish(
        `device/${serialNumber}/request`,
        JSON.stringify({
          print: {
            sequence_id: Date.now().toString(),
            command: 'project_file',
            param: fileName,
          },
        }),
        { qos: 2 }
      );

      await ftp.close();
      return { success: true };
    } catch (err) {
      this.logError(`Error en uploadAndPrint(): ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Pausa la impresión
   */
  async pause() {
    try {
      const serialNumber = this.credentials.serial_number || this.name;
      this.mqttClient?.publish(
        `device/${serialNumber}/request`,
        JSON.stringify({
          print: {
            sequence_id: Date.now().toString(),
            command: 'pause',
          },
        }),
        { qos: 2 }
      );
      this.log('Comando pause enviado');
      return { success: true };
    } catch (err) {
      this.logError(`Error en pause(): ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Reanuda la impresión
   */
  async resume() {
    try {
      const serialNumber = this.credentials.serial_number || this.name;
      this.mqttClient?.publish(
        `device/${serialNumber}/request`,
        JSON.stringify({
          print: {
            sequence_id: Date.now().toString(),
            command: 'resume',
          },
        }),
        { qos: 2 }
      );
      this.log('Comando resume enviado');
      return { success: true };
    } catch (err) {
      this.logError(`Error en resume(): ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Detiene la impresión
   */
  async stop() {
    try {
      const serialNumber = this.credentials.serial_number || this.name;
      this.mqttClient?.publish(
        `device/${serialNumber}/request`,
        JSON.stringify({
          print: {
            sequence_id: Date.now().toString(),
            command: 'stop',
          },
        }),
        { qos: 2 }
      );
      this.log('Comando stop enviado');
      return { success: true };
    } catch (err) {
      this.logError(`Error en stop(): ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Iniciar stream de cámara (placeholder - implementar en futuro)
   */
  async startCamera(onFrameCallback) {
    try {
      this.log('Camera stream iniciado (placeholder)');
      // Implementación futura: socket TLS a puerto 6000
      return { success: true };
    } catch (err) {
      this.logError(`Error en startCamera(): ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Detener stream de cámara
   */
  async stopCamera() {
    try {
      this.log('Camera stream detenido');
      return { success: true };
    } catch (err) {
      this.logError(`Error en stopCamera(): ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

module.exports = BambuDriver;
