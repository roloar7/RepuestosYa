# 🔧 Debugging: Botón "No disponible"

## El problema
El botón de descarga muestra "No disponible" aunque estés autenticado.

## Causas posibles

### 1. **No hay releases en BD** (más probable)
Si ejecutaste `INSERT_TEST_RELEASE.sql`, verifica que haya datos:

```sql
SELECT * FROM app_releases;
```

**Esperado**: Al menos una row con `platform = 'windows'` e `is_latest = true`.

**Si está vacío**: Ve a **Solución 1** abajo.

### 2. **Plataforma no detectada correctamente**
El hook detecta plataforma del `navigator.userAgent`:
- Windows: `"win"` 
- macOS: `"mac"`
- Linux: `"linux"`

**Cómo verificar** (en DevTools Console):
```javascript
// En DownloadElectron.jsx, agrega:
console.log("Plataforma detectada:", navigator.userAgent)
```

Si no está en lista, el hook setea `error: "Plataforma no soportada"`.

### 3. **Error en query a BD**
Revisa la consola del navegador (F12 → Console):

```
[useAppRelease] DB Error: ...
```

Si hay error 403/401, RLS policies está bloqueando. Ver **Solución 2**.

---

## Soluciones

### Solución 1: Agregar una release de test

**En Supabase Dashboard:**

1. SQL Editor → Paste `INSERT_TEST_RELEASE.sql`
2. Click "Run"
3. Verifica: `SELECT * FROM app_releases;`

**Output esperado:**
```
id          | version | platform | is_latest | download_url
-----------|---------|----------|-----------|---------- 
abc123...  | 1.0.0   | windows  | true      | https://...
```

### Solución 2: Verificar RLS policies

**En Supabase Dashboard → SQL Editor:**

```sql
-- Ver políticas de app_releases
SELECT * FROM pg_policies WHERE tablename = 'app_releases';

-- Debe haber policy para "authenticated":
-- Policy name: "Authenticated users can view releases"
-- Using: (auth.role() = 'authenticated')
```

Si no existen, ejecuta:

```sql
CREATE POLICY "Authenticated users can view releases"
  ON app_releases FOR SELECT
  USING (auth.role() = 'authenticated');
```

### Solución 3: Verificar autenticación

En DevTools Console:

```javascript
// Verificar que está autenticado
const { data } = await supabase.auth.getSession()
console.log("Sesión:", data?.session?.user?.email)

// Si muestra undefined o null → no está autenticado
// Si muestra email → ✅ autenticado
```

---

## Debug paso a paso

### Paso 1: ¿Estoy autenticado?
```javascript
// En Console:
const { data } = await supabase.auth.getSession()
data?.session ? "✅ Autenticado" : "❌ No autenticado"
```

### Paso 2: ¿Hay releases en BD?
```javascript
// En Console:
const { data } = await supabase.from('app_releases').select('*').eq('platform', 'windows')
console.table(data)
```

**Si data es `[]` (vacío)** → Problema: no hay releases. Usa Solución 1.

### Paso 3: ¿Puedo acceder a la release?
```javascript
// Si hay datos, intenta el query que hace el hook:
const { data, error } = await supabase
  .from('app_releases')
  .select('*')
  .eq('platform', 'windows')
  .eq('is_latest', true)
  .single()

if (error) console.error("Error:", error)
else console.log("Release:", data)
```

---

## Console logs útiles

Cuando abres DevTools (F12 → Console), busca estos logs de `useAppRelease`:

```
[useAppRelease] Release found: 1.0.0         ✅ OK
[useAppRelease] No release found for platform: windows  → No hay datos
[useAppRelease] DB Error: ...                → Error de query
[useAppRelease] Plataforma no soportada      → Navigator no detectó plataforma
```

---

## Ejemplo: Flujo correcto

```
1. Load página
   [useAppRelease] Checking auth...
   isAuthenticated: true ✅

2. Fetch releases
   [useAppRelease] Release found: 1.0.0 ✅

3. Render botón
   <a href="https://..." download>Descargar v1.0.0</a>
```

---

## Próxima vez: Subir .exe real

Cuando builds el Electron:

1. `pnpm build:electron` → genera `dist-build/RepuestosYa-Admin-1.0.0.exe`
2. Ve a `/administrador/releases` en la app
3. Upload `.exe`
4. Publicar

El sistema automáticamente:
- Calcula SHA256
- Sube a Storage
- Crea entry en `app_releases`
- Marca como `is_latest = true`

---

## Troubleshooting rápido

| Síntoma | Causa | Solución |
|---------|-------|----------|
| "Iniciar sesión" | No autenticado | Login |
| "No disponible" + error en console | Query error (RLS) | Solución 2 |
| "No disponible" + sin error | No hay releases | Solución 1 |
| "Sin versión" | Plataforma sin release | Add release para tu SO |

---

**¿Todavía no funciona?** Abre DevTools, ejecuta los pasos 1-3 de Debug y comparte los logs. 🔍
