# Electron Setup - RepuestosYa Admin

## ✅ Configuración activa

```bash
pnpm dev:electron
```

Levanta:
- **Vite dev server** (React en `http://localhost:5173` o puerto libre)
- **Electron main process** con bridge embebido
- **Bridge HTTP Server** en `localhost:8787` (MQTT validation)

## Estructura

```
apps/admin/
├── src-electron/
│   ├── main.js              → Electron main process + bridge HTTP
│   ├── preload.js           → Secure IPC context bridge
│   └── wait-for-vite.js     → Script que espera Vite y abre Electron
├── src/
│   ├── App.jsx              → Routes
│   ├── components/layout/   → Layout components
│   ├── pages/impresion3d/   → Granja (printers)
│   └── hooks/usePrinters.js → Supabase + IPC/HTTP bridge
├── package.json             → Scripts + main entry
└── vite.config.js           → Vite config (renderer only)
```

## Desarrollo

### Dev Electron (recomendado)
```bash
cd apps/admin
pnpm dev:electron
```

- ✅ Vite levanta en puerto libre (5173+)
- ✅ wait-for-vite.js espera a que responda correctamente
- ✅ Electron abre con bridge embebido
- ✅ DevTools abierto para debugging

### Dev Web puro (sin Electron)
```bash
# Terminal 1
pnpm --filter printer-bridge dev

# Terminal 2
pnpm dev
```

- App en `http://localhost:5173`
- Bridge HTTP en `http://localhost:8787`
- Sin IPC, solo HTTP calls

## Bridge API

### En Electron (IPC):
```javascript
const result = await window.electron.bridge.validatePrinter(name, ip)
// { success: true, serial: "..." } o { success: false, error: "..." }

const health = await window.electron.bridge.health()
// { status: "ok", bridge: true }
```

### En navegador (HTTP directo):
```javascript
const res = await fetch('http://localhost:8787/printers/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, ip })
})
```

### usePrinters hook (auto-detección):
```javascript
// Hook detecta automáticamente si está en Electron o no
const { printers, addPrinter } = usePrinters()
await addPrinter(name, ip) // Usa IPC o HTTP según contexto
```

## Build & Distribución

### Build React (para Electron)
```bash
pnpm build
# Genera: dist/index.html + assets
```

### Empaquetar con Electron Builder (local)
```bash
pnpm build:electron
```

Genera:
- `dist-build/RepuestosYa-Admin-X.Y.Z.exe` — instalador NSIS
- `dist-build/RepuestosYa-Admin-X.Y.Z-portable.exe` — portable (no requiere instalación)

### Ejecutar build localmente (sin Electron)
```bash
ELECTRON_DEV=false electron .
```

Electron cargará `dist/index.html` (sin dev server).

### Distribución vía GitHub Releases

**Workflow automático:**
1. Tag una versión: `git tag v1.0.0 && git push --tags`
2. GitHub Actions buildea y crea release automáticamente
3. Los `.exe` aparecen en releases
4. El botón "Descargar Escritorio" en el admin linkea a: `https://github.com/TIZIANO/RepuestosYa/releases`

**Config:**
- `.github/workflows/build-electron.yml` — workflow
- `electron-builder.yml` — configuración de empaquetado
- `apps/admin/src/components/DownloadElectron.jsx` — botón de descarga

## Endpoints Bridge

```
POST /printers/validate
  Input: { name?, ip }
  Output: { ok: true, serial? } | { error }
  
GET /health
  Output: { status: "ok", bridge: true }
```

## Notas Técnicas

- **main.js** es ESM (`"type": "module"` en package.json)
- **Bridge MQTT** usa `mqtt://bblp:unknown@{ip}:8883` (puerto TLS)
- **IPC handlers** en main.js: `ipcMain.handle("bridge:*")`
- **Preload** expone `window.electron.bridge` con contextIsolation=true
- **Detección Vite** en wait-for-vite.js busca en puertos 5173-5180
- **Dev timeout** si Vite no responde en 60s, sale con error

## Troubleshooting

### Electron abre pero app en blanco
- DevTools debería estar abierto → ver errores
- Verificar `[Main] Cargando desde http://localhost:XXXX` en console
- Si muestra error de conectar, Vite no está listo

### "unable to find electron app at..."
- Asegurar `package.json` tiene `"main": "src-electron/main.js"`
- `cd apps/admin` antes de correr

### Bridge no responde
- Verificar puerto 8787 libre: `netstat -tulpn | grep 8787` (Linux)
- Revisar logs en console de Electron (DevTools)
- `window.electron.bridge.health()` debería retornar `{status: "ok", bridge: true}`

### Puerto ocupado (5173-5180)
- Cerrar terminals y procesos anteriores
- Windows: `taskkill /F /IM node.exe; taskkill /F /IM electron.exe`
- Linux/Mac: `pkill node; pkill electron`

## Next Steps

1. **Validación MQTT funcional** → agregar access_code desde form
2. **Realtime printer status** → Supabase Realtime o WebSocket
3. **Print commands** → enviar jobs vía bridge
4. **Electron Builder** → empaquetar para distribución
