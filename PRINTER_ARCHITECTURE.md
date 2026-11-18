# Arquitectura de Drivers de Impresoras - RepuestosYa

## Overview

Sistema escalable y agnóstico de marca para gestionar impresoras 3D múltiples en modo local (LAN) y remoto (sin VPN). Implementa el patrón **Strategy/Adapter** para soportar distintos protocolos y marcas sin condicionales en el código principal.

**Fecha**: Nov 18, 2026  
**Versión**: 1.0 - Base Architecture  
**Stack**: Node.js (Electron) + Supabase Realtime + PostgreSQL

---

## 1. Componentes Core

### 1.1 `BasePrinterDriver` (Abstract)

Clase abstracta que define el contrato obligatorio para cualquier driver de impresora.

**Ubicación**: `apps/admin/src-electron/lib/printer-drivers/BasePrinterDriver.js`

**Interfaz pública**:
```javascript
async connect()                    // Conectar a impresora
async disconnect()                 // Desconectar
async uploadAndPrint(path, name)   // Subir archivo e imprimir
async pause()                      // Pausar impresión
async resume()                     // Reanudar impresión
async stop()                       // Detener impresión
async startCamera(callback)        // Iniciar stream de cámara
async stopCamera()                 // Detener stream de cámara
getNormalizedTelemetry()           // Obtener estado normalizado

// Listener pattern
on(event, callback)                // Suscribirse a eventos
emit(event, data)                  // Emitir evento
off(event, callback)               // Desuscribirse
```

**Eventos emitidos**:
- `'connect'` - Conexión exitosa
- `'disconnect'` - Desconexión
- `'telemetry'` - Datos de telemetría
- `'error'` - Error en driver

---

### 1.2 `BambuDriver` (Implementación para Bambu Lab)

Implementación completa para impresoras Bambu Lab (A1, P1, X1) con soporte para:
- **MQTT** (puerto 8883)
- **FTPS** (puerto 990)
- **Cámara** (puerto 6000, placeholder)
- **Stateful Telemetry Merging** (fusión inteligente de estado)

**Ubicación**: `apps/admin/src-electron/lib/printer-drivers/BambuDriver.js`

#### Configuración MQTT
```javascript
{
  protocolVersion: 4,      // MQTT 3.1.1 (como Bambu Studio)
  clean: true,             // Evita saturar memoria del broker embebido
  keepalive: 10,           // PING cada 10 segundos
  reconnectPeriod: 2000,   // Reconexión rápida si Wi-Fi parpadea
  connectTimeout: 10000,   // Timeout 10s para conexión inicial
  rejectUnauthorized: false // Certificado autofirmado
}
```

#### Polling Activo
```
Cada 3 segundos:
  client.publish("device/{SERIAL}/request", {
    pushing: {
      sequence_id: timestamp,
      command: "pushall"  // Pide estado completo a impresora
    }
  })
```

**Beneficio**: Mantiene Wi-Fi de la A1 despierto y obtiene datos más estables.

#### Stateful Telemetry Merging
```javascript
// Acumula estado, solo fusiona delta (campos presentes)
const newTelemetry = {
  nozzle_temp: data.print.nozzle_temper ? Math.round(...) : previous.nozzle_temp,
  bed_temp: data.print.bed_temper ? Math.round(...) : previous.bed_temp,
  progress: data.print.mc_percent ?? previous.progress,
  gcode_state: data.print.gcode_state ?? previous.gcode_state,
  // No sobrescribir con 0 o undefined
};
```

**Ventaja**: Evita pérdida de datos cuando la impresora envía paquetes parciales.

#### Normalización de Telemetría
```javascript
{
  printer_id: "uuid",
  protocol: "bambu_lan",
  is_connected: true,
  status: "printing",         // printing | paused | idle | error
  nozzle_temp: 230,          // Redondeado
  bed_temp: 60,              // Redondeado
  progress: 45,              // 0-100%
  gcode_state: "RUNNING",    // RUNNING | IDLE | PAUSE
  timestamp: "ISO8601"
}
```

---

### 1.3 `PrinterFarmManager` (Gestor Central)

