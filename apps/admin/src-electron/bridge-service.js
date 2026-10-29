const http = require('http')
const mqtt = require('mqtt')

let server = null
let isRunning = false

/**
 * Validar conexión a impresora Bambu via MQTT
 */
async function validatePrinter(ip, accessCode = '00000000') {
  console.log(`[BridgeService] Validando impresora en ${ip}...`)

  return new Promise((resolve) => {
    let resolved = false
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.log(`[BridgeService] Timeout al conectar a ${ip}`)
        resolve({ success: false, error: 'Timeout: no hay respuesta de la impresora en 10 segundos' })
      }
    }, 10000)

    try {
      const brokerUrl = `mqtts://bblp:${accessCode}@${ip}:8883`

      console.log(`[BridgeService] Intentando conectar a ${brokerUrl} (sin verificar certificado)...`)

      const client = mqtt.connect(brokerUrl, {
        rejectUnauthorized: false,
        protocol: 'mqtts',
        port: 8883,
        host: ip,
        username: 'bblp',
        password: accessCode,
        connectTimeout: 8000,
        keepalive: 30,
        clean: true,
        clientId: `RepuestosYa-validator-${Date.now()}`,
        reconnectPeriod: 0,
      })

      client.on('connect', () => {
        if (resolved) return
        resolved = true
        console.log(`[BridgeService] ✓ Conectado a ${ip}`)
        clearTimeout(timeoutId)
        client.end()
        resolve({ success: true, serial: null, message: 'Impresora accesible' })
      })

      client.on('error', (err) => {
        if (resolved) return
        resolved = true
        console.error(`[BridgeService] ✗ Error MQTT en ${ip}:`, err.message)
        clearTimeout(timeoutId)
        client.end()
        resolve({
          success: false,
          error: `Error de conexión MQTT: ${err.message}`,
          details: 'Verifica IP, puerto 8883 abierto, y access code correcto',
        })
      })

      client.on('offline', () => {
        console.warn(`[BridgeService] Impresora desconectada: ${ip}`)
      })

      client.on('disconnect', () => {
        console.log(`[BridgeService] Desconexión de ${ip}`)
      })
    } catch (err) {
      if (resolved) return
      resolved = true
      console.error(`[BridgeService] Excepción al validar ${ip}:`, err.message)
      clearTimeout(timeoutId)
      resolve({ success: false, error: err.message })
    }
  })
}

/**
 * Obtener estado actual de la impresora vía MQTT
 */
async function getPrinterStatus(ip, accessCode = '00000000') {
  console.log(`[BridgeService] Obteniendo estado de ${ip}...`)

  return new Promise((resolve) => {
    let resolved = false
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.log(`[BridgeService] Timeout obteniendo estado de ${ip}`)
        resolve({ success: false, error: 'Timeout: no hay respuesta de la impresora' })
      }
    }, 10000)

    try {
      const brokerUrl = `mqtts://bblp:${accessCode}@${ip}:8883`

      const client = mqtt.connect(brokerUrl, {
        rejectUnauthorized: false,
        protocol: 'mqtts',
        port: 8883,
        host: ip,
        username: 'bblp',
        password: accessCode,
        connectTimeout: 8000,
        keepalive: 30,
        clean: true,
        clientId: `RepuestosYa-status-${Date.now()}`,
        reconnectPeriod: 0,
      })

      const statusData = {
        online: false,
        state: 'unknown',
        temperature: null,
        serial: null,
      }

      client.on('connect', () => {
        console.log(`[BridgeService] Conectado a ${ip}, suscribiendo a topics...`)

        client.subscribe('device/+/report', (err) => {
          if (err) {
            console.error(`[BridgeService] Error suscribirse a reports en ${ip}:`, err.message)
          }
        })
      })

      client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString())
          console.log(`[BridgeService] Mensaje recibido de ${ip}:`, topic)

          statusData.online = true

          if (data.print && data.print.state) {
            statusData.state = data.print.state
          }

          if (data.nozzle_temper !== undefined) {
            statusData.temperature = data.nozzle_temper
          }

          if (data.sn) {
            statusData.serial = data.sn
          }

          if (!resolved) {
            resolved = true
            clearTimeout(timeoutId)
            client.end()
            resolve({ success: true, ...statusData })
          }
        } catch (err) {
          console.error(`[BridgeService] Error procesando mensaje de ${ip}:`, err.message)
        }
      })

      client.on('error', (err) => {
        if (resolved) return
        resolved = true
        console.error(`[BridgeService] Error obteniendo estado de ${ip}:`, err.message)
        clearTimeout(timeoutId)
        client.end()
        resolve({
          success: false,
          error: `Error MQTT: ${err.message}`,
        })
      })

      client.on('offline', () => {
        if (resolved) return
        console.warn(`[BridgeService] Impresora offline: ${ip}`)
      })
    } catch (err) {
      if (resolved) return
      resolved = true
      console.error(`[BridgeService] Excepción en getPrinterStatus:`, err.message)
      clearTimeout(timeoutId)
      resolve({ success: false, error: err.message })
    }
  })
}

