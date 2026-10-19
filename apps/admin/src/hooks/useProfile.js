import { useEffect, useState } from "react"
import { supabase } from "@repuestos-ya/supabase"
import { DEFAULT_USER_ROLE } from "../constants/userRoles.js"

async function createProfileInDB(uid) {
  // Usar upsert para evitar conflictos de duplicados
  const { data, error: err } = await supabase
    .from("profiles")
    .upsert(
      { id: uid, username: null, role: DEFAULT_USER_ROLE },
      { onConflict: "id" },
    )
    .select()
    .single()

  if (err) throw err
  return data
}

export function useProfile(userId) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchProfile() {
      try {
        setLoading(true)
        const { data, error: err } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()

        if (cancelled) return

        if (err) {
          // Si no existe el perfil, crear uno
          if (err.code === "PGRST116") {
            try {
              const newProfile = await createProfileInDB(userId)
              if (!cancelled) setProfile(newProfile)
            } catch (createErr) {
              // Si falla la creación (ej: ya existe), intenta fetchear de nuevo
              if (!cancelled) {
                const { data: existingData, error: fetchErr } = await supabase
                  .from("profiles")
                  .select("*")
                  .eq("id", userId)
                  .single()

                if (!fetchErr && existingData) {
                  setProfile(existingData)
                } else {
                  throw createErr
                }
              }
            }
          } else {
            throw err
          }
        } else {
          setProfile(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          console.error("Error fetching profile:", err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchProfile()

    return () => {
      cancelled = true
    }
  }, [userId])

  const updateUsername = async (username) => {
    if (!userId || !username?.trim()) return { success: false }

    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from("profiles")
        .update({ username: username.trim() })
        .eq("id", userId)
        .select()
        .single()

      if (err) throw err
      setProfile(data)
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  return {
    profile,
    loading,
    error,
    updateUsername,
  }
}
