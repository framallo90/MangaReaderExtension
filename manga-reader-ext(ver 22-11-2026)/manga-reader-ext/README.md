# 📖 Manga Reader v2.6 — Guardar capítulos y descargar rangos

Guarda capítulos de manga como PDF (y/o imágenes sueltas), sin las páginas de publicidad. Nueva: descarga un rango de capítulos especificando una dirección con `{n}`.

## Instalación

1. Descomprimí el ZIP
2. `chrome://extensions/` → Modo desarrollador ON → **Cargar descomprimida**
3. Si actualizás desde una versión anterior: botón 🔄 en la extensión y **recargá la página del manga (F5)**

## Uso

### Guardar un capítulo (uno a la vez)

1. Abrí el capítulo
2. `Alt+S`, o clic derecho → **Guardar capítulo (PDF / CBZ)**, o el ícono de la extensión → **💾 Guardar capítulo**
3. Escribí el nombre del tomo y dale a **Guardar**

El nombre se arma solo a partir del título de la página: serie, saga (por ahora solo One Piece) y número con ceros adelante para que ordenen bien, por ejemplo `One Piece/11 Saga Final/One Piece 1134`. Podés editarlo antes de guardar.

Usá `/` en el nombre para armar carpetas: `One Piece/Tomo 110` → `Descargas/MangaReader/One Piece/Tomo 110.pdf`.

### Descargar un rango de capítulos

1. Abrí **un** capítulo de la serie para confirmar que el sitio se detecta como capítulo (las miniaturas muestran páginas, no logos/banners)
2. Clic en el ícono de la extensión → **📦 Descargar rango de capítulos**
3. En **Dirección**, pegá la URL de un capítulo y reemplazá el número por `{n}`

   Ejemplo: si el capítulo 5 está en `https://sitio.com/leer/5`, poné `https://sitio.com/leer/{n}`

4. En **Del capítulo** y **Al capítulo**, poné el rango (ej: del 1 al 3)
5. En **Carpeta de la serie**, poné el nombre (ej: `Dragon Ball`)
6. Elegí formato (PDF, CBZ, imágenes) y dale a **Descargar rango**

La extensión bajará cada capítulo uno tras otro. Si algún capítulo no tiene páginas (URL mal formada, páginas cifradas, etc.), se detiene y te muestra la dirección para que la revises.

Cada capítulo se guarda en `Descargas/MangaReader/<carpeta>/<serie> <NNNN>.<ext>`.

## Burbuja flotante

En las páginas que parecen un capítulo aparece una burbuja 💾.

- **Clic**: abre "Guardar capítulo"
- **Arrastrar**: la movés a donde no moleste; recuerda la posición
- **i**: muestra los controles rápidos y el botón para ocultarla
- Se activa o desactiva desde el ícono de la extensión

## Avisos

- **✔ Ya lo guardaste**: la extensión recuerda cada capítulo guardado completo (con todas sus páginas) y te avisa al abrir el diálogo, aunque le cambies el nombre.
- **⚠️ Pueden faltar páginas**: si no llegaste al final de la página o alguna página del capítulo no cargó. El botón **Recorrer la página** baja sola hasta el final, espera a que carguen las imágenes y vuelve a donde estabas.
- Las imágenes que el navegador todavía no bajó se cargan y se incluyen solas, y el conteo se actualiza a medida que aparecen páginas nuevas.

## Filtro de publicidad

El diálogo muestra una miniatura por cada imagen encontrada. Las que no parecen del capítulo vienen destildadas y con la etiqueta **AD**:

- imágenes fuera de la carpeta donde está la mayoría de las páginas (logos, banners)
- imágenes que son un link a otro sitio
- GIF animados
- últimas páginas con un formato distinto al resto (créditos o avisos del scan)

Hacé clic en cualquier miniatura para incluirla o quitarla. Pasá el mouse por encima para ver el motivo.

## CBZ (para lectores de cómics)

Tildá **📚 CBZ** en el diálogo. Es el formato estándar de las apps de cómics en tablet.

- Lleva las imágenes originales sin tocar (sin recomprimir ni convertir), numeradas `001`, `002`…
- Incluye `ComicInfo.xml` con serie, número, saga y sentido de lectura derecha → izquierda, que muchos lectores usan para ordenar la biblioteca
- La extensión recuerda qué formatos tildaste

CBR no está disponible: es un RAR, formato propietario que no se puede generar desde una extensión.

## El PDF

- Una página por imagen, con su tamaño original
- Las JPG se incrustan sin recomprimir; WebP/PNG se convierten a JPG de alta calidad
- El nombre del tomo queda como título, y está marcado como lectura derecha → izquierda

## Limitaciones del descarga por rango

- **URLs con código al final en vez de número** (`/viewer/2010289`, `/leer/a8f3c2`): no sirve `{n}` porque no hay un número secuencial. Usá el modo "Guardar capítulo" uno por uno.
- **Cuando el número de la URL no es el del capítulo** (`/serie/12/pagina/3`): `{n}` reemplaza en la URL pero puede que el sitio interprete otro número. Probá con 1 capítulo primero.
- **Número de URL ≠ número del título**: si la URL dice `capitulo=10` pero el título dice `Capítulo 11`, el archivo se nombra con el número de la URL (`{n}`).
- **Páginas cifradas (blob:) o en `<canvas>`**: el lote se detiene y avisa que no hay páginas.
- **Imágenes de fondo CSS**: no se detectan.
- **Páginas dentro de `<iframe>`**: no se detectan.

El atajo se puede cambiar en `chrome://extensions/shortcuts`.
