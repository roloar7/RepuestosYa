import { useEffect, useState } from "react"
import { supabase } from "@repuestos-ya/supabase"

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

    return () => {
      cancelled = true
    }
  }, [userId])

  const addPrinter = async (name, ip) => {
    if (!userId || !name?.trim() || !ip?.trim()) {
      return { success: false, error: "Nombre e IP son requeridos" }
    }

    try {
      setLoading(true)

      // Intenta usar Electron IPC si está disponible, sino HTTP directo
      let validationData
      if (window.electron?.bridge?.validatePrinter) {
        // Dentro de Electron
        const result = await window.electron.bridge.validatePrinter(name, ip)
        if (!result.success) {
          return { success: false, error: result.error }
        }
        validationData = result
      } else {
        // Dev en navegador (localhost)
        const validateResponse = await fetch("http://localhost:8787/printers/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), ip: ip.trim() }),
        })

        if (!validateResponse.ok) {
          const errorData = await validateResponse.json()
          return {
            success: false,
            error: errorData.error || "No se pudo validar la conexión con la impresora",
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
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  return {
    printers,
    loading,
    error,
    addPrinter,
  }
}
