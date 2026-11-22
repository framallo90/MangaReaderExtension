# Manga Reader — Documentación técnica y de uso

**Versión:** 2.9.0 · **Tipo:** extensión de Chrome (Manifest V3) · **Idioma de la interfaz:** español

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

Manga Reader guarda capítulos de manga desde el navegador, en el formato que elijas, con un nombre y una carpeta armados automáticamente.

Lo que hace, en resumen:

- Encuentra las páginas del capítulo en la página web, en orden de lectura.
- Descarta lo que no es el capítulo: logo del sitio, banners, avisos con link a otro sitio, GIF, y páginas de créditos o avisos al final.
- Te muestra miniaturas de todas las imágenes para que confirmes o corrijas la selección con un clic.
- Arma el nombre a partir del título de la página: serie, saga y número, por ejemplo `One Piece/11 Saga Final/One Piece 1134`.
- Guarda en **PDF**, **CBZ** (formato de lectores de cómics) y/o **imágenes sueltas**, en `Descargas/MangaReader/…`. Cada página se baja una sola vez aunque elijas los tres formatos.
- Recorre la página sola al abrir el diálogo, para que carguen todas las imágenes.
- Te avisa si ese capítulo ya lo guardaste antes y si faltaron páginas (y cuáles).
- **Guardar y siguiente:** guarda y abre el capítulo que sigue, con el diálogo ya listo.
- **Varios capítulos seguidos:** elegís un rango (o los marcás en la lista) y los baja uno tras otro, cada uno con el mismo filtro y los mismos nombres que al guardarlo a mano. Funciona tanto desde la página de un capítulo como desde la portada o el listado de la serie.
- Lleva un registro de lo guardado que podés ver por serie (con lo que te falta), exportar e importar.
- **Sitios de manga y cómics:** una lista de accesos directos a sitios legítimos (plataformas oficiales, archivos de dominio público, tiendas sin DRM), con una **i** al lado de cada uno que dice si tiene manga o cómics, idioma, si es gratis, si se puede guardar y qué ofrece. Le podés sumar tus propios sitios.
- Muestra una burbuja flotante 💾 arrastrable, que se puede apagar en todos lados o solo en un sitio.

Lo que **no** hace: bajar nada por su cuenta. Un guardado o un lote empieza siempre con un clic tuyo, sobre la página que tenés abierta, y el lote baja solo los capítulos que marcaste.

---

## 2. Instalación y actualización

### Instalación (una sola vez)

1. Tener la carpeta `manga-reader-ext` de la versión que quieras usar. En esta compu cada versión vive en su propia carpeta: `D:\MangaReaderExtension\manga-reader-ext(ver DD-MM-AAAA)\manga-reader-ext`.
2. En Chrome, abrir `chrome://extensions`.
3. Activar **Modo de desarrollador** (arriba a la derecha).
4. Clic en **Cargar descomprimida** y elegir la carpeta `manga-reader-ext`.

### Actualización

1. Las versiones nuevas se crean en una carpeta nueva (`manga-reader-ext(ver DD-MM-AAAA)`), sin tocar la anterior. Para pasar a la nueva: en `chrome://extensions` quitar la tarjeta vieja y **Cargar descomprimida** la carpeta nueva. Si solo cambiaron archivos dentro de la misma carpeta, alcanza con tocar 🔄 en la tarjeta.
2. **Ya no hace falta recargar las pestañas con F5.** Si una pestaña quedó con el script de antes, la extensión le inyecta el nuevo la primera vez que usás el atajo, el clic derecho o el ícono. Lo único que no vuelve solo en esas pestañas es la burbuja, hasta ese primer uso o hasta recargar.

Quitar la tarjeta vieja borra el registro de guardados (ver sección 8). Para no perderlo: **Exportar copia** antes, en "Guardados, sagas y opciones", e **Importar copia** después.

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

"Descargar varios capítulos" se abre desde el ícono de la extensión, el clic derecho en la página, o el cartel **i** de la burbuja.

### El diálogo "Guardar capítulo"

```
┌ 💾 Guardar capítulo ──────────────── ✕ ┐
│ NOMBRE DEL TOMO                         │
│ [One Piece/11 Saga Final/One Piece 1134]│
│ Usá / para carpetas                     │
│ ☑ PDF   ☐ CBZ   ☐ Imágenes              │
│ ✔ Ya lo guardaste el 20/11/2026 (15 p.) │  ← solo si ya existe
│ 📄 Descargas/MangaReader/…/1134.pdf     │  ← ruta exacta
│ 15 de 16 páginas · 1 descartada…        │
│ ⚠️ 1 página no cargó [Recorrer]          │  ← solo si hace falta
│ [miniaturas: clic = incluir / quitar]   │
│ [ Guardar ] [ Guardar y siguiente ▶ ]   │
│ ✅ PDF de 15 páginas (24.3 MB)           │
└─────────────────────────────────────────┘
```

- **Nombre:** viene completado. Se puede editar; cada `/` crea una carpeta.
- **Formatos:** PDF, CBZ e Imágenes se pueden combinar. La extensión recuerda qué tildaste.
- **Miniaturas:** las sospechosas de no ser del capítulo vienen apagadas y con etiqueta **AD**. Pasando el mouse se ve el motivo. Un clic invierte la selección. Si una página no se pudo bajar, su miniatura queda con borde rojo.
- **Guardar y siguiente:** guarda y, si salió completo, abre el capítulo siguiente con el diálogo ya abierto. Aparece cuando se puede saber cuál es el siguiente.
- **Teclado** (con el foco en cualquier parte del diálogo): `Enter` guarda, `Ctrl+Enter` guarda y abre el siguiente, `Esc` cierra.
- **El diálogo se puede arrastrar** desde su barra de título.

### El diálogo "Descargar varios capítulos"

```
┌ 📦 Descargar varios capítulos ────── ✕ ┐
│ DEL [1130] AL [1134] [Marcar]           │
│ [Todos] [Ninguno] [↻ Buscar de nuevo]   │
│ 6 capítulos · 5 marcados · 1 ya guardado│
│ ☑ 1130  Capítulo 1130      ✅ 15 páginas │
│ ☑ 1131  Capítulo 1131      ⏳ bajando…   │
│ ☑ 1132  Capítulo 1132                   │
│ ☑ 1133  Capítulo 1133      ✔ guardado   │
│ ▸ Dirección y nombre de los capítulos   │
│ ☑ PDF   ☐ CBZ   ☐ Imágenes              │
│ ☑ Saltear los que ya guardé             │
│ ☐ Abrir cada capítulo a la vista        │
│ [ Descargar 4 capítulos ] / [ Cancelar ]│
│ (2/4) Capítulo 1131: bajando 9/15       │
└─────────────────────────────────────────┘
```

1. Escribí **Del … al …** y tocá **Marcar** (o `Enter`), o tildá capítulos en la lista.
2. Elegí los formatos y tocá **Descargar**. Mientras baja, el mismo botón dice **Cancelar**.
3. Dejá abierta la pestaña desde donde lo iniciaste: si la cerrás o cambiás de página, el lote se corta. Podés usar otras pestañas mientras tanto.

Cada capítulo se guarda con el mismo nombre y carpetas que al guardarlo de a uno. Al terminar dice cuántos salieron y, de los que no, por qué.

### La burbuja flotante

- **Clic:** abre el diálogo de guardar.
- **Arrastrar:** la mueve a cualquier lugar de la pantalla; recuerda la posición para todos los sitios.
- **Botón "i":** abre el cartel de controles rápidos, con **Descargar varios capítulos**, **No mostrar en este sitio** y **Ocultar burbuja en todos lados**.
- **Reactivar:** desde el ícono de la extensión (en todos lados, o en el sitio de la pestaña abierta), o en "Guardados, sagas y opciones".

### El ícono de la extensión

Además de los botones de guardar y de varios capítulos: **📚 Sitios de manga y cómics** (sección 4.11), mostrar u ocultar la burbuja (en general y en el sitio abierto), apagar el recorrido automático de la página, y **⚙️ Guardados, sagas, sitios y opciones**.

---

## 4. Funciones en detalle

### 4.1 Detección de páginas (`collectPages`)

Recorre todos los `<img>` de la página en orden del documento (que es el orden de lectura del sitio) y, para cada uno:

1. **Obtiene la URL real** (`imgUrl`):
   - Si la imagen tiene un atributo de carga diferida (`data-src`, `data-lazy-src`, `data-original`, o `data-srcset` / `data-lazy-srcset`, de donde toma la más grande) y todavía muestra un placeholder (menos de 250 px de ancho), usa la URL del atributo.
   - Si no, usa `src` / `currentSrc`.
   - Descarta URLs `data:` y `blob:` y convierte rutas relativas en absolutas.
2. **Elimina duplicados** (la misma URL dos veces cuenta una sola vez).
3. **Clasifica por estado de carga:**
   - *Ya cargada:* usa su tamaño real (`naturalWidth`/`naturalHeight`).
   - *Sin cargar* (lazy con placeholder, o `loading="lazy"` que el navegador aún no bajó): la carga en segundo plano con `new Image()` para medirla (`probeSize`, hasta 8 s). Se miden **de a 6**: todas juntas, con una conexión lenta las últimas se quedaban sin tiempo y contaban como caídas.
   - *Rota* (cargó pero mide 0): se anota como fallida.
4. **Descarta lo chico:** menos de 250 px de ancho o de alto (íconos, logos chicos, banners finos).

Devuelve `{ pages: [{url, w, h, external, flag}], failed, locked }`, donde `failed` son las páginas de la carpeta del capítulo que no cargaron.

**Páginas protegidas (`locked`).** Algunos lectores no muestran las páginas como imágenes con dirección: las bajan cifradas y las muestran como imágenes `blob:` (MANGA Plus). La extensión no las guarda. Se cuentan las imágenes `blob:` grandes o que todavía están cargando. Los `<canvas>` **no** se cuentan (desde la 2.8.4): muchos sitios comunes tienen canvas de adorno o de publicidad, y con dos de esos una página de capítulo inexistente frenaba el lote entero como "protegido". Si hay 2 o más imágenes `blob:`, y lo que sí tiene dirección no arma un capítulo (no hay una carpeta con la mayoría de las imágenes) o es menos que lo protegido, la página se da por protegida:

- el diálogo lo dice en un aviso naranja (🔒) y todas las miniaturas vienen destildadas, porque lo que queda a la vista son el logo, banners o promociones del sitio;
- en un lote, el capítulo responde "Páginas protegidas" y el lote para enseguida;
- la burbuja no aparece (sección 4.7).

