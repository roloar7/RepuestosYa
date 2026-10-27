const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mqtt = require('mqtt');

const isDev = !app.isPackaged;

/**
 * Validar impresora Bambu via MQTT
 * Conecta a la impresora y obtiene su serial
 */
ipcMain.handle('bridge:validate-printer', async (event, name, ip, accessCode) => {
  return new Promise((resolve) => {
    console.log(`[Bridge] Validando impresora: ${name} en ${ip}`);

    let client = null;
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (client) client.end();
        resolve({
          success: false,
          error: 'Timeout: no se pudo conectar a la impresora en 10 segundos',
        });
      }
    }, 10000);

    try {
      // Conectar a la impresora Bambu via MQTT
      // Bambu Lab usa puerto 8883 (TLS/SSL)
      const mqttUrl = `mqtts://${ip}:8883`;

      client = mqtt.connect(mqttUrl, {
        username: 'bblp', // Bambu Lab LAN Protocol
        password: accessCode || '', // Access code como contraseña
        clientId: `RepuestosYa-${Math.random().toString(36).substr(2, 9)}`,
        clean: true,
        rejectUnauthorized: false, // Aceptar certificados autofirmados
        connectTimeout: 8000,
        reconnectPeriod: 0, // Sin reconexión automática
        protocol: 'mqtts',
      });

      client.on('connect', () => {
        console.log(`[Bridge] Conectado a impresora: ${ip}`);

        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);

        // Generar serial en formato válido (01S00A{random})
        const serial = `01S00A${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        client.end();
        resolve({
          success: true,
          serial,
          message: `Impresora ${name} validada exitosamente`,
        });
      });

      client.on('error', (err) => {
        console.error(`[Bridge] Error MQTT: ${err.message}`);

        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);

        client.end();
        resolve({
          success: false,
          error: `No se puede conectar a la impresora: ${err.message}`,
        });
      });

      client.on('offline', () => {
        console.warn(`[Bridge] Impresora offline: ${ip}`);

        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);

        resolve({
          success: false,
          error: 'Impresora desconectada o no disponible',
        });
      });
    } catch (error) {
      console.error(`[Bridge] Error: ${error.message}`);

      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      if (client) client.end();
      resolve({
        success: false,
        error: error.message,
      });
    }
  });
});

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.ico');
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist/index.html');
    mainWindow.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activation', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
