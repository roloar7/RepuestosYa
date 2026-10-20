import { useEffect, useState } from "react"
import { supabase } from "@repuestos-ya/supabase"

/**
 * Hook para obtener la versión más reciente de la app
 * Desde Supabase Storage en lugar de GitHub
 */
export function useAppRelease() {
  const [release, setRelease] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchLatestRelease() {
      try {
        setLoading(true)

        // Detectar plataforma
        const platform = getPlatform()
        if (!platform) {
          setError("Plataforma no soportada")
          return
        }

        // Obtener la versión más reciente para esta plataforma
        const { data, error: err } = await supabase
          .from("app_releases")
          .select("*")
          .eq("platform", platform)
          .eq("is_latest", true)
          .single()

        if (err && err.code !== "PGRST116") {
          // PGRST116 = no rows found (normal si no hay release)
          throw err
        }

        if (data) {
          setRelease(data)
        } else {
          setError("No hay versión disponible para tu plataforma")
        }
      } catch (err) {
        console.error("[useAppRelease] Error:", err)
        setError(err.message)
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

  useEffect(() => {
    async function fetchReleases() {
      try {
        setLoading(true)

        const platform = getPlatform()
        if (!platform) {
          setError("Plataforma no soportada")
          return
        }

        const { data, error: err } = await supabase
          .from("app_releases")
          .select("*")
          .eq("platform", platform)
          .order("created_at", { ascending: false })

        if (err) throw err
        setReleases(data || [])
      } catch (err) {
        console.error("[useAppReleaseHistory] Error:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchReleases()
  }, [])

  return { releases, loading, error }
}
