import { AuthContext } from "./auth.js"
import { useAuth } from "../hooks/useAuth.js"

export function AuthProvider({ children }) {
  const auth = useAuth()

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
