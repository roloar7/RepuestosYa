import { useState, useEffect } from 'react'
import { supabase } from '@repuestos-ya/supabase'

/**
 * Hook para monitorear el estado del bridge en tiempo real
 * Escucha telemetría de impresoras y actualiza estado en Supabase
 */
export function useBridgeStatus() {
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let updateTimeout = null

    // Cargar estado inicial de BD al montar el componente
    fetchInitialStatus()

    // Escuchar telemetría de impresoras
    if (window.electron?.onPrinterStatus) {
      const unsubscribe = window.electron.onPrinterStatus((data) => {
        console.log('[useBridgeStatus] Telemetría recibida, bridge conectado')
        
        if (!cancelled) {
          setBridgeConnected(true)
        }

        // Actualizar BD cada vez que recibe datos
        updateBridgeStatusInDB(true)

        // Reset: si no recibe datos por 5 segundos, marcar como desconectado
        clearTimeout(updateTimeout)
        updateTimeout = setTimeout(() => {
          if (!cancelled) {
            console.log('[useBridgeStatus] Sin telemetría por 5 segundos, marcando como desconectado')
            setBridgeConnected(false)
            updateBridgeStatusInDB(false)
          }
        }, 5000)
      })

      return () => {
        cancelled = true
        clearTimeout(updateTimeout)
        unsubscribe?.()
      }
    }

    return () => {
      cancelled = true
      clearTimeout(updateTimeout)
    }
  }, [])

  async function fetchInitialStatus() {
    try {
      console.log('[useBridgeStatus] Cargando estado inicial desde BD...')
      const { data, error } = await supabase
        .from('bridge_status')
        .select('is_connected')
        .single()

      if (error) throw error
      
      const isConnected = data?.is_connected ?? false
      console.log('[useBridgeStatus] Estado inicial cargado:', isConnected)
      setBridgeConnected(isConnected)
      setLoading(false)
    } catch (err) {
      console.error('[useBridgeStatus] Error cargando estado inicial:', err)
      setBridgeConnected(false)
      setLoading(false)
    }
  }

  async function updateBridgeStatusInDB(isConnected) {
    try {
      // Solo actualizar si cambió
      const { error } = await supabase
        .from('bridge_status')
        .update({
          is_connected: isConnected,
          last_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)

      if (error) {
        console.error('[useBridgeStatus] Error actualizando BD:', error)
      } else {
        console.log('[useBridgeStatus] BD actualizada:', isConnected)
      }
    } catch (err) {
      console.error('[useBridgeStatus] Error:', err)
    }
  }

  return { bridgeConnected, loading }
}