### 4.2 Filtro de publicidad (`flagNonPages`)

Marca con un motivo (`flag`) lo que probablemente no es una página del capítulo. Las marcadas vienen destildadas en el diálogo, y en un lote no se incluyen.

| Regla | Motivo que se muestra | Qué atrapa |
|---|---|---|
| La imagen está dentro de un link a otro dominio | `enlace a otro sitio` | Avisos publicitarios clicables |
| Está fuera de la "carpeta del capítulo" | `fuera de la carpeta del capítulo` | Logo del sitio, banners, imágenes de otras secciones |
| Termina en `.gif` | `GIF animado` | Banners animados |
| Está entre las últimas 3 y su proporción no encaja con el resto | `formato distinto al resto` | Páginas de créditos, "unite al scan", avisos al final |

**Link a otro dominio:** la regla solo vale si lo tiene la mitad de las imágenes o menos. Si lo tienen casi todas, es el lector el que envuelve cada página en un link (por ejemplo, a su CDN) y no se marca ninguna.

**Carpeta del capítulo:** es la carpeta de URL donde está la mayoría de las imágenes (por ejemplo `/mangafiles/es/todos/1134/`). Solo se usa si tiene al menos 3 imágenes y al menos la mitad del total; si no, esta regla no se aplica.

**Proporción "que encaja":** se calcula la mediana de ancho/alto de las páginas buenas y se compara cada página contra ella. Encaja si la relación está entre 0,75 y 1,33 (página normal), entre 1,6 y 2,4 (doble página) o entre 0,42 y 0,6 (página simple en un capítulo con mayoría de dobles). Solo se revisa la cola final contigua: apenas una página encaja, se deja de marcar. Requiere al menos 5 páginas buenas. **No se aplica** en tiras largas tipo webtoon (mediana de ancho/alto menor a 0,4) ni cuando menos de dos tercios de las páginas se parecen entre sí: ahí no hay un formato contra el que comparar.

### 4.3 Nombre y carpetas automáticos (`detectChapter`, `nameFor`, `suggestName`)

1. Toma el título de la página: primero `og:title`, si no `document.title`, si no el primer `<h1>`. Le quita todo lo que está después de ` | `.
2. Separa **serie** y **número** probando, en orden:
   1. **Palabra clave + número en cualquier parte:** `Serie Capítulo 12: título del capítulo`, `Serie - Chapter 12`, `Serie Ch. 12`, `Serie Cap. 12`, `Serie #12`. Lo que sigue al número es el título del capítulo y no se usa. La palabra clave tiene que ir **separada** de la serie por un espacio o guion: así `Bleach 686` da la serie `Bleach` y no `Blea` + `ch 686`.
   2. **Número adelante:** `Capítulo 12 - Serie`, y también `[#104] Serie` (así titula MANGA Plus).
   3. **El número de la dirección aparece suelto en el título** (desde la 2.8.4 va antes que "número al final"): ese es el capítulo, aunque el título termine en otro número. `Leer Serie 7 Español Online - 2026` con la dirección `…/serie-7/` es el capítulo 7 y no el 2026. La serie es lo que hay antes de ese número (`Leer One Piece 1134 Online` → `One Piece`); si aparece dos veces vale la última (`Kaiju No. 8 8`). El número de la dirección es el último de la ruta, entero y de hasta 5 cifras, o un parámetro como `?capitulo=12`, `?cap=`, `?chapter=`, `?ch=`, `?c=`, `?ep=`. De un código largo como `/viewer/2010289` no se saca nada (hasta la 2.8.0 salía el "capítulo 10289").
   4. **Número al final:** `Serie 12`, `Serie Manga 12 - Nombre del sitio`. Antes se quita el último tramo después de ` - ` si no tiene números y el primero sí.
   5. **`#104 Serie`**, sin corchetes. Va después de "número al final" para que `#1 Lector de manga: Serie 1134` sea el capítulo 1134.
   6. **El título no trae el número:** sale de la dirección, y la serie es el título sin números.
3. Limpia la serie (`cleanSerie`): saca `Leer …` del principio, y `… Vol. 3`, `… Tomo 3`, `… Manga` del final.
4. Arma el nombre (`nameFor`):
   - número con 4 dígitos (`0001`, `1134`) para que ordene bien alfabéticamente; el decimal se conserva (`1134.5`), así no pisa al capítulo entero;
   - si la serie tiene tabla de sagas, agrega la carpeta de saga con prefijo numérico (para elegir la saga se usa la parte entera: el `1057.5` va a `10 Wano`).

Resultado: `Serie/NN Saga/Serie NNNN` o, sin tabla de sagas, `Serie/Serie NNNN`.

**Sagas.** Viene incluida la de One Piece (archivo `sagas.js`):

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

Las de otras series se cargan en "Guardados, sagas y opciones" (sección 4.10), sin tocar el código.

**Limpieza de nombres** (`sanitizeSegment`): cada tramo del nombre se limpia para que Windows lo acepte. Reemplaza `< > : " \ | ? *` y caracteres de control por espacios, quita puntos y espacios al inicio y al final, limita a 100 caracteres y evita nombres reservados (`CON`, `NUL`, `COM1`…). Los acentos se conservan.

**Respaldo:** si el título no se puede interpretar, se usa el título tal cual. En ese caso, si antes guardaste algo de ese mismo sitio en una carpeta, se antepone esa carpeta.

### 4.4 Recorrido de la página y aviso de páginas faltantes

Al abrir el diálogo, si no llegaste al final de la página (con un margen de 300 px), **la página se recorre sola**: baja desde arriba de a 90 % de pantalla cada 300 ms hasta el final (relee la altura en cada paso porque puede crecer), espera hasta 6 s a que terminen de cargar las imágenes que aparecieron, vuelve a donde estabas y cuenta las páginas de nuevo. Mientras tanto ya se ven las miniaturas de lo que había. Se puede apagar desde el ícono de la extensión ("Recorrer la página sola…"); apagado, vuelve el aviso con el botón **Recorrer la página**.

El diálogo muestra un aviso naranja cuando:

- **una o más páginas del capítulo no cargaron** (fallaron o tardaron más de 8 s). Solo cuentan las de la carpeta del capítulo: un banner roto del sitio no dispara el aviso;
- **no llegaste al final de la página** y el recorrido automático está apagado.

Además, mientras el diálogo está abierto, cada vez que termina de cargar una imagen nueva de la página se recalcula la lista (con 800 ms de espera para agrupar cargas seguidas). Lo que tildaste o destildaste a mano se respeta, también si lo hiciste mientras se estaba recalculando.

### 4.5 Marca de "ya guardado"

- Cuando un guardado termina **sin errores y con todas las páginas elegidas**, se anota en `savedChapters` con la ruta, la fecha, la cantidad de páginas y la dirección de la página. Si alguna página no se pudo leer, el archivo se guarda igual pero **no** se anota, y el diálogo dice qué páginas faltaron.
- La dirección que se anota (`pageKey`) es la ruta más los parámetros después del `?` (ordenados), sin los de seguimiento (`utm_…`, `fbclid`, `gclid`, `ref`). Así, en los lectores donde todos los capítulos comparten la ruta y cambian por `?capitulo=12`, cada capítulo se reconoce por separado. Al comparar, una barra final de más o de menos no cuenta.
- Al abrir el diálogo, se busca primero por la ruta del nombre actual y, si no coincide, por la dirección de la página. Así avisa aunque le cambies el nombre, e indica con qué nombre lo guardaste.
- Es solo informativo: no impide volver a guardar. Si el archivo ya existe, Chrome agrega `(1)`, `(2)`… al nombre.
- En un lote, los ya guardados aparecen con **✔ guardado** y se saltean (salvo que destildes "Saltear los que ya guardé").

### 4.6 Formatos

| Formato | Contenido | Imágenes |
|---|---|---|
| **PDF** | Un archivo `.pdf`, una página por imagen | JPG y PNG sin recomprimir (sin pérdida); WebP/GIF/AVIF convertidas a JPG calidad 0,92 |
| **CBZ** | Un archivo `.cbz` (ZIP) + `ComicInfo.xml` | Todas las originales, sin tocar |
| **Imágenes** | Carpeta con `pagina_001.jpg`, `pagina_002.png`… | Todas las originales, sin tocar, con la extensión de su tipo real |

Ver la sección 7 para el detalle interno de cada uno.

### 4.7 Burbuja flotante

- **Cuándo aparece:** cuando hay 3 o más imágenes ya cargadas de al menos 250 px de ancho y 600 px de alto en la misma carpeta (las miniaturas del diálogo no cuentan, ni las imágenes `blob:` de los lectores que protegen las páginas). Se revisa a los 1,5 s y a los 5 s de cargar la página, y además cada vez que termina de cargar una imagen o bajás por la página (agrupado cada 700 ms), hasta que aparece. Después de 40 revisiones sin que la página parezca un capítulo, deja de mirar, para no gastar en páginas que no son de manga.
- **Sitios que cambian de página sin recargar:** si cambia la dirección, la burbuja se oculta y se vuelve a revisar desde cero.
- **Arrastre:** usa Pointer Events con captura del puntero. Un movimiento menor a 5 px se considera clic. La posición se guarda como distancia al borde derecho e inferior (`fabPos`) y se limita para que la burbuja nunca quede fuera de pantalla.
- **Cartel de ayuda:** se abre hacia abajo si la burbuja está a menos de 340 px del borde superior, y hacia la derecha si está a menos de 280 px del borde izquierdo. Se cierra al hacer clic fuera.
- **Ocultar/mostrar:** `fabEnabled` la apaga en todos lados y `fabBlockedHosts` en un sitio; todas las pestañas escuchan el cambio y muestran u ocultan la burbuja al instante.

### 4.8 Varios capítulos seguidos

**De dónde sale la lista** (`collectChapters`). Se juntan tres fuentes:

1. **Links `<a>` del mismo sitio** cuya dirección termina en un número de hasta 5 dígitos (con o sin decimal, `/`, `.html` o `.php` al final, o en un parámetro como `?capitulo=`). Se agrupan por *molde*: la dirección con el número sacado. Vale el grupo más grande, así que la paginación (`/page/2`), las noticias (`/noticias/2026`) o el mismo capítulo en otro idioma quedan afuera. Tampoco entran los links del **archivo por fecha** de un blog (ver más abajo).
2. **Opciones de un `<select>`** (el desplegable de capítulos de muchos lectores): sirve si el valor es el número, una dirección, o si el número está en el texto de la opción.
3. **El rango "Del … al …"**: los números que no están en la lista se agregan armando la dirección con el molde, que se ve y se puede corregir en "Dirección y nombre de los capítulos" (`{n}` es el número).

