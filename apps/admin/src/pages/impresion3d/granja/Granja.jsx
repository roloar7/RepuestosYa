import { useState, useMemo } from "react"
import { BiPlay, BiPlus, BiPrinter, BiTrash, BiPause, BiStopCircle } from "react-icons/bi"
import { useAuthContext } from "../../../hooks/useAuthContext.js"
import { usePrinters } from "../../../hooks/usePrinters.js"
import { usePrinterRealtimeTelemetry } from "../../../hooks/usePrinterRealtimeTelemetry.js"
import { AddPrinterModal } from "./AddPrinterModal.jsx"
import { DeletePrinterModal } from "./DeletePrinterModal.jsx"

import styles from "./Granja.module.css"

const statusMeta = {
  printing: { label: "Imprimiendo", tone: "accent" },
  paused: { label: "Pausada", tone: "warning" },
  idle: { label: "Disponible", tone: "success" },
  offline: { label: "Desconectada", tone: "muted" },
  error: { label: "Error", tone: "danger" },
}

// Fuente única para el estado de la impresora
function getEffectiveStatus(printer, data) {
  if (data && data.is_connected !== false) {
    if (data.status && statusMeta[data.status]) return data.status

    const gcode = data.gcode_state
    if (gcode === "RUNNING" || gcode === "PRINTING" || gcode === "PREPARE") return "printing"
    if (gcode === "PAUSE") return "paused"
    if (gcode === "IDLE" || gcode === "FINISH" || gcode === "FAILED") return "idle"
  }

  if (data && data.is_connected === false) return "offline"
  if (statusMeta[printer.status]) return printer.status

  return "offline"
}

function StatusBadge({ status }) {
  const meta = statusMeta[status] || statusMeta.offline
  return (
    <span className={`${styles.badge} ${styles[`tone_${meta.tone}`]}`}>
      <span className={styles.badgeDot} />
      {meta.label}
    </span>
  )
}

function PrinterCard({ printer, data, onDelete, onPause, onResume, onStop }) {
  const status = getEffectiveStatus(printer, data)
  const isOnline = status !== "offline"
  const isPrinting = status === "printing"
  const isPaused = status === "paused"
  const [commandLoading, setCommandLoading] = useState(null)

  const handleAction = async (actionName, handler) => {
    setCommandLoading(actionName)
    try {
      await handler(printer.id)
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
        <StatusBadge status={status} />
      </header>

      <div className={styles.cardBody}>
        {isOnline && data ? (
          <div className={styles.telemetry}>
            <div className={styles.tempItem}>
              <span className={styles.tempLabel}>Nozzle</span>
              <span className={styles.tempValue}>{data.nozzle_temp ?? 0}°C</span>
            </div>
            <div className={styles.tempItem}>
              <span className={styles.tempLabel}>Cama</span>
              <span className={styles.tempValue}>{data.bed_temp ?? 0}°C</span>
            </div>
            <div className={styles.tempItem}>
              <span className={styles.tempLabel}>Progreso</span>
              <span className={styles.tempValue}>{data.progress ?? 0}%</span>
            </div>
          </div>
        ) : (
          <p className={styles.idleText}>
            {status === "offline" ? "Sin conexión con la impresora." : "Esperando conexión..."}
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
              onClick={() => handleAction("pause", onPause)}
              disabled={commandLoading === "pause"}
              title="Pausar impresión"
            >
              <BiPause size={16} /> Pausar
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => handleAction("stop", onStop)}
              disabled={commandLoading === "stop"}
              title="Detener impresión"
            >
              <BiStopCircle size={16} /> Detener
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              type="button"
              className={styles.successBtn}
              onClick={() => handleAction("resume", onResume)}
              disabled={commandLoading === "resume"}
              title="Reanudar impresión"
            >
              <BiPlay size={16} /> Reanudar
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => handleAction("stop", onStop)}
              disabled={commandLoading === "stop"}
              title="Detener impresión"
            >
              <BiStopCircle size={16} /> Detener
            </button>
          </>
        )}

        {!isPrinting && !isPaused && (
          <button
            type="button"
            className={styles.solidBtn}
            disabled={status !== "idle"}
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

  // Estabilizar el array de IDs para evitar re-suscripciones en cada render
  const printerIds = useMemo(() => printers.map((p) => p.id), [printers])
  const telemetry = usePrinterRealtimeTelemetry(printerIds)

  const [showAddModal, setShowAddModal] = useState(false)
  const [printerToDelete, setPrinterToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Contadores calculados exactamente con la misma función de estado
  const counts = useMemo(() => {
    return printers.reduce(
      (acc, p) => {
        const status = getEffectiveStatus(p, telemetry[p.id])
        if (status === "printing" || status === "paused") acc.printing += 1
        else if (status === "idle") acc.idle += 1
        else acc.offline += 1
        return acc
      },
      { printing: 0, idle: 0, offline: 0 }
    )
  }, [printers, telemetry])

  const handleDeleteConfirm = async () => {
    if (!printerToDelete) return
    try {
      setDeleting(true)
      const result = await deletePrinter(printerToDelete.id)
      if (result.success) setPrinterToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const handlePause = async (printerId) => {
    await window.electron?.ipcRenderer?.invoke("printer:pause", printerId)
  }

  const handleResume = async (printerId) => {
    await window.electron?.ipcRenderer?.invoke("printer:resume", printerId)
  }

  const handleStop = async (printerId) => {
    await window.electron?.ipcRenderer?.invoke("printer:stop", printerId)
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
              data={telemetry[printer.id]}
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