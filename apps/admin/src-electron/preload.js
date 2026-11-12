const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expone APIs seguras al renderer (React app)
 * El renderer accede via window.electron.*
 */
contextBridge.exposeInMainWorld('electron', {
  // --- Impresora Bambu ---
  sendPrinterCommand: (command) => ipcRenderer.send('printer-command', command),
  
  onPrinterStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('printer-status-update', listener);
    // Función de limpieza para prevenir fugas de memoria en React
    return () => ipcRenderer.removeListener('printer-status-update', listener);
  },

  // --- Sistema de Actualizaciones (Updater) ---
  updater: {
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    downloadAndInstall: () => ipcRenderer.invoke('updater:download-and-install'),

    // Suscribirse a cambios de progreso de descarga
    onDownloadProgress: (callback) => {
      const listener = (_event, progress) => callback(progress);
      ipcRenderer.on('updater:download-progress', listener);
      return () => ipcRenderer.removeListener('updater:download-progress', listener);
    },

    // Suscribirse a errores de descarga
    onDownloadError: (callback) => {
      const listener = (_event, error) => callback(error);
      ipcRenderer.on('updater:download-error', listener);
      return () => ipcRenderer.removeListener('updater:download-error', listener);
    },

    quitAndInstall: () => ipcRenderer.send('updater:quit-and-install'),
  },
});
