# 📖 Manga Reader v2.11 — Guardar capítulos, de a uno o varios seguidos

Guarda capítulos de manga como PDF, CBZ y/o imágenes sueltas, sin las páginas de publicidad, con nombre y carpetas automáticos.

## Instalación

1. `chrome://extensions/` → Modo desarrollador ON → **Cargar descomprimida** → elegir esta carpeta
2. Si venís de una versión anterior: antes de quitar la tarjeta vieja, exportá tus guardados (ver "Guardados" más abajo), porque al quitarla se borran. No hace falta recargar las pestañas con F5.
3. La 2.11 pide un permiso más, el de mostrar notificaciones: es para avisarte cuando termina un lote.

## Guardar un capítulo

1. Abrí el capítulo
2. `Alt+S`, la burbuja 💾, clic derecho → **Guardar capítulo**, o el ícono de la extensión
3. Revisá el nombre y dale a **Guardar** (`Enter`)

- El nombre se arma solo con el título de la página: serie, saga y número con ceros adelante para que ordenen bien, por ejemplo `One Piece/11 Saga Final/One Piece 1134`. Podés editarlo; cada `/` crea una carpeta. Si querés otro armado para todos, cambiá la plantilla en opciones (ver "Cómo se guardan los archivos").
- Al abrir el diálogo, la página se recorre sola hasta el final para que carguen todas las imágenes, y vuelve a donde estabas. Se apaga desde el ícono de la extensión.
- **Guardar y siguiente ▶** (`Ctrl+Enter`): guarda y abre el capítulo que sigue, con el diálogo ya listo. Para bajar varios mirando cada uno.
- `Esc` cierra.
- El diálogo y la burbuja no dependen del estilo del sitio: aunque la página esconda los botones o desarme todo lo que no es suyo, se ven y andan igual. Si el sitio los saca de la página, vuelven a aparecer como estaban.

### El orden de las páginas

Las miniaturas salen en el orden en que están en el sitio, que no siempre es el de lectura. El orden en que las dejes es el del PDF, el del CBZ y el de la numeración de las imágenes sueltas.

- **Arrastrá** una miniatura para cambiarla de lugar, o usá las flechitas **▲▼** que aparecen al pasar por encima.
- **⇅ Invertir** da vuelta todo el capítulo.
- **Ordenar por número** las acomoda por el número que trae el nombre de cada imagen (`007.jpg` va antes que `010.jpg`).

### Con el teclado

Los dos diálogos se pueden usar sin mouse, y un lector de pantalla los anuncia como diálogos.

- `Tab` recorre los controles sin salirse del diálogo.
- Con el foco en una miniatura: las **flechas** pasan a la de al lado, `Inicio` y `Fin` van a la primera y a la última, la **barra espaciadora** la incluye o la quita, y `Alt` + flecha izquierda o derecha la cambia de lugar.
- Al cerrar con `Esc`, el foco vuelve a donde estaba en la página.

### Lectores en un iframe

Hay sitios que ponen las páginas en un marco aparte (un iframe), a veces de otro sitio. La extensión mira la página y todos sus marcos: la burbuja y el diálogo aparecen en el que tiene las páginas, y el nombre del capítulo sale igual del título de la página. Si las mismas imágenes están en la página y en el marco, se cuentan una sola vez.

- Desde un marco no se ofrece **Guardar y siguiente**.

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

### La cola: reanudar y reintentar

Lo que pide un lote y cómo le fue a cada capítulo queda guardado, no en la memoria de la pestaña. Si cerrás la pestaña, cancelás o algo falla, no se pierde qué faltaba.

- Al abrir de nuevo el diálogo en ese sitio, arriba aparece **Reanudar (N)** con lo que quedó sin bajar.
- Si al terminar hubo fallas: **Reintentar los N que fallaron** y **Descartar la cola**. Cada capítulo que falla guarda su motivo, y el lote sigue con los demás.
- Cuando sale todo, la cola se borra sola.

### Avance y aviso al terminar

