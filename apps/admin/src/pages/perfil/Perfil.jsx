import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthContext } from "../../hooks/useAuthContext.js"
import { useProfile } from "../../hooks/useProfile.js"
import styles from "./Perfil.module.css"

export default function Perfil() {
  const navigate = useNavigate()
  const { user, logout } = useAuthContext()
  const { profile, loading, updateUsername, error: profileError } = useProfile(
    user?.id,
  )

  const [isEditing, setIsEditing] = useState(false)
  const [editUsername, setEditUsername] = useState(profile?.username || "")
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const userEmail = user?.email || "Usuario"
  const userInitials = userEmail.substring(0, 2).toUpperCase()

  const handleSaveUsername = async () => {
    setError(null)
    setSuccess(false)

    if (!editUsername.trim()) {
      setError("El nombre de usuario no puede estar vacío")
      return
    }

    if (editUsername.trim().length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres")
      return
    }

    const { success: updateSuccess, error: updateError } = await updateUsername(
      editUsername,
    )

    if (updateSuccess) {
      setSuccess(true)
      setIsEditing(false)
      setTimeout(() => setSuccess(false), 3000)
    } else {
      setError(updateError || "Error al actualizar el perfil")
    }
  }

  const handleCancel = () => {
    setEditUsername(profile?.username || "")
    setIsEditing(false)
    setError(null)
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.avatarContainer}>
            <div className={styles.largeAvatar}>{userInitials}</div>
          </div>
          <h1 className={styles.title}>Mi Perfil</h1>
          <p className={styles.subtitle}>{userEmail}</p>
        </div>

        {/* Sección de Información */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Información Personal</h2>

          <div className={styles.infoGroup}>
            <label className={styles.label}>Email</label>
            <div className={styles.value}>{userEmail}</div>
          </div>
        </div>

        {/* Sección de Usuario */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Nombre de Usuario</h2>

          {isEditing ? (
            <div className={styles.formGroup}>
              <label htmlFor="username" className={styles.label}>
                Nombre de Usuario
              </label>
              <input
                id="username"
                type="text"
                className={styles.input}
                placeholder="tu_usuario"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                disabled={loading}
                minLength={3}
                maxLength={30}
              />
              <p className={styles.hint}>
                Entre 3 y 30 caracteres. Solo letras, números y guiones.
              </p>

              {(error || profileError) && (
                <div className={styles.error}>{error || profileError}</div>
              )}

              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={handleSaveUsername}
                  disabled={loading}
                >
                  {loading ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.infoGroup}>
              <label className={styles.label}>Usuario Actual</label>
              <div className={styles.value}>
                {profile?.username || "No definido"}
              </div>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => setIsEditing(true)}
                style={{ marginTop: "var(--space-3)" }}
              >
                Editar
              </button>
            </div>
          )}

          {success && (
            <div className={styles.success}>
              ✓ Nombre de usuario actualizado correctamente
            </div>
          )}
        </div>

        {/* Sección de Acciones */}
        <div className={styles.section}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => {
              logout()
              navigate("/login")
            }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  )
}
