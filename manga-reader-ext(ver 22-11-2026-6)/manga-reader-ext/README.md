# 📖 Manga Reader v2.9 — Guardar capítulos, de a uno o varios seguidos

Guarda capítulos de manga como PDF, CBZ y/o imágenes sueltas, sin las páginas de publicidad, con nombre y carpetas automáticos.

## Instalación

1. `chrome://extensions/` → Modo desarrollador ON → **Cargar descomprimida** → elegir esta carpeta
2. Si venís de una versión anterior: antes de quitar la tarjeta vieja, exportá tus guardados (ver "Guardados" más abajo), porque al quitarla se borran. No hace falta recargar las pestañas con F5.

## Guardar un capítulo

1. Abrí el capítulo
2. `Alt+S`, la burbuja 💾, clic derecho → **Guardar capítulo**, o el ícono de la extensión
3. Revisá el nombre y dale a **Guardar** (`Enter`)

- El nombre se arma solo con el título de la página: serie, saga y número con ceros adelante para que ordenen bien, por ejemplo `One Piece/11 Saga Final/One Piece 1134`. Podés editarlo; cada `/` crea una carpeta.
- Al abrir el diálogo, la página se recorre sola hasta el final para que carguen todas las imágenes, y vuelve a donde estabas. Se apaga desde el ícono de la extensión.
- **Guardar y siguiente ▶** (`Ctrl+Enter`): guarda y abre el capítulo que sigue, con el diálogo ya listo. Para bajar varios mirando cada uno.
- `Esc` cierra.

## Descargar varios capítulos

Ícono de la extensión → **📦 Descargar varios capítulos** (también con clic derecho, o desde la **i** de la burbuja). Funciona en la página de un capítulo y en la portada o listado de la serie.

1. Escribí **Del … al …** y tocá **Marcar**, o tildá capítulos en la lista
2. Elegí los formatos
3. **Descargar**. El mismo botón después dice **Cancelar**

Cada capítulo se abre solo en una pestaña al lado, se guarda con el mismo filtro y los mismos nombres que a mano, y la pestaña se cierra. Dejá abierta la pestaña desde donde lo iniciaste.

- Los que ya guardaste figuran con **✔ guardado** y se saltean.
- Al final dice cuántos salieron y, de los que no, por qué. Un capítulo al que le faltó una página se guarda igual pero no queda anotado como guardado: volvé a pedirlo.
- Si 3 capítulos seguidos salen "sin páginas", el lote **para solo** en vez de seguir abriendo pestañas. Si pasó al principio, abrí **Dirección y nombre de los capítulos** y revisá que la dirección sea la de un capítulo, con `{n}` donde va el número. Si la dirección está bien, probá tildar **Abrir cada capítulo a la vista**.
- Si la dirección del capítulo termina en un archivo sin el número al final (`…-104-espanol.html`) y la página no tiene links a los capítulos, el diálogo avisa que no encontró los otros y deja la dirección vacía, en vez de inventar una.
- En sitios donde la dirección no lleva el número sino un código (MANGA Plus: `/viewer/2010289` es el capítulo 104), el diálogo lo avisa y deja la dirección vacía: no hay forma de adivinar la de los otros capítulos.

### Pegar los links de los capítulos

Si la lista no aparece sola, o ya tenés los links: en el mismo diálogo abrí **Pegar los links de los capítulos**.

1. Pegá los links como los tengas: uno por renglón o todos juntos. Lo que no sea un link (títulos, texto) se ignora, y pueden ser de cualquier sitio.
2. Tocá **Usar estos links**. Quedan en la lista, marcados y con su número:
   - el que escribas adelante (`12: link`),
   - o el que trae el propio link (`…-manga-07-espanol.html` es el 7),
   - o, si no lo traen, el orden en que los pegaste. Elegí "en el orden pegado" (o "al revés" si están del último al primero) y poné **desde** qué número.
3. Escribí el nombre en **Serie**: los archivos salen como `Serie/Serie 0007`.
4. **Descargar**.

Abajo del cuadro dice cuántos links tomó, qué números faltan en el medio y cuántos estaban repetidos.

## Burbuja flotante

En las páginas que parecen un capítulo aparece una burbuja 💾.

