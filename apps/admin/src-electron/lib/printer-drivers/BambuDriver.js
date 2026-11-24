/**
 * BambuDriver - Implementación para impresoras Bambu Lab (A1, P1, X1)
 * Maneja MQTT, FTPS, Cámara (puerto 6000) y normalización de telemetría
 */
const mqtt = require('mqtt');
const tls = require('tls');
const fs = require('fs');
const { Client: FTPClient } = require('basic-ftp');
const BasePrinterDriver = require('./BasePrinterDriver');
const { MQTT_CONFIG, POLLING_CONFIG } = require('../utils/constants');

class BambuDriver extends BasePrinterDriver {
  constructor(printerConfig) {
    super(printerConfig);
    this.mqttClient = null;
    this.pollingInterval = null;
    this.cameraSocket = null;
    this.cameraBuffer = Buffer.alloc(0);
    this.isStreamingCamera = false;
    this.statefulTelemetry = {
      nozzle_temp: 0,
      bed_temp: 0,
      progress: 0,
      gcode_state: 'IDLE',
      status: 'idle',
    };
    this._confirmConnection = null;
  }

  get serialNumber() {
    return this.credentials.serial_number || this.name;
  }

  /**
   * Conectar a impresora Bambu Lab vía MQTT
   */
  async connect() {
    return new Promise((resolve, reject) => {
      let isSettled = false;

      try {
        this.log(`Conectando a ${this.ip}:8883 (MQTT)...`);

        const mqttUrl = `mqtts://${this.ip}:8883`;
        this.mqttClient = mqtt.connect(mqttUrl, {
          username: 'bblp',
          password: this.credentials.access_code || '00000000',
          protocolVersion: MQTT_CONFIG.PROTOCOL_VERSION || 4,
          clean: MQTT_CONFIG.CLEAN_SESSION ?? true,
          keepalive: MQTT_CONFIG.KEEPALIVE || 10,
          reconnectPeriod: MQTT_CONFIG.RECONNECT_PERIOD || 3000,
          connectTimeout: MQTT_CONFIG.CONNECT_TIMEOUT || 10000,
          rejectUnauthorized: false,
        });

        const connectionTimeout = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            this.logError('Timeout conectando, cerrando...');
            this.mqttClient?.end(true);
            reject(new Error('Connection timeout'));
          }
        }, MQTT_CONFIG.CONNECT_TIMEOUT || 10000);

        this.mqttClient.on('connect', () => {
          clearTimeout(connectionTimeout);
          this.log('Conexión MQTT establecida, esperando telemetría...');

          this.mqttClient.subscribe(`device/${this.serialNumber}/report`, { qos: 0 });
          this._publishPushAll();

          const telemetryTimeout = setTimeout(() => {
            if (!isSettled) {
              isSettled = true;
              this.logError('No se recibió telemetría, impresora no responde');
              this.mqttClient?.end(true);
              reject(new Error('No telemetry received - printer not responding'));
            }
          }, 10000);

          this._confirmConnection = () => {
            clearTimeout(telemetryTimeout);
            this.isConnected = true;
            this.logSuccess('Conectado vía MQTT (telemetría recibida)');

            if (this.pollingInterval) clearInterval(this.pollingInterval);
            this.pollingInterval = setInterval(() => {
              this._publishPushAll();
            }, POLLING_CONFIG.INTERVAL || 3000);

            this.emit('connect');
            if (!isSettled) {
              isSettled = true;
              resolve({ success: true });
            }
          };
        });

        this.mqttClient.on('message', (topic, message) => {
          try {
            const data = JSON.parse(message.toString());
            this.handleMQTTMessage(data);
          } catch (err) {
            // Ignorar paquetes malformados
          }
        });

        this.mqttClient.on('error', (err) => {
          this.logError(`Error MQTT: ${err.message}`);
          this.emit('error', { error: err.message });
          if (!isSettled) {
            isSettled = true;
            clearTimeout(connectionTimeout);
            reject(err);
          }
        });

        this.mqttClient.on('close', () => {
          this.isConnected = false;
          this._confirmConnection = null;
          this.log('Desconectado de MQTT');
          if (this.pollingInterval) clearInterval(this.pollingInterval);
          this.emit('disconnect');
        });
      } catch (err) {
        this.logError(`Error en connect(): ${err.message}`);
        if (!isSettled) reject(err);
      }
    });
  }

  _publishPushAll() {
    if (this.mqttClient?.connected) {
      this.mqttClient.publish(
        `device/${this.serialNumber}/request`,
        JSON.stringify({
          pushing: {
            sequence_id: Date.now().toString(),
            command: POLLING_CONFIG.COMMAND || 'pushall',
          },
        }),
        { qos: 0 }
      );
    }
  }

  /**
   * Desconectar de impresora y cerrar cámara si está activa
   */
  async disconnect() {
    await this.stopCamera();
    return new Promise((resolve) => {
      try {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this._confirmConnection = null;
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
   * Maneja mensajes MQTT entrantes con Stateful Merging
   */
  handleMQTTMessage(data) {
    if (this._confirmConnection) {
      this._confirmConnection();
      this._confirmConnection = null;
    }

    if (data.print) {
      const p = data.print;
      const mergedGcodeState = p.gcode_state !== undefined ? p.gcode_state : this.statefulTelemetry.gcode_state;

      const newTelemetry = {
        nozzle_temp: p.nozzle_temper !== undefined ? Math.round(p.nozzle_temper) : this.statefulTelemetry.nozzle_temp,
        bed_temp: p.bed_temper !== undefined ? Math.round(p.bed_temper) : this.statefulTelemetry.bed_temp,
        progress: p.mc_percent !== undefined ? p.mc_percent : this.statefulTelemetry.progress,
        gcode_state: mergedGcodeState,
        status: this.mapGcodeStateToStatus(mergedGcodeState),
      };

      const stateChanged =
        this.statefulTelemetry.gcode_state !== newTelemetry.gcode_state ||
        this.statefulTelemetry.progress !== newTelemetry.progress;

      this.statefulTelemetry = { ...this.statefulTelemetry, ...newTelemetry };
      this.lastTelemetry = newTelemetry;

      this.emit('telemetry', {
        telemetry: this.getNormalizedTelemetry(),
        stateChanged,
      });
    }
  }

  mapGcodeStateToStatus(gcodeState) {
    if (!gcodeState) return 'idle';
    if (gcodeState === 'RUNNING' || gcodeState === 'PRINTING' || gcodeState === 'PREPARE') return 'printing';
    if (gcodeState === 'PAUSE') return 'paused';
    return 'idle';
  }

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
    const ftp = new FTPClient();
    try {
      this.log(`Iniciando upload FTPS de ${fileName}...`);

      await ftp.access({
        host: this.ip,
        port: 990,
        user: 'bblp',
        password: this.credentials.access_code || '00000000',
        secure: 'implicit',
        secureOptions: { rejectUnauthorized: false },
        timeout: 30000,
      });

      await ftp.cd('/cache/');
      await ftp.uploadFrom(fs.createReadStream(filePath), fileName);
      this.logSuccess(`Archivo ${fileName} subido`);

      this._sendPrintCommand('project_file', fileName);
      return { success: true };
    } catch (err) {
      this.logError(`Error en uploadAndPrint(): ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      ftp.close();
    }
  }

  /**
   * Helper centralizado para comandos de control
   */
  _sendPrintCommand(command, param = '') {
    if (!this.mqttClient?.connected) {
      throw new Error('La impresora no está conectada por MQTT');
    }

    this.mqttClient.publish(
      `device/${this.serialNumber}/request`,
      JSON.stringify({
        print: {
          sequence_id: Date.now().toString(),
          command,
          param,
        },
      }),
      { qos: 0 }
    );
  }

  async pause() {
    try {
      this._sendPrintCommand('pause');
      this.log('Comando pause enviado');
      return { success: true };
    } catch (err) {
      this.logError(`Error en pause(): ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async resume() {
    try {
      this._sendPrintCommand('resume');
      this.log('Comando resume enviado');
      return { success: true };
    } catch (err) {
      this.logError(`Error en resume(): ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async stop() {
    try {
      this._sendPrintCommand('stop');
      this.log('Comando stop enviado');
      return { success: true };
    } catch (err) {
      this.logError(`Error en stop(): ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Iniciar stream de cámara (Puerto 6000 TLS binario para A1 / P1)
   */
  async startCamera(onFrameCallback) {
    if (this.isStreamingCamera) return { success: true };

    return new Promise((resolve) => {
      try {
        this.isStreamingCamera = true;
        this.cameraBuffer = Buffer.alloc(0);

        this.cameraSocket = tls.connect(
          {
            host: this.ip,
            port: 6000,
            rejectUnauthorized: false,
          },
          () => {
            this.logSuccess('Stream de cámara conectado (puerto 6000)');

            // Paquete de autenticación binario de 80 bytes
            const authPacket = Buffer.alloc(80);
            authPacket.writeUInt32LE(0x40, 0);
            authPacket.writeUInt32LE(0x3000, 4);
            authPacket.write('bblp', 16, 'ascii');
            authPacket.write(this.credentials.access_code || '00000000', 48, 'ascii');

            this.cameraSocket.write(authPacket);
            resolve({ success: true });
          }
        );

        this.cameraSocket.on('data', (chunk) => {
          this.cameraBuffer = Buffer.concat([this.cameraBuffer, chunk]);

          // Cada frame tiene 16 bytes de cabecera con el tamaño del JPEG en los primeros 4 bytes
          while (this.cameraBuffer.length >= 16) {
            const payloadSize = this.cameraBuffer.readUInt32LE(0);
            const totalSize = 16 + payloadSize;

            if (this.cameraBuffer.length < totalSize) break;

            const jpegFrame = this.cameraBuffer.subarray(16, totalSize);
            this.cameraBuffer = this.cameraBuffer.subarray(totalSize);

            if (typeof onFrameCallback === 'function') {
              onFrameCallback(jpegFrame.toString('base64'));
            }
          }
        });

        this.cameraSocket.on('error', (err) => {
          this.logError(`Error en cámara: ${err.message}`);
          this.stopCamera();
        });

        this.cameraSocket.on('close', () => {
          this.isStreamingCamera = false;
          this.log('Stream de cámara cerrado');
        });
      } catch (err) {
        this.logError(`Error en startCamera(): ${err.message}`);
        this.isStreamingCamera = false;
        resolve({ success: false, error: err.message });
      }
    });
  }

  /**
   * Detener stream de cámara
   */
  async stopCamera() {
    this.isStreamingCamera = false;
    if (this.cameraSocket) {
      this.cameraSocket.destroy();
      this.cameraSocket = null;
    }
    this.cameraBuffer = Buffer.alloc(0);
    return { success: true };
  }
}

module.exports = BambuDriver;