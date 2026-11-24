import { useState, useEffect } from 'react'
import { supabase } from '@repuestos-ya/supabase'

/**
 * Hook unificado para recibir telemetría en tiempo real:
 * 1. Vía Electron IPC ('farm:telemetry') para respuesta instantánea en local
 * 2. Vía Supabase Realtime Broadcast ('farm-telemetry') para monitoreo remoto
 */
export function usePrinterRealtimeTelemetry(printerIds) {
  const [telemetry, setTelemetry] = useState({})
  const idsKey = printerIds?.join(',') || ''

  useEffect(() => {
    if (!printerIds || printerIds.length === 0) return

    let cancelled = false
    const allowedIds = new Set(printerIds)

    // Función centralizada para actualizar el estado de una impresora
    const handleIncomingTelemetry = (data) => {
      if (cancelled || !data?.printer_id || !allowedIds.has(data.printer_id)) return

      setTelemetry((prev) => ({
        ...prev,
        [data.printer_id]: {
          ...prev[data.printer_id],
          printer_id: data.printer_id,
          is_connected: data.is_connected ?? true,
          status: data.status,
          nozzle_temp: data.nozzle_temp ?? prev[data.printer_id]?.nozzle_temp ?? 0,
          bed_temp: data.bed_temp ?? prev[data.printer_id]?.bed_temp ?? 0,
          progress: data.progress ?? prev[data.printer_id]?.progress ?? 0,
          gcode_state: data.gcode_state ?? prev[data.printer_id]?.gcode_state ?? 'IDLE',
          updated_at: new Date(),
        },
      }))
    }

    const handleDisconnect = (data) => {
      if (cancelled || !data?.printer_id || !allowedIds.has(data.printer_id)) return

      setTelemetry((prev) => ({
        ...prev,
        [data.printer_id]: {
          ...prev[data.printer_id],
          printer_id: data.printer_id,
          is_connected: false,
          status: 'offline',
          updated_at: new Date(),
        },
      }))
    }

    // 1. Suscripción a Supabase Realtime Broadcast (canal global 'farm-telemetry')
    const channel = supabase.channel('farm-telemetry')
    channel
      .on('broadcast', { event: 'telemetry' }, ({ payload }) => {
        handleIncomingTelemetry(payload)
      })
      .subscribe()

    // 2. Suscripción a Electron IPC local (si corre dentro de Electron)
    const ipc = window.electron?.ipcRenderer
    const onIpcTelemetry = (_event, data) => handleIncomingTelemetry(data)
    const onIpcDisconnected = (_event, data) => handleDisconnect(data)

    if (ipc?.on) {
      ipc.on('farm:telemetry', onIpcTelemetry)
      ipc.on('farm:printer-disconnected', onIpcDisconnected)
    }

    return () => {
      cancelled = true
      channel.unsubscribe()
      if (ipc?.removeListener) {
        ipc.removeListener('farm:telemetry', onIpcTelemetry)
        ipc.removeListener('farm:printer-disconnected', onIpcDisconnected)
      }
    }
  }, [idsKey])

  return telemetry
}