El molde sale de la dirección de la página si tiene número (estás en un capítulo); si no, del grupo de links más grande; y si no hay nada, se supone "esta dirección + `/número`" y el campo queda a la vista para revisarlo. Esto último es lo que pasa en la portada de una serie que muestra el primer capítulo sin número en la dirección.

**Archivo por mes o por día (`isDateArchive`, desde la 2.8.6).** Los sitios armados como un blog (WordPress y parecidos) traen en todas las páginas una tira de links al archivo: `/2021/01/` con el texto "enero 2021", `/2021/02/`… y a veces un calendario con links por día (`/2021/01/15/`). Terminan en un número chico, igual que un capítulo, pero abren la página con **todo lo publicado ese mes**. Hasta la 2.8.5 la extensión los tomaba como capítulos: la lista mostraba "enero 2021, febrero 2021…", el "capítulo 1" era enero y lo que se guardaba era un archivo con los capítulos de ese mes mezclados. Ahora se descartan:

- un link `…/AAAA/MM/` (año de 1900 a 2099, mes de 1 a 12) cuyo texto nombra un mes (en español o inglés) o ese mismo año. Sin eso se deja pasar, porque podría ser el capítulo 1 de una serie cuyo código en el sitio es 2021;
- un link `…/AAAA/MM/DD/` (día de 1 a 31);
- en los dos casos, si el texto dice "Capítulo", "Chapter", "Cap", "Ch" o `#12`, es un capítulo y entra.

Vale para los links, para las opciones de un desplegable (el archivo suele venir también como "Elegir el mes") y para la dirección de la página misma: si estás parado en la página de un mes, no se toma como "el capítulo 1" sino como un listado, y se ofrecen los capítulos que esa página enlaza.

**Direcciones que terminan en un archivo (desde la 2.8.7).** Si la dirección de la página termina en un archivo (`.html`, `.htm`, `.php`, `.asp`, `.aspx`, `.jsp`, `.cgi`) sin el número al final, y la página tampoco tiene links de capítulos, **no se supone nada**: "esta dirección + `/número`" daría `…/capitulo-104-espanol.html/1`, que no existe en ningún sitio. Hasta la 2.8.6 se suponía igual, y el lote abría pestañas a páginas inexistentes. Ahora el campo "Dirección" queda vacío y abierto, un aviso naranja dice que no se encontraron los otros capítulos y por qué, y "Del … al …" avisa que sin una dirección con `{n}` solo se marcan los de la lista. Guardar el capítulo abierto no cambia. Si el número está al final (`…/serie-12.html`) el molde sale de la dirección como siempre, y si la página tiene links a capítulos valen los links.

**Direcciones con un código del sitio.** Hay sitios donde la dirección no lleva el número del capítulo sino un código interno: en MANGA Plus, `/viewer/2010289` es el capítulo 104, y el 103 tiene otro código que no se puede deducir. Se reconoce cuando el último tramo de la ruta tiene un número de 6 cifras o más y la página tampoco tiene links de capítulos (si los tiene, como en el listado de una serie con un código en su dirección, valen los links). Si la dirección termina en un número de hasta 5 cifras **se confía en ella aunque el título diga otro número**: la 2.8.1 la descartaba en ese caso, y eso rompía el lote cuando el título terminaba en un año o cuando el sitio cambia de capítulo sin recargar y deja el título viejo. Con un código, **no hay molde**: el campo "Dirección" queda vacío y abierto, un aviso naranja explica por qué, la lista trae solo el capítulo abierto (con su dirección) y "Del … al …" marca solo los de la lista. Si sabés cómo son las direcciones, se escribe el molde con `{n}` y vuelve a funcionar el rango. Tampoco se arma "Guardar y siguiente". Hasta la 2.8.0 se suponía "esta dirección + `/número`" y el lote abría pestañas a direcciones inexistentes como `/viewer/2010289/01`.

**Ceros adelante.** Hay sitios donde el capítulo 5 es `/05`. Para cada número agregado por rango se prueba primero como lo usa el sitio (si ya se sabe), después `5`, `05` y `005`; cuando una forma con ceros funciona, se recuerda para ese sitio (`batchPad`) y ya no se pierde tiempo en las siguientes.

**Cómo se baja cada capítulo.** La pestaña donde abriste el diálogo maneja el lote y le pide los capítulos de a uno al service worker (`batchChapter`). Para cada uno:

1. Espera 1,5 s (menos en el primero), para no cargar al sitio.
2. Abre el capítulo en una **pestaña en segundo plano**, al lado de la tuya. Ahí el sitio arma la página como siempre, aunque lo haga con JavaScript.
3. Espera a que termine de cargar y a que las imágenes de la carpeta más poblada dejen de sumarse (misma cantidad, 3 o más, en tres consultas seguidas cada 700 ms). Si a los ~10 s no hay nada que parezca un capítulo, sigue igual y el paso siguiente lo informa.
4. Le pide al content script de esa pestaña que se guarde solo (`autoSave`): mismas funciones que el guardado a mano (detección, filtro, nombre, sagas, formatos, "ya guardado"). Con menos de 3 páginas no guarda y responde "Sin páginas"; si el sitio protege las páginas, responde "Páginas protegidas".
5. Cierra la pestaña y devuelve el resultado.

Un capítulo tiene 4 minutos como máximo. **Cancelar** cierra la pestaña del capítulo en curso y no sigue con los demás.

**El lote para solo** (2.8.1):

- **3 capítulos seguidos "sin páginas"** (`BATCH_MAX_EMPTY`): si todavía no se guardó ninguno, la dirección no debe ser la de los capítulos, así que lo dice y abre "Dirección y nombre de los capítulos" para revisarla; si ya se guardaron algunos, avisa que puede que el sitio no tenga más con esa dirección. Los marcados que faltaban quedan tildados para volver a intentarlo.
- **Páginas protegidas:** para en el primero, porque si el sitio protege un capítulo protege todos.

En los dos casos el resultado empieza con "Parado:" en vez de "Listo:".

**Resultado por capítulo:** ✅ con la cantidad de páginas; ⚠️ *incompleto* si alguna página no bajó (se guarda igual, no se anota como guardado); ⚠️ *sin páginas* si la dirección no llevó a un capítulo; ⚠️ *protegido* si el sitio protege las páginas; ⚠️ *falló* por cualquier otro motivo. El detalle queda abajo del botón.

**Pegar los links de los capítulos (desde la 2.9).** Para cuando la extensión no puede sacar los capítulos de la página, o cuando ya tenés los links. En el diálogo, **Pegar los links de los capítulos** abre un cuadro donde se pega el texto como venga: un link por renglón o varios juntos, con o sin algo adelante (`01: https://…`, `Capítulo 12 - https://…`) y con renglones sin link en el medio (títulos como "Capítulos 01–09"), que se ignoran. Pueden ser de cualquier sitio, no solo del de la página abierta. Con **Usar estos links** la lista del diálogo pasa a ser esa, todos marcados, cada uno con su número (`chaptersFromLinks`):

- **El número escrito adelante** de cada link (`12: link`), si todos lo tienen y no se repite.
- **El número que trae el propio link** en el nombre de su página: `…/2021/01/serie-manga-07-espanol.html` es el 7, aunque esté en el medio y aunque la carpeta de la fecha cambie de un link a otro. Si el nombre tiene varios números (`serie-2-cap-7-2025`), vale el que cambia de un link a otro. También sirve `?capitulo=7`. Un código de 6 cifras o más no se toma como número.
- **El orden en que están pegados**, desde el número que se ponga en "desde" (o el de "Del", o 1), cuando los links no traen número o se repite. Se puede forzar con "Número: en el orden pegado", y "al revés" es para listas que vienen del último capítulo al primero.

El mensaje de abajo dice cuántos links tomó, de qué número a cuál, de dónde sacó el número, qué números faltan en el medio (si son pocos) y cuántos repetidos no entraron (el mismo link con `#algo` o con barra final cuenta como repetido). Queda a la vista el campo **Serie**: conviene escribirla, porque el nombre de cada archivo se arma con esa serie y el número de la lista (con sus sagas, si la serie las tiene cargadas). Si se deja vacía, la serie sale del título de cada página. El número de la lista **manda sobre el del título** de la página (`fixed`), así un título que termina en un año no cambia el nombre. Lo demás es igual que en cualquier lote: los ya guardados se saltean, se puede destildar, cancelar, y a los 3 links seguidos sin páginas para. Hasta 3000 links por vez. **↻ Buscar de nuevo** suma lo que encuentre en la página sin pisar los links pegados.

**"Abrir cada capítulo a la vista":** abre cada capítulo en primer plano y recorre la página antes de guardar. Es más lento y molesto, pero es la salida para los sitios que solo insertan las imágenes cuando la página está a la vista.

**Serie:** por defecto sale del título de cada capítulo. Si escribís una, se usa esa para todos (con sus sagas, si tiene).

### 4.9 Guardar y siguiente

El capítulo siguiente (`nextChapterUrl`) es, en orden: el menor número mayor al actual en la lista de capítulos de la página; si no hay, el `rel="next"` de la página; si no, la dirección actual con el número + 1 (respetando los ceros adelante). Después de guardar completo se anota una marca en el `sessionStorage` de la pestaña y se navega; al cargar el capítulo siguiente, la extensión ve la marca (vale 60 s) y abre el diálogo apenas la página parece un capítulo.

### 4.10 Guardados, sagas y opciones

Página propia de la extensión (`opciones.html`), desde el ícono → **⚙️ Guardados, sagas, sitios y opciones**.

- **Capítulos guardados:** por serie, con cuántos hay, de cuál a cuál y **cuáles faltan** en el medio. Cada capítulo se puede quitar del registro (no borra el archivo), o toda la serie. Buscador.
- **Exportar / Importar copia:** un archivo `.json` con el registro y las opciones. Al importar, los capítulos se suman (si uno está en los dos lados, queda el más nuevo) y del resto solo se trae lo que acá no estaba configurado.
- **Sagas:** un cuadro de texto con un bloque por serie, separados por una línea en blanco: el nombre de la serie tal como sale en el nombre del archivo y, debajo, una saga por línea con `desde-hasta Nombre` (`1058- Saga Final` para la última). Las tuyas se suman a las incluidas y, si son de la misma serie, las reemplazan.
- **Sitios donde la burbuja no aparece:** la lista, con un botón para volver a mostrarla en cada uno.
- **Mis sitios de manga y cómics:** un cuadro para pegar la lista entera, y un formulario para agregar, editar y quitar de a uno (nombre, dirección, tipo, idiomas, si se puede descargar y descripción). Ver 4.11.

