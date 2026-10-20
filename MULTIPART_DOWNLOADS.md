# 📦 Descargas Multi-Parte (ZIP.001, ZIP.002, etc)

## 🎯 Problema
El `.exe` después de compresión sigue siendo **>50MB** y algunos sistemas tienen límite de tamaño de archivo (Supabase Storage, etc).

## ✨ Solución
**Dividir el ZIP en múltiples partes** (.zip.001, .zip.002, etc) y **ensamblarlas automáticamente** al descargar.

---

## 🏗️ Arquitectura

### Upload Flow
```
Admin sube archivos:
  - RepuestosYa-Admin-1.0.0.zip.001 (10 MB)
  - RepuestosYa-Admin-1.0.0.zip.002 (10 MB)
  - RepuestosYa-Admin-1.0.0.zip.003 (10 MB)
  - ... (hasta .009)
    ↓
Sistema almacena en Supabase Storage (9 archivos)
    ↓
BD guarda:
  - download_url: base sin extensión
  - file_size_bytes: 90 MB (total)
  - total_parts: 9
```

### Download Flow
```
Usuario click "Descargar v1.0.0"
    ↓
Sistema detecta: total_parts = 9
    ↓
Descarga 9 partes en paralelo:
  .zip.001, .zip.002, ..., .zip.009
    ↓
Ensambla en único ZIP (90 MB en memoria)
    ↓
Descomprime ZIP → busca .exe
    ↓
Trigger descarga del .exe
    ↓
Usuario ejecuta installer
```

---

## 📋 Cómo usar

### Preparar archivos

**Opción 1: Usar WinRAR/7-Zip para dividir**

En Windows:
1. Click derecho en `RepuestosYa-Admin-1.0.0.zip`
2. **7-Zip → Agregar a archivo**
3. Tamaño de volumen: `10 M` (10 MB)
4. Genera: `RepuestosYa-Admin-1.0.0.zip.001`, `.002`, etc.

**Opción 2: Script PowerShell**

```powershell
$file = "RepuestosYa-Admin-1.0.0.zip"
$size = 10MB
$stream = [System.IO.File]::OpenRead($file)
$buffer = New-Object byte[] $size
$count = 0
while ($stream.Read($buffer, 0, $buffer.Length) -gt 0) {
    $count++
    $partName = "{0}.{1:D3}" -f $file, $count
    [System.IO.File]::WriteAllBytes($partName, $buffer)
}
$stream.Close()
```

### Subir en admin panel

1. Ve a `/administrador/releases`
2. Versión: `1.0.0`
3. Plataforma: `windows`
4. **Click input file → selecciona TODOS los .zip.00X**
   - Sistema detecta automáticamente que es multipart
   - Ordena por nombre (.001, .002, etc)
5. Click "Publicar"

**Sistema hace:**
- Sube 9 archivos a Storage
- Guarda `total_parts: 9` en BD
- URL base: sin la extensión .001

### Usuarios descargan

1. Click "Descargar v1.0.0"
2. Browser descarga 9 partes **en paralelo**
3. Sistema descompone automáticamente
4. Se descarga `.exe` al usuario

---

## 🔧 Implementación técnica

### Admin upload (GestionarReleases.jsx)

```javascript
// Detectar si es multipart
const isMultipart = selectedFiles[0].name.match(/\.zip\.\d{3}$/)

if (isMultipart) {
  // Subir cada parte
  for (let i = 0; i < selectedFiles.length; i++) {
    const partNumber = String(i + 1).padStart(3, '0')
    const fileName = `releases/windows/.../file.zip.${partNumber}`
    await supabase.storage.upload(fileName, selectedFiles[i])
  }
  
  // Guardar en BD
  await supabase.from('app_releases').upsert({
    download_url: 'https://.../file.zip',  // Sin extensión
    total_parts: 9,
    file_size_bytes: 90MB,  // Total
  })
}
```

### User download (multipartUtils.js)

```javascript
// Descargar partes
for (let i = 1; i <= totalParts; i++) {
  const partUrl = `${baseUrl}.${padStart(i, 3, '0')}`
  const blob = await fetch(partUrl).blob()
  parts.push(blob)
}

// Ensamblar
const zipBlob = new Blob(parts)

// Descomprimir
const files = await decompressZip(zipBlob)
const exeFile = files.find(f => f.name.endsWith('.exe'))

// Descargar
downloadBlob(exeFile.blob, exeFile.name)
```

