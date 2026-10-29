import { useState } from "react"
import styles from "./AddPrinterModal.module.css"

export function AddPrinterModal({ isOpen, onClose, onSubmit, loading }) {
  const [name, setName] = useState("")
  const [ip, setIp] = useState("")
  const [accessCode, setAccessCode] = useState("")
  const [error, setError] = useState(null)
  const [validating, setValidating] = useState(false)

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
      setValidating(true)

      const printerIp = ip.trim()
      const printerAccessCode = accessCode.trim() || "00000000"

      console.log("[AddPrinterModal] Validando impresora:", printerIp)

      // Intentar validar via HTTP Bridge (Node.js service en localhost:8787)
      try {
        const bridgeResponse = await fetch("http://localhost:8787/printers/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ip: printerIp,
            name: name.trim(),
            accessCode: printerAccessCode,
          }),
        })

        const bridgeResult = await bridgeResponse.json()

        if (!bridgeResponse.ok) {
          console.warn("[AddPrinterModal] Bridge validation error:", bridgeResult.error)
          setError(`No se pudo conectar a la impresora: ${bridgeResult.error}`)
          return
        }

        console.log("[AddPrinterModal] Impresora validada via HTTP Bridge:", bridgeResult)
      } catch (bridgeErr) {
        // Si el bridge no está disponible, intentar validar via Electron MQTT (fallback)
        console.warn("[AddPrinterModal] HTTP Bridge no disponible, intentando Electron MQTT...")

        if (window.electron?.bridge?.validatePrinter) {
          const result = await window.electron.bridge.validatePrinter(
            name.trim(),
            printerIp,
            printerAccessCode
          )

          if (!result.success) {
            setError(result.error || "Error al validar la impresora")
            return
          }

          console.log("[AddPrinterModal] Impresora validada via Electron:", result)
        } else {
          console.warn("[AddPrinterModal] Ni HTTP Bridge ni Electron disponibles")
          // En web, permitir agregar sin validar
          if (!window.electron) {
            console.log("[AddPrinterModal] En web, agregando sin validación")
          } else {
            setError("No se puede validar: bridge no disponible")
            return
          }
        }
      }

      // Guardar en BD via onSubmit
      const { success, error: submitError } = await onSubmit(name, printerIp, printerAccessCode)

      if (success) {
        setName("")
        setIp("")
        setAccessCode("")
        setError(null)
        onClose()
      } else {
        setError(submitError)
      }
    } catch (err) {
      console.error("[AddPrinterModal] Error:", err)
      setError(err.message || "Error inesperado")
    } finally {
      setValidating(false)
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
              Dirección IP
            </label>
            <input
              id="printer-ip"
              type="text"
              className={styles.input}
              placeholder="ej: 192.168.1.100"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              disabled={loading || validating}
            />
            <p className={styles.hint}>
              IP local en la red (ej: 192.168.1.100)
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
              disabled={loading || validating}
            >
              {validating ? "Conectando..." : loading ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
