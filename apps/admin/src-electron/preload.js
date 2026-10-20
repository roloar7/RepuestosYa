import { contextBridge, ipcRenderer } from "electron"

/**
 * Exponer API segura al renderer (React app)
 * El renderer accede via window.electron.*
 */
contextBridge.exposeInMainWorld("electron", {
  bridge: {
    validatePrinter: (name, ip, accessCode) =>
      ipcRenderer.invoke("bridge:validate-printer", name, ip, accessCode),
    health: () => ipcRenderer.invoke("bridge:health"),
    tailscaleStatus: () => ipcRenderer.invoke("bridge:tailscale-status"),
  },
})
