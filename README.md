# 📖 Manga Reader

Dos herramientas para guardar capítulos de manga y cómics como **PDF**, **CBZ** o **imágenes sueltas**, con nombre y carpetas automáticos y sin las páginas de publicidad:

| | Qué es | Versión | Dónde está |
|---|---|---|---|
| 🧩 **La extensión** | Se usa desde Chrome, sobre la página que tenés abierta | 2.10.0 | `manga-reader-ext(ver 22-11-2026-7)/manga-reader-ext` |
| 🖥 **El programa** | Aplicación de escritorio: pegás una dirección y explorás lo que hay | 0.6.0 | `programa/` |

Funcionan por separado y comparten el mismo código para detectar páginas, armar nombres y generar los archivos. Son de uso personal, están en español y todo corre en tu máquina, sin servidor.

Lo último que cambió está en [Actualizaciones](#actualizaciones).

---

# 🧩 La extensión

JavaScript plano (Manifest V3), sin dependencias ni compilación.

## Qué hace

| | |
|---|---|
| 💾 **Guardar el capítulo abierto** | Detecta las páginas, arma el nombre y lo guarda en el formato que elijas |
| 📦 **Descargar varios capítulos** | Un rango ("del 1 al 50"), los que tildes en la lista, o una lista de links pegada |
| 📚 **Tomos** | Si la página separa los capítulos en tomos o sagas, los muestra agrupados y se marca un tomo entero con un clic |
| 🧹 **Filtro de publicidad** | Deja afuera logos, banners, avisos y páginas de créditos; se corrige con un clic en las miniaturas |
| 🗂 **Nombre y carpetas automáticos** | `Serie/Saga/Serie 0012`, con ceros adelante para que ordenen bien. Se cambia con una plantilla (`{serie}/{volumen}/{serie} {numero}`) |
| ✔ **Registro de guardados** | Avisa lo que ya guardaste, lo saltea en los lotes y muestra los capítulos que te faltan |
| 🔖 **Tu lista de sitios** | Accesos directos a tus sitios, divididos en descargables y para leer, con filtros |

---

## Instalación

No está en la tienda de Chrome: se carga a mano.

1. Bajá el repositorio: **Code → Download ZIP** y descomprimilo, o `git clone`.
2. Abrí `chrome://extensions` y activá **Modo desarrollador** (arriba a la derecha).
3. Tocá **Cargar descomprimida** y elegí la carpeta de la versión más nueva:

   ```
   manga-reader-ext(ver 22-11-2026-6)/manga-reader-ext
   ```

4. Fijá el ícono de la extensión en la barra para tenerlo a mano.

Funciona en Chrome de escritorio y en navegadores basados en Chromium que acepten extensiones descomprimidas.

### Actualizar a una versión nueva

Cada versión vive en su propia carpeta, así que actualizar es cargar otra carpeta:

1. En la versión que tenés cargada: ícono → **⚙️ Guardados, sagas, sitios y opciones** → **Exportar copia**. Al quitar la extensión se borra su registro, y la copia lo conserva.
2. En `chrome://extensions`, quitá la tarjeta vieja y cargá la carpeta nueva con **Cargar descomprimida**.
3. En la versión nueva: ⚙️ → **Importar copia**.

No hace falta recargar las pestañas abiertas.

> **Ojo con el nombre de las carpetas:** la más nueva no siempre es la última por orden alfabético. `manga-reader-ext(ver 22-11-2026)`, sin sufijo, es una versión vieja (2.6) que no funciona. La versión de cada carpeta está en su `manifest.json`, y `node tests/ultima_version.js` dice cuál es la última.

---

## Cómo se usa

### Guardar un capítulo

1. Abrí el capítulo.
2. Apretá `Alt+S`, o la burbuja 💾, o clic derecho → **Guardar capítulo**, o el ícono de la extensión.
3. Revisá el nombre y las miniaturas, y tocá **Guardar** (`Enter`).

- **El nombre se arma solo** con el título de la página: serie, saga y número. Se puede editar; cada `/` crea una carpeta.
- **La página se recorre sola** hasta el final para que carguen todas las imágenes, y vuelve a donde estabas.
- **Las miniaturas** muestran cada imagen encontrada. Las que parecen publicidad vienen destildadas con la etiqueta **AD**. Un clic incluye o quita cualquiera.
- **Guardar y siguiente ▶** (`Ctrl+Enter`) guarda y abre el capítulo que sigue, con el diálogo ya listo.
- Los archivos van a `Descargas/MangaReader/…`.

### Descargar varios capítulos

Ícono de la extensión → **📦 Descargar varios capítulos**. Funciona desde la página de un capítulo y desde la portada o el listado de la serie.

1. Escribí **Del … al …** y tocá **Marcar**, o tildá capítulos en la lista.
2. Elegí los formatos.
3. Tocá **Descargar**. El mismo botón después dice **Cancelar**.

Cada capítulo se abre solo en una pestaña al lado, se guarda con el mismo filtro y los mismos nombres que a mano, y la pestaña se cierra. Dejá abierta la pestaña desde donde lo iniciaste.

- **De dónde sale la lista:** de los links de la página, de un desplegable de capítulos, o de la dirección del capítulo si lleva el número al final.
- **Los ya guardados** figuran con ✔ y se saltean.
- **Al terminar** dice cuántos salieron y, de los que no, por qué.
- **Si 3 seguidos no tienen páginas**, el lote para solo en vez de seguir abriendo pestañas.
- **Tomos:** si la página separa los capítulos con títulos ("Tomo 3", "Volumen 2", "Saga de…"), arriba de la lista aparece la pestaña **Tomos**, con un renglón por tomo. Tildar uno marca todos sus capítulos.

### Pegar los links de los capítulos

Para cuando la lista no aparece sola, o ya tenés los links. En el mismo diálogo, abrí **Pegar los links de los capítulos**.

1. Pegá los links como los tengas: uno por renglón o todos juntos. Lo que no sea un link (títulos, texto suelto) se ignora.
2. Tocá **Usar estos links**. Quedan en la lista, marcados, cada uno con su número:
   - el que escribas adelante (`12: link`),
   - o el que trae el propio link (`…-manga-07-espanol.html` es el 7),
   - o, si no lo traen, el orden en que los pegaste, desde el número que elijas. También al revés, para listas que van del último al primero.
3. Escribí el nombre en **Serie**: los archivos salen como `Serie/Serie 0007`.
4. Tocá **Descargar**.

Abajo del cuadro dice cuántos links tomó, qué números faltan en el medio y cuántos estaban repetidos.

### Formatos

| Formato | Qué guarda |
|---|---|
| **PDF** | Una página por imagen, en su tamaño original. JPG y PNG van sin recomprimir; WebP se convierte a JPG de alta calidad. Marcado para leer de derecha a izquierda |
| **CBZ** | El formato de las apps de cómics: las imágenes originales numeradas y un `ComicInfo.xml` con serie, número y saga |
| **Imágenes** | Las originales en una carpeta, como `pagina_001.jpg`, con la extensión de su tipo real |

Los tres se pueden combinar: cada página se baja una sola vez.

### Burbuja flotante

En las páginas que parecen un capítulo aparece una burbuja 💾.

- **Clic:** abre "Guardar capítulo".
- **Arrastrar:** la movés a donde no moleste, y recuerda la posición.
- **i:** accesos rápidos, **No mostrar en este sitio** y **Ocultar en todos lados**.

### Tu lista de sitios

Ícono de la extensión → **📚 Sitios de manga y cómics**. La extensión no trae sitios cargados: la lista es la tuya.

- **Para cargarla:** ⚙️ → **Mis sitios de manga y cómics** → **Pegar una lista**. Se pega el texto como venga, con una dirección por renglón, y se detectan solos el nombre, la descripción, el tipo y el idioma.
- **Dos secciones:** 📥 Descargables y 👁 Para leer en el sitio, que se pliegan tocando el título.
- **Filtros** por tipo (manga, cómics) e idioma, y un buscador.
- **Tocar el nombre** abre el sitio en una pestaña nueva. La **i** muestra qué tiene.

### Guardados, sagas y opciones

Ícono de la extensión → **⚙️ Guardados, sagas, sitios y opciones**.

- **Capítulos guardados** por serie, con los que te faltan en el medio. **Exportar copia** e **Importar copia** para no perder el registro.
- **Sagas:** para que los capítulos de una serie se guarden en una carpeta por saga. Se cargan una por línea (`desde-hasta Nombre`).
- **Mis sitios:** pegar la lista, y agregar, editar o quitar de a uno.
- **Sitios donde la burbuja no aparece.**
- **Cómo se guardan los archivos:** la plantilla del nombre y las carpetas.

### Plantilla de nombres

Por defecto los archivos salen como `Serie/Saga/Serie 0012`. En opciones → **Cómo se guardan los archivos** se puede escribir otra plantilla: una `/` crea una carpeta y lo que va entre llaves se reemplaza por el dato de cada capítulo.

| Marcador | Qué pone |
|---|---|
| `{serie}` | El nombre de la serie |
| `{numero}` | El número del capítulo, con 4 cifras (`0005`) |
| `{saga}` | La saga, si la serie las tiene cargadas |
| `{volumen}` | El tomo del capítulo. Solo al bajar varios desde una página que los separa en tomos |
| `{titulo}` | El nombre del capítulo en la lista. Solo al bajar varios |
| `{anio}` | El año en que lo guardás |
| `{sitio}` | El sitio de donde sale |

- **Hay cuatro armadas:** Predeterminada, Sin sagas, Por tomo (`{serie}/{volumen}/{serie} {numero}`) y Por año.
- **Vista previa:** debajo del campo se ve cómo quedaría un capítulo bajado en un lote y uno guardado de a uno.
- **Un dato vacío no deja rastro:** ni la carpeta, ni el guion que lo separaba.
- **Avisa** si faltan `{numero}` y `{titulo}` (todos los capítulos se llamarían igual) o si un marcador no existe.

El atajo `Alt+S` se cambia en `chrome://extensions/shortcuts`.

---

## Qué no hace

- **No guarda páginas protegidas.** Si un sitio entrega las páginas cifradas y su lector las arma en el momento, la extensión no las guarda: dice que no encontró páginas.
- **No adivina direcciones.** Si la dirección de un capítulo no lleva su número y la página no tiene links a los capítulos, el diálogo lo explica en vez de inventar una. Para eso está pegar los links.
- **No lee dentro de iframes** ni imágenes puestas como fondo.
- **No mira el disco:** si borrás un archivo a mano, el registro sigue diciendo que lo guardaste hasta que lo quites en opciones.

Usala con contenido que tengas derecho a guardar.

---

# 🖥 El programa

Aplicación de escritorio para Windows, hecha con Electron y JavaScript plano. Hace lo mismo que la extensión sin depender del navegador, y suma un explorador: pegás una dirección y te muestra por niveles lo que hay ahí.

## Qué hace

| | |
|---|---|
| 🔎 **Explorar por niveles** | De una página saca sus listas de links: títulos, capítulos numerados y en orden, y páginas. La flecha › de cada renglón baja un nivel |
| 🗃 **Encontrar el catálogo** | Si pegás la portada de un sitio y tiene un link a su listado completo ("Directorio", "Biblioteca"), entra solo. Una portada llena de tapas no la confunde con un capítulo |
| 🖼 **Tapas** | Si la página muestra la tapa de cada título, la lista se ve como un mosaico de tapas. Un botón vuelve a la lista de renglones |
| 📑 **Listados largos** | Baja hasta el final para ver lo que la página carga de a poco. "Traer más páginas" suma las 10 siguientes y "Traer todas" sigue hasta el final |
| 📚 **Volúmenes y sagas** | Si la página separa los capítulos en volúmenes o sagas, aparecen agrupados y se tilda el grupo entero |
| 🧹 **Revisar páginas** | En un capítulo, muestra todas sus imágenes con lo que tomó por publicidad apagado y el motivo. Un toque pone o saca cada una |
| ✔ **Lo que ya tenés** | Marca en la lista los capítulos que ya están en la carpeta, dice cuáles faltan y los tilda. Los reconoce aunque estén con otro nombre |
| 📦 **Cola de descargas** | Baja de a un capítulo y muestra en qué anda cada uno. Se cancela, y se reintenta todo lo que falló. Avisa al terminar y muestra el avance en la barra de tareas |
| 📁 **Carpeta a elección** | Guarda donde quieras, y saltea lo que ya está mirando el disco |
| 🗂 **Nombres y sagas** | `Serie/Saga/Serie 0012` por defecto. Se cambia con una plantilla (`{serie}/{volumen}/{serie} {numero} - {titulo}`) y se cargan sagas propias |
| 🔗 **Pegar links** | Igual que en la extensión: una lista de links con el número de cada uno |
| ⭐ **Favoritos** | Tu lista de sitios, catálogos y series: pegás un link o muchos y quedan guardados; cada uno se analiza con un clic. Se filtran por tipo e idioma |
| 🕘 **Recientes** | Las últimas direcciones que analizaste a mano, a un toque |
| 📄 **Mismos formatos** | PDF, CBZ e imágenes, armados con el mismo código que la extensión |

## Cómo abrirlo

**Con el instalador.** Hace falta [Node.js](https://nodejs.org) 22 o más nuevo para armarlo una vez:

```bash
cd programa
npm install            # una sola vez
npm run instalador     # arma dist/Manga-Reader-Instalador-<versión>.exe
```

Ese `.exe` se instala como cualquier programa y deja su acceso directo. No está firmado: la primera vez Windows puede mostrar "Windows protegió su PC"; se sigue con **Más información → Ejecutar de todas formas**.

**Desde el código**, sin instalar: `npm start` en la carpeta `programa`.

De las dos formas usa los mismos datos (favoritos, opciones y sagas).

## Cómo se usa

1. Pegá una dirección arriba y tocá **Analizar**. Puede ser la portada de un sitio, un catálogo, una serie o un capítulo.
2. Elegí una pestaña: **Capítulos** o **Títulos y links**. Con la flecha **›** (o tocando una tapa) entrás a cualquier renglón, y la ruta de arriba sirve para volver.
3. Si el listado sigue en más páginas, tocá **Traer más páginas** o **Traer todas**.
4. Tildá lo que querés, elegí formatos y carpeta a la derecha, y tocá **Descargar**.

Al entrar a un título, su nombre queda puesto como **Serie** y la lista marca con **✔ ya está** los capítulos que ya tenés en la carpeta. **Marcar los que faltan** tilda el resto.

En la página de un capítulo, **Revisar páginas** muestra todas sus imágenes antes de bajarlo:

- Las que van tienen borde verde y su número; las que tomó por publicidad están apagadas, con el motivo.
- Un toque sobre una imagen la pone o la saca.
- **Descargar N páginas** baja exactamente las elegidas.

Para no pegar siempre las mismas direcciones está **⭐ Favoritos**. Al abrirlo aparecen el cuadro para pegar y, debajo, tu lista:

- **Pegá un link o muchos** en el cuadro y quedan guardados en el momento, todos juntos. Uno por renglón y escritos como los tengas (`Nombre: https://sitio.com/ — nota`), igual que "Mis sitios" en la extensión. También sirve el archivo de sitios que exporta la extensión.
- **＋ La dirección de arriba** guarda la que estás mirando.
- **Tocar un favorito** lo analiza. Se puede buscar, filtrar por tipo e idioma, y quitar de a uno o todos.

Lo que todavía le falta y cómo está armado: [programa/README.md](programa/README.md).

---

# Actualizaciones

Lo más nuevo arriba. El historial completo de la extensión está en la sección 15 de [DOCUMENTACION.md](DOCUMENTACION.md).

### 22-11-2026 · Programa 0.6.0

- **Revisar páginas:** en un capítulo se ven todas sus imágenes, con lo que el filtro tomó por publicidad apagado y el motivo. Un toque pone o saca cada una, y se bajan exactamente las elegidas. La cola dice cuántas descartó el filtro en cada capítulo.
- **Lo que ya tenés y lo que te falta:** la lista de capítulos marca los que ya están en la carpeta, dice cuáles faltan y los tilda. Se fija en el número y no en el nombre exacto, así que reconoce lo guardado con otro nombre o en una carpeta que se llama casi igual, y al descargar no lo duplica.
- **La serie se completa sola** al entrar a un título, para que todos sus capítulos vayan a la misma carpeta.
- **Plantilla de nombres y sagas propias**, como en la extensión. El tomo y el nombre de cada capítulo de la lista se pueden usar en el nombre del archivo.
- **Reintentar lo que falló:** vuelve a la cola todo lo que falló, quedó incompleto o se canceló.
- **Traer todas** las páginas de un listado, hasta el final (para a las 50, con una pausa entre cada una).
- **Favoritos con filtros** por tipo e idioma, y cada uno muestra los suyos.
- **Direcciones recientes:** las últimas que se analizaron a mano.
- **Aviso al terminar la cola** y avance en el ícono de la barra de tareas.
- **Instalador de Windows:** `npm run instalador` arma el `.exe`. Usa los mismos datos que `npm start`.

### 22-11-2026 · Programa 0.5.0

- **Tapas:** cuando la página pone una imagen junto a sus títulos, la lista se muestra como un mosaico, con la tapa de cada uno. Tocar una tapa entra a ese título y la casilla de la esquina lo tilda. El botón 🖼 Tapas vuelve a la lista de renglones y se recuerda.
- Las miniaturas se piden a medida que quedan a la vista, con la misma sesión y el mismo Referer que las páginas, y no se guardan en el disco.

### 22-11-2026 · Programa 0.4.0

- **Una portada llena de tapas ya no pasa por capítulo.** Antes, al pegar la portada de un sitio con muchas tapas, el programa ofrecía "Descargar este capítulo" y no buscaba el catálogo. Ahora reconoce las tapas (imágenes que llevan cada una a la página de su serie), muestra los títulos y entra al listado completo.
- **Encuentra mejor el listado completo:** también cuando el link tiene un ícono pegado al texto, cuando no tiene texto, o cuando lo dice su dirección (`/biblioteca`, `/directorio`, `/library`, `/series`…). El acceso "¿Buscás el listado completo?" ahora se muestra en cualquier página.
- **"Guardados" pasa a llamarse Favoritos.** Al abrirlo, el cuadro para pegar ya está a la vista: se pega un link o muchos y quedan guardados en el momento, sin más pasos.

### 22-11-2026 · Programa 0.3.0

- **Links guardados:** el botón ⭐ Guardados abre tu lista de sitios, catálogos y series. Se carga de a un link ("Guardar esta dirección") o pegando una lista entera, que se lee igual que "Mis sitios" en la extensión. Tocar un link lo analiza; se puede buscar, quitar de a uno o todos.
- La lista queda en tu máquina (`links.json`, en la carpeta de datos del programa) y los repetidos no entran.

### 22-11-2026 · Extensión 2.10.0

- **Pestaña "Tomos"** en el diálogo de varios capítulos: cuando la página separa los capítulos con títulos ("Tomo 3", "Volumen 2", "Saga de…"), los muestra agrupados, con el rango de cada tomo, y un tomo entero se marca con un clic. Los que no están en ningún tomo van a "Sin volumen".
- **Plantilla de nombres** en opciones → "Cómo se guardan los archivos": marcadores `{serie} {saga} {volumen} {numero} {titulo} {anio} {sitio}`, cuatro plantillas armadas, vista previa y avisos. La predeterminada sigue siendo `Serie/Saga/Serie 0012`.
- El diálogo muestra un **ejemplo** de cómo va a quedar guardado el primer capítulo marcado.
- **Revisión antes de subirla**, con estos arreglos sobre la primera versión de la 2.10.0:
  - Tildar un tomo no marcaba nada: trabajaba sobre copias de los capítulos.
  - La pestaña no aparecía nunca: la lista de capítulos no traía el título que cada uno tiene encima.
  - `{volumen}` y `{titulo}` no llegaban al guardar (se perdían en el camino a la pestaña del capítulo).
  - En una pestaña abierta antes de actualizar, el diálogo de varios capítulos se rompía: no se inyectaba el archivo nuevo.
  - La vista previa de opciones usaba otro código que el guardado. Ahora es el mismo (`plantilla.js`).
  - Con una plantilla propia, la página de guardados agrupaba mal las series. Ahora cada capítulo queda anotado con su serie y su número.

### 22-11-2026 · Programa 0.2.0

- **Encuentra el catálogo:** desde la portada de un sitio, entra solo al listado completo cuando la página lo enlaza, y lo ofrece como acceso rápido en las demás.
- **Listados que cargan al bajar:** recorre la página hasta el final antes de leer los links.
- **Traer más páginas:** sigue la paginación de un listado, de a 10 páginas, y suma los títulos sin repetir.

### 22-11-2026 · Programa 0.1.0, primera versión

- Explorador por niveles: títulos, capítulos y páginas, con volúmenes y sagas cuando la página los separa.
- Descarga a PDF, CBZ e imágenes en la carpeta elegida, con cola y cancelar.
- Pegar links, saltear lo que ya está en el disco, y pedido de imágenes con el Referer del capítulo.

### 22-11-2026 · Extensión 2.9.1

- Se saca el aviso de páginas protegidas. Esas páginas siguen sin guardarse: el diálogo dice que no encontró páginas.

### 22-11-2026 · Extensión 2.9.0

- **Pegar los links de los capítulos** en el diálogo de varios capítulos, con el número de cada uno: el escrito adelante, el del propio link o el orden en que se pegaron.

### 22-11-2026 · Extensión 2.8.5 a 2.8.7

- La lista de sitios pasa a ser la del usuario, y se carga pegándola entera.
- El archivo por mes de un sitio ("enero 2021") ya no se toma como capítulos.
- No se inventan direcciones cuando la página del capítulo termina en un archivo.

---

# El repositorio

## Qué hay en el repositorio

| Carpeta o archivo | Qué es |
|---|---|
| `manga-reader-ext(ver DD-MM-AAAA)/manga-reader-ext/` | Una carpeta por versión, lista para cargar en Chrome. Cada una trae su `README.md` y su `DOCUMENTACION.md` |
| `DOCUMENTACION.md` | La referencia completa de la última versión: arquitectura, mensajes, formatos, constantes, limitaciones, solución de problemas e historial |
| `programa/` | El programa de escritorio (Electron). Tiene su propio `README.md` y sus pruebas |
| `tests/` | Las pruebas |
| `reports/`, `research_notes/` | Un estudio de sitios legítimos de manga y cómics y sus fuentes |

Dentro de cada versión:

| Archivo | Rol |
|---|---|
| `manifest.json` | Permisos, atajo y scripts |
| `content.js` | Detección de páginas, filtro, nombres, lista de capítulos, diálogos y burbuja |
| `background.js` | Service worker: menú, atajo, descargas y lotes |
| `offscreen.js` | Baja las páginas y arma PDF, CBZ e imágenes, sin librerías |
| `popup.*`, `opciones.*` | El menú del ícono y la página de guardados, sagas, sitios y opciones |
| `sagas.js`, `sitios.js` | Sagas incluidas y funciones de la lista de sitios |
| `agrupar.js`, `plantilla.js` | Agrupado de capítulos por tomo y plantilla de nombres. Los dos se comparten con el programa |

---

## Pruebas

No hacen falta dependencias: alcanza con Node 22 o más nuevo.

```bash
bash tests/correr.sh        # sintaxis y pruebas en Node contra la última versión
node tests/e2e.js           # navegador real, sobre sitios de prueba servidos en la máquina
node tests/lote_largo.js    # un lote de decenas de capítulos seguidos
```

- El programa tiene las suyas: `cd programa` y `npm run prueba`.
- Las pruebas en navegador necesitan el Chromium de Playwright (`%LOCALAPPDATA%\ms-playwright\chromium-*`) o el de la variable `CHROMIUM`. El Chrome común ya no acepta cargar extensiones por línea de comandos.
- `node tests/probar_sitio.js "<dirección>"` informa qué detecta la extensión en una página, sin dejar archivos.
- Todas las descargas de las pruebas van a una carpeta temporal que se borra al terminar.

## Cómo se cambia algo

Las versiones no se editan: se copia la última carpeta a una nueva con la fecha del día, se sube `version` en `manifest.json` y se trabaja ahí. Con cada versión se actualiza su `DOCUMENTACION.md` y se copia a la raíz. El detalle está en la sección 13 de [DOCUMENTACION.md](DOCUMENTACION.md).
