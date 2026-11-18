import { useState, useEffect } from "react"
import { BiPlay, BiPlus, BiPrinter, BiTrash, BiPause, BiStopCircle } from "react-icons/bi"
import { useAuthContext } from "../../../hooks/useAuthContext.js"
import { usePrinters } from "../../../hooks/usePrinters.js"
import { usePrinterRealtimeTelemetry } from "../../../hooks/usePrinterRealtimeTelemetry.js"
import { AddPrinterModal } from "./AddPrinterModal.jsx"
import { DeletePrinterModal } from "./DeletePrinterModal.jsx"

import styles from "./Granja.module.css"

const statusMeta = {
  printing: { label: "Imprimiendo", tone: "accent" },
  idle: { label: "Disponible", tone: "success" },
  offline: { label: "Desconectada", tone: "muted" },
  error: { label: "Error", tone: "danger" },
}

function StatusBadge({ printer, telemetry }) {
  // Determinar estado real basado en telemetría
  let status = printer.status
  
  const data = telemetry[printer.id]
  if (data) {
    // Si hay telemetría, usar el gcode_state
    if (data.gcode_state === 'IDLE' || data.gcode_state === 'PAUSE') {
      status = 'idle'
    } else if (data.gcode_state === 'RUNNING' || data.gcode_state === 'PRINTING') {
      status = 'printing'
    }
  } else if (printer.status !== 'offline') {
    // Sin telemetría pero debería estar conectado
    status = 'offline'
  }

  const meta = statusMeta[status]
  return (
    <span className={`${styles.badge} ${styles[`tone_${meta.tone}`]}`}>
      <span className={styles.badgeDot} />
      {meta.label}
    </span>
  )
}

function PrinterCard({ printer, telemetry, onDelete, onPause, onResume, onStop }) {
  const data = telemetry[printer.id]
  const isPrinting = data && (data.gcode_state === 'RUNNING' || data.gcode_state === 'PRINTING')
  const isPaused = data && data.gcode_state === 'PAUSE'
  const [commandLoading, setCommandLoading] = useState(null)
  
  const handlePause = async () => {
    setCommandLoading('pause')
    try {
      await onPause(printer.id)
    } finally {
      setCommandLoading(null)
    }
  }
  
  const handleResume = async () => {
    setCommandLoading('resume')
    try {
      await onResume(printer.id)
    } finally {
      setCommandLoading(null)
    }
  }
  
  const handleStop = async () => {
    setCommandLoading('stop')
    try {
      await onStop(printer.id)
    } finally {
      setCommandLoading(null)
    }
  }
  
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <span className={styles.cardIcon}>
          <BiPrinter size={20} />
        </span>
        <div className={styles.cardTitle}>
          <p className={styles.printerName}>{printer.name}</p>
          <p className={styles.printerModel}>{printer.ip}</p>
        </div>
        <StatusBadge printer={printer} telemetry={telemetry} />
      </header>

      <div className={styles.cardBody}>
        {data ? (
          <>
            <div className={styles.telemetry}>
              <div className={styles.tempItem}>
                <span className={styles.tempLabel}>Nozzle</span>
                <span className={styles.tempValue}>{data.nozzle_temp}°C</span>
              </div>
              <div className={styles.tempItem}>
                <span className={styles.tempLabel}>Cama</span>
                <span className={styles.tempValue}>{data.bed_temp}°C</span>
              </div>
              <div className={styles.tempItem}>
                <span className={styles.tempLabel}>Progreso</span>
                <span className={styles.tempValue}>{data.progress}%</span>
              </div>
            </div>
          </>
        ) : (
          <p className={styles.idleText}>
            {printer.status === "offline"
              ? "Sin conexión con la impresora."
              : "Esperando conexión..."}
          </p>
        )}
      </div>

      <footer className={styles.cardFoot}>
        <button 
          type="button" 
          className={styles.ghostBtn}
          onClick={() => onDelete(printer)}
          title="Eliminar impresora"
        >
          <BiTrash size={16} /> Eliminar
        </button>
        
        {isPrinting && (
          <>
            <button
              type="button"
              className={styles.warningBtn}
              onClick={handlePause}
              disabled={commandLoading === 'pause'}
              title="Pausar impresión"
            >
              <BiPause size={16} /> Pausar
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={handleStop}
              disabled={commandLoading === 'stop'}
              title="Detener impresión"
            >
              <BiStopCircle size={16} /> Detener
            </button>
          </>
        )}
        
        {isPaused && (
          <button
            type="button"
            className={styles.successBtn}
            onClick={handleResume}
            disabled={commandLoading === 'resume'}
            title="Reanudar impresión"
          >
            <BiPlay size={16} /> Reanudar
          </button>
        )}
        
        {!isPrinting && !isPaused && (
          <button
            type="button"
            className={styles.solidBtn}
            disabled={!data || data.gcode_state === 'IDLE'}
            title="Imprimir"
          >
            <BiPlay size={16} /> Imprimir
          </button>
        )}
      </footer>
    </article>
  )
}

