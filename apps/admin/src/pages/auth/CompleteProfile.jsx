import { useState } from "react"
import { useProfile } from "../../hooks/useProfile.js"
import styles from "./CompleteProfile.module.css"

export function CompleteProfile({ userId, onComplete }) {
  const { updateUsername, loading, error: profileError } = useProfile(userId)
  const [username, setUsername] = useState("")
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!username.trim()) {
      setError("El nombre de usuario es requerido")
      return
    }

    if (username.trim().length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres")
      return
    }

    const { success, error: updateError } = await updateUsername(username)

    if (success) {
      onComplete()
    } else {
      setError(updateError || "Error al guardar el perfil")
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h1 className={styles.title}>Completar Perfil</h1>
          <p className={styles.subtitle}>
            Ingresa tu nombre de usuario para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>
              Nombre de Usuario
            </label>
            <input
              id="username"
              type="text"
              className={styles.input}
              placeholder="tu_usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
              minLength={3}
              maxLength={30}
            />
            <p className={styles.hint}>
              Entre 3 y 30 caracteres. Solo letras, números y guiones.
            </p>
          </div>

          {(error || profileError) && (
            <div className={styles.error}>{error || profileError}</div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? "Guardando..." : "Continuar"}
          </button>
        </form>
      </div>
    </div>
  )
}
