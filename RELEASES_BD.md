# Gestión de Releases desde Supabase Storage

## Arquitectura

Las versiones de la app (Electron `.exe`) se almacenan en **Supabase Storage** en lugar de GitHub Releases. Esto permite:

✅ Descargas directas desde BD  
✅ Control de versiones centralizado  
✅ Versionado automático de clientes  
✅ No depender de GitHub Actions  

## Setup Supabase Storage

### 1. Crear bucket en Supabase

En Supabase Dashboard → Storage → Create a new bucket:

- **Name**: `app-releases`
- **Public**: ✅ (para descargas públicas)
- **File size limit**: 1GB

### 2. Crear tabla `app_releases`

Ejecuta en Supabase SQL Editor:

```sql
CREATE TABLE app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'linux', 'macos')),
  download_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  sha256_checksum TEXT,
  release_notes TEXT,
  is_latest BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE app_releases ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver releases (público)
CREATE POLICY "Anyone can view releases"
  ON app_releases FOR SELECT
  USING (true);

-- Crear índices
CREATE INDEX idx_app_releases_version ON app_releases(version);
CREATE INDEX idx_app_releases_platform ON app_releases(platform);
CREATE INDEX idx_app_releases_is_latest ON app_releases(is_latest);
```

## Flujo: Publicar una nueva versión

### Opción A: Manual (Admin panel)

1. Ve a `/administrador/releases` (solo admins)
2. Selecciona:
   - **Versión**: `1.0.0`
   - **Plataforma**: `windows` (genera `.exe`)
   - **Archivo**: descarga desde GitHub Releases o tu build local
   - **Notas**: cambios/mejoras
   - ☑️ "Marcar como versión más reciente"
3. Click **"Publicar Release"**

El panel:
- Sube archivo a Supabase Storage (`app-releases/windows/RepuestosYa-Admin-1.0.0.exe`)
- Calcula SHA256 (checksum)
- Guarda en tabla `app_releases` con URL pública
- Marca versiones anteriores como "no latest"

### Opción B: CLI (Supabase)

```bash
# 1. Subir archivo
supabase storage upload app-releases releases/windows/RepuestosYa-Admin-1.0.0.exe ./dist/RepuestosYa-Admin-1.0.0.exe

# 2. Agregar en BD vía Supabase CLI o API
curl -X POST https://your-project.supabase.co/rest/v1/app_releases \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -d '{
    "version": "1.0.0",
    "platform": "windows",
    "download_url": "https://storage.googleapis.com/...",
    "file_size_bytes": 123456789,
    "sha256_checksum": "abc123...",
    "release_notes": "Inicial release",
    "is_latest": true
  }'
```

## Flujo: Descargar cliente

### Electron App (embebido)
```javascript
// En DownloadElectron.jsx
const { release } = useAppRelease() // Obtiene desde BD
// Botón linkea a release.download_url (Supabase Storage)
```

### Usuario descarga `.exe`
1. Click botón "Descargar v1.0.0" en navbar
2. Browser descarga desde Supabase Storage
3. Usuario ejecuta installer
4. Electron verifica actualizaciones (próximo: electron-updater)

## Verificación de integridad

### SHA256 checksum

Cuando descargas, verificas integridad:

```bash
# Calcular SHA256 del archivo descargado
sha256sum RepuestosYa-Admin-1.0.0.exe

# Comparar con valor en BD
# Debe ser igual para verificar que no se corrompió
```

### En la app (futuro: electron-updater)

```javascript
const shaLocal = await calculateSHA256(downloadedFile)
const shaDB = release.sha256_checksum
if (shaLocal !== shaDB) {
  console.error("Archivo corrupto o modificado")
}
```

## Estructura de URLs en Storage

```
https://storage.googleapis.com/repuestos-ya-storage.appspot.com/
  storage/v1/b/repuestos-ya-storage.appspot.com/o/
  app-releases%2Fwindows%2FRepuestosYa-Admin-1.0.0.exe
  ?alt=media
```

