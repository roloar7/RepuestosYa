-- Tabla simplificada para releases
-- Solo guarda: versión, plataforma, URL de descarga, notas

CREATE TABLE IF NOT EXISTS app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'linux', 'macos')),
  download_url TEXT NOT NULL,
  release_notes TEXT,
  is_latest BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS: solo usuarios autenticados pueden leer
ALTER TABLE app_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read releases" ON app_releases;
DROP POLICY IF EXISTS "insert_releases" ON app_releases;
DROP POLICY IF EXISTS "update_releases" ON app_releases;

CREATE POLICY "Authenticated can read releases"
  ON app_releases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "insert_releases"
  ON app_releases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "update_releases"
  ON app_releases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_app_releases_version ON app_releases(version);
CREATE INDEX IF NOT EXISTS idx_app_releases_platform ON app_releases(platform);
CREATE INDEX IF NOT EXISTS idx_app_releases_is_latest ON app_releases(is_latest);
