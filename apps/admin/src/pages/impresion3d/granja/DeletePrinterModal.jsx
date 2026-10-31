import { BiX } from 'react-icons/bi'
import styles from './DeletePrinterModal.module.css'

// Icono de alerta
function AlertIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="1" fill="currentColor"/>
    </svg>
  )
}

export function DeletePrinterModal({ isOpen, printer, onConfirm, onCancel, loading }) {
  if (!isOpen || !printer) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <h2 className={styles.title}>Eliminar impresora</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            disabled={loading}
            aria-label="Cerrar"
          >
            <BiX size={24} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.warning}>
            <AlertIcon />
          </div>
          
          <p className={styles.message}>
            ¿Estás seguro que querés eliminar <strong>{printer.name}</strong>?
          </p>
          
          <p className={styles.details}>
            Se eliminará la impresora <code>{printer.ip}</code> de tu cuenta. Esta acción no se puede deshacer.
          </p>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </footer>
      </div>
    </div>
  )
}
