# Arquitectura RepuestosYa

## 🏗️ Estructura General

```
Electron App (RepuestosYa)
├── React UI (Vite)
│   ├── Granja: lista y gestión de impresoras
│   ├── Calculadora: cálculo de costos
│   └── Actualización: verificar versiones (auto-updater)
│
└── Supabase
    ├── printers: datos de impresoras
    ├── printer_telemetry: temperatura en tiempo real (para futuro)
    └── auth: login/logout
```

> **Nota**: El código de Electron es minimal. Solo maneja:
> - ✅ Crear ventana
> - ✅ Cargar React desde Vite (dev) o dist (prod)
> - ✅ electron-updater para GitHub Releases


## 📡 Flujo Simple

### **Agregar Impresora**

```
Usuario → React UI → Formulario (nombre, IP, access code)
    ↓
Guarda en Supabase (tabla printers)
    ↓
Aparece en la lista con estado "idle"
```

> **Nota**: Sin MQTT en Electron. Solo se guardan los datos.
> La telemetría será un servicio separado en fase 2.

## 📁 Archivos Clave

| Ruta | Propósito |
|------|-----------|
| `apps/admin/src-electron/main.js` | Electron main, crea ventana, electron-updater |
| `apps/admin/src-electron/preload.js` | Expone APIs seguras (updater) al renderer |
| `apps/admin/src-electron/icon.ico` | Icono de la app |
| `apps/admin/src/hooks/usePrinters.js` | Lee/escribe lista de impresoras en Supabase |
| `apps/admin/src/pages/impresion3d/granja/Granja.jsx` | UI: cards de impresoras |

## 🔐 Seguridad (RLS en Supabase)

### Tabla `printers`
- ✅ **SELECT**: Todos los usuarios autenticados ven todas las impresoras
- ✅ **INSERT**: Usuario autenticado puede agregar (user_id = auth.uid())
- ✅ **UPDATE**: Solo el owner puede actualizar
- ✅ **DELETE**: Solo el owner puede eliminar

### Tabla `printer_telemetry`
- ⏳ Por definir (fase 2, cuando haya servicio de telemetría)

## 🚀 Cómo Testear

### 1. Levantar la app
```bash
cd apps/admin
pnpm electron:dev
```

### 2. En DevTools (F12)
Mira estos logs:
- `[Updater]` - logs del auto-updater
- Errores si hay

### 3. Agregar impresora
- Click "+ Agregar"
- Nombre, IP, Access Code
- Se guarda en Supabase
- Aparece en la lista

### 4. Gestionar
- Ver lista de impresoras
- Eliminar (solo el owner)
- Editar (solo el owner)

## 🔧 Variables de Entorno

En `apps/admin/.env`:
```env
VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

⚠️ **No committear credenciales sensibles** — está en `.gitignore`

## 🐛 Troubleshooting

### "No puedo agregar impresora"

1. Verifica que estés autenticado (login)
2. Verifica que Supabase esté bien configurado en `.env`
3. Chequea en DevTools si hay error de Supabase

### "No veo las impresoras guardadas"

1. Recarga la app
2. Verifica en Supabase que la fila esté en `printers`
3. Chequea RLS en Supabase

## 📊 Columnas de `printers`

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| `id` | BIGSERIAL | 1 |
| `name` | VARCHAR | "Bambu A1" |
| `ip` | VARCHAR | "192.168.1.100" |
| `access_code` | VARCHAR | "12345678" |
| `serial` | VARCHAR | "01S00A..." (nullable) |
| `status` | VARCHAR | "idle", "offline" |
| `user_id` | UUID | auth.uid() |
| `created_at` | TIMESTAMP | 2026-11-10T... |
| `updated_at` | TIMESTAMP | 2026-11-10T... |

## 🎯 Próximas Fases

### **Fase 2: Telemetría en Tiempo Real**
- [ ] Servicio Node separado para MQTT
- [ ] Cliente MQTT persistente
- [ ] Guarda en `printer_telemetry`
- [ ] Realtime en UI

### **Fase 3: Control Remoto**
- [ ] Pausar/cancelar impresiones
- [ ] Calentar nozzle/cama
- [ ] Edge Functions en Supabase

### **Fase 4: Dashboard**
- [ ] Historial de impresiones
- [ ] Estadísticas
- [ ] Notificaciones
