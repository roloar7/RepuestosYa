import { useEffect } from 'react'

/**
 * Hook para inicializar Electron con variables de entorno de Supabase
 * Se ejecuta una sola vez al montar la app
 */
export function useElectronInit() {
  useEffect(() => {
    if (!window.electron?.app?.initSupabase) {
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      window.electron.app.initSupabase({
        supabaseUrl,
        supabaseKey,
      })
        .then(() => {
          console.log('[useElectronInit] Supabase inicializado en Electron')
        })
        .catch((err) => {
          console.error('[useElectronInit] Error:', err)
        })
    }
  }, [])
}
