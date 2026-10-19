import { spawn } from "child_process"
import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = dirname(__dirname)

// Esperar a que Vite levante - verificar que realmente responde HTML válido
async function findVitePort() {
  console.log("⏳ Esperando a que Vite levante (esto puede tomar 10-15 segundos)...\n")
  
  for (let attempt = 0; attempt < 60; attempt++) {
    for (let port = 5173; port <= 5180; port++) {
      try {
        const response = await fetch(`http://localhost:${port}/`, { timeout: 500 })
        if (response.ok) {
          const text = await response.text()
          // Verificar que es realmente Vite (debe tener content)
          if (text.includes("<!DOCTYPE") || text.includes("<html")) {
            console.log(`✅ Vite listo en puerto ${port}`)
            return port
          }
        }
      } catch (_) {
        // Puerto no responde
      }
    }
    
    if (attempt % 5 === 0 && attempt > 0) {
      console.log(`...intentando (${attempt}s)`)
    }
    
    await new Promise((r) => setTimeout(r, 1000))
  }
  
  console.log("❌ Timeout esperando Vite")
  process.exit(1)
}

const port = await findVitePort()

console.log(`✅ Lanzando Electron con Vite en puerto ${port}...\n`)

const electron = spawn("electron", ["."], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ELECTRON_DEV: "true", VITE_PORT: port },
})

electron.on("error", (err) => {
  console.error("❌ Error Electron:", err.message)
  process.exit(1)
})

electron.on("exit", (code) => {
  process.exit(code || 0)
})

process.on("SIGINT", () => {
  electron.kill()
  process.exit(0)
})
