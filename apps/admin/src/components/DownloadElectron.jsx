import { BiDownload } from 'react-icons/bi'
import { useAppRelease } from '../hooks/useAppRelease'
import styles from './DownloadElectron.module.css'

export default function DownloadElectron() {
  const { release, loading, error, downloadUrl, version } = useAppRelease()

  if (loading) {
    return (
      <button
        type="button"
        className={styles.button}
        disabled
        title="Cargando versión..."
      >
        <BiDownload />
        <span>Descargando...</span>
      </button>
    )
  }

  if (error || !downloadUrl) {
    return (
      <button
        type="button"
        className={`${styles.button} ${styles.disabled}`}
        disabled
        title={error || "Sin versión disponible"}
      >
        <BiDownload />
        <span>No disponible</span>
      </button>
    )
  }

  return (
    <a
      href={downloadUrl}
      className={styles.button}
      title={`Descargar v${version}`}
      download
    >
      <BiDownload />
      <span>Descargar {version && `v${version}`}</span>
    </a>
  )
}