### 4.11 Sitios de manga y cómics

Desde el ícono de la extensión → **📚 Sitios de manga y cómics**. Es **tu lista** de accesos directos, **dividida en descargables y para leer**: **tocar el nombre abre el sitio en una pestaña nueva** y la **i** de al lado despliega qué tiene.

**Desde la 2.8.5 la extensión no trae sitios cargados.** La lista es la que cargás vos, pegándola entera en opciones (más abajo). Mientras esté vacía, el popup lo dice y ofrece el botón **📋 Pegar mi lista de sitios**, que abre opciones en esa sección.

```
┌ ‹  📚 Sitios de manga y cómics ─────────┐
│ Tipo    [ Todos | Manga | Cómics ]       │
│ Idioma  [ Todos | Español | Inglés ]     │
│ [Buscar sitio…]                          │
│ 📥 Descargables                    4  ▾  │  ← tocar el título la pliega
│   El sitio da el archivo o la extensión… │
│ ⭐ Clásico         TUYO  MANGA  ES   (i) │
│ ⭐ Mi lector       TUYO  MANGA  ES   (i) │
│ 👁 Para leer en el sitio           1  ▾  │
│   No ofrecen descarga: los capítulos…    │
│ ⭐ Solo lectura    TUYO  MANHWA EN   (i) │
│    Manhwa · Inglés                       │  ← la i abierta
│    ⭐ Agregado por vos · para leer        │
│    manhwa en inglés                      │
│ 5 sitios: 4 descargables y 1 para leer   │
│ [＋ Agregar esta página a mis sitios]    │
│ [📋 Pegar o editar mi lista]             │
└──────────────────────────────────────────┘
```

- **Pegar una lista** (opciones → Mis sitios de manga y cómics → Pegar una lista), para cargar muchos sitios de una vez. Se pega el texto como venga, con una dirección por renglón, y `leerLista` (`sitios.js`) detecta sola cada dato:
  - **Formas que entiende:** `Nombre: https://sitio.com — descripción`; la dirección sola (el nombre sale de la dirección); sin `https://` (`sitio.com/manga`); un link de Markdown (`- [Nombre](https://sitio.com) descripción`); renglones con viñeta o numerados; y varias direcciones solas en un mismo renglón (un sitio cada una). Si un renglón tiene nombre y dos direcciones, la primera es el sitio y la otra queda en la descripción.
  - **Títulos de grupo:** un renglón sin dirección, como `Manga en español:` o `Cómics en inglés`, fija el tipo y el idioma de los renglones que siguen, hasta el próximo título.
  - **Tipo:** manga, manhwa, webtoon, cómics o mixto. Sale primero del texto del renglón, después de la dirección (`mangas-algo.com`) y por último del título de grupo. Si nada lo dice, queda "Manga y cómics".
  - **Idioma:** español (español, castellano, latino, spanish) o inglés (inglés, english), del renglón o del título de grupo.
  - **Antes de agregar** se ve lo que detectó: cuántos sitios, cuáles ya están en tu lista y cuántos venían repetidos. La casilla **Se pueden descargar** (tildada de entrada) decide si esa tanda va a Descargables o a Para leer. Los que ya estaban no se duplican (misma dirección, sin contar `www.` ni la barra final).
  - **La lista de abajo** dice cuántos son descargables y cuántos para leer, tiene un buscador, **Editar** y **Quitar** en cada uno, y **Quitar todos**.
- **La división** (2.8.3), lo más importante de la lista:
  - **📥 Descargables:** los que marcaste con "Se puede descargar" (y, si alguna vez se incluyen sitios, los que dan el archivo, tienen licencia libre o se guardan con la extensión: ✅, 🟢 y 📥).
  - **👁 Para leer en el sitio:** el resto.
  - Cada sección muestra cuántos sitios tiene con los filtros puestos. Tocando el título se pliega o se despliega, y queda así la próxima vez. Por ejemplo, plegando "Para leer" quedan solo los descargables.
  - La regla está en `esDescargable` y `dividirSitios` (`sitios.js`).
- **En cada fila:** un ícono que dice si se puede guardar, el nombre, una etiqueta con el tipo (MANGA, MANHWA, WEBTOON, CÓMICS, TIRAS, HISTORIETA o MIXTO) y los idiomas (ES, EN).
- **La i:** tipo, modelo (gratis, gratis con anuncios, freemium o suscripción), idiomas, si se puede guardar y una descripción corta.
- **Si se puede guardar**, con estos valores:

| Ícono | Valor | Significa |
|---|---|---|
| ✅ | Se guarda con la extensión | Probado con la extensión |
| 🟢 | Permite copias | Dominio público o licencia libre (Creative Commons), aunque la extensión quizá necesite una adaptación para ese sitio |
| 📥 | El sitio da su propia descarga | Regala o vende el archivo (PDF, CBZ, EPUB) sin DRM: mejor bajarlo de ahí |
| 👁 | Solo para leer | Sus términos no dejan copiar o el contenido está protegido. La extensión no se usa ahí |
| ❔ | Condiciones sin verificar | No se pudo confirmar |
| ⭐ | Agregado por vos | Un sitio de tu lista |

- **Filtros**, que valen para las dos secciones:
  - **Tipo:** Todos, Manga (incluye manhwa, webtoon y mixtos) o Cómics (incluye tiras, historieta y mixtos).
  - **Idioma:** Todos, Español o Inglés. Los botones se arman con los idiomas que aparecen en la lista (`idiomasDe`), así que si se suma un sitio en otro idioma aparece su botón solo.
  - **Buscador:** mira nombre, descripción, tipo y dirección.
  - Tipo, idioma y secciones plegadas se recuerdan (`sitiosFiltro`); la búsqueda no. Si venías de la 2.8 con "En español" tildado, arranca en Español.
- **Tus sitios** llevan la etiqueta TUYO y van por nombre dentro de su sección: en Descargables si los marcaste con **Se puede descargar**, y si no en Para leer. Además de pegar la lista, se agregan de a uno desde opciones o con **＋ Agregar esta página a mis sitios** (agrega la portada del sitio de la pestaña abierta, con el nombre que sale del título, en Para leer; después se edita en opciones).
- **Sitios incluidos: ninguno.** Hasta la 2.8.4 la extensión traía una lista propia (85 sitios en la 2.8, recortada a 23 en la 2.8.2). Se sacó en la 2.8.5 a pedido: la lista es la del usuario. El arreglo `SITIOS` de `sitios.js` quedó vacío y el código sigue aceptando sitios incluidos por si vuelven. Lo que se había relevado sigue en `research_notes/Lista de sitios manga y cómics/`.

---

## 5. Arquitectura

### 5.1 Archivos

| Archivo | Rol | Dónde corre |
|---|---|---|
| `manifest.json` | Declaración de la extensión, permisos, atajo, scripts | — |
| `sagas.js` | Tabla de sagas incluida | En cada pestaña y en la página de opciones |
| `content.js` | Detección de páginas, filtro, nombre, diálogos, burbuja, guardado automático de un capítulo del lote | En cada pestaña (content script) |
| `styles.css` | Estilos de los diálogos y la burbuja | Inyectado en cada pestaña |
| `background.js` | Menú contextual, atajo, inyección del script, descargas, coordinación del armado y de los lotes | Service worker |
| `offscreen.html` / `offscreen.js` | Baja las páginas y arma PDF, CBZ e imágenes | Documento offscreen (invisible) |
| `popup.html` / `popup.js` | Botones, opciones rápidas y la lista de sitios | Ventana del ícono |
| `sitios.js` | Lista de sitios de manga y cómics incluida, y funciones para filtrarla y validar los tuyos | En el popup y en la página de opciones |
| `opciones.html` / `opciones.js` | Guardados, sagas, mis sitios y sitios sin burbuja | Pestaña propia |
| `icons/` | Íconos de 48 y 128 px | — |
| `README.md` | Guía corta de uso | — |

### 5.2 Por qué hay un documento offscreen

En Manifest V3 el código de fondo corre en un **service worker**, que no tiene `URL.createObjectURL`. Sin eso no se puede entregar a `chrome.downloads` un archivo grande generado en memoria (las `data:` URL tienen límite de tamaño). La solución recomendada por Chrome es un **documento offscreen**: una página invisible de la extensión que sí tiene esas APIs. Ahí se bajan las imágenes, se arman los archivos, se crea una `blob:` URL por cada uno y el service worker las descarga.

El documento se crea al primer guardado y se cierra solo cuando no quedan trabajos ni descargas pendientes.

### 5.3 Diagrama de componentes

```
                ┌──────────────────────────────┐
  Alt+S ───────▶│        background.js         │◀────── Menú contextual
                │       (service worker)       │◀────── popup.js  {action:'tab'}
                └──┬────────▲─────────┬────┬───┘
 {save} / {batch}  │        │ build   │    │ chrome.downloads.download()
                   ▼        │         │    ▼
┌───────────────────────────┴──┐      │  ┌──────────────┐
│  content.js (tu pestaña)     │      │  │  Descargas/  │
│  · burbuja 💾                │      │  │  MangaReader │
│  · diálogo de guardar        │      │  └──────────────┘
│  · diálogo de varios caps.   │      │         ▲ blob: URL
│    batchChapter ─────────────┼──┐   │  ┌──────┴──────────────────┐
└──────────────────────────────┘  │   └─▶│ offscreen.js            │
                                  ▼      │ · baja páginas (x4)     │
┌──────────────────────────────┐         │ · arma PDF / ZIP / imgs │
│ content.js (pestaña de cada  │ build   └─────────────────────────┘
│ capítulo del lote) autoSave ─┼────────▶ (mismo camino)
└──────────────────────────────┘
```

### 5.4 Mensajes entre partes

