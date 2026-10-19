import { useContext } from "react"
import { AuthContext } from "../contexts/auth.js"

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider")
  }
  return context
}
