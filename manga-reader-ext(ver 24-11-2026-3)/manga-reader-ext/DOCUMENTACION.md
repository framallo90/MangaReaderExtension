# Manga Reader — Documentación técnica y de uso

**Versión:** 2.11.3 · **Tipo:** extensión de Chrome (Manifest V3) · **Idioma de la interfaz:** español

---

## Índice

1. [Qué es y qué hace](#1-qué-es-y-qué-hace)
2. [Instalación y actualización](#2-instalación-y-actualización)
3. [Cómo se usa](#3-cómo-se-usa)
4. [Funciones en detalle](#4-funciones-en-detalle) (las páginas dibujadas de fondo en la [4.18](#418-páginas-dibujadas-de-fondo-2113); la regla del freno, una sola para la extensión y el programa, en la [4.19](#419-el-freno-cuánto-no-pedirle-nada-a-un-sitio-que-pidió-esperar))
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
- **Tomos (2.10):** si la página de la serie separa los capítulos con títulos ("Tomo 3", "Volumen 2", "Saga de…"), el diálogo de varios capítulos también los muestra agrupados, y un tomo entero se marca con un clic.
- **Plantilla de nombres (2.10):** el nombre y las carpetas con que se guarda cada capítulo se pueden cambiar desde opciones, con marcadores como `{serie}`, `{volumen}` o `{numero}`.
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

**Pestañas Capítulos / Tomos (desde la 2.10).** Si la página separa los capítulos en tomos, arriba de la lista aparecen dos pestañas. **Capítulos** es la lista de siempre. **Tomos** muestra un renglón por tomo, con su nombre, de qué capítulo a cuál va y cuántos son (y cuántos ya guardaste); los capítulos que no están en ningún tomo van juntos en "Sin volumen". Tildar un tomo marca todos sus capítulos y destildarlo los desmarca; si solo algunos están marcados, la casilla queda a medias. Las dos pestañas muestran lo mismo de dos maneras: se puede tildar un tomo y después, en Capítulos, sacar uno suelto. Si la página no separa en tomos, las pestañas no aparecen.

Dentro de "Dirección y nombre de los capítulos" hay un renglón **Ejemplo:** con la carpeta y el nombre con que se va a guardar el primer capítulo marcado. Si no escribiste la serie y la página es un listado, donde va la serie dice `(serie)`: sale del título de cada capítulo al abrirlo.

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

**Páginas sin dirección para bajar (`locked`).** Algunos lectores no muestran las páginas como imágenes con dirección: las arman en el momento y las muestran como imágenes `blob:` (MANGA Plus). La extensión no las guarda. Se cuentan las imágenes `blob:` grandes o que todavía están cargando; los `<canvas>` no se cuentan, porque muchos sitios comunes tienen canvas de adorno o de publicidad. Si hay 2 o más, y lo que sí tiene dirección no arma un capítulo (no hay una carpeta con la mayoría de las imágenes) o es menos que esas, lo que queda a la vista (el logo, banners o promociones del sitio) viene destildado, para no guardarlo como si fuera el capítulo.

**No hay un aviso especial (desde la 2.9.1).** De la 2.8.1 a la 2.9.0 el diálogo mostraba un recuadro naranja con 🔒 y el lote frenaba en el primer capítulo con ese mensaje. Se sacó a pedido. Ahora:

- el diálogo de guardar dice "No encontré páginas del capítulo en esta página." y no deja guardar;
- en un lote, el capítulo sale como cualquier otro "sin páginas", y el lote para si pasa 3 veces seguidas;
- la burbuja sigue sin aparecer (sección 4.7).

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

**Plantilla de nombres (desde la 2.10).** Ese resultado es la plantilla predeterminada, `{serie}/{saga}/{serie} {numero}`. En opciones → "Cómo se guardan los archivos" se puede escribir otra. Una `/` crea una carpeta y cada marcador se reemplaza por el dato del capítulo (`contextoPlantilla`):

| Marcador | Qué pone | De dónde sale |
|---|---|---|
| `{serie}` | La serie, ya limpia | Del título de la página, o la que escribas en el lote |
| `{numero}` | El número con 4 cifras (`0005`, `1134.5`) | Del título o la dirección; en un lote, de la lista |
| `{saga}` | La carpeta de saga (`11 Saga Final`) | De la tabla de sagas de esa serie; vacío si no tiene |
| `{volumen}` | El tomo del capítulo (`Tomo 3- La huida`) | Del agrupado de la pestaña "Tomos". **Solo en un lote** |
| `{titulo}` | El nombre del capítulo en la lista | Del texto de su link. **Solo en un lote** |
| `{anio}` | El año en que se guarda | La fecha de la máquina |
| `{sitio}` | El sitio (`sitio.com`) | La dirección de la página |

- **Un marcador sin valor no deja rastro** (`sanitizarPlantilla`): no queda la carpeta vacía, ni el separador que lo unía al resto (`-`, `_`, `,` o `·`, con sus espacios), ni los paréntesis o corchetes que lo encerraban. Con `{serie}/{volumen}/{serie} {numero} - {titulo}`, un capítulo de un lote queda `Serie/Tomo 2/Serie 0004 - Capítulo 4` y uno guardado de a uno, `Serie/Serie 0004`.
- **Limpieza para Windows:** en cada tramo, `\ : * ? " < > |` y los caracteres de control se cambian por `-` (varios seguidos, por uno solo), se quitan los puntos del principio y los puntos y espacios del final, se limita a 100 caracteres y se evitan los nombres reservados. Una `/` o `\` **dentro de un dato** (un título "Ida/Vuelta") se cambia por `-`: solo las barras escritas en la plantilla crean carpetas.
- **La predeterminada es el nombre de siempre:** si no hay plantilla guardada, o la guardada es igual a la predeterminada, el nombre lo arma `nameFor` como en las versiones anteriores, sin pasar por la plantilla. Con una propia, `nameFor` llama a `nombrePorPlantilla`.
- **Avisos en opciones:** si la plantilla no tiene `{numero}` ni `{titulo}` (todos los capítulos de una serie se llamarían igual; Chrome los guarda como "nombre (1)") y si tiene un marcador que no existe (`{capitulo}`), que quedaría escrito tal cual.
- **La vista previa y el guardado usan el mismo código** (`plantilla.js`): lo que muestra opciones es lo que después se guarda. Un cambio de plantilla vale en las pestañas ya abiertas, sin recargarlas.
- **El registro de guardados** anota la serie y el número de cada capítulo guardado con una plantilla propia, porque ahí la primera carpeta puede ser el sitio o el año y el nombre terminar en el título: con eso la página de guardados sigue agrupando por serie y diciendo qué falta. El `ComicInfo.xml` del CBZ toma la saga de la tabla y no de la carpeta.

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

- **Cuándo aparece:** cuando hay 3 o más imágenes ya cargadas de al menos 250 px de ancho y 600 px de alto en la misma carpeta (las miniaturas del diálogo no cuentan, ni las imágenes `blob:`, que no tienen dirección para bajar). Se revisa a los 1,5 s y a los 5 s de cargar la página, y además cada vez que termina de cargar una imagen o bajás por la página (agrupado cada 700 ms), hasta que aparece. Después de 40 revisiones sin que la página parezca un capítulo, deja de mirar, para no gastar en páginas que no son de manga.
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

**Tomos (desde la 2.10).** Al armar la lista, `collectChapters` le anota a cada capítulo el título que tiene encima en la página, si nombra un tomo (`seccion`):

- Se recorren en orden los títulos (`<h1>` a `<h6>` y `<summary>`) y los links. Cada título de hasta 80 caracteres pasa a ser el vigente para los links que siguen.
- El título vale como tomo si dice volumen, vol., tomo, saga, arco, temporada, parte o libro (o sus nombres en inglés): es `SECCION_RE`. Uno que no lo dice ("Comentarios", "Últimos capítulos") corta el tomo anterior y no se anota.
- Si un capítulo está enlazado dos veces (en un bloque de "Últimos capítulos" y en su tomo), vale donde tenga un tomo encima.
- En un desplegable, el tomo es el grupo de la opción (`<optgroup label="Volumen 3">`).

Con eso, `tomosDe` arma los grupos de la pestaña "Tomos": hacen falta **al menos dos tomos distintos** en la lista (un solo título arriba de todo no inventa un tomo) y **al menos dos capítulos** por tomo; los demás van a "Sin volumen". Los capítulos agregados por rango o pegados como links no tienen tomo. El tomo de cada capítulo es también su `{volumen}` en la plantilla de nombres. El criterio está en `agrupar.js`, el mismo archivo que usa el programa de escritorio para mostrar los capítulos por volumen.

**Cómo se baja cada capítulo.** La pestaña donde abriste el diálogo maneja el lote y le pide los capítulos de a uno al service worker (`batchChapter`). Para cada uno:

1. Espera 1,5 s (menos en el primero), para no cargar al sitio.
2. Abre el capítulo en una **pestaña en segundo plano**, al lado de la tuya. Ahí el sitio arma la página como siempre, aunque lo haga con JavaScript.
3. Espera a que termine de cargar y a que las imágenes de la carpeta más poblada dejen de sumarse (misma cantidad, 3 o más, en tres consultas seguidas cada 700 ms). Si a los ~10 s no hay nada que parezca un capítulo, sigue igual y el paso siguiente lo informa.
4. Le pide al content script de esa pestaña que se guarde solo (`autoSave`): mismas funciones que el guardado a mano (detección, filtro, nombre, sagas, formatos, "ya guardado"). Con menos de 3 páginas no guarda y responde "Sin páginas".
5. Cierra la pestaña y devuelve el resultado.

Un capítulo tiene 4 minutos como máximo. **Cancelar** cierra la pestaña del capítulo en curso y no sigue con los demás.

**El lote para solo** (2.8.1):

- **3 capítulos seguidos "sin páginas"** (`BATCH_MAX_EMPTY`): si todavía no se guardó ninguno, la dirección no debe ser la de los capítulos, así que lo dice y abre "Dirección y nombre de los capítulos" para revisarla; si ya se guardaron algunos, avisa que puede que el sitio no tenga más con esa dirección. Los marcados que faltaban quedan tildados para volver a intentarlo.

Ahí el resultado empieza con "Parado:" en vez de "Listo:".

**Resultado por capítulo:** ✅ con la cantidad de páginas; ⚠️ *incompleto* si alguna página no bajó (se guarda igual, no se anota como guardado); ⚠️ *sin páginas* si la dirección no llevó a un capítulo; ⚠️ *falló* por cualquier otro motivo. El detalle queda abajo del botón.

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
- **Cómo se guardan los archivos (2.10):** la plantilla de nombres (sección 4.3). Un campo para escribirla, botones con cuatro armadas (Predeterminada, Sin sagas, Por tomo, Por año) y, debajo, cómo quedaría guardado un capítulo de un lote y uno guardado de a uno. **Guardar plantilla** la deja en `esquemaNombres`; con la predeterminada (o el campo vacío) se borra esa clave. La copia exportada la incluye, y al importar se trae si acá no había una.
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

### 4.12 Marcos: el lector en un iframe (2.11)

El script corre en la página y en cada uno de sus iframes (`all_frames`). Cada marco cuenta sus candidatas con `countCandidates`, y el service worker les pregunta a todos de una vez (`contarMarcos`, con `chrome.scripting.executeScript({ allFrames: true })`).

- **A quién se le habla** (`tellTab`): `save` y `autoSave` van al marco con más candidatas (`marcoCon`); `batch`, a la página, porque la lista de capítulos está ahí. Si empatan gana el de más arriba: con las mismas imágenes en la página y en un iframe se guarda una sola vez.
- **La burbuja en un solo marco:** el marco que parece un capítulo manda `candidato` antes de mostrarla; el service worker cuenta de nuevo, le contesta si gana y a los demás les manda `ceder`. No anota quién ganó: así no depende de seguir despierto. Una página sin iframes no pregunta nada.
- **De quién es el capítulo:** en un iframe, el nombre, el número, la dirección para el registro y el sitio son los de la página de arriba. Se piden con `contexto` (`pedirArriba`), que funciona aunque el iframe sea de otro origen, y los usan `nombreAca`, `capituloAca`, `claveAca` y `sitioAca`.
- **Un lote:** la espera a que el capítulo se arme mira el marco que más tiene (no la suma), y el progreso y las notas vuelven al marco que los pidió (`frameId`).

### 4.13 La cola del lote, la insignia y el aviso (2.11)

La cola es lo que pidió el último lote y cómo le fue a cada capítulo. Vive en `chrome.storage.local.cola` (ver la sección 8) y la escribe solo el service worker, de a un cambio por vez (`conCola`): cada cambio lee, modifica y escribe, y dos a la vez se pisarían.

- **Se escribe** al encolar (`colaNueva`) y en cada cambio de estado (`colaMarca`): `pendiente`, `listo` o `fallo`, este último con su motivo. El capítulo que sale bien lo anota además el propio service worker al terminar `batchChapter`: vale aunque la pestaña del lote ya se haya cerrado. Los que fallan los anota la pestaña, que sabe si quedaba otra forma de la dirección por probar.
- **Al terminar** (`colaFin`): si quedó todo `listo` se borra; si no, queda. El diálogo de varios capítulos la ofrece al abrirse en ese sitio (`mostrarCola`): **Reanudar (N)** con lo pendiente, **Reintentar los N que fallaron** (`colaReintentar` los pasa a pendiente) y **Descartar la cola**.
- **Al seguir** (`seguirCola`), la lista del diálogo pasa a ser lo que falta. Los capítulos cuya dirección se había armado con el número (`armado`) se vuelven a armar, por si el sitio usa ceros adelante; lo que se saltea por estar ya guardado se da por listo.
- **Insignia** (`insignia`): `hechos/total` en el ícono mientras corre (azul), verde o roja al terminar; se limpia al cerrar el diálogo (`insigniaLimpiar`).
- **Notificación** (`avisarFin`): el resumen y los botones "Reintentar los que fallaron" (si hubo fallas) y "Mostrar la carpeta". Qué botón es cuál se saca de la cola guardada, no de la memoria: el clic se entiende aunque el service worker se haya dormido. Reintentar vuelve a la pestaña de la serie (o la abre) y le pide `batch` con `reintentar`. Un lote cancelado a mano no avisa.

### 4.14 Ritmo, esperas y carpeta base (2.11)

Las reglas están en `ajustes.js` y son las mismas para opciones, las pestañas, el armador y el service worker.

- **Ritmo** (`ritmo`, `normalizarRitmo`): pausa entre capítulos (0 a 10 s; 1,5), descanso cada N capítulos (apagado) de tantos segundos, e imágenes que se miden a la vez (2 a 8; 6). `pausaAntes(hechos, ritmo)` da los milisegundos antes de cada capítulo. Lo que se pasa de los límites queda en el límite.
- **Una página que responde 429 o 503** (`fetchRetry`, `esperaReintento`): se espera lo que diga `Retry-After` (segundos o una fecha, con tope de un minuto) o 2, 4 y 8 segundos, y se reintenta hasta 3 veces. Esas esperas no gastan los reintentos comunes.
- **El sitio pide esperar con un capítulo de un lote (429 o 503):** da lo mismo que lo responda la página del capítulo o sus imágenes (desde la 2.11.1; antes un 503 en las imágenes contaba como una falla común y el lote seguía pidiendo).
  - **La página:** lo ve el service worker después de cargarla (`performance.getEntriesByType('navigation')[0].responseStatus`) y contesta "HTTP 429: el sitio pidió esperar" (o 503). Desde la 2.11.2 lee además la cabecera `Retry-After` de esa respuesta: de la navegación solo se ve el código, así que la junta `webRequest.onHeadersReceived` (documentos, `main_frame`) en `pedidos`, por pestaña.
  - **Las imágenes:** el lote guarda con `soloEntero`. En el armador, la primera página que queda afuera por un 429 o un 503 —después de sus esperas— corta el capítulo: las que faltaban no se piden, no se arma nada a medias y el error es el mismo, "HTTP 503: el sitio pidió esperar". Un archivo incompleto dejaría después el entero como `nombre (1)`. El armador devuelve también lo que dijo el sitio (`esperar: { status, retryAfter }`), aunque no haya armado nada.
  - **Cuánto frena el lote:** lo dice la regla del freno, la misma del programa (sección 4.19). El service worker anota hasta cuándo no pedirle a ese sitio en `esperaSitio` (`chrome.storage`, por nombre del sitio), y la pestaña del lote lo mira **antes de cada pedido** (`frenar`), con la cuenta regresiva a la vista ("sigo en N s"). Frena el reintento de ese capítulo y también el capítulo que sigue.
  - **Qué hace el lote:** `pidioEsperar` reconoce los dos códigos. El lote espera lo que pidió el sitio, una sola vez reintenta ese capítulo; si vuelve a fallar queda en la cola como falla con "el sitio pidió esperar", para **Reintentar**, y el capítulo siguiente igual espera antes de pedirse.
  - **Guardando de a uno** (el diálogo) no hay `soloEntero` ni freno: el capítulo se guarda con lo que bajó y el aviso dice por qué faltó el resto ("No se pudo bajar la página 3 (el sitio pidió esperar: HTTP 503)").
  - **`webRequest` solo escucha mientras un lote tiene un capítulo abierto** (`escuchar`): un oyente registrado siempre despertaría al service worker con cada página que se abre en el navegador. El permiso no suma advertencias al instalar (el acceso a todos los sitios ya estaba; ver sección 9).
- **`esperaPedida` y `esperaDelSitio`:** ver la regla del freno (sección 4.19).
- **Carpeta base** (`carpetaBase`, `validarCarpeta`, `aplicarCarpeta`): la carpeta de Descargas donde va todo, con `{sitio}`, `{serie}` y `{anio}`. No acepta `..`, `.`, una barra adelante, una letra de unidad ni marcadores desconocidos. Si igual llega mal (una copia importada), al guardar vale `MangaReader`: no es motivo para no guardar.

### 4.15 Adaptadores por sitio (2.11)

`adaptadores` guarda, por host, `{ contenedor, imagenes, ignorar: [], patron }`. Se editan en opciones.

- `imagenesDeLaPagina` decide de qué imágenes se parte: las del adaptador (`imagenesConAdaptador`) o, si no hay o sus selectores no sirven, todas las de la página. La usan `collectPages`, `countCandidates` y `looksLikeChapter`, que la buscan con `typeof`: el programa de escritorio usa esas tres funciones sin el resto del archivo, y ahí no existe.
- **Con un adaptador no se filtra nada** (`hayAdaptador`): lo que señalan sus selectores son las páginas. `flagNonPages` no corre. Desde la 2.11.1 tampoco queda nada de las otras reglas de la detección automática, que hasta la 2.11.0 seguían valiendo:
  - **el lado mínimo** (250 px) no se mira en `collectPages`, en `countCandidates` ni en `looksLikeChapter`: entran las tiras de un webtoon, más bajas que eso. Una imagen que no cargó sigue contando como página caída;
  - **la carpeta con más imágenes:** `countCandidates` cuenta todas las del adaptador, estén en la carpeta que estén (con cada página en su carpeta contaba 1 y el lote no las veía llegar);
  - **el mínimo de 3:** para la burbuja alcanza con una imagen cargada donde dice el adaptador, y `autoSave` guarda un capítulo de una o dos páginas.
  - Lo que no sea una página (un píxel de seguimiento adentro del contenedor) se saca con `ignorar`.
- `contenedor` puede coincidir con varios bloques; `imagenes` se busca adentro del contenedor, o en toda la página si no hay; si señala un bloque en vez de una imagen, se toman las de adentro; `ignorar` saca lo que coincida o esté adentro de algo que coincida.
- `patron` (con `{n}`) queda puesto como dirección de los capítulos al abrir el diálogo de varios capítulos.
- **Selector inválido:** opciones lo avisa y no lo guarda (`selectoresInvalidos`). Si igual llega a una página (una copia importada), `imagenesDeLaPagina` lo ataja y sigue la detección automática; desde la 2.11.1 el diálogo de guardar lo avisa ("el adaptador de este sitio tiene un selector inválido: busqué las páginas como siempre"). Hasta la 2.11.0 el motivo se anotaba en `adaptadorRoto` y no se mostraba.
- **Probar en esta página:** opciones manda `probarAdaptador`; el service worker busca la pestaña de ese host que se usó último, lo prueba en cada marco y devuelve lo del que más encontró: cuántas imágenes y las primeras 3 direcciones.
- Al cambiar el adaptador con el diálogo de guardar abierto, se busca de nuevo y la selección empieza de cero.

### 4.16 Orden de las páginas y teclado (2.11)

- **Orden:** el de `pages` es el del PDF, el del CBZ y el de la numeración de las imágenes. `moverPagina` (arrastrar una miniatura, o ▲▼), `ordenarPaginas('invertir' | 'numero')`. `numeroDeImagen` saca el número del nombre del archivo (el último que tenga). Con `ordenManual` puesto, una búsqueda posterior respeta el orden y agrega lo nuevo al final.
- **Teclado:** los dos diálogos llevan `role="dialog"`, `aria-modal` y `aria-label`; `atraparFoco` hace que Tab no salga del diálogo; `recordarFoco` y `devolverFoco` devuelven el foco a donde estaba en la página. Entre miniaturas, `flechasMiniaturas`: flechas (la de arriba y la de abajo saltan una fila de 5), Inicio y Fin; Alt + flecha izquierda o derecha la cambia de lugar. La barra espaciadora no necesita código: cada miniatura es un botón, y dice su estado con `aria-pressed`.
- **Varios capítulos:** "Ordenar por número" e "Invertir" (`ordenarCapitulos`, `alReves`): el orden de la lista es el orden en que se bajan.
- **Links pegados:** `quitarGuardados` saca los que ya están en el registro (salvo que se haya destildado "Saltear los que ya guardé") y el mensaje dice cuántos.

### 4.17 Menores de la 2.11

- **Registro en CSV** (`registroCsv`, en `opciones.js`): Serie, Capítulo, Número, Fecha, Páginas, Dirección y "Guardado como", separado por punto y coma y con BOM, que es lo que abre bien Excel en español.
- **Tamaño estimado de un lote** (`estimarLote`): cada capítulo guardado anota `kb`; el promedio de los de ese sitio (o de esa serie, si hay dos o más) por la cantidad a bajar. Desde `AVISO_TAMANO_KB` (200 MB) se avisa.
- **Versión nueva** (`versionRemota`): una vez por día, al abrir el popup, se lee el `README.md` de la rama `main` del repositorio (dice cuál es la carpeta de la última versión) y el `manifest.json` de esa carpeta, que es el que manda. Si es más nueva que la instalada (`compararVersiones`), aparece un punto en el popup.

### 4.18 Páginas dibujadas de fondo (2.11.3)

Hay lectores que no usan `<img>`: pintan cada página como fondo de un bloque (`background-image`, a veces un SVG con el escaneo adentro) o con un `<image>` de SVG. Hasta la 2.11.2 la detección no los veía y se quedaba con cualquier imagen suelta de la página: en Issuu guardó 18 tapas de otras publicaciones, que es peor que fallar porque parece que anduvo. La regla se ajustó después de tres revisiones adversariales, que la probaron contra páginas que no son capítulos (diarios, foros, catálogos, sitios empaquetados con Vite o webpack): lo que sigue es cómo quedó.

- **De dónde salen** (`fondosDe`): el estilo calculado de cada elemento y de su `::before` y `::after`; los atributos de carga diferida (`data-bg`, `data-background`, `data-background-image`, `data-bg-src`, `data-lazy-background`, `data-bgset`: la página todavía no se pintó, como `data-src` en las `<img>`); las reglas de las hojas que se pueden leer (las de otro sitio no), con las direcciones relativas a la hoja; `image-set()` (la de mayor resolución: `x`, `dppx`, `dpi`); y los `<image href>` de los SVG en línea. Los degradés y `none` no tienen dirección. El fondo de `<html>` y `<body>` es el de la página entera. De las reglas vale solo lo que el estilo calculado no muestra (un `:hover`, una clase que se pone después): un elemento que ya tiene su fondo se queda con ese, como en la cascada, y un `@media` que no se cumple no cuenta. Una `data:` de menos de 20 000 letras es un ícono incrustado, no un escaneo; las `blob:` no se pueden bajar.
- **La serie** (`serieDeFondo`): la dirección con los números como `#` (y los códigos de 12 letras o más que tienen números, sin la palabra de adelante). Las páginas de un capítulo son una serie: `cap/7/01.png`, `cap/7/02.png`; `page_1.svg`; códigos en una carpeta; `cap/7/3/full.webp`; `imagen.php?cap=7&p=3` (la consulta cuenta solo si la ruta no tiene números: así `?w=20` no separa una página de su miniatura borrosa). Los adornos no: una dirección sin ningún número no es de ninguna serie (`logo.png`, `lupa.svg`), y los nombres de un empaquetador (`logo-Bx3kQ9_z.png`, `header-D4fT7aQ1.png`) son series distintas.
- **Qué entra** (`fondosDelContenedor`):
  1. De cada serie se sacan las que no son páginas: las que están adentro de un link a otro sitio (un recomendado patrocinado) o a otra parte de esta misma página (una tira de miniaturas para saltar de página, `#p3`; `linkQueNoEsPagina`), y las tapas: si tres o más llevan a páginas distintas del mismo sitio por el link que las envuelve o por el de su tarjeta (`linkDeTarjeta`: el bloque más chico, desde ella misma hasta cuatro niveles más arriba, que tiene links, si no junta otras imágenes de su misma serie y sus links van todos al mismo lugar; puede tener otras imágenes, como la foto y el avatar de una nota). Un listado en `/manga` cuyas tarjetas llevan a `/manga/obra-12` son tapas; en una aplicación con rutas por `#` (`#/obra/12`) también.
  2. Entra la serie que parece un lector: dos o más, sin `data:` ni direcciones de miniaturas (`thumbs`, `mini`, `small`, `preview`, `blur`, `lqip`, `placeholder`); entre esas, la más grande; a igualdad, la que se pinta más arriba. Una serie `data:` solo entra si no hay una con dirección (Issuu pone el mismo escaneo como `data:` adentro de la página que pinta de fondo). Y tiene que estar **junta en un bloque**: si el bloque que la junta es el `<body>` (el logo en el encabezado, la lupa, el pie), es de adornos, salvo que las imágenes sean hijas directas del `<body>`.
  3. De esa serie, lo que está en el bloque que la concentra (`contenedorDeFondos`: el más de adentro que tiene al menos ocho de cada diez; así entran también las páginas que llegan en tandas), una imagen por página (`unaPorPagina`: si una página está dibujada dos veces, queda la de arriba —la entera sobre su miniatura borrosa, la del `::after` sobre el fondo del bloque—), más lo que esté en su misma carpeta y en ese bloque con un nombre sin número (la tapa del capítulo, los créditos), en el orden del documento.
  - Sin el lado mínimo de 250 px: una página dibujada de fondo puede no tener caja propia, y un SVG puede no decir su tamaño. Vale que la imagen se haya podido cargar.
- **Cuándo van en lugar de las `<img>`** (`elegirFondo`, `fondoValeAca`): con candidatas de las dos clases ganan las `<img>`. Los fondos entran solo si no queda ninguna `<img>` que pueda ser una página (las tapas de una grilla y lo que el filtro marcó no cuentan), o si el adaptador lo pide. Y tienen que parecer un lector: en la página, dos o más de una serie; en un iframe, el marco tiene que ser grande como un lector (400 × 400 o más: los avisos miden 300×250, 728×90, 300×600) y no un reproductor de video (su póster va de fondo); ahí vale también una sola imagen (el lector de Issuu muestra de a una página).
- **El diálogo lo dice:** "N de N páginas · páginas dibujadas de fondo", con la salida al adaptador, porque es una deducción. Si el lector de fondo no se puede leer (páginas `blob:` o que no cargan), no se ofrecen las imágenes sueltas: "No encontré páginas del capítulo en esta página. El lector las dibuja de fondo y no se pudieron leer."
- **Grilla de tapas** (`esGrillaDeTapas`): si las `<img>` no arman un capítulo y casi todas (nueve de cada diez, y tres o más) son tapas (llevan a otras páginas del sitio, casi todas distintas), son la portada de un sitio o las tapas alrededor de un lector: se muestran destildadas y el diálogo dice "Lo que hay son tapas que llevan a otras páginas del sitio". Es lo que se ve en Issuu si se abre el diálogo antes de que cargue el lector. Con menos (la página de un lector de a una y tres "relacionados") se ofrecen todas, como siempre.
- **Marcos, burbuja y lotes:**
  - `countCandidates` (lo que cuenta cada marco para el service worker) y `looksLikeChapter` (la burbuja) usan una lectura rápida (`fondosDe(…, rapido)`: el estilo calculado del elemento, los atributos de carga diferida y los `<image>`). La burbuja la recuerda 2 s (`fondosRecientes`); el conteo para el service worker lee cada vez, porque el lote espera a que el número deje de cambiar.
  - Un marco con `<img>` que cuentan cuenta esas; si no, su lector de fondo. En la página de arriba, menos de 3 páginas de fondo no compiten con un iframe grande (puede ser un lector en `<img>` de otro sitio, que cuenta lo suyo). Si la página tiene menos de 3 `<img>` grandes en total y un iframe del mismo sitio de 400 × 400 o más con un lector de fondo (`lectorDeFondoEnMarcos`: dos o más de una serie, o una con número si el iframe es una página del sitio y no un `about:blank`, que es como se ponen muchos avisos), cuenta 0 para que gane el iframe.
  - La burbuja necesita tres o más de una serie, y mira los fondos solo si no hay `<img>` que el diálogo ofrecería (todas menos una grilla de tapas): deciden igual.
  - **En un lote** (`autoSave`), si el capítulo sale de fondos deducidos (sin adaptador), se esperan hasta 8 s a que aparezcan `<img>` que cuenten (`countCandidates(true)`): un sitio que arma la página con JavaScript puede tener banners de fondo numerados antes que las páginas. Si aparecen, mandan ellas.
- **Adaptador con "Las páginas están dibujadas de fondo"** (`fondos: true` en el adaptador; `fondosDelAdaptador`): no se filtra nada. Entran las imágenes de fondo de todos los bloques de `contenedor` (o de la página), en su orden y una por página, salvo lo que diga `ignorar`, y si dice `imagenes`, solo las de esos elementos. "Probar en esta página" usa lo mismo.
- **Páginas SVG** (`esSvg`, `desdeSvg` en `offscreen.js`): un SVG no entra en un PDF ni en un CBZ. Si trae una sola imagen y nada más dibujado, se usa esa sin recodificar: embebida como `data:` (también con el base64 cortado con entidades `&#10;`) o bajándola si viene por dirección. Si tiene algo más (texto, trazos, un recorte; un rectángulo transparente no cuenta) o varias imágenes, se dibuja entero en un canvas como JPG. Un SVG con varias imágenes de afuera no se puede dibujar (saldría en blanco): la página cuenta como que no se pudo leer.
- **El programa de escritorio** saca estas funciones sueltas (`generar.js`): su explorador las usa igual, y `pareceListado` no toma por listado una página con un lector de fondo de tres o más páginas.
- **Lo que no reconoce:** un lector cuyas páginas llevan cada una a otra página (`…/pagina/2`, `?p=2`) tiene la forma de un listado y se toma por tapas; un lector de una página por vez en la página de arriba (no en un iframe); páginas con códigos cortos en el nombre (`p-a8f3e9c1.jpg`: cada una queda en su serie); y diapositivas numeradas sin link (`slide1.jpg`…) juntas en un bloque se pueden tomar por un lector. Para todo eso está el adaptador.

### 4.19 El freno: cuánto no pedirle nada a un sitio que pidió esperar

**Esta es la única regla, y vale igual para la extensión (los lotes) y para el programa de escritorio (su cola).** Está escrita una sola vez en el código: `esperaDelSitio(retryAfter, ritmo)` de `ajustes.js`, que se arma sobre `esperaPedida(retryAfter)`. El programa la usa sin copiarla (`frenoDe`, en `programa/src/freno.js`, con el `ajustes.js` que `generar.js` copia de la extensión).

Cuando un sitio contesta **429 o 503**, en la página de un capítulo o en sus imágenes:

| Lo que dice `Retry-After` | Cuánto no se le pide nada a ese sitio |
|---|---|
| Segundos o una fecha | Eso, con tope de **un minuto** |
| Nada (no vino la cabecera) | **Un minuto** |
| Algo que no se entiende, o una fecha ya vencida | **Un minuto** |
| `0` | No frena |

- Mientras dura, no sale nada para ese sitio: ni el reintento de ese capítulo (aunque se toque **Reintentar** enseguida, o el botón del aviso), ni el capítulo que sigue. La pantalla muestra la cuenta regresiva: "el sitio pidió esperar: sigo en N s".
- La pausa de siempre entre capítulos (1,5 s) corre aparte, haya freno o no.
- `esperaPedida` sola (lo pedido con tope de un minuto, o `null` si no vino, no se entiende o es una fecha vencida) es también la que usa el armador para la espera de una imagen suelta antes de reintentarla (`esperaReintento`: lo pedido, o 2, 4 y 8 s).
- Hasta la 2.11.1 la extensión frenaba siempre un minuto; hasta la 0.10.2 el programa, sin cabecera, seguía con la pausa de siempre (1,5 s). Desde la 2.11.2 y la 0.10.3 es esta tabla en los dos.

---

## 5. Arquitectura

### 5.1 Archivos

| Archivo | Rol | Dónde corre |
|---|---|---|
| `manifest.json` | Declaración de la extensión, permisos, atajo, scripts | — |
| `agrupar.js` | Criterio para agrupar capítulos por tomo (`SECCION_RE`, `tomosDe`). Lo comparte el programa de escritorio | En cada pestaña |
| `plantilla.js` | Plantilla de nombres: reemplazo de marcadores y limpieza de la ruta (`aplicarPlantilla`) | En cada pestaña y en la página de opciones |
| `sagas.js` | Tabla de sagas incluida | En cada pestaña y en la página de opciones |
| `estilos.js` | La hoja de estilos de los diálogos y la burbuja, como texto (`MR_CSS`): `content.js` la adopta adentro del shadow root. Desde la 2.11 reemplaza a `styles.css`, que se inyectaba en la página | En cada pestaña |
| `ajustes.js` | Las reglas de los ajustes (`MR_AJUSTES`): ritmo y esperas, adaptadores, carpeta base, estimación de tamaño y versión nueva. Sin interfaz ni `chrome.*`. Desde la 2.11 | En cada pestaña, en opciones, en el popup, en el documento offscreen y en el service worker (`importScripts`) |
| `content.js` | Detección de páginas, filtro, adaptadores, nombre, diálogos, burbuja, guardado automático de un capítulo del lote. Corre en la página y en cada uno de sus iframes | En cada pestaña (content script, `all_frames`) |
| `background.js` | Menú contextual, atajo, inyección del script, a qué marco se le habla, descargas, la cola del lote, la insignia y la notificación; desde la 2.11.2, el `Retry-After` de la página de un capítulo y hasta cuándo no pedirle a cada sitio (`esperaSitio`) | Service worker |
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
| `{action:'build', urls, formats, path, title, meta, soloEntero}` | content → background | Bajar y guardar; responde `{ok, pages, failed:[n…], files:[{kind, sizeKB, savedAs} \| {kind, error}], imgs, imgsFailed, imgError, esperar}`. `esperar` es el código (429 o 503) si alguna página faltó porque el sitio pidió esperar; `soloEntero` lo manda el lote para que en ese caso no se guarde nada a medias (2.11.1) |
| `{target:'offscreen', action:'build', …, jobId, soloEntero}` | background → offscreen | Bajar las páginas y armar los archivos; responde `{ok, pages, failed, files:[{kind, url, sizeKB, name?}], esperar:{status, retryAfter} \| null}` |
| `{target:'background', action:'progress', jobId, done, total}` | offscreen → background | Progreso de la bajada de páginas |
| `{action:'progress', done, total}` | background → content | Progreso reenviado a la pestaña que pidió el guardado |
| `{target:'offscreen', action:'revoke', urls}` | background → offscreen | Liberar las `blob:` URL cuando terminó cada descarga |
| `{action:'batchChapter', url, formats, serie, numero, strict, fixed, visible, volumen, titulo, pause}` | content (lote) → background | Abrir y guardar un capítulo; responde `{ok, name, pages, complete, lines}` |
| `{action:'autoSave', formats, serie, numero, strict, fixed, volumen, titulo}` | background → content (capítulo) | Guardarse solo. `volumen` y `titulo` son el tomo y el nombre del capítulo en la lista del lote: solo los usa la plantilla de nombres |
| `{action:'batchNote', text}` | content (capítulo) → background → content (lote) | Texto de avance ("bajando páginas 9/15") |
| `{action:'batchCancel'}` | content (lote) → background | Cerrar la pestaña del capítulo en curso |
| `{action:'candidato'}` | content (un marco) → background | "Parezco un capítulo: ¿la burbuja va acá?". Responde `{gana}`; a los demás marcos les manda `{action:'ceder'}` (2.11) |
| `{action:'contexto'}` | content (iframe) → background → content (página) | El nombre, el capítulo, la dirección y el sitio de la página de arriba: `{contexto:{nombre, capitulo, clave, sitio, titulo}}` (2.11) |
| `{action:'colaNueva', items, serie, formatos, visible, sitio, origen, plantilla}` | content (lote) → background | Guardar la cola del lote; responde `{id}` (2.11) |
| `{action:'colaMarca', id, numero, estado, error}` | content (lote) → background | Anotar cómo le fue a un capítulo (`pendiente`, `listo`, `fallo`) |
| `{action:'colaFin', id, motivo}` | content (lote) → background | Terminó el lote: borra la cola si salió todo, pinta la insignia y avisa (salvo `motivo:'cancelado'`) |
| `{action:'colaReintentar', id}` / `{action:'colaDescartar'}` | content (lote) → background | Pasar los `fallo` a `pendiente` (responde `{cola}`) / borrar la cola |
| `{action:'insigniaLimpiar'}` | content → background | Se cerró el diálogo de varios capítulos: se limpia la insignia |
| `{action:'batch', reintentar:true}` | background → content | Desde el botón de la notificación: abrir el diálogo y retomar lo que falló |
| `{action:'probarAdaptador', host, adaptador}` | opciones → background → content | Qué encuentra un adaptador en la pestaña abierta de ese sitio: `{n, urls, error, pagina}` (2.11) |

Desde la 2.11 el service worker le habla a un marco en particular (`chrome.tabs.sendMessage(tabId, msg, { frameId })`): `save` y `autoSave` van al que tiene más candidatas; `batch`, a la página; el progreso y las notas del lote vuelven al marco que los pidió. `count` ya no es un mensaje: `contarMarcos` les pregunta a todos los marcos de una vez con `chrome.scripting.executeScript({ allFrames: true })`. La 2.11.0 conservaba en `content.js` el manejador de ese mensaje, que ya nadie mandaba; en la 2.11.1 se sacó.

El campo `target` evita que el documento offscreen procese mensajes de las pestañas y que el service worker procese los del offscreen.

### 5.5 Aislamiento del content script

- `content.js` está envuelto en una función y **hay una sola copia viva por pestaña**: al arrancar pregunta `window.__mangaReaderAlive()`. Si hay una copia que sigue conectada a la extensión, no hace nada. Si la que hay quedó de antes de actualizar la extensión (ya sin conexión), la limpia con `window.__mangaReaderCleanup()` (saca sus listeners y lo que insertó) y ocupa su lugar. Por eso alcanza con inyectarlo de nuevo y no hace falta F5.
- `agrupar.js` y `plantilla.js` también van envueltos en una función y dejan lo suyo en `globalThis`: un `const` suelto daría error al cargarlos por segunda vez en la misma pestaña. Cuando el service worker inyecta el script en una pestaña que no lo tiene, inyecta **los mismos archivos y en el mismo orden** que declara `content_scripts` en el manifest (`CONTENT_FILES` en `background.js`); `tests/test_descargas.js` comprueba que las dos listas coincidan.
- Todo lo que inserta en la página va adentro de **un solo elemento, `#mr-host`, con shadow root abierto** (2.11). Adentro están `#mr-save`, `#mr-chapter` y `#mr-fab`, con su hoja de estilos adoptada ahí mismo (`estilos.js`): el CSS del sitio no los alcanza y el de ellos no toca al sitio. El host lleva su estilo en línea con `!important`, porque él sí está en la página. Para entrar desde afuera: `document.querySelector('#mr-host').shadowRoot`.
- Si el sitio saca el host de `<body>` (hay páginas que barren lo que no pusieron), un `MutationObserver` lo repone con lo que tenía adentro. Con tope: más de `HOST_VUELTAS` veces en 2 segundos es una pelea, y se reintenta recién al rato.
- `OURS` sigue nombrando los tres IDs además del host: sirve para limpiar lo que dejó una versión anterior a la 2.11.
- El script corre en la página y en cada iframe (`all_frames`). `enMarco` dice si está en uno; ahí el nombre, la dirección y el sitio del capítulo se piden a la página de arriba (`pedirArriba`), y la burbuja se muestra solo si el service worker dice que ese marco es el que tiene más páginas.
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

Todo se guarda en `chrome.storage.local`, solo en tu navegador. No se envía nada a ningún servidor. Lo único que la extensión pide afuera por su cuenta, desde la 2.11 y una vez por día, es el `README.md` y el `manifest.json` del repositorio en GitHub, para saber si hay una versión nueva: en ese pedido no viaja ningún dato tuyo.

| Clave | Contenido | Ejemplo |
|---|---|---|
| `savePdf` | ¿PDF tildado? (por defecto sí) | `true` |
| `saveCbz` | ¿CBZ tildado? (por defecto no) | `false` |
| `saveImgs` | ¿Imágenes tildado? (por defecto no) | `false` |
| `saveFolders` | Última carpeta usada por sitio | `{"one-piece-fans2.com": "One Piece/11 Saga Final"}` |
| `savedChapters` | Registro de guardados. Con una plantilla de nombres propia, cada capítulo lleva además `serie` y `numero`. Desde la 2.11, también `kb`: lo que pesó (para estimar los lotes) | `{"One Piece/11 Saga Final/One Piece 1134": {ts, pages: 15, url, kb: 8400}}` |
| `fabEnabled` | ¿Mostrar la burbuja? (por defecto sí) | `true` |
| `fabBlockedHosts` | Sitios donde la burbuja no aparece | `["ejemplo.com"]` |
| `fabPos` | Posición de la burbuja (px desde la derecha y desde abajo) | `{"r": 24, "b": 24}` |
| `autoScan` | ¿Recorrer la página sola al abrir el diálogo? (por defecto sí) | `true` |
| `sagas` | Sagas cargadas por vos, ya interpretadas | `{"naruto": [[1, 244, "Parte 1"], [245, 700, "Shippuden"]]}` |
| `sagasText` | El texto de sagas tal como lo escribiste | `"Naruto\n1-244 Parte 1\n…"` |
| `batchPad` | Dígitos mínimos del número de capítulo en la dirección, por sitio | `{"one-piece-fans2.com": 2}` |
| `batchVisible` | ¿"Abrir cada capítulo a la vista" tildado? | `false` |
| `esquemaNombres` | Plantilla de nombres propia (2.10). No existe mientras se usa la predeterminada | `"{serie}/{volumen}/{serie} {numero}"` |
| `cola` | La cola del último lote (2.11): qué se pidió y cómo le fue a cada capítulo. Se borra sola cuando sale todo | `{id, fecha, serie, formatos, visible, sitio, origen, plantilla, items: [{url, numero, titulo, volumen, estado: "fallo", error: "HTTP 404"}]}` |
| `ritmo` | Ritmo de las descargas (2.11). No existe mientras se usa el de siempre | `{"pausa": 1.5, "descansoCada": 0, "descansoSeg": 30, "concurrencia": 6, "espera429": 60}` |
| `adaptadores` | Adaptadores por sitio (2.11), por host. `fondos: true` (2.11.3, solo si está tildado) pide las páginas dibujadas de fondo | `{"sitio.com": {"contenedor": "#visor", "imagenes": "", "ignorar": [".aviso"], "patron": "https://sitio.com/leer/{n}"}}` |
| `carpetaBase` | Carpeta de Descargas donde va todo (2.11). No existe mientras es `MangaReader` | `"Manga/{sitio}"` |
| `ultimaDescarga` | El id de la última descarga que salió bien: lo usa "Mostrar la carpeta" de la notificación (2.11) | `77` |
| `esperaSitio` | Hasta cuándo no pedirle nada a un sitio que pidió esperar, por nombre del sitio (2.11.2). Lo escribe el service worker; las que ya vencieron se borran en la escritura siguiente | `{"one-piece-fans2.com": 1795000060000}` |
| `versionVista` | Cuándo se miró por última vez qué versión hay en el repositorio, y cuál era (2.11) | `{"ts": 1795000000000, "version": "2.11.0"}` |
| `misSitios` | Tus sitios de manga y cómics (`descargable` desde la 2.8.3) | `[{"nombre": "Mi sitio", "url": "https://…", "tipo": "manga", "idiomas": ["es"], "descripcion": "…", "descargable": true}]` |
| `sitiosFiltro` | Último filtro de la lista de sitios y secciones plegadas | `{"tipo": "manga", "idioma": "es", "plegadas": ["leer"]}` (en la 2.8: `{"tipo", "soloEs", "soloGuardar"}`) |

Además, "Guardar y siguiente" deja por un instante la clave `mrAutoOpen` en el `sessionStorage` del sitio, que se borra al leerla.

Al desinstalar la extensión (o quitar su tarjeta para cargar otra versión), estos datos se borran. **Exportar copia** los baja a un archivo.

---

## 9. Permisos y por qué se necesitan

| Permiso | Para qué |
|---|---|
| `<all_urls>` (host) | Inyectar los diálogos en cualquier sitio de manga y bajar las imágenes de otros dominios o CDNs sin bloqueos de CORS |
| `downloads` | Guardar los archivos en `Descargas/MangaReader` (o en la carpeta base elegida) con carpetas, y abrir la carpeta de la última descarga desde la notificación |
| `notifications` | Avisar cuando termina un lote, con los botones para reintentar lo que falló y para abrir la carpeta (2.11) |
| `offscreen` | Crear el documento invisible que arma PDF y CBZ |
| `storage` | Recordar preferencias, carpetas, guardados, sagas y la burbuja |
| `contextMenus` | Las opciones del clic derecho |
| `scripting` | Inyectar el script en las pestañas abiertas antes de instalar o actualizar (para no pedir F5) y, desde la 2.11, preguntarle a cada marco de la pestaña cuántas páginas tiene |
| `activeTab` | Comunicarse con la pestaña actual desde el popup |
| `webRequest` | Leer la cabecera `Retry-After` de la página de un capítulo de un lote cuando el sitio responde 429 o 503 (2.11.2). Solo se escucha mientras un lote tiene un capítulo abierto, y solo las respuestas de documentos (`main_frame`). No cambia nada al instalar: Chromium muestra las mismas tres advertencias que sin él ("Leer y cambiar todos tus datos en todos los sitios web", "Mostrar notificaciones", "Administrar tus descargas"), porque el acceso a todos los sitios ya estaba; `chrome://extensions` no muestra advertencias ni errores (comprobado en `tests/e2e_211.js`, área `espera`) |

---

## 10. Valores fijos (constantes)

| Valor | Dónde | Significado |
|---|---|---|
| 250 px | `MIN_SIDE` (content) | Tamaño mínimo de ancho y alto para considerar una imagen como página |
| 8 s | `probeSize` | Espera máxima para medir una imagen sin cargar |
| 6 | `PROBE_CONCURRENCY` (content) | Imágenes sin cargar que se miden a la vez. Desde la 2.11 es el valor por defecto: el que vale sale de las opciones (`ritmo.concurrencia`, de 2 a 8) |
| 3 | `flagNonPages` | Últimas páginas que se revisan por formato distinto |
| 0,4 · 2/3 | `flagNonPages` | Mediana de ancho/alto mínima y proporción de páginas parecidas para aplicar esa regla |
| 300 px | `atBottom` | Margen para considerar que llegaste al final |
| 800 ms | `onImageLoad` | Espera antes de recalcular cuando cargan imágenes nuevas |
| 90 % / 300 ms / 6 s | `scrollThrough` | Paso y pausa al recorrer la página, y espera final a las imágenes que quedaron cargando |
| 4 | `FETCH_CONCURRENCY` (offscreen) | Descargas de páginas en paralelo |
| 30 s | `fetchBytes` | Tiempo máximo por página al bajarla |
| 2 · 700 ms | `FETCH_RETRIES`, `fetchRetry` | Reintentos por página y espera entre uno y otro (700 ms, después 1400 ms) |
| 3 · 2, 4 y 8 s · 60 s | `WAIT_RETRIES` (offscreen), `esperaReintento` (ajustes) | Veces que se espera y reintenta una página que respondió 429 o 503; cuánto se espera si el sitio no lo dice en `Retry-After`; y el tope de lo que se le hace caso (2.11) |
| 14 400 pt | `PDF_MAX_SIDE` | Lado máximo de una página del PDF |
| 0,92 | `pdfImage` | Calidad JPG al convertir WebP/GIF/AVIF para el PDF |
| 60 s + 20 s/página | `saveCore` | Tiempo máximo para bajar y armar un capítulo |
| 20 s | `waitDownload` (background) | Espera del resultado real de cada descarga; si sigue en curso, se da por buena |
| 3 imágenes ≥ 250×600 | `looksLikeChapter` | Condición para mostrar la burbuja. Con un adaptador del sitio no vale: alcanza con una imagen cargada donde él dice (2.11.1) |
| 1,5 s · 5 s · 700 ms | `checkFab` | Revisiones de la burbuja al cargar y agrupación de las revisiones por scroll o carga de imágenes |
| 40 | `FAB_MAX_TRIES` (content) | Revisiones de la burbuja antes de dejar de mirar la página |
| 5 px | burbuja | Movimiento mínimo para que cuente como arrastre |
| 60 s | "Guardar y siguiente" | Cuánto vale la marca para abrir el diálogo en el capítulo siguiente |
| 1,5 s | `BATCH_PAUSE` (content) | Respiro entre capítulos de un lote. Desde la 2.11 es el valor por defecto: el que vale sale de las opciones (`ritmo.pausa`, de 0 a 10 s) |
| 0 · 30 s | `RITMO_DEFECTO` (ajustes) | Descanso cada tantos capítulos (0 = apagado) y cuánto dura (2.11) |
| 60 s | `RITMO_DEFECTO.espera429` (ajustes) | El freno sin `Retry-After` (o con algo que no se entiende, o una fecha vencida), y el tope de lo que se respeta. Lo usan la extensión y el programa: la regla está en la sección 4.19 |
| 2 s | `fondosRecientes` (content) | Lo que la burbuja recuerda la lectura rápida de los fondos de una página (el conteo para el service worker lee cada vez) (2.11.3) |
| 8 s | `autoSave` (content) | Lo que un lote espera a que aparezcan `<img>` antes de dar por páginas unos fondos deducidos (2.11.3) |
| 80 % | `contenedorDeFondos` (content) | Qué parte de una serie de fondos tiene que tener adentro el bloque que la junta (el más de adentro que la tenga) (2.11.3) |
| 2 · 3 | `fondosDelContenedor`, `looksLikeChapter` (content) | Imágenes de fondo de una misma serie para que sean un lector, y para que aparezca la burbuja (2.11.3). Una sola vale solo en un iframe |
| 20 000 letras | `sinRellenos` (content) | Largo mínimo de una imagen de fondo `data:` para que sea un escaneo y no un ícono incrustado (2.11.3) |
| 12 letras | `serieDeFondo` (content) | Largo a partir del cual un código con números en una dirección cuenta como `#` (2.11.3) |
| 3 · 90 % · 80 % | `esGrillaDeTapas`, `fondosDelContenedor` (content) | Tapas (imágenes que llevan a otras páginas del sitio) para que sean una grilla, qué parte de las imágenes sueltas tienen que ser tapas (con `<img>`) y qué parte tienen que llevar a páginas distintas (2.11.3) |
| 4 niveles | `linkDeTarjeta` (content) | Hasta dónde se busca el link de la tarjeta de una imagen de fondo (2.11.3) |
| 400 × 400 px | `lectorDeFondoEnMarcos`, `marcoGrande` (content) | Tamaño mínimo de un iframe para que cuente su lector de fondo: mirado desde la página (el iframe) y desde adentro (la ventana del marco). Los avisos son más chicos (2.11.3) |
| 20 en 2 s | `HOST_VUELTAS` (content) | Veces que se repone `#mr-host` si la página lo saca; pasado eso se reintenta cada 2 s (2.11) |
| 200 MB | `AVISO_TAMANO_KB` (ajustes) | Tamaño estimado de un lote a partir del cual se avisa antes de empezar (2.11) |
| 24 h | `UN_DIA` (popup) | Cada cuánto se mira si hay una versión nueva en el repositorio (2.11) |
| `MangaReader` | `CARPETA_DEFECTO` (ajustes) | Carpeta de Descargas donde va todo si no se eligió otra (2.11) |
| 5 columnas | `flechasMiniaturas` (content) | Lo que salta la flecha arriba o abajo entre las miniaturas (2.11) |
| 3 | `BATCH_MAX_EMPTY` (content) | Capítulos seguidos "sin páginas" después de los cuales el lote para |
| 2 | `collectPages` | Imágenes `blob:` de 250×250 o más (o cargando) a partir de las cuales lo que queda a la vista viene destildado (las páginas del capítulo no tienen dirección para bajar) |
| 1900–2099 · 1–12 · 1–31 | `isDateArchive` (content) | Año, mes y día con los que una dirección `…/AAAA/MM/` o `…/AAAA/MM/DD/` se toma como archivo por fecha y no como capítulo |
| `.html` `.htm` `.xhtml` `.shtml` `.php` `.asp` `.aspx` `.jsp` `.cgi` | `collectChapters` | Terminaciones de archivo con las que no se supone "esta dirección + /número" |
| 6 cifras | `collectChapters` | Largo a partir del cual un número en el último tramo de la dirección se toma como código del sitio y no como capítulo |
| 700 ms × 3 | `driveChapter` (background) | Consultas seguidas con la misma cantidad de imágenes para dar un capítulo por armado |
| ~10 s | `driveChapter` | Espera a que aparezca algo que parezca un capítulo |
| 4 min | `batchChapter` | Tiempo máximo por capítulo de un lote |
| 3 páginas | `autoSave` | Mínimo para que un capítulo de un lote se guarde |
| 3000 | `markRange`, `useLinks` | Tamaño máximo de un rango, y de una lista de links pegados |
| 80 caracteres | `capturarSeccion` (agrupar) | Largo máximo de un título de la página para tomarlo como encabezado de los links que siguen |
| 2 tomos · 2 capítulos | `tomosDe` (agrupar) | Tomos distintos que tiene que haber en la lista para agrupar, y capítulos mínimos de un tomo (si no, van a "Sin volumen") |
| `{serie}/{saga}/{serie} {numero}` | `PLANTILLA_DEFECTO` (plantilla) | Plantilla de nombres predeterminada: da el mismo nombre que `nameFor` |
| 100 caracteres | `sanitizarPlantilla` (plantilla) | Largo máximo de cada carpeta y del nombre que arma una plantilla |

---

## 11. Cómo se probó

### Pruebas automáticas en Node (`bash tests/correr.sh`)

Corren sobre el código real de la versión, sin dependencias. Sin argumento usan la versión más nueva según el `version` de cada `manifest.json`.

| Archivo | Qué prueba | Casos |
|---|---|---|
| `test_nombres.js` | Serie, saga y número a partir del título y la dirección (también `[#104] Serie`, códigos largos en la dirección y títulos que terminan en otro número); `pageKey` | 51 |
| `test_capitulos.js` | Partir direcciones en molde + número, ceros adelante, lista de capítulos (links, desplegable, portada sin número, dirección con un código del sitio, título que no coincide con la dirección, listado con código y links, archivo por mes o por día de un blog en links y desplegables, dirección terminada en un archivo), capítulo siguiente, y capítulos a partir de links pegados (número adelante, en el link o por orden; repetidos; texto alrededor), y esos links sin los que ya están guardados (`quitarGuardados`, 2.11), o con todos si "Saltear los que ya guardé" está destildado (2.11.1) | 101 |
| `test_filtro.js` | Filtro de publicidad, con webtoon y lector con links al CDN | 9 |
| `test_descargas.js` | Service worker con `chrome.*` simulado: guardado, descargas cortadas, nombres con acentos, liberación de memoria, inyección del script (los mismos archivos que carga el manifest), un capítulo de un lote (con su tomo y su nombre) y su cancelación. Desde la 2.11, además: a qué marco va cada pedido (el lector en un iframe, `Alt+S`, la burbuja en un solo marco), la carpeta base, la cola en `chrome.storage` (encolar, cada cambio, dos a la vez, reintentar, descartar) y la insignia y la notificación (la secuencia `0/4 … 4/4`, los colores, el texto, los botones y lo que hace cada uno). Desde la 2.11.1: que `soloEntero` le llegue al armador, que `esperar` vuelva a quien guarda y que un capítulo cortado por el armador no descargue nada. Desde la 2.11.2 (con `webRequest` simulado): cuánto queda frenado el sitio cuando la página del capítulo responde 503 o 429 con `Retry-After` (4 s, 12 s), con 300 (un minuto), sin cabecera, con basura o con una fecha vencida (un minuto), y con la parada de las opciones; que una página que responde bien no frene nada; que las imágenes de un capítulo de un lote también frenen y las de un guardado suelto no; y que el oyente de `webRequest` esté solo mientras el capítulo está abierto | 81 |
| `test_offscreen.js` | Cabeceras JPG, PNG sin recomprimir (los píxeles vuelven idénticos), estructura del PDF y del ZIP, `ComicInfo.xml`. Desde la 2.11.3, las páginas SVG: el tipo real, el escaneo de adentro idéntico (también con el base64 cortado con `&#10;`), y por `loadAll` un SVG con el escaneo adentro y otro con el escaneo por dirección (los dos entran como JPG y al PDF) y uno con dos imágenes de afuera, que queda entre las que faltaron | 49 |
| `test_opciones.js` | Sagas (texto ↔ tabla), capítulos faltantes, agrupado por serie, importar copia (con mis sitios y la plantilla), y lo guardado con una plantilla propia agrupado por su serie; el registro en CSV y el peso de cada capítulo en una copia importada (2.11) | 31 |
| `test_ajustes.js` | `ajustes.js` (2.11): el ritmo y sus límites, la pausa y el descanso entre capítulos, la espera ante un 429 o un 503 (`Retry-After` en segundos o como fecha, 2-4-8 s, tope), los adaptadores (limpieza, sitio escrito de cualquier forma, selectores inválidos), la carpeta base (lo que se acepta y lo que no), la estimación del tamaño de un lote, las versiones y la lectura de la que hay en el repositorio con internet simulada; y la bajada de una página (`fetchRetry` de `offscreen.js`) con el sitio y el reloj simulados. Desde la 2.11.1: que un 503 cuente como "el sitio pidió esperar" igual que un 429 (y un 500 o un 404, no), `esperaPedida`, los 6 pedidos de una página que responde 503 siempre, y el capítulo entero (`loadAll`): qué informa cuando una página queda afuera por un 503, y que con `soloEntero` corte sin pedir las que faltaban (24 pedidos en vez de 60). Desde la 2.11.2: `esperaPedida` con "4", con una fecha vencida, con "300" y vacío, y `esperaDelSitio` (lo que frena un lote): lo pedido, o un minuto sin cabecera, con basura o con una fecha vencida. Desde la 2.11.3, que la opción "fondos" de un adaptador se guarde solo si está tildada | 58 |
| `test_sitios.js` | Que cada sitio incluido esté bien cargado (campos, dirección, tipo, idiomas, descripción, sin repetidos; desde la 2.8.5 no hay ninguno), filtros por tipo, idioma y texto, la división descargables / para leer, sitios del usuario y la lectura de una lista pegada (nombre, dirección, descripción, tipo e idioma detectados; títulos de grupo; repetidos) | 59 |
| `test_tomos.js` | `agrupar.js`: qué títulos nombran un tomo, encabezado vigente, grupos (`tomosDe`: mínimo de tomos y de capítulos, orden, que devuelva los capítulos de la lista y no copias) y el tomo que `collectChapters` le anota a cada capítulo (títulos de la página, capítulo repetido en "Últimos capítulos", grupos de un desplegable) | 35 |
| `test_esquema.js` | `plantilla.js`: marcadores, marcadores sin valor (carpeta, guion, paréntesis), limpieza para Windows, avisos; y en `content.js`, los datos de cada capítulo y que sin plantilla o con la predeterminada el nombre sea el de siempre | 42 |
| `test_fondos.js` | Páginas dibujadas de fondo (2.11.3), sobre una página simulada: las direcciones de un `background-image` (`url()`, `image-set()`, degradés, relativas a la hoja); 8 páginas numeradas entre 18 tapas (de `<img>` y de fondo); `image-set()`, `<image>` de SVG y una regla con `::before`; solo degradés; que las `<img>` sigan mandando (un capítulo con un aviso, un blog con adornos de fondo, con íconos de reacción numerados); Issuu (la página de arriba con las tapas, el lector en un iframe, antes de que carguen las tapas, y un aviso en un `about:blank`); un lector que no se puede leer; la grilla de tapas y lo que no lo es; los adornos que no son un lector (íconos de redes, un carrusel, un logo solo, un catálogo con logo, héroe y pie, miniaturas de un diario y avatares de un foro con el link al lado, tarjetas con el fondo en sí mismas, con foto y avatar, un slider con su botón, recomendados patrocinados, los adornos de un sitio empaquetado con Vite o webpack, íconos incrustados como `data:`); un aviso chico y un reproductor de video en iframes, y dos adornos arriba con un iframe grande; un "cargando" detrás de cada página, la miniatura borrosa debajo (en otro bloque, con la misma dirección y otro `?w=`, o con la entera en el `::after`), reglas pisadas por la cascada y un `@media` que no se cumple; carga diferida por `data-bg`; páginas en tandas; la tapa del capítulo y los créditos sin número; el número en la consulta o en la carpeta; nombres de código; un listado en `/manga` con tarjetas a `/manga/obra-N` y una aplicación con rutas por `#`; una tira de miniaturas con anclas; la burbuja que decide como el diálogo; y el adaptador con "fondos" (todos los bloques, "ignorar", el lector cuyas páginas llevan a la siguiente). Contra la 2.11.2, 22 de las 38 que corren ahí fallan (las otras 16 son lo que no tenía que cambiar) | 50 |

**Total: 566 comprobaciones en Node** (2.11.3), todas en verde.

### Prueba en navegador real (`node tests/e2e.js`)

Carga la extensión en un Chromium sin interfaz (el que instala Playwright) y la usa sobre un sitio de prueba local armado como el sitio real: la página se dibuja con JavaScript, los capítulos no tienen links, los menores a 10 llevan cero adelante y las imágenes dicen `.png` pero son JPG. 166 comprobaciones, todas bien:

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
- **Páginas protegidas y direcciones con código (2.8.1):** un lector armado como MANGA Plus (dirección `/viewer/2010289`, título `[#104] Serie`, páginas como imágenes `blob:` y logo, banner y promoción alrededor). Sin burbuja; el diálogo de guardar avisa con 🔒, nombra el capítulo 104, viene todo destildado y no ofrece "Guardar y siguiente"; el de varios capítulos no supone dirección, explica el código, del 100 al 104 marca solo el abierto y al descargar para enseguida sin guardar nada ni dejar pestañas. Además, un rango de capítulos que no existen (2001 a 2006) para a los 3 seguidos y abre la dirección para revisarla. **Desde la 2.9.1, sin el aviso:** el diálogo dice que no encontró páginas del capítulo, ni el diálogo ni las miniaturas nombran la protección, y el lote lo informa como "Sin páginas (encontré 0)".
- **Sitio con el número dentro del nombre de la página (2.8.4):** un sitio de prueba de una sola serie, con capítulos en `/fan/leer/serie-fan-manga-<n>/` (barra final), título que termina en un año, carga diferida del navegador (`loading="lazy"`), dos `<canvas>` de adorno y un listado con un código largo en su dirección. Desde el listado toma los capítulos de los links y baja los tres con el nombre correcto (el número de la dirección, no el año) y 6 páginas sin el logo; desde un capítulo, los canvas no lo dan por protegido, avisa que ya está guardado, ofrece "Guardar y siguiente" y arma el molde y la lista.
- **Sitio con archivo por mes (2.8.6):** un sitio de prueba armado como un blog, con la tira "enero 2021… junio 2021" en todas las páginas, el mismo archivo en un desplegable y un calendario con links por día; la página de un mes muestra juntos dos capítulos. Desde el inicio la lista trae los 4 capítulos con su nombre y no los meses; "del 1 al 2" baja los capítulos 1 y 2, cada uno con sus 6 páginas, sin abrir ninguna página del archivo; desde un capítulo tampoco aparecen los meses; y desde la página de un mes se ofrecen los capítulos de ese mes.
- **Dirección terminada en un archivo (2.8.7):** en el mismo sitio de prueba, un capítulo en `…/2021/02/serie-blog-manga-3-espanol.html`, con el número en el medio del nombre y sin links a otros capítulos. Guardar el capítulo abierto anda igual (6 páginas, sin "siguiente" inventado); el diálogo de varios capítulos no supone una dirección, explica por qué no encontró los otros, "del 1 al 5" no marca nada y dice qué falta, y no se abre ninguna pestaña ni se pide ninguna dirección inventada. Escribiendo la dirección con `{n}` a mano, el rango vuelve a marcar.
- **Pegar los links de los capítulos (2.9):** desde una página donde la lista no se puede armar, se pega un texto con un título, links con el número adelante y sin él, fuera de orden y uno repetido; los capítulos tienen el número en el medio del nombre de su página y la carpeta del mes cambia. Quedan los 4 en orden y marcados, el mensaje dice qué hizo, y con la serie escrita se bajan los 4 con su nombre y sus 6 páginas, anotados como guardados. Al volver a pegarlos no se bajan de nuevo: hasta la 2.10 entraban a la lista como guardados y el lote los salteaba; desde la 2.11 no entran, el mensaje lo dice y la lista queda como estaba. La comprobación es la misma para todas las versiones y compara contra el texto de la que se corre (2.11.1). Después, tres links de **otro sitio** (el mismo servidor por `localhost`) sin número en ningún lado: "al revés" y en el orden pegado desde el 50, y se bajan como 50, 51 y 52 aunque el título de uno termine en 2026. Sin pestañas colgadas.
- **Tomos y plantilla de nombres (2.10):** la página de una serie con sus capítulos bajo "Tomo 1" y "Tomo 2", un bloque de "Últimos capítulos" que repite uno y un capítulo suelto debajo de otro título. La lista trae los 6 sin repetir y aparecen las pestañas; Tomos muestra los dos tomos con su rango y "Sin volumen"; tildar un tomo marca sus 3 capítulos, destildar uno lo deja a medias y destildar otro tomo no toca los demás. Con la plantilla `{serie}/{volumen}/{serie} {numero} - {titulo}` el diálogo muestra el ejemplo (con `(serie)` mientras la serie es automática, y con la escrita si se escribe), el tomo se baja a su carpeta con el nombre de cada capítulo (serie automática), queda anotado con su serie y su número, y el capítulo suelto se guarda sin carpeta vacía ni guion colgando. Guardando de a uno, la misma plantilla da el nombre sin esos huecos; otra plantilla (por sitio y año) vale en la pestaña abierta sin recargarla. En opciones se ve la plantilla guardada, la vista previa de los dos casos, los guardados agrupados por serie, los avisos de choque y de marcador desconocido, y volver a la predeterminada borra la clave. Por último, en una página sin tomos el diálogo no muestra las pestañas.

Cuando había lista incluida (2.8.2 a 2.8.4), sus 23 direcciones respondieron bien el 21-11-2026. Además se abrieron en un navegador desde Argentina las dudosas: DC Universe Infinite dice que no está disponible en la región (por eso salió), Marvel carga su lector con el catálogo (`marvelcomicsapp.com`; `marvel.webtoon.com` es solo la página del lanzamiento) y MangaToon, Manta y MANGA MILLION muestran su catálogo para leer en la web.

### Lo nuevo de la 2.11 en el navegador (`node tests/e2e_211.js`)

`e2e.js` lo corre al final; solo tarda mucho menos, y con `SOLO=cola,ritmo` corre las áreas que se pidan. Con la carpeta de otra versión como argumento muestra qué fallaba antes. Las páginas de prueba están en `tests/fixtures/` y las sirve el mismo archivo, en dos puertos (el segundo hace de "otro sitio"); además sirve series enteras (`/fx/<serie>/` y `/fx/<serie>/leer/<n>`) a las que la prueba les puede romper un capítulo o una imagen. Cada área va en su bloque: si una se corta, se anota y siguen las demás. Son 106 comprobaciones (81 de la 2.11.0, 15 de la 2.11.1 y 10 de la 2.11.2).

| Área | Qué se prueba | Qué fallaba con la 2.10.0 |
|---|---|---|
| `shadow` | Una página con `button { display: none }`, `div { display: flex }` e `img { max-width: 20px }`: el diálogo se abre, la grilla sigue en grilla, las miniaturas se ven y Guardar se puede tocar. Otra que saca de `<body>` lo ajeno cada 500 ms: a los 3 s el diálogo sigue, con lo escrito | El botón de la burbuja y el de Guardar quedaban ocultos; el diálogo desaparecía con el primer barrido |
| `iframes` | El lector en un iframe del mismo origen y en uno de otro (segundo puerto): una sola burbuja, el diálogo con el nombre del capítulo de la página, 6 páginas guardadas y el registro con la dirección de la página. Las mismas imágenes en la página y en el iframe: 6 páginas, no 12. Un lote de dos capítulos así | No había burbuja, el diálogo se abría en la página con 0 páginas, no se guardaba nada |
| `cola` | 4 capítulos, dos dan 404: la cola queda en storage con el motivo; con el sitio arreglado, Reintentar baja esos dos y la cola se borra. Se cierra la pestaña a mitad de un lote: al volver ofrece Reanudar y termina | No había cola ni nada que ofrecer |
| `ritmo` | Una imagen que responde 429 con `Retry-After` (y que castiga a quien insiste antes de tiempo): el capítulo sale completo. Un capítulo entero con 429: el lote para, lo reintenta una vez y queda con "el sitio pidió esperar". La sección de opciones y sus límites | El capítulo salía con 5 páginas; el otro quedaba como "Sin páginas" sin reintento |
| `insignia` | La insignia `n/3` mientras corre, roja al fallar uno, la notificación creada y la limpieza al cerrar el diálogo | No había insignia ni permiso de notificaciones |
| `orden` | Tres páginas de tamaños distintos: Invertir da 3, 2, 1 en el PDF y en el CBZ; Ordenar por número, ▲▼; arrastrar la primera al final da 2, 3, 1 en el PDF | No existían los controles |
| `adaptadores` | 6 páginas en un bloque propio y 20 señuelos: sin adaptador, 3 páginas y los 20 señuelos; con adaptador (por contenedor, o por imágenes e ignorar), exactamente las 6. La dirección de los capítulos ya puesta. Un selector inválido no rompe. La sección de opciones, con "Probar en esta página" | Guardaba 23 imágenes aunque el adaptador estuviera cargado |
| `carpeta` | `Manga/{sitio}/{serie}` desde opciones: el archivo queda ahí y el diálogo lo muestra. `../x`: opciones avisa y no la guarda; forzada en storage, se guarda igual en `MangaReader` | No existía la opción |
| `pegar` | 5 links desordenados con 2 ya guardados: quedan 3, ordenados, y dice que descartó 2. Invertir, Ordenar, y el lote baja en el orden de la lista | Quedaban los 5 y no había cómo invertir |
| `teclado` | Con teclas de verdad (mandadas por el protocolo de depuración): `role="dialog"`, nombres en los controles, el foco no sale con 30 Tab, flechas entre miniaturas, espacio, Esc y el foco de vuelta en la página. Lo mismo en el diálogo de varios capítulos | Sin `role`, el foco se escapaba, las flechas no movían nada y al cerrar el foco quedaba en `body` |
| `menores` | El peso anotado al guardar, la estimación de un lote y el aviso de 200 MB, "Exportar CSV" y el punto de versión nueva en el popup | No anotaba el peso ni existía lo demás |

**Lo que sumó la 2.11.1** (15 comprobaciones, en las mismas áreas). Corridas contra la 2.11.0 el 23-11-2026, fallan 8; las otras 7 cubren ramas que ya andaban y no tenían prueba.

| Área | Qué se prueba | Qué pasaba con la 2.11.0 |
|---|---|---|
| `cola` | El estado del diálogo leído en el mismo instante del clic, después de un lote terminado: al arrancar otro lote, al tocar **Reintentar** y al tocar **Reanudar** tiene que decir "Preparando el lote…" | Con Reintentar seguía diciendo "Listo: 2 capítulos guardados · 2 con problemas" y con Reanudar "Cancelado: 1 capítulo guardado" (la cola se lee antes de arrancar). El lote común ya estaba bien y no tenía prueba |
| `cola` | Una cola a la que le falta un capítulo que mientras tanto se guardó de a uno: **Reanudar** dice "Lo que faltaba ya estaba guardado: no queda nada por bajar" y la cola se cierra | Decía "No hay capítulos para bajar" y la cola quedaba ofrecida para siempre: solo se podía descartar |
| `ritmo` | Las 6 imágenes de un capítulo responden 503 (con `Retry-After: 1`) a la extensión: el lote muestra "el sitio pidió esperar, sigo en N s…", la falla dice "el sitio pidió esperar", no queda ningún archivo a medias y el sitio recibe 48 pedidos (4 páginas por intento). Con el sitio arreglado, **Reintentar** lo baja entero, con su nombre y sin copias | El lote no paraba, la falla decía "No se pudo leer ninguna página (HTTP 503)" y el sitio recibía 36 pedidos de una (las 6 páginas) |
| `adaptadores` | Un capítulo en tiras de 420×200, cada una en su carpeta, y otro de solo 2 tiras: sin adaptador no hay páginas; con adaptador entran las 5, y un lote guarda los dos capítulos. Con un selector inválido, el diálogo lo avisa | Con el adaptador cargado seguía sin encontrar páginas ("0 de 0"), el lote daba "Sin páginas (encontré 0)" y el selector inválido no se avisaba |
| `pegar` | Con "Saltear los que ya guardé" destildado, los 5 links entran (también los 2 ya guardados), el botón dice "Descargar 5 capítulos" y no aparece el aviso de descartados; al tildarla de nuevo vuelven a quedar afuera | Ya andaba así: la rama no tenía prueba |

**Lo que sumó la 2.11.2** (10 comprobaciones, en un área nueva, `espera`). Corridas contra la 2.11.1 el 23-11-2026 a la noche, fallan 4; las otras 6 cubren lo que no tenía que cambiar.

| Área | Qué se prueba | Qué pasaba con la 2.11.1 |
|---|---|---|
| `espera` | **El permiso:** el manifest pide `webRequest`; `chrome://extensions` no muestra advertencias de instalación ni errores del manifest; las advertencias de permisos son las mismas que sin `webRequest` (`chrome.management.getPermissionWarningsByManifest`, las tres de siempre); y al final del área, ningún error de la extensión mientras corrieron sus lotes. **503 con `Retry-After: 4`** en la página del capítulo 2, todas las veces: la cuenta regresiva dice "sigo en 4 s" y baja a 1, antes del reintento y antes del capítulo siguiente; el reintento llega a los 4,7 s y el capítulo siguiente a los 4,5 s del segundo 503 (entre 4 y 15 s); el capítulo 2 queda con "el sitio pidió esperar" y los otros se guardan. **503 sin cabecera** (en el segundo sitio de prueba, para no frenar a las áreas que siguen): la cuenta arranca en 60; en ese mismo instante el botón dice Cancelar y el capítulo se pidió una sola vez; al cancelar no sale el reintento. **`Retry-After: pronto`**: también un minuto | Sin `webRequest`; con `Retry-After: 4` la cuenta iba de 60 a 1, el reintento llegaba a los 60,9 s y el capítulo siguiente no esperaba (0,3 s). Sin cabecera y con basura ya era un minuto |
| `ritmo` | Los pedidos que recibe el sitio cuando las imágenes de un capítulo responden 503 ya no están escritos a mano (48): salen de las constantes del armador cargado, leídas de su `offscreen.js`. Por cada intento arrancan a la vez `min(FETCH_CONCURRENCY, 6)` páginas, cada una se pide `1 + FETCH_RETRIES + WAIT_RETRIES` veces, y el capítulo se intenta dos veces | Igual (con las constantes de la 2.11.1 también da 48) |

**Lo que sumó la 2.11.3** (14 comprobaciones, en un área nueva, `fondos`, que tarda unos 4 minutos y va en una tanda aparte). Corridas contra la 2.11.2 el 24-11-2026: fallan 11; las otras 3 son lo que no tenía que cambiar (solo degradés, una portada de tarjetas de fondo y un lote con `<img>` tardías).

| Área | Qué se prueba | Qué pasaba con la 2.11.2 |
|---|---|---|
| `fondos` | `fondo.html`: 8 páginas numeradas de fondo (cada una de un ancho distinto, para leer el orden en el PDF) y 18 tapas de otras obras alrededor: la burbuja aparece, el diálogo muestra las 8 en orden con "páginas dibujadas de fondo" y la salida al adaptador, y el PDF tiene las 8 en ese orden; lo mismo con las tapas también de fondo (`?tapasDeFondo=1`). `fondo-set.html`: `image-set()` (la de 2x), un SVG con dos `<image>` y una regla con `::before`, sin el relleno `data:` de un píxel: las 5 y se guardan. `fondo-degrade.html`: solo degradés, ni burbuja ni páginas. `fondo-catalogo.html`: una portada con 12 tapas de fondo, un logo y un héroe: ni burbuja ni páginas. `fondo-marco.html` (como Issuu): el lector en un iframe del mismo sitio, con sus 2 páginas, y el diálogo se abre ahí; con páginas `blob:`, "El lector las dibuja de fondo y no se pudieron leer"; antes de que cargue el lector, "Lo que hay son tapas…", con las 18 destildadas. `fondo-adaptador.html`: 6 `<img>` en una carpeta mandan, y un adaptador con "fondos" toma las 4 de fondo. Un lote de la serie `tarde` (tres banners de fondo numerados desde el principio y las 6 páginas `<img>` recién a los 3 s): guarda las páginas, no los banners. La casilla de opciones | Guardaba las 18 tapas (el PDF de `fondo.html` salió con 18 páginas que eran tapas), no había burbuja, y en el lector del iframe no encontraba nada |

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

El 23-11-2026, con la **2.11.1**, contra one-piece-fans2.com (un sitio con lector: la página se dibuja con JavaScript y los capítulos se eligen con un desplegable), en un Chromium sin interfaz y bajando a una carpeta temporal que se borra al terminar:

- **Un capítulo, con lote** (`node tests/probar_sitio.js "https://one-piece-fans2.com/manga/es/todos/1134" 1133 1134`):
  - La burbuja aparece. El diálogo de guardar propone `One Piece/11 Saga Final/One Piece 1134`, con 15 de 17 páginas (2 descartadas como publicidad) y "Guardar y siguiente".
  - El de varios capítulos arma la dirección `…/manga/es/todos/{n}` y sugiere del 1134 al 1134.
  - El lote del 1133 al 1134 terminó en "✅ Listo: 2 capítulos guardados", en 9 segundos: dos PDF de 15 páginas, de 12,8 y 17,3 MB, en `MangaReader/One Piece/11 Saga Final/`.
- **La portada** (`…/manga/es/todos`, que muestra el capítulo 01), sin bajar nada: `One Piece/01 East Blue/One Piece 0001`, 56 de 58 páginas, y la dirección `…/todos/{n}` supuesta y a la vista para revisarla.
- **Qué confirma de la 2.11:** en un sitio real la interfaz anda adentro del shadow root, el pedido de guardar llega al marco correcto después de contar las candidatas, y un lote corre de punta a punta con la cola guardada y el armador nuevo (el que corta un capítulo si el sitio pide esperar; acá no lo pidió).
- **Qué no se pudo probar ese día:** un capítulo servido **dentro de un iframe** en un sitio real (los sitios anotados en el proyecto muestran las páginas en la página misma), y un 429 o un 503 de verdad. Las dos cosas se buscaron con la 2.11.2: ver los dos apartados que siguen. El desplegable de capítulos del sitio sigue en "Cargando…" en el navegador de prueba.

**Un capítulo dentro de un iframe, en un sitio real** — 23-11-2026, de 21:48 a 21:57 (hora de Argentina; 24-11-2026 de 00:48 a 00:57 UTC), con la **2.11.2** y `probar_sitio.js`, que desde esta versión dice qué marcos tiene la página, cuántas páginas cuenta la extensión en cada uno y en cuál se abrió el diálogo, y con `guardar` baja el capítulo abierto. Se probaron tres sitios:

1. **Internet Archive** (`archive.org/details/jumbo-comics-08`, una historieta de los años 40): **no tiene iframe**. Su lector (BookReader) está en la página misma; el único iframe es un `about:blank` vacío. La extensión encuentra solo las 3 páginas que el lector tiene armadas a la vista. Su versión para insertar en otros sitios (`archive.org/embed/…`) sí va en un iframe, pero no apareció una página que la use con una historieta.
2. **Issuu** (`issuu.com/sixthandspring/docs/manga_mania_blank_book_issuu`): el lector **sí va en un iframe** (`issuu.com/rd4?…`, de 869×733) y la extensión corre adentro, pero dibuja cada página como **fondo CSS con un SVG** (`svg.issuu.com/…/page_1.svg`), no como `<img>`: la extensión cuenta 0 páginas ahí. El diálogo se abrió en la página de arriba y armó un "capítulo" de 18 imágenes que son **tapas de otras publicaciones** (de 331×480 y parecidas), no el documento. **Resultado incorrecto**, por la limitación ya conocida de las imágenes puestas como fondo (sección 12).
3. **Comic Rocket** (`comic-rocket.com/read/the-oatmeal/1`): un agregador de historietas web que muestra la página del autor **dentro de un iframe de otro sitio** (`theoatmeal.com/comics/tapeworm`; la página de arriba solo tiene otro iframe con la barra de navegación). La entrega son un encabezado y 6 viñetas.
   - **Sin adaptador:** el diálogo se abrió en el iframe, con el nombre armado con el título de la página de arriba y el número de su dirección (`The Phases of a Tapeworm's Life - The Oatmeal/… 0001`), y guardó un PDF de **2 páginas**: las viñetas son tiras bajas (de 145 a 298 px de alto) y solo dos pasan el lado mínimo de 250 px de la detección automática.
   - **Con un adaptador para theoatmeal.com** (`ADAPTADOR='{"sitio":"theoatmeal.com","contenedor":"#comic","ignorar":["img[src*=\"/thumbnails/\"]"]}'`): **7 de 7**, el PDF con la entrega entera (601×180, 693×298, 693×237, 699×145, 692×248, 658×260 y 678×195). Con el contenedor solo entraban 8: la octava era la miniatura de otra página de The Oatmeal que está en el mismo bloque, y para eso es "ignorar".
   - **Qué confirma:** con el lector en un iframe de otro sitio, en un sitio real, el diálogo se abre en el marco que tiene las páginas, el nombre sale de la página de arriba y el PDF se guarda. Lo que faltó la primera vez es el filtro de tamaño, no el iframe.

**Un 429 o un 503 de un sitio de verdad** — 23-11-2026, de 21:58 a 22:06 (hora de Argentina), contra one-piece-fans2.com (servidor `hcdn`, la CDN de Hostinger), a una carpeta temporal que se borró:

- **La extensión 2.11.2**, `PAUSA=0 CONCURRENCIA=8 node tests/probar_sitio.js "…/manga/es/todos/1134" 1100 1119`: 20 capítulos seguidos sin pausa entre ellos y con 8 imágenes medidas a la vez. "✅ Listo: 20 capítulos guardados", 274 páginas en 143 s. **El sitio no pidió esperar nunca**: no hubo cuenta regresiva ni ningún `esperaSitio` anotado.
- **El programa** (la misma cola de siempre, armada con el código de la 2.11.2 y corrida en modo prueba, que entre capítulo y capítulo espera 0,1 s en vez de 1,5): capítulos 1120 a 1139, los 20 "listo", 295 páginas (291 MB) en 213 s. Ninguno quedó con "el sitio pidió esperar".
- **Una ráfaga sin la extensión:** 120 pedidos de páginas de capítulo, de a 12 a la vez, en 5 s: las 120 respondieron 200.
- **Conclusión:** con lo probado, one-piece-fans2.com **no limita** ni por ritmo de pedidos ni por cantidad de capítulos seguidos, así que ni la extensión ni el programa vieron un 429 o un 503 real. No se siguió cargando el sitio con más gigas para forzarlo. Lo que cada uno hace ante un 429 o un 503 está probado contra los sitios de prueba locales (`tests/e2e_211.js`, áreas `ritmo` y `espera`; `npm run prueba` del programa).

**Páginas dibujadas de fondo en sitios reales** — 24-11-2026, con la **2.11.3** y `probar_sitio.js` (`ESPERA` = segundos que espera antes de abrir el diálogo). Se corrió tres veces a medida que la detección se ajustaba (07:54, y con el código final de 08:34 a 08:35 ART, 11:34 a 11:35 UTC); las tres dieron lo mismo:

- **Issuu, con el lector cargado** (08:34:05 ART; `ESPERA=20 node tests/probar_sitio.js "https://issuu.com/sixthandspring/docs/manga_mania_blank_book_issuu" guardar`): la página de arriba cuenta 0 (sus tapas son una grilla) y el iframe del lector (`issuu.com/rd4?…`) cuenta 1. El diálogo se abrió en el iframe: **"1 de 1 páginas · páginas dibujadas de fondo"**, y guardó un PDF de 1 página de 1150×1497 (259 KB): la página que el lector tiene dibujada (`svg.issuu.com/…/page_1.svg`, con el escaneo adentro, que el armador sacó sin recodificar). Para el documento entero hay que pasar las páginas del lector: Issuu dibuja solo la que se está viendo.
- **Issuu, con el diálogo abierto antes de que cargue el lector** (08:34:31 ART, `ESPERA=4`): la página de arriba tenía la imagen de un menú y las tapas de otras publicaciones. El diálogo dice **"No encontré páginas del capítulo en esta página. Lo que hay son tapas que llevan a otras páginas del sitio."**, con Guardar apagado: no se guardó nada.
- **Con la 2.11.2** (23-11-2026 a las 21:5x, ver más arriba) el mismo documento había dado un "capítulo" de **18 tapas de otras publicaciones**. Ninguna corrida de la 2.11.3 las volvió a ofrecer.
- **Comic Rocket** (08:34:40 y 08:34:55 ART, `comic-rocket.com/read/the-oatmeal/1`, el lector de `<img>` en un iframe de otro sitio): igual que con la 2.11.2. Sin adaptador 2 de 2 (el lado mínimo deja afuera las tiras bajas); con el adaptador de theoatmeal.com, **7 de 7**. La detección de fondos no se mete: ahí hay `<img>`.
- **one-piece-fans2.com** (08:35:09 ART, `/manga/es/todos/1134`, lector `<img>`): la burbuja aparece y el diálogo propone `One Piece/11 Saga Final/One Piece 1134` con 15 de 17 páginas (2 descartadas como publicidad), lo mismo que con la 2.11.2: la detección normal no cambió en el sitio principal.
- En el medio, el 24-11-2026 a las 00:34 ART, una corrida intermedia del 2.11.3 mostró que el iframe del lector de Issuu (que dibuja de a una página) empataba con la página de arriba (que tenía 2 imágenes sueltas) y ganaba la de arriba: se arregló (la página con menos de 3 imágenes grandes cede ante un lector de fondo de un iframe del mismo sitio) y se repitió.

### El proxy de prueba: un 429 y un 503 de verdad (`programa/tests/proxy.js`, 0.10.3)

Un proxy HTTP chico, sin dependencias, que se pone entre una herramienta y un sitio de verdad: reenvía todo, cambia en las páginas y las cabeceras la dirección del sitio por la suya (para que el navegador siga pasando por ahí) y, cuando se le pide, contesta **429 o 503**, con `Retry-After` o sin él, sin que el pedido llegue al sitio. Cuenta cada pedido (número, hora, ruta, código, si fue inyectado).

- **Desde la línea de comandos:** `node programa/tests/proxy.js --sitio https://one-piece-fans2.com --codigo 503 --retry-after 5 --solo paginas --veces 1`. Opciones: `--codigo` (sin esto solo reenvía y cuenta), `--retry-after` (sin esto, sin cabecera), `--desde N` (desde el pedido N de los que coinciden), `--veces N` (cuántos seguidos; sin esto, todos desde ahí), `--ruta <regex>`, `--solo paginas|imagenes`, `--puerto`. Imprime una línea por pedido (`#3 20:31:05.123 503 GET /img/1.jpg ← inyectado`). Hay que entrar por 127.0.0.1.
- **El programa lo usa** con `MR_PROXY=http://127.0.0.1:PUERTO npm start` (o `npm start -- --proxy=…`): le pregunta al proxy en `/__proxy` a qué sitio reenvía y le manda todo lo de ese sitio (`usarProxy`, con `webRequest.onBeforeRequest`). La barra de título lo dice. Sin la variable ni la opción no se registra nada y todo va directo.
- **Desde una prueba:** `iniciarProxy({ sitio, reglas: [{ codigo, retryAfter, desde, veces, ruta, accept, solo }] })` → `{ url, pedidos, fijarReglas, cerrar }`.
- **Límites:** un solo sitio (lo que esté en otro nombre va directo); las direcciones armadas por JavaScript no se cambian. **Lo que el navegador ya tiene en su caché no vuelve a pedirse:** en un sitio real, el armador toma de la caché las imágenes que la página ya bajó, así que una regla para "las imágenes que pide el armador" no llega a cortar nada (pasó en la corrida del 24-11-2026 a las 00:39). El corte del armador se prueba contra el sitio de prueba local, que no deja guardar nada en caché.

**Comprobaciones automáticas** (en `npm run prueba` del programa, delante del sitio de prueba local): con el programa usando el proxy igual que con `MR_PROXY`, la página y sus imágenes pasan por él; **503 y 429 sin cabecera** (al tocar Reintentar, el detalle dice "el sitio pidió esperar: sigo en N s" con N entre 55 y 60; en el mismo instante del clic en Cancelar se leen el número y los botones —Cancelar prendido, Reintentar apagado— y la página se pidió una sola vez, también 1,5 s después); **503 con `Retry-After: 5`** (cuenta hasta 1, el pedido nuevo sale entre los 5 y los 15 s, y completa); **corte desde el 6.º pedido** (incompleto, con el motivo, sin ningún archivo); **503 en dos imágenes que carga la página** (incompleto, sin archivo nuevo, freno de lo que pidió, y al reintentar sale entero); **un capítulo que ya estaba en la carpeta** con una imagen que pide esperar (sigue siendo "ya estaba", y el sitio queda frenado); **dos fallos seguidos del mismo capítulo** (el botón se sigue ofreciendo, el tercer intento sale y cada uno respetó el freno); y los **botones del aviso** (ver más abajo). Al final, sin el proxy, la página va directo. Fuera del proxy, contra el sitio de prueba: **un 429 sin cuerpo** (Chromium muestra su propia página de error; el programa ve la respuesta y frena igual: un revisor sostuvo que en Electron igual llega como navegación con su código, así que ese arreglo puede ser solo preventivo; la prueba lo cubre por los dos caminos) y **la tapa de un "relacionado" que responde 503** (otra carpeta: el capítulo sale entero y el sitio no se frena). Qué imágenes cuentan lo decide la carpeta de las páginas, no el dominio (`imagenQuePidioEsperar`): una que después cargó no faltó, y un aviso o la tapa de un relacionado no son del capítulo.

**A mano: una corrida real contra one-piece-fans2.com a través del proxy.** Pasos: (1) `node programa/tests/proxy.js --sitio https://one-piece-fans2.com --codigo 503 --retry-after 5 --solo paginas --ruta /manga/es/todos/1100 --veces 1`; (2) en otra terminal, `MR_PROXY=<la dirección que imprimió> npm start` en `programa/`; (3) analizar `https://one-piece-fans2.com/manga/es/todos/1100` y bajarlo; (4) tocar **Reintentar** y mirar la cuenta regresiva y la línea del proxy del pedido nuevo. Para un 429 sin cabecera: `--codigo 429` sin `--retry-after`. Para las imágenes de la página: `--solo imagenes --ruta /mangafiles/ --desde 3 --veces 3`.

Resultado del **24-11-2026, de 08:59 a 09:02 ART** (11:59 a 12:02 UTC), con el programa 0.10.3 final en modo prueba (una copia fuera del repositorio, con la configuración de fábrica y una carpeta temporal que se borró), usando el proxy como con `MR_PROXY`. Una corrida anterior (07:58 a 08:01) dio los mismos números:

| Caso | Qué hizo el programa | Cuánto esperó |
|---|---|---|
| 503 con `Retry-After: 5` en la página del capítulo 1100 | "falló · La página respondió HTTP 503: el sitio pidió esperar"; freno de 4,9 s; al reintentar, "sigo en 5 s" … "sigo en 1 s"; bajó las 17 páginas | El pedido nuevo de la página, **5,1 s** después del 503 |
| 429 sin `Retry-After` en la página del capítulo 1101 | Igual, con HTTP 429; freno de 59,8 s; "sigo en 60 s" … "sigo en 1 s"; bajó las 15 páginas | **60,1 s** |
| 503 sin `Retry-After` en tres imágenes que carga la página (1103) | "incompleto · no guardé nada, para no dejarlo a medias · el sitio pidió esperar (HTTP 503)", sin ningún archivo; freno de 59,8 s; al reintentar esperó el minuto y bajó las 14 páginas | **Un minuto** (la cuenta fue de 60 a 1) |

Lo que encontró la corrida del 24-11-2026 a las 00:40 ART, con la versión de ese momento: con el 503 en las imágenes que carga la página, **el capítulo quedó "listo" con 3 páginas de 17**: una imagen rota no dice por qué, y las que cargaron no llegaban a armar la carpeta del capítulo, así que tampoco contaban como faltantes. Se arregló en el programa (la sesión mira también la respuesta de las imágenes del sitio: `imagenesEnEspera`) y quedó como comprobación automática. **En la extensión no cambió** (ver "No probado").

### Los botones del aviso de fin de cola del programa (0.10.3)

Al terminar la cola, si el programa no está a la vista, Windows muestra el aviso con un botón por cada cosa que la ventana deja hacer con la cola terminada: **Reintentar N que falló** (si algo falló), **Limpiar terminados** y **Abrir carpeta**, con el mismo texto que sus botones. Cada uno corre el mismo manejador que su botón de la ventana, por el mismo camino (`correr`), una sola vez aunque Windows avise el toque dos veces.

- **En `npm run prueba`:** se arma el aviso (`armarAvisoDeFin`) y se dispara la acción de cada botón como la dispara Windows: Reintentar vuelve a la cola el capítulo una sola vez aunque el toque llegue dos veces y respeta el freno (sale a los 3 s o más del 503); sin nada que reintentar el aviso no lo ofrece; Abrir carpeta va a la carpeta de descargas (en esa prueba se anota en vez de abrir el Explorador); Limpiar deja la lista vacía en el programa y en la ventana.
- **Con un clic real: `npm run avisos`** (`programa/tests/avisos.js`). Muestra el aviso de verdad y aprieta cada botón con `programa/tests/clic-aviso.ps1` (UI Automation de Windows, sin mover el mouse: busca la ventana del aviso con `FindWindowEx` y el botón por su nombre). No es parte de `npm run prueba`: muestra avisos en la pantalla y abre una ventana del Explorador (la cierra al terminar). Resultado del **24-11-2026** (Windows 11, Electron 45.4.1):
  - **Con el programa final, dos corridas seguidas enteras en verde (08:56:29 y 08:57:48 ART).** En las dos: **"Reintentar 1 que falló"**, con el capítulo fallado por un 503 sin `Retry-After`: el clic llegó a los 3,9 s del 503 y el reintento salió recién **a los 60,1 s** (el freno de un minuto), y se guardó; **"Limpiar terminados"** dejó la lista vacía en el programa y en la ventana; **"Abrir carpeta"** abrió el Explorador en la carpeta de descargas. El programa anota lo que llega de Windows: cada toque llega **dos veces**, con el índice del botón, y se usa una.
  - **Lo que pasó en el medio, y qué se cambió.** A las 07:56 la prueba había pasado entera. Entre las 08:47 y las 08:54, cuatro corridas perdieron el primer toque de Reintentar (Limpiar y Abrir carpeta andaban). Dos cosas: (1) **un error del programa**: solo guardaba la referencia al último aviso, y Electron pierde los eventos de un aviso que nadie referencia (el del centro de notificaciones de una cola anterior, o uno que Windows mostró tarde); ahora guarda los últimos 10. (2) **El script tocaba demasiado rápido:** apretaba el botón apenas encontraba el aviso, todavía en su animación de entrada, y ese toque no le llegaba al programa (el registro no mostraba ningún evento; un segundo toque, segundos después, sí llegaba). `clic-aviso.ps1` espera ahora 1,5 s antes de apretar (`-Pausa`), como lo haría una persona. Con los dos cambios pasaron las dos corridas finales.
  - El primer aviso después de que Electron crea su acceso directo en el menú Inicio **no sale en pantalla** (va directo al centro de notificaciones): la prueba lo muestra otra vez. Al terminar se borraron el acceso directo, las claves del registro que había creado la prueba y sus avisos del centro de notificaciones.
- **A mano, en el programa de todos los días:** dejar la ventana del programa sin el foco (otra ventana adelante), bajar dos capítulos de los que uno no exista, y al terminar tocar cada botón del aviso: **Reintentar 1 que falló** lo vuelve a la cola (si el sitio había pedido esperar, el renglón dice "sigo en N s"); **Limpiar terminados** deja la cola vacía; **Abrir carpeta** abre la carpeta de descargas. Si el aviso no aparece, está en el centro de notificaciones (Win + N).

### Lote largo (`node tests/lote_largo.js`)

Una serie de prueba servida en esta máquina, con la cantidad de capítulos que se pida, para ver si el lote aguanta más de unos minutos. No es parte de `e2e.js` porque tarda.

El 22-11-2026, con la 2.8.4 y con ventana (pestañas en segundo plano como en el Chrome de todos los días): **70 capítulos de 8 páginas, 346 segundos, los 70 guardados**, todos con sus 8 páginas, ningún capítulo abierto dos veces y sin pestañas colgadas. O sea que el lote no tiene un tope propio de cantidad ni de tiempo. Si en un sitio se corta siempre después de una cantidad parecida de capítulos, es el sitio el que deja de entregar las páginas (por ejemplo, porque limita cuántas se piden seguidas): el resultado dice "Parado: … capítulos seguidos no tenían páginas" y los que faltan quedan tildados para seguir más tarde.

### No probado

- **Actualizar la extensión de verdad con pestañas abiertas.** En el navegador de prueba no se puede recargar la extensión (la bloquea), así que se probó marcando la copia vieja como desconectada. El primer uso real después de cargar esta versión lo confirma.
- **El desplegable de capítulos del sitio real ya cargado.** En el navegador de prueba queda en "Cargando…", así que no se vio qué valores trae. El código acepta número, dirección o número en el texto; si trae otra cosa, el rango "Del … al …" funciona igual.
- **"Abrir cada capítulo a la vista"** solo se probó con `chrome.*` simulado.
- **La pestaña "Tomos" y la plantilla de nombres (2.10)** se probaron en el sitio de prueba local, no en un sitio real. Si en un sitio los tomos no aparecen, es porque sus títulos no están en un encabezado (`<h1>`–`<h6>`, `<summary>`) o no nombran un tomo; ahí el lote funciona igual, por la pestaña Capítulos.
- **Lotes de cientos de capítulos** (se probaron 70 seguidos) y la apertura de los CBZ en una app lectora de tablet.
- **De la 2.11:**
  - **`Alt+S` apretado de verdad.** Es un atajo del navegador y la prueba no lo puede apretar: se prueba el mismo pedido que hace el atajo (en el navegador) y que el atajo llegue al marco del lector (con `chrome.*` simulado).
  - **Los botones de la notificación con un clic real.** Que la notificación se crea se ve en el navegador; lo que hace cada botón, con `chrome.*` simulado. Una prueba no puede apretarlos: la notificación la dibuja Windows, fuera del navegador. Se prueban a mano con los pasos de más abajo.
  - **El chequeo de versión contra GitHub.** Las suites lo prueban con internet simulada y con el README de este repositorio. El pedido real se hizo una vez, a mano, con `tests/probar_version.js` (resultado más abajo).
  - **La pausa de 60 s** cuando un capítulo responde 429 o 503: la prueba la acorta a 2 s desde `ritmo.espera429`.
  - **Arrastrar con el mouse.** La prueba dispara los mismos eventos (`dragstart`, `dragover`, `drop`), no mueve un puntero.
  - **Todo lo de la 2.11 en un sitio real.** Se probó contra las páginas de `tests/fixtures/`. Lo que se corrió contra un sitio real el 23-11-2026 está en "Prueba en el sitio real", más arriba.
- **De la 2.11.1:**
  - **Un 429 o un 503 de un sitio real.** La parada del lote y el corte del armador se probaron con el sitio de prueba, que contesta 503 a pedido. El 23-11-2026 se intentó provocar uno en one-piece-fans2.com (20 capítulos seguidos con cada herramienta y una ráfaga de 120 pedidos) y el sitio no limita: ver "Prueba en el sitio real", más arriba.
  - **El aviso de selector inválido de un adaptador** se probó forzando el adaptador en `chrome.storage`; por la página de opciones no se puede guardar uno así.
  - (El `Retry-After` de la página de un capítulo, que la 2.11.1 no leía, lo lee la 2.11.2.)
- **De la 2.11.2:**
  - **El minuto entero sin cabecera.** La prueba lee la cuenta regresiva (arranca en 60) y el estado del botón en el mismo instante, y cancela: no espera el minuto. Que el reintento no salga antes se ve en que el capítulo se pidió una sola vez hasta ese momento y después de cancelar.
  - **Un lector en un iframe que responde 429 o 503.** Solo se lee la respuesta del documento de la pestaña (`main_frame`): si la página está bien y el iframe del lector es el que pide esperar, el capítulo queda "Sin páginas", sin freno.
  - **Si el service worker se reinicia** justo entre la respuesta del capítulo y su lectura, se pierde lo que dijo la cabecera y el lote frena el minuto de siempre.
  - **`webRequest` en el Chrome de todos los días.** Se comprobó en el Chromium de prueba (carga sin advertencias, la cabecera llega); el primer lote real que choque con un sitio que pida esperar lo confirma.

- **De la 2.11.3 y la 0.10.3:**
  - **Una página SVG con texto o trazos encima del escaneo** (se dibuja entera en un canvas): solo leído, sin prueba; en Node no hay canvas y el navegador de prueba no sirve SVG así.
  - **En la extensión, un 503 en las imágenes que carga la página** (no el armador) no se ve: una imagen rota no dice por qué. La extensión usa la misma detección que el programa, así que, por lo que hace el código, si las que cargaron no arman la carpeta del capítulo guardaría lo que cargó sin avisar que faltan (no se corrió contra el proxy). El programa sí lo ve desde la 0.10.3. Quedó pendiente: hacerlo en la extensión con `webRequest` (que ya escucha mientras un lote tiene un capítulo abierto).
  - **Un tercer intento de un capítulo en un lote de la extensión:** el reintento automático sigue siendo uno por lote (`yaEspero`); **Reintentar** de la cola no tiene límite y respeta el freno, pero en esta versión no se probó un tercer intento seguido.
  - **Los botones de la notificación del lote de la extensión** siguen probándose a mano (pasos de abajo): la notificación la dibuja Windows para Chrome, y el navegador de prueba corre sin interfaz.
  - **El instalador del programa:** los botones del aviso se probaron con `npm run avisos` (Electron sin instalar). El programa instalado usa su propio acceso directo y no se probó.
  - **En el programa, Cancelar y Reintentar en medio de una bajada:** antes el intento viejo pisaba el reintento y se perdía; ahora cada reintento es otra vuelta (`vez`) y el intento viejo no escribe nada. Arreglado por una revisión que lo reprodujo con la cola simulada; no hay prueba automática (hay que acertar el momento).
  - **`MR_PROXY` con el programa ya abierto:** la ventana que ya estaba no pasa por el proxy; ahora la consola lo dice. Sin prueba automática.

#### A mano: los botones de la notificación del lote

Hace falta el Chrome de todos los días con la extensión cargada, y que Windows deje a Chrome mostrar notificaciones (Configuración → Sistema → Notificaciones → Google Chrome, y "No molestar" apagado).

1. Abrir la página de una serie y **Descargar varios capítulos**. Marcar dos capítulos que existan y, con "Del … al …", sumar uno que no exista (por ejemplo, el número siguiente al último). **Descargar**.
2. Al terminar tiene que aparecer la notificación **"Manga Reader: lote terminado con fallas"**, con el texto "2 de 3 capítulos guardados · 1 con fallas" y dos botones. Si se fue de la pantalla, está en el centro de notificaciones (Win + N).
3. Tocar **Mostrar la carpeta**: se abre el Explorador en la carpeta de Descargas, con el último archivo guardado seleccionado, y la notificación se cierra.
4. Repetir el paso 1 para tener otra notificación y tocar **Reintentar los que fallaron**: Chrome pasa a la pestaña de la serie, se abre el diálogo de varios capítulos con solo el que falló y el lote arranca solo (el estado dice "Preparando el lote…" y después el avance).
5. Lo mismo, pero cerrando antes la pestaña de la serie: al tocar **Reintentar los que fallaron** la tiene que abrir de nuevo y arrancar igual.
6. Un lote en el que sale todo: la notificación dice "lote terminado" y trae un solo botón, **Mostrar la carpeta**. Un lote cancelado no avisa.

#### A mano: el pedido a GitHub del aviso de versión nueva

- **Desde un script:** `node tests/probar_version.js` hace el pedido real con la misma función que usa el popup (`versionRemota`) y dice qué contestó; con una versión como argumento (`node tests/probar_version.js 2.10.0`) dice qué vería alguien que tiene cargada esa. Con `--navegador` abre además el popup en el Chromium de prueba, sin nada anotado, para que el pedido lo haga el popup.
- **Resultado del 23-11-2026** (20:15 a 20:23, hora de Argentina), con la 2.11.0 en `main` y la 2.11.1 todavía sin subir:
  - GitHub contestó **200** a los dos pedidos, `README.md` (334 ms) y `manga-reader-ext(ver 23-11-2026)/manga-reader-ext/manifest.json` (196 ms), y de ahí salió **2.11.0**.
  - Contra la 2.11.1 instalada: nada más nuevo, sin punto. Contra una 2.10.0: "hay una versión nueva", con punto.
  - Con `--navegador`: el popup de la 2.11.1, en Chromium y sin `versionVista`, hizo el pedido él solo y dejó anotado `{"version":"2.11.0"}`, sin mostrar el punto. O sea que el pedido también sale desde una página de la extensión (el servidor lo permite).
- **Resultado del 23-11-2026 a las 20:54** (hora de Argentina; 23:54 UTC), ya subida la 2.11.1, con `node tests/probar_version.js --navegador "manga-reader-ext(ver 23-11-2026)"` (la 2.11.0 cargada en el navegador):
  - GitHub contestó **200** a los dos pedidos, `README.md` (367 ms) y `manga-reader-ext(ver 23-11-2026-2)/manga-reader-ext/manifest.json` (248 ms), y de ahí salió **2.11.1**.
  - El popup de la 2.11.0, sin `versionVista`, hizo el pedido él solo, dejó anotado `{"version":"2.11.1"}` y **mostró el punto**: "Hay una versión nueva: 2.11.1 (tenés la 2.11.0)". El aviso anduvo de punta a punta con una versión nueva de verdad en `main`. (Hasta esta corrección, este documento decía que eso no se había visto.)
- **En el Chrome de todos los días:**
  1. Clic derecho en el ícono de la extensión → **Inspeccionar ventana emergente**. En la consola: `chrome.storage.local.remove('versionVista')`.
  2. Con la pestaña **Red** de esas herramientas a la vista, cerrar el popup y abrirlo de nuevo (clic derecho → Inspeccionar ventana emergente, otra vez). Tienen que verse dos pedidos a `raw.githubusercontent.com`, los dos con 200: `README.md` y el `manifest.json` de la carpeta de la última versión.
  3. En la consola, `chrome.storage.local.get('versionVista')` tiene que mostrar `{ ts, version }` con la versión que hay en `main`. Hasta el día siguiente no vuelve a pedir.
  4. Para ver el punto sin esperar a que haya una versión nueva: `chrome.storage.local.set({ versionVista: { ts: Date.now(), version: '99.0.0' } })` y abrir el popup; tiene que decir "Hay una versión nueva: 99.0.0 (tenés la 2.11.2)" (o la versión que tengas cargada). Después, `chrome.storage.local.remove('versionVista')`.

---

## 12. Limitaciones conocidas

- **Publicidad con formato de página:** un aviso al final del mismo tamaño que una página normal y en la misma carpeta del capítulo pasa como página. Se destilda a mano; en un lote, entra.
- **Sagas incluidas solo para One Piece**, con rangos cargados de memoria. Las de otras series hay que cargarlas en opciones.
- **Sin detección de tomo (volumen).** La página no lo indica.
- **El nombre depende del título de la página.** Si el sitio no actualiza el título al pasar de capítulo sin recargar, el nombre puede quedar con el número anterior; se soluciona con F5.
- **El registro de guardados no mira el disco.** Si borrás un archivo a mano, la extensión sigue diciendo que lo guardaste hasta que lo quites en opciones.
- **Lectores que protegen las páginas** (imágenes `blob:` descifradas en el momento, como MANGA Plus): no se guardan. La extensión las reconoce solo para no guardar en su lugar el logo y los banners, y dice que no encontró páginas (sección 4.1). Los lectores que dibujan las páginas en un `<canvas>` no se detectan: ahí el diálogo dice "No encontré páginas".
- **Páginas dibujadas de fondo (desde la 2.11.3 sí se detectan, con condiciones; sección 4.18):** tienen que ser una serie (dos o más con números en una carpeta) y no tiene que quedar ninguna `<img>` que pueda ser una página. Un lector que dibuja una sola página por vez se reconoce solo dentro de un iframe grande (como el de Issuu); en la página de arriba hace falta un adaptador con "Las páginas están dibujadas de fondo". Se guarda lo que el lector tiene dibujado en ese momento: Issuu dibuja la página que se está viendo, y el PDF sale con esa (ver sección 11). Diapositivas numeradas sin link (`slide1.jpg`, `slide2.jpg`…) se pueden tomar por un lector. En un lote, un capítulo de fondos deducidos espera hasta 8 s a que aparezcan `<img>`. Un lector cuyas páginas llevan cada una a otra página (`…/pagina/2`, `?p=2`) se toma por un listado de tapas, y páginas con códigos cortos en el nombre (`p-a8f3e9c1.jpg`) no forman una serie: para esos, el adaptador.
- **Una página SVG con texto o trazos encima del escaneo** se dibuja entera en un canvas (como JPG); eso se probó solo leyendo el código: en Node no hay canvas y el navegador de prueba no sirve páginas SVG así.
- **Solo Chrome de escritorio** (y navegadores Chromium que acepten extensiones descomprimidas).
- **Referer:** las imágenes se bajan sin el Referer del sitio. En one-piece-fans2.com no hace falta (verificado); si otro servidor de imágenes lo exige, devuelve 403 y el guardado lo informa como "No se pudo leer ninguna página (HTTP 403)".
- **Iframes (desde la 2.11 sí se detectan):** se guarda lo que hay en el marco con más páginas, no la suma de varios marcos. Desde un iframe no se ofrece "Guardar y siguiente". Un marco `about:blank` o `srcdoc` (sin dirección propia) no se mira. El recorrido automático mueve la ventana del marco, no la de la página.
- **Adaptadores (2.11):** dicen dónde están las imágenes, no enseñan atributos nuevos de carga diferida: si la página guarda la dirección real en un atributo que la extensión no conoce, el adaptador no la encuentra.
- **Estimación de tamaño (2.11):** es un promedio de lo ya guardado de ese sitio con los formatos de ese momento; sin nada guardado no se estima, y lo guardado antes de la 2.11 no cuenta porque no anotaba el peso.
- **Versión nueva (2.11):** sale de la tabla del `README.md` del repositorio; si el repositorio no es público, o esa tabla cambia de forma, no hay aviso.
- **El recorrido de la página mueve la ventana, no un panel interno.** En un lector que tenga su propio scroll adentro, no carga nada nuevo.
- **Varios capítulos:**
  - Si la dirección de cada capítulo incluye algo que cambia de uno a otro además del número (por ejemplo la fecha en que se publicó, `/2025/02/…`), no hay un molde con `{n}` que sirva para todos: solo se pueden tomar de links.
  - Hace falta que la dirección de cada capítulo lleve su número, o que la página tenga links o un desplegable con los capítulos. En un sitio con direcciones tipo `/leer/a8f3c2` o con un código del sitio (`/viewer/2010289`) y sin lista, no hay forma de armarlas.
  - Los links de capítulos con un código de más de 5 cifras en la dirección no se toman como capítulos.
  - Un capítulo con menos de 3 páginas no se guarda ("Sin páginas"), salvo que el sitio tenga un adaptador (2.11.1).
  - Cuando el sitio pide esperar (429 o 503), el lote frena lo que pidió (un minuto si no dijo cuánto, con tope de un minuto si pidió más) antes de cada pedido a ese sitio, pero reintenta un capítulo una sola vez por lote. Si después le pasa lo mismo a otro capítulo, ese espera y se intenta una vez: si vuelve a fallar queda como falla, y se retoma con **Reintentar** cuando el sitio afloje.
  - Un sitio que pide esperar más de un minuto (`Retry-After: 300`) recibe el pedido siguiente al minuto: el tope es a propósito, para no dejar el lote parado, y puede volver a contestar 429.
  - La pestaña desde donde se inició tiene que quedar abierta y en la misma página; un lote por pestaña a la vez. Desde la 2.11, si se cierra, la cola guarda lo que faltaba y se reanuda al volver; hay una sola cola: un lote nuevo reemplaza a la anterior.
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

Desde la 2.11 es una opción: ⚙️ → "Cómo se guardan los archivos" → **Carpeta de las descargas** (ver 4.14). La de fábrica es `CARPETA_DEFECTO` en `ajustes.js`; la arma `carpetaBase` en `background.js` y la muestra `baseDe` en `content.js`, los dos con `aplicarCarpeta`.

### Ajustar el filtro

En `flagNonPages`: cantidad de páginas finales revisadas (`good.length - 3`), rangos de proporción en `fits`, y cuándo no se aplica (`uniform`). Sumar el caso en `tests/test_filtro.js`.

### Otro formato de título o de dirección

Los títulos se interpretan en `detectChapter` y las direcciones de capítulo en `splitChapterUrl`. Sumar el caso en `tests/test_nombres.js` o `tests/test_capitulos.js` antes de tocar la expresión.

### Agregar un archivo que corre en las pestañas

Como `agrupar.js`, `plantilla.js`, `estilos.js` o `ajustes.js`. Va en tres lugares: `content_scripts` de `manifest.json`, `CONTENT_FILES` de `background.js` (lo que se inyecta en las pestañas abiertas antes de actualizar) y `COMPARTIDOS` de `tests/extraer.js`. Tiene que ir envuelto en una función y dejar lo suyo en `globalThis`. Si el programa de escritorio lo necesita, sumarlo también a `programa/scripts/generar.js`.

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
| "No encontré páginas del capítulo en esta página" | El lector muestra las páginas como imágenes `blob:`, sin dirección para bajar | No se pueden guardar con la extensión (sección 12) |
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
| 2.7 | **Varios capítulos seguidos, rehecho:** cada capítulo se abre en una pestaña en segundo plano y se guarda con el mismo código del guardado normal; funciona desde un capítulo y desde la portada; rango por número con ceros adelante; desplegables; cancelar; saltear guardados. **Una sola bajada por página** para PDF, CBZ e imágenes, con reintentos y aviso de qué páginas faltaron. **PNG sin pérdida** en el PDF. **Imágenes sueltas con su extensión real.** **Recorrido automático** de la página al abrir. **Guardar y siguiente.** **Sin F5** después de actualizar. **Burbuja por sitio.** Página de **guardados, sagas y opciones** con exportar/importar y capítulos faltantes; sagas editables. Correcciones: títulos con el nombre del capítulo o palabras de más, filtro en webtoons y en lectores con links al CDN, dos diálogos al pedirlo dos veces, clics perdidos en miniaturas, teclado en todo el diálogo, la burbuja deja de revisar páginas que no son de manga |
| 2.8 | **Sitios de manga y cómics:** desde el ícono, una lista de 85 accesos directos a sitios legítimos de manga, manhwa, cómics, tiras e historieta, con etiqueta de tipo e idiomas en cada fila y una **i** que dice qué tiene, si es gratis y si se puede guardar. Filtros (Manga, Cómics, en español, se pueden guardar) y buscador. **Mis sitios:** agregar, editar y quitar los tuyos desde opciones o con "Agregar esta página"; entran en la copia exportada |
| 2.8.1 | **Correcciones por MANGA Plus.** Una dirección con un código del sitio (`/viewer/2010289`) ya no se toma como capítulo 10289 ni genera direcciones inventadas (`/viewer/2010289/01`, que daban "Page not found"): el diálogo de varios capítulos lo explica y deja la dirección para completar. Títulos `[#104] Serie`. **Páginas protegidas** (imágenes `blob:` o `<canvas>`): el diálogo avisa con 🔒 en vez de ofrecer el logo y los banners como páginas, la burbuja no aparece y el lote para enseguida. **El lote para solo** después de 3 capítulos seguidos sin páginas, en vez de abrir una pestaña por cada capítulo marcado. `probar_sitio.js` informa también el diálogo de guardar |
| 2.8.2 | **Lista de sitios recortada a 23:** quedan solo plataformas donde los capítulos se leen en el mismo sitio, con el catálogo completo y al día (MANGA Plus, MANGA MILLION, WEBTOON, VIZ, Manga UP!, Lezhin, Manta, Toomics, GlobalComix, Marvel, Panel Syndicate y otras). Salen tiendas, préstamos de biblioteca, archivos de números sueltos, secciones de diarios, sitios sin actualizar, Tapas (cierra en marzo de 2027) y DC Universe Infinite (no anda desde Argentina). Marvel pasa a su lector, `marvelcomicsapp.com` |
| 2.8.3 | **Lista de sitios dividida** en 📥 Descargables y 👁 Para leer en el sitio, con la cantidad de cada sección; se pliegan tocando el título y se recuerda. **Filtro de idioma** (Todos, Español, Inglés) en lugar de "En español", con un botón por cada idioma de la lista; reemplaza también a "Se pueden guardar", que ahora es la división. **Tus sitios** llevan "Se puede descargar" para caer en la sección que corresponde |
| 2.8.4 | **Revisión de la 2.8.1 a la 2.8.3: tres correcciones para que el lote no se rompa en sitios que antes andaban.** (1) Si la dirección termina en un número de hasta 5 cifras se vuelve a confiar en ella aunque el título diga otro: la 2.8.1 la descartaba, y fallaba con títulos que terminan en un año o que quedan viejos al cambiar de capítulo sin recargar. (2) Un listado con un código largo en su dirección vuelve a tomar los capítulos de sus links. (3) "Páginas protegidas" cuenta solo imágenes `blob:`: los `<canvas>` de adorno o de publicidad daban falsos avisos y frenaban el lote. Además, el nombre usa el número de la dirección cuando aparece en el título (`… 7 Español Online - 2026` es el 7), y `#1 …` al principio ya no pisa al número del final. Sitio de prueba nuevo con ese estilo en la prueba de navegador |
| 2.8.5 | **La lista de sitios pasa a ser solo la tuya.** Se quitan los 23 sitios incluidos. **Pegar una lista:** en opciones se pega el texto entero, con una dirección por renglón, y se detectan solos el nombre, la descripción, el tipo y el idioma (también con títulos de grupo como "Manga en español:"); antes de agregar muestra lo que encontró, y una casilla decide si van a Descargables o a Para leer. Buscador y **Quitar todos** en la lista de opciones. El popup vacío ofrece pegar la lista. Prueba nueva de **lote largo** (`tests/lote_largo.js`): 70 capítulos seguidos sin cortes |
| 2.8.6 | **El archivo por mes de un sitio ya no se toma como capítulos.** En los sitios armados como un blog, los links "enero 2021", "febrero 2021"… (`/2021/01/`) y los del calendario (`/2021/01/15/`) terminan en un número y la lista de varios capítulos los mostraba como capítulo 1, 2, 3…; pedir "del 1 al 104" bajaba la página de cada mes, con varios capítulos mezclados y sin orden. Ahora se descartan en links, desplegables y en la dirección de la página, y la lista sale de los links a los capítulos. Sitio de prueba nuevo con ese armado |
| 2.8.7 | **No se inventan direcciones sobre un archivo.** Cuando la página del capítulo termina en `.html`, `.php` y parecidos sin el número al final, y no hay links a los capítulos, el diálogo de varios capítulos suponía "esta dirección + /número" (`….html/1`) y el lote abría páginas que no existen. Ahora deja la dirección vacía, explica que no encontró los otros capítulos y no abre nada. El texto de la lista vacía ya no invita a marcar un rango si no hay dirección con `{n}` |
| 2.9 | **Pegar los links de los capítulos.** En el diálogo de varios capítulos se pega una lista de links, de cualquier sitio y con el texto que traiga alrededor, y la extensión arma la lista con el número de cada uno: el que esté escrito adelante, el que trae el propio link (aunque esté en el medio del nombre) o el orden en que se pegaron, desde el número que se elija y también al revés. Avisa repetidos y números que faltan. Con la serie escrita, cada archivo sale con esa serie y el número de la lista, que manda sobre el título de la página |
| 2.9.1 | **Se saca el aviso de páginas protegidas.** Ya no están el recuadro 🔒 del diálogo de guardar ni el corte del lote con ese mensaje. Esas páginas siguen sin guardarse: el diálogo dice que no encontró páginas del capítulo, y en un lote salen como "sin páginas" |
| 2.10.0 | **Tomos y plantilla de nombres.** (1) **Pestaña "Tomos"** en el diálogo de varios capítulos: cuando la página separa los capítulos con títulos ("Tomo 3", "Volumen 2", "Saga de…") o con grupos en el desplegable, `collectChapters` le anota a cada capítulo el suyo y `tomosDe` los agrupa (al menos 2 tomos distintos y 2 capítulos por tomo; el resto va a "Sin volumen"). Cada tomo se marca entero con un clic, queda tildado a medias si solo algunos están marcados y muestra cuántos ya se guardaron. El criterio está en `agrupar.js`, que también usa el programa de escritorio. (2) **Plantilla de nombres** en opciones → "Cómo se guardan los archivos", con los marcadores `{serie} {saga} {volumen} {numero} {titulo} {anio} {sitio}`, cuatro plantillas armadas, vista previa de un capítulo de un lote y de uno suelto, y avisos si los nombres van a chocar o si un marcador no existe. Un marcador sin valor no deja la carpeta vacía, el guion ni los paréntesis; una barra dentro de un dato no crea carpetas; la predeterminada da exactamente el nombre de siempre. `{volumen}` y `{titulo}` salen de la lista del lote. El armado está en `plantilla.js`, compartido por el guardado y la vista previa. (3) El diálogo muestra un ejemplo de cómo va a quedar guardado el primer capítulo marcado. (4) Con una plantilla propia, el registro anota serie y número de cada capítulo para que la página de guardados siga agrupando bien, y la copia exportada lleva la plantilla. (5) El service worker inyecta los mismos archivos que declara el manifest (antes de publicarla, la versión inyectaba solo `sagas.js` y `content.js`, y en una pestaña abierta de antes el diálogo de varios capítulos se rompía). |
| 2.11.0 | **Diez cambios y tres menores.** (1) **Shadow root:** el diálogo y la burbuja van adentro de un solo `#mr-host` con shadow root abierto y su hoja de estilos ahí (`estilos.js`, que reemplaza a `styles.css`); si la página saca el host, se repone. (2) **Iframes:** `all_frames`, y el service worker elige a qué marco hablarle según cuántas páginas cuenta cada uno; la burbuja queda en uno solo, y desde un iframe el capítulo es el de la página de arriba. (3) **Cola persistente:** `cola` en `chrome.storage`, con Reanudar, Reintentar los que fallaron y Descartar. (4) **Ritmo y esperas:** pausa, descanso y concurrencia en opciones; ante un 429 o un 503 se espera lo que diga `Retry-After` y se reintenta; si es el capítulo entero, el lote para una vez y lo reintenta. (5) **Insignia y notificación** del lote, con el permiso `notifications`. (6) **Orden de las páginas:** arrastrar, ▲▼, Invertir y Ordenar por número. (7) **Adaptadores por sitio**, con "Probar en esta página". (8) **Carpeta base** configurable, con `{sitio}`, `{serie}` y `{anio}`. (9) **Links pegados:** sin los ya guardados, y la lista se ordena o se invierte. (10) **Teclado y accesibilidad** de los diálogos. **Menores:** registro en CSV, tamaño estimado de un lote y aviso de versión nueva en el popup. `ajustes.js` reúne las reglas que comparten opciones, las pestañas, el armador y el service worker. Pruebas: `test_ajustes.js` y `tests/e2e_211.js` (81 comprobaciones en el navegador, medidas también contra la 2.10.0) |
| 2.11.1 | **Cierre de la 2.11: una revisión, sin funciones nuevas.** (1) **Un 503 vale lo mismo que un 429, en la página o en las imágenes:** `pidioEsperar` reconoce los dos; el lote guarda con `soloEntero` y el armador corta el capítulo en la primera página que queda afuera por eso (no pide las que faltaban ni arma nada a medias), con el mismo motivo que da la página: el lote para, lo reintenta una vez y lo deja para **Reintentar**. Antes, un 503 en las imágenes contaba como falla común y el lote seguía pidiendo. Guardando de a uno, el aviso dice que el sitio pidió esperar. (2) **El estado al arrancar un lote:** Reintentar y Reanudar también lo cambian en el momento ("Preparando el lote…"); antes seguía a la vista el final del lote anterior mientras se leía la cola, y un segundo clic en ese rato cancelaba el lote recién arrancado. Y si todo lo que le faltaba a una cola ya se guardó de a uno, Reanudar lo dice y la cierra (antes quedaba ofrecida para siempre). (3) **Adaptadores:** con uno cargado ya no queda nada de la detección automática: ni el lado mínimo (entran las tiras de un webtoon), ni la carpeta con más imágenes al contar, ni el mínimo de 3 páginas; y un selector inválido se avisa en el diálogo en vez de anotarse sin mostrarse. (4) **Limpieza:** se sacó de `content.js` el manejador del mensaje `count`, que ya nadie mandaba; `quitarGuardados` recibe la casilla "Saltear los que ya guardé". (5) `esperaPedida` en `ajustes.js`, para el programa de escritorio. **Pruebas:** 17 comprobaciones más en Node y 15 en el navegador (8 fallan contra la 2.11.0); las dos de `e2e.js` que dependían de que existiera `ajustes.js` ahora comparan siempre, contra el texto de la versión que se corre; `tests/probar_version.js` hace a mano el pedido real a GitHub. La sección 11 dice qué se probó a mano y contra un sitio real, y qué sigue sin cubrir |
| 2.11.2 | **El sitio dice cuánto esperar, también con la página del capítulo.** (1) **`Retry-After` de la página:** el service worker lee la cabecera de la respuesta del documento del capítulo con `webRequest` (permiso nuevo, sin advertencias nuevas al instalar; se escucha solo mientras un lote tiene un capítulo abierto) y anota por sitio hasta cuándo no pedirle nada (`esperaSitio`). Lo mismo con lo que pidieron las imágenes. (2) **El lote frena lo que pidió el sitio** (`esperaDelSitio`): 4 s si dice 4, un minuto si dice 300 (el tope), y un minuto si no dice cuánto o manda algo que no se entiende o una fecha vencida; antes de cada pedido a ese sitio, con la cuenta regresiva ("sigo en N s"): frena el reintento y también el capítulo que sigue. Hasta la 2.11.1 eran siempre 60 s y el capítulo siguiente no esperaba. **Pruebas:** 13 comprobaciones más en Node (510) y un área nueva en el navegador, `espera` (10, de las que 4 fallan contra la 2.11.1); los pedidos que recibe el sitio en el área `ritmo` salen de las constantes del armador. `probar_sitio.js` lee el lector en un iframe, baja el capítulo abierto (`guardar`), y acepta ritmo y adaptador. Contra sitios reales: un capítulo dentro de un iframe (Comic Rocket con The Oatmeal: entero con un adaptador) y un intento de provocar un 429 o un 503 (one-piece-fans2.com no limita), con fecha en la sección 11 |
| 2.11.3 | **Páginas dibujadas de fondo, sin ofrecer las tapas de alrededor.** Un lector que pinta cada página de fondo (CSS o SVG, como Issuu) no tenía `<img>` que la extensión viera, y se quedaba con cualquier imagen suelta: en Issuu guardó 18 tapas de otras publicaciones. (1) **Fondos:** del estilo calculado (con `::before` y `::after`), de los atributos de carga diferida (`data-bg`), de las reglas (con `image-set()`, respetando la cascada y los `@media`) y de los `<image>` de SVG; entra la serie que parece un lector (dos o más con números, juntas en un bloque), en orden, una por página, sin el mínimo de 250 px. Con `<img>` y fondos ganan las `<img>`; el diálogo dice "páginas dibujadas de fondo"; un adaptador puede pedir los fondos (casilla nueva). (2) **Lo que no son páginas:** tarjetas de un listado (con el link alrededor o al lado), recomendados de otro sitio, tiras de miniaturas, adornos desparramados (también los de un sitio empaquetado), íconos incrustados, degradés; en un iframe, avisos chicos y reproductores de video. (3) **Grilla de tapas:** si las imágenes sueltas son casi todas tapas, no se ofrecen ("Lo que hay son tapas que llevan a otras páginas del sitio"). (4) **Marcos y lotes:** el iframe de un lector de fondo del mismo sitio le gana a una página con pocas imágenes; un lote espera hasta 8 s a las `<img>` antes de dar por páginas unos fondos deducidos; el conteo para el service worker ya no usa números recordados. (5) **Páginas SVG:** el escaneo de adentro sin recodificar (embebido o por dirección), o dibujadas enteras si tienen algo más. Tres revisiones adversariales encontraron casos en páginas comunes (diarios, foros, catálogos, sitios empaquetados) que la primera versión tomaba por lectores; quedaron arreglados, cada uno con su prueba. **Pruebas:** 566 en Node (`test_fondos.js`, 50, nueva; contra la 2.11.2 fallan 22 de las 38 que corren ahí) y un área nueva en el navegador, `fondos` (14; contra la 2.11.2 fallan 11). Issuu de verdad: guarda la página que el lector tiene dibujada, o dice que no encontró páginas; nunca más las 18 tapas (sección 11) |
