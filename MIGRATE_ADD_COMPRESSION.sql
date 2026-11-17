-- Migración: Agregar soporte para compresión ZIP
-- Si ya tienes la tabla app_releases, ejecuta esto

-- Agregar columna original_size_bytes
ALTER TABLE app_releases ADD COLUMN IF NOT EXISTS original_size_bytes BIGINT;

-- Verificar que existe
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'app_releases' AND column_name LIKE '%size%'
ORDER BY ordinal_position;

-- Resultado esperado:
-- column_name          | data_type
-- ---------------------+-----------
-- file_size_bytes      | bigint
-- original_size_bytes  | bigint