| Mensaje | De → a | Para qué |
|---|---|---|
| `{action:'save'}` / `{action:'batch'}` | background → content | Abrir el diálogo de guardar / el de varios capítulos |
| `{action:'tab', tabId, command}` | popup → background | Pedirle que abra un diálogo en esa pestaña (inyectando el script si falta) |
| `{action:'build', urls, formats, path, title, meta}` | content → background | Bajar y guardar; responde `{ok, pages, failed:[n…], files:[{kind, sizeKB, savedAs} \| {kind, error}], imgs, imgsFailed, imgError}` |
| `{target:'offscreen', action:'build', …, jobId}` | background → offscreen | Bajar las páginas y armar los archivos; responde `{ok, pages, failed, files:[{kind, url, sizeKB, name?}]}` |
| `{target:'background', action:'progress', jobId, done, total}` | offscreen → background | Progreso de la bajada de páginas |
| `{action:'progress', done, total}` | background → content | Progreso reenviado a la pestaña que pidió el guardado |
| `{target:'offscreen', action:'revoke', urls}` | background → offscreen | Liberar las `blob:` URL cuando terminó cada descarga |
| `{action:'batchChapter', url, formats, serie, numero, strict, fixed, visible, pause}` | content (lote) → background | Abrir y guardar un capítulo; responde `{ok, name, pages, complete, lines}` |
| `{action:'count'}` | background → content (capítulo) | Cuántas imágenes hay en la carpeta más poblada (para saber si ya se armó) |
| `{action:'autoSave', formats, serie, numero, strict, fixed}` | background → content (capítulo) | Guardarse solo |
| `{action:'batchNote', text}` | content (capítulo) → background → content (lote) | Texto de avance ("bajando páginas 9/15") |
| `{action:'batchCancel'}` | content (lote) → background | Cerrar la pestaña del capítulo en curso |

El campo `target` evita que el documento offscreen procese mensajes de las pestañas y que el service worker procese los del offscreen.

### 5.5 Aislamiento del content script

- `content.js` está envuelto en una función y **hay una sola copia viva por pestaña**: al arrancar pregunta `window.__mangaReaderAlive()`. Si hay una copia que sigue conectada a la extensión, no hace nada. Si la que hay quedó de antes de actualizar la extensión (ya sin conexión), la limpia con `window.__mangaReaderCleanup()` (saca sus listeners y lo que insertó) y ocupa su lugar. Por eso alcanza con inyectarlo de nuevo y no hace falta F5.
- Todo lo que inserta en la página usa los IDs `#mr-save`, `#mr-chapter` y `#mr-fab`, y los estilos están limitados a esos contenedores, para no romper el sitio.
- Los diálogos detienen la propagación de las teclas (`keydown`, `keyup`, `keypress`), así los atajos del sitio no se disparan mientras escribís.

---

## 6. Recorrido completo de un guardado

1. Abrís el diálogo (burbuja, `Alt+S`, menú contextual o popup). El background manda `{action:'save'}` a la pestaña; si no le contesta, le inyecta el script y reintenta.
2. `openSaveDialog` lee las preferencias y el registro de guardados, sugiere el nombre, busca el capítulo siguiente, dibuja el diálogo y empieza a escuchar el scroll y las cargas de imágenes. Si no estabas al final de la página, la recorre sola.
3. `loadPages` → `collectPages` encuentra las páginas, mide las que faltan cargar y aplica el filtro. Se dibujan las miniaturas.
4. `refresh` actualiza la ruta de destino, el conteo, el aviso de "ya guardado" y el de páginas faltantes.
5. Tocás **Guardar**. `saveChapter` limpia el nombre, guarda las preferencias (formatos y carpeta por sitio), toma las URLs de las miniaturas encendidas en orden, y llama a `saveCore`, que manda **un solo** `build` al background con todos los formatos elegidos (tiempo máximo: 60 s + 20 s por página).
6. El background registra el trabajo, se asegura de que exista el documento offscreen (reintenta una vez si se estaba cerrando) y le pasa el pedido.
7. El offscreen baja las páginas de a 4 en paralelo manteniendo el orden (30 s máximo cada una, con hasta 2 reintentos si fue un corte de red o un servidor ocupado; un 403 o un 404 no se reintenta), avisa el progreso, arma cada archivo pedido y devuelve una `blob:` URL por cada uno, más la lista de páginas que no pudo bajar.
8. El background descarga cada `blob:` con `chrome.downloads` en `MangaReader/<nombre>.pdf`, `.cbz` y/o `MangaReader/<nombre>/pagina_NNN.<ext>`, espera el resultado real de cada descarga y libera el archivo en memoria. Si Chrome rechaza el nombre (por ejemplo, acentos en un sistema sin UTF-8), reintenta sin acentos y avisa con qué nombre quedó.
9. Si todo salió bien y completo, `saveCore` anota el capítulo en `savedChapters`. El diálogo muestra el resultado y marca en rojo las miniaturas de las páginas que no bajaron.
10. Con **Guardar y siguiente**, si salió completo, se abre el capítulo que sigue.
11. Cuando no queda nada pendiente, el background cierra el documento offscreen.

En un lote, los pasos 3 y 5 a 9 corren iguales en la pestaña de cada capítulo, sin diálogo (`autoSave`).

---

## 7. Formatos de salida por dentro

### 7.1 PDF (`makePdf`)

El PDF se escribe a mano, sin librerías, en PDF 1.4:

- **Objetos:** 1 catálogo, 2 árbol de páginas, 3 metadatos, y luego 3 por página (página, imagen, contenido).
- **Tamaño de página:** igual al de la imagen en píxeles (1 px = 1 punto). Si un lado supera 14 400 puntos (límite práctico de muchos visores, típico en tiras largas tipo webtoon), la página se achica proporcionalmente; la imagen mantiene su resolución completa.
- **Imágenes JPG:** se incrustan tal cual (filtro `DCTDecode`), sin recomprimir. `jpegInfo` lee la cabecera del JPG y solo acepta baseline/progresivo de 8 bits en gris o color; un JPG CMYK, sin pérdida o aritmético se convierte.
- **Imágenes PNG:** también van sin pérdida y sin recomprimir (`pngDirect`). Los datos de un PNG ya son "Flate + predictor PNG", que es lo que entiende `/FlateDecode` con `/Predictor 15`: se copian tal cual, con su espacio de color (gris, RGB o paleta `/Indexed`). Sirve para PNG sin entrelazado ni transparencia, de hasta 8 bits. Los que tienen transparencia, entrelazado o 16 bits se decodifican sobre fondo blanco y se guardan igual sin pérdida con Flate (`flateImage`), en gris si todos sus píxeles son grises.
- **Otros formatos (WebP, GIF, AVIF):** se dibujan en un canvas con fondo blanco y se exportan como JPG de calidad 0,92, porque el formato PDF no los admite.
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

### 7.3 Imágenes sueltas

Salen de la misma bajada que el PDF y el CBZ: cada página es el archivo original, byte a byte, guardado como `pagina_NNN.<ext>`, donde la extensión es la del **tipo real** del archivo (`sniffExt`) y no la que dice la dirección. En el sitio de One Piece, por ejemplo, las direcciones terminan en `.png` pero las imágenes son JPG: se guardan como `.jpg`. El número es la posición de la página entre las elegidas; si una no bajó, queda el hueco.

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
| `fabBlockedHosts` | Sitios donde la burbuja no aparece | `["ejemplo.com"]` |
| `fabPos` | Posición de la burbuja (px desde la derecha y desde abajo) | `{"r": 24, "b": 24}` |
| `autoScan` | ¿Recorrer la página sola al abrir el diálogo? (por defecto sí) | `true` |
| `sagas` | Sagas cargadas por vos, ya interpretadas | `{"naruto": [[1, 244, "Parte 1"], [245, 700, "Shippuden"]]}` |
| `sagasText` | El texto de sagas tal como lo escribiste | `"Naruto\n1-244 Parte 1\n…"` |
| `batchPad` | Dígitos mínimos del número de capítulo en la dirección, por sitio | `{"one-piece-fans2.com": 2}` |
| `batchVisible` | ¿"Abrir cada capítulo a la vista" tildado? | `false` |
| `misSitios` | Tus sitios de manga y cómics (`descargable` desde la 2.8.3) | `[{"nombre": "Mi sitio", "url": "https://…", "tipo": "manga", "idiomas": ["es"], "descripcion": "…", "descargable": true}]` |
| `sitiosFiltro` | Último filtro de la lista de sitios y secciones plegadas | `{"tipo": "manga", "idioma": "es", "plegadas": ["leer"]}` (en la 2.8: `{"tipo", "soloEs", "soloGuardar"}`) |

Además, "Guardar y siguiente" deja por un instante la clave `mrAutoOpen` en el `sessionStorage` del sitio, que se borra al leerla.

Al desinstalar la extensión (o quitar su tarjeta para cargar otra versión), estos datos se borran. **Exportar copia** los baja a un archivo.

---

## 9. Permisos y por qué se necesitan

| Permiso | Para qué |
|---|---|
| `<all_urls>` (host) | Inyectar los diálogos en cualquier sitio de manga y bajar las imágenes de otros dominios o CDNs sin bloqueos de CORS |
| `downloads` | Guardar los archivos en `Descargas/MangaReader` con carpetas |
| `offscreen` | Crear el documento invisible que arma PDF y CBZ |
| `storage` | Recordar preferencias, carpetas, guardados, sagas y la burbuja |
| `contextMenus` | Las opciones del clic derecho |
| `scripting` | Inyectar el script en las pestañas abiertas antes de instalar o actualizar (para no pedir F5) |
| `activeTab` | Comunicarse con la pestaña actual desde el popup |

---

## 10. Valores fijos (constantes)

