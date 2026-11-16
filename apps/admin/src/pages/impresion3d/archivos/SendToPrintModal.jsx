import { useState } from "react"
import { BiCheck } from "react-icons/bi"
import styles from "./SendToPrintModal.module.css"

export function SendToPrintModal({ isOpen, onClose, file, printers, onSendToPrint, loading, progress = 0 }) {
  const [selectedPrinterId, setSelectedPrinterId] = useState(null)

  const handlePrinterToggle = (printerId) => {
    if (selectedPrinterId === printerId) {
      setSelectedPrinterId(null)
    } else {
      setSelectedPrinterId(printerId)
    }
  }

  const handleSendToPrint = async () => {
    if (!selectedPrinterId) return

    const result = await onSendToPrint(file.id, selectedPrinterId, file.filename)
    
    if (result.success) {
      setSelectedPrinterId(null)
      onClose()
    }
  }

  if (!isOpen || !file) return null

  const availablePrinters = printers.filter((p) => p.status !== "offline")

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <h2 className={styles.title}>Enviar a Imprimir</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className={styles.content}>
          <div className={styles.fileInfo}>
            <p className={styles.fileName}>📄 {file.filename}</p>
            <p className={styles.fileSize}>{file.file_type.toUpperCase()} • {Math.round(file.file_size / 1024)} KB</p>
          </div>

          <div className={styles.printersList}>
            <p className={styles.label}>Selecciona una impresora</p>
            
            {availablePrinters.length === 0 ? (
              <div className={styles.noPrinters}>
                <p>No hay impresoras disponibles</p>
              </div>
            ) : (
              <div className={styles.printers}>
                {availablePrinters.map((printer) => (
                  <button
                    key={printer.id}
                    type="button"
                    className={`${styles.printerOption} ${selectedPrinterId === printer.id ? styles.selected : ""}`}
                    onClick={() => handlePrinterToggle(printer.id)}
                  >
                    <span className={styles.printerCheck}>
                      {selectedPrinterId === printer.id && <BiCheck size={18} />}
                    </span>
                    <div className={styles.printerInfo}>
                      <p className={styles.printerName}>{printer.name}</p>
                      <p className={styles.printerIp}>{printer.ip}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <p className={styles.progressText}>{progress}%</p>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSendToPrint}
            disabled={!selectedPrinterId || loading}
          >
            {loading ? "Enviando..." : "Imprimir"}
          </button>
        </footer>
      </div>
    </div>
  )
}
