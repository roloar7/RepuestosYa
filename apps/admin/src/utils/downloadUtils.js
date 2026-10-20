import { decompressArchive, detectArchiveType } from './archiveUtils'

/**
 * Descargar ZIP desde URL, descomprimir y ejecutar descarga del .exe
 * @param {string} downloadUrl - URL del ZIP en Supabase Storage
 * @param {string} fileName - Nombre del ejecutable esperado en el ZIP
 */
export async function downloadAndExtractZip(downloadUrl, fileName) {
  try {
    console.log('[downloadUtils] Iniciando descarga de:', downloadUrl)

    // Descargar ZIP
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`)
    }

    const zipBlob = await response.blob()
    console.log('[downloadUtils] ZIP descargado:', zipBlob.size, 'bytes')

    // Detectar tipo de archivo
    const archiveType = detectArchiveType(downloadUrl)
    console.log('[downloadUtils] Tipo detectado:', archiveType)

    // Descomprimir
    const files = await decompressArchive(zipBlob, archiveType)
    console.log(
      `[downloadUtils] Archivos en ${archiveType.toUpperCase()}:`,
      files.map(f => f.name)
    )

    // Buscar el .exe
    const exeFile = files.find(f => f.name === fileName || f.name.endsWith('.exe'))
    if (!exeFile) {
      throw new Error(
        `No se encontró ${fileName} en el ZIP. Archivos encontrados: ${files.map(f => f.name).join(', ')}`
      )
    }

    console.log('[downloadUtils] Descargando:', exeFile.name)

    // Descargar el .exe
    downloadBlob(exeFile.blob, exeFile.name)
  } catch (err) {
    console.error('[downloadUtils] Error:', err)
    alert('Error al descargar: ' + err.message)
  }
}

/**
 * Descargar un blob directamente (trigger descarga en browser)
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
