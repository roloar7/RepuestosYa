# Setup de Supabase para RepuestosYa Admin

## 1. Crear la tabla `profiles`

Ejecuta el siguiente SQL en la consola de Supabase (SQL Editor):

```sql
-- Crear tabla profiles
CREATE TABLE profiles (
  id UUID NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_user FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Crear política para que los usuarios solo vean su propio perfil
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Crear política para que los usuarios actualicen su propio perfil
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Crear política para que el sistema pueda insertar perfiles
CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Crear índice en username para búsquedas rápidas
CREATE INDEX idx_profiles_username ON profiles(username);
```

## 2. Configurar variables de entorno

Crea un archivo `.env.local` en `apps/admin/`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Reemplaza con los valores reales de tu proyecto Supabase.

## 3. Crear usuarios de prueba

En la consola de Supabase → Authentication → Users, crea usuarios con email y contraseña.

**Nota:** El primer login pedirá completar el perfil (nombre de usuario).

## 4. Estructura de datos

### Tabla `profiles`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Foreign key a auth.users.id |
| `username` | TEXT | Nombre de usuario único (requerido después del login) |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Fecha de última actualización |

## 5. Crear la tabla `printers`

```sql
-- Crear tabla printers
CREATE TABLE printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ip TEXT NOT NULL UNIQUE,
  serial TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('idle', 'printing', 'paused', 'error', 'offline')),
  last_seen TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Habilitar RLS
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

-- Política: usuarios ven solo sus impresoras
CREATE POLICY "Users can view their own printers"
  ON printers FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuarios pueden crear impresoras
CREATE POLICY "Users can create printers"
  ON printers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: usuarios pueden actualizar sus impresoras
CREATE POLICY "Users can update their own printers"
  ON printers FOR UPDATE
  USING (auth.uid() = user_id);

-- Índices
CREATE INDEX idx_printers_user_id ON printers(user_id);
CREATE INDEX idx_printers_status ON printers(status);
```

## 6. Estructura de datos

### Tabla `profiles`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Foreign key a auth.users.id |
| `username` | TEXT | Nombre de usuario único |
| `role` | TEXT | Rol del usuario (admin/operator/viewer) |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Fecha de última actualización |

### Tabla `printers`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | ID único de la impresora |
| `name` | TEXT | Nombre personalizado (ej: "A1 mini Nave 1") |
| `ip` | TEXT | IP de la impresora en la LAN |
| `serial` | TEXT | Serial (obtenido al conectar o manual) |
| `status` | TEXT | Estado actual (idle/printing/offline) |
| `last_seen` | TIMESTAMP | Última conexión exitosa |
| `created_at` | TIMESTAMP | Fecha de alta |
| `updated_at` | TIMESTAMP | Última actualización |
| `user_id` | UUID | Foreign key a auth.users.id |

## 7. Flow de autenticación

1. Usuario hace login en `/login`
2. Si no tiene perfil, se muestra modal `CompleteProfile`
3. Usuario ingresa nombre de usuario
4. Se crea/actualiza el perfil en la tabla `profiles`
5. Usuario es redirigido a `/`

## 8. Flow de agregar impresora

1. Usuario en Granja → click "Agregar impresora"
2. Modal: ingresar nombre + IP
3. Admin envía a bridge: `POST /printers/validate` con {name, ip}
4. Bridge intenta MQTT/ping a la IP
5. Si OK → admin guarda en Supabase `printers` tabla
6. Si falla → muestra error al usuario

## 9. Rutas protegidas

- `/login` — Pública
- `/` y subrutas — Protegidas (requieren autenticación)
- `/perfil` — Protegida (ver/editar perfil)
- `/impresion-3d/*` — Protegidas

## Troubleshooting

### Desarrollo

**Dev web (navegador, requiere bridge en otra terminal):**
```bash
# Terminal 1: Bridge Node
pnpm --filter printer-bridge dev

# Terminal 2: Admin React
pnpm dev
```

**Dev con Electron embebido:**
```bash
pnpm dev:electron
```
Esto levanta Electron con el bridge embebido en el main process.

**Build y empaquetado (Electron):**
```bash
pnpm build:electron
pnpm --filter admin start
```

### Errores comunes

#### Error: "Missing Supabase env vars"
Asegúrate de tener `.env.local` en `apps/admin/`.