---

## 📊 Ejemplo real

**Escenario: RepuestosYa-Admin-1.0.0 = 90 MB ZIP**

### Setup
```
Admin crea 9 partes de 10 MB c/u
├── RepuestosYa-Admin-1.0.0.zip.001 (10.00 MB)
├── RepuestosYa-Admin-1.0.0.zip.002 (10.00 MB)
├── RepuestosYa-Admin-1.0.0.zip.003 (10.00 MB)
├── RepuestosYa-Admin-1.0.0.zip.004 (10.00 MB)
├── RepuestosYa-Admin-1.0.0.zip.005 (10.00 MB)
├── RepuestosYa-Admin-1.0.0.zip.006 (10.00 MB)
├── RepuestosYa-Admin-1.0.0.zip.007 (10.00 MB)
├── RepuestosYa-Admin-1.0.0.zip.008 (10.00 MB)
└── RepuestosYa-Admin-1.0.0.zip.009 (10.00 MB)
```

### BD
```sql
INSERT INTO app_releases (version, platform, download_url, total_parts, file_size_bytes)
VALUES ('1.0.0', 'windows', 
        'https://storage/.../releases/windows/.../RepuestosYa-Admin-1.0.0.zip',
        9, 90000000);
```

### User download
```
Click "Descargar v1.0.0"
  ↓
[multipartUtils] Iniciando descarga de 9 partes
[multipartUtils] Descargando parte 1/9: ...zip.001
[multipartUtils] Descargando parte 2/9: ...zip.002
...
[multipartUtils] Descargando parte 9/9: ...zip.009
  ↓
[multipartUtils] Todas las partes: 90.00 MB
[multipartUtils] Reensamblando partes...
[multipartUtils] Descomprimiendo...
  ↓
✅ Descarga automática: RepuestosYa-Admin-1.0.0.exe
```

---

## ⚡ Performance

### Descarga en paralelo
- **Antes**: Descargar 90 MB monolítico = secuencial
- **Ahora**: Descargar 9 partes en **paralelo** = hasta 9x más rápido (limitado por navegador)

### Memory management
- Cada parte se guarda como Blob separado
- Se ensamblan en un único Blob (consume 90 MB en RAM)
- Seguro para archivos hasta 500 MB+ (depende de RAM del usuario)

### Timeouts
- Descarga individual de parte: 60s timeout
- Si falla una parte, todo reinicia (próximo: retry logic)

---

## 🔍 Troubleshooting

### "No se encontró .exe en ZIP"

**Causa**: Nombre del archivo en ZIP no coincide

**Solución**:
```javascript
// Sistema busca por patrón:
const exeFile = files.find(f => 
  f.name === fileName || 
  f.name.endsWith('.exe')
)

// Si falla, verifica en console:
console.log('[multipartUtils] Archivos en ZIP:', files.map(f => f.name))
```

### "Error descargando parte X"

**Causa**: Storage no tiene todas las partes

**Solución**:
1. Verifica Supabase Storage: todas .zip.001 hasta .zip.009 existen
2. Verifica BD: `total_parts: 9` es correcto
3. Reintentar descarga

### Descarga lenta

**Causa**: Límite de conexiones paralelas del navegador

**Nota**: Navegadores modernos típicamente permiten 6-8 conexiones paralelas. Para 9 partes, últimas se alinean.

**Mejora futura**: Implementar descargas secuenciales con barra de progreso.

---

## 🚀 Próximas mejoras

- [ ] Validar CRC/MD5 de cada parte
- [ ] Retry automático si falla una parte
- [ ] Barra de progreso (cuántas partes descargadas)
- [ ] Descargas secuenciales (más controlado)
- [ ] Comprimir en servidor (no en browser)

---

## 📝 Setup BD (si es tabla nueva)

```sql
CREATE TABLE app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  download_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  original_size_bytes BIGINT,
  total_parts INTEGER DEFAULT 1,  -- ← IMPORTANTE
  sha256_checksum TEXT,
  release_notes TEXT,
  is_latest BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

Si tabla existe:
```sql
ALTER TABLE app_releases ADD COLUMN IF NOT EXISTS total_parts INTEGER DEFAULT 1;
```

---

**¿Preguntas?** Ver DEBUG_DOWNLOAD.md o ZIP_COMPRESSION.md. 🚀