- **Clic**: abre "Guardar capítulo"
- **Arrastrar**: la movés a donde no moleste; recuerda la posición
- **i**: controles rápidos, **Descargar varios capítulos**, **No mostrar en este sitio** y **Ocultar burbuja en todos lados**
- Se vuelve a activar desde el ícono de la extensión

## Avisos

- **✔ Ya lo guardaste**: la extensión recuerda cada capítulo guardado completo y te avisa al abrir el diálogo, aunque le cambies el nombre.
- **⚠️ No se pudo bajar la página N**: esa miniatura queda con borde rojo. El archivo se guarda igual, pero no se anota como guardado.
- **⚠️ N páginas no cargaron**: imágenes del capítulo que el sitio no llegó a mostrar. El botón **Recorrer la página** lo intenta de nuevo.

## Filtro de publicidad

El diálogo muestra una miniatura por cada imagen encontrada. Las que no parecen del capítulo vienen destildadas y con la etiqueta **AD**:

- imágenes fuera de la carpeta donde está la mayoría de las páginas (logos, banners)
- imágenes que son un link a otro sitio
- GIF animados
- últimas páginas con un formato distinto al resto (créditos o avisos del scan)

Clic en una miniatura para incluirla o quitarla. Pasá el mouse por encima para ver el motivo.

## Formatos

- **PDF**: una página por imagen, con su tamaño original. JPG y PNG van sin recomprimir (sin pérdida); WebP se convierte a JPG de alta calidad. Marcado como lectura derecha → izquierda.
- **CBZ**: el formato de las apps de cómics. Lleva las imágenes originales numeradas `001`, `002`… y un `ComicInfo.xml` con serie, número, saga y sentido de lectura.
- **Imágenes**: las originales en una carpeta, como `pagina_001.jpg`…, con la extensión de su tipo real.

Los tres se pueden combinar: cada página se baja una sola vez. CBR no está disponible (es un RAR, formato propietario).

## Sitios de manga y cómics

Ícono de la extensión → **📚 Sitios de manga y cómics**: tu lista de accesos directos. La extensión no trae sitios cargados: la lista es la tuya.

**Para cargarla:** ⚙️ → **Mis sitios de manga y cómics** → **Pegar una lista** (o el botón **📋 Pegar mi lista de sitios** del popup).

- Pegá tu lista como la tengas, con una dirección por renglón: `Nombre: https://sitio.com — descripción`, la dirección sola, o sin `https://`. El nombre, la descripción, el tipo y el idioma se detectan solos.
- Un renglón sin dirección, como `Manga en español:`, vale de título: fija el tipo y el idioma de los renglones que siguen.
- Antes de agregar ves lo que detectó. La casilla **Se pueden descargar** decide si esa tanda va a Descargables o a Para leer. Los que ya tenías no se repiten.
- Abajo queda tu lista, con buscador, **Editar**, **Quitar** y **Quitar todos**.

**Para usarla:**

- **Dos secciones:** **📥 Descargables** y **👁 Para leer en el sitio**, cada una con su cantidad. Tocá el título de una para plegarla: plegando "Para leer" quedan solo los descargables. Se acuerda cómo las dejaste.
- **Filtros:** Tipo (Todos, Manga, Cómics), Idioma (Todos, Español, Inglés) y un buscador. Valen para las dos secciones.
- **Tocá el nombre** y se abre en una pestaña nueva.
- **Tocá la i** y ves el tipo, el idioma, en qué sección lo pusiste y la descripción.
- **＋ Agregar esta página a mis sitios** suma el sitio de la pestaña abierta, en Para leer.

## Guardados, sagas y opciones

Ícono de la extensión → **⚙️ Guardados, sagas, sitios y opciones**:

- **Capítulos guardados** por serie, con los que te faltan en el medio. **Exportar copia** baja el registro a un archivo y **Importar copia** lo recupera: usalo antes de cambiar de versión o de compu.
- **Sagas**: para que los capítulos de una serie se guarden en una carpeta por saga. Viene la de One Piece; las demás se cargan ahí, una por línea (`desde-hasta Nombre`).
- **Mis sitios de manga y cómics**: pegar tu lista entera, y agregar, editar y quitar de a uno.
- **Sitios donde la burbuja no aparece**.

El atajo se cambia en `chrome://extensions/shortcuts`. La referencia completa está en `DOCUMENTACION.md`.
