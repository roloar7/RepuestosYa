import { app, BrowserWindow, ipcMain } from "electron"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import http from "http"
import mqtt from "mqtt"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BRIDGE_PORT = 8787
const isDev = process.env.ELECTRON_DEV === "true"

let mainWindow
let _bridgeServer

/**
 * Bridge HTTP Server embebido en Electron main process
 */
function createBridgeServer() {
  return new Promise((resolve) => {
    async function validatePrinter(ip) {
      console.log(`[Bridge] Validando impresora en ${ip}...`)

      return new Promise((resolveValidate) => {
        const timeoutId = setTimeout(() => {
          console.log(`[Bridge] Timeout al conectar a ${ip}`)
          resolveValidate({
            success: false,
            error: "Timeout: no hay respuesta de la impresora",
          })
        }, 10000)

        try {
          const brokerUrl = `mqtt://bblp:unknown@${ip}:8883`

          const client = mqtt.connect(brokerUrl, {
            rejectUnauthorized: false,
            connectTimeout: 5000,
            reconnectPeriod: 0,
          })

          client.on("connect", () => {
            console.log(`[Bridge] Conectado a ${ip}`)
            client.end()
            clearTimeout(timeoutId)
            resolveValidate({ success: true, serial: null })
          })

          client.on("error", (err) => {
            console.log(`[Bridge] Error MQTT en ${ip}:`, err.message)
            clearTimeout(timeoutId)
            resolveValidate({
              success: false,
              error: `No se puede conectar a ${ip}: ${err.message}`,
            })
          })
        } catch (err) {
          console.error(`[Bridge] Excepción:`, err)
          clearTimeout(timeoutId)
          resolveValidate({ success: false, error: err.message })
        }
      })
    }

    const server = http.createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*")
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      res.setHeader("Access-Control-Allow-Headers", "Content-Type")

      if (req.method === "OPTIONS") {
        res.writeHead(200)
        res.end()
        return
      }

      if (req.method === "POST" && req.url === "/printers/validate") {
        let body = ""
        req.on("data", (chunk) => {
          body += chunk.toString()
        })

        req.on("end", async () => {
          try {
            const { ip } = JSON.parse(body)

            if (!ip) {
              res.writeHead(400, { "Content-Type": "application/json" })
              res.end(JSON.stringify({ error: "IP requerida" }))
              return
            }

            const result = await validatePrinter(ip)

            if (result.success) {
              res.writeHead(200, { "Content-Type": "application/json" })
              res.end(JSON.stringify({ ok: true, serial: result.serial }))
            } else {
              res.writeHead(500, { "Content-Type": "application/json" })
              res.end(JSON.stringify({ error: result.error }))
            }
          } catch (err) {
            console.error("[Bridge] Error:", err.message)
            res.writeHead(400, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "JSON inválido" }))
          }
        })
        return
      }

      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ status: "ok", bridge: true }))
        return
      }

      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Not found" }))
    })

    server.listen(BRIDGE_PORT, () => {
      console.log(`🖨️ [Bridge] Embebido en Electron, puerto ${BRIDGE_PORT}`)
      resolve(server)
    })
  })
}

/**
 * Crear la ventana principal
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (isDev) {
    const port = process.env.VITE_PORT || 5173
    const url = `http://localhost:${port}`
    console.log(`[Main] Cargando desde ${url}`)
    mainWindow.loadURL(url)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"))
  }
}

/**
 * Ciclo de vida de Electron
 */
app.on("ready", async () => {
  _bridgeServer = await createBridgeServer()
  createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow()
  }
})

/**
 * IPC: el renderer puede comunicarse con el bridge via main process
 */
ipcMain.handle("bridge:validate-printer", async (event, name, ip) => {
  console.log(`[IPC] Validar impresora: ${name} @ ${ip}`)

  try {
    const response = await fetch(`http://localhost:${BRIDGE_PORT}/printers/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ip }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error }
    }

    return { success: true, ...data }
  } catch (err) {
    console.error("[IPC] Error:", err)
    return { success: false, error: err.message }
  }
})

ipcMain.handle("bridge:health", async () => {
  try {
    const response = await fetch(`http://localhost:${BRIDGE_PORT}/health`)
    const data = await response.json()
    return data
  } catch (_err) {
    return { error: "Bridge no disponible" }
  }
})
