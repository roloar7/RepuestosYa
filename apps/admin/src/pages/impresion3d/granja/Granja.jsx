import { useState, useEffect } from "react"
import { BiPlay, BiPlus, BiPrinter, BiSearch, BiTrash } from "react-icons/bi"
import { useAuthContext } from "../../../hooks/useAuthContext.js"
import { usePrinters } from "../../../hooks/usePrinters.js"
import { AddPrinterModal } from "./AddPrinterModal.jsx"
import { DeletePrinterModal } from "./DeletePrinterModal.jsx"
import { PrinterStatus } from "./PrinterStatus.jsx"
import styles from "./Granja.module.css"

const statusMeta = {
  printing: { label: "Imprimiendo", tone: "accent" },
  idle: { label: "Disponible", tone: "success" },
  offline: { label: "Desconectada", tone: "muted" },
  error: { label: "Error", tone: "danger" },
}

function StatusBadge({ status }) {
  const meta = statusMeta[status]
  return (
    <span className={`${styles.badge} ${styles[`tone_${meta.tone}`]}`}>
      <span className={styles.badgeDot} />
      {meta.label}
    </span>
  )
}

function PrinterCard({ printer, onDelete, getPrinterStatus }) {
  const [expanded, setExpanded] = useState(false)

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
        <StatusBadge status={printer.status} />
      </header>

      <div className={styles.cardBody}>
        <p className={styles.idleText}>
          {printer.status === "offline"
            ? "Sin conexión con la impresora."
            : "Lista para recibir un trabajo."}
        </p>

        {expanded && getPrinterStatus && (
          <div className={styles.statusSection}>
            <PrinterStatus printer={printer} getPrinterStatus={getPrinterStatus} />
          </div>
        )}
      </div>

      <footer className={styles.cardFoot}>
        <button 
          type="button" 
          className={styles.ghostBtn}
          onClick={() => setExpanded(!expanded)}
          title={expanded ? "Ocultar estado" : "Ver estado"}
        >
          {expanded ? "⬆️" : "⬇️"} Estado
        </button>
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
          disabled={printer.status === "offline"}
        >
          <BiPlay size={16} /> Imprimir
        </button>
      </footer>
    </article>
  )
}

function Granja() {
  const { user } = useAuthContext()
  const { printers, loading: printersLoading, addPrinter, deletePrinter, getPrinterStatus } = usePrinters(user?.id)
  const [query, setQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [printerToDelete, setPrinterToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = printers.filter((printer) =>
    `${printer.name} ${printer.ip}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  )

  const counts = {
    printing: printers.filter((p) => p.status === "printing").length,
    idle: printers.filter((p) => p.status === "idle").length,
    offline: printers.filter((p) => p.status === "offline").length,
  }

  const handleDeleteConfirm = async () => {
    if (!printerToDelete) return
    
    try {
      setDeleting(true)
      const result = await deletePrinter(printerToDelete.id)
      
      if (result.success) {
        setPrinterToDelete(null)
      } else {
        console.error("Error al eliminar:", result.error)
      }
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
          <label className={styles.search}>
            <BiSearch size={16} />
            <input
              type="search"
              placeholder="Buscar impresora..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
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

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <BiPrinter size={28} />
          <p>
            {printers.length === 0
              ? "No hay impresoras agregadas. Haz click en 'Agregar impresora' para comenzar."
              : `No se encontraron impresoras con «${query}».`}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((printer) => (
            <PrinterCard 
              key={printer.id} 
              printer={printer}
              onDelete={setPrinterToDelete}
              getPrinterStatus={getPrinterStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Granja