| Valor | Dónde | Significado |
|---|---|---|
| 250 px | `MIN_SIDE` (content) | Tamaño mínimo de ancho y alto para considerar una imagen como página |
| 8 s | `probeSize` | Espera máxima para medir una imagen sin cargar |
| 6 | `PROBE_CONCURRENCY` (content) | Imágenes sin cargar que se miden a la vez |
| 3 | `flagNonPages` | Últimas páginas que se revisan por formato distinto |
| 0,4 · 2/3 | `flagNonPages` | Mediana de ancho/alto mínima y proporción de páginas parecidas para aplicar esa regla |
| 300 px | `atBottom` | Margen para considerar que llegaste al final |
| 800 ms | `onImageLoad` | Espera antes de recalcular cuando cargan imágenes nuevas |
| 90 % / 300 ms / 6 s | `scrollThrough` | Paso y pausa al recorrer la página, y espera final a las imágenes que quedaron cargando |
| 4 | `FETCH_CONCURRENCY` (offscreen) | Descargas de páginas en paralelo |
| 30 s | `fetchBytes` | Tiempo máximo por página al bajarla |
| 2 · 700 ms | `FETCH_RETRIES`, `fetchRetry` | Reintentos por página y espera entre uno y otro (700 ms, después 1400 ms) |
| 14 400 pt | `PDF_MAX_SIDE` | Lado máximo de una página del PDF |
| 0,92 | `pdfImage` | Calidad JPG al convertir WebP/GIF/AVIF para el PDF |
| 60 s + 20 s/página | `saveCore` | Tiempo máximo para bajar y armar un capítulo |
| 20 s | `waitDownload` (background) | Espera del resultado real de cada descarga; si sigue en curso, se da por buena |
| 3 imágenes ≥ 250×600 | `looksLikeChapter` | Condición para mostrar la burbuja |
| 1,5 s · 5 s · 700 ms | `checkFab` | Revisiones de la burbuja al cargar y agrupación de las revisiones por scroll o carga de imágenes |
| 40 | `FAB_MAX_TRIES` (content) | Revisiones de la burbuja antes de dejar de mirar la página |
| 5 px | burbuja | Movimiento mínimo para que cuente como arrastre |
| 60 s | "Guardar y siguiente" | Cuánto vale la marca para abrir el diálogo en el capítulo siguiente |
| 1,5 s | `BATCH_PAUSE` (content) | Respiro entre capítulos de un lote |
| 3 | `BATCH_MAX_EMPTY` (content) | Capítulos seguidos "sin páginas" después de los cuales el lote para |
| 2 | `collectPages` | Imágenes `blob:` de 250×250 o más (o cargando) a partir de las cuales la página puede darse por protegida |
| 1900–2099 · 1–12 · 1–31 | `isDateArchive` (content) | Año, mes y día con los que una dirección `…/AAAA/MM/` o `…/AAAA/MM/DD/` se toma como archivo por fecha y no como capítulo |
| `.html` `.htm` `.xhtml` `.shtml` `.php` `.asp` `.aspx` `.jsp` `.cgi` | `collectChapters` | Terminaciones de archivo con las que no se supone "esta dirección + /número" |
| 6 cifras | `collectChapters` | Largo a partir del cual un número en el último tramo de la dirección se toma como código del sitio y no como capítulo |
| 700 ms × 3 | `driveChapter` (background) | Consultas seguidas con la misma cantidad de imágenes para dar un capítulo por armado |
| ~10 s | `driveChapter` | Espera a que aparezca algo que parezca un capítulo |
| 4 min | `batchChapter` | Tiempo máximo por capítulo de un lote |
| 3 páginas | `autoSave` | Mínimo para que un capítulo de un lote se guarde |
| 3000 | `markRange`, `useLinks` | Tamaño máximo de un rango, y de una lista de links pegados |

---

## 11. Cómo se probó

### Pruebas automáticas en Node (`bash tests/correr.sh`)

Corren sobre el código real de la versión, sin dependencias. Sin argumento usan la versión más nueva según el `version` de cada `manifest.json`.

| Archivo | Qué prueba | Casos |
|---|---|---|
| `test_nombres.js` | Serie, saga y número a partir del título y la dirección (también `[#104] Serie`, códigos largos en la dirección y títulos que terminan en otro número); `pageKey` | 51 |
| `test_capitulos.js` | Partir direcciones en molde + número, ceros adelante, lista de capítulos (links, desplegable, portada sin número, dirección con un código del sitio, título que no coincide con la dirección, listado con código y links, archivo por mes o por día de un blog en links y desplegables, dirección terminada en un archivo), capítulo siguiente, y capítulos a partir de links pegados (número adelante, en el link o por orden; repetidos; texto alrededor) | 94 |
| `test_filtro.js` | Filtro de publicidad, con webtoon y lector con links al CDN | 9 |
| `test_descargas.js` | Service worker con `chrome.*` simulado: guardado, descargas cortadas, nombres con acentos, liberación de memoria, inyección del script, un capítulo de un lote y su cancelación | 30 |
| `test_offscreen.js` | Cabeceras JPG, PNG sin recomprimir (los píxeles vuelven idénticos), estructura del PDF y del ZIP, `ComicInfo.xml` | 44 |
| `test_opciones.js` | Sagas (texto ↔ tabla), capítulos faltantes, agrupado por serie, importar copia (con mis sitios) | 21 |
| `test_sitios.js` | Que cada sitio incluido esté bien cargado (campos, dirección, tipo, idiomas, descripción, sin repetidos; desde la 2.8.5 no hay ninguno), filtros por tipo, idioma y texto, la división descargables / para leer, sitios del usuario y la lectura de una lista pegada (nombre, dirección, descripción, tipo e idioma detectados; títulos de grupo; repetidos) | 59 |

### Prueba en navegador real (`node tests/e2e.js`)

Carga la extensión en un Chromium sin interfaz (el que instala Playwright) y la usa sobre un sitio de prueba local armado como el sitio real: la página se dibuja con JavaScript, los capítulos no tienen links, los menores a 10 llevan cero adelante y las imágenes dicen `.png` pero son JPG. 139 comprobaciones, todas bien:

- **Guardar:** burbuja, un solo diálogo aunque se pida dos veces, nombre, miniaturas con logo y banner marcados, recorrido automático de la página, PDF + CBZ + imágenes en sus carpetas, imágenes con su tipo real e idénticas al original, PDF abierto y dibujado con PyMuPDF (5 JPG + 1 PNG), registro de guardado.
- **Guardar y siguiente:** abre el capítulo que sigue con el diálogo listo.
- **Varios capítulos desde un capítulo:** rango, salteo del ya guardado, prueba `/8` y después `/08` y lo recuerda, reintento de una página que falla una vez, capítulo con una página caída (se guarda, no se anota, dice cuál), cancelación, y que no queden pestañas abiertas.
- **Varios capítulos desde la portada** (dirección sin número): molde supuesto, capítulos 1 a 3 y uno que no existe.
- **Lista desde el desplegable** de capítulos.
- **Sitio clásico:** capítulos tomados de los links (sin paginación ni noticias), carga diferida con `data-src`, aviso y créditos fuera del PDF.
- **Guardados y opciones, popup, "No mostrar en este sitio", sagas propias.**
- **Sin F5:** con la copia vieja del script marcada como desconectada, la copia nueva la limpia, abre el diálogo y guarda.
- **Sitios de manga y cómics (de la 2.8 a la 2.8.4, cuando había lista incluida):** la lista muestra todos los sitios incluidos, la **i** abre tipo, si se guarda y descripción, los filtros Manga y Cómics filtran bien, el buscador encuentra por descripción, un sitio propio se agrega desde opciones (con `https://` completado), se edita, no se repite, aparece primero con TUYO, tocar el nombre lo abre en una pestaña nueva y se quita.
- **División y filtro de idioma (2.8.3):** dos secciones con su cantidad (4 descargables y 19 para leer), en Descargables solo ✅ o 📥 y en Para leer solo 👁 o ❔; botones de idioma Todos, Español e Inglés, que dejan solo sitios con esa etiqueta en las dos secciones; plegar "Para leer" deja solo los descargables; idioma y secciones plegadas se recuerdan; un sitio propio marcado "Se puede descargar" se guarda con `descargable: true` y aparece primero en Descargables.
- **Mi lista de sitios, pegada entera (2.8.5):** sin sitios cargados el popup ofrece pegar la lista; en opciones se pega un texto con títulos de grupo, un link de Markdown, una dirección sola, otra sin `https://` y un repetido, y antes de agregar muestra los 4 sitios que detectó; quedan guardados con nombre, tipo, idioma, descripción y `descargable`; una segunda lista para leer avisa el que ya estaba y agrega solo el nuevo; la lista de opciones cuenta 4 descargables y 1 para leer, se busca en ella y no deja repetir a mano. En el popup aparecen divididos, cada uno en su sección, con los filtros de idioma y de tipo, la **i**, plegar, buscar y abrir en una pestaña nueva. Por último, quitar uno y **Quitar todos**.
- **Páginas protegidas y direcciones con código (2.8.1):** un lector armado como MANGA Plus (dirección `/viewer/2010289`, título `[#104] Serie`, páginas como imágenes `blob:` y logo, banner y promoción alrededor). Sin burbuja; el diálogo de guardar avisa con 🔒, nombra el capítulo 104, viene todo destildado y no ofrece "Guardar y siguiente"; el de varios capítulos no supone dirección, explica el código, del 100 al 104 marca solo el abierto y al descargar para enseguida sin guardar nada ni dejar pestañas. Además, un rango de capítulos que no existen (2001 a 2006) para a los 3 seguidos y abre la dirección para revisarla.
- **Sitio con el número dentro del nombre de la página (2.8.4):** un sitio de prueba de una sola serie, con capítulos en `/fan/leer/serie-fan-manga-<n>/` (barra final), título que termina en un año, carga diferida del navegador (`loading="lazy"`), dos `<canvas>` de adorno y un listado con un código largo en su dirección. Desde el listado toma los capítulos de los links y baja los tres con el nombre correcto (el número de la dirección, no el año) y 6 páginas sin el logo; desde un capítulo, los canvas no lo dan por protegido, avisa que ya está guardado, ofrece "Guardar y siguiente" y arma el molde y la lista.
- **Sitio con archivo por mes (2.8.6):** un sitio de prueba armado como un blog, con la tira "enero 2021… junio 2021" en todas las páginas, el mismo archivo en un desplegable y un calendario con links por día; la página de un mes muestra juntos dos capítulos. Desde el inicio la lista trae los 4 capítulos con su nombre y no los meses; "del 1 al 2" baja los capítulos 1 y 2, cada uno con sus 6 páginas, sin abrir ninguna página del archivo; desde un capítulo tampoco aparecen los meses; y desde la página de un mes se ofrecen los capítulos de ese mes.
- **Dirección terminada en un archivo (2.8.7):** en el mismo sitio de prueba, un capítulo en `…/2021/02/serie-blog-manga-3-espanol.html`, con el número en el medio del nombre y sin links a otros capítulos. Guardar el capítulo abierto anda igual (6 páginas, sin "siguiente" inventado); el diálogo de varios capítulos no supone una dirección, explica por qué no encontró los otros, "del 1 al 5" no marca nada y dice qué falta, y no se abre ninguna pestaña ni se pide ninguna dirección inventada. Escribiendo la dirección con `{n}` a mano, el rango vuelve a marcar.
- **Pegar los links de los capítulos (2.9):** desde una página donde la lista no se puede armar, se pega un texto con un título, links con el número adelante y sin él, fuera de orden y uno repetido; los capítulos tienen el número en el medio del nombre de su página y la carpeta del mes cambia. Quedan los 4 en orden y marcados, el mensaje dice qué hizo, y con la serie escrita se bajan los 4 con su nombre y sus 6 páginas, anotados como guardados. Al volver a pegarlos figuran guardados y se saltean. Después, tres links de **otro sitio** (el mismo servidor por `localhost`) sin número en ningún lado: "al revés" y en el orden pegado desde el 50, y se bajan como 50, 51 y 52 aunque el título de uno termine en 2026. Sin pestañas colgadas.

