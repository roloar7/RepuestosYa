import { useRef, useState, useEffect } from 'react'
import { BiUpload, BiDownload, BiTrash, BiPrinter } from 'react-icons/bi'
import { useAuthContext } from '../../../hooks/useAuthContext.js'
import { usePrintFiles } from '../../../hooks/usePrintFiles.js'
import { usePrinters } from '../../../hooks/usePrinters.js'
import { usePrinterRealtimeTelemetry } from '../../../hooks/usePrinterRealtimeTelemetry.js'
import { usePrinterUpload } from '../../../hooks/usePrinterUpload.js'
import { SendToPrintModal } from './SendToPrintModal.jsx'
import styles from './Archivos.module.css'

function Archivos() {
  const { user } = useAuthContext()
  const { files, uploadFile, deleteFile, getFileUrl } = usePrintFiles(user?.id)
  const { printers } = usePrinters(user?.id)
  const telemetry = usePrinterRealtimeTelemetry(printers.map(p => p.id))
  const { uploadFile: uploadFileToPrinter, uploading: sendingToPrint, progress: uploadProgress, error: uploadError } = usePrinterUpload()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [selectedFileToPrint, setSelectedFileToPrint] = useState(null)
  const fileInputRef = useRef(null)

  // Escuchar progreso de carga FTPS
  useEffect(() => {
    if (!window.electron?.onUploadProgress) return

    const unsubscribe = window.electron.onUploadProgress((data) => {
      // El progreso se maneja en el hook usePrinterUpload
    })

    return () => unsubscribe?.()
  }, [])

  const handleFileSelect = async (event) => {
    const selectedFiles = event.target.files
    if (!selectedFiles) return

    setError(null)
    setUploading(true)

    try {
      for (const file of selectedFiles) {
        const ext = file.name.toLowerCase().split('.').pop()
        if (ext !== '3mf' && ext !== 'gcode') {
          setError(`${file.name}: Solo se permiten .3mf o .gcode`)
          continue
        }

        const result = await uploadFile(file)
        if (!result.success) {
          setError(result.error)
        }
      }
    } finally {
      setUploading(false)
      fileInputRef.current.value = ''
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleDeleteFile = async (fileId, storagePath) => {
    if (!window.confirm('¿Eliminar este archivo?')) return

    setError(null)
    const result = await deleteFile(fileId, storagePath)
    if (!result.success) {
      setError(result.error)
    }
  }

  const handleDownloadFile = async (storagePath, filename) => {
    try {
      const url = await getFileUrl(storagePath)
      if (url) {
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        setError('No se pudo generar el enlace de descarga')
      }
    } catch (err) {
      setError('Error al descargar archivo')
      console.error(err)
    }
  }

  const handleSendToPrint = async (fileId, printerId, filename) => {
    try {
      setError(null)
      
      // Obtener archivo
      const file = files.find(f => f.id === fileId)
      if (!file) {
        setError('Archivo no encontrado')
        return { success: false }
      }

      // Obtener impresora
      const printer = printers.find(p => p.id === printerId)
      if (!printer) {
        setError('Impresora no encontrada')
        return { success: false }
      }

      // Obtener URL del archivo
      const url = await getFileUrl(file.storage_path)
      if (!url) {
        setError('No se pudo obtener el enlace del archivo')
        return { success: false }
      }

      console.log(`[Archivos] Enviando ${filename} a ${printer.name}`)
      
      // Usar FTP para subir
      const result = await uploadFileToPrinter(url, filename, printer)
      
      if (!result.success) {
        setError(result.error || 'Error al enviar a la impresora')
        return { success: false }
      }

      console.log('[Archivos] ✅ Archivo enviado exitosamente')
      return { success: true }
    } catch (err) {
      console.error('[Archivos] Error:', err)
      setError('Error al enviar a imprimir')
      return { success: false }
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getFileIcon = (fileType) => {
    if (fileType === '3mf') return '🧩'
    if (fileType === 'gcode') return '🖨️'
    return '📄'
  }

  return (
    <div className={styles.section}>
      <div className={styles.container}>
        {/* Upload Area */}
        <div className={styles.uploadArea}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".3mf,.gcode"
            onChange={handleFileSelect}
            className={styles.fileInput}
            disabled={uploading}
          />

          <button
            type="button"
            className={styles.uploadBtn}
            onClick={handleUploadClick}
            disabled={uploading}
            title="Subir archivos .3mf o .gcode"
          >
            <BiUpload size={24} />
            <span>{uploading ? 'Subiendo...' : 'Subir Archivos'}</span>
          </button>

          <p className={styles.uploadHint}>
            Arrastra archivos .3mf o .gcode aquí, o haz click para seleccionar
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={styles.errorMessage}>
            <p>{error}</p>
          </div>
        )}

        {/* Files Grid */}
        {files.length > 0 ? (
          <div className={styles.gridSection}>
            <h3 className={styles.gridTitle}>Archivos guardados ({files.length})</h3>
            <div className={styles.grid}>
              {files.map((file) => (
                <div key={file.id} className={styles.card}>
                  {/* Preview */}
                  <div className={styles.preview}>
                    <div className={styles.previewContent}>
                      <span className={styles.fileIcon}>{getFileIcon(file.file_type)}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className={styles.info}>
                    <h4 className={styles.fileName} title={file.filename}>
                      {file.filename}
                    </h4>

                    <div className={styles.specs}>
                      <span className={styles.spec}>
                        <span className={styles.specLabel}>Tipo:</span>
                        <span className={styles.specValue}>{file.file_type.toUpperCase()}</span>
                      </span>
                      <span className={styles.spec}>
                        <span className={styles.specLabel}>Tamaño:</span>
                        <span className={styles.specValue}>{formatFileSize(file.file_size)}</span>
                      </span>
                      <span className={styles.spec}>
                        <span className={styles.specLabel}>Fecha:</span>
                        <span className={styles.specValue}>{formatDate(file.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      title="Enviar a imprimir"
                      onClick={() => {
                        setSelectedFileToPrint(file)
                        setShowPrintModal(true)
                      }}
                    >
                      <BiPrinter size={18} />
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      title="Descargar archivo"
                      onClick={() => handleDownloadFile(file.storage_path, file.filename)}
                    >
                      <BiDownload size={18} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.dangerBtn}`}
                      title="Eliminar archivo"
                      onClick={() => handleDeleteFile(file.id, file.storage_path)}
                    >
                      <BiTrash size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !uploading && (
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>No hay archivos aún</p>
              <p className={styles.emptyStateHint}>Sube tus primeros archivos .3mf o .gcode</p>
            </div>
          )
        )}
      </div>

      {/* Send to Print Modal */}
      <SendToPrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false)
          setSelectedFileToPrint(null)
        }}
        file={selectedFileToPrint}
        printers={printers}
        telemetry={telemetry}
        onSendToPrint={handleSendToPrint}
        loading={sendingToPrint}
        progress={uploadProgress}
      />
    </div>
  )
}

export default Archivos
