import { useState, useEffect } from 'react'
import { supabase } from '@repuestos-ya/supabase'

/**
 * Hook para escuchar telemetría en tiempo real via Supabase Realtime
 * Flujo continuo sin tabla estática
 */
export function usePrinterRealtimeTelemetry(printerIds) {
  const [telemetry, setTelemetry] = useState({})

  useEffect(() => {
    if (!printerIds || printerIds.length === 0) return

    let cancelled = false
    const unsubscribes = []

    // Suscribirse a cada impresora
    printerIds.forEach((printerId) => {
      const channel = supabase.channel(`printer:${printerId}:telemetry`)

      channel.on('broadcast', { event: 'telemetry' }, (payload) => {
        if (!cancelled) {
          setTelemetry((prev) => ({
            ...prev,
            [printerId]: {
              nozzle_temp: payload.payload.nozzle_temp,
              bed_temp: payload.payload.bed_temp,
              progress: payload.payload.progress,
              gcode_state: payload.payload.gcode_state,
              updated_at: new Date(),
            },
          }))
        }
      })

      channel.subscribe()
      unsubscribes.push(() => channel.unsubscribe())
    })

    return () => {
      cancelled = true
      unsubscribes.forEach((unsub) => unsub())
    }
  }, [printerIds?.join(',')])

  return telemetry
}
