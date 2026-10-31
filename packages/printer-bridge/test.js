/**
 * Script de testing para el Bridge MQTT
 * Uso: node test.js <ip> [accessCode]
 * 
 * Ejemplo:
 *   node test.js 192.168.1.100 12345678
 */

const args = process.argv.slice(2)
const ip = args[0]
const accessCode = args[1] || "00000000"

if (!ip) {
  console.log("❌ Uso: node test.js <ip> [accessCode]")
  console.log("   Ejemplo: node test.js 192.168.1.100 12345678")
  process.exit(1)
}

console.log(`\n🧪 Testing Bridge MQTT`)
console.log(`   IP: ${ip}`)
console.log(`   Access Code: ${accessCode}`)
console.log(`   Bridge URL: http://localhost:8787\n`)

async function test() {
  // 1. Health check
  console.log("1️⃣  Health check...")
  try {
    const healthRes = await fetch("http://localhost:8787/health")
    const health = await healthRes.json()
    console.log(`   ✓ Bridge activo:`, health)
  } catch (err) {
    console.log(`   ✗ Error:`, err.message)
    console.log("   → ¿El bridge está corriendo? Ejecuta: pnpm dev\n")
    return
  }

  // 2. Validar conexión
  console.log("\n2️⃣  Validando conexión MQTT...")
  try {
    const validateRes = await fetch("http://localhost:8787/printers/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ip,
        name: "Test Printer",
        accessCode,
      }),
    })

    const validate = await validateRes.json()

    if (validateRes.ok) {
      console.log(`   ✓ Conexión exitosa`)
      console.log(`   Serial:`, validate.serial || "N/A")
      console.log(`   Message:`, validate.message)
    } else {
      console.log(`   ✗ Error:`, validate.error)
      console.log(`   Detalles:`, validate.details)
      return
    }
  } catch (err) {
    console.log(`   ✗ Error:`, err.message)
    return
  }

  // 3. Obtener estado
  console.log("\n3️⃣  Obteniendo estado de la impresora...")
  try {
    const statusRes = await fetch("http://localhost:8787/printers/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, accessCode }),
    })

    const status = await statusRes.json()

    if (statusRes.ok && status.success) {
      console.log(`   ✓ Estado obtenido:`)
      console.log(`      Online:      ${status.online ? "✓" : "✗"}`)
      console.log(`      State:       ${status.state}`)
      console.log(`      Temperature: ${status.temperature}°C`)
      console.log(`      Serial:      ${status.serial || "N/A"}`)
    } else {
      console.log(`   ✗ Error:`, status.error)
      return
    }
  } catch (err) {
    console.log(`   ✗ Error:`, err.message)
    return
  }

  console.log("\n✅ Todos los tests pasaron!\n")
}

test()
