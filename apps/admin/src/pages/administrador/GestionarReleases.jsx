import { useState, useEffect } from "react"
import { supabase } from "@repuestos-ya/supabase"
import styles from "./GestionarReleases.module.css"

/**
 * Componente admin para gestionar releases
 * Formulario simple: versión, plataforma, URL de descarga, notas
 * Almacena en tabla app_releases de Supabase
 */
export default function GestionarReleases() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitStatus, setSubmitStatus] = useState(null)

  const [formData, setFormData] = useState({
    version: "",
    platform: "windows",
    downloadUrl: "",
    releaseNotes: "",
    isLatest: false,
  })

  // Verificar autenticación al cargar
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        setIsAdmin(!!sessionData?.session)
      } catch (err) {
        console.error("Auth check error:", err)
        setIsAdmin(false)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuth()
  }, [])

  // Cargar releases desde BD
  useEffect(() => {
    if (!isAdmin) return

    async function fetchReleases() {
      try {
        setLoading(true)
        const { data, error: err } = await supabase
          .from("app_releases")
          .select("*")
          .order("created_at", { ascending: false })

        if (err) throw err
        setReleases(data || [])
      } catch (err) {
        console.error("Error fetching releases:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchReleases()
  }, [isAdmin])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitStatus(null)

    if (!formData.version.trim()) {
      setSubmitStatus({ error: "Ingresa la versión" })
      return
    }

    if (!formData.downloadUrl.trim()) {
      setSubmitStatus({ error: "Ingresa la URL de descarga" })
      return
    }

    try {
      setSubmitting(true)

      // Si marca como latest, desmarcar otros
      if (formData.isLatest) {
        await supabase
          .from("app_releases")
          .update({ is_latest: false })
          .eq("platform", formData.platform)
      }

      // Insertar o actualizar release
      const { error: err } = await supabase
        .from("app_releases")
        .upsert({
          version: formData.version.trim(),
          platform: formData.platform,
          download_url: formData.downloadUrl.trim(),
          release_notes: formData.releaseNotes.trim() || null,
          is_latest: formData.isLatest,
        })
        .select()

      if (err) throw err

      setSubmitStatus({
        success: true,
        message: `✅ Release v${formData.version} publicada exitosamente`,
      })

      // Limpiar formulario
      setFormData({
        version: "",
        platform: "windows",
        downloadUrl: "",
        releaseNotes: "",
        isLatest: false,
      })

      // Refetch releases
      const { data } = await supabase
        .from("app_releases")
        .select("*")
        .order("created_at", { ascending: false })
      setReleases(data || [])
    } catch (err) {
      console.error("Error:", err)
      setSubmitStatus({ error: err.message || "Error al publicar" })
    } finally {
      setSubmitting(false)
    }
  }

  // Mostrar error si no está autenticado
  if (checkingAuth || !isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>
            ⚠️ Debes estar autenticado para acceder a esta página
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Gestionar Releases</h2>

      <div className={styles.content}>
        {/* Formulario */}
        <div className={styles.uploadSection}>
          <h3>Publicar nueva versión</h3>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="version">Versión (ej: 1.0.0)</label>
              <input
                id="version"
                type="text"
                name="version"
                value={formData.version}
                onChange={handleInputChange}
                placeholder="1.0.0"
                disabled={submitting}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="platform">Plataforma</label>
              <select
                id="platform"
                name="platform"
                value={formData.platform}
                onChange={handleInputChange}
                disabled={submitting}
              >
                <option value="windows">Windows (.exe)</option>
                <option value="macos">macOS (.dmg)</option>
                <option value="linux">Linux (.AppImage)</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="downloadUrl">URL de descarga</label>
              <input
                id="downloadUrl"
                type="url"
                name="downloadUrl"
                value={formData.downloadUrl}
                onChange={handleInputChange}
                placeholder="https://..."
                disabled={submitting}
              />
              <p className={styles.hint}>
                Ej: enlace directo al .exe, .zip, o .dmg
              </p>
            </div>

            <div className={styles.field}>
              <label htmlFor="releaseNotes">Notas de la versión</label>
              <textarea
                id="releaseNotes"
                name="releaseNotes"
                value={formData.releaseNotes}
                onChange={handleInputChange}
                placeholder="Cambios, mejoras, fixes..."
                rows="4"
                disabled={submitting}
              />
            </div>

            <div className={styles.checkbox}>
              <input
                id="isLatest"
                type="checkbox"
                name="isLatest"
                checked={formData.isLatest}
                onChange={handleInputChange}
                disabled={submitting}
              />
              <label htmlFor="isLatest">Marcar como versión más reciente</label>
            </div>

            {submitStatus && (
              <div
                className={`${styles.status} ${
                  submitStatus.error
                    ? styles.error
                    : submitStatus.success
                      ? styles.success
                      : styles.info
                }`}
              >
                {submitStatus.message || submitStatus.error}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? "Publicando..." : "Publicar Release"}
            </button>
          </form>
        </div>

        {/* Historial */}
        <div className={styles.historySection}>
          <h3>Historial de versiones</h3>

          {loading ? (
            <p>Cargando...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : releases.length === 0 ? (
            <p>Sin releases publicadas</p>
          ) : (
            <div className={styles.releasesList}>
              {releases.map((release) => (
                <div key={release.id} className={styles.releaseCard}>
                  <div className={styles.releaseHeader}>
                    <h4>v{release.version}</h4>
                    <span className={styles.platform}>{release.platform}</span>
                    {release.is_latest && (
                      <span className={styles.latest}>Latest</span>
                    )}
                  </div>

                  <p className={styles.date}>
                    {new Date(release.created_at).toLocaleDateString()}
                  </p>

                  {release.release_notes && (
                    <p className={styles.notes}>{release.release_notes}</p>
                  )}

                  <div className={styles.urlContainer}>
                    <a
                      href={release.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.downloadLink}
                    >
                      {release.download_url}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
