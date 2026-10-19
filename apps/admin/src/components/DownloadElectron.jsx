import { BiDownload } from 'react-icons/bi'
import styles from './DownloadElectron.module.css'

export default function DownloadElectron() {
  const GITHUB_REPO = 'https://github.com/roloar7/RepuestosYa'
  const RELEASES_URL = `${GITHUB_REPO}/releases/`

  return (
    <a
      href={RELEASES_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.button}
      title="Descargar versión de escritorio"
    >
      <BiDownload />
      <span>Descargar version de Escritorio</span>
    </a>
  )
}
