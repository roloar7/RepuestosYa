import JSZip from 'jszip'
import * as RarJs from 'rarjs'

/**
 * Comprimir archivo a ZIP
 * @param {File} file - Archivo a comprimir
 * @param {string} fileName - Nombre del archivo dentro del ZIP
 * @returns {Promise<Blob>} ZIP comprimido
 */
export async function compressToZip(file, fileName) {
  try {
    const zip = new JSZip()
    zip.file(fileName, file)
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    return zipBlob
  } catch (err) {
    console.error('[archiveUtils] Compress error:', err)
    throw new Error('Error al comprimir archivo: ' + err.message)
  }
}

/**
 * Detectar tipo de archivo (zip, rar, 7z, etc)
 * @param {string} fileName - Nombre del archivo
 * @returns {string} Tipo: 'zip', 'rar', 'unknown'
 */
export function detectArchiveType(fileName) {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'zip') return 'zip'
  if (ext === 'rar') return 'rar'
  if (ext === '7z') return '7z'
  // Para archivos con número (.001, .002):
  if (fileName.match(/\.(zip|rar|7z)\.\d{3}$/)) {
    const baseExt = fileName.match(/\.(zip|rar|7z)\./)[1]
    return baseExt
  }
  return 'unknown'
}

/**
 * Descomprimir archivos (ZIP y RAR)
 * @param {Blob} archiveBlob - ZIP o RAR a descomprimir
 * @param {string} archiveType - 'zip' o 'rar'
 * @returns {Promise<Array>} Array de {name, blob}
 */
export async function decompressArchive(archiveBlob, archiveType = 'zip') {
  try {
    if (archiveType === 'zip') {
      return await decompressZip(archiveBlob)
    } else if (archiveType === 'rar') {
      return await decompressRar(archiveBlob)
    } else {
      throw new Error(`Formato no soportado: ${archiveType}`)
    }
  } catch (err) {
    console.error('[archiveUtils] Decompress error:', err)
    throw new Error('Error al descomprimir: ' + err.message)
  }
}

/**
 * Descomprimir ZIP
 */
async function decompressZip(zipBlob) {
  const zip = new JSZip()
  await zip.loadAsync(zipBlob)
  const files = []

  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir) {
      const blob = await file.async('blob')
      files.push({ name, blob })
    }
  }

  return files
}

/**
 * Descomprimir RAR
 * Nota: rarjs es más limitado, requiere lectura diferente
 */
async function decompressRar(rarBlob) {
  try {
    // rarjs espera un ArrayBuffer
    const arrayBuffer = await rarBlob.arrayBuffer()

    // Intentar extrar con rarjs
    const extractor = new RarJs()
    const files = []

    // RarJs es asincrónico pero quirky, hacemos lo mejor que podemos
    const entries = await extractor.extract(arrayBuffer)

    // entries puede ser un array o un objeto
    const fileList = Array.isArray(entries) ? entries : Object.values(entries)

    for (const entry of fileList) {
      if (!entry.isDirectory) {
        files.push({
          name: entry.fileName || entry.name || 'unknown',
          blob: new Blob([entry.data || entry], { type: 'application/octet-stream' }),
        })
      }
    }

    return files
  } catch (err) {
    console.error('[archiveUtils] RAR decompress error:', err)
    // Fallback: si rarjs falla, informar al usuario
    throw new Error(
      'Error al descomprimir RAR. Por favor usa ZIP. Razón: ' + err.message
    )
  }
}

/**
 * Obtener ratio de compresión
 */
export function getCompressionRatio(originalSize, compressedSize) {
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
  return ratio
}

/**
 * Formato legible de bytes
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
