const { app, BrowserWindow, ipcMain } = require('electron');
const mqtt = require('mqtt');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let mainWindow = null;

// ===== CONFIGURACIÓN IMPRESORA =====
const PRINTER_IP = '192.168.0.130';  
const ACCESS_CODE = 'b43dd658';         
const SERIAL_NUMBER = '22E8BJ662204133';      
// =========================================

// Configurar electron-updater para GitHub Releases
autoUpdater.allowDowngrade = false;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

if (!isDev) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'roloar7',
    repo: 'RepuestosYa',
  });
}

// Logs del updater
autoUpdater.on('update-available', (info) => {
  console.log(`[Updater] Actualización disponible v${info.version}`);
});

autoUpdater.on('update-not-available', () => {
  console.log(`[Updater] Última versión ${app.getVersion()}`);
});

autoUpdater.on('error', (err) => {
  console.error('[Updater] Error:', err.message);
});

autoUpdater.on('download-progress', (progress) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:download-progress', Math.round(progress.percent));
  }
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:download-progress', 100);
  }
});

// ===== CONEXIÓN MQTT A IMPRESORA =====
const mqttUrl = `mqtts://${PRINTER_IP}:8883`;
const client = mqtt.connect(mqttUrl, {
  username: 'bblp',
  password: ACCESS_CODE,
  rejectUnauthorized: false,
});

client.on('connect', () => {
  console.log('✅ Conectado a la impresora Bambu Lab por MQTT local');
  client.subscribe(`device/${SERIAL_NUMBER}/report`);
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    
    if (data.print) {
      const telemetry = {
        nozzle_temp: data.print.nozzle_temper ?? 0,
        bed_temp: data.print.bed_temper ?? 0,
        progress: data.print.mc_percent ?? 0,
        gcode_state: data.print.gcode_state ?? 'IDLE',
      };

      console.log(' Telemetría:', `Nozzle: ${telemetry.nozzle_temp}°C | Bed: ${telemetry.bed_temp}°C | Estado: ${telemetry.gcode_state}`);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('printer-status-update', telemetry);
      }
    }
  } catch (err) {
    console.error('❌ Error procesando mensaje MQTT:', err);
  }
});

client.on('error', (err) => {
  console.error('❌ Error MQTT:', err.message);
});

// ===== HANDLERS IPC =====
ipcMain.on('printer-command', (event, command) => {
  console.log('📤 Comando recibido desde la UI:', command);
  // mensajes MQTT para enviar a la impresora
});

ipcMain.handle('updater:get-version', async () => {
  return {
    currentVersion: app.getVersion(),
  };
});

ipcMain.handle('updater:check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      hasUpdate: result?.updateInfo?.version !== app.getVersion(),
      newVersion: result?.updateInfo?.version,
      currentVersion: app.getVersion(),
    };
  } catch (error) {
    console.error('[Updater] Error checking for updates:', error);
    return {
      hasUpdate: false,
      error: error.message,
      currentVersion: app.getVersion(),
    };
  }
});

ipcMain.handle('updater:download-and-install', async () => {
  try {
    const checkResult = await autoUpdater.checkForUpdates();

    if (!checkResult?.updateInfo?.version || checkResult.updateInfo.version === app.getVersion()) {
      return {
        success: false,
        error: 'No hay actualizaciones disponibles',
      };
    }

    autoUpdater.removeAllListeners('download-progress');
    autoUpdater.removeAllListeners('update-downloaded');
    autoUpdater.removeAllListeners('error');

    return new Promise((resolve, reject) => {
      autoUpdater.on('download-progress', (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:download-progress', Math.round(progress.percent));
        }
      });

      autoUpdater.once('update-downloaded', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:download-progress', 100);
        }

        resolve({
          success: true,
          message: 'Actualización lista para instalar',
        });

        setTimeout(() => {
          autoUpdater.quitAndInstall();
        }, 1000);
      });

      autoUpdater.once('error', (error) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:download-error', error.message);
        }
        reject(error);
      });

      autoUpdater.downloadUpdate()
        .catch((err) => {
          reject(err);
        });
    });
  } catch (error) {
    console.error('[Updater] Error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.on('updater:quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

// ===== VENTANA ELECTRON =====
function createWindow() {
  const iconPath = path.join(__dirname, 'icon.ico');
  mainWindow = new BrowserWindow({
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    client.end();
    app.quit();
  }
});
