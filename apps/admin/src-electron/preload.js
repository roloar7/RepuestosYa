import { contextBridge, ipcRenderer } from "electron"

/**
 * Exponer API segura al renderer (React app)
 * El renderer accede via window.electron.*
 */
contextBridge.exposeInMainWorld("electron", {
  bridge: {
    validatePrinter: (name, ip) =>
      ipcRenderer.invoke("bridge:validate-printer", name, ip),
    health: () => ipcRenderer.invoke("bridge:health"),
  },
})
