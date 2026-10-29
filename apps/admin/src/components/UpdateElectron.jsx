import { useState, useEffect } from 'react'
import { BiDownload } from 'react-icons/bi'
import UpdateElectronModal from './UpdateElectronModal'
import styles from './UpdateElectron.module.css'

/**
 * Componente de actualización para Electron
 * Obtiene automáticamente la última versión de GitHub Releases
 * Solo se muestra en Electron
 */
export default function UpdateElectron() {
  const [currentVersion, setCurrentVersion] = useState(null)
  const [newVersion, setNewVersion] = useState(null)
  const [hasUpdate, setHasUpdate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)

  // No mostrar si no hay Electron
  if (!window.electron?.updater) {
    return null
  }

  // Obtener versión actual y verificar actualizaciones
  useEffect(() => {
    async function checkUpdates() {
      try {
        setLoading(true)
        setError(null)

        // Obtener versión actual
        const versionInfo = await window.electron.updater.getVersion()
        setCurrentVersion(versionInfo.currentVersion)
        console.log('[UpdateElectron] Versión actual:', versionInfo.currentVersion)

        // Obtener última release de GitHub
        const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || 'roloar7'
        const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'RepuestosYa'

        console.log(`[UpdateElectron] Verificando releases: ${GITHUB_OWNER}/${GITHUB_REPO}`)

        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        )

        if (!response.ok) {
          console.error('[UpdateElectron] GitHub API error:', response.status)
          setError('No se pudo verificar actualizaciones')
          setLoading(false)
          return
        }

        const release = await response.json()
        const version = release.tag_name?.replace('v', '')

        console.log('[UpdateElectron] Última versión en GitHub:', version)

        setNewVersion(version)

        // Comparar versiones (simple: v1.0.1 > v1.0.0)
        const isNewer = compareVersions(version, versionInfo.currentVersion)
        setHasUpdate(isNewer)

        if (isNewer) {
          console.log('[UpdateElectron] Actualización disponible')
        } else {
          console.log('[UpdateElectron] Ya está actualizado')
        }
      } catch (err) {
        console.error('[UpdateElectron] Error:', err.message)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    checkUpdates()
  }, [])

  // Suscribirse a progreso de descarga
  useEffect(() => {
    if (!window.electron?.updater?.onDownloadProgress) {
      return
    }

    // Usar el listener expuesto en preload.js
    const unsubscribe = window.electron.updater.onDownloadProgress((progress) => {
      console.log('[UpdateElectron] Progreso:', progress)
      setDownloadProgress(progress)
    })

    return () => unsubscribe?.()
  }, [])

  const handleOpenModal = () => {
    setShowModal(true)
  }

  const handleCloseModal = () => {
    if (!downloading) {
      setShowModal(false)
    }
  }

  const handleInstall = async () => {
    if (!newVersion) return

    try {
      setDownloading(true)
      setError(null)
      setDownloadProgress(0)

      console.log('[UpdateElectron] Iniciando descarga de v' + newVersion)

      // Usar electron-updater si está disponible
      if (window.electron?.updater?.downloadAndInstall) {
        const result = await window.electron.updater.downloadAndInstall()

        if (!result.success) {
          setError(result.error)
          setDownloading(false)
        }
        // Si es exitoso, la app se reinicia automáticamente
      }
    } catch (err) {
      console.error('[UpdateElectron] Error:', err)
      setError(err.message)
      setDownloading(false)
    }
  }

  // Aún cargando
  if (loading) {
    return (
      <div className={styles.compact}>
        <span className={styles.text}>Verificando...</span>
      </div>
    )
  }

  // Sin actualización disponible
  if (!hasUpdate) {
    return (
      <div className={styles.compact}>
        <span className={styles.text}>✓ v{currentVersion}</span>
      </div>
    )
  }

  // Actualización disponible
  return (
    <>
      <button
        type="button"
        className={styles.updateBtn}
        onClick={handleOpenModal}
        disabled={downloading}
        title={`Nueva versión disponible: v${newVersion}`}
      >
        <BiDownload size={18} />
        <span>Actualizar</span>
      </button>

      <UpdateElectronModal
        isOpen={showModal}
        onClose={handleCloseModal}
        newVersion={newVersion}
        onInstall={handleInstall}
        isInstalling={downloading}
        downloadProgress={downloadProgress}
      />
    </>
  )
}

/**
 * Comparar versiones simple (v1.0.1 > v1.0.0)
 */
function compareVersions(v1, v2) {
  if (!v1 || !v2) return false

  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0

    if (p1 > p2) return true
    if (p1 < p2) return false
  }

  return false
}
