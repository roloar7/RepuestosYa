import { useState, useEffect } from 'react'
import { supabase } from '@repuestos-ya/supabase'

/**
 * Hook para gestionar archivos de impresión 3D
 */
export function usePrintFiles(userId) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cargar archivos del usuario
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchFiles() {
      try {
        setLoading(true)
        const { data, error: err } = await supabase
          .from('print_files')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (err) throw err
        if (!cancelled) setFiles(data || [])
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          console.error('[usePrintFiles] Error:', err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchFiles()

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel(`print-files-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'print_files',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (!cancelled) fetchFiles()
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      channel.unsubscribe()
    }
  }, [userId])

  /**
   * Subir archivo a Supabase Storage
   */
  const uploadFile = async (file) => {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    try {
      const ext = file.name.toLowerCase().split('.').pop()
      if (ext !== '3mf' && ext !== 'gcode') {
        return { success: false, error: 'Solo se permiten archivos .3mf o .gcode' }
      }

      // Crear ruta única: user_id/timestamp-filename
      const timestamp = Date.now()
      const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `${userId}/${timestamp}-${filename}`

      console.log('[usePrintFiles] Subiendo archivo:', storagePath)

      // Subir a Storage
      const { error: uploadError } = await supabase.storage
        .from('print-files')
        .upload(storagePath, file)

      if (uploadError) throw uploadError

      // Guardar metadatos en BD
      const { data, error: dbError } = await supabase
        .from('print_files')
        .insert([
          {
            user_id: userId,
            filename: file.name,
            file_type: ext,
            file_size: file.size,
            storage_path: storagePath,
          },
        ])
        .select()
        .single()

      if (dbError) throw dbError

      console.log('[usePrintFiles] Archivo guardado:', data)
      return { success: true, file: data }
    } catch (err) {
      const errorMsg = err.message || 'Error al subir archivo'
      setError(errorMsg)
      console.error('[usePrintFiles] Error:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Eliminar archivo
   */
  const deleteFile = async (fileId, storagePath) => {
    try {
      // Eliminar de Storage
      const { error: deleteError } = await supabase.storage
        .from('print-files')
        .remove([storagePath])

      if (deleteError) throw deleteError

      // Eliminar de BD
      const { error: dbError } = await supabase
        .from('print_files')
        .delete()
        .eq('id', fileId)

      if (dbError) throw dbError

      console.log('[usePrintFiles] Archivo eliminado:', fileId)
      return { success: true }
    } catch (err) {
      const errorMsg = err.message || 'Error al eliminar archivo'
      setError(errorMsg)
      console.error('[usePrintFiles] Error:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Obtener URL de descarga firmada del archivo (solo usuarios autenticados)
   */
  const getFileUrl = async (storagePath) => {
    try {
      const { data, error } = await supabase.storage
        .from('print-files')
        .createSignedUrl(storagePath, 3600) // URL válida por 1 hora

      if (error) throw error
      return data.signedUrl
    } catch (err) {
      console.error('[usePrintFiles] Error getting signed URL:', err)
      return null
    }
  }

  return {
    files,
    loading,
    error,
    uploadFile,
    deleteFile,
    getFileUrl,
  }
}
