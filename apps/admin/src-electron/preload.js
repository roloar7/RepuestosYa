const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expone APIs seguras al renderer (React app)
 * El renderer accede via window.electron.*
 */
contextBridge.exposeInMainWorld('electron', {
  // --- App Init ---
  app: {
    initSupabase: (config) => ipcRenderer.invoke('app:init-supabase', config),
  },

  // --- Impresoras ---
  printer: {
    connect: (printer) => ipcRenderer.invoke('printer:connect', printer),
    disconnect: (printerId) => ipcRenderer.invoke('printer:disconnect', printerId),
    uploadFile: (payload) => ipcRenderer.invoke('printer:upload-file', payload),
  },

  onFarmTelemetry: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('farm:telemetry', listener);
    return () => ipcRenderer.removeListener('farm:telemetry', listener);
  },

  onPrinterConnectionStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('farm:printer-connected', listener);
    ipcRenderer.on('farm:printer-disconnected', listener);
    return () => {
      ipcRenderer.removeListener('farm:printer-connected', listener);
      ipcRenderer.removeListener('farm:printer-disconnected', listener);
    };
  },

  onPrinterError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('farm:printer-error', listener);
    return () => ipcRenderer.removeListener('farm:printer-error', listener);
  },

  onUploadProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('printer:upload-progress', listener);
    return () => ipcRenderer.removeListener('printer:upload-progress', listener);
  },

  // --- Sistema de Actualizaciones (Updater) ---
  updater: {
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    downloadAndInstall: () => ipcRenderer.invoke('updater:download-and-install'),

    onDownloadProgress: (callback) => {
      const listener = (_event, progress) => callback(progress);
      ipcRenderer.on('updater:download-progress', listener);
      return () => ipcRenderer.removeListener('updater:download-progress', listener);
    },

    onDownloadError: (callback) => {
      const listener = (_event, error) => callback(error);
      ipcRenderer.on('updater:download-error', listener);
      return () => ipcRenderer.removeListener('updater:download-error', listener);
    },

    onReadyToInstall: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('updater:ready-to-install', listener);
      return () => ipcRenderer.removeListener('updater:ready-to-install', listener);
    },

    quitAndInstall: () => ipcRenderer.send('updater:quit-and-install'),
  },
});
