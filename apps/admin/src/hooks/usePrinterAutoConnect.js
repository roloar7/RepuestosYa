import { useEffect, useRef } from 'react'

/**
 * Hook global para conectar impresoras automáticamente al arrancar la app
 * Se ejecuta UNA SOLA VEZ cuando se carga la lista de impresoras
 * No se ejecuta en cada navegación
 */
export function usePrinterAutoConnect(printers) {
  const hasConnected = useRef(false)

  useEffect(() => {
    // Si ya hemos conectado una vez, no volver a conectar
    if (hasConnected.current) {
      return
    }

    if (!printers || printers.length === 0 || !window.electron?.printer?.connect) {
      return
    }

    // Marcar como desconectado y despues valida
    hasConnected.current = false

    console.log(`[usePrinterAutoConnect] Intentando conectar ${printers.length} impresoras...`)

    printers.forEach((printer) => {
      // Solo conectar si tiene los datos necesarios
      if (printer.serial_number && printer.ip && printer.access_code) {
        console.log(`[usePrinterAutoConnect] Iniciando conexión a ${printer.name} (${printer.ip})...`)
        
        // Intentar conectar con protocolo y credenciales correctas
        window.electron.printer.connect({
          id: printer.id,
          name: printer.name,
          ip: printer.ip,
          protocol: printer.protocol || 'bambu_lan',
          credentials: {
            access_code: printer.access_code,
            serial_number: printer.serial_number,
          },
        }).catch((err) => {
          console.error(`[usePrinterAutoConnect] Error en ${printer.name}:`, err.message)
        })
      }
    })

    // Se ejecuta solo una vez cuando printers se carga por primera vez
  }, [printers?.length]) // ← Se ejecuta cuando se carga la lista de impresoras
}
