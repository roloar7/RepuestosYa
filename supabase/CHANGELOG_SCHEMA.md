# Schema Management - Cambios Realizados

## Fecha
17 Nov 2026

## Problema Resuelto
❌ **Antes**: Una migración nueva para cada cambio en SQL → 10+ archivos de migraciones
✅ **Ahora**: Un archivo `schema.sql` que contiene la estructura completa

## Cambios Implementados

### 1. Crear Fuente Única de Verdad en Desarrollo
- **`supabase/schema.sql`** - Definición completa de todas las tablas, índices, RLS y Realtime
  - Reemplaza múltiples migraciones individuales
  - Se ejecuta completo en Supabase SQL Editor
  - Git rastrea cambios del schema
  - Fácil de mantener y entender

### 2. Crear Migración Base para Producción
- **`supabase/migrations/001_initial_schema.sql`** - Migración numerada que consolida todo
  - Se aplica una sola vez en producción
  - Base para futuras migraciones (002, 003, etc.)
  - Compatible con `supabase db push`

### 3. Documentación
- **`supabase/README.md`** - Guía rápida de uso
- **`supabase/SCHEMA_STRATEGY.md`** - Workflow detallado desarrollo vs producción
- **`AGENTS.md`** - Actualizado con guidelines de schema management

### 4. Limpiar Base de Datos
- ✅ Eliminar columna redundante `is_connected`
- ✅ Usar `status !== 'offline'` en su lugar
- ✅ Actualizar código en main.js, usePrinters, Granja, SendToPrintModal

## Tablas Actuales en schema.sql

### printers
```sql
- id (UUID)
- user_id (FK → auth.users)
- name, ip, access_code, serial_number
- status (idle | printing | paused | offline | error)
- last_seen_at
- RLS: Lectura pública, escritura por propietario
- Índices en user_id, ip, serial_number, status
- Realtime: Habilitado
```

### print_files
```sql
- id (UUID)
- user_id (FK → auth.users)
- filename, file_type (3mf | gcode), file_size
- storage_path
- RLS: Todos ven, todos pueden subir/descargar
- Índices en user_id, created_at
- Realtime: Habilitado
```

### bridge_status
```sql
- id (1, única fila)
- is_connected (boolean)
- last_update, updated_at
- RLS: Lectura pública, actualización solo service role
- Realtime: Habilitado
```

## Workflow Nuevo

### Para Cambiar Schema en Desarrollo
1. Edita `supabase/schema.sql`
2. Copia todo y pega en Supabase SQL Editor → Run
3. Commit a Git
4. Listo ✅

### Cuando Pasas a Producción
1. Extrae cambios de `schema.sql` en migración numerada
2. Ejecuta `supabase db push`
3. Commit la migración nueva
4. Listo ✅

## Archivos Que Puedes Eliminar (Opcional)
Todas estas migraciones antiguas están consolidadas en `001_initial_schema.sql`:
```bash
supabase/migrations/
  ❌ add-printer-connection-status.sql
  ❌ create-bridge-status-policies.sql
  ❌ create-bridge-status-table.sql
  ❌ create-print-files-table.sql
  ❌ create-printer-telemetry.sql
  ❌ drop-printer-telemetry-table.sql
  ❌ enable-realtime-printers.sql
  ❌ fix-printer-delete-policy.sql
  ❌ fix-printer-telemetry-table.sql
  ❌ remove-is-connected-column.sql
  ❌ update-printer-telemetry-columns.sql
  ❌ update-rls-printers-public.sql
```

Si ya ejecutaste estas migraciones en Supabase, puedes dejarlas (Supabase las salta).
Si no, solo necesitas `001_initial_schema.sql`.

## Próximos Pasos

### En Supabase
Ejecuta en SQL Editor para limpiar y actualizar:
```sql
-- Copiar todo de supabase/schema.sql
-- Pegar en SQL Editor
-- Click: Run
```

### En Código (Hecho ✅)
- ✅ main.js: No escribe `is_connected`
- ✅ usePrinters: Usa `status !== 'offline'`
- ✅ Granja: Usa `status !== 'offline'`
- ✅ SendToPrintModal: Usa `status === 'offline'`

## Commits Relacionados
- `3763b46` - Refactor: consolidate supabase schema management and remove is_connected column

## Referencias
- Ver `supabase/SCHEMA_STRATEGY.md` para ejemplos detallados
- Ver `supabase/README.md` para guía rápida
