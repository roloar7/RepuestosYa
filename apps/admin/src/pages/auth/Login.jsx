import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthContext } from "../../hooks/useAuthContext.js"
import logoSrc from "../../assets/Logo.svg"
import styles from "./Login.module.css"

export default function Login() {
  const navigate = useNavigate()
  const { login, loading } = useAuthContext()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!formData.email || !formData.password) {
      setError("Email y contraseña son requeridos")
      return
    }

    const { success, error: loginError } = await login(
      formData.email,
      formData.password,
    )

    if (success) {
      navigate("/")
    } else {
      setError(loginError || "Error al iniciar sesión")
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img src={logoSrc} alt="RepuestosYa" className={styles.logo} />
          <h1 className={styles.title}>RepuestosYa</h1>
          <p className={styles.subtitle}>Panel de Administración</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              className={styles.input}
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              name="password"
              className={styles.input}
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>
        </form>

        <div className={styles.footer}>
          <p>Panel restringido, solo usuarios autorizados</p>
        </div>
      </div>
    </div>
  )
}
