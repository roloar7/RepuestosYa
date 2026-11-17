# Telemetría de Impresoras - Arquitectura

## Overview
Sistema en tiempo real para capturar y transmitir telemetría de impresoras Bambu Lab conectadas vía MQTT. Usa **Supabase Realtime Broadcast** para flujo continuo sin tabla estática.

## Arquitectura de Datos

### 1. Flujo de Telemetría
```
Impresora Bambu Lab (MQTT)
    ↓
Electron main.js (MQTT client)
    ↓
Supabase Realtime Broadcast
    ↓
React (usePrinterRealtimeTelemetry hook)
    ↓
UI (Granja, estado real de impresoras)
```

### 2. Supabase Realtime - Sin tabla estática
**Propósito**: Transmisión continua de datos en tiempo real sin persistencia de historial.

#### Implementación en Electron:
```javascript
// Map para mantener canales por impresora
const telemetryChannels = new Map();

async function broadcastTelemetryToReact(printerId, nozzleTemp, bedTemp, progress, gcodeState) {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseRT = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Obtener o crear canal para esta impresora
  let channel = telemetryChannels.get(printerId);
  if (!channel) {
    channel = supabaseRT.channel(`printer:${printerId}:telemetry`);
    
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Canal preparado para ${printerId}`);
      }
    });
    
    telemetryChannels.set(printerId, { channel, client: supabaseRT });
  }

  // Enviar telemetría en tiempo real via broadcast
  channel.send({
    type: 'broadcast',
    event: 'telemetry',
    payload: {
      printer_id: printerId,
      nozzle_temp: nozzleTemp,
      bed_temp: bedTemp,
      progress: progress,
      gcode_state: gcodeState,
      timestamp: new Date().toISOString(),
    },
  });
}
```

**Ventajas**:
- ✅ Sin tabla BD estática (cero escrituras a BD)
- ✅ Latencia mínima (~100ms)
- ✅ Tráfico fluido y continuo
- ✅ No genera historial (datos efímeros)
- ✅ Escalable a N impresoras

#### Dónde se llama:
En el handler MQTT de `connectToPrinter()`:
```javascript
client.on('message', (topic, message) => {
  // Parsear datos MQTT
  const nozzleTemp = data.print.nozzle_temper ?? 0;
  const bedTemp = data.print.bed_temper ?? 0;
  const progress = data.print.mc_percent ?? 0;
  
  // Transmitir via Realtime (sin BD)
  broadcastTelemetryToReact(printerId, nozzleTemp, bedTemp, progress, gcodeState);
});
```

### 3. React Hook - Escuchador Realtime

#### `usePrinterRealtimeTelemetry`
```javascript
import { usePrinterRealtimeTelemetry } from '../hooks/usePrinterRealtimeTelemetry.js';

function Granja() {
  const { printers } = usePrinters();
  
  // Escuchar broadcast Realtime de todas las impresoras
  const telemetry = usePrinterRealtimeTelemetry(printers.map(p => p.id));
  
  // Resultado:
  // {
  //   "printer-id-1": {
  //     nozzle_temp: 230,
  //     bed_temp: 60,
  //     progress: 45,
  //     gcode_state: "RUNNING",
  //     updated_at: Date
  //   },
  //   "printer-id-2": { ... }
  // }
}
```

**Implementación**:
```javascript
export function usePrinterRealtimeTelemetry(printerIds) {
  const [telemetry, setTelemetry] = useState({});

  useEffect(() => {
    if (!printerIds || printerIds.length === 0) return;

    const unsubscribes = [];

    // Suscribirse a cada impresora
    printerIds.forEach((printerId) => {
      const channel = supabase.channel(`printer:${printerId}:telemetry`);

      // Escuchar broadcast
      channel.on('broadcast', { event: 'telemetry' }, (payload) => {
        setTelemetry((prev) => ({
          ...prev,
          [printerId]: {
            nozzle_temp: payload.payload.nozzle_temp,
            bed_temp: payload.payload.bed_temp,
            progress: payload.payload.progress,
            gcode_state: payload.payload.gcode_state,
            updated_at: new Date(),
          },
        }));
      });

      channel.subscribe();
      unsubscribes.push(() => channel.unsubscribe());
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [printerIds?.join(',')]);

  return telemetry;
}
```

## Estado de Impresoras - Tabla Estática

**Solo** la tabla `printers` se actualiza en BD (menos frecuente):

```sql
ALTER TABLE printers ADD COLUMN IF NOT EXISTS is_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE printers ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;
```

### Lógica de actualización:
1. **MQTT conecta** → `PATCH printers`: `status='idle'`, `is_connected=true`
2. **Sin telemetría 5+ seg** → React hook marca offline
3. **MQTT desconecta** → `PATCH printers`: `status='offline'`, `is_connected=false`

## Flujo de Datos - Comparación

### Antes (Tabla estática):
```
MQTT → Electron → BD (INSERT) → BD (INSERT) → DB (INSERT)
Resultado: 1000s de rows/min por impresora ❌
```

### Ahora (Realtime broadcast):
```
MQTT → Electron → Supabase Realtime → React (en vivo)
Resultado: flujo continuo, sin persistencia, latencia mínima ✅
```

## Performance

| Métrica | Valor |
|---------|-------|
| Latencia | ~100ms |
| Escrituras BD/min | 0 (solo estado ocasional) |
| Conexiones Realtime | 1 por impresora |
| Payload/msg | ~200 bytes |
| Tráfico estimado | ~12KB/min por impresora |

## Configuración Supabase

**Realtime está habilitado por defecto** en todos los proyectos. No requiere configuración adicional.

### Canales utilizados:
- `printer:${printerId}:telemetry` — broadcast de telemetría en vivo

## Datos Transmitidos

```json
{
  "printer_id": "uuid",
  "nozzle_temp": 230,
  "bed_temp": 60,
  "progress": 45,
  "gcode_state": "RUNNING",
  "timestamp": "2026-11-16T14:00:00.000Z"
}
```

## Ventajas vs Tabla Estática

| Aspecto | Realtime | Tabla BD |
|---------|----------|----------|
| Historial | ❌ (efímero) | ✅ |
| Latencia | 100ms | 500ms+ |
| Escrituras BD | 0 | 1000s/min |
| Escalabilidad | Excelente | Pobre |
| Almacenamiento | Ninguno | Crece infinitamente |
| Costo | Mínimo | Alto |

## Notas Importantes

1. **Sin historial**: Los datos de telemetría se pierden al desconectar. Es intencional.
2. **Estado sí persiste**: La tabla `printers` guarda estado (`status`, `is_connected`).
3. **Realtime nativo**: Usa protocolo WebSocket de Supabase, nativo en JavaScript.
4. **Canal por impresora**: Permite suscribirse solo a las que necesita.
5. **Sin polling**: Basado en eventos, no consume CPU.
