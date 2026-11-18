import { useState } from "react"
import { BiCheck } from "react-icons/bi"
import styles from "./SendToPrintModal.module.css"

export function SendToPrintModal({ isOpen, onClose, file, printers, telemetry, onSendToPrint, loading, progress = 0 }) {
  const [selectedPrinterIds, setSelectedPrinterIds] = useState(new Set())

  const handlePrinterToggle = (printerId, canSelect) => {
    if (!canSelect) return

    const newSelected = new Set(selectedPrinterIds)
    if (newSelected.has(printerId)) {
      newSelected.delete(printerId)
    } else {
      newSelected.add(printerId)
    }
    setSelectedPrinterIds(newSelected)
  }

  const handleSendToPrint = async () => {
    if (selectedPrinterIds.size === 0) return

    // Enviar a todas las impresoras seleccionadas
    for (const printerId of selectedPrinterIds) {
      const result = await onSendToPrint(file.id, printerId, file.filename)
      if (!result.success) {
        console.error(`Error enviando a impresora ${printerId}`)
        return
      }
    }

    setSelectedPrinterIds(new Set())
    onClose()
  }

  if (!isOpen || !file) return null

  // Mapear estados a información visual basado en status y telemetría
  const getStatusInfo = (printer) => {
    // Primero verificar si está offline
    if (printer.status === 'offline') {
      return { label: "Desconectada", color: "offline", canSelect: false }
    }

    // Si está conectada, verificar si tiene telemetría
    const telemetryData = telemetry?.[printer.id]
    
    if (!telemetryData) {
      // Conectada pero sin telemetría aún = se está intentando conectar
      return { label: "Desconectada", color: "offline", canSelect: false }
    }

    // Verificar estado de impresión desde telemetría
    if (telemetryData.gcode_state === 'RUNNING' || telemetryData.gcode_state === 'PRINTING') {
      return { label: "Imprimiendo", color: "printing", canSelect: false }
    }
    
    if (telemetryData.gcode_state === 'PAUSE') {
      return { label: "Pausada", color: "paused", canSelect: true }
    }

    // IDLE u otro estado
    return { label: "Conectada", color: "idle", canSelect: true }
  }

  // Mostrar todas las impresoras, pero algunas deshabilitadas
  const availablePrinters = printers.sort((a, b) => {
    const statusA = getStatusInfo(a)
    const statusB = getStatusInfo(b)
    return statusA.canSelect === statusB.canSelect ? 0 : statusA.canSelect ? -1 : 1
  })

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
            <p className={styles.label}>
              Selecciona impresoras ({selectedPrinterIds.size})
            </p>
            
            {printers.length === 0 ? (
              <div className={styles.noPrinters}>
                <p>No hay impresoras disponibles</p>
              </div>
            ) : (
              <div className={styles.printers}>
                {availablePrinters.map((printer) => {
                  const statusInfo = getStatusInfo(printer)
                  const isSelected = selectedPrinterIds.has(printer.id)
                  const isDisabled = !statusInfo.canSelect

                  return (
                    <button
                      key={printer.id}
                      type="button"
                      className={`${styles.printerOption} ${styles[`status-${statusInfo.color}`]} ${isSelected ? styles.selected : ""} ${isDisabled ? styles.disabled : ""}`}
                      onClick={() => handlePrinterToggle(printer.id, statusInfo.canSelect)}
                      disabled={isDisabled}
                    >
                      <span className={styles.printerCheck}>
                        {isSelected && <BiCheck size={18} />}
                      </span>
                      <div className={styles.printerInfo}>
                        <p className={styles.printerName}>{printer.name}</p>
                        <p className={styles.printerIp}>{printer.ip}</p>
                      </div>
                      <span className={`${styles.printerStatus} ${styles[`status-${statusInfo.color}`]}`}>
                        {statusInfo.label}
                      </span>
                    </button>
                  )
                })}
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
            disabled={selectedPrinterIds.size === 0 || loading}
          >
            {loading ? "Enviando..." : `Imprimir en ${selectedPrinterIds.size} impresora${selectedPrinterIds.size !== 1 ? "s" : ""}`}
          </button>
        </footer>
      </div>
    </div>
  )
}
