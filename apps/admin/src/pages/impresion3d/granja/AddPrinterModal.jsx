import { useState } from "react"
import styles from "./AddPrinterModal.module.css"

export function AddPrinterModal({ isOpen, onClose, onSubmit, loading }) {
  const [name, setName] = useState("")
  const [ip, setIp] = useState("")
  const [accessCode, setAccessCode] = useState("")
  const [serialNumber, setSerialNumber] = useState("")
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

    // Validar formato de IP (IPv4 o hostname)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+$/
    if (!ipRegex.test(ip.trim())) {
      setError("IP o hostname inválido (ej: 192.168.1.100 o printer-1)")
      return
    }

    try {
      const printerIp = ip.trim()
      const printerAccessCode = accessCode.trim() || "00000000"
      const printerSerialNumber = serialNumber.trim()

      console.log("[AddPrinterModal] Agregando impresora:", printerIp)

      // Guardar en BD via onSubmit
      // La conexión MQTT se hace automáticamente en Electron si tiene serial number
      const { success, error: submitError } = await onSubmit(
        name,
        printerIp,
        printerAccessCode,
        printerSerialNumber
      )

      if (success) {
        setName("")
        setIp("")
        setAccessCode("")
        setSerialNumber("")
        setError(null)
        onClose()
      } else {
        setError(submitError)
      }
    } catch (err) {
      console.error("[AddPrinterModal] Error:", err)
      setError(err.message || "Error inesperado")
    }
  }

  const handleClose = () => {
    setName("")
    setIp("")
    setAccessCode("")
    setSerialNumber("")
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="printer-ip" className={styles.label}>
              Dirección IP
            </label>
            <input
              id="printer-ip"
              type="text"
              className={styles.input}
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="printer-access-code" className={styles.label}>
              Código de Acceso MQTT
            </label>
            <input
              id="printer-access-code"
              type="password"
              className={styles.input}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="printer-serial" className={styles.label}>
              Número de Serie
            </label>
            <input
              id="printer-serial"
              type="text"
              className={styles.input}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              disabled={loading}
            />
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
              {loading ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
