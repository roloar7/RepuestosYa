import { useState, useEffect } from "react"
import {
  PlayIcon,
  PlusIcon,
  PrinterIcon,
  SearchIcon,
} from "../../../components/icons.jsx"
import { useAuthContext } from "../../../hooks/useAuthContext.js"
import { usePrinters } from "../../../hooks/usePrinters.js"
import { AddPrinterModal } from "./AddPrinterModal.jsx"
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

function PrinterCard({ printer }) {

  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <span className={styles.cardIcon}>
          <PrinterIcon />
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
      </div>

      <footer className={styles.cardFoot}>
        <button type="button" className={styles.ghostBtn}>
          Detalle
        </button>
        <button
          type="button"
          className={styles.solidBtn}
          disabled={printer.status === "offline"}
        >
          <PlayIcon size={16} /> Imprimir
        </button>
      </footer>
    </article>
  )
}

function Granja() {
  const { user } = useAuthContext()
  const { printers, loading: printersLoading, addPrinter } = usePrinters(user?.id)
  const [query, setQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)

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
            <SearchIcon size={16} />
            <input
              type="search"
              placeholder="Buscar impresora..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button type="button" className={styles.addBtn} onClick={() => setShowAddModal(true)}>
            <PlusIcon size={18} /> Agregar impresora
          </button>
        </div>
      </div>

      <AddPrinterModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={addPrinter}
        loading={printersLoading}
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <PrinterIcon size={28} />
          <p>
            {printers.length === 0
              ? "No hay impresoras agregadas. Haz click en 'Agregar impresora' para comenzar."
              : `No se encontraron impresoras con «${query}».`}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((printer) => (
            <PrinterCard key={printer.id} printer={printer} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Granja
