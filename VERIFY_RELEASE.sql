-- Verificar que la release v1.0.0 existe en BD

-- Ver todas las releases
SELECT 
  version, 
  platform, 
  is_latest, 
  total_parts, 
  file_size_bytes,
  created_at
FROM app_releases
ORDER BY created_at DESC;

-- Ver específicamente v1.0.0
SELECT * FROM app_releases WHERE version = '1.0.0';

-- Contar cuántos archivos hay en Storage
-- (No se puede desde SQL, pero verifica manualmente en Supabase Dashboard → Storage)

-- Si la entrada existe pero is_latest = false, marcar como latest:
UPDATE app_releases 
SET is_latest = true 
WHERE version = '1.0.0' AND platform = 'windows';

-- Verificar después de update
SELECT version, is_latest FROM app_releases WHERE version = '1.0.0';
