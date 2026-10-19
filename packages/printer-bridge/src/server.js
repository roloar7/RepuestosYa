import http from "http"
import mqtt from "mqtt"

const PORT = process.env.BRIDGE_PORT || 8787

// Store de conexiones activas por IP
const connections = new Map()

async function validatePrinter(ip) {
  console.log(`[Bridge] Validando impresora en ${ip}...`)

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.log(`[Bridge] Timeout al conectar a ${ip}`)
      resolve({ success: false, error: "Timeout: no hay respuesta de la impresora" })
    }, 10000)

    try {
      // URL MQTT: mqtt://<user>:<pass>@<ip>:8883
      // Para Bambu: user=bblp, pass=access_code (el código LAN de developer mode)
      // Por ahora, asumimos que el access_code se pasa después o está en una config
      const brokerUrl = `mqtt://bblp:unknown@${ip}:8883`

      const client = mqtt.connect(brokerUrl, {
        rejectUnauthorized: false, // TLS self-signed (Bambu)
        connectTimeout: 5000,
        reconnectPeriod: 0, // No intentar reconectar automáticamente
      })

      client.on("connect", () => {
        console.log(`[Bridge] Conectado a ${ip}`)
        client.end()
        clearTimeout(timeoutId)
        resolve({ success: true, serial: null }) // Serial se obtendría del MQTT report
      })

      client.on("error", (err) => {
        console.log(`[Bridge] Error MQTT en ${ip}:`, err.message)
        clearTimeout(timeoutId)
        // Si falla auth (password), lo intentamos de todas formas
        // En producción validaríamos el access_code primero
        resolve({
          success: false,
          error: `No se puede conectar a ${ip}: ${err.message}`,
        })
      })

      client.on("offline", () => {
        console.log(`[Bridge] Desconectado de ${ip}`)
      })
    } catch (err) {
      console.error(`[Bridge] Excepción en validatePrinter:`, err)
      clearTimeout(timeoutId)
      resolve({ success: false, error: err.message })
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
        const { name, ip } = JSON.parse(body)

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
        console.error("[Bridge] Error en /printers/validate:", err)
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

server.listen(PORT, () => {
  console.log(`🖨️ [Bridge] Corriendo en http://localhost:${PORT}`)
  console.log(`   POST /printers/validate — Validar conexión a impresora`)
  console.log(`   GET /health — Estado del bridge`)
})

process.on("SIGINT", () => {
  console.log("\n[Bridge] Cerrando...")
  server.close(() => process.exit(0))
})
