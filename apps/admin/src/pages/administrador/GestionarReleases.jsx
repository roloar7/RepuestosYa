import { useState } from "react"
import { supabase } from "@repuestos-ya/supabase"
import { useAppReleaseHistory } from "../../hooks/useAppRelease"
import styles from "./GestionarReleases.module.css"

/**
 * Componente admin para gestionar releases de la app desde Supabase Storage
 */
export default function GestionarReleases() {
  const { releases, loading, error } = useAppReleaseHistory()
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    version: "",
    platform: "windows",
    releaseNotes: "",
    isLatest: false,
  })
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState(null)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setUploadStatus(null)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedFile) {
      setUploadStatus({ error: "Selecciona un archivo" })
      return
    }

    if (!formData.version) {
      setUploadStatus({ error: "Ingresa la versión" })
      return
    }

    try {
      setUploading(true)
      setUploadStatus({ message: "Subiendo archivo..." })

      // Subir archivo a Supabase Storage
      const fileName = `releases/${formData.platform}/RepuestosYa-Admin-${formData.version}.exe`
      const { data: _uploadData, error: uploadError } = await supabase.storage
        .from("app-releases")
        .upload(fileName, selectedFile, {
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data: publicUrl } = supabase.storage
        .from("app-releases")
        .getPublicUrl(fileName)

      // Calcular SHA256 (nota: esto sería ideal hacerlo en el servidor)
      const sha256 = await calculateSHA256(selectedFile)

      setUploadStatus({ message: "Guardando en BD..." })

      // Si es la versión más reciente, actualizar otros releases
      if (formData.isLatest) {
        await supabase
          .from("app_releases")
          .update({ is_latest: false })
          .eq("platform", formData.platform)
      }

      // Insertar o actualizar release en BD
      const { data: _releaseData, error: dbError } = await supabase
        .from("app_releases")
        .upsert({
          version: formData.version,
          platform: formData.platform,
          download_url: publicUrl.publicUrl,
          file_size_bytes: selectedFile.size,
          sha256_checksum: sha256,
          release_notes: formData.releaseNotes,
          is_latest: formData.isLatest,
        })
        .select()
        .single()

      if (dbError) throw dbError

      setUploadStatus({
        success: true,
        message: `✅ Release v${formData.version} publicada exitosamente`,
      })

      // Limpiar formulario
      setFormData({
        version: "",
        platform: "windows",
        releaseNotes: "",
        isLatest: false,
      })
      setSelectedFile(null)

      // Refetch releases
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      console.error("Error:", err)
      setUploadStatus({ error: err.message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Gestionar Releases</h2>

      <div className={styles.content}>
        {/* Formulario de subida */}
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
                disabled={uploading}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="platform">Plataforma</label>
              <select
                id="platform"
                name="platform"
                value={formData.platform}
                onChange={handleInputChange}
                disabled={uploading}
              >
                <option value="windows">Windows (.exe)</option>
                <option value="macos">macOS (.dmg)</option>
                <option value="linux">Linux (.AppImage)</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="file">Archivo (.exe, .dmg, .AppImage)</label>
              <input
                id="file"
                type="file"
                onChange={handleFileSelect}
                accept=".exe,.dmg,.AppImage"
                disabled={uploading}
              />
              {selectedFile && (
                <p className={styles.hint}>
                  📦 {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
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
                disabled={uploading}
              />
            </div>

            <div className={styles.checkbox}>
              <input
                id="isLatest"
                type="checkbox"
                name="isLatest"
                checked={formData.isLatest}
                onChange={handleInputChange}
                disabled={uploading}
              />
              <label htmlFor="isLatest">Marcar como versión más reciente</label>
            </div>

            {uploadStatus && (
              <div
                className={`${styles.status} ${
                  uploadStatus.error
                    ? styles.error
                    : uploadStatus.success
                      ? styles.success
                      : styles.info
                }`}
              >
                {uploadStatus.message || uploadStatus.error}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={uploading || !selectedFile}
            >
              {uploading ? "Subiendo..." : "Publicar Release"}
            </button>
          </form>
        </div>

        {/* Historial de releases */}
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

                  <div className={styles.meta}>
                    <span>📦 {(release.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                    {release.sha256_checksum && (
                      <code className={styles.sha256}>
                        SHA256: {release.sha256_checksum.substring(0, 16)}...
                      </code>
                    )}
                  </div>

                  <a
                    href={release.download_url}
                    className={styles.downloadLink}
                    download
                  >
                    Descargar
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Calcular SHA256 de un archivo (en el navegador)
 * Nota: para producción, mejor calcular en el servidor
 */
async function calculateSHA256(file) {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  return hashHex
}
