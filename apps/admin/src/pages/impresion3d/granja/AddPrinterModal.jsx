import { useState } from "react"
import styles from "./AddPrinterModal.module.css"

export function AddPrinterModal({ isOpen, onClose, onSubmit, loading }) {
  const [name, setName] = useState("")
  const [ip, setIp] = useState("")
  const [accessCode, setAccessCode] = useState("")
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("El nombre de la impresora es requerido")
      return
    }

    if (!ip.trim()) {
      setError("La IP es requerida")
      return
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+\.ts\.net$/
    if (!ipRegex.test(ip.trim())) {
      setError("IP o dominio Tailscale inválido (ej: 192.168.1.100 o printer.ts.net)")
      return
    }

    const { success, error: submitError } = await onSubmit(name, ip, accessCode)

    if (success) {
      setName("")
      setIp("")
      setAccessCode("")
      setError(null)
      onClose()
    } else {
      setError(submitError)
    }
  }

  const handleClose = () => {
    setName("")
    setIp("")
    setAccessCode("")
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <h2 className={styles.title}>Agregar impresora</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="printer-name" className={styles.label}>
              Nombre de la impresora
            </label>
            <input
              id="printer-name"
              type="text"
              className={styles.input}
              placeholder="ej: A1 mini Nave 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="printer-ip" className={styles.label}>
              Dirección IP o Tailscale DNS
            </label>
            <input
              id="printer-ip"
              type="text"
              className={styles.input}
              placeholder="ej: 192.168.1.100 o printer-1.tailxxx.ts.net"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              disabled={loading}
            />
            <p className={styles.hint}>
              IP local (192.168.x.x) o nombre Tailscale MagicDNS (printer.ts.net)
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="printer-access-code" className={styles.label}>
              Código de Acceso MQTT (opcional)
            </label>
            <input
              id="printer-access-code"
              type="password"
              className={styles.input}
              placeholder="ej: 0000 (si la impresora lo requiere)"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              disabled={loading}
            />
            <p className={styles.hint}>
              Código de 4 dígitos de Bambu Lab si es requerido
            </p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? "Validando..." : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
