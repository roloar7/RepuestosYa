import { useState, useEffect } from "react"
import { supabase } from "@repuestos-ya/supabase"
import { useAppReleaseHistory } from "../../hooks/useAppRelease"
import {
  compressToZip,
  formatBytes,
  getCompressionRatio,
  detectArchiveType,
} from "../../utils/archiveUtils"
import styles from "./GestionarReleases.module.css"

/**
 * Componente admin para gestionar releases de la app desde Supabase Storage
 * Solo accesible a usuarios autenticados (RLS lo protege en BD)
 */
export default function GestionarReleases() {
  // Todos los hooks antes de cualquier return/condicional
  const { releases, loading: historyLoading, error: historyError, isAuthenticated } = useAppReleaseHistory()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    version: "",
    platform: "windows",
    releaseNotes: "",
    isLatest: false,
  })
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadStatus, setUploadStatus] = useState(null)

  // Verificar que el usuario está autenticado
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

  // Handlers
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      // Ordenar por nombre (para que .001, .002, etc estén en orden)
      files.sort((a, b) => a.name.localeCompare(b.name))
      setSelectedFiles(files)
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

    if (selectedFiles.length === 0) {
      setUploadStatus({ error: "Selecciona uno o más archivos (.zip o .zip.001, .zip.002, etc)" })
      return
    }

    if (!formData.version) {
      setUploadStatus({ error: "Ingresa la versión" })
      return
    }

    try {
      setUploading(true)

      // Detectar si es monolítico (.zip) o multipart (.zip.001, .zip.002, etc)
      const isMultipart = selectedFiles[0].name.match(/\.zip\.\d{3}$/)
      const totalParts = selectedFiles.length

      if (isMultipart) {
        setUploadStatus({
          message: `Subiendo ${totalParts} partes (${selectedFiles
            .reduce((sum, f) => sum + f.size, 0) / 1024 / 1024
            .toFixed(2)} MB total)...`,
        })
      } else {
        setUploadStatus({ message: "Comprimiendo/subiendo archivo..." })
      }

      let uploadedUrls = []
      let totalSize = 0

      if (isMultipart) {
        // Subir múltiples partes
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i]
          const partNumber = String(i + 1).padStart(3, '0')
          const fileName = `releases/${formData.platform}/RepuestosYa-Admin-${formData.version}.zip.${partNumber}`

          setUploadStatus({
            message: `Subiendo parte ${i + 1}/${selectedFiles.length}...`,
          })

          const { error: uploadError } = await supabase.storage
            .from("app-releases")
            .upload(fileName, file, {
              upsert: true,
              contentType: 'application/octet-stream',
            })

          if (uploadError) throw uploadError

          const { data: publicUrl } = supabase.storage
            .from("app-releases")
            .getPublicUrl(fileName)

          uploadedUrls.push(publicUrl.publicUrl)
          totalSize += file.size

          console.log(`[Upload] Parte ${i + 1} subida: ${formatBytes(file.size)}`)
        }

        // URL base (sin la extensión .001)
        const baseUrl = uploadedUrls[0].replace(/\.001$/, '')
        const sha256 = 'multipart-' + selectedFiles.length // Placeholder

        setUploadStatus({ message: "Guardando en BD..." })

        // Guardar en BD
        const { data: _releaseData, error: dbError } = await supabase
          .from("app_releases")
          .upsert({
            version: formData.version,
            platform: formData.platform,
            download_url: baseUrl,
            file_size_bytes: totalSize,
            original_size_bytes: totalSize, // No sabemos el original, es ZIP parcial
            total_parts: totalParts,
            sha256_checksum: sha256,
            release_notes: formData.releaseNotes,
            is_latest: formData.isLatest,
          })
          .select()
          .single()

        if (dbError) throw dbError

        setUploadStatus({
          success: true,
          message: `✅ Release v${formData.version} publicada (${totalParts} partes, ${formatBytes(totalSize)} total)`,
        })
      } else {
        // Subir archivo único
        const selectedFile = selectedFiles[0]

        const exeFileName = `RepuestosYa-Admin-${formData.version}.exe`
        const zipBlob = await compressToZip(selectedFile, exeFileName)

        const originalSize = selectedFile.size
        const compressedSize = zipBlob.size
        const ratio = getCompressionRatio(originalSize, compressedSize)

        console.log(
          `[Upload] Original: ${formatBytes(originalSize)}, Compressed: ${formatBytes(compressedSize)}, Ratio: ${ratio}%`
        )

        setUploadStatus({
          message: `Archivo comprimido: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${ratio}% reducción)`,
        })

        // Subir archivo ZIP a Supabase Storage
        const fileName = `releases/${formData.platform}/RepuestosYa-Admin-${formData.version}.zip`
        const { data: _uploadData, error: uploadError } = await supabase.storage
          .from("app-releases")
          .upload(fileName, zipBlob, {
            upsert: true,
            contentType: 'application/zip',
          })

        if (uploadError) throw uploadError

        setUploadStatus({ message: "Guardando en BD..." })

        // Obtener URL pública
        const { data: publicUrl } = supabase.storage
          .from("app-releases")
          .getPublicUrl(fileName)

        // Calcular SHA256 del ZIP
        const sha256 = await calculateSHA256(zipBlob)

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
            file_size_bytes: compressedSize,
            original_size_bytes: originalSize,
            total_parts: 1,
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
      }

      // Limpiar formulario
      setFormData({
        version: "",
        platform: "windows",
        releaseNotes: "",
        isLatest: false,
      })
      setSelectedFiles([])

      // Refetch releases
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      console.error("Error:", err)
      setUploadStatus({ error: err.message })
    } finally {
      setUploading(false)
    }
  }

  // Mostrar error si no está autenticado
  if (checkingAuth || !isAuthenticated) {
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

  // Mostrar error si no es admin
  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>
            🔒 Solo administradores pueden gestionar releases
          </p>
        </div>
      </div>
    )
  }

  // Render del componente (solo si está autenticado y es admin)
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
              <label htmlFor="file">Archivo(s) (.zip, .rar, .7z o partes .001, .002, etc)</label>
              <input
                id="file"
                type="file"
                onChange={handleFileSelect}
                accept=".zip,.rar,.7z,.exe,.dmg,.AppImage"
                multiple
                disabled={uploading}
              />
              {selectedFiles.length > 0 && (
                <div className={styles.fileList}>
                  <p className={styles.hint}>
                    📦 {selectedFiles.length} archivo(s) seleccionado(s):{' '}
                    {(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <ul className={styles.fileItems}>
                    {selectedFiles.map((f, idx) => (
                      <li key={idx}>
                        {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                      </li>
                    ))}
                  </ul>
                </div>
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
              disabled={uploading || selectedFiles.length === 0}
            >
              {uploading ? "Subiendo..." : "Publicar Release"}
            </button>
          </form>
        </div>

        {/* Historial de releases */}
        <div className={styles.historySection}>
          <h3>Historial de versiones</h3>

          {historyLoading ? (
            <p>Cargando...</p>
          ) : historyError ? (
            <p className={styles.error}>{historyError}</p>
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
                    <span>📦 ZIP: {(release.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                    {release.original_size_bytes && (
                      <span>
                        💾 Original: {(release.original_size_bytes / 1024 / 1024).toFixed(2)} MB
                        <br />
                        📉 Reducción:{' '}
                        {(
                          ((1 - release.file_size_bytes / release.original_size_bytes) * 100).toFixed(1)
                        )}
                        %
                      </span>
                    )}
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
