const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expone APIs seguras al renderer (React app)
 * El renderer accede via window.electron.bridge.*
 */
contextBridge.exposeInMainWorld('electron', {
  bridge: {
    validatePrinter: (name, ip, accessCode) =>
      ipcRenderer.invoke('bridge:validate-printer', name, ip, accessCode),
  },
});
