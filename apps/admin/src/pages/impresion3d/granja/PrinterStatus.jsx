import { useState, useEffect } from 'react'
import { BiRefresh } from 'react-icons/bi'
import styles from './PrinterStatus.module.css'

/**
 * Componente que muestra el estado en tiempo real de una impresora
 * Obtiene temperatura, estado de impresión, etc. vía HTTP Bridge
 */
export function PrinterStatus({ printer, getPrinterStatus }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await getPrinterStatus(printer.ip, printer.access_code || '00000000')

      if (result.success) {
        setStatus(result)
        setLastUpdate(new Date())
      } else {
        setError(result.error)
      }
    } catch (err) {
      console.error('[PrinterStatus] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [printer.ip, printer.access_code])

  if (!status && !error) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Obteniendo estado...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p className={styles.errorText}>
            {error.includes('500') 
              ? 'No se pudo obtener el estado. Verifica que la impresora esté en línea.'
              : error}
          </p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={fetchStatus}
            disabled={loading}
          >
            <BiRefresh size={14} /> Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.statusGrid}>
        {/* Online Status */}
        <div className={styles.statusItem}>
          <span className={styles.label}>Estado</span>
          <span className={`${styles.value} ${status.online ? styles.online : styles.offline}`}>
            {status.online ? '🟢 Conectada' : '🔴 Desconectada'}
          </span>
        </div>

        {/* Temperatura */}
        {status.temperature !== null && (
          <div className={styles.statusItem}>
            <span className={styles.label}>Temperatura</span>
            <span className={styles.temperature}>
              {status.temperature}°C
            </span>
          </div>
        )}

        {/* Estado de impresión */}
        {status.state && (
          <div className={styles.statusItem}>
            <span className={styles.label}>Impresión</span>
            <span className={`${styles.state} ${styles[`state_${status.state}`]}`}>
              {status.state === 'printing' && '⏩ Imprimiendo'}
              {status.state === 'idle' && '⏸️ Disponible'}
              {status.state === 'paused' && '⏹️ Pausada'}
              {status.state === 'error' && '⚠️ Error'}
              {!['printing', 'idle', 'paused', 'error'].includes(status.state) && status.state}
            </span>
          </div>
        )}

        {/* Serial */}
        {status.serial && (
          <div className={styles.statusItem}>
            <span className={styles.label}>Serial</span>
            <span className={styles.serial}>{status.serial}</span>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.timestamp}>
          {lastUpdate && `Actualizado hace ${getTimeAgo(lastUpdate)}`}
        </span>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={fetchStatus}
          disabled={loading}
          title="Actualizar ahora"
        >
          <BiRefresh size={16} className={loading ? styles.spinning : ''} />
        </button>
      </div>
    </div>
  )
}

/**
 * Calcula tiempo transcurrido legible
 */
function getTimeAgo(date) {
  const now = new Date()
  const diff = now - date
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)

  if (seconds < 60) return 'hace unos segundos'
  if (minutes < 60) return `hace ${minutes} min`
  return 'hace más de una hora'
}
