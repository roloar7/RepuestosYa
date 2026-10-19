import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@repuestos-ya/supabase"
import { useProfile } from "./useProfile.js"

export function useAuth() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const { profile, loading: profileLoading } = useProfile(user?.id)

  useEffect(() => {
    // Obtener sesión actual
    async function getSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setUser(session?.user || null)
      } catch (error) {
        console.error("Error getting session:", error)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null)
      if (event === "SIGNED_OUT") {
        navigate("/login")
      }
    })

    return () => subscription?.unsubscribe()
  }, [navigate])

  const login = async (email, password) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      setUser(data.user)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      navigate("/login")
    } catch (error) {
      console.error("Error signing out:", error)
    } finally {
      setLoading(false)
    }
  }

  // Solo mostrar modal de perfil si:
  // 1. User está autenticado
  // 2. Profile ha terminado de cargar
  // 3. El username no existe
  const needsProfile = !!user && !profileLoading && !profile?.username

  return {
    user,
    profile,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    needsProfile,
  }
}