Cuando había lista incluida (2.8.2 a 2.8.4), sus 23 direcciones respondieron bien el 21-11-2026. Además se abrieron en un navegador desde Argentina las dudosas: DC Universe Infinite dice que no está disponible en la región (por eso salió), Marvel carga su lector con el catálogo (`marvelcomicsapp.com`; `marvel.webtoon.com` es solo la página del lanzamiento) y MangaToon, Manta y MANGA MILLION muestran su catálogo para leer en la web.

### Prueba en el sitio real (`node tests/probar_sitio.js`)

El 21-11-2026, contra one-piece-fans2.com, bajando a una carpeta temporal:

- **Desde la página de un capítulo** (`/manga/es/todos/1134`): capítulos 1133 y 1134, 15 páginas cada uno, en `One Piece/11 Saga Final/`, 10 s en total. Probado sin interfaz y con ventana (minimizada), donde las pestañas en segundo plano se comportan como en el Chrome de todos los días.
- **Desde la portada** (`/manga/es/todos`, que muestra el capítulo 01): capítulo 2, 22 páginas, en `One Piece/01 East Blue/`. La dirección `/02` se armó sola.
- El servidor de imágenes **no exige Referer**: responde igual sin Referer, con el del sitio y con uno ajeno.

El 21-11-2026, contra MANGA Plus (`/viewer/2010289`, capítulo 104 de Dragon Ball Super), sin bajar nada:

- **2.8.0:** el diálogo de varios capítulos proponía "del 10289 al 10289" y la dirección `…/viewer/2010289/{n}`; al descargar abría pestañas a `/viewer/2010289/01` y similares, que dan "Page not found".
- **2.8.1:** el diálogo de guardar nombra `Dragon Ball Super/Dragon Ball Super 0104` y avisa que el sitio protege las páginas (las 4 páginas a la vista son imágenes `blob:`); el de varios capítulos deja la dirección vacía, explica que 2010289 es un código y propone del 104 al 104. `probar_sitio.js` ahora también informa lo que encuentra el diálogo de guardar.

El 21-11-2026, con la **2.8.4**, se repitió la revisión de lo que detectan los dos diálogos, sin bajar nada:

- **one-piece-fans2.com, capítulo** (`/manga/es/todos/1134`): nombre `One Piece/11 Saga Final/One Piece 1134`, 15 de 17 páginas (2 descartadas como publicidad), "Guardar y siguiente", molde `…/todos/{n}`.
- **one-piece-fans2.com, portada** (`/manga/es/todos`): nombre `One Piece/01 East Blue/One Piece 0001`, 56 de 58 páginas, molde supuesto `…/todos/{n}` a la vista.
- **MANGA Plus:** igual que con la 2.8.1 (aviso 🔒, dirección vacía, código explicado), ahora contando solo las imágenes `blob:`.

Es lo mismo que detectaba la 2.8.3. La bajada completa de esta versión se probó en los sitios de prueba locales, no en el sitio real.

### Lote largo (`node tests/lote_largo.js`)

Una serie de prueba servida en esta máquina, con la cantidad de capítulos que se pida, para ver si el lote aguanta más de unos minutos. No es parte de `e2e.js` porque tarda.

El 22-11-2026, con la 2.8.4 y con ventana (pestañas en segundo plano como en el Chrome de todos los días): **70 capítulos de 8 páginas, 346 segundos, los 70 guardados**, todos con sus 8 páginas, ningún capítulo abierto dos veces y sin pestañas colgadas. O sea que el lote no tiene un tope propio de cantidad ni de tiempo. Si en un sitio se corta siempre después de una cantidad parecida de capítulos, es el sitio el que deja de entregar las páginas (por ejemplo, porque limita cuántas se piden seguidas): el resultado dice "Parado: … capítulos seguidos no tenían páginas" y los que faltan quedan tildados para seguir más tarde.

### No probado

- **Actualizar la extensión de verdad con pestañas abiertas.** En el navegador de prueba no se puede recargar la extensión (la bloquea), así que se probó marcando la copia vieja como desconectada. El primer uso real después de cargar esta versión lo confirma.
- **El desplegable de capítulos del sitio real ya cargado.** En el navegador de prueba queda en "Cargando…", así que no se vio qué valores trae. El código acepta número, dirección o número en el texto; si trae otra cosa, el rango "Del … al …" funciona igual.
- **"Abrir cada capítulo a la vista"** solo se probó con `chrome.*` simulado.
- **Lotes de cientos de capítulos** (se probaron 70 seguidos) y la apertura de los CBZ en una app lectora de tablet.

---

## 12. Limitaciones conocidas

- **Publicidad con formato de página:** un aviso al final del mismo tamaño que una página normal y en la misma carpeta del capítulo pasa como página. Se destilda a mano; en un lote, entra.
- **Sagas incluidas solo para One Piece**, con rangos cargados de memoria. Las de otras series hay que cargarlas en opciones.
- **Sin detección de tomo (volumen).** La página no lo indica.
- **El nombre depende del título de la página.** Si el sitio no actualiza el título al pasar de capítulo sin recargar, el nombre puede quedar con el número anterior; se soluciona con F5.
- **El registro de guardados no mira el disco.** Si borrás un archivo a mano, la extensión sigue diciendo que lo guardaste hasta que lo quites en opciones.
- **Lectores que protegen las páginas** (imágenes `blob:` descifradas en el momento, como MANGA Plus): no se guardan. Desde la 2.8.1 se reconocen y se avisa (sección 4.1). Los lectores que dibujan las páginas en un `<canvas>` y las imágenes puestas como fondo CSS no se detectan: ahí el diálogo dice "No encontré páginas".
- **Solo Chrome de escritorio** (y navegadores Chromium que acepten extensiones descomprimidas).
- **Referer:** las imágenes se bajan sin el Referer del sitio. En one-piece-fans2.com no hace falta (verificado); si otro servidor de imágenes lo exige, devuelve 403 y el guardado lo informa como "No se pudo leer ninguna página (HTTP 403)".
- **Iframes:** el script no corre dentro de iframes; un lector que muestre las páginas dentro de uno no se detecta.
- **El recorrido de la página mueve la ventana, no un panel interno.** En un lector que tenga su propio scroll adentro, no carga nada nuevo.
- **Varios capítulos:**
  - Si la dirección de cada capítulo incluye algo que cambia de uno a otro además del número (por ejemplo la fecha en que se publicó, `/2025/02/…`), no hay un molde con `{n}` que sirva para todos: solo se pueden tomar de links.
  - Hace falta que la dirección de cada capítulo lleve su número, o que la página tenga links o un desplegable con los capítulos. En un sitio con direcciones tipo `/leer/a8f3c2` o con un código del sitio (`/viewer/2010289`) y sin lista, no hay forma de armarlas.
  - Los links de capítulos con un código de más de 5 cifras en la dirección no se toman como capítulos.
  - Un capítulo con menos de 3 páginas no se guarda ("Sin páginas").
  - La pestaña desde donde se inició tiene que quedar abierta y en la misma página; un lote por pestaña a la vez.
  - Los sitios que solo insertan las imágenes cuando la página está a la vista necesitan "Abrir cada capítulo a la vista".
  - Si la primera forma del número no existe (por ejemplo `/5` en un sitio que usa `/05`), ese primer intento cuesta unos 10 s, una sola vez por sitio.
- **Con "Preguntar dónde guardar cada archivo" activado en Chrome**, cada archivo abre un cartel. Conviene desactivarlo para guardar imágenes sueltas o lotes.
- **Si el service worker se reinicia en medio de un guardado**, ese guardado se pierde y el documento offscreen puede quedar abierto hasta cerrar el navegador.

---

## 13. Cómo modificarla

### Sitios incluidos

Desde la 2.8.5 no hay: la lista es la del usuario y se carga pegándola en opciones, sin tocar el código. Si alguna vez se vuelven a incluir, van en `sitios.js`, dentro de `SITIOS`, una entrada por sitio con los campos `nombre`, `url` (https), `tipo`, `idiomas`, `modelo`, `guardar` y `descripcion` (hasta 180 caracteres, terminada en punto). Los valores válidos están en el comentario del principio del archivo. `tests/test_sitios.js` revisa que cada entrada esté bien cargada. Para sitios personales no hace falta tocar el código: van en "Mis sitios", en opciones.

### Agregar sagas de otra serie

Desde **Guardados, sagas y opciones**, sin tocar el código (sección 4.10). Para que vengan incluidas en la extensión, agregarlas en `sagas.js` con el nombre de la serie **en minúsculas, tal como sale en el nombre del archivo**:

```js
globalThis.MR_SAGAS = {
  'one piece': [ /* … */ ],
  'naruto': [
    [1, 244, 'Parte 1'],
    [245, 700, 'Shippuden'],
  ],
};
```

### Cambiar el formato por defecto

En `openSaveDialog` (`content.js`), y lo mismo en `openChapterDialog` con `#mr-chapter-…`:

```js
sv('#mr-save-pdf').checked = st.savePdf !== false;   // PDF tildado salvo que lo destildes
sv('#mr-save-cbz').checked = st.saveCbz === true;    // cambiar a  !== false  para CBZ por defecto
```

### Cambiar la carpeta base

Buscar `MangaReader/` en `background.js` (`runBuild`, donde se arman las rutas reales) y en `content.js` (`refresh`, la vista previa).

### Ajustar el filtro

En `flagNonPages`: cantidad de páginas finales revisadas (`good.length - 3`), rangos de proporción en `fits`, y cuándo no se aplica (`uniform`). Sumar el caso en `tests/test_filtro.js`.

### Otro formato de título o de dirección

Los títulos se interpretan en `detectChapter` y las direcciones de capítulo en `splitChapterUrl`. Sumar el caso en `tests/test_nombres.js` o `tests/test_capitulos.js` antes de tocar la expresión.

### Después de cualquier cambio

`bash tests/correr.sh` y, si se tocó algo de la interfaz o de los lotes, `node tests/e2e.js`. En Chrome: `chrome://extensions` → 🔄 en la tarjeta. Los errores de `content.js` se ven en la consola de la pestaña (F12); los de `background.js` en el enlace "service worker" de la tarjeta de la extensión; los de `offscreen.js`, en `chrome://extensions` → "Inspeccionar vistas".

Para probar un sitio nuevo sin dejar archivos: `node tests/probar_sitio.js "<dirección del capítulo>" [desde] [hasta]`.

---

