import { useState } from 'react'

/**
 * Hook para subir archivos a impresoras vía FTPS
 */
export function usePrinterUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const uploadFile = async (fileUrl, fileName, printer) => {
    try {
      setUploading(true)
      setProgress(0)
      setError(null)

      if (!window.electron?.printer?.uploadFile) {
        throw new Error('Función no disponible en web')
      }

      // Descargar archivo desde Supabase
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error('Error descargando archivo')
      }

      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()

      // Pasar datos a Electron
      const result = await window.electron.printer.uploadFile({
        fileName: fileName,
        fileBuffer: Array.from(new Uint8Array(arrayBuffer)),
        printer: {
          ip: printer.ip,
          access_code: printer.access_code,
        },
      })

      if (!result.success) {
        throw new Error(result.error || 'Error al subir archivo')
      }

      return { success: true, fileName: result.fileName }
    } catch (err) {
      const errorMsg = err.message || 'Error desconocido'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return {
    uploadFile,
    uploading,
    progress,
    error,
  }
}
