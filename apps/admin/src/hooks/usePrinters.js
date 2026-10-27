import { useEffect, useState } from "react"
import { supabase } from "@repuestos-ya/supabase"

/**
 * Hook para gestionar impresoras
 * Solo disponible en Electron (requiere window.electron.bridge)
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
        const { data, error: err } = await supabase
          .from("printers")
          .select("*")
          .eq("user_id", userId)
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
      .channel(`printers-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "printers",
          filter: `user_id=eq.${userId}`,
        },
        (_payload) => {
          console.log("[Realtime] Printer update")
          if (!cancelled) {
            // Refetch printers cuando hay cambios
            fetchPrinters()
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      channel.unsubscribe()
    }
  }, [userId])

  /**
   * Validar impresora y agregarla a la BD
   * Solo disponible en Electron (requiere IPC con bridge embebido)
   */
  const addPrinter = async (name, ip, accessCode = "unknown") => {
    if (!userId || !name?.trim() || !ip?.trim()) {
      return { success: false, error: "Nombre e IP son requeridos" }
    }

    try {
      setLoading(true)

      // Validar que Electron está disponible
      if (!window.electron?.bridge?.validatePrinter) {
        return {
          success: false,
          error: "Esta función solo está disponible en la aplicación",
        }
      }

      console.log("[usePrinters] Validando impresora via Electron IPC")
      const result = await window.electron.bridge.validatePrinter(
        name,
        ip,
        accessCode
      )
      if (!result.success) {
        return { success: false, error: result.error }
      }

      const validationData = result

      // Guardar en Supabase
      const { data, error: err } = await supabase
        .from("printers")
        .insert([
          {
            name: name.trim(),
            ip: ip.trim(),
            access_code: accessCode || null, // Guardar access code (cifrar en prod)
            serial: validationData.serial || null,
            status: "idle",
            user_id: userId,
          },
        ])
        .select()
        .single()

      if (err) throw err

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
