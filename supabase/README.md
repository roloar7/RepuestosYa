# Supabase Schema

## Estructura

### En Desarrollo
- **`schema.sql`** - Definición completa y actual de TODAS las tablas, índices, RLS y Realtime
- Uso: Ejecuta este archivo en Supabase SQL Editor para resetear/inicializar todo de una vez
- Actualiza este archivo cada vez que cambies la estructura

### En Producción  
- **`migrations/`** - Migraciones individuales (versionadas)
- Supabase las aplica automáticamente en orden
- Usado por `supabase link` y `supabase db push`

## Cómo Usar

### Desarrollo Local

1. **Inicializar schema completo:**
   ```bash
   # Copia todo el contenido de schema.sql
   # Ve a Supabase Project → SQL Editor
   # Pega y ejecuta
   ```

2. **Cambiar estructura:**
   - Edita `schema.sql` directamente
   - Ejecuta el SQL actualizado en Supabase SQL Editor
   - No necesitas crear migraciones hasta que subas a producción

### Cambios Comunes

#### Agregar columna a tabla
```sql
-- En schema.sql, actualiza la tabla:
CREATE TABLE IF NOT EXISTS printers (
  ...
  nueva_columna VARCHAR(255),  -- ← Agrégala aquí
  ...
);
```

#### Cambiar tipo de dato
```sql
-- Modifica directamente en schema.sql
-- Luego ejecuta el SQL actualizado
```

#### Agregar índice
```sql
-- En schema.sql, agrega después de CREATE TABLE:
CREATE INDEX idx_nombre_columna ON tabla(columna);
```

#### Cambiar RLS policies
```sql
-- Actualiza las políticas en schema.sql
-- Supabase las recrea automáticamente
```

## Tablas Actuales

### printers
- Impresoras conectadas
- Status: idle, printing, paused, offline, error
- RLS: todos ven, usuarios editan sus propias impresoras
- Realtime: habilitado

### print_files
- Archivos 3MF/GCODE en Storage
- Metadata: nombre, tipo, tamaño, path
- RLS: todos pueden ver/subir/descargar archivos
- Realtime: habilitado

### bridge_status
- Estado del Electron Bridge (1 fila, id=1)
- is_connected: true si hay >= 1 impresora conectada
- Actualizado por: Electron main.js
- RLS: solo lectura para usuarios

## Notas

- **Sin migraciones hasta producción**: Usa `schema.sql` en desarrollo
- **Cambios rápidos**: Edita `schema.sql` y ejecuta en SQL Editor
- **Control de versiones**: Git sigue los cambios en `schema.sql`
- **Sin historial de migraciones**: Limpiar y reconstruir es más fácil en dev

## Cuando Pasar a Producción

1. Convierte `schema.sql` en migraciones numéricas en `migrations/`
2. Ejecuta `supabase db push` para aplicarlas
3. Las migraciones son inmutables después
