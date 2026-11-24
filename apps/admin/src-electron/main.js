const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fetch = require('node-fetch');

// Importar arquitectura de drivers
const PrinterFarmManager = require('./lib/farm/PrinterFarmManager');
const TransportLayer = require('./lib/farm/TransportLayer');
const { setupPrinterHandlers } = require('./handlers/printer-handlers');

const isDev = !app.isPackaged;
let mainWindow = null;

// Variables de Supabase
let SUPABASE_URL = null;
let SUPABASE_ANON_KEY = null;
let supabaseClient = null;

// Instancias globales
let farmManager = null;
let transportLayer = null;
let handlersRegistered = false;

// ===== BRIDGE STATUS EN BD =====
async function updateBridgeStatusInDB(isConnected) {
  try {
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

    if (!response.ok) {
      console.error(`[Bridge] Error actualizando BD: ${response.status}`);
    }
  } catch (err) {
    console.error('[Bridge] Error:', err.message);
  }
}

// ===== CONFIGURAR ELECTRON-UPDATER =====
autoUpdater.allowDowngrade = false;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

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

// ===== HANDLERS IPC =====
ipcMain.handle('app:init-supabase', async (event, { supabaseUrl, supabaseKey }) => {
  SUPABASE_URL = supabaseUrl;
  SUPABASE_ANON_KEY = supabaseKey;
  console.log('[ENV] Supabase configurado desde React ✅');

  // Inicializar Supabase client para Realtime
  if (!supabaseClient) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    } catch (err) {
      console.error('[Supabase] Error creando cliente:', err.message);
    }
  }
  
  // Inicializar PrinterFarmManager después de que Supabase esté disponible
  if (!farmManager) {
    farmManager = new PrinterFarmManager();
    
    // Escuchar cambios de conexión
    farmManager.on('printer-connected', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('farm:printer-connected', data);
      }
      
      // Actualizar bridge status en BD
      const anyConnected = farmManager.getStatus().printers.some(p => p.is_connected);
      updateBridgeStatusInDB(anyConnected);
    });

    farmManager.on('printer-disconnected', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('farm:printer-disconnected', data);
      }
      
      // Actualizar bridge status en BD
      const anyConnected = farmManager.getStatus().printers.some(p => p.is_connected);
      updateBridgeStatusInDB(anyConnected);
    });

    // Escuchar errores
    farmManager.on('printer-error', (data) => {
      console.error('[Farm] Error en impresora:', data.error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('farm:printer-error', data);
      }
    });
  }

  // Inicializar TransportLayer después de crear farmManager
  if (!transportLayer) {
    transportLayer = new TransportLayer({
      mainWindow,
      supabaseClient,
      telemetryThrottle: 3000,
    });

    await transportLayer.initialize(farmManager);
    farmManager.setTransport(transportLayer);
  }

  // Registrar handlers IPC solo una vez
  if (!handlersRegistered) {
    setupPrinterHandlers(ipcMain, farmManager, mainWindow);
    handlersRegistered = true;
  }
  
  return { success: true };
});

// Handler para obtener versión
ipcMain.handle('updater:get-version', async () => {
  return {
    currentVersion: app.getVersion(),
  };
});

// Handler para verificar actualizaciones
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

// Handler para descargar e instalar actualización
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
          mainWindow.webContents.send('updater:ready-to-install', true);
        }

        resolve({
          success: true,
          message: 'Actualización lista para instalar',
        });
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

// Handler para instalar actualización
ipcMain.on('updater:quit-and-install', async () => {
  try {
    console.log('[Updater] Iniciando instalación...');
    
    // Desconectar todas las impresoras y apagar transport
    if (farmManager) {
      await farmManager.shutdown();
    }
    
    if (transportLayer) {
      await transportLayer.shutdown();
    }
    
    // Esperar 1000ms para permitir que se cierren recursos
    setTimeout(() => {
      console.log('[Updater] Instalando actualización...');
      autoUpdater.quitAndInstall(false, true);
    }, 1000);
  } catch (error) {
    console.error('[Updater] Error:', error.message);
  }
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

// ===== CICLO DE VIDA DE ELECTRON =====
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Desconectar todas las impresoras
  if (farmManager) {
    await farmManager.shutdown();
  }

  // Apagar transport layer
  if (transportLayer) {
    await transportLayer.shutdown();
  }
  
  // Marcar bridge como desconectado al cerrar app
  updateBridgeStatusInDB(false);
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
