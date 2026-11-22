# 📖 Manga Reader v2.8.2 — Guardar capítulos, de a uno o varios seguidos

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
- En sitios donde la dirección no lleva el número sino un código (MANGA Plus: `/viewer/2010289` es el capítulo 104), el diálogo lo avisa y deja la dirección vacía: no hay forma de adivinar la de los otros capítulos.

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
- **🔒 Este sitio protege las páginas del capítulo**: el lector las muestra cifradas o dibujadas aparte (por ejemplo, MANGA Plus). La extensión no las guarda; lo que queda a la vista son logos y banners, y vienen destildados.

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

Ícono de la extensión → **📚 Sitios de manga y cómics**: accesos directos a 23 plataformas legítimas donde los capítulos se leen en el mismo sitio, con las series completas y al día (MANGA Plus, MANGA MILLION, WEBTOON, Manga UP!, Lezhin, Manta, GlobalComix, Marvel, Panel Syndicate y más). No hay tiendas, préstamos de biblioteca ni archivos de números sueltos.

- **Tocá el nombre** y se abre en una pestaña nueva.
- **Tocá la i** y ves qué tiene: si es manga o cómics, en qué idioma, si es gratis, si se puede guardar y una descripción.
- Cada fila ya muestra el tipo (MANGA, MANHWA, WEBTOON, CÓMICS…) y los idiomas (ES, EN).
- Filtros: Manga o Cómics, "En español", "Se pueden guardar", y un buscador.
- El ícono de cada fila dice si se puede guardar: ✅ con la extensión, 📥 el sitio da su propia descarga, 👁 solo para leer, ❔ sin verificar. Casi todos son para leer.
- **Tus sitios:** con **＋ Agregar esta página a mis sitios**, o en opciones, donde también los editás. Aparecen primero, marcados TUYO.

## Guardados, sagas y opciones

Ícono de la extensión → **⚙️ Guardados, sagas, sitios y opciones**:

- **Capítulos guardados** por serie, con los que te faltan en el medio. **Exportar copia** baja el registro a un archivo y **Importar copia** lo recupera: usalo antes de cambiar de versión o de compu.
- **Sagas**: para que los capítulos de una serie se guarden en una carpeta por saga. Viene la de One Piece; las demás se cargan ahí, una por línea (`desde-hasta Nombre`).
- **Mis sitios de manga y cómics**: agregar, editar y quitar los tuyos.
- **Sitios donde la burbuja no aparece**.

El atajo se cambia en `chrome://extensions/shortcuts`. La referencia completa está en `DOCUMENTACION.md`.