function Granja() {
  const { user } = useAuthContext()
  const { printers, loading: printersLoading, addPrinter, deletePrinter } = usePrinters(user?.id)
  const telemetry = usePrinterRealtimeTelemetry(printers.map(p => p.id))
  const [showAddModal, setShowAddModal] = useState(false)
  const [printerToDelete, setPrinterToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Nota: Las impresoras se conectan globalmente en Inicio.jsx al arrancar la app
  // No se reconectan en cada navegación para evitar múltiples conexiones

  const counts = {
    printing: printers.filter((p) => {
      const data = telemetry[p.id]
      return data && (data.gcode_state === 'RUNNING' || data.gcode_state === 'PRINTING')
    }).length,
    idle: printers.filter((p) => {
      const data = telemetry[p.id]
      // Si tiene telemetría y está idle/paused, o si está conectada pero sin telemetría aún
      return (data && (data.gcode_state === 'IDLE' || data.gcode_state === 'PAUSE')) || (p.status !== 'offline' && !data)
    }).length,
    offline: printers.filter((p) => p.status === 'offline').length,
  }

  const handleDeleteConfirm = async () => {
    if (!printerToDelete) return
    
    try {
      setDeleting(true)
      console.log(`[Granja] Eliminando impresora ${printerToDelete.id}...`)
      
      const result = await deletePrinter(printerToDelete.id)
      
      if (result.success) {
        console.log(`[Granja] ✓ Impresora ${printerToDelete.id} eliminada exitosamente`)
        setPrinterToDelete(null)
      } else {
        console.error("[Granja] Error al eliminar:", result.error)
      }
    } catch (err) {
      console.error("[Granja] Error en handleDeleteConfirm:", err)
    } finally {
      setDeleting(false)
    }
  }

  const handlePause = async (printerId) => {
    try {
      console.log(`[Granja] Pausando impresora ${printerId}...`)
      const result = await window.electron?.ipcRenderer?.invoke('printer:pause', printerId)
      if (result?.success) {
        console.log(`[Granja] ✓ Impresora pausada`)
      } else {
        console.error("[Granja] Error al pausar:", result?.error)
      }
    } catch (err) {
      console.error("[Granja] Error en handlePause:", err)
    }
  }

  const handleResume = async (printerId) => {
    try {
      console.log(`[Granja] Reanudando impresora ${printerId}...`)
      const result = await window.electron?.ipcRenderer?.invoke('printer:resume', printerId)
      if (result?.success) {
        console.log(`[Granja] ✓ Impresora reanudada`)
      } else {
        console.error("[Granja] Error al reanudar:", result?.error)
      }
    } catch (err) {
      console.error("[Granja] Error en handleResume:", err)
    }
  }

  const handleStop = async (printerId) => {
    try {
      console.log(`[Granja] Deteniendo impresora ${printerId}...`)
      const result = await window.electron?.ipcRenderer?.invoke('printer:stop', printerId)
      if (result?.success) {
        console.log(`[Granja] ✓ Impresora detenida`)
      } else {
        console.error("[Granja] Error al detener:", result?.error)
      }
    } catch (err) {
      console.error("[Granja] Error en handleStop:", err)
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <div className={styles.chips}>
          <span className={styles.chip}>
            <strong>{printers.length}</strong> Total
          </span>
          <span className={styles.chip}>
            <span className={`${styles.chipDot} ${styles.tone_accent}`} />
            <strong>{counts.printing}</strong> Imprimiendo
          </span>
          <span className={styles.chip}>
            <span className={`${styles.chipDot} ${styles.tone_success}`} />
            <strong>{counts.idle}</strong> Disponibles
          </span>
          <span className={styles.chip}>
            <span className={`${styles.chipDot} ${styles.tone_muted}`} />
            <strong>{counts.offline}</strong> Desconectadas
          </span>
        </div>

        <div className={styles.toolbarActions}>
          <button type="button" className={styles.addBtn} onClick={() => setShowAddModal(true)}>
            <BiPlus size={18} /> Agregar impresora
          </button>
        </div>
      </div>

      <AddPrinterModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={addPrinter}
        loading={printersLoading}
      />

      <DeletePrinterModal
        isOpen={!!printerToDelete}
        printer={printerToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPrinterToDelete(null)}
        loading={deleting}
      />

      {printers.length === 0 ? (
        <div className={styles.empty}>
          <BiPrinter size={28} />
          <p>No hay impresoras agregadas. Haz click en 'Agregar impresora' para comenzar.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {printers.map((printer) => (
            <PrinterCard 
              key={printer.id} 
              printer={printer}
              telemetry={telemetry}
              onDelete={setPrinterToDelete}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Granja
