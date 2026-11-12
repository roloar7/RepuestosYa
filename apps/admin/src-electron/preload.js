const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expone APIs seguras al renderer (React app)
 * El renderer accede via window.electron.*
 */
contextBridge.exposeInMainWorld('electron', {
  // --- Impresoras ---
  printer: {
    connect: (printer) => ipcRenderer.invoke('printer:connect', printer),
    disconnect: (printerId) => ipcRenderer.invoke('printer:disconnect', printerId),
  },

  onPrinterStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('printer-status-update', listener);
    return () => ipcRenderer.removeListener('printer-status-update', listener);
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

    quitAndInstall: () => ipcRenderer.send('updater:quit-and-install'),
  },
});
