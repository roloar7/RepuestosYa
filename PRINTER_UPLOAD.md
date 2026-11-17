# 📤 Envío de Archivos a Impresora Bambu

## 🏗️ Arquitectura

```
React Component (PrinterUpload.jsx)
    ↓
window.electron.selectFile() / uploadFile()
    ↓
IPC Main (main.js)
    ↓
FTP Client (ftp-client.js)
    ↓
Impresora Bambu (FTP en puerto 990)
```

## 📁 Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `src-electron/ftp-client.js` | Cliente FTP para conectarse a impresora |
| `src-electron/main.js` | IPC handlers: `printer:select-file`, `printer:upload-file` |
| `src-electron/preload.js` | Expone `selectFile()`, `uploadFile()`, `onFileUploaded()` |
| `src/components/PrinterUpload.jsx` | Componente UI para seleccionar y enviar archivos |
| `src/components/PrinterUpload.module.css` | Estilos del componente |

## 🚀 Cómo Usar

### 1. En tu componente React

```javascript
import PrinterUpload from './components/PrinterUpload'

export default function MyPage() {
  return (
    <>
      <h1>Mi Página</h1>
      <PrinterUpload />
    </>
  )
}
```

### 2. O usarlo directamente con IPC

```javascript
// Seleccionar archivo
const result = await window.electron.selectFile();
if (result.success) {
  console.log('Archivo:', result.filePath);
}

// Enviar archivo
const uploadResult = await window.electron.uploadFile('/ruta/archivo.gcode');
if (uploadResult.success) {
  console.log('Enviado:', uploadResult.fileName);
}

// Escuchar confirmación
const unsubscribe = window.electron.onFileUploaded((data) => {
  console.log('Archivo subido a:', data.remotePath);
});
```

## 🔧 Configuración Impresora

En `src-electron/main.js`, actualiza estas líneas:

```javascript
const PRINTER_IP = '192.168.1.50';      // Tu IP local
const ACCESS_CODE = '12345678';         // Tu access code
const SERIAL_NUMBER = '01S00A...';      // Tu número de serie
```

### Credenciales FTP

Por defecto:
- **Usuario**: `bblp`
- **Contraseña**: `123456`
- **Puerto**: `990` (FTPS seguro)
- **Host**: Tu IP de impresora

Si necesitas cambiar, edita en `ftp-client.js`:

```javascript
async connect() {
  await this.client.access({
    host: this.ip,
    user: 'bblp',           // ← cambiar aquí
    password: '123456',     // ← cambiar aquí
    port: 990,              // ← cambiar aquí
  });
}
```

## 📊 Flujo de Subida

```
1. Usuario clickea "Seleccionar"
   ↓
2. Dialog abre (solo .gcode, .gc, .gco)
   ↓
3. Usuario elige archivo
   ↓
4. Componente muestra archivo seleccionado
   ↓
5. Usuario clickea "Enviar"
   ↓
6. Conecta a FTP en puerto 990
   ↓
7. Sube archivo a /sdcard/cache/
   ↓
8. Desconecta y confirma ✅
   ↓
9. Componente muestra "Subida exitosa"
```

## 🐛 Troubleshooting

### "No se pudo conectar al FTP"

- ❌ IP incorrecta → chequea en impresora
- ❌ Puerto 990 bloqueado → firewall
- ❌ Credenciales incorrectas → usuario/contraseña

### "Archivo no encontrado"

- Chequea que la ruta sea absoluta
- Verifica permisos de lectura

### Logs en DevTools

En consola verás:

```
✅ Conectado a FTP en 192.168.1.50
📤 Subiendo archivo.gcode a /sdcard/cache/archivo.gcode...
✅ Archivo archivo.gcode subido exitosamente
```

## 📦 Dependencia

- **basic-ftp** v6.2.6+

Instalada con: `pnpm install basic-ftp`

## 🎯 Próximas Mejoras

- [ ] Cancelar subida en progreso
- [ ] Mostrar directorio disponible de impresora
- [ ] Borrar archivos remotos
- [ ] Detección automática de dispositivos en LAN
- [ ] Historial de archivos enviados
