import { useState, useEffect } from 'react'

/**
 * Hook para escuchar telemetría de impresoras en tiempo real
 * Retorna un map de printer_id -> telemetry
 */
export function usePrinterTelemetry() {
  const [telemetry, setTelemetry] = useState({})

  useEffect(() => {
    if (!window.electron?.onPrinterStatus) {
      return
    }

    // Escuchar actualizaciones de telemetría
    const unsubscribe = window.electron.onPrinterStatus((data) => {
      console.log('[usePrinterTelemetry] Telemetría recibida:', data)
      
      setTelemetry((prev) => ({
        ...prev,
        [data.printer_id]: {
          nozzle_temp: data.nozzle_temp ?? 0,
          bed_temp: data.bed_temp ?? 0,
          progress: data.progress ?? 0,
          gcode_state: data.gcode_state ?? 'IDLE',
          updated_at: new Date(),
        },
      }))
    })

    return () => unsubscribe?.()
  }, [])

  return telemetry
}
