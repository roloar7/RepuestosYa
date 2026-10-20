# 📦 Soporte RAR (y otros formatos)

## ✨ Formatos soportados

| Formato | Descripción | Estado |
|---------|-------------|--------|
| `.zip` | Estándar, máxima compatibilidad | ✅ Completo |
| `.rar` | Compresión WinRAR | ✅ Soportado |
| `.7z` | 7-Zip, mejor compresión | 🔧 Soporte básico |
| Multipart | `.zip.001`, `.rar.001`, etc | ✅ Automático |

---

## 🎯 ¿Cuándo usar RAR?

### ZIP
- ✅ **Máxima compatibilidad** (navegadores, Windows, etc)
- ✅ Compresión decente (70% de reducción típica)
- ✅ Multipart nativo (.zip.001, .002, etc)
- ✅ Recomendado para la mayoría de casos

### RAR
- ✅ **Mejor compresión** que ZIP (hasta 75-80%)
- ✅ Ya tienes archivos en RAR
- ⚠️ Requiere librería JavaScript (rarjs)
- ⚠️ Compatibilidad ligeramente menor

### 7-Zip
- ✅ Compresión excelente
- ⚠️ Pobre soporte JavaScript
- ❌ Actualmente sin soporte completo

---

## 🚀 Flujo RAR

### Upload (Admin)

**Si tienes archivo en RAR:**

1. Divide en partes (WinRAR o 7-Zip):
   ```
   RepuestosYa-Admin-1.0.0.rar.001 (10 MB)
   RepuestosYa-Admin-1.0.0.rar.002 (10 MB)
   ...
   ```

2. En admin panel:
   - Input file: selecciona todos `.rar.00X`
   - Sistema detecta automáticamente
   - Click "Publicar"

3. Sube a Storage y BD:
   ```
   download_url: ...RepuestosYa-Admin-1.0.0.rar  (sin .001)
   total_parts: 9
   file_size_bytes: 90000000
   ```

### Download (User)

```
1. Click "Descargar v1.0.0"
2. Sistema detecta: tipo = RAR, partes = 9
3. Descarga 9 partes .rar.001 ... .rar.009
4. Ensambla en RAR
5. Descomprime (rarjs)
6. Descarga .exe
```

---

## 📊 Comparativa de compresión

**Archivo original: RepuestosYa-Admin-1.0.0.exe = 120 MB**

| Formato | Tamaño | Reducción | Multipart |
|---------|--------|-----------|-----------|
| ZIP | 36 MB | 70% | ✅ .zip.001, .002 |
| RAR | 30 MB | 75% | ✅ .rar.001, .002 |
| 7-Zip | 25 MB | 79% | ✅ .7z.001, .002 |

**Conclusión**: RAR es más pequeño pero ZIP es más compatible.

---

## 🔧 Preparar archivos RAR

### Windows: WinRAR

1. Click derecho: `RepuestosYa-Admin-1.0.0.zip`
2. **Agregar a archivo...**
3. Nombre: `RepuestosYa-Admin-1.0.0.rar`
4. **Configuración avanzada**
5. **Dividir en volúmenes**: `10 M`
6. OK

Genera: `.rar.001`, `.rar.002`, etc.

### Windows: 7-Zip

1. Click derecho: archivo
2. **7-Zip → Agregar a archivo**
3. Formato: `7z` o `zip`
4. Tamaño volumen: `10 M`

### Mac/Linux: Command line

```bash
# ZIP (multipart)
zip -r -s 10m RepuestosYa-Admin-1.0.0.zip archivo.exe
# Genera: .z01, .z02, ... (renombrar a .zip.001, etc)

# RAR (requiere rar instalado)
rar a -v10m RepuestosYa-Admin-1.0.0.rar archivo.exe
# Genera: .rar, .r00, .r01 (renombrar a .rar.001, etc)

# 7-Zip
7z a -v10m RepuestosYa-Admin-1.0.0.7z archivo.exe
# Genera: .7z.001, .7z.002, etc
```

---

## 🎨 UI/UX

### Admin panel

