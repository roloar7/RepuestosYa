import { useEffect, useState, useCallback } from "react"
import { supabase } from "@repuestos-ya/supabase"

/**
 * Hook para gestionar impresoras
 * Solo disponible en Electron (requiere window.electron.printer)
 */
export function usePrinters(userId) {
  const [printers, setPrinters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchPrinters() {
      try {
        setLoading(true)
        // Ver TODAS las impresoras, no solo las del usuario
        const { data, error: err } = await supabase
          .from("printers")
          .select("*")
          .order("created_at", { ascending: false })

        if (err) throw err
        if (!cancelled) setPrinters(data || [])
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          console.error("Error fetching printers:", err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPrinters()

    // Suscribirse a cambios en tiempo real (Supabase Realtime v2)
    const channel = supabase
      .channel(`printers-all`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "printers",
        },
        (payload) => {
          console.log("[Realtime] Printer UPDATE:", payload.new)
          if (!cancelled) {
            // Actualizar directamente en lugar de refetch
            setPrinters((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            )
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "printers",
        },
        (payload) => {
          console.log("[Realtime] Printer INSERT:", payload.new)
          if (!cancelled) {
            fetchPrinters()
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "printers",
        },
        (payload) => {
          console.log("[Realtime] Printer DELETE:", payload.old.id)
          if (!cancelled) {
            setPrinters((prev) => prev.filter((p) => p.id !== payload.old.id))
          }
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] Channel status:", status)
      })

    return () => {
      cancelled = true
      channel.unsubscribe()
    }
  }, [userId])

  // Escuchar cambios de conexión desde Electron (IPC)
  useEffect(() => {
    if (!window.electron?.onPrinterConnectionStatus) return

    const unsubscribe = window.electron.onPrinterConnectionStatus((data) => {
      console.log('[usePrinters] Cambio de estado IPC:', data)
      if (!window.__cancelledPrinters) {
        setPrinters((prev) =>
          prev.map((p) => 
            p.id === data.printer_id 
              ? { ...p, status: data.status }
              : p
          )
        )
      }
    })

    return () => unsubscribe?.()
  }, [])

  // Escuchar telemetría en tiempo real desde Electron (IPC)
  useEffect(() => {
    if (!window.electron?.onFarmTelemetry) return

    const unsubscribe = window.electron.onFarmTelemetry((telemetry) => {
      if (!window.__cancelledPrinters) {
        setPrinters((prev) =>
          prev.map((p) => 
            p.id === telemetry.printer_id 
              ? { ...p, status: telemetry.status }
              : p
          )
        )
      }
    })

    return () => unsubscribe?.()
  }, [])

  /**
   * Agregar impresora a la BD y conectar MQTT en Electron
   */
  const addPrinter = async (name, ip, accessCode = "00000000", serialNumber = "") => {
    if (!userId || !name?.trim() || !ip?.trim()) {
      return { success: false, error: "Nombre e IP son requeridos" }
    }

    try {
      setLoading(true)

      console.log("[usePrinters] Agregando impresora:", name)

      // Guardar en Supabase
      const { data, error: err } = await supabase
        .from("printers")
        .insert([
          {
            name: name.trim(),
            ip: ip.trim(),
            access_code: accessCode || null,
            serial_number: serialNumber || null,
            status: "idle",
            user_id: userId,
          },
        ])
        .select()
        .single()

      if (err) throw err

      // Conectar a MQTT en Electron si está disponible
      if (window.electron?.printer?.connect && serialNumber?.trim()) {
        try {
          await window.electron.printer.connect({
            id: data.id,
            name: data.name,
            ip: ip.trim(),
            protocol: data.protocol || 'bambu_lan',
            credentials: {
              access_code: accessCode || "00000000",
              serial_number: serialNumber.trim(),
            },
          })
        } catch (mqttErr) {
          console.error("[usePrinters] Error conectando MQTT:", mqttErr.message)
          // No fallar aunque falle MQTT, la impresora está en BD
        }
      }

      setPrinters((prev) => [data, ...prev])
      return { success: true, printer: data }
    } catch (err) {
      const errorMsg = err.message || "Error al agregar la impresora"
      setError(errorMsg)
      console.error("[usePrinters] Error:", errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Eliminar impresora
   */
  const deletePrinter = async (printerId) => {
    try {
      // Desconectar MQTT en Electron si está disponible
      if (window.electron?.printer?.disconnect) {
        try {
          await window.electron.printer.disconnect(printerId)
        } catch (mqttErr) {
          console.error("[usePrinters] Error desconectando MQTT:", mqttErr.message)
        }
      }

      const { error: err } = await supabase
        .from("printers")
        .delete()
        .eq("id", printerId)

      if (err) throw err

      setPrinters((prev) => prev.filter((p) => p.id !== printerId))
      return { success: true }
    } catch (err) {
      const errorMsg = err.message || "Error al eliminar la impresora"
      setError(errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Actualizar estado de impresora
   */
  const updatePrinterStatus = async (printerId, status) => {
    try {
      const { data, error: err } = await supabase
        .from("printers")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", printerId)
        .select()
        .single()

      if (err) throw err

      setPrinters((prev) =>
        prev.map((p) => (p.id === printerId ? data : p))
      )
      return { success: true, printer: data }
    } catch (err) {
      const errorMsg = err.message || "Error al actualizar el estado"
      setError(errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  return {
    printers,
    loading,
    error,
    addPrinter,
    deletePrinter,
    updatePrinterStatus,
  }
}
