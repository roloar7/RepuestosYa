import { BiDownload } from 'react-icons/bi'
import { useAppRelease } from '../hooks/useAppRelease'
import styles from './DownloadElectron.module.css'

export default function DownloadElectron() {
  const { _release, loading, error, downloadUrl, version, isAuthenticated } = useAppRelease()

  if (loading) {
    return (
      <button
        type="button"
        className={styles.button}
        disabled
        title="Cargando versión..."
      >
        <BiDownload />
        <span>Cargando...</span>
      </button>
    )
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        className={`${styles.button} ${styles.disabled}`}
        disabled
        title="Inicia sesión para descargar"
      >
        <BiDownload />
        <span>Iniciar sesión</span>
      </button>
    )
  }

  // Si está autenticado pero sin versión disponible
  if (!downloadUrl) {
    return (
      <button
        type="button"
        className={`${styles.button} ${styles.disabled}`}
        disabled
        title={error || "No hay versión disponible para tu plataforma"}
      >
        <BiDownload />
        <span>{error || "Sin versión"}</span>
      </button>
    )
  }

  // Versión disponible y autenticado ✅
  return (
    <a
      href={downloadUrl}
      className={styles.button}
      title={`Descargar v${version} (solo autenticados)`}
      download
    >
      <BiDownload />
      <span>Descargar {version && `v${version}`}</span>
    </a>
  )
}