**Aceptar archivos:**
```
Input: .zip, .rar, .7z (y .001, .002, etc)

Ejemplo de selección:
  ✅ RepuestosYa-Admin-1.0.0.rar.001
  ✅ RepuestosYa-Admin-1.0.0.rar.002
  ...
  ✅ RepuestosYa-Admin-1.0.0.rar.009
  
  "9 archivo(s) seleccionado(s): 90.00 MB"
```

**Status durante upload:**
```
"Subiendo parte 1/9..."
"Subiendo parte 2/9..."
...
"✅ Release v1.0.0 publicada (9 partes, 90 MB total)"
```

### Botón descargar

```
"Descargar v1.0.0"
Tooltip: "Descarga 9 partes (se desensamblan automáticamente)"
```

---

## 🔍 Detección automática

Sistema detecta formato por nombre de archivo:

```javascript
detectArchiveType('RepuestosYa-Admin-1.0.0.rar')       → 'rar'
detectArchiveType('RepuestosYa-Admin-1.0.0.zip')       → 'zip'
detectArchiveType('RepuestosYa-Admin-1.0.0.7z')        → '7z'
detectArchiveType('RepuestosYa-Admin-1.0.0.rar.001')   → 'rar'
detectArchiveType('RepuestosYa-Admin-1.0.0.zip.001')   → 'zip'
```

---

## 📈 Performance

### Compresión en servidor (futuro)

Hoy: Servidor NO comprime. Usuario sube archivo ya comprimido.

Mejora futura: Servidor comprime en RAR/7z (mejor compresión).

### Descompresión en navegador

- ZIP: Ultra rápida (nativa del navegador)
- RAR: Más lenta (librería JavaScript rarjs)
- 7z: Muy lenta (sin soporte nativo)

**Recomendación**: Usa ZIP para máxima velocidad.

---

## ⚠️ Limitaciones y notas

### RAR

✅ **Soportado:**
- Descomprimir en navegador (rarjs)
- Multipart (.rar.001, .002, etc)
- Automático en download

⚠️ **Limitaciones:**
- rarjs es menos estable que JSZip
- Archivos RAR grandes (>500MB) pueden ser lentos
- Si falla, user debe reintentar

### 7-Zip

⚠️ **Limitaciones graves:**
- No hay librería JavaScript confiable
- Soporte experimental
- No recomendado para esta arquitectura

❌ **Alternativa**: Convertir .7z a .zip antes de subir.

---

## 🧪 Testing RAR

### Test 1: Archivo único

1. Crear: `test.rar` (10 MB)
2. Upload via admin panel
3. Check BD: `total_parts = 1`
4. Download y verificar .exe

### Test 2: Multipart

1. Crear: `test.rar.001`, `.002`, `.003` (3.3 MB c/u)
2. Upload todos juntos
3. Check BD: `total_parts = 3`
4. Download: debe descargar 3 partes + ensamblar

---

## 🔧 Troubleshooting RAR

### "Error al descomprimir RAR"

**Causa**: rarjs no puede procesar el archivo

**Soluciones:**
1. Reconvertir a ZIP:
   ```bash
   # WinRAR
   Archivo → Convertir → Convertir a ZIP
   ```
2. O reintentar: a veces rarjs falla por timing

### "Archivos no encontrados en RAR"

**Causa**: rarjs no extrajo correctamente

**Debug**:
```javascript
// En console del navegador
const response = await fetch(downloadUrl)
const blob = await response.blob()

// Intentar extractor manually (para debug)
console.log('RAR blob size:', blob.size)
```

---

## 📝 Próximas mejoras

- [ ] Convertir RAR→ZIP en servidor (no en browser)
- [ ] Soporte 7-Zip con mejor librería
- [ ] Barra de progreso visual
- [ ] Retry automático si falla descompresión

---

## 🎯 Recomendación final

### ¿Cuál usar?

```
Si quieres máxima compatibilidad:
  → ZIP (recomendado)

Si ya tienes archivos en RAR:
  → RAR (funciona, pero más lento en descompresión)

Si necesitas máxima compresión:
  → ZIP (mejor relación compatibilidad/compresión)
```

**Para RepuestosYa**: **Usa ZIP** por estabilidad y velocidad. 🚀

---

**¿Preguntas?** Ver MULTIPART_DOWNLOADS.md o archiveUtils.js. 📚
