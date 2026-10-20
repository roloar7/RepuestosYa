# 🔍 Debug: "No hay versión disponible" con multipart

## Síntomas
- Subiste 10 archivos `.zip.001` hasta `.zip.010`
- Sistema dice "✅ Release v1.0.0 publicada (10 partes, 100 MB total)"
- Pero botón descarga sigue mostrando "No disponible"

---

## ✅ Checklist de verificación

### 1. ¿Está en BD?

**En Supabase SQL Editor:**
```sql
SELECT version, is_latest, total_parts, platform 
FROM app_releases 
WHERE version = '1.0.0';
```

**Esperado:**
```
version | is_latest | total_parts | platform
--------|-----------|-------------|----------
1.0.0   | true      | 10          | windows
```

**Si `is_latest = false`:**
→ Marcar como latest manualmente (ver abajo)

**Si NO aparece ninguna row:**
→ Release no se guardó en BD. Ver **Paso 2**.

---

### 2. ¿Los archivos están en Storage?

**En Supabase Dashboard → Storage:**

1. Abre bucket: `app-releases`
2. Navega a: `releases/windows/`
3. Debe haber archivos:
   - `RepuestosYa-Admin-1.0.0.zip.001`
   - `RepuestosYa-Admin-1.0.0.zip.002`
   - ...
   - `RepuestosYa-Admin-1.0.0.zip.010`

**Si faltan:**
→ Upload falló silenciosamente. Reintentar upload.

**Si están pero BD está vacía:**
→ Error al guardar en BD. Ver logs de error en console (F12).

---

### 3. ¿Está marcado como `is_latest = true`?

**En Supabase SQL Editor:**
```sql
-- Ver estado
SELECT version, is_latest FROM app_releases WHERE version = '1.0.0';

-- Si is_latest = false, marcar como true
UPDATE app_releases 
SET is_latest = true 
WHERE version = '1.0.0' AND platform = 'windows';

-- Verificar
SELECT version, is_latest FROM app_releases WHERE version = '1.0.0';
```

**Después de este UPDATE, recarga la app (F5).**

---

## 🔧 Console Debug (F12 → Console)

Ejecuta esto en DevTools:

```javascript
// 1. Verificar autenticación
const { data: session } = await supabase.auth.getSession()
console.log("Autenticado:", session?.session?.user?.email)

// 2. Verificar releases en BD
const { data: releases, error } = await supabase
  .from('app_releases')
  .select('version, platform, is_latest, total_parts')
  .eq('platform', 'windows')

console.log("Releases para windows:", releases)
if (error) console.error("Error:", error)

// 3. Buscar específicamente v1.0.0
const { data: v1 } = await supabase
  .from('app_releases')
  .select('*')
  .eq('version', '1.0.0')
  .single()

console.log("v1.0.0:", v1)
```

**Qué esperar:**
```
Autenticado: tu-email@example.com

Releases para windows: [
  {version: "1.0.0", platform: "windows", is_latest: true, total_parts: 10}
]

v1.0.0: {
  id: "...",
  version: "1.0.0",
  platform: "windows",
  is_latest: true,
  total_parts: 10,
  file_size_bytes: 100000000,
  download_url: "https://storage/.../RepuestosYa-Admin-1.0.0.zip",
  ...
}
```

---

## 🚨 Problema: `is_latest = false`

### **Si al subir NO marcaste "Marcar como versión más reciente"**

**Opción A: Vía BD (rápido)**
```sql
UPDATE app_releases 
SET is_latest = true 
WHERE version = '1.0.0';
```

**Opción B: Vía panel admin**
1. Ir a `/administrador/releases`
2. Editar la entrada v1.0.0 (si hay opción de edit)
3. O reuplodar y marcar "Marcar como versión más reciente"

---

## 🚨 Problema: Storage vacío

**Si Supabase Storage NO tiene los 10 archivos:**

1. Reintenta upload desde admin panel
2. Verifica que seleccionaste TODOS los 10 archivos
3. Mira el status en admin: "Subiendo parte 1/10...", "Subiendo parte 2/10...", etc.
4. Espera a: "✅ Release v1.0.0 publicada (10 partes, 100 MB total)"

---

## 🚨 Problema: Upload no completó

**Síntomas:**
- Admin panel mostró mensaje de éxito
- Pero Storage está vacío
- Y/o BD está vacía

**Causas:**
- Upload de una parte falló silenciosamente
- Error de red
- Timeout

**Solución:**
1. En `/administrador/releases`, revisa el **historial** abajo
2. Si v1.0.0 está en historial: Upload sí se completó
3. Si NO está: Reintenta upload
4. Verifica Storage después de cada intento

---

## Console: Debug de upload

Si estás subiendo y quieres ver progreso:

**En DevTools Console:**
```javascript
// Mientras uploadas, ejecuta cada 2 segundos:
const { data } = await supabase.storage
  .from('app-releases')
  .list('releases/windows')

const zipFiles = data.filter(f => f.name.includes('1.0.0'))
console.log(`Archivos subidos: ${zipFiles.length}`)
zipFiles.forEach(f => console.log(`  - ${f.name}`))
```

---

## 📝 Resumen: Fix rápido (3 pasos)

### Si subiste archivos pero botón sigue "No disponible":

```
1. En Supabase SQL Editor:

   UPDATE app_releases 
   SET is_latest = true 
   WHERE version = '1.0.0';

2. Recarga la app: F5

3. Botón debe mostrar "Descargar v1.0.0"
```

### Si eso no funciona:

```
1. Abre DevTools: F12 → Console
2. Copia y ejecuta el debug script de arriba
3. Comparte output en Discord/chat
4. Buscaremos el error exacto
```

---

## Estructura esperada en BD

```
id          | version | platform | is_latest | total_parts | download_url
------------|---------|----------|-----------|-------------|-------------------
abc123...   | 1.0.0   | windows  | true      | 10          | https://.../1.0.0.zip
```

## Estructura esperada en Storage

```
app-releases/
└── releases/
    └── windows/
        └── RepuestosYa-Admin-1.0.0.zip.001
        └── RepuestosYa-Admin-1.0.0.zip.002
        └── RepuestosYa-Admin-1.0.0.zip.003
        └── ... (hasta .010)
```

---

## ¿Todavía no funciona?

Ejecuta en console:

```javascript
// Captura el error exacto
try {
  const { data, error: err } = await supabase
    .from('app_releases')
    .select('*')
    .eq('platform', 'windows')
    .eq('is_latest', true)
    .single()
  
  if (err) {
    console.error('ERROR:', err.code, err.message, err.details)
  } else {
    console.log('SUCCESS:', data)
  }
} catch (e) {
  console.error('EXCEPTION:', e)
}
```

Comparte el output completo. 🔍
