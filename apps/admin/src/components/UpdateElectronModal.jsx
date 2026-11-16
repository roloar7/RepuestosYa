import { useEffect, useState } from 'react'
import styles from './UpdateElectronModal.module.css'

/**
 * Modal de actualización para Electron
 * Muestra versión, botones de cancelar/instalar y barra de progreso
 */
export default function UpdateElectronModal({ isOpen, onClose, newVersion, onInstall, isInstalling, downloadProgress }) {
  const [animating, setAnimating] = useState(false)
  const [readyToInstall, setReadyToInstall] = useState(false)

  // Animación de apertura
  useEffect(() => {
    if (isOpen) {
      setAnimating(true)
      setReadyToInstall(false)
    }
  }, [isOpen])

  // Escuchar cuando esté listo para instalar
  useEffect(() => {
    if (!window.electron?.updater?.onReadyToInstall) return

    const unsubscribe = window.electron.updater.onReadyToInstall(() => {
      setReadyToInstall(true)
    })

    return () => unsubscribe?.()
  }, [])

  const handleClose = () => {
    if (!isInstalling && !readyToInstall) {
      setAnimating(false)
      setTimeout(onClose, 300)
    }
  }

  const handleInstall = async () => {
    await onInstall()
  }

  const handleRestart = () => {
    window.electron?.updater?.quitAndInstall()
  }

  if (!isOpen) return null

  return (
    <div
      className={`${styles.backdrop} ${animating ? styles.backdropVisible : ''}`}
      onClick={handleClose}
    >
      <div
        className={`${styles.modal} ${animating ? styles.modalVisible : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Actualizar aplicación"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Nueva versión disponible</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            disabled={isInstalling || readyToInstall}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.versionInfo}>
            <span className={styles.label}>Nueva versión:</span>
            <span className={styles.version}>v{newVersion}</span>
          </div>

          <p className={styles.description}>
            Se actualizará la aplicación a la última versión disponible.
          </p>

          {/* Barra de progreso */}
          {isInstalling && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className={styles.progressText}>{downloadProgress}%</span>
            </div>
          )}

          {isInstalling && (
            <p className={styles.installingText}>
              Descargando e instalando...
            </p>
          )}

          {readyToInstall && (
            <p className={styles.readyText}>
              ✓ Actualización lista. Haz clic en "Reiniciar" para instalar.
            </p>
          )}
        </div>

        {/* Footer - Botones */}
        <div className={styles.footer}>
          {!readyToInstall ? (
            <>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleClose}
                disabled={isInstalling}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.installBtn}
                onClick={handleInstall}
                disabled={isInstalling}
              >
                {isInstalling ? 'Instalando...' : 'Instalar'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.installBtn}
              onClick={handleRestart}
            >
              Reiniciar ahora
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
