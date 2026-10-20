import { decompressArchive, detectArchiveType } from './archiveUtils'

/**
 * Descargar múltiples partes ZIP (.zip.001, .zip.002, etc)
 * Reensamblarlas en un solo archivo y descomprimir
 * @param {string} baseUrl - URL sin extensión (ej: /...RepuestosYa-Admin-1.0.0.zip)
 * @param {number} totalParts - Número de partes (ej: 9)
 * @param {string} fileName - Nombre del .exe esperado
 */
export async function downloadMultipartZip(baseUrl, totalParts, fileName) {
  try {
    console.log(`[multipartUtils] Iniciando descarga de ${totalParts} partes`)

    const parts = []
    let downloadedSize = 0

    // Descargar cada parte
    for (let i = 1; i <= totalParts; i++) {
      const partNumber = String(i).padStart(3, '0')
      const partUrl = `${baseUrl}.${partNumber}`

      console.log(`[multipartUtils] Descargando parte ${i}/${totalParts}: ${partUrl}`)

      const response = await fetch(partUrl)
      if (!response.ok) {
        throw new Error(
          `Error descargando parte ${i}: ${response.status} ${response.statusText}`
        )
      }

      const blob = await response.blob()
      parts.push(blob)
      downloadedSize += blob.size

      console.log(
        `[multipartUtils] Parte ${i} descargada: ${(blob.size / 1024 / 1024).toFixed(2)} MB`
      )

      // Notificar progreso (opcional)
      const progressPercent = Math.round((i / totalParts) * 100)
      console.log(`[multipartUtils] Progreso: ${progressPercent}%`)
    }

    console.log(
      `[multipartUtils] Todas las partes descargadas: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB total`
    )

    // Reensamblar partes en un solo Blob
    console.log('[multipartUtils] Reensamblando partes...')
    const zipBlob = new Blob(parts, { type: 'application/zip' })
    console.log(`[multipartUtils] ZIP reensamblado: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`)

    // Detectar tipo de archivo (zip, rar, 7z)
    // Para multipart, detectamos por el primer archivo
    const archiveType = detectArchiveType(baseUrl)
    console.log('[multipartUtils] Tipo detectado:', archiveType)

    // Descomprimir
    console.log('[multipartUtils] Descomprimiendo...')
    const files = await decompressArchive(zipBlob, archiveType)
    console.log(
      `[multipartUtils] Archivos en ${archiveType.toUpperCase()}:`,
      files.map(f => f.name)
    )

    // Buscar el .exe
    const exeFile = files.find(f => f.name === fileName || f.name.endsWith('.exe'))
    if (!exeFile) {
      throw new Error(
        `No se encontró ${fileName} en el ZIP. Archivos encontrados: ${files.map(f => f.name).join(', ')}`
      )
    }

    console.log(`[multipartUtils] Descargando: ${exeFile.name}`)

    // Descargar el .exe
    downloadBlob(exeFile.blob, exeFile.name)
  } catch (err) {
    console.error('[multipartUtils] Error:', err)
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

/**
 * Obtener info de partes desde metadata
 * Útil si guardas la info en BD
 */
export function parsePartInfo(downloadUrl) {
  // Ejemplo: URL termina sin extensión o con .zip
  // Sistema detecta si hay .001, .002, etc en Storage

  const baseUrl = downloadUrl.replace(/\.\d{3}$/, '') // Quita .001, .002, etc
  return {
    baseUrl,
    // totalParts debería venir desde BD o query param
  }
}
