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
  const [retries, setRetries] = useState(0)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log(`[PrinterStatus] Obteniendo estado de ${printer.ip}... (intento ${retries + 1})`)

      const result = await getPrinterStatus(printer.ip, printer.access_code || '00000000')

      if (result.success) {
        setStatus(result)
        setLastUpdate(new Date())
        setRetries(0) // Reset retries on success
      } else {
        setError(result.error)
        setRetries((prev) => prev + 1)
      }
    } catch (err) {
      console.error('[PrinterStatus] Error:', err)
      setError(err.message)
      setRetries((prev) => prev + 1)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh cada 30 segundos (solo si no hay error)
  // Max 3 reintentos antes de parar
  useEffect(() => {
    if (retries >= 3) {
      console.log('[PrinterStatus] Max retries alcanzados, deteniendo intentos')
      return
    }

    fetchStatus()
    
    // Solo hacer auto-refresh si está funcionando y retries < 3
    let interval
    if (!error && retries < 3) {
      interval = setInterval(fetchStatus, 30000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [printer.ip, printer.access_code, retries])

  if (!status && !error) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Obteniendo estado...</p>
      </div>
    )
  }

  if (error) {
    const maxRetriesReached = retries >= 3
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p className={styles.errorText}>
            {error.includes('Timeout') 
              ? '⏱️ Timeout: la impresora no responde en tiempo. Verifica que esté en línea y el puerto 8883 esté abierto.'
              : error.includes('500') 
              ? '❌ Error en el bridge MQTT. Verifica el access code.'
              : error}
          </p>
          {!maxRetriesReached && (
            <button
              type="button"
              className={styles.retryBtn}
              onClick={fetchStatus}
              disabled={loading}
            >
              <BiRefresh size={14} /> Reintentar ({3 - retries})
            </button>
          )}
          {maxRetriesReached && (
            <p className={styles.hintText}>
              Se alcanzó el máximo de reintentos. La impresora probablemente no está disponible.
            </p>
          )}
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
