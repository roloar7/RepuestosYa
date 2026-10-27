import { useState, useEffect } from "react"
import { BiEdit, BiTrash, BiX } from "react-icons/bi"
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

  // Edición / eliminación del historial
  const [editingRelease, setEditingRelease] = useState(null)
  const [editForm, setEditForm] = useState({
    version: "",
    platform: "windows",
    downloadUrl: "",
    releaseNotes: "",
    isLatest: false,
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState(null)
  const [deletingRelease, setDeletingRelease] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  // Refrescar lista desde BD
  const refreshReleases = async () => {
    const { data, error: err } = await supabase
      .from("app_releases")
      .select("*")
      .order("created_at", { ascending: false })

    if (err) {
      console.error("Error fetching releases:", err)
      setError(err.message)
      return
    }
    setReleases(data || [])
  }

  // Abrir modal de edición con los datos actuales
  const startEdit = (release) => {
    setEditError(null)
    setEditingRelease(release)
    setEditForm({
      version: release.version || "",
      platform: release.platform || "windows",
      downloadUrl: release.download_url || "",
      releaseNotes: release.release_notes || "",
      isLatest: !!release.is_latest,
    })
  }

  const closeEdit = () => {
    if (savingEdit) return
    setEditingRelease(null)
    setEditError(null)
  }

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target
    setEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingRelease) return

    if (!editForm.version.trim()) {
      setEditError("Ingresa la versión")
      return
    }
    if (!editForm.downloadUrl.trim()) {
      setEditError("Ingresa la URL de descarga")
      return
    }

    try {
      setSavingEdit(true)
      setEditError(null)

      // Si se marca como latest, desmarcar las demás de la misma plataforma
      if (editForm.isLatest) {
        const { error: clearErr } = await supabase
          .from("app_releases")
          .update({ is_latest: false })
          .eq("platform", editForm.platform)
          .neq("id", editingRelease.id)

        if (clearErr) throw clearErr
      }

      const { error: err } = await supabase
        .from("app_releases")
        .update({
          version: editForm.version.trim(),
          platform: editForm.platform,
          download_url: editForm.downloadUrl.trim(),
          release_notes: editForm.releaseNotes.trim() || null,
          is_latest: editForm.isLatest,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingRelease.id)

      if (err) throw err

      await refreshReleases()
      setEditingRelease(null)
      setSubmitStatus({
        success: true,
        message: `✅ Release v${editForm.version.trim()} actualizada`,
      })
    } catch (err) {
      console.error("Error updating release:", err)
      setEditError(err.message || "Error al actualizar la release")
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDelete = (release) => {
    setDeletingRelease(release)
  }

  const handleDelete = async () => {
    if (!deletingRelease) return

    try {
      setDeleting(true)

      const { error: err } = await supabase
        .from("app_releases")
        .delete()
        .eq("id", deletingRelease.id)

      if (err) throw err

      setReleases((prev) => prev.filter((r) => r.id !== deletingRelease.id))
      setSubmitStatus({
        success: true,
        message: `🗑️ Release v${deletingRelease.version} eliminada`,
      })
      setDeletingRelease(null)
    } catch (err) {
      console.error("Error deleting release:", err)
      setSubmitStatus({ error: err.message || "Error al eliminar la release" })
      setDeletingRelease(null)
    } finally {
      setDeleting(false)
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

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => startEdit(release)}
                        title={`Editar v${release.version}`}
                        aria-label={`Editar v${release.version}`}
                      >
                        <BiEdit />
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.danger}`}
                        onClick={() => confirmDelete(release)}
                        title={`Eliminar v${release.version}`}
                        aria-label={`Eliminar v${release.version}`}
                      >
                        <BiTrash />
                      </button>
                    </div>
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

      {/* Modal: editar release */}
      {editingRelease && (
        <div className={styles.modalBackdrop} onClick={closeEdit}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={`Editar release v${editingRelease.version}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>Editar v{editingRelease.version}</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeEdit}
                disabled={savingEdit}
                aria-label="Cerrar"
              >
                <BiX />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="edit-version">Versión</label>
                <input
                  id="edit-version"
                  type="text"
                  name="version"
                  value={editForm.version}
                  onChange={handleEditChange}
                  placeholder="1.0.0"
                  disabled={savingEdit}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="edit-platform">Plataforma</label>
                <select
                  id="edit-platform"
                  name="platform"
                  value={editForm.platform}
                  onChange={handleEditChange}
                  disabled={savingEdit}
                >
                  <option value="windows">Windows (.exe)</option>
                  <option value="macos">macOS (.dmg)</option>
                  <option value="linux">Linux (.AppImage)</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="edit-downloadUrl">URL de descarga</label>
                <input
                  id="edit-downloadUrl"
                  type="url"
                  name="downloadUrl"
                  value={editForm.downloadUrl}
                  onChange={handleEditChange}
                  placeholder="https://..."
                  disabled={savingEdit}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="edit-releaseNotes">Notas de la versión</label>
                <textarea
                  id="edit-releaseNotes"
                  name="releaseNotes"
                  value={editForm.releaseNotes}
                  onChange={handleEditChange}
                  placeholder="Cambios, mejoras, fixes..."
                  rows="4"
                  disabled={savingEdit}
                />
              </div>

              <div className={styles.checkbox}>
                <input
                  id="edit-isLatest"
                  type="checkbox"
                  name="isLatest"
                  checked={editForm.isLatest}
                  onChange={handleEditChange}
                  disabled={savingEdit}
                />
                <label htmlFor="edit-isLatest">
                  Marcar como versión más reciente
                </label>
              </div>

              {editError && (
                <div className={`${styles.status} ${styles.error}`}>
                  {editError}
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeEdit}
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: confirmar eliminación */}
      {deletingRelease && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !deleting && setDeletingRelease(null)}
        >
          <div
            className={`${styles.modal} ${styles.modalSmall}`}
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>Eliminar release</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setDeletingRelease(null)}
                disabled={deleting}
                aria-label="Cerrar"
              >
                <BiX />
              </button>
            </div>

            <p className={styles.confirmText}>
              ¿Seguro que querés eliminar la versión{" "}
              <strong>v{deletingRelease.version}</strong> (
              {deletingRelease.platform})? Esta acción no se puede deshacer.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeletingRelease(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
