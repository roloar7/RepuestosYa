# Configuración Tailscale + Bridge Remoto

## Topología

```
┌─────────────────────────────────────────────────────────────────┐
│                     RED PRIVADA TAILSCALE                       │
│                                                                  │
│  ┌──────────────────┐      ┌──────────────────┐               │
│  │  PC Control      │      │  PC/Raspberry π  │               │
│  │  (Electron)      │      │  Servidor Bridge │               │
│  │  Tailscale       │◄────►│  Tailscale       │               │
│  │                  │      │  :8787/HTTP      │               │
│  └──────────────────┘      └────────┬──────────┘               │
│                                     │                           │
│  ┌──────────────────┐               │                           │
│  │  Browser/Netlify │               │                           │
│  │  Tailscale       │◄──────────────┘                           │
│  │  (Web)           │                                           │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    Acceso a LAN vía Tailscale MagicDNS
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
            ┌───────▼─────────┐       ┌────────▼────────┐
            │ Impresora Bambu │       │ Impresora Bambu │
            │ 192.168.x.x:8883│       │ 192.168.x.x:8883│
            │    (MQTT/TLS)   │       │   (MQTT/TLS)    │
            └─────────────────┘       └─────────────────┘
```

## Paso 1: Instalar Tailscale en PC/Raspberry π Servidor

### En Linux (Raspberry Pi / Ubuntu)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Seguir el link de autenticación
```

### En Windows
1. Descargar desde: https://tailscale.com/download/windows
2. Instalar y ejecutar
3. Click en la bandeja de tareas → "Sign in"

### Verificar MagicDNS
```bash
# En el servidor
tailscale status
# Debería mostrar: tupc.tudominio.ts.net

# Verificar que se ve desde otra máquina Tailscale
ping tupc.tudominio.ts.net   # o el nombre que asigne
```

## Paso 2: Levantar Bridge Node en Servidor

### Opción A: Directo con Node.js

```bash
cd packages/printer-bridge
pnpm install
pnpm dev
# Bridge escuchando en http://localhost:8787
```

### Opción B: Como servicio systemd (Linux)

Crear archivo: `/etc/systemd/system/bridge-repuestosya.service`

```ini
[Unit]
Description=RepuestosYa Printer Bridge
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/RepuestosYa
ExecStart=/usr/local/bin/pnpm --filter printer-bridge dev
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Activar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable bridge-repuestosya
sudo systemctl start bridge-repuestosya
sudo systemctl status bridge-repuestosya
```

## Paso 3: Configurar Clientes (PC Control + Navegador Netlify)

### En Electron (PC Control)
Instalar Tailscale en la PC:
```bash
# Windows: descarga desde https://tailscale.com/download
# Linux: curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```

El Electron auto-detecta localhost:8787 (bridge embebido) o puede apuntar a remoto si es necesario.

### En Navegador (Netlify)
Instalar Tailscale en el dispositivo desde el que accedes.

En `apps/admin/.env`:
```
VITE_BRIDGE_URL=http://tupc.tudominio.ts.net:8787
```

O en Netlify UI → Environment variables:
```
VITE_BRIDGE_URL = http://tupc.tudominio.ts.net:8787
```

## Paso 4: Conectar Impresoras Bambu Lab

### Via Tailscale MagicDNS
Si las impresoras están en la LAN del servidor Tailscale, el bridge las ve automáticamente.

Agregar impresora en la app:
- **IP/DNS**: `192.168.1.x` (IP local) o si MagicDNS: resuelve automáticamente
- **Código de Acceso**: El código de 4 dígitos de la impresora (en settings)

### Via IP Local Directa
Si el cliente Tailscale está en la misma LAN que las impresoras:
```
IP: 192.168.1.100
```

Si está en otra ubicación, confía en la PC servidor para validar.

## Paso 5: Verificar Conectividad

### Health check desde cualquier cliente
```bash
# En terminal con Tailscale activo
curl http://tupc.tudominio.ts.net:8787/health

# Respuesta esperada:
# {"status":"ok","bridge":true,"network":{"connected":true,"tailscaleReady":true},"timestamp":"2026-10-20T..."}
```

### Desde el navegador (Devtools Console)
```javascript
// Si estás en Netlify
fetch('http://tupc.tudominio.ts.net:8787/health')
  .then(r => r.json())
  .then(console.log)
```

## Troubleshooting

### "ERR_NAME_NOT_RESOLVED" para tupc.tudominio.ts.net
- Verificar Tailscale está running: `tailscale status`
- Reiniciar Tailscale: `tailscale down && tailscale up`
- Verificar MagicDNS activado en Tailscale Admin Console

### Bridge no responde
- SSH/RDP al servidor: `curl http://localhost:8787/health`
- Verificar firewall: `sudo ufw allow 8787` (Linux)
- Revisar logs: `sudo systemctl logs bridge-repuestosya -f`

### Impresora no responde en validación
- Verificar IP: `ping 192.168.1.x`
- Verificar puerto MQTT: `nmap -p 8883 192.168.1.x` (si nmap disponible)
- Revisar código de acceso MQTT en settings de la impresora

## Sincronización en Tiempo Real

La app usa **Supabase Realtime** para que cambios en la BD se reflejen en todos los clientes:

```javascript
// En usePrinters.js - se suscribe automáticamente
supabase
  .from("printers")
  .on("*", (payload) => {
    console.log("[Realtime] Cambio:", payload)
    // Refetch automáticamente
  })
  .subscribe()
```

Esto significa:
- ✅ Si agregas una impresora en Electron, aparece en la web Netlify (sin recargar)
- ✅ Si cambias estado en la web, se actualiza en Electron
- ✅ Todos los clientes conectados ven cambios en <1s

## Seguridad

⚠️ **Importante en producción:**

1. **Access code cifrado**: Guardar en BD cifrado (Supabase pgsql `pgcrypto`)
   ```sql
   ALTER TABLE printers ADD COLUMN access_code_encrypted bytea;
   -- Guardar encriptado, decriptar solo en Node.js en servidor
   ```

2. **HTTPS para bridge**: En producción, exponer bridge vía HTTPS (Nginx reverse proxy + Let's Encrypt)
   ```nginx
   server {
     listen 443 ssl;
     server_name bridge.tudominio.com;
     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;
     
     location / {
       proxy_pass http://localhost:8787;
     }
   }
   ```

3. **Tailscale ACLs**: Restringir acceso en Tailscale Admin Console
   ```yaml
   acls:
     - action: accept
       src:
         - tag:admin
         - tag:staff
       dst:
         - tag:printer-bridge:8787
   ```

## Ejemplo Completo: Setup en Raspberry Pi

```bash
# 1. Instalar Node + pnpm
curl -sL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
npm install -g pnpm@11

# 2. Clonar repo
cd /home/pi
git clone https://github.com/roloar7/RepuestosYa.git
cd RepuestosYa

# 3. Instalar dependencias
pnpm install --ignore-scripts

# 4. Instalar Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 5. Autenticar
sudo tailscale up

# 6. Crear servicio
sudo nano /etc/systemd/system/bridge-repuestosya.service
# (copiar contenido de arriba)

# 7. Activar servicio
sudo systemctl enable bridge-repuestosya
sudo systemctl start bridge-repuestosya

# 8. Verificar
curl http://localhost:8787/health
tailscale status
```

Done! 🚀 Ahora todos los clientes (Electron + web) acceden al bridge remoto vía Tailscale.
