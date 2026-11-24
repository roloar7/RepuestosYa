/**
 * Constantes y configuración global del sistema de impresoras
 */

const PROTOCOLS = {
  BAMBU_LAN: 'bambu_lan',
  KLIPPER_MOONRAKER: 'klipper_moonraker',
};

const PRINTER_STATUS = {
  IDLE: 'idle',
  PRINTING: 'printing',
  PAUSED: 'paused',
  ERROR: 'error',
  OFFLINE: 'offline',
};

const GCODE_STATES = {
  RUNNING: 'RUNNING',
  IDLE: 'IDLE',
  PAUSE: 'PAUSE',
};

const MQTT_CONFIG = {
  PROTOCOL_VERSION: 4,
  CLEAN_SESSION: true,
  KEEPALIVE: 10,
  RECONNECT_PERIOD: 2000,
  CONNECT_TIMEOUT: 10000,
};

const POLLING_CONFIG = {
  INTERVAL: 3000,
  COMMAND: 'pushall',
};

const TRANSPORT_CONFIG = {
  TELEMETRY_THROTTLE: 3000,
  IPC_CHANNEL_TELEMETRY: 'farm:telemetry',
  IPC_CHANNEL_PRINTER_CONNECTED: 'farm:printer-connected',
  IPC_CHANNEL_PRINTER_DISCONNECTED: 'farm:printer-disconnected',
  REALTIME_CHANNEL_TELEMETRY: 'farm-telemetry',
  REALTIME_CHANNEL_COMMANDS: 'farm-commands',
};

const FTPS_CONFIG = {
  PORT: 990,
  SECURE: 'implicit',
  TIMEOUT: 30000,
};

const CAMERA_CONFIG = {
  PORT: 6000,
  SECURE: true,
};

module.exports = {
  PROTOCOLS,
  PRINTER_STATUS,
  GCODE_STATES,
  MQTT_CONFIG,
  POLLING_CONFIG,
  TRANSPORT_CONFIG,
  FTPS_CONFIG,
  CAMERA_CONFIG,
};
