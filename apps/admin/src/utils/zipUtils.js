import JSZip from 'jszip'

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
    console.error('[zipUtils] Compress error:', err)
    throw new Error('Error al comprimir archivo: ' + err.message)
  }
}

/**
 * Descomprimir ZIP y retornar archivos
 * @param {Blob} zipBlob - ZIP a descomprimir
 * @returns {Promise<Array>} Array de {name, blob}
 */
export async function decompressZip(zipBlob) {
  try {
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
  } catch (err) {
    console.error('[zipUtils] Decompress error:', err)
    throw new Error('Error al descomprimir ZIP: ' + err.message)
  }
}

/**
 * Obtener ratio de compresión
 * @param {number} originalSize - Tamaño original en bytes
 * @param {number} compressedSize - Tamaño comprimido en bytes
 * @returns {string} Porcentaje de reducción
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