Coordina todas las instancias de drivers, telemetría y comandos.

**Ubicación**: `apps/admin/src-electron/lib/farm/PrinterFarmManager.js`

**Responsabilidades**:
- Crear/destruir drivers según protocolo
- Coordinar telemetría de N impresoras
- Publicar telemetría throttled (2-3s)
- Ejecutar comandos remotos en impresoras específicas
- Mantener estado global de la granja

**API Pública**:
```javascript
async connectPrinter(printerConfig)   // Conectar impresora
async disconnectPrinter(printerId)    // Desconectar
async executeCommand(id, cmd, params) // pause | resume | stop | print | camera:*
getStatus()                           // Estado global
async shutdown()                      // Cleanup
```

**Throttling de Telemetría**:
```
Por cada impresora:
  - Acumula eventos de telemetría
  - Envía solo si:
    * Pasaron N ms (3000ms default) O
    * Cambió gcode_state (prioritario)
  - Evita saturar IPC + Realtime
```

---

### 1.4 `TransportLayer` (Comunicación Dual)

Gestiona comunicación bidireccional local + remota.

**Ubicación**: `apps/admin/src-electron/lib/farm/TransportLayer.js`

**Canales**:
1. **IPC Local** (`farm:telemetry`, `farm:printer-*`)
   - React recibe actualizaciones en tiempo real
   - Latencia mínima (sub-100ms)
   - No depende de internet

2. **Realtime Broadcast** (`farm-telemetry`, `farm-commands`)
   - Telemetría hacia otros agentes
   - Comandos remotos desde clientes
   - Funciona sin VPN

**Flujo de Telemetría**:
```
PrinterFarmManager (telemetry event)
    ↓
TransportLayer.handleTelemetryFromFarm()
    ├─ IPC → React (tiempo real local)
    ├─ Realtime → Otros agentes
    └─ BD → Persistencia (async)
```

**Flujo de Comandos Remotos**:
```
Realtime farm-commands (broadcast)
    ↓
TransportLayer.handleRemoteCommand()
    ↓
PrinterFarmManager.executeCommand()
    ↓
BambuDriver.pause() / resume() / stop()
    ↓
Impresora
```

---

## 2. Protocolo de Integración

### 2.1 Configuración de Impresora en BD

Tabla `printers` - Columnas clave:
```sql
protocol VARCHAR(50)       -- 'bambu_lan', 'klipper_moonraker', etc.
credentials JSONB          -- { access_code, serial_number, model, ... }
agent_location VARCHAR(100)-- 'nave-1', 'nave-2', 'remote', etc.
```

**Ejemplo para Bambu**:
```json
{
  "protocol": "bambu_lan",
  "credentials": {
    "access_code": "XXXXXX",
    "serial_number": "0M11XXXX",
    "model": "A1"
  }
}
```

### 2.2 Factory Pattern

```javascript
// apps/admin/src-electron/lib/printer-drivers/index.js
function createPrinterDriver(protocol, printerConfig) {
  switch (protocol) {
    case 'bambu_lan':
      return new BambuDriver(printerConfig);
    case 'klipper_moonraker':
      return new MoonrakerDriver(printerConfig); // Futuro
    default:
      throw new Error(`Protocol not supported: ${protocol}`);
  }
}
```

**Uso**:
```javascript
const driver = createPrinterDriver('bambu_lan', {
  id: 'uuid',
  name: 'A1 Mini',
  ip: '192.168.0.100',
  protocol: 'bambu_lan',
  credentials: { ... }
});
```

---

## 3. Flujo de Integración en main.js

**Antes** (monolítico):
```
main.js
  ├─ Conexión MQTT directa
  ├─ Telemetría en listener
  ├─ FTPS upload
  ├─ BD updates
  └─ IPC handlers
```

**Después** (modular):
```
main.js (delegación)
    ↓
PrinterFarmManager (coordinación)
    ├─ BambuDriver (MQTT/FTPS)
    ├─ BambuDriver (MQTT/FTPS)
    └─ BambuDriver (MQTT/FTPS)
       ↓
TransportLayer (comunicación)
    ├─ IPC → React
    ├─ Realtime → BD + Otros agentes
    └─ BD REST → Persistencia
```

