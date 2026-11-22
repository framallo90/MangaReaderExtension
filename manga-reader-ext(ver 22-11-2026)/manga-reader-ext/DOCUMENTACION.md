# Manga Reader — Documentación técnica y de uso

**Versión:** 2.6.0 · **Tipo:** extensión de Chrome (Manifest V3) · **Idioma de la interfaz:** español

---

## Índice

1. [Qué es y qué hace](#1-qué-es-y-qué-hace)
2. [Instalación y actualización](#2-instalación-y-actualización)
3. [Cómo se usa](#3-cómo-se-usa)
4. [Funciones en detalle](#4-funciones-en-detalle)
5. [Arquitectura](#5-arquitectura)
6. [Recorrido completo de un guardado](#6-recorrido-completo-de-un-guardado)
7. [Formatos de salida por dentro](#7-formatos-de-salida-por-dentro)
8. [Datos que guarda la extensión](#8-datos-que-guarda-la-extensión)
9. [Permisos y por qué se necesitan](#9-permisos-y-por-qué-se-necesitan)
10. [Valores fijos (constantes)](#10-valores-fijos-constantes)
11. [Cómo se probó](#11-cómo-se-probó)
12. [Limitaciones conocidas](#12-limitaciones-conocidas)
13. [Cómo modificarla](#13-cómo-modificarla)
14. [Solución de problemas](#14-solución-de-problemas)
15. [Historial de versiones](#15-historial-de-versiones)

---

## 1. Qué es y qué hace

Manga Reader guarda **el capítulo de manga que tenés abierto** en el navegador, en el formato que elijas, con un nombre y una carpeta armados automáticamente.

Lo que hace, en resumen:

- Encuentra las páginas del capítulo en la página web, en orden de lectura.
- Descarta lo que no es el capítulo: logo del sitio, banners, avisos con link a otro sitio, GIF, y páginas de créditos o avisos al final.
- Te muestra miniaturas de todas las imágenes para que confirmes o corrijas la selección con un clic.
- Arma el nombre a partir del título de la página: serie, saga (One Piece) y número, por ejemplo `One Piece/11 Saga Final/One Piece 1134`.
- Guarda en **PDF**, **CBZ** (formato de lectores de cómics) y/o **imágenes sueltas**, en `Descargas/MangaReader/…`.
- Te avisa si ese capítulo ya lo guardaste antes y si pueden faltar páginas por cargar.
- Muestra una burbuja flotante 💾 arrastrable con ayuda de controles rápidos.
- **Descarga por lotes:** desde una página de listado de capítulos de una serie, podés seleccionar varios capítulos y descargarlos uno tras otro como PDF, CBZ y/o imágenes sueltas.

Lo que **no** hace: recorrer capítulos solo ni descargar series completas. Siempre trabaja sobre la página que tenés abierta, y cada guardado lo iniciás vos.

---

## 2. Instalación y actualización

### Instalación (una sola vez)

1. Tener la carpeta `manga-reader-ext` de la versión que quieras usar. En esta compu cada versión vive en su propia carpeta: `D:\MangaReaderExtension\manga-reader-ext(ver DD-MM-AAAA)\manga-reader-ext`.
2. En Chrome, abrir `chrome://extensions`.
3. Activar **Modo de desarrollador** (arriba a la derecha).
4. Clic en **Cargar descomprimida** y elegir la carpeta `manga-reader-ext`.

### Actualización

1. Las versiones nuevas se crean en una carpeta nueva (`manga-reader-ext(ver DD-MM-AAAA)`), sin tocar la anterior. Para pasar a la nueva: en `chrome://extensions` quitar la tarjeta vieja y **Cargar descomprimida** la carpeta nueva. Si solo cambiaron archivos dentro de la misma carpeta, alcanza con el paso 2.
2. En `chrome://extensions`, tocar 🔄 en la tarjeta de la extensión.
3. **Recargar con F5 las pestañas de manga que estaban abiertas.** Las pestañas abiertas antes de actualizar siguen con el script viejo hasta que se recargan; si no, el popup muestra "Recargá la página (F5) y probá de nuevo".

### Dispositivos

Funciona en Chrome de escritorio (Windows, macOS, Linux). Chrome para Android y para iPad no acepta extensiones. Para leer en la tablet: guardar en la compu y pasar los archivos (por ejemplo, sincronizando la carpeta de descargas con OneDrive).

---

## 3. Cómo se usa

### Formas de abrir el diálogo "Guardar capítulo"

| Forma | Detalle |
|---|---|
| Burbuja flotante 💾 | Clic en la burbuja (aparece en páginas que parecen un capítulo) |
| Atajo de teclado | `Alt+S` (se puede cambiar en `chrome://extensions/shortcuts`) |
| Menú contextual | Clic derecho en la página → **Guardar capítulo (PDF / CBZ)** |
| Ícono de la extensión | Popup → **Guardar capítulo** |

Ninguna de estas formas necesita configuración previa ni clave de API.

### El diálogo

```
┌ 💾 Guardar capítulo ──────────────── ✕ ┐
│ NOMBRE DEL TOMO                         │
│ [One Piece/11 Saga Final/One Piece 1134]│
│ Usá / para carpetas                     │
│ ☑ PDF   ☐ CBZ   ☐ Imágenes              │
│ ✔ Ya lo guardaste el 20/11/2026 (15 p.) │  ← solo si ya existe
│ 📄 Descargas/MangaReader/…/1134.pdf     │  ← ruta exacta
│ 15 de 16 páginas · 1 descartada…        │
│ ⚠️ no llegaste al final… [Recorrer]      │  ← solo si hace falta
│ [miniaturas: clic = incluir / quitar]   │
│ [ Guardar ]                             │
│ ✅ PDF de 15 páginas (24.3 MB)           │
└─────────────────────────────────────────┘
```

- **Nombre:** viene completado. Se puede editar; cada `/` crea una carpeta.
- **Formatos:** PDF, CBZ e Imágenes se pueden combinar. La extensión recuerda qué tildaste.
- **Miniaturas:** las sospechosas de no ser del capítulo vienen apagadas y con etiqueta **AD**. Pasando el mouse se ve el motivo. Un clic invierte la selección.
- **Teclado:** `Enter` guarda, `Esc` cierra.
- **El diálogo se puede arrastrar** desde su barra de título.

### La burbuja flotante

- **Clic:** abre el diálogo.
- **Arrastrar:** la mueve a cualquier lugar de la pantalla; recuerda la posición para todos los sitios.
- **Botón "i":** abre el cartel de controles rápidos, con el botón **Ocultar burbuja**.
- **Reactivar:** casilla "Mostrar burbuja flotante en los capítulos" en el popup de la extensión.

---

## 4. Funciones en detalle

### 4.1 Detección de páginas (`collectPages`)

Recorre todos los `<img>` de la página en orden del documento (que es el orden de lectura del sitio) y, para cada uno:

1. **Obtiene la URL real** (`imgUrl`):
   - Si la imagen tiene un atributo de carga diferida (`data-src`, `data-lazy-src`, `data-original`) y todavía muestra un placeholder (menos de 250 px de ancho), usa la URL del atributo.
   - Si no, usa `src` / `currentSrc`.
   - Descarta URLs `data:` y `blob:` y convierte rutas relativas en absolutas.
2. **Elimina duplicados** (la misma URL dos veces cuenta una sola vez).
3. **Clasifica por estado de carga:**
   - *Ya cargada:* usa su tamaño real (`naturalWidth`/`naturalHeight`).
   - *Sin cargar* (lazy con placeholder, o `loading="lazy"` que el navegador aún no bajó): la carga en segundo plano con `new Image()` para medirla (`probeSize`, hasta 8 s). Esto también deja la imagen en caché.
   - *Rota* (cargó pero mide 0): se anota como fallida.
4. **Descarta lo chico:** menos de 250 px de ancho o de alto (íconos, logos chicos, banners finos).

El resultado es una lista `{url, w, h, external, flag}` en orden.

### 4.2 Filtro de publicidad (`flagNonPages`)

Marca con un motivo (`flag`) lo que probablemente no es una página del capítulo. Las marcadas vienen destildadas en el diálogo.

| Regla | Motivo que se muestra | Qué atrapa |
|---|---|---|
| La imagen está dentro de un link a otro dominio | `enlace a otro sitio` | Avisos publicitarios clicables |
| Está fuera de la "carpeta del capítulo" | `fuera de la carpeta del capítulo` | Logo del sitio, banners, imágenes de otras secciones |
| Termina en `.gif` | `GIF animado` | Banners animados |
| Está entre las últimas 3 y su proporción no encaja con el resto | `formato distinto al resto` | Páginas de créditos, "unite al scan", avisos al final |

**Carpeta del capítulo:** es la carpeta de URL donde está la mayoría de las imágenes (por ejemplo `/mangafiles/es/todos/1134/`). Solo se usa si tiene al menos 3 imágenes y al menos la mitad del total; si no, esta regla no se aplica.

**Proporción "que encaja":** se calcula la mediana de ancho/alto de las páginas buenas y se compara cada página contra ella. Encaja si la relación está entre 0,75 y 1,33 (página normal), entre 1,6 y 2,4 (doble página) o entre 0,42 y 0,6 (página simple en un capítulo con mayoría de dobles). Solo se revisa la cola final contigua: apenas una página encaja, se deja de marcar. Requiere al menos 5 páginas buenas.

### 4.3 Nombre y carpetas automáticos (`detectChapter`, `suggestName`)

1. Toma el título de la página: primero `og:title`, si no `document.title`, si no el primer `<h1>`.
2. Le quita el nombre del sitio:
   - todo lo que está después de ` | `;
   - el último tramo después de ` - ` si ese tramo no tiene números y el primero sí (`One Piece Manga 1134 - One Piece Fans` → `One Piece Manga 1134`).
3. Separa **serie** y **número** con una expresión que acepta formatos como `Serie 12`, `Serie Manga 12`, `Serie - Capítulo 12`, `Serie Chapter 12`, `Serie Ch. 12`, `Serie Cap. 12`, `Serie #12`. La palabra clave tiene que ir **separada** de la serie por un espacio o guion: así `Bleach 686` da la serie `Bleach` y no `Blea` + `ch 686` (error de la v2.4). Acepta capítulos con decimal (`1134.5`). Si el título no tiene número, usa el último número de la ruta de la URL o, si no hay, un parámetro como `?capitulo=12`, `?cap=`, `?chapter=`, `?ch=`, `?c=`, `?ep=`.
4. Arma el nombre:
   - número con 4 dígitos (`0001`, `1134`) para que ordene bien alfabéticamente; el decimal se conserva (`1134.5`), así no pisa al capítulo entero;
   - si la serie tiene tabla de sagas, agrega la carpeta de saga con prefijo numérico (para elegir la saga se usa la parte entera: el `1057.5` va a `10 Wano`).

Resultado: `Serie/NN Saga/Serie NNNN` o, sin tabla de sagas, `Serie/Serie NNNN`.

**Tabla de sagas de One Piece** (por número de capítulo):

| Carpeta | Capítulos |
|---|---|
| 01 East Blue | 1–100 |
| 02 Alabasta | 101–216 |
| 03 Skypiea | 217–302 |
| 04 Water 7 | 303–441 |
| 05 Thriller Bark | 442–489 |
| 06 Guerra en la Cumbre | 490–597 |
| 07 Isla Gyojin | 598–653 |
| 08 Dressrosa | 654–801 |
| 09 Whole Cake Island | 802–908 |
| 10 Wano | 909–1057 |
| 11 Saga Final | 1058 en adelante |

Como la saga sale del número, al pasar de un capítulo a otro la carpeta cambia sola cuando corresponde (el 1057 va a `10 Wano`, el 1058 a `11 Saga Final`).

**Limpieza de nombres** (`sanitizeSegment`): cada tramo del nombre se limpia para que Windows lo acepte. Reemplaza `< > : " \ | ? *` y caracteres de control por espacios, quita puntos y espacios al inicio y al final, limita a 100 caracteres y evita nombres reservados (`CON`, `NUL`, `COM1`…). Los acentos se conservan.

**Respaldo:** si el título no se puede interpretar, se usa el título tal cual. En ese caso, si antes guardaste algo de ese mismo sitio en una carpeta, se antepone esa carpeta.

### 4.4 Aviso de páginas faltantes

El diálogo muestra un aviso naranja cuando:

- **una o más páginas del capítulo no cargaron** (fallaron o tardaron más de 8 s). Solo cuentan las de la carpeta del capítulo: un banner roto del sitio no dispara el aviso;
- **no llegaste al final de la página** (con un margen de 300 px).

El botón **Recorrer la página** baja la página de a 90 % de pantalla cada 300 ms hasta el final (relee la altura en cada paso porque puede crecer al cargar imágenes), espera 600 ms, vuelve a la posición original y recalcula las páginas.

Además, mientras el diálogo está abierto, cada vez que termina de cargar una imagen nueva de la página se recalcula la lista (con 800 ms de espera para agrupar cargas seguidas). Lo que tildaste o destildaste a mano se respeta.

### 4.5 Marca de "ya guardado"

- Cuando un guardado termina **sin errores y con todas las páginas elegidas**, se anota en `savedChapters` con la ruta, la fecha, la cantidad de páginas y la dirección de la página. Si alguna página no se pudo leer (en el PDF, el CBZ o las imágenes), el archivo se guarda igual pero **no** se anota, y el diálogo lo avisa para que lo vuelvas a guardar.
- La dirección que se anota (`pageKey`) es la ruta más los parámetros después del `?` (ordenados), sin los de seguimiento (`utm_…`, `fbclid`, `gclid`, `ref`). Así, en los lectores donde todos los capítulos comparten la ruta y cambian por `?capitulo=12`, cada capítulo se reconoce por separado.
- Al abrir el diálogo, se busca primero por la ruta del nombre actual y, si no coincide, por la dirección de la página. Así avisa aunque le cambies el nombre, e indica con qué nombre lo guardaste.
- Es solo informativo: no impide volver a guardar. Si el archivo ya existe, Chrome agrega `(1)`, `(2)`… al nombre.

### 4.6 Formatos

| Formato | Contenido | Imágenes |
|---|---|---|
| **PDF** | Un archivo `.pdf`, una página por imagen | JPG sin recomprimir; WebP/PNG/GIF/AVIF convertidas a JPG calidad 0,92 |
| **CBZ** | Un archivo `.cbz` (ZIP) + `ComicInfo.xml` | Todas las originales, sin tocar |
| **Imágenes** | Carpeta con `pagina_001.jpg`, `pagina_002.png`… | Todas las originales, sin tocar |

Ver la sección 7 para el detalle interno de cada uno.

### 4.7 Burbuja flotante

- **Cuándo aparece:** cuando hay 3 o más imágenes ya cargadas de al menos 250 px de ancho y 600 px de alto en la misma carpeta (las miniaturas del diálogo no cuentan). Se revisa a los 1,5 s y a los 5 s de cargar la página, y además cada vez que termina de cargar una imagen o bajás por la página (agrupado cada 700 ms), hasta que aparece. Así también aparece en los sitios que cargan las páginas a medida que bajás. Si la burbuja está oculta, no se revisa.
- **Arrastre:** usa Pointer Events con captura del puntero. Un movimiento menor a 5 px se considera clic. La posición se guarda como distancia al borde derecho e inferior (`fabPos`) y se limita para que la burbuja nunca quede fuera de pantalla.
- **Cartel de ayuda:** se abre hacia abajo si la burbuja está a menos de 300 px del borde superior, y hacia la derecha si está a menos de 280 px del borde izquierdo. Se cierra al hacer clic fuera.
- **Ocultar/mostrar:** guarda `fabEnabled` en el almacenamiento; todas las pestañas escuchan el cambio y muestran u ocultan la burbuja al instante.

### 4.8 Descarga por lotes (varios capítulos)

Desde el ícono de la extensión, el botón **📦 Descargar serie** abre un diálogo para descargar varios capítulos de una vez. Funciona en páginas de listado de serie (por ejemplo `one-piece-fans2.com/manga/es/todos`):

1. La extensión detecta los enlaces a capítulos en la página actual (URLs que terminan en número de capítulo).
2. Muestra una lista con los capítulos encontrados, cada uno con su casilla de selección.
3. Podés seleccionar todos, ninguno, o capítulos individuales.
4. Elegís los formatos (PDF, CBZ, imágenes sueltas) y la carpeta de destino.
5. La extensión descarga cada capítulo seleccionado uno tras otro: fetch del capítulo, extrae las imágenes, y arma el PDF/CBZ/imágenes igual que con un capítulo suelto.

Cada capítulo se guarda en `Descargas/MangaReader/<carpeta>/<serie> <número>.<ext>`, con el número en 4 dígitos para que ordenen bien alfabéticamente.

---

## 5. Arquitectura

### 5.1 Archivos

| Archivo | Rol | Dónde corre |
|---|---|---|
| `manifest.json` | Declaración de la extensión, permisos, atajo, scripts | — |
| `content.js` | Detección de páginas, filtro, nombre, diálogo, burbuja | En cada pestaña (content script) |
| `styles.css` | Estilos del diálogo y la burbuja | Inyectado en cada pestaña |
| `background.js` | Menú contextual, atajo, descargas, coordinación de PDF/CBZ | Service worker |
| `offscreen.html` / `offscreen.js` | Armado de PDF y CBZ | Documento offscreen (invisible) |
| `popup.html` / `popup.js` | Botón "Guardar capítulo" y opción de la burbuja | Ventana del ícono |
| `icons/` | Íconos de 48 y 128 px | — |
| `README.md` | Guía corta de uso | — |

### 5.2 Por qué hay un documento offscreen

En Manifest V3 el código de fondo corre en un **service worker**, que no tiene `URL.createObjectURL`. Sin eso no se puede entregar a `chrome.downloads` un archivo grande generado en memoria (las `data:` URL tienen límite de tamaño). La solución recomendada por Chrome es un **documento offscreen**: una página invisible de la extensión que sí tiene esas APIs. Ahí se bajan las imágenes, se arma el PDF o el CBZ, se crea una `blob:` URL y el service worker la descarga.

El documento se crea al primer guardado y se cierra solo cuando no quedan trabajos ni descargas pendientes.

### 5.3 Diagrama de componentes

```
                ┌─────────────────────────────┐
  Alt+S ───────▶│       background.js         │◀────── Menú contextual
                │      (service worker)       │
                └──┬───────────▲──────────┬───┘
   {action:'save'} │           │          │ chrome.downloads.download()
                   ▼           │          ▼
┌──────────────────────────┐   │    ┌──────────────┐
│  content.js (pestaña)    │   │    │  Descargas/  │
│  · burbuja 💾            │───┘    │  MangaReader │
│  · diálogo + miniaturas  │ buildPdf / buildCbz /   └──────────────┘
│  · detección y filtro    │ downloadImage                 ▲
└──────────────────────────┘                               │ blob: URL
          ▲  {action:'save'}       ┌───────────────────────┴──┐
┌─────────┴────────┐               │ offscreen.js             │
│ popup.js         │               │ · baja imágenes (x4)     │
└──────────────────┘               │ · arma PDF / ZIP         │
                                   └──────────────────────────┘
```

### 5.4 Mensajes entre partes

| Mensaje | De → a | Para qué |
|---|---|---|
| `{action:'save'}` | background/popup → content | Abrir el diálogo |
| `{action:'buildPdf'\|'buildCbz', urls, title, meta, filename}` | content → background | Pedir el archivo; responde `{ok, pages, failed, sizeKB, savedAs}` |
| `{action:'downloadImage', url, filename}` | content → background | Descargar una imagen suelta |
| `{target:'offscreen', action:'buildPdf'\|'buildCbz', …, jobId}` | background → offscreen | Armar el archivo; responde `{ok, url, pages, failed, sizeKB}` |
| `{target:'background', action:'pdfProgress', jobId, done, total}` | offscreen → background | Progreso de descarga de páginas |
| `{action:'pdfProgress', done, total}` | background → content | Progreso reenviado a la pestaña que pidió el archivo |
| `{target:'offscreen', action:'revoke', url}` | background → offscreen | Liberar la `blob:` URL cuando terminó la descarga |

El campo `target` evita que el documento offscreen procese mensajes de las pestañas y que el service worker procese los del offscreen.

### 5.5 Aislamiento del content script

- `content.js` está envuelto en una función que se ejecuta una sola vez por pestaña (bandera `window.__mangaReaderV4`).
- Todo lo que inserta en la página usa los IDs `#mr-save` y `#mr-fab`, y los estilos están limitados a esos contenedores, para no romper el sitio.
- El campo del nombre detiene la propagación de teclas, así los atajos del sitio no se disparan mientras escribís.

---

## 6. Recorrido completo de un guardado

1. Abrís el diálogo (burbuja, `Alt+S`, menú contextual o popup). Background o popup mandan `{action:'save'}` a la pestaña.
2. `openSaveDialog` lee las preferencias y el registro de guardados, sugiere el nombre, dibuja el diálogo y empieza a escuchar el scroll y las cargas de imágenes.
3. `loadPages` → `collectPages` encuentra las páginas, mide las que faltan cargar y aplica el filtro. Se dibujan las miniaturas.
4. `refresh` actualiza la ruta de destino, el conteo, el aviso de "ya guardado" y el de páginas faltantes.
5. Tocás **Guardar**. `saveChapter`:
   - limpia el nombre y guarda las preferencias (formatos y carpeta por sitio);
   - toma las URLs de las miniaturas encendidas, en orden;
   - por cada formato elegido (PDF, CBZ) manda `buildPdf`/`buildCbz` al background, con un tiempo máximo de 60 s + 20 s por página.
6. El background registra el trabajo, se asegura de que exista el documento offscreen (reintenta una vez si se estaba cerrando) y le pasa el pedido.
7. El offscreen baja las páginas de a 4 en paralelo (30 s máximo cada una) manteniendo el orden, avisa el progreso, arma el archivo y devuelve una `blob:` URL.
8. El background descarga esa URL con `chrome.downloads` en `MangaReader/<nombre>.<ext>`. Si Chrome rechaza el nombre (por ejemplo, acentos en un sistema sin UTF-8), reintenta sin acentos y avisa con qué nombre quedó.
9. Si elegiste **Imágenes**, se descargan de a una (250 ms entre cada una) en `MangaReader/<nombre>/pagina_NNN.<ext>`.
10. Si todo salió bien, se anota el capítulo en `savedChapters`. El diálogo muestra el resultado.
11. Cuando Chrome termina la descarga, el background libera la `blob:` URL y, si no queda nada pendiente, cierra el documento offscreen.

---

## 7. Formatos de salida por dentro

### 7.1 PDF (`makePdf`)

El PDF se escribe a mano, sin librerías, en PDF 1.4:

- **Objetos:** 1 catálogo, 2 árbol de páginas, 3 metadatos, y luego 3 por página (página, imagen, contenido).
- **Tamaño de página:** igual al de la imagen en píxeles (1 px = 1 punto). Si un lado supera 14 400 puntos (límite práctico de muchos visores, típico en tiras largas tipo webtoon), la página se achica proporcionalmente; la imagen mantiene su resolución completa.
- **Imágenes JPG:** se incrustan tal cual (filtro `DCTDecode`), sin recomprimir. `jpegInfo` lee la cabecera del JPG y solo acepta baseline/progresivo de 8 bits en gris o color; un JPG CMYK, sin pérdida o aritmético se convierte.
- **Otros formatos:** se dibujan en un canvas con fondo blanco (para la transparencia) y se exportan como JPG de calidad 0,92, porque el formato PDF no admite WebP.
- **Metadatos:** título = último tramo del nombre (en UTF-16, así acepta acentos y japonés), productor "Manga Reader" y fecha de creación.
- **Lectura derecha → izquierda:** el catálogo declara `/ViewerPreferences << /Direction /R2L >>`, que los visores usan en la vista de doble página.

### 7.2 CBZ (`makeZip`, `comicInfo`)

- Es un **ZIP sin compresión** (las imágenes ya vienen comprimidas, comprimirlas otra vez no ahorra espacio), con nombres en UTF-8, escrito a mano con su CRC-32.
- **Imágenes:** las originales, byte a byte, numeradas `001`, `002`… (con más dígitos si hay más de 999). La extensión real se detecta leyendo los primeros bytes del archivo (`sniffExt`), no la URL.
- **`ComicInfo.xml`:** metadatos estándar que leen muchos lectores de cómics:

```xml
<ComicInfo>
  <Title>One Piece 1134</Title>
  <Series>One Piece</Series>
  <Number>1134</Number>
  <StoryArc>Saga Final</StoryArc>
  <PageCount>15</PageCount>
  <Web>https://…/manga/es/todos/1134</Web>
  <Manga>YesAndRightToLeft</Manga>
</ComicInfo>
```

`StoryArc` sale de la carpeta de saga del nombre (sin el prefijo numérico). `Manga` = `YesAndRightToLeft` le indica al lector que pase las páginas de derecha a izquierda.

**CBR no está disponible:** es un RAR, formato propietario que no se puede generar desde una extensión, y no aporta nada sobre CBZ.

### 7.3 Imágenes sueltas (`dlImage`)

1. Primero intenta que Chrome descargue la URL directamente (conserva el archivo original). `chrome.downloads.download()` responde apenas *empieza* la descarga, así que `waitDownload` espera el resultado real (hasta 20 s): si el servidor la corta (por ejemplo un 403), se pasa al paso 2. Si a los 20 s sigue bajando, se da por buena.
2. Si falla, el service worker la baja, corrige la extensión según el `Content-Type` que devuelve el servidor, y la descarga como `data:` URL. Si esa descarga también se corta, la imagen cuenta como fallida.

---

## 8. Datos que guarda la extensión

Todo se guarda en `chrome.storage.local`, solo en tu navegador. No se envía nada a ningún servidor.

| Clave | Contenido | Ejemplo |
|---|---|---|
| `savePdf` | ¿PDF tildado? (por defecto sí) | `true` |
| `saveCbz` | ¿CBZ tildado? (por defecto no) | `false` |
| `saveImgs` | ¿Imágenes tildado? (por defecto no) | `false` |
| `saveFolders` | Última carpeta usada por sitio | `{"one-piece-fans2.com": "One Piece/11 Saga Final"}` |
| `savedChapters` | Registro de guardados | `{"One Piece/11 Saga Final/One Piece 1134": {ts, pages: 15, url}}` |
| `fabEnabled` | ¿Mostrar la burbuja? (por defecto sí) | `true` |
| `fabPos` | Posición de la burbuja (px desde la derecha y desde abajo) | `{"r": 24, "b": 24}` |

Al desinstalar la extensión, estos datos se borran.

---

## 9. Permisos y por qué se necesitan

| Permiso | Para qué |
|---|---|
| `<all_urls>` (host) | Inyectar el diálogo en cualquier sitio de manga y bajar las imágenes de otros dominios o CDNs sin bloqueos de CORS |
| `downloads` | Guardar los archivos en `Descargas/MangaReader` con carpetas |
| `offscreen` | Crear el documento invisible que arma PDF y CBZ |
| `storage` | Recordar preferencias, carpetas, guardados y la burbuja |
| `contextMenus` | La opción del clic derecho |
| `activeTab` | Comunicarse con la pestaña actual desde el popup |

---

## 10. Valores fijos (constantes)

| Valor | Dónde | Significado |
|---|---|---|
| 250 px | `MIN_SIDE` (content) | Tamaño mínimo de ancho y alto para considerar una imagen como página |
| 8 s | `probeSize` | Espera máxima para medir una imagen sin cargar |
| 3 | `flagNonPages` | Últimas páginas que se revisan por formato distinto |
| 300 px | `atBottom` | Margen para considerar que llegaste al final |
| 800 ms | `onImageLoad` | Espera antes de recalcular cuando cargan imágenes nuevas |
| 90 % / 300 ms | `scanPage` | Paso y pausa al recorrer la página |
| 4 | `FETCH_CONCURRENCY` (offscreen) | Descargas de páginas en paralelo |
| 30 s | `fetchBytes` | Tiempo máximo por página al armar PDF/CBZ |
| 14 400 pt | `PDF_MAX_SIDE` | Lado máximo de una página del PDF |
| 0,92 | `loadPage` | Calidad JPG al convertir WebP/PNG para el PDF |
| 60 s + 20 s/página | `saveChapter` | Tiempo máximo para armar un PDF o CBZ |
| 45 s / 250 ms | `saveChapter` | Tiempo máximo y pausa por imagen suelta |
| 20 s | `waitDownload` (background) | Espera del resultado real de cada descarga de imagen suelta |
| 3 imágenes ≥ 250×600 | `looksLikeChapter` | Condición para mostrar la burbuja |
| 1,5 s · 5 s · 700 ms | `checkFab` | Revisiones de la burbuja al cargar y agrupación de las revisiones por scroll o carga de imágenes |
| 5 px | burbuja | Movimiento mínimo para que cuente como arrastre |

---

## 11. Cómo se probó

Las pruebas automáticas se hicieron en Chromium sin interfaz (Playwright), cargando la extensión real sobre páginas de prueba armadas con la misma estructura que el sitio (imágenes sintéticas, servidor local):

- **Escritor de PDF:** validado con `qpdf --check` (sin errores) y `pdfinfo`; título con acentos correcto; tamaños de página exactos; tira de 20 000 px ajustada a 14 400 pt; JPG incrustados byte a byte; WebP y PNG convertidos; JPG CMYK rechazado para conversión.
- **CBZ:** `unzip -t` sin errores; imágenes idénticas byte a byte al original; `ComicInfo.xml` con caracteres especiales escapados.
- **Filtro:** descartó logo del sitio, aviso con link externo y página de créditos final; respetó la doble página.
- **Carga diferida:** detectó imágenes con `data-src` relativo, placeholder roto y `loading="lazy"`; excluyó una miniatura lazy de "relacionados".
- **Avisos:** "no llegaste al final", "1 página no cargó", recorrido automático con regreso a la posición inicial, y "ya guardado" tras recargar y con otro nombre.
- **Nombres:** acentos conservados con locale UTF-8 y reintento sin acentos con locale no UTF-8.
- **PDF + CBZ juntos:** corregida una condición de carrera que hacía fallar el segundo archivo.
- **Burbuja:** aparición, arrastre, posición recordada, clic, cartel dentro de pantalla, ocultar/reactivar, no aparece fuera de capítulos.

**Pruebas de la v2.5** (Node, sobre el código real de la extensión):

- **Nombres:** 20 casos, entre ellos `Bleach 686` → `Bleach/Bleach 0686`, `Witch Watch 150`, decimales (`1134.5`, y `1057.5` en `10 Wano`), los cambios de saga 1057/1058, `Ch.`, `Cap.`, `#`, `Serie | Sitio`, número en `?capitulo=` y la dirección con y sin parámetros de seguimiento.
- **Imágenes sueltas** (con `chrome.downloads` simulado): descarga directa correcta; directa cortada con 403 → pasa al respaldo; directa y respaldo fallidos → error; descarga que termina antes de empezar a escuchar; descarga lenta → se da por buena. No quedan listeners colgados. Los mismos casos contra la v2.4 confirman el error: la 403 se contaba como bajada.
- **No probado en navegador:** la burbuja que reaparece al bajar y el aviso "faltaron páginas" (no hay Chromium en el entorno de pruebas). Revisarlo a mano en el sitio real.

**No probado:** la extensión completa sobre el sitio real (bloquea conexiones desde el entorno de pruebas), ni la apertura de los CBZ en una app lectora de tablet.

---

## 12. Limitaciones conocidas

- **Publicidad con formato de página:** un aviso al final del mismo tamaño que una página normal y en la misma carpeta del capítulo pasa como página. Se destilda a mano.
- **Sagas solo para One Piece**, y con rangos cargados de memoria. Otras series se guardan como `Serie/Serie NNNN`.
- **Sin detección de tomo (volumen).** La página no lo indica.
- **El nombre depende del título de la página.** Si el sitio no actualiza el título al pasar de capítulo sin recargar, el nombre puede quedar con el número anterior; se soluciona con F5.
- **El registro de guardados no mira el disco.** Si borrás un archivo a mano, la extensión sigue diciendo que lo guardaste. Si desinstalás la extensión, el registro se pierde.
- **Imágenes en canvas o como fondo CSS** (algunos lectores protegidos no usan `<img>`) no se detectan.
- **Solo Chrome de escritorio** (y navegadores Chromium que acepten extensiones descomprimidas).
- **Referer:** las imágenes del PDF, del CBZ y las sueltas se bajan sin el Referer del sitio. Si el servidor de imágenes lo exige, devuelve 403 y esas páginas fallan. Pendiente de probar en el sitio real.
- **Iframes:** el script no corre dentro de iframes; un lector que muestre las páginas dentro de uno no se detecta.

---

## 13. Cómo modificarla

### Agregar sagas de otra serie

En `content.js`, dentro de `SAGAS`, agregar una entrada con el nombre de la serie **en minúsculas, tal como sale del título**:

```js
const SAGAS = {
  'one piece': [ /* … */ ],
  'naruto': [
    [1, 238, 'Parte 1'],
    [239, 700, 'Shippuden'],
  ],
};
```

### Cambiar el formato por defecto

En `openSaveDialog` (`content.js`):

```js
sv('#mr-save-pdf').checked = st.savePdf !== false;   // PDF tildado salvo que lo destildes
sv('#mr-save-cbz').checked = st.saveCbz === true;    // cambiar a  !== false  para CBZ por defecto
```

### Cambiar la carpeta base

Buscar `MangaReader/` en `content.js` (rutas de PDF/CBZ, imágenes y vista previa) y reemplazarlo.

### Ajustar el filtro

En `flagNonPages`: cantidad de páginas finales revisadas (`good.length - 3`) y rangos de proporción en `fits`.

### Después de cualquier cambio

`chrome://extensions` → 🔄 en la tarjeta → F5 en la pestaña del manga. Los errores de `content.js` se ven en la consola de la pestaña (F12); los de `background.js` en el enlace "service worker" de la tarjeta de la extensión.

---

## 14. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| El popup dice "Recargá la página (F5)" | La pestaña se abrió antes de instalar/actualizar | F5 en la pestaña |
| No aparece la burbuja | Está oculta, o la página no parece un capítulo | Activarla en el popup, o usar `Alt+S` |
| `Alt+S` no hace nada | Otro programa o extensión usa el atajo | Cambiarlo en `chrome://extensions/shortcuts` |
| Faltan páginas | No terminaron de cargar | **Recorrer la página** en el diálogo, o bajar hasta el final |
| Aparece el logo o un aviso en el PDF | El filtro no lo detectó | Destildar su miniatura antes de guardar |
| Falta una página que sí es del capítulo | El filtro la marcó como AD | Tildar su miniatura |
| El nombre sale raro | El título de la página tiene otro formato | Editar el nombre en el diálogo |
| Archivo con `(1)` al final | Ya existía uno con ese nombre | Es el comportamiento normal de Chrome |
| "Faltaron páginas: no lo marqué como guardado" | Alguna página no se pudo bajar | Recorrer la página y volver a guardar |
| "guardado como … Capitulo" sin acento | El sistema rechazó el nombre con acentos | Automático; el archivo se guardó igual |

---

## 15. Historial de versiones

| Versión | Cambios |
|---|---|
| 1.0 | Lector de burbujas con OCR, orden de lectura japonés, voz y descarga de imágenes |
| 1.1 | PDF del capítulo con nombre de tomo y carpetas |
| 2.0 | Se quita la lectura (OCR, voz, API key). Queda solo guardar, con filtro de publicidad y miniaturas |
| 2.1 | Nombre y carpetas automáticos: serie, saga (One Piece) y número |
| 2.2 | Marca de "ya guardado" y aviso de páginas faltantes con recorrido automático |
| 2.3 | Formato CBZ con `ComicInfo.xml` |
| 2.4 | Burbuja flotante arrastrable con controles rápidos |
| 2.5 | Correcciones: nombre de la serie (`Bleach` ya no sale `Blea`), capítulos con decimal, número en `?capitulo=`, "ya guardado" solo si entraron todas las páginas y separando capítulos por `?capitulo=`, fallas reales en imágenes sueltas, y la burbuja vuelve a revisar mientras cargan las páginas |
| 2.6 | Descarga por lotes: botón "Descargar serie" que detecta capítulos en páginas de listado, diálogo de selección con checkboxes, y descarga secuencial de PDF/CBZ/imágenes por capítulo |
