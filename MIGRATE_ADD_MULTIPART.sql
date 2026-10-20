-- Migración: Agregar soporte para descargas multipart
-- Si ya tienes la tabla app_releases, ejecuta esto

-- Agregar columna total_parts
ALTER TABLE app_releases ADD COLUMN IF NOT EXISTS total_parts INTEGER DEFAULT 1;

-- Verificar que existe
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'app_releases' AND column_name = 'total_parts'
ORDER BY ordinal_position;

-- Resultado esperado:
-- column_name   | data_type | column_default
-- ---------------+-----------+----------------
-- total_parts   | integer   | 1
