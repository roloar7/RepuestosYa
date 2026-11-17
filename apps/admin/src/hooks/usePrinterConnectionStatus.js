import { useEffect } from 'react'

/**
 * Hook para escuchar cambios de conexión de impresoras desde Electron
 * Actualiza el estado de is_connected cuando Electron conecta/desconecta
 */
export function usePrinterConnectionStatus(onStatusChange) {
  useEffect(() => {
    if (!window.electron?.onPrinterConnectionStatus) return

    const unsubscribe = window.electron.onPrinterConnectionStatus((data) => {
      console.log('[usePrinterConnectionStatus] Cambio de conexión:', data)
      onStatusChange?.(data)
    })

    return () => unsubscribe?.()
  }, [onStatusChange])
}
