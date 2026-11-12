import { useState, useEffect } from "react"
import { BiPlay, BiPlus, BiPrinter, BiTrash } from "react-icons/bi"
import { useAuthContext } from "../../../hooks/useAuthContext.js"
import { usePrinters } from "../../../hooks/usePrinters.js"
import { usePrinterTelemetry } from "../../../hooks/usePrinterTelemetry.js"
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

function PrinterCard({ printer, telemetry, onDelete }) {
  const data = telemetry[printer.id]
  
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
        <button
          type="button"
          className={styles.solidBtn}
          disabled={!data || data.gcode_state === 'IDLE'}
        >
          <BiPlay size={16} /> Imprimir
        </button>
      </footer>
    </article>
  )
}

function Granja() {
  const { user } = useAuthContext()
  const { printers, loading: printersLoading, addPrinter, deletePrinter } = usePrinters(user?.id)
  const telemetry = usePrinterTelemetry()
  const [showAddModal, setShowAddModal] = useState(false)
  const [printerToDelete, setPrinterToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Reconectar impresoras al cargar la página
  useEffect(() => {
    if (printers.length > 0 && window.electron?.printer?.connect) {
      console.log('[Granja] Reconectando impresoras guardadas...')
      printers.forEach((printer) => {
        if (printer.serial_number && printer.ip && printer.access_code) {
          console.log(`[Granja] Conectando a ${printer.name}...`)
          window.electron.printer.connect({
            id: printer.id,
            ip: printer.ip,
            access_code: printer.access_code,
            serial_number: printer.serial_number,
          }).catch((err) => {
            console.error(`[Granja] Error reconectando ${printer.name}:`, err)
          })
        }
      })
    }
  }, [printers])

  const counts = {
    printing: printers.filter((p) => {
      const data = telemetry[p.id]
      return data && (data.gcode_state === 'RUNNING' || data.gcode_state === 'PRINTING')
    }).length,
    idle: printers.filter((p) => {
      const data = telemetry[p.id]
      return data && (data.gcode_state === 'IDLE' || data.gcode_state === 'PAUSE')
    }).length,
    offline: printers.filter((p) => !telemetry[p.id]).length,
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Granja