- El ícono de la extensión muestra cuántos capítulos van (`12/40`). Al terminar queda verde, o rojo si alguno falló; se limpia al cerrar el diálogo.
- Al terminar llega una notificación con el resumen y dos botones: **Reintentar los que fallaron** y **Mostrar la carpeta**. Si cancelás vos, no avisa.

### Ritmo de las descargas

En ⚙️ → **Ritmo de las descargas** elegís la pausa entre capítulos (0 a 10 segundos; 1,5 si no tocás nada), un descanso más largo cada tantos capítulos, y cuántas imágenes se miden a la vez (2 a 8).

- Si el sitio responde "esperá" (error 429) o "ahora no" (error 503) en una página, la extensión espera lo que el sitio pida y la reintenta sola, hasta 3 veces.
- Si aun así no la entrega, o responde eso con el capítulo entero, el lote frena lo que el sitio pidió y reintenta ese capítulo una vez. Si vuelve a fallar queda marcado con **el sitio pidió esperar**: bajá el ritmo y usá **Reintentar**. Da igual que lo haya pedido la página del capítulo o sus imágenes (desde la 2.11.1).
- Cuánto frena (desde la 2.11.2): lo que diga el sitio ("esperá 12 s" son 12 s), con un tope de un minuto aunque pida más. Si no dice cuánto, o dice algo que no se entiende, un minuto. Mientras tanto se ve la cuenta regresiva ("sigo en 12 s"), y el capítulo que sigue también espera: a ese sitio no se le pide nada antes de tiempo. Para leer lo que dice el sitio la extensión pide un permiso más, `webRequest`; Chrome no muestra ningún aviso nuevo al cargarla.
- En un lote, un capítulo al que el sitio le negó páginas así **no se guarda a medias**: queda para reintentar y, cuando sale, sale entero y con su nombre. Guardando de a uno sí se guarda lo que bajó, y el aviso dice que el sitio pidió esperar.

### Cuánto va a ocupar

Cada capítulo guardado anota cuánto pesó. Con eso, antes de bajar un lote el diálogo dice más o menos cuánto va a ocupar, y avisa si pasa de 200 MB. Sin nada guardado de ese sitio todavía, no dice nada.

### Tomos

Si la página de la serie separa los capítulos con títulos ("Tomo 3", "Volumen 2", "Saga de…"), arriba de la lista aparecen dos pestañas: **Capítulos** y **Tomos**.

- En **Tomos** hay un renglón por tomo, con su nombre, de qué capítulo a cuál va y cuántos son. Los capítulos sin tomo van juntos en "Sin volumen".
- **Tildar un tomo** marca todos sus capítulos. Si solo algunos están marcados, la casilla queda a medias.
- Las dos pestañas muestran lo mismo: podés tildar un tomo y después, en Capítulos, sacar uno suelto.
- Para que cada tomo quede en su carpeta, usá la plantilla "Por tomo" (ver "Cómo se guardan los archivos").

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

- Los links de capítulos que **ya tenías guardados** no entran, y dice cuántos descartó. Si los querés bajar de nuevo, destildá **Saltear los que ya guardé** antes de tocar **Usar estos links**.
- **Ordenar por número** e **⇅ Invertir**, arriba de la lista: el orden de la lista es el orden en que se bajan (invertida, empieza por el último).

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

## Adaptadores por sitio

Para los sitios donde el filtro no acierta (toma tapas de otras series, o deja páginas afuera) le podés decir dónde están las páginas. ⚙️ → **Adaptadores por sitio**:

| Campo | Qué va |
|---|---|
| Sitio | `sitio.com`, o cualquier dirección suya |
| Contenedor | El bloque que tiene las páginas, como selector CSS (`#visor`) |
| Imágenes | Cuáles son las páginas (`img.pagina`). Con el contenedor solo, son todas las imágenes de adentro |
| Ignorar | Lo que hay que dejar afuera aunque coincida, separado por comas (`.aviso, .recomendados img`) |
| Dirección de los capítulos | Con `{n}` donde va el número: queda puesta al abrir **Descargar varios capítulos** en ese sitio |