---

## 4. Tabla de Estados y Transiciones

| Estado | Descripción | Causas | Acciones Permitidas |
|--------|-------------|--------|-------------------|
| `idle` | Listo, sin impresión | IDLE, PAUSE | print, camera |
| `printing` | Imprimiendo actualmente | RUNNING, PRINTING | pause, stop |
| `paused` | Impresión pausada | PAUSE | resume, stop |
| `error` | Error de conexión/comando | Error MQTT, timeout | disconnect, reconnect |
| `offline` | Desconectada | No MQTT en 10s timeout | connect |

---

## 5. Futuras Implementaciones

### 5.1 `MoonrakerDriver` (Klipper / Creality K1)

Cuando sea necesario, crear:
```javascript
// apps/admin/src-electron/lib/printer-drivers/MoonrakerDriver.js
class MoonrakerDriver extends BasePrinterDriver {
  // WebSockets (7125) + HTTP REST
  // Mismo formato normalizado que BambuDriver
  // Mismo listener pattern
}
```

**Por qué funciona sin cambios en code**:
- Factory detecta `protocol: 'klipper_moonraker'`
- PrinterFarmManager no se entera (interface uniforme)
- TransportLayer igual (NormalizedTelemetry)
- React igual (mismo formato de eventos)

### 5.2 Multi-Agente

Cuando escales a múltiples ubicaciones:
```
Cloud (Supabase)
    ↓
  Realtime farm-telemetry
    ↓
┌───────────────┬───────────────┐
↓               ↓               ↓
Nave 1 Agent    Nave 2 Agent    Remote Agent
(Bambu LAN)     (Bambu LAN)     (Moonraker WAN)
```

Cada agente es independiente, reporta a Supabase central.

---

## 6. Performance y Límites

| Métrica | Valor | Notas |
|---------|-------|-------|
| MQTT Keepalive | 10s | Evita desconexiones Wi-Fi flácidas |
| Polling pushall | 3s | Mantiene A1 despierto |
| Telemetry Throttle | 2-3s | Reduce carga IPC + Realtime |
| IPC Latency | <100ms | Local, no internet |
| Realtime Latency | 100-500ms | Depende de internet |
| DB Persistence | Async | No bloquea telemetry |
| Max Printers/Agente | 10-20 | A validar con carga real |

---

## 7. Logging y Debugging

Cada driver logea con prefijo:
```
[Printer Name] Conectando a 192.168.0.100:8883...
[Printer Name] ✅ Conectado vía MQTT
[Printer Name] 🔄 Polling: enviando pushall...
[Printer Name] ❌ Error: Timeout
```

TransportLayer logea eventos:
```
[Transport] 📡 Realtime telemetry: SUBSCRIBED
[Transport] Impresora 123e456 conectada
[Transport] Comando remoto recibido: pause
```

PrinterFarmManager logea coordinación:
```
[Farm] Conectando impresora A1 Mini...
[Farm] ✅ A1 Mini conectada
[Farm] Estado: 2/5 conectadas, 1 imprimiendo
```

---

## 8. Checklist de Implementación

- [x] BasePrinterDriver (abstract class)
- [x] BambuDriver (MQTT + FTPS + Stateful Merge)
- [x] PrinterFarmManager (coordinación)
- [x] TransportLayer (IPC + Realtime)
- [x] Factory pattern (createPrinterDriver)
- [ ] Integración en main.js refactorizado
- [ ] React hooks adaptados (usePrinterFarm)
- [ ] DB schema migration (protocol + credentials)
- [ ] Tests unitarios por driver
- [ ] MoonrakerDriver skeleton
- [ ] Multi-agente config (futuro)

---

## 9. Referencias

- **MQTT 3.1.1 Spec**: https://mqtt.org/mqtt-specification-v3-1-1
- **Bambu Lab MQTT**: Reverse-engineered desde Bambu Studio
- **Supabase Realtime**: https://supabase.com/docs/guides/realtime
- **Strategy Pattern**: Design pattern para intercambiar algoritmos en tiempo de ejecución

