import { BiDownload } from 'react-icons/bi'
import { useAppRelease } from '../hooks/useAppRelease'
import { downloadAndExtractZip } from '../utils/downloadUtils'
import { downloadMultipartZip } from '../utils/multipartUtils'
import styles from './DownloadElectron.module.css'

export default function DownloadElectron() {
  const { _release, loading, error, downloadUrl, version, isAuthenticated } = useAppRelease()

  const handleDownload = (e) => {
    e.preventDefault()
    if (!downloadUrl || !version) return

    // Nombre del .exe esperado dentro del ZIP
    const exeFileName = `RepuestosYa-Admin-${version}.exe`

    // Detectar si es multipart (.zip.001, .zip.002, etc) o monolítico
    const totalParts = _release?.total_parts || 1

    if (totalParts > 1) {
      // Descargar múltiples partes
      console.log(`[DownloadElectron] Descargando ${totalParts} partes...`)
      downloadMultipartZip(downloadUrl, totalParts, exeFileName)
    } else {
      // Descargar archivo único
      console.log('[DownloadElectron] Descargando archivo único...')
      downloadAndExtractZip(downloadUrl, exeFileName)
    }
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
  const parts = _release?.total_parts || 1
  const tooltip =
    parts > 1
      ? `Descargar v${version} (${parts} partes, se descargan y descomponen automáticamente)`
      : `Descargar v${version} (ZIP comprimido, se extrae automáticamente)`

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleDownload}
      title={tooltip}
    >
      <BiDownload />
      <span>Descargar {version && `v${version}`}</span>
    </button>
  )
}
