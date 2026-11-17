const { app, BrowserWindow, ipcMain } = require('electron');
const mqtt = require('mqtt');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fetch = require('node-fetch');
const fs = require('fs');
const { Client: FTPClient } = require('basic-ftp');

const isDev = !app.isPackaged;
let mainWindow = null;
let activePrinters = new Map(); // Map de printer_id -> MQTT client

// Variables de Supabase - obtenidas del mainWindow después de cargar
let SUPABASE_URL = null;
let SUPABASE_ANON_KEY = null;

// Función para actualizar bridge status en BD
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

// Función para actualizar el estado de una impresora específica en BD
async function updatePrinterStatusInDB(printerId, status, gcodeState) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/printers?id=eq.${printerId}`;
    
    const body = JSON.stringify({
      status: status,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: body,
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`[Printer] Error ${response.status}:`, responseText);
    }
  } catch (err) {
    console.error(`[Printer] Error actualizando BD para ${printerId}:`, err.message);
  }
}

// Map para mantener canales Realtime por impresora
const telemetryChannels = new Map();

// Instancia global de cliente Supabase para Realtime
let supabaseRTClient = null;

function initSupabaseRT() {
  if (!supabaseRTClient) {
    const { createClient } = require('@supabase/supabase-js');
    supabaseRTClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseRTClient;
}

// Función para transmitir telemetría via Supabase Realtime
async function broadcastTelemetryToReact(printerId, nozzleTemp, bedTemp, progress, gcodeState) {
  try {
    const supabase = initSupabaseRT();

    // Obtener o crear canal para esta impresora
    let channel = telemetryChannels.get(printerId);
    if (!channel) {
      channel = supabase.channel(`printer:${printerId}:telemetry`);
      
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Canal listo para ${printerId}`);
        }
      });
      
      telemetryChannels.set(printerId, channel);
    }

    // Enviar telemetría usando httpSend (REST API)
    await channel.send({
      type: 'broadcast',
      event: 'telemetry',
      payload: {
        printer_id: printerId,
        nozzle_temp: nozzleTemp,
        bed_temp: bedTemp,
        progress: progress,
        gcode_state: gcodeState,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(`[Realtime] Error:`, err.message);
  }
}

// Configurar electron-updater para GitHub Releases
autoUpdater.allowDowngrade = false;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false; // Instalamos manualmente con delay

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
      
      // Marcar impresora como conectada
      updatePrinterStatusInDB(printerId, 'idle', 'IDLE');
      
      // Notificar a React sobre el cambio de conexión
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('printer-connection-status', {
          printer_id: printerId,
          is_connected: true,
          status: 'idle',
        });
      }
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.print) {
          // Determinar estado de la impresora basado en gcode_state
          let printerStatus = 'idle';
          const gcodeState = data.print.gcode_state ?? 'IDLE';
          
          if (gcodeState === 'RUNNING' || gcodeState === 'PRINTING') {
            printerStatus = 'printing';
          } else if (gcodeState === 'PAUSE') {
            printerStatus = 'paused';
          }
          
          // Extraer datos de telemetría (redondeados)
          const nozzleTemp = Math.round(data.print.nozzle_temper ?? 0); // Convierte 220.03125 en 220
          const bedTemp = Math.round(data.print.bed_temper ?? 0);       // Convierte 65.03125 en 65
          const progress = data.print.mc_percent ?? 0;
          
          // Actualizar estado en BD
          updatePrinterStatusInDB(printerId, printerStatus, gcodeState);
          
          // Transmitir telemetría en tiempo real via Realtime
          broadcastTelemetryToReact(printerId, nozzleTemp, bedTemp, progress, gcodeState);
          
          const telemetry = {
            printer_id: printerId,
            nozzle_temp: nozzleTemp,
            bed_temp: bedTemp,
            progress: progress,
            gcode_state: gcodeState,
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
      // Marcar como error si hay problema de conexión
      updatePrinterStatusInDB(printerId, 'error', 'ERROR');
    });

    client.on('close', () => {
      activePrinters.delete(printerId);
      
      // Marcar impresora como offline
      updatePrinterStatusInDB(printerId, 'offline', 'OFFLINE');
      
      // Notificar a React sobre el cambio de desconexión
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('printer-connection-status', {
          printer_id: printerId,
          is_connected: false,
          status: 'offline',
        });
      }
      
      // Actualizar BD cuando no hay impresoras conectadas
      if (activePrinters.size === 0) {
        updateBridgeStatusInDB(false);
      }
    });

  } catch (err) {
    console.error(`[MQTT] Error al conectar ${printerId}: ${err.message}`);
    // Marcar como error si no se puede conectar
    updatePrinterStatusInDB(printerId, 'error', 'ERROR');
  }
}

