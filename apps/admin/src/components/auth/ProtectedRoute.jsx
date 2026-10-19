import { Navigate } from "react-router-dom"
import { useAuthContext } from "../../hooks/useAuthContext.js"

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthContext()

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          height: "100vh",
          color: "var(--color-text-muted)",
        }}
      >
        Cargando...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
