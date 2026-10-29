import { useState, useEffect } from 'react'
import { BiDownload } from 'react-icons/bi'
import styles from './DownloadWeb.module.css'

/**
 * Componente de descarga para web
 * Obtiene automáticamente el último .exe de GitHub Releases
 * Solo se muestra en web (no en Electron)
 */
export default function DownloadWeb() {
  const [version, setVersion] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // No mostrar si está en Electron
  if (window.electron?.updater) {
    return null
  }

  // Obtener última release de GitHub
  useEffect(() => {
    async function fetchLatestRelease() {
      try {
        // Configuración de GitHub
        const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || 'roloar7'
        const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'RepuestosYa'

        console.log(`[DownloadWeb] Obteniendo release: ${GITHUB_OWNER}/${GITHUB_REPO}`)

        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        )

        if (!response.ok) {
          console.error('[DownloadWeb] GitHub API error:', response.status)
          setError(true)
          setLoading(false)
          return
        }

        const release = await response.json()
        console.log('[DownloadWeb] Release obtenida:', release.tag_name)
        console.log('[DownloadWeb] Assets disponibles:', release.assets?.map(a => a.name))

        // Extraer versión
        const version = release.tag_name?.replace('v', '') || 'latest'
        setVersion(version)

        // Buscar el asset .exe (Windows) - excluir .blockmap y otros archivos
        const exeAsset = release.assets?.find(asset => {
          const name = asset.name.toLowerCase()
          const isExe = name.endsWith('.exe')
          const isNotBlockmap = !name.includes('.blockmap')
          console.log(`[DownloadWeb] Checking ${asset.name}: isExe=${isExe}, isNotBlockmap=${isNotBlockmap}`)
          return isExe && isNotBlockmap
        })

        if (exeAsset) {
          console.log('[DownloadWeb] .exe encontrado:', exeAsset.name)
          setDownloadUrl(exeAsset.browser_download_url)
        } else {
          console.warn('[DownloadWeb] No se encontró .exe en la release')
          setError(true)
        }
      } catch (err) {
        console.error('[DownloadWeb] Error:', err.message)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchLatestRelease()
  }, [])

  // Estado de carga
  if (loading) {
    return (
      <div className={styles.button} title="Cargando versión..." style={{ opacity: 0.7 }}>
        <BiDownload />
        <span>Cargando...</span>
      </div>
    )
  }

  // Error
  if (error || !downloadUrl) {
    return (
      <div className={styles.button} title="No disponible" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
        <BiDownload />
        <span>No disponible</span>
      </div>
    )
  }

  // Descarga disponible
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
