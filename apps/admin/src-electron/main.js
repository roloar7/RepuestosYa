const { app, BrowserWindow, ipcMain } = require('electron');
const mqtt = require('mqtt');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fetch = require('node-fetch');

const isDev = !app.isPackaged;
let mainWindow = null;
let activePrinters = new Map(); // Map de printer_id -> MQTT client

// Variables de Supabase desde env (debe estar en .env.local o variables del sistema)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Función para actualizar bridge status en BD
async function updateBridgeStatusInDB(isConnected) {
  try {
    console.log(`[Bridge] Intentando actualizar BD a: ${isConnected ? 'Conectado ✅' : 'Desconectado ❌'}`);
    console.log(`[Bridge] URL: ${SUPABASE_URL}/rest/v1/bridge_status?id=eq.1`);
    console.log(`[Bridge] Impresoras activas: ${activePrinters.size}`);
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bridge_status?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        is_connected: isConnected,
        last_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    console.log(`[Bridge] Respuesta status: ${response.status}`);
    const responseText = await response.text();
    console.log(`[Bridge] Respuesta body: ${responseText}`);

    if (!response.ok) {
      console.error(`[Bridge] Error actualizando BD: ${response.status}`);
    } else {
      console.log(`[Bridge] Estado actualizado exitosamente: ${isConnected ? 'Conectado ✅' : 'Desconectado ❌'}`);
    }
  } catch (err) {
    console.error('[Bridge] Error:', err.message);
  }
}

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

// ===== FUNCIONES MQTT =====
function connectToPrinter(printerId, ip, accessCode, serialNumber) {
  if (activePrinters.has(printerId)) {
    console.log(`[MQTT] Impresora ${printerId} ya conectada`);
    return;
  }

  try {
    const mqttUrl = `mqtts://${ip}:8883`;
    const client = mqtt.connect(mqttUrl, {
      username: 'bblp',
      password: accessCode,
      rejectUnauthorized: false,
    });

    client.on('connect', () => {
      console.log(`[MQTT] ✅ Impresora ${printerId} conectada exitosamente`);
      client.subscribe(`device/${serialNumber}/report`);
      
      // Agregar a lista de impresoras activas
      activePrinters.set(printerId, client);
      
      // Actualizar BD cuando hay al menos una impresora conectada
      updateBridgeStatusInDB(true);
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.print) {
          const telemetry = {
            printer_id: printerId,
            nozzle_temp: data.print.nozzle_temper ?? 0,
            bed_temp: data.print.bed_temper ?? 0,
            progress: data.print.mc_percent ?? 0,
            gcode_state: data.print.gcode_state ?? 'IDLE',
          };

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('printer-status-update', telemetry);
          }
        }
      } catch (err) {
        // Silenciar errores de parseo de telemetría
      }
    });

    client.on('error', (err) => {
      console.error(`[MQTT] Error en ${printerId}: ${err.message}`);
    });

    client.on('close', () => {
      activePrinters.delete(printerId);
      
      // Actualizar BD cuando no hay impresoras conectadas
      if (activePrinters.size === 0) {
        updateBridgeStatusInDB(false);
      }
    });

  } catch (err) {
    console.error(`[MQTT] Error al conectar ${printerId}: ${err.message}`);
  }
}

function disconnectFromPrinter(printerId) {
  const client = activePrinters.get(printerId);
  if (client) {
    client.end();
    activePrinters.delete(printerId);
    console.log(`[MQTT] Desconectado de impresora ${printerId}`);
    
    // Actualizar BD cuando se desconecta
    if (activePrinters.size === 0) {
      updateBridgeStatusInDB(false);
    }
  }
}

// ===== HANDLERS IPC =====
ipcMain.handle('printer:connect', (event, printer) => {
  connectToPrinter(printer.id, printer.ip, printer.access_code, printer.serial_number);
  return { success: true };
});

ipcMain.handle('printer:disconnect', (event, printerId) => {
  disconnectFromPrinter(printerId);
  return { success: true };
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
  // Desconectar todas las impresoras
  activePrinters.forEach((client, printerId) => {
    disconnectFromPrinter(printerId);
  });
  
  // Marcar bridge como desconectado al cerrar app
  updateBridgeStatusInDB(false);
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
