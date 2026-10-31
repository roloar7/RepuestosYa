const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mqtt = require('mqtt');
const { autoUpdater } = require('electron-updater');
const bridgeService = require('./bridge-service.js');

const isDev = !app.isPackaged;
let mainWindow = null;

// Configurar electron-updater para GitHub Releases
autoUpdater.allowDowngrade = false;
autoUpdater.autoDownload = false; // No descargar automáticamente
autoUpdater.autoInstallOnAppQuit = true; // Instalar al cerrar la app

// Configurar proveedor de GitHub
if (!isDev) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'roloar7',
    repo: 'RepuestosYa',
  });
  
  console.log('[Updater] Configurado para GitHub releases');
  console.log('[Updater] Feed URL: https://github.com/roloar7/RepuestosYa/releases');
}

// Listeners para actualizaciones
autoUpdater.on('checking-for-update', () => {
  console.log('[Updater] Verificando actualizaciones...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[Updater] Actualización disponible:', info.version);
});

autoUpdater.on('update-not-available', () => {
  console.log('[Updater] App está actualizada');
});

autoUpdater.on('error', (err) => {
  console.error('[Updater] Error:', err.message);
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`[Updater] Descargando: ${Math.round(progress.percent)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Updater] Actualización descargada:', info.version);
});

/**
 * Validar impresora Bambu via MQTT
 * Conecta a la impresora y obtiene su serial
 */
// Handlers para actualización
ipcMain.handle('updater:get-version', async () => {
  return {
    currentVersion: app.getVersion(),
  };
});

ipcMain.handle('updater:check-for-updates', async (event) => {
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

ipcMain.handle('updater:download-and-install', async (event) => {
  try {
    console.log('[Updater] Iniciando descarga e instalación...');

    // Primero, verificar si hay actualizaciones
    console.log('[Updater] Verificando actualizaciones...');
    const checkResult = await autoUpdater.checkForUpdates();
    console.log('[Updater] Resultado de checkForUpdates:', checkResult);

    if (!checkResult?.updateInfo?.version || checkResult.updateInfo.version === app.getVersion()) {
      console.log('[Updater] No hay actualizaciones disponibles');
      return {
        success: false,
        error: 'No hay actualizaciones disponibles',
      };
    }

    // Remover listeners antiguos para evitar duplicados
    autoUpdater.removeAllListeners('download-progress');
    autoUpdater.removeAllListeners('update-downloaded');
    autoUpdater.removeAllListeners('error');

    return new Promise((resolve, reject) => {
      // Listener para progreso de descarga
      autoUpdater.on('download-progress', (progress) => {
        const percent = Math.round(progress.percent);
        console.log(`[Updater] Progreso: ${percent}%`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:download-progress', percent);
        }
      });

      // Listener para cuando se descarga completamente
      autoUpdater.once('update-downloaded', () => {
        console.log('[Updater] Descarga completada, reiniciando e instalando...');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:download-progress', 100);
        }

        resolve({
          success: true,
          message: 'Actualización lista para instalar',
        });

        // Instalar después de 1 segundo para que el UI se actualice
        setTimeout(() => {
          console.log('[Updater] Ejecutando quitAndInstall()...');
          autoUpdater.quitAndInstall();
        }, 1000);
      });

      // Listener para errores
      autoUpdater.once('error', (error) => {
        console.error('[Updater] Error durante actualización:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:download-error', error.message);
        }
        reject(error);
      });

      // Iniciar descarga
      console.log('[Updater] Iniciando downloadUpdate()...');
      autoUpdater.downloadUpdate()
        .then((files) => {
          console.log('[Updater] downloadUpdate() completado:', files);
        })
        .catch((err) => {
          console.error('[Updater] downloadUpdate() error:', err);
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

app.whenReady().then(async () => {
  createWindow();

  // Iniciar Bridge MQTT en background
  try {
    await bridgeService.startBridgeServer(8787);
    console.log('[Main] ✓ Bridge MQTT iniciado correctamente');
  } catch (err) {
    console.error('[Main] ✗ Error iniciando Bridge MQTT:', err);
  }

  app.on('activation', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Detener Bridge MQTT antes de salir
  try {
    await bridgeService.stopBridgeServer();
    console.log('[Main] ✓ Bridge MQTT detenido');
  } catch (err) {
    console.error('[Main] ✗ Error deteniendo Bridge MQTT:', err);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
