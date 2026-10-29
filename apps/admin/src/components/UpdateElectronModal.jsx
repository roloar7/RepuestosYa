import { useEffect, useState } from 'react'
import styles from './UpdateElectronModal.module.css'

/**
 * Modal de actualización para Electron
 * Muestra versión, botones de cancelar/instalar y barra de progreso
 */
export default function UpdateElectronModal({ isOpen, onClose, newVersion, onInstall, isInstalling, downloadProgress }) {
  const [animating, setAnimating] = useState(false)

  // Animación de apertura
  useEffect(() => {
    if (isOpen) {
      setAnimating(true)
    }
  }, [isOpen])

  const handleClose = () => {
    if (!isInstalling) {
      setAnimating(false)
      setTimeout(onClose, 300)
    }
  }

  const handleInstall = async () => {
    await onInstall()
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
            disabled={isInstalling}
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
        </div>

        {/* Footer - Botones */}
        <div className={styles.footer}>
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
        </div>
      </div>
    </div>
  )
}