/**
 * Iniciar servidor HTTP del bridge
 */
function startBridgeServer(port = 8787) {
  return new Promise((resolve, reject) => {
    if (isRunning) {
      console.log(`[BridgeService] Servidor ya está corriendo en puerto ${port}`)
      resolve(server)
      return
    }

    server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      // POST /printers/validate
      if (req.method === 'POST' && req.url === '/printers/validate') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk.toString()
        })

        req.on('end', async () => {
          try {
            const { name, ip, accessCode } = JSON.parse(body)

            if (!ip) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'IP requerida' }))
              return
            }

            console.log(`[BridgeService] Validando: ${name || '?'} en ${ip}${accessCode ? ' con access code' : ' (sin access code)'}`)

            const result = await validatePrinter(ip, accessCode || '00000000')

            if (result.success) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: true, serial: result.serial, message: result.message }))
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: result.error, details: result.details }))
            }
          } catch (err) {
            console.error('[BridgeService] Error en /printers/validate:', err)
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'JSON inválido o error procesando validación' }))
          }
        })
        return
      }

      // POST /printers/status
      if (req.method === 'POST' && req.url === '/printers/status') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk.toString()
        })

        req.on('end', async () => {
          try {
            const { ip, accessCode } = JSON.parse(body)

            if (!ip) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'IP requerida' }))
              return
            }

            console.log(`[BridgeService] Obteniendo estado de ${ip}...`)

            const status = await getPrinterStatus(ip, accessCode || '00000000')

            if (status.success) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(status))
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: status.error }))
            }
          } catch (err) {
            console.error('[BridgeService] Error en /printers/status:', err)
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'JSON inválido' }))
          }
        })
        return
      }

      // GET /health
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', bridge: true }))
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    })

    server.listen(port, () => {
      isRunning = true
      console.log(`\n🖨️ [BridgeService] Servidor MQTT corriendo en http://localhost:${port}`)
      console.log(`   POST /printers/validate — Validar conexión a impresora`)
      console.log(`   POST /printers/status — Obtener estado de impresora`)
      console.log(`   GET /health — Estado del bridge\n`)
      resolve(server)
    })

    server.on('error', (err) => {
      console.error(`[BridgeService] Error al iniciar servidor:`, err)
      isRunning = false
      reject(err)
    })
  })
}

/**
 * Detener servidor HTTP del bridge
 */
function stopBridgeServer() {
  return new Promise((resolve) => {
    if (!server || !isRunning) {
      console.log('[BridgeService] Servidor ya está detenido')
      resolve()
      return
    }

    server.close(() => {
      isRunning = false
      console.log('[BridgeService] Servidor detenido')
      resolve()
    })
  })
}

module.exports = {
  startBridgeServer,
  stopBridgeServer,
}