Más simple: URL pública generada automáticamente:
```
https://supabaseurl.co/storage/v1/object/public/app-releases/windows/RepuestosYa-Admin-1.0.0.exe
```

## Administración de versiones

### Ver todas las versiones

```sql
SELECT version, platform, is_latest, file_size_bytes, created_at
FROM app_releases
ORDER BY created_at DESC;
```

### Cambiar versión "latest"

```sql
-- Desmarcar todas
UPDATE app_releases SET is_latest = false WHERE platform = 'windows';

-- Marcar como latest
UPDATE app_releases SET is_latest = true WHERE version = '1.0.0' AND platform = 'windows';
```

### Eliminar versión antigua

```sql
DELETE FROM app_releases WHERE version = '0.9.0' AND platform = 'windows';

-- También borrar archivo de Storage
-- En Supabase Dashboard → Storage → app-releases/windows → eliminar archivo
```

## Seguridad

### Storage Policies (RLS)

Las políticas actual permiten que cualquiera descargue. En producción, considera:

```sql
-- Solo lectura pública (descarga)
CREATE POLICY "Anyone can read releases"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-releases');

-- Solo admin sube
CREATE POLICY "Only admin can upload releases"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'app-releases' 
    AND auth.jwt()->>'role' = 'admin'
  );
```

### Supabase API Key

- Usar **anon key** público (solo lectura)
- Usar **service role key** privado (admin) para subidas

## Monitoreo

### Descargas desde Supabase Storage

En Supabase Dashboard → Storage → Bandwidth / Requests:
- Ver cuántas descargas hubo
- Monitorear uso de ancho de banda

### Alertas (futuro)

```sql
-- Crear una función para logging de descargas
CREATE TABLE download_logs (
  id BIGSERIAL PRIMARY KEY,
  release_id UUID REFERENCES app_releases(id),
  downloaded_at TIMESTAMP DEFAULT NOW(),
  user_ip TEXT,
  user_agent TEXT
);
```

## Migración desde GitHub Releases

Si ya tienes releases en GitHub:

1. Descargar `.exe` desde GitHub
2. Subir a Supabase Storage (admin panel o CLI)
3. Crear entrada en `app_releases` tabla
4. Actualizar `/DownloadElectron` para usar nueva URL

```bash
# Script para migrar automáticamente
# (futuro: crear helper script)
```

## Troubleshooting

### "Access denied" al subir

- Verificar bucket es **público**
- Verificar RLS policies permiten upload

### Archivo corrupto después de descargar

- Verificar SHA256 checksum
- Reintentar descarga
- Verificar espacio disponible en storage

### URL de descarga expira

- Supabase Storage URLs son **permanentes** (no expiran)
- Si cambias de bucket, URLs se rompen
- Solución: guardar URL en BD (ya hacemos esto)

## Ejemplo completo: Test

```bash
# 1. En admin panel: Publicar v1.0.0
# - Seleccionar build local: /apps/admin/dist-build/RepuestosYa-Admin-1.0.0.exe
# - Marcar como "latest"
# - Publicar

# 2. Verificar en BD
supabase db query
SELECT version, download_url, is_latest FROM app_releases;

# 3. Descargar desde URL pública
curl -O "https://supabaseurl.co/storage/v1/object/public/app-releases/windows/RepuestosYa-Admin-1.0.0.exe"

# 4. Verificar integridad
sha256sum RepuestosYa-Admin-1.0.0.exe
# Debe coincidir con sha256_checksum en BD

# 5. ¡Listo! Usuarios descargan desde botón en la app
```

---

**Ventajas sobre GitHub Releases:**
- ✅ Centralizado en Supabase (misma BD)
- ✅ Control de versiones en SQL
- ✅ Sin dependencia de GitHub Actions
- ✅ Escalable para múltiples plataformas
- ✅ Historial de descargas (analytics)
- ✅ Integración directa con React app
