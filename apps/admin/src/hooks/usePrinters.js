import { useEffect, useState } from "react"
import { supabase } from "@repuestos-ya/supabase"

/**
 * Hook para gestionar impresoras
 * Soporta validación local (Electron) y remota (Bridge en servidor via Tailscale)
 */
export function usePrinters(userId) {
  const [printers, setPrinters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // URL del bridge remoto (configurable via env var para web/Netlify)
  // En Electron usa localhost:8787; en web usa VITE_BRIDGE_URL si está disponible
  const BRIDGE_URL =
    import.meta.env.VITE_BRIDGE_URL || "http://localhost:8787"

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
   * Detecta automáticamente si está en Electron (IPC) o web (HTTP remoto)
   */
  const addPrinter = async (name, ip, accessCode = "unknown") => {
    if (!userId || !name?.trim() || !ip?.trim()) {
      return { success: false, error: "Nombre e IP son requeridos" }
    }

    try {
      setLoading(true)
      let validationData

      // Opción 1: Electron (IPC con bridge local embebido)
      if (window.electron?.bridge?.validatePrinter) {
        console.log("[usePrinters] Usando Electron IPC")
        const result = await window.electron.bridge.validatePrinter(
          name,
          ip,
          accessCode
        )
        if (!result.success) {
          return { success: false, error: result.error }
        }
        validationData = result
      }
      // Opción 2: Web (HTTP con bridge remoto via Tailscale o localhost)
      else {
        console.log(`[usePrinters] Usando bridge remoto: ${BRIDGE_URL}`)
        const validateResponse = await fetch(
          `${BRIDGE_URL}/printers/validate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              ip: ip.trim(),
              accessCode: accessCode || "unknown",
            }),
          }
        )

        if (!validateResponse.ok) {
          const errorData = await validateResponse.json()
          return {
            success: false,
            error:
              errorData.error ||
              "No se pudo validar la conexión con la impresora",
          }
        }

        validationData = await validateResponse.json()
      }

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
    bridgeUrl: BRIDGE_URL,
  }
}
