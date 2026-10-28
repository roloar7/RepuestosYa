const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expone APIs seguras al renderer (React app)
 * El renderer accede via window.electron.*
 */
contextBridge.exposeInMainWorld('electron', {
  bridge: {
    validatePrinter: (name, ip, accessCode) =>
      ipcRenderer.invoke('bridge:validate-printer', name, ip, accessCode),
  },

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
  },
});