## 14. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| El popup dice "En esta página no se puede usar" | Es una página del navegador (`chrome://…`, la tienda) o un PDF | Usarlo en la pestaña del manga |
| No aparece la burbuja | Está oculta (en todos lados o en ese sitio), o la página no parece un capítulo | Activarla en el popup, o usar `Alt+S` |
| `Alt+S` no hace nada | Otro programa o extensión usa el atajo | Cambiarlo en `chrome://extensions/shortcuts` |
| La página se mueve sola al abrir el diálogo | Es el recorrido automático | Esperar unos segundos, o apagarlo en el popup |
| Faltan páginas | No terminaron de cargar | **Recorrer la página** en el diálogo, o bajar hasta el final |
| Aparece el logo o un aviso en el PDF | El filtro no lo detectó | Destildar su miniatura antes de guardar |
| Falta una página que sí es del capítulo | El filtro la marcó como AD | Tildar su miniatura |
| El nombre sale raro | El título de la página tiene otro formato | Editar el nombre en el diálogo |
| Archivo con `(1)` al final | Ya existía uno con ese nombre | Es el comportamiento normal de Chrome |
| "No se pudo bajar la página N" / "Faltaron páginas" | Esa página falló aun con reintentos | Volver a guardar; la miniatura queda con borde rojo |
| "No se pudo leer ninguna página (HTTP 403)" | El servidor de imágenes rechaza a la extensión (Referer, sesión) | Limitación conocida (sección 12) |
| "guardado como … Capitulo" sin acento | El sistema rechazó el nombre con acentos | Automático; el archivo se guardó igual |
| No aparece "Guardar y siguiente" | No se pudo saber cuál es el siguiente (la dirección no tiene número y no hay lista) | Pasar a mano |
| 🔒 "Este sitio protege las páginas del capítulo" | El lector muestra las páginas cifradas (imágenes `blob:`) | No se pueden guardar con la extensión (sección 12) |
| Varios capítulos: "la dirección de este capítulo no lleva su número" y el campo Dirección vacío | El sitio usa un código por capítulo (por ejemplo `/viewer/2010289`) | Bajar los que figuren en la lista, o escribir el molde con `{n}` si lo conocés |
| Lote: "Parado: … Los primeros 3 capítulos no tenían páginas" | La dirección con `{n}` no es la de los capítulos, o el sitio solo carga a la vista | Revisar "Dirección y nombre de los capítulos"; tildar "Abrir cada capítulo a la vista" |
| Lote: "Parado: … 3 capítulos seguidos no tenían páginas" | Se pasó del último capítulo que tiene el sitio | Normal |
| Lote: "sin páginas" en todos | La dirección con `{n}` no es la de los capítulos, o el sitio solo carga a la vista | Revisar "Dirección y nombre de los capítulos"; tildar "Abrir cada capítulo a la vista" |
| Lote: "sin páginas" en algunos | Esos capítulos no existen con ese número | Normal (por ejemplo, números que el sitio no tiene) |
| Varios capítulos: la lista muestra meses ("enero 2021"…) y cada "capítulo" baja varios juntos | Versión anterior a la 2.8.6: tomaba el archivo por mes del sitio como capítulos | Cargar la 2.8.6 o posterior |
| Varios capítulos: "No encontré los otros capítulos: la dirección de esta página (…html) no termina en el número" | La dirección del capítulo termina en un archivo sin el número al final, y la página no tiene links a los capítulos | Abrir el diálogo desde la página que lista los capítulos, o escribir la dirección con `{n}` si todas siguen un mismo formato |
| Con links pegados, los números salen mal | Los links traen más de un número, o ninguno | Elegir "Número: en el orden pegado" (o "al revés") y poner desde cuál, o escribir el número adelante de cada link (`12: link`) |
| Con links pegados, el nombre de los archivos sale raro | El campo Serie quedó vacío y se usó el título de cada página | Escribir la serie antes de descargar |
| Lote: la lista sale casi vacía | El desplegable del sitio todavía no había cargado | **↻ Buscar de nuevo**, o usar el rango |
| Lote: se cortó solo | Se cerró o cambió de página la pestaña que lo manejaba | Volver a iniciarlo: los ya guardados se saltean |
| Las sagas que cargué no se usan | El nombre de la serie no coincide con el del archivo | Copiar el nombre tal como sale en `Serie/Serie 0001` |

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
| 2.6 | Primer intento de descarga por lotes. **No funcionaba:** el diálogo se rompía al abrir, no tenía estilos y leía el HTML crudo de cada capítulo, que en sitios armados con JavaScript viene vacío. No usar |
| 2.8 | **Sitios de manga y cómics:** desde el ícono, una lista de 85 accesos directos a sitios legítimos de manga, manhwa, cómics, tiras e historieta, con etiqueta de tipo e idiomas en cada fila y una **i** que dice qué tiene, si es gratis y si se puede guardar. Filtros (Manga, Cómics, en español, se pueden guardar) y buscador. **Mis sitios:** agregar, editar y quitar los tuyos desde opciones o con "Agregar esta página"; entran en la copia exportada |
| 2.8.1 | **Correcciones por MANGA Plus.** Una dirección con un código del sitio (`/viewer/2010289`) ya no se toma como capítulo 10289 ni genera direcciones inventadas (`/viewer/2010289/01`, que daban "Page not found"): el diálogo de varios capítulos lo explica y deja la dirección para completar. Títulos `[#104] Serie`. **Páginas protegidas** (imágenes `blob:` o `<canvas>`): el diálogo avisa con 🔒 en vez de ofrecer el logo y los banners como páginas, la burbuja no aparece y el lote para enseguida. **El lote para solo** después de 3 capítulos seguidos sin páginas, en vez de abrir una pestaña por cada capítulo marcado. `probar_sitio.js` informa también el diálogo de guardar |
| 2.8.2 | **Lista de sitios recortada a 23:** quedan solo plataformas donde los capítulos se leen en el mismo sitio, con el catálogo completo y al día (MANGA Plus, MANGA MILLION, WEBTOON, VIZ, Manga UP!, Lezhin, Manta, Toomics, GlobalComix, Marvel, Panel Syndicate y otras). Salen tiendas, préstamos de biblioteca, archivos de números sueltos, secciones de diarios, sitios sin actualizar, Tapas (cierra en marzo de 2027) y DC Universe Infinite (no anda desde Argentina). Marvel pasa a su lector, `marvelcomicsapp.com` |
| 2.8.3 | **Lista de sitios dividida** en 📥 Descargables y 👁 Para leer en el sitio, con la cantidad de cada sección; se pliegan tocando el título y se recuerda. **Filtro de idioma** (Todos, Español, Inglés) en lugar de "En español", con un botón por cada idioma de la lista; reemplaza también a "Se pueden guardar", que ahora es la división. **Tus sitios** llevan "Se puede descargar" para caer en la sección que corresponde |
| 2.8.4 | **Revisión de la 2.8.1 a la 2.8.3: tres correcciones para que el lote no se rompa en sitios que antes andaban.** (1) Si la dirección termina en un número de hasta 5 cifras se vuelve a confiar en ella aunque el título diga otro: la 2.8.1 la descartaba, y fallaba con títulos que terminan en un año o que quedan viejos al cambiar de capítulo sin recargar. (2) Un listado con un código largo en su dirección vuelve a tomar los capítulos de sus links. (3) "Páginas protegidas" cuenta solo imágenes `blob:`: los `<canvas>` de adorno o de publicidad daban falsos avisos y frenaban el lote. Además, el nombre usa el número de la dirección cuando aparece en el título (`… 7 Español Online - 2026` es el 7), y `#1 …` al principio ya no pisa al número del final. Sitio de prueba nuevo con ese estilo en la prueba de navegador |
| 2.8.5 | **La lista de sitios pasa a ser solo la tuya.** Se quitan los 23 sitios incluidos. **Pegar una lista:** en opciones se pega el texto entero, con una dirección por renglón, y se detectan solos el nombre, la descripción, el tipo y el idioma (también con títulos de grupo como "Manga en español:"); antes de agregar muestra lo que encontró, y una casilla decide si van a Descargables o a Para leer. Buscador y **Quitar todos** en la lista de opciones. El popup vacío ofrece pegar la lista. Prueba nueva de **lote largo** (`tests/lote_largo.js`): 70 capítulos seguidos sin cortes |
| 2.8.6 | **El archivo por mes de un sitio ya no se toma como capítulos.** En los sitios armados como un blog, los links "enero 2021", "febrero 2021"… (`/2021/01/`) y los del calendario (`/2021/01/15/`) terminan en un número y la lista de varios capítulos los mostraba como capítulo 1, 2, 3…; pedir "del 1 al 104" bajaba la página de cada mes, con varios capítulos mezclados y sin orden. Ahora se descartan en links, desplegables y en la dirección de la página, y la lista sale de los links a los capítulos. Sitio de prueba nuevo con ese armado |
| 2.8.7 | **No se inventan direcciones sobre un archivo.** Cuando la página del capítulo termina en `.html`, `.php` y parecidos sin el número al final, y no hay links a los capítulos, el diálogo de varios capítulos suponía "esta dirección + /número" (`….html/1`) y el lote abría páginas que no existen. Ahora deja la dirección vacía, explica que no encontró los otros capítulos y no abre nada. El texto de la lista vacía ya no invita a marcar un rango si no hay dirección con `{n}` |
| 2.9 | **Pegar los links de los capítulos.** En el diálogo de varios capítulos se pega una lista de links, de cualquier sitio y con el texto que traiga alrededor, y la extensión arma la lista con el número de cada uno: el que esté escrito adelante, el que trae el propio link (aunque esté en el medio del nombre) o el orden en que se pegaron, desde el número que se elija y también al revés. Avisa repetidos y números que faltan. Con la serie escrita, cada archivo sale con esa serie y el número de la lista, que manda sobre el título de la página |
| 2.7 | **Varios capítulos seguidos, rehecho:** cada capítulo se abre en una pestaña en segundo plano y se guarda con el mismo código del guardado normal; funciona desde un capítulo y desde la portada; rango por número con ceros adelante; desplegables; cancelar; saltear guardados. **Una sola bajada por página** para PDF, CBZ e imágenes, con reintentos y aviso de qué páginas faltaron. **PNG sin pérdida** en el PDF. **Imágenes sueltas con su extensión real.** **Recorrido automático** de la página al abrir. **Guardar y siguiente.** **Sin F5** después de actualizar. **Burbuja por sitio.** Página de **guardados, sagas y opciones** con exportar/importar y capítulos faltantes; sagas editables. Correcciones: títulos con el nombre del capítulo o palabras de más, filtro en webtoons y en lectores con links al CDN, dos diálogos al pedirlo dos veces, clics perdidos en miniaturas, teclado en todo el diálogo, la burbuja deja de revisar páginas que no son de manga |