function disconnectFromPrinter(printerId) {
  const client = activePrinters.get(printerId);
  if (client) {
    client.end();
    activePrinters.delete(printerId);
    console.log(`[MQTT] Desconectado de impresora ${printerId}`);
    
    // Marcar como offline
    updatePrinterStatusInDB(printerId, 'offline', 'OFFLINE');
    
    // Actualizar BD cuando se desconecta
    if (activePrinters.size === 0) {
      updateBridgeStatusInDB(false);
    }
  }
}

// ===== HANDLERS IPC =====
ipcMain.handle('app:init-supabase', (event, { supabaseUrl, supabaseKey }) => {
  SUPABASE_URL = supabaseUrl;
  SUPABASE_ANON_KEY = supabaseKey;
  console.log('[ENV] Supabase configurado desde React ✅');
  return { success: true };
});

ipcMain.handle('printer:connect', (event, printer) => {
  connectToPrinter(printer.id, printer.ip, printer.access_code, printer.serial_number);
  return { success: true };
});

ipcMain.handle('printer:disconnect', (event, printerId) => {
  disconnectFromPrinter(printerId);
  return { success: true };
});

ipcMain.handle('printer:upload-file', async (event, { fileName, fileBuffer, printer }) => {
  const client = new FTPClient();
  
  try {
    if (!fileName || !fileBuffer || !printer.ip) {
      throw new Error('Datos incompletos');
    }

    console.log(`[FTP] Conectando a ${printer.ip}:990 (FTPS implícito)...`);
    console.log(`[FTP] Tamaño del archivo: ${fileBuffer.length} bytes`);

    // Conectar por FTPS implícito (Bambu Lab)
    await client.access({
      host: printer.ip,
      port: 990,
      user: 'bblp',
      password: printer.access_code,
      secure: 'implicit', // FTPS implícito (comienza con TLS directamente)
      secureOptions: {
        rejectUnauthorized: false, // Acepta certificado autofirmado
      },
      timeout: 30000,
      pasvTimeout: 30000,
    });

    console.log(`[FTP] ✅ Conectado a ${printer.ip}`);

    // Configurar progreso
    client.trackProgress((info) => {
      const progress = Math.round((info.bytes / info.bytesOverall) * 100);
      console.log(`[FTP] Progreso: ${progress}%`);
      event.sender.send('printer:upload-progress', {
        fileName: fileName,
        progress: progress,
        bytesTransferred: info.bytes,
        bytesTotal: info.bytesOverall,
      });
    });

    // Convertir buffer a Buffer de Node
    const buffer = Buffer.from(fileBuffer);
    
    console.log(`[FTP] Iniciando upload de ${fileName}...`);
    
    // Subir archivo a la raíz remota
    await client.uploadFrom(buffer, `/${fileName}`);
    
    console.log(`[FTP] ✅ ${fileName} subido exitosamente a ${printer.ip}`);
    
    return { 
      success: true, 
      fileName: fileName,
    };
  } catch (err) {
    console.error(`[FTP] Error:`, err.message);
    console.error(`[FTP] Stack:`, err.stack);
    return { 
      success: false, 
      error: err.message,
    };
  } finally {
    try {
      await client.close();
      console.log(`[FTP] Conexión cerrada`);
    } catch (err) {
      console.error(`[FTP] Error cerrando conexión:`, err.message);
    }
  }
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

ipcMain.on('updater:quit-and-install', () => {
  try {
    console.log('[Updater] Iniciando instalación...');
    // Cerrar todos los listeners de MQTT antes de cerrar
    activePrinters.forEach((client) => {
      try {
        client.end();
      } catch (e) {
        // ignore
      }
    });
    activePrinters.clear();

    // Esperar 1000ms para permitir que se cierren recursos y archivos
    setTimeout(() => {
      console.log('[Updater] Instalando actualización...');
      autoUpdater.quitAndInstall(false, true); // force = false, diff = true
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