- Con un adaptador, en ese sitio las páginas se buscan ahí y solo ahí: no se filtra nada más. Desde la 2.11.1 tampoco se mira el tamaño ni la cantidad: entran las tiras angostas de un webtoon, las páginas repartidas en carpetas distintas y los capítulos de una o dos páginas. Si adentro del bloque hay algo que no es una página, sacalo con **Ignorar**.
- **Probar en esta página** cuenta lo que encuentra en la pestaña de ese sitio que tengas abierta y muestra las primeras 3 direcciones, sin guardar nada.
- Un selector mal escrito se avisa ahí mismo y no se guarda. En la página no rompe nada: sigue el filtro de siempre, y el diálogo de guardar avisa que el adaptador no se pudo usar.

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

- **Capítulos guardados** por serie, con los que te faltan en el medio. **Exportar copia** baja el registro a un archivo y **Importar copia** lo recupera: usalo antes de cambiar de versión o de compu. **Exportar CSV** baja solo el registro, como planilla, con las mismas columnas de la tabla.
- **Sagas**: para que los capítulos de una serie se guarden en una carpeta por saga. Viene la de One Piece; las demás se cargan ahí, una por línea (`desde-hasta Nombre`).
- **Mis sitios de manga y cómics**: pegar tu lista entera, y agregar, editar y quitar de a uno.
- **Sitios donde la burbuja no aparece**.
- **Cómo se guardan los archivos**: la plantilla del nombre y las carpetas, y la carpeta de las descargas (abajo).
- **Ritmo de las descargas** y **Adaptadores por sitio** (más arriba).

### Versión nueva

La extensión no se actualiza sola. Una vez por día, al abrir el ícono, mira qué versión hay en el repositorio; si hay una más nueva aparece un punto naranja con el número. Tocándolo se abre el repositorio.

### Cómo se guardan los archivos

Por defecto, `Serie/Saga/Serie 0012`. En opciones podés escribir otra plantilla: una `/` crea una carpeta y lo que va entre llaves se reemplaza por el dato de cada capítulo.

| Marcador | Qué pone |
|---|---|
| `{serie}` | El nombre de la serie |
| `{numero}` | El número del capítulo, con 4 cifras (`0005`) |
| `{saga}` | La saga, si la serie las tiene cargadas |
| `{volumen}` | El tomo del capítulo. Solo al bajar varios desde una página que los separa en tomos |
| `{titulo}` | El nombre del capítulo en la lista. Solo al bajar varios |
| `{anio}` | El año en que lo guardás |
| `{sitio}` | El sitio de donde sale |

- Hay cuatro armadas: **Predeterminada**, **Sin sagas**, **Por tomo** (`{serie}/{volumen}/{serie} {numero}`) y **Por año**.
- Debajo se ve cómo quedaría un capítulo bajado en un lote y uno guardado de a uno.
- Si un dato está vacío no queda nada en su lugar: ni la carpeta, ni el guion que lo separaba.
- Dejá `{numero}` en el nombre: sin él, todos los capítulos de una serie se llamarían igual.

### Carpeta de las descargas

Todo se guarda adentro de una carpeta de Descargas: `MangaReader`, si no elegís otra. En la misma sección de opciones podés cambiarla, y puede llevar `{sitio}`, `{serie}` y `{anio}`, con `/` para subcarpetas. Por ejemplo, `Manga/{sitio}` deja todo en `Descargas/Manga/sitio.com/…`.

- Debajo del campo se ve cómo quedaría, y los dos diálogos muestran la carpeta real antes de guardar.
- Tiene que quedar adentro de Descargas (Chrome no deja guardar en otro lado): no acepta `..`, ni una ruta completa como `C:\Manga`. Si igual llega mal escrita desde una copia importada, se guarda en `MangaReader` en vez de fallar.

El atajo se cambia en `chrome://extensions/shortcuts`. La referencia completa está en `DOCUMENTACION.md`.
