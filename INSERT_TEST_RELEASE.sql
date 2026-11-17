-- SQL para agregar una release de test
-- Ejecuta esto en Supabase SQL Editor

-- Opción 1: Con URL dummy (para test)
INSERT INTO app_releases (version, platform, download_url, file_size_bytes, sha256_checksum, release_notes, is_latest)
VALUES (
  '1.0.0',
  'windows',
  'https://storage.googleapis.com/test/RepuestosYa-Admin-1.0.0.exe',
  123456789,
  'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
  'Release inicial de prueba',
  true
)
ON CONFLICT (version) DO UPDATE SET
  is_latest = true,
  updated_at = CURRENT_TIMESTAMP;

-- Opción 2: Con URL real de Supabase Storage (cuando tengas archivo subido)
-- INSERT INTO app_releases (version, platform, download_url, file_size_bytes, sha256_checksum, release_notes, is_latest)
-- VALUES (
--   '1.0.0',
--   'windows',
--   'https://tuproyecto.supabase.co/storage/v1/object/public/app-releases/releases/windows/RepuestosYa-Admin-1.0.0.exe',
--   123456789,
--   'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
--   'Release inicial',
--   true
-- );

-- Verificar que se insertó
SELECT version, platform, is_latest, download_url FROM app_releases WHERE platform = 'windows' ORDER BY created_at DESC;
