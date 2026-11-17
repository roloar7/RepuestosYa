# Estrategia de Schema en Desarrollo vs Producción

## El Problema Original ❌
Crear una migración nueva cada vez que cambias algo en SQL es tedioso:
- 10+ archivos para cambios menores
- Difícil de mantener
- Confuso cuál es la estructura actual

## La Solución ✅

### En Desarrollo
**Archivo único: `schema.sql`**
- Contiene la definición **ACTUAL Y COMPLETA** de todas las tablas
- Editas este archivo cada vez que cambias la estructura
- Ejecutas el contenido en Supabase SQL Editor → Listo
- Git rastrea los cambios del schema
- Rápido, limpio, fácil de mantener

```bash
# Desarrollo: solo necesitas esto
supabase/schema.sql  ← Edita aquí
```

### En Producción
**Migraciones numeradas: `migrations/001_*.sql`**
- Se aplican en orden automáticamente
- Inmutables después de aplicarlas
- Tracking de qué cambió cuándo
- Usado por `supabase db push` y CI/CD

```bash
# Producción: migraciones en orden
migrations/
  001_initial_schema.sql
  002_add_new_table.sql
  003_update_column_type.sql
```

## Workflow

### Cambio en Desarrollo

1. **Edita `schema.sql`**
   ```sql
   -- En schema.sql:
   CREATE TABLE IF NOT EXISTS printers (
     ...
     nueva_columna VARCHAR(255),  ← Agregada
     ...
   );
   ```

2. **Ejecuta en Supabase SQL Editor**
   - Copia todo de `schema.sql`
   - Pega en SQL Editor → Run
   - Listo ✅

3. **Commit a Git**
   ```bash
   git add supabase/schema.sql
   git commit -m "feat: add nueva_columna to printers"
   ```

### Pasar a Producción

1. **Extrae cambios de `schema.sql`**
   - Convierte en migración numerada en `migrations/`
   - Ejemplo: `002_add_nueva_columna.sql`

2. **Ejecuta**
   ```bash
   supabase db push
   ```

3. **Git**
   ```bash
   git add migrations/002_add_nueva_columna.sql
   git commit -m "migration: add nueva_columna to printers"
   ```

## Comparación

| Aspecto | Desarrollo | Producción |
|---------|-----------|-----------|
| **Archivo** | `schema.sql` (único) | `migrations/NNN_*.sql` (múltiples) |
| **Cambios** | Edita y ejecuta | Crea migración nueva |
| **Reversibilidad** | Reset completo es fácil | Migraciones son inmutables |
| **Tracking** | Schema actual | Historial de cambios |
| **Velocidad** | Muy rápido | Rastreable y seguro |

## Ejemplos Reales

### Agregar columna
```sql
-- En schema.sql, actualiza printers:
CREATE TABLE IF NOT EXISTS printers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ...
  nueva_columna VARCHAR(255),  ← Aquí
  ...
);
```
✅ Ejecuta en SQL Editor → Listo

### Cambiar tipo de dato
```sql
-- En schema.sql:
ALTER TABLE printers ALTER COLUMN access_code TYPE TEXT;
```
✅ Ejecuta en SQL Editor → Listo

### Agregar índice
```sql
-- En schema.sql, agrega después de CREATE TABLE:
CREATE INDEX IF NOT EXISTS idx_printers_nueva_columna ON printers(nueva_columna);
```
✅ Ejecuta en SQL Editor → Listo

### Cambiar RLS policy
```sql
-- En schema.sql, actualiza la política:
DROP POLICY IF EXISTS "nombre antiguo" ON tabla;
CREATE POLICY "nombre nuevo"
  ON tabla FOR SELECT TO authenticated USING (true);
```
✅ Ejecuta en SQL Editor → Listo

## Archivos Existentes

### Mantener
- ✅ `supabase/schema.sql` - Fuente única de verdad en desarrollo
- ✅ `supabase/migrations/001_initial_schema.sql` - Base para producción

### Limpiar (Opcional)
Puedes eliminar los viejos archivos de `migrations/` si quieres, ya que están consolidados en `001_initial_schema.sql`:
```bash
rm supabase/migrations/create-*.sql
rm supabase/migrations/drop-*.sql
rm supabase/migrations/update-*.sql
# ... etc
```

Supabase solo ejecutará las que falten, así que si ya corriste las antiguas, no hay problema.

## Checklist para Nuevos Cambios

- [ ] Edito `schema.sql`
- [ ] Ejecuto el SQL en Supabase SQL Editor
- [ ] Verifico que funciona
- [ ] Hago commit a Git
- [ ] Listo ✅

¡Así de simple! 🚀
