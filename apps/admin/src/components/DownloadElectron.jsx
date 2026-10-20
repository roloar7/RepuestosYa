import { BiDownload } from 'react-icons/bi'
import { useAppRelease } from '../hooks/useAppRelease'
import { downloadAndExtractZip } from '../utils/downloadUtils'
import styles from './DownloadElectron.module.css'

export default function DownloadElectron() {
  const { _release, loading, error, downloadUrl, version, isAuthenticated } = useAppRelease()

  const handleDownload = (e) => {
    e.preventDefault()
    if (!downloadUrl || !version) return

    // Nombre del .exe esperado dentro del ZIP
    const exeFileName = `RepuestosYa-Admin-${version}.exe`
    downloadAndExtractZip(downloadUrl, exeFileName)
  }

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
    <button
      type="button"
      className={styles.button}
      onClick={handleDownload}
      title={`Descargar v${version} (ZIP comprimido, se extrae automáticamente)`}
    >
      <BiDownload />
      <span>Descargar {version && `v${version}`}</span>
    </button>
  )
}
