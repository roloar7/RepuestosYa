import { useEffect, useState } from "react"
import { supabase } from "@repuestos-ya/supabase"

/**
 * Hook para obtener la versión más reciente de la app
 * Solo disponible para usuarios autenticados
 * Desde Supabase Storage en lugar de GitHub
 */
export function useAppRelease() {
  const [release, setRelease] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    async function fetchLatestRelease() {
      try {
        setLoading(true)
        setError(null)

        // Verificar si está autenticado
        const { data: sessionData } = await supabase.auth.getSession()
        const authenticated = !!sessionData?.session

        setIsAuthenticated(authenticated)

        if (!authenticated) {
          // No es error, simplemente no está autenticado
          setLoading(false)
          return
        }

        // Detectar plataforma
        const platform = getPlatform()
        if (!platform) {
          setError("Plataforma no soportada")
          setLoading(false)
          return
        }

        // Obtener la versión más reciente para esta plataforma
        const { data, error: err } = await supabase
          .from("app_releases")
          .select("*")
          .eq("platform", platform)
          .eq("is_latest", true)
          .single()

        if (err) {
          if (err.code === "PGRST116") {
            // No rows found: normal, solo no hay release para esta plataforma
            console.warn("[useAppRelease] No release found for platform:", platform)
            setRelease(null)
            setError("No hay versión disponible aún")
          } else {
            console.error("[useAppRelease] DB Error:", err)
            setError(err.message || "Error al obtener release")
          }
        } else if (data) {
          console.log("[useAppRelease] Release found:", data.version)
          setRelease(data)
        } else {
          console.warn("[useAppRelease] No data returned")
          setRelease(null)
        }
      } catch (err) {
        console.error("[useAppRelease] Unexpected error:", err)
        setError(err.message || "Error inesperado")
      } finally {
        setLoading(false)
      }
    }

    fetchLatestRelease()
  }, [])

  return {
    release,
    loading,
    error,
    downloadUrl: release?.download_url,
    version: release?.version,
    isAuthenticated,
  }
}

/**
 * Detectar plataforma actual
 */
function getPlatform() {
  if (typeof navigator === "undefined") return null

  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("win")) return "windows"
  if (ua.includes("mac")) return "macos"
  if (ua.includes("linux")) return "linux"

  return null
}

/**
 * Obtener todas las versiones (para histórico/changelog)
 */
export function useAppReleaseHistory() {
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    async function fetchReleases() {
      try {
        setLoading(true)
        setError(null)

        // Verificar si está autenticado
        const { data: sessionData } = await supabase.auth.getSession()
        const authenticated = !!sessionData?.session

        setIsAuthenticated(authenticated)

        if (!authenticated) {
          setLoading(false)
          return
        }

        const platform = getPlatform()
        if (!platform) {
          setError("Plataforma no soportada")
          setLoading(false)
          return
        }

        const { data, error: err } = await supabase
          .from("app_releases")
          .select("*")
          .eq("platform", platform)
          .order("created_at", { ascending: false })

        if (err) {
          console.error("[useAppReleaseHistory] DB Error:", err)
          setError(err.message || "Error al obtener historial")
        } else {
          setReleases(data || [])
        }
      } catch (err) {
        console.error("[useAppReleaseHistory] Unexpected error:", err)
        setError(err.message || "Error inesperado")
      } finally {
        setLoading(false)
      }
    }

    fetchReleases()
  }, [])

  return { releases, loading, error, isAuthenticated }
}
