# 📖 Manga Reader

Dos herramientas para guardar capítulos de manga y cómics como **PDF**, **CBZ** o **imágenes sueltas**, con nombre y carpetas automáticos y sin las páginas de publicidad:

| | Qué es | Versión | Dónde está |
|---|---|---|---|
| 🧩 **La extensión** | Se usa desde Chrome, sobre la página que tenés abierta | 2.11.4 | `manga-reader-ext(ver 24-11-2026-3)/manga-reader-ext` |
| 🖥 **El programa** | Aplicación de escritorio: pegás una dirección y explorás lo que hay | 0.10.4 | `programa/` |

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
| 🔀 **Orden de las páginas** | Las miniaturas se arrastran o se mueven con ▲▼, se invierten o se ordenan por número: ese orden es el del PDF y el del CBZ |
| 🧭 **Adaptadores por sitio** | Donde el filtro no acierta, le decís con selectores CSS dónde están las páginas, y lo probás antes de guardarlo |
| 🪟 **Lectores en un iframe** | Encuentra las páginas aunque estén en un marco aparte, incluso de otro sitio |
| 🎨 **Páginas dibujadas de fondo** | Lectores que no usan `<img>` y pintan cada página como fondo (CSS, `image-set()`, SVG): toma las de una misma serie, en orden, y lo dice ("páginas dibujadas de fondo"). Las tapas de otras cosas alrededor no se ofrecen como si fueran el capítulo |
| ⏯ **Cola del lote** | Queda guardada: si se corta o algo falla, se reanuda o se reintenta. El ícono muestra el avance y al terminar llega una notificación, con botones para reintentar lo que falló (por el mismo camino que el botón del diálogo) y abrir la carpeta |
| 🐢 **Ritmo** | Pausa entre capítulos, descansos y espera automática cuando el sitio responde "esperá" (429 o 503), con la página de un capítulo o con sus imágenes (también las que carga la página: el capítulo no se guarda a medias): lo que el sitio pida (con tope de un minuto), o un minuto si no dice cuánto. Es la misma regla que usa el programa |
| ⌨️ **Teclado** | Los diálogos se usan sin mouse: Tab, flechas entre las miniaturas, espacio para incluir o quitar |
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
- **Un lector de fondo tiene que parecerlo:** las páginas dibujadas de fondo entran si son una serie (dos o más con números, como `01.png`, `02.png`) y si no queda ninguna `<img>` que pueda ser una página. Un lector que dibuja una sola página por vez solo se reconoce dentro de un iframe; si no, hace falta un adaptador con "Las páginas están dibujadas de fondo".
- **No mira el disco:** si borrás un archivo a mano, el registro sigue diciendo que lo guardaste hasta que lo quites en opciones.

Usala con contenido que tengas derecho a guardar.

---

# 🖥 El programa

Aplicación de escritorio para Windows, hecha con Electron y JavaScript plano. Hace lo mismo que la extensión sin depender del navegador, y suma un explorador: pegás una dirección y te muestra por niveles lo que hay ahí.

## Qué hace

| | |
|---|---|
| 🔎 **Explorar por niveles** | De una página saca sus listas de links: títulos, capítulos numerados y en orden, y páginas. Tocar un título lo abre y muestra sus capítulos; solo los capítulos se tildan para bajar. Los géneros y filtros van en una pestaña aparte |
| 🗃 **Encontrar el catálogo** | Si pegás la portada de un sitio y tiene un link a su listado completo ("Directorio", "Biblioteca"), entra solo, y en cualquier página lo deja a la vista como botón. Una portada llena de tapas no la confunde con un capítulo |
| 🖼 **Tapas** | Si la página muestra la tapa de cada título, la lista se ve como un mosaico de tapas. Un botón vuelve a la lista de renglones |
| 🔎 **Buscar en el sitio** | Si la página tiene buscador, queda un cuadro en el programa: escribís un nombre y muestra lo que trae el buscador del propio sitio |
| 🧩 **Listas incompletas o escondidas** | Abre la pestaña "Capítulos", toca "Ver más" y baja los paneles con barra propia. Si la página muestra solo el primer capítulo y el último, "Completar" suma los del medio por número |
| 📑 **Listados largos** | Baja hasta el final para ver lo que la página carga de a poco. "Traer más páginas" suma las 10 siguientes y "Traer todas" sigue hasta el final |
| 📚 **Volúmenes y sagas** | Si la página separa los capítulos en volúmenes o sagas, aparecen agrupados y se tilda el grupo entero |
| 🧹 **Revisar páginas** | En un capítulo, muestra todas sus imágenes con lo que tomó por publicidad apagado y el motivo. Un toque pone o saca cada una |
| ✔ **Lo que ya tenés** | Marca en la lista los capítulos que ya están en la carpeta, dice cuáles faltan y los tilda. Los reconoce aunque estén con otro nombre |
| 🗂 **Registro e historial** | Anota todo lo que baja. Lo que ya bajaste queda marcado aunque muevas o borres los archivos, y en un catálogo se ve qué títulos ya tenés empezados |
| 💽 **Tu colección** | Otras carpetas donde mirar lo que ya tenés, como la de Google Drive de tu máquina. Avisa si alguna no está a la vista, y deja atar a una serie una carpeta que se llama distinto |
| 📌 **Siguiendo** | Las series que seguís: "Buscar lo nuevo" dice qué capítulos hay que no tenés y los baja de un toque |
| 📦 **Cola de descargas** | Baja de a un capítulo y muestra en qué anda cada uno. Se cancela (el capítulo en curso se corta en el acto, sin dejar nada a medias), y se reintenta todo lo que falló. Si el sitio pide esperar, frena igual que la extensión. Avisa al terminar con los botones de la ventana (Reintentar, Limpiar, Abrir carpeta) y muestra el avance en la barra de tareas |
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
2. Si es un catálogo, tocá un título (o su tapa): se abre su página y aparece la lista de **Capítulos**. La ruta de arriba sirve para volver, y el botón **📚 El catálogo del sitio** lleva al listado completo.
3. Si el listado sigue en más páginas, tocá **Traer más páginas** o **Traer todas**. Para ir directo a una serie, escribí su nombre en **🔎 Buscar en este sitio…** (aparece cuando el sitio tiene buscador).
4. Tildá los capítulos que querés, elegí formatos y carpeta a la derecha, y tocá **Descargar**.

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

### 25-11-2026 · Programa 0.10.4

Lo que había quedado abierto de la 0.10.3: el primer aviso, cortar un intento en el medio, el proxy sin caché, el 429 sin cuerpo, el proxy con el programa ya abierto y los botones del aviso en el programa instalado.

- **El primer aviso de fin de cola sale en pantalla.** Electron crea su acceso directo en el menú Inicio con el primer aviso, y ese aviso se iba al centro de notificaciones. Ahora el programa lo prepara al arrancar: si el acceso directo no está, muestra un aviso mudo (con eso Electron lo crea), y si la cola termina en los primeros segundos su aviso espera hasta 5 s, porque Windows tarda en tomar un acceso directo nuevo (medido: un aviso en el primer segundo se pierde y arrastra al siguiente; a los 2 s sale). Con el programa instalado no hace falta nada. La prueba ya no vuelve a mostrar un aviso que no aparece, y `npm run avisos:limpio` la corre desde cero: borra antes el acceso directo y las claves del programa. Desde cero pasó tres veces (19:45, 20:00 y 20:06), y con el acceso directo ya creado, una (20:08).
- **Cancelar y Reintentar cortan en el acto.** El intento viejo seguía con su ventana abierta hasta terminar el paso en el que estaba. Ahora se cierra su ventana, se corta el armador y se borra lo que alcanzó a escribir antes de que salga el nuevo. Probado con la página tardando en abrir, con el armador bajando y con los archivos escribiéndose: la ventana vieja se cerró en menos de 2 s y quedó un solo archivo entero, sin "(1)". Cancelar solo tampoco deja nada del capítulo.
- **El proxy pide sin caché.** Con el proxy en uso, el programa limpia la caché al empezar y pide lo de ese sitio con `no-cache`: el armador vuelve a pedir por el proxy las imágenes que la página ya bajó, y el proxy lo puede cortar. Sin el proxy, todo sigue como siempre.
- **Corrida real** contra one-piece-fans2.com (`node programa/tests/proxy-real.js`, nuevo): con `--codigo 503 --solo imagenes --desde 3 --veces 2` (19:56), el capítulo 1104 quedó incompleto, sin ningún archivo y con el motivo, y al reintentar (un minuto después) bajó las 13 páginas en un solo PDF. Y lo que la 0.10.3 no podía, cortar al armador en un sitio real (19:58, capítulo 1105, 503 en sus 6 pedidos de una página que la página había bajado bien): incompleto sin archivo, y al reintentar, entero.
- **El 429 sin cuerpo: el arreglo era preventivo.** En Electron 45.4.1 un 429 o un 503 sin cuerpo llega como cualquier otro, con su código; el camino que agregó la 0.10.3 no ocurre. Quedó en el código marcado como preventivo, y la comprobación ahora mira por dónde se supo de verdad.
- **`MR_PROXY` con el programa ya abierto:** la ventana que estaba lo dice, con un botón para cerrar y abrir de nuevo con el proxy (`npm run proxy-abierto`, 4 de 4).
- **El programa instalado:** se armó el instalador, se instaló y se apretaron los tres botones del aviso con clics reales sobre el instalado: tres corridas (20:11, 20:13 y, con el instalador del código final, 20:41), 4 de 4 las tres. En las dos instalaciones limpias, el primer aviso después de instalar salió en pantalla. Después se desinstaló; el instalador queda en `programa/dist/`.
- **Pruebas:** 234 comprobaciones (eran 226), en 7 min 46 s. Aparte, con ventanas y avisos de verdad: `npm run avisos` y `npm run avisos:limpio` (4), `npm run proxy-abierto` (4) y `node tests/proxy-real.js` contra un sitio real.
- **Sigue abierto:** un 429 o un 503 que mande un sitio por su cuenta. El proxy inyecta, no observa: one-piece-fans2.com contestó 200 a todo lo que le llegó.

### 25-11-2026 · Extensión 2.11.4

Un 503 en las imágenes que carga la página corta el capítulo de un lote, igual que uno en la página. La carpeta es `manga-reader-ext(ver 24-11-2026-3)`.

- **Lo que pasaba:** si el sitio contestaba 429 o 503 a una página cuando la cargaba la página misma, la imagen quedaba rota sin decir por qué y el lote guardaba el capítulo con las que habían cargado (en la prueba, un PDF de 5 páginas de un capítulo de 6), sin frenar al sitio. El programa ya lo veía desde la 0.10.3; el lote, que es el uso principal de la extensión, no.
- **Ahora:** mientras un lote tiene un capítulo abierto, la extensión escucha también las imágenes; cada marco dice sus páginas y cuáles cargaron, y antes de pedirle que guarde se decide con la regla del programa: cuenta una página que no cargó (o una de su carpeta); un banner o un aviso de otra carpeta no corta nada, y una que después cargó no faltó. Si cuenta, el sitio queda frenado por el mismo camino de siempre, no se escribe nada y el capítulo queda para Reintentar con "el sitio pidió esperar (HTTP 503)". Si ya estaba guardado, sigue siendo "ya estaba". Guardando de a uno se guarda lo que bajó, con el motivo, y no queda anotado como guardado.
- **Un lector de una página por vez** (como Issuu): el diálogo lo dice ("el lector muestra una página por vez: se guarda la que está a la vista").
- **Los botones de la notificación:** cada uno hace lo que dice aunque la cola haya cambiado desde que se mostró (antes "Mostrar la carpeta" podía reintentar); Reintentar llega a la pestaña de la serie por el mismo camino que el botón del diálogo, también si estaba descartada, y respeta el freno. Se prueban disparando la acción como Chrome; el toque real sigue a mano.
- **Un tercer intento** de un capítulo que falló dos veces, desde la cola: probado, respeta el freno.
- **Revisión:** cuatro revisores con un escéptico por hallazgo confirmaron 24 problemas de la primera versión (carga diferida, adaptadores, una carpeta por página, redirecciones, `srcset`, reintentos con otra consulta, la notificación de otro lote, pestañas descartadas, pruebas que no podían fallar); quedaron arreglados, cada uno con su prueba.
- **En el programa:** `pareceListado` mira primero las imágenes grandes: un catálogo con un capítulo destacado dibujado de fondo ya no pasa por un capítulo (va sin cambio de versión hasta la 0.10.4).
- **Pruebas:** 601 en Node (35 nuevas) y un área nueva en el navegador, `imagenes` (12; 10 fallan contra la 2.11.3); las 14 secciones de siempre (174), las otras áreas de la 2.11 y `fondos` siguen en verde; el programa, 226.
- **Sigue abierto:** un 429 o un 503 que mande un sitio por su cuenta. El proxy de prueba inyecta, no observa: dice qué hacen la extensión y el programa con esas respuestas, no qué manda un sitio cuando de verdad se satura.

### 24-11-2026 · Programa 0.10.3

El mismo freno que la extensión, un proxy para provocar un 429 o un 503 de verdad, y botones en el aviso de fin de cola.

- **El freno es uno solo.** Ante un 429 o un 503 sin `Retry-After`, el programa seguía con la pausa de siempre (1,5 s) y la extensión frenaba un minuto; el que baja de a muchos es el programa. Ahora los dos usan la misma regla (`esperaDelSitio` de la extensión, sobre `esperaPedida`): lo pedido con tope de un minuto; un minuto sin cabecera, con basura o con una fecha vencida; nada con `Retry-After: 0`. Está escrita una sola vez, en la sección 4.19 de [DOCUMENTACION.md](DOCUMENTACION.md).
- **Nada a medias.** Si una imagen queda afuera porque el sitio pidió esperar, el capítulo queda "incompleto · no guardé nada, para no dejarlo a medias", sin ningún archivo. Lo mismo si el sitio contesta 429 o 503 a las páginas que carga la página misma: una corrida real lo encontró guardando 3 páginas de 17 como "listo", y ya no pasa (decide la carpeta de las páginas, así que un aviso o la tapa de un "relacionado" que fallan no cortan el capítulo). Un 429 sin cuerpo también frena.
- **Proxy de prueba** (`programa/tests/proxy.js`, sin dependencias): reenvía a un sitio de verdad e inyecta 429 o 503, con o sin `Retry-After`, con contador y corte desde el pedido N. El programa lo usa con `MR_PROXY=…` o `--proxy=…`; sin eso, todo va directo.
- **Corrida real** contra one-piece-fans2.com a través del proxy (24-11-2026, 08:59 a 09:02, y antes 07:58 a 08:01 con el mismo resultado): con un 503 y `Retry-After: 5`, el pedido siguiente salió a los 5,1 s; con un 429 sin cabecera, a los 60,1 s; con un 503 en tres imágenes de la página, quedó incompleto sin archivo y al reintentar esperó el minuto y bajó las 14 páginas.
- **Botones en el aviso de fin de cola:** "Reintentar N que falló", "Limpiar terminados" y "Abrir carpeta", los mismos de la ventana y por el mismo camino. Apretados de verdad con UI Automation (`npm run avisos`, dos corridas seguidas a las 08:56 y 08:57): el reintento respetó el freno (clic a los 3,9 s de un 503 sin cabecera, pedido nuevo a los 60,1 s), y los otros dos hicieron lo suyo. En el camino apareció un error: el programa guardaba solo el último aviso y Electron perdía los botones de uno anterior; ahora guarda los últimos 10.
- **El reintento no se gasta:** un capítulo que falló dos veces se vuelve a reintentar, respetando el freno. Y si se cancela y se reintenta en medio de una bajada, el reintento ya no se pierde (arreglado por una revisión; sin prueba automática).
- **El explorador usa la detección nueva de la extensión:** la página de prueba de fondos sale como capítulo, con sus 8 páginas y ninguna tapa.
- **Pruebas:** 224 comprobaciones (eran 191), en 6 min 28 s (la 0.10.2 tardaba 5 min 3 s; la espera real que suma el proxy son unos 15 s: el minuto sin cabecera se lee y se cancela, no se espera).
- **Falta:** el programa instalado (con su propio acceso directo) no se probó con los botones; el corte en las imágenes que pide el armador no se puede provocar en un sitio real a través del proxy (las toma de la caché de la página); y el primer aviso después de que Electron crea su acceso directo en el menú Inicio no sale en pantalla.

### 24-11-2026 · Extensión 2.11.3

Páginas dibujadas de fondo, sin ofrecer las tapas de alrededor. La carpeta es `manga-reader-ext(ver 24-11-2026-2)`.

- **Lo que pasaba:** un lector que pinta cada página de fondo (CSS o SVG, como Issuu) no tenía `<img>` que la extensión viera, y se quedaba con cualquier imagen suelta de la página. En Issuu guardó 18 tapas de otras publicaciones: peor que fallar, porque parecía que anduvo.
- **Ahora** junta las imágenes de fondo del estilo calculado, de los atributos de carga diferida (`data-bg`), de las reglas (con `image-set()`) y de los `<image>` de SVG, y toma la serie que parece un lector (`01.png`, `02.png`… juntas en un bloque), en orden. Sin el mínimo de 250 px. Con imágenes de las dos clases, ganan las `<img>`; los fondos entran si no hay ninguna, o si un adaptador lo pide (casilla nueva "Las páginas están dibujadas de fondo"). El diálogo lo dice: "páginas dibujadas de fondo".
- **Lo que no son páginas:** tarjetas de un listado (aunque el link esté al lado y no envolviendo la imagen), recomendados de otro sitio, tiras de miniaturas, adornos desparramados por la página (también los de un sitio empaquetado), íconos incrustados, solo degradés. Si el lector de fondo no se puede leer, dice que no encontró páginas y no ofrece las imágenes sueltas.
- **Issuu, de verdad (24-11-2026):** con el lector cargado, el diálogo se abre en su iframe con "1 de 1 páginas · páginas dibujadas de fondo" y guarda la página que el lector tiene dibujada; si se abre antes de que cargue, dice "Lo que hay son tapas que llevan a otras páginas del sitio" y no guarda nada. **Las 18 tapas no volvieron a aparecer.** Comic Rocket (lector `<img>` en un iframe de otro sitio) quedó igual que con la 2.11.2.
- **Revisión:** tres pasadas adversariales encontraron casos donde la primera versión ofrecía adornos como páginas o hacía aparecer la burbuja en páginas comunes (diarios, foros, catálogos); quedaron arreglados y cada uno con su prueba.
- **Páginas SVG:** se usa el escaneo de adentro sin recodificar (embebido o por dirección), y si hay algo más dibujado, se dibuja entero.
- **Pruebas:** 566 comprobaciones en Node (`test_fondos.js`, 50, nueva) y un área nueva en el navegador (`fondos`, 14: contra la 2.11.2 fallan 11, que guardaba las 18 tapas de la página de prueba); las 14 secciones de siempre (174) y las otras áreas de la 2.11 (98) siguen en verde.
- **Falta:** un lector que muestra de a una página en la página de arriba (no en un iframe), uno cuyas páginas llevan cada una a otra página, y una página SVG con texto encima (se dibuja, sin prueba en el navegador). En la extensión, un 503 en las imágenes que carga la página no se veía (en el programa sí): resuelto en la 2.11.4.

### 24-11-2026 · Extensión 2.11.2

El sitio dice cuánto esperar, también con la página del capítulo. La carpeta es `manga-reader-ext(ver 24-11-2026)`.

- **`Retry-After` de la página del capítulo.** Hasta la 2.11.1 la extensión lo leía solo de las imágenes; si lo pedía la página, el lote paraba siempre un minuto. Ahora lo lee de la respuesta de la página (con el permiso `webRequest`) y frena lo que el sitio pidió: 12 s si dice 12, un minuto si dice 300 (el tope), y un minuto si no dice cuánto o manda algo que no se entiende. Un sitio que no dice cuánto pidió un minuto: no se baja a los 2, 4 u 8 s de una imagen suelta.
- **Frena todo el lote de ese sitio**, con la cuenta regresiva que ya existía ("sigo en N s"): el reintento del capítulo y también el capítulo que sigue, que antes salía enseguida.
- **El permiso nuevo no cambia nada al instalar:** Chromium muestra las mismas tres advertencias que antes, y `chrome://extensions` no marca advertencias ni errores. Se escucha solo mientras un lote tiene un capítulo abierto.
- **Pruebas:** 510 comprobaciones en Node (13 nuevas) y un área nueva en el navegador (`espera`, 10): con `Retry-After: 4` el reintento llegó a los 4,7 s y el capítulo siguiente a los 4,5 s; sin cabecera la cuenta arranca en 60 y el capítulo no se vuelve a pedir antes. Contra la 2.11.1, 4 de esas fallan (esperaba 60,9 s y el siguiente no esperaba). Los pedidos que cuenta el área `ritmo` ya no están escritos a mano: salen de las constantes del armador.
- **Contra sitios reales** (detalle y horas en la sección 11 de la documentación): un capítulo **dentro de un iframe** de otro sitio (Comic Rocket mostrando The Oatmeal) se guardó entero con un adaptador, y sin él salieron 2 de 7 viñetas por el tamaño mínimo. Issuu va en un iframe pero dibuja las páginas como fondo CSS y la extensión no las ve, e Internet Archive no usa iframe. Para provocar un **429 o un 503**: 20 capítulos seguidos sin pausa con la extensión, 20 con el programa y una ráfaga de 120 pedidos; one-piece-fans2.com no limitó nunca.
- **`probar_sitio.js`** dice qué marcos tiene la página y en cuál se abrió el diálogo, baja el capítulo abierto con `guardar`, y acepta `PAUSA`, `CONCURRENCIA` y `ADAPTADOR`.
- **También se corrigió la documentación del aviso de versión nueva:** el popup de la 2.11.0 mostró "Hay una versión nueva: 2.11.1" el 23-11-2026, ya subida la 2.11.1; el documento decía que eso no se había visto.
- **Falta:** el freno no mira la respuesta de un iframe del lector (solo la de la página); los botones de la notificación siguen sin poder apretarse desde una prueba; y un 429 o un 503 real no se pudo provocar.

### 23-11-2026 · Programa 0.10.2

Lee lo que el sitio pide esperar:

- **`Retry-After` se respeta.** Cuando un sitio responde 429 o 503 y dice cuánto esperar, el programa no le vuelve a pedir nada antes de ese tiempo (con tope de un minuto): ni el capítulo que sigue en la cola ni un reintento, aunque toques **Reintentar** enseguida. El renglón muestra "el sitio pidió esperar: sigo en N s". Si el sitio no dice cuánto, corre la pausa de siempre. Antes seguía con la pausa fija entre capítulos, dijera lo que dijera el sitio.
- **Vale para la página del capítulo y para sus imágenes.** El armador ahora carga las mismas reglas que la extensión (`ajustes.js`): una imagen que responde 503 con `Retry-After: 3` se vuelve a pedir a los 3 segundos, no a los 2 de siempre.
- **El motivo queda a la vista:** "La página respondió HTTP 503: el sitio pidió esperar", o "no bajó la página 3 · el sitio pidió esperar (HTTP 503)" en un capítulo incompleto.
- **Pruebas:** `npm run prueba` hace 191 comprobaciones. La página "inestable" vuelve a fallar con 503 (en la 0.10.1 había pasado a 500 y el 503 quedaba sin probar): lo hace las seis veces que el armador la pide, y se comprueba que las esperas ocurrieron contando los pedidos y midiendo el tiempo entre el primero y el último (más de 16 s). Hay capítulos nuevos de un sitio "ocupado": 503 en la página sin `Retry-After` y con él, y en una imagen; en cada caso se mide cuánto pasó hasta el pedido siguiente.
- **Falta:** la espera es por sitio y solo para la cola de descargas; explorar una página no la mira. Sin `Retry-After` no se inventa una espera: queda la pausa de siempre.

### 23-11-2026 · Extensión 2.11.1

Cierre de la 2.11: una revisión, sin funciones nuevas. La carpeta es `manga-reader-ext(ver 23-11-2026-2)`.

- **Un 503 vale lo mismo que un 429, lo responda la página del capítulo o sus imágenes.** Antes, si eran las imágenes, se reintentaban unos segundos y después contaba como una falla común: el lote seguía pidiéndole al sitio. Ahora el lote para un minuto (una vez), reintenta ese capítulo y, si sigue igual, lo deja en la cola con "el sitio pidió esperar" para **Reintentar**.
- **Un capítulo de un lote no se guarda a medias por eso.** Apenas una página queda afuera porque el sitio pidió esperar, el armador deja de pedir las demás y no arma nada: cuando se reintenta sale entero y con su nombre, sin un `nombre (1)` al lado. Guardando de a uno se sigue guardando lo que bajó, y el aviso dice el motivo.
- **Reintentar y Reanudar ya no dejan a la vista el final del lote anterior.** El estado cambia a "Preparando el lote…" en el momento del clic (como ya pasaba al arrancar un lote común), y un segundo clic apurado no cancela lo que recién arrancó. Si todo lo que le faltaba a una cola ya lo guardaste de a uno, Reanudar lo dice y la cierra en vez de quedar ofrecida para siempre.
- **Con un adaptador no queda nada del filtro automático.** Seguían valiendo el lado mínimo, la carpeta con más imágenes y el mínimo de 3 páginas: un capítulo en tiras (más bajas que 250 px), o con cada página en su carpeta, no se encontraba aunque el adaptador las señalara. Y un adaptador con un selector inválido ahora se avisa en el diálogo.
- **Limpieza:** se sacó el manejador de un mensaje (`count`) que ya nadie mandaba.
- **Pruebas:** 17 comprobaciones más en Node (497) y 15 más en el navegador (`tests/e2e_211.js`, 96); 8 de esas 15 fallan contra la 2.11.0. Quedó probada la casilla "Saltear los que ya guardé" destildada (los links ya guardados entran igual y no hay aviso de descartados), que andaba pero no tenía prueba. Las dos comprobaciones de `e2e.js` que dependían de que la versión trajera `ajustes.js` ahora comparan siempre, contra el texto de la versión que se corre.
- **A mano y contra un sitio real:** el pedido a GitHub del aviso de versión nueva se hizo de verdad (`tests/probar_version.js`: respondió 200 y leyó la 2.11.0, también desde el popup), y la sección 11 de la documentación trae los pasos para probar a mano los botones de la notificación y lo que se corrió contra un sitio real.
- **Falta:** los botones de la notificación siguen sin poder apretarse desde una prueba (los dibuja Windows); no se provocó un 503 en un sitio real; y la extensión no lee `Retry-After` de la página de un capítulo, solo de las imágenes (para el lote usa la parada de un minuto).

### 23-11-2026 · Extensión 2.11.0

Diez cambios y tres menores. La carpeta es `manga-reader-ext(ver 23-11-2026)`.

- **El diálogo y la burbuja, a salvo del sitio.** Van adentro de un shadow root: el estilo de la página ya no los desarma (un `button { display: none }` escondía el botón Guardar) y, si el sitio los saca, vuelven como estaban.
- **Lectores en un iframe.** El script corre en la página y en sus marcos; la burbuja y el diálogo van al que tiene las páginas, aunque sea de otro sitio, y el nombre sale del título de la página. Las mismas imágenes en la página y en el marco cuentan una vez.
- **La cola del lote queda guardada.** Si se cierra la pestaña o algo falla, al volver ofrece **Reanudar**; al terminar con fallas, **Reintentar los N que fallaron** o **Descartar la cola**. Cada falla guarda su motivo.
- **Ritmo y espera.** Opciones para la pausa entre capítulos, un descanso cada tantos y las imágenes que se miden a la vez. Ante un 429 o un 503 espera lo que diga el sitio (`Retry-After`) y reintenta; si es el capítulo entero, el lote para un minuto una vez y lo reintenta.
- **Insignia y notificación.** El ícono muestra `hecho/total` mientras corre el lote y queda verde o rojo; al terminar avisa, con botones para reintentar lo que falló y para abrir la carpeta. Pide un permiso nuevo: notificaciones.
- **Orden de las páginas.** Arrastrar, ▲▼, **Invertir** y **Ordenar por número**. Es el orden del PDF, del CBZ y de la numeración de las imágenes.
- **Adaptadores por sitio.** Contenedor, imágenes, lo que hay que ignorar y la dirección de los capítulos, por sitio y con **Probar en esta página**. Un selector mal escrito se avisa y no rompe nada.
- **Carpeta base.** `MangaReader` se puede cambiar por otra, con `{sitio}`, `{serie}` y `{anio}`. No acepta `..` ni rutas completas.
- **Pegar links.** Descarta los que ya tenías guardados y dice cuántos; la lista se puede ordenar por número o invertir, y en ese orden se baja.
- **Teclado y accesibilidad.** Los diálogos se anuncian como tales, el foco no se escapa, las flechas recorren las miniaturas, el espacio las incluye o las quita, y al cerrar el foco vuelve a donde estaba.
- **Menores:** el registro se exporta también en CSV; antes de un lote se estima cuánto va a ocupar (y avisa si pasa de 200 MB); y el popup muestra un punto cuando en el repositorio hay una versión más nueva.
- **En el programa:** como comparte el armador de archivos con la extensión, también espera y reintenta una página que responde 429 o 503 (2, 4 y 8 segundos; lo que pida el sitio en `Retry-After` todavía no lo lee). Su página de prueba "inestable" pasó a fallar con un 500 para seguir probando el reintento a mano.
- **Pruebas:** cada área se probó en un navegador real contra páginas armadas para eso (`tests/e2e_211.js`, que se puede correr solo) y contra la 2.10.0, para ver que lo nuevo fallaba antes.
- **Falta:** desde un iframe no se ofrece "Guardar y siguiente"; `Alt+S` no se puede apretar desde las pruebas (se prueba el mismo pedido que hace el atajo); y los botones de la notificación se probaron con `chrome` simulado, no con un clic real.

### 23-11-2026 · Programa 0.10.1

Cierra seis agujeros que la 0.10.0 dejó en los capítulos con link `#`:

- **Un renglón sin link real ya no se queda con el del renglón de al lado.** Buscaba el link subiendo por la página: el capítulo 1 tomaba la dirección del 2 y el 2 desaparecía de la lista. Ahora busca solo dentro de su renglón (una fila de tabla, un ítem de lista, un artículo o el elemento que lleva el número) y, si no hay, el renglón se descarta.
- **El número por atributo sale solo del renglón.** Un `data-number` puesto en el bloque que envuelve la lista ya no numera todo, y un `data-chapter-number="extra"` ya no tapa un `data-number` válido. Si el texto del renglón dice otro número, vale el texto: un `data-number` con la posición de la fila no pisa a "Capítulo 101". Y `data-number` solo, sin que nada nombre un capítulo, no cuenta: también lo llevan los puestos de un ranking de series.
- **El link `#` puede ser un ícono.** Alcanza con que el renglón nombre el capítulo ("Capítulo 5" escrito al lado).
- **Los botones "Empezar a leer" y "Último capítulo"** ya no dejan a su capítulo numerado por el código de la dirección, o afuera de la lista: cuando llega su renglón, le pasa el número y el nombre.
- **Un capítulo subido varias veces** ya no hace que quede primera la lista "por número" (que numera por la dirección y lo trae repetido): para compararlas se cuentan los links, no los renglones.
- **Los errores de una página llegan limpios.** La interfaz mostraba la pila entera ("at Object.buscar (…pagina.js:1246:25)"); ahora muestra el mensaje, y la pila queda aparte para diagnosticar.
- **Pruebas:** `npm run prueba` hace 180 comprobaciones. `/capitulos-prueba/` ahora trae códigos en la dirección, los dos botones y un capítulo subido tres veces; `/capitulos-raros/` suma un renglón sin link real, y hay tres páginas nuevas (`/capitulos-envueltos/`, `/capitulos-ranking/` y `/mas-leidas/`). Las nuevas fallaban todas con la 0.10.0.
- **Falta:** el renglón huérfano (con `#` y sin link real) se descarta por diseño, no se rescata. En un listado con miniaturas y links `#`, las imágenes se registran todas bajo la dirección de la página y se pisan: esos renglones quedan sin miniatura. Y sin atributo, un código corto en la dirección (hasta 5 cifras) sigue pasando por número de capítulo aunque el texto diga otro.

### 23-11-2026 · Programa 0.10.0

- **Capítulos cuyo link es `#`.** En algunos sitios el link del renglón es un hash de la misma página (`href="#"`: abre el renglón ahí mismo) y los links para leer están adentro. Ahora el programa usa el link real que el renglón tiene adentro, y si no hay ninguno, el renglón se descarta. Vale solo para los renglones que nombran un capítulo: el botón `#` de un menú desplegable o de una pestaña se saltea, como antes.
- **El número de capítulo sale también de `data-chapter-number` / `data-number`**, para cuando la dirección trae un código y no el número. Si el atributo no es un número ("extra"), no cuenta.
- **Las listas ocultas y "Ver todo" se leen:** entran los capítulos que la página trae escondidos, y "Ver todo" está entre los botones que el programa toca para desplegar la lista.
- **Los repetidos se juntan en uno**, con `versiones` (cuántos links tiene ese capítulo).
- **Pruebas:** la ruta `/capitulos-prueba/` del sitio de prueba da 109 capítulos del 1 al 109, sin repetidos, y `/capitulos-raros/` cubre el menú con `#` y el atributo que no es un número. `npm run prueba` hace 174 comprobaciones (172 más esas dos).
- **Falta:** un renglón sin link real que es el primero de su lista toma el link del renglón siguiente; un `data-number` que no es el número del capítulo (la posición del renglón, o puesto en el contenedor de la lista) le gana al número que dicen la dirección y el texto; y si la dirección trae un código corto y un capítulo está subido dos veces, la lista que queda primera es la numerada por código.

### 23-11-2026 · Programa 0.9.0

- **El buscador del sitio, dentro del programa.** Cuando la página tiene un buscador, aparece el cuadro "🔎 Buscar en este sitio…" al lado del catálogo. Escribís un nombre y el programa usa el buscador del propio sitio y muestra los resultados como títulos para entrar. Lo encuentra en un formulario, en lo que el sitio declara, o en un cuadro suelto donde escribe por vos.
- **Completar por número.** Si la página de una serie muestra solo el primer capítulo y el último y las direcciones solo cambian en el número, "Completar del N al M" suma los del medio.
- **Abre lo que la página esconde:** la pestaña "Capítulos", los botones "Ver más" / "Mostrar todos" y las listas en un panel con barra propia.
- **Las tarjetas con tapa ya no pasan por capítulos.** Los títulos de la portada que dicen "Cap. 12" o llevan un código en la dirección son títulos para entrar, no capítulos para descargar.
- **De una tarjeta queda el nombre.** Antes, al entrar a un título, "Serie" se llenaba con todo lo que decía la tarjeta ("Nombre MANHWA 9.00 Finalizado 204 caps"). Ahora va solo el nombre, y lo demás se muestra al lado.
- **Arreglo:** entre los botones de la serie aparecía la palabra "null".

### 23-11-2026 · Programa 0.8.1

- **El catálogo, siempre a la vista.** El link al listado completo del sitio queda en una barra con su botón ("📚 El catálogo del sitio"). Ahora lo encuentra también cuando el link trae el orden o el número de página (`/biblioteca?orden=populares&page=1`), que antes se descartaba, y por más nombres ("Explorar", "Ver todo", "Lista de mangas").
- **Ya no ofrece descargar géneros ni títulos.** Los links a géneros, etiquetas, tipos o autores van en su pestaña, al final. Las listas de títulos son para entrar: tocás uno y se abre; solo los capítulos tienen casilla. Si una serie nombra sus capítulos sin número, "Son capítulos" deja tildarlos.
- **Arma la lista de capítulos aunque el número no esté en el link.** Lo toma del renglón ("Capítulo 5 · Leer") o del título que tiene encima. Si un capítulo tiene varios links (lo subió más de un grupo), deja uno y dice cuántas versiones hay. Y si al entrar a una serie no encuentra capítulos, lo dice.

### 23-11-2026 · Programa 0.8.0

- **Siguiendo:** se marca una serie como seguida desde su lista de capítulos, y "Buscar lo nuevo" revisa todas y dice qué hay que no tenés ("3 nuevos: 1200–1202"). Se baja lo nuevo de una o de todas con un toque. Siempre arranca con un clic.
- **Aviso si una carpeta no está a la vista.** Con Google Drive cerrado o un disco sin conectar, antes no marcaba nada como tenido y no decía por qué. Ahora lo avisa arriba, y no deja descargar a una carpeta que no está.
- **Atar una carpeta a una serie** cuando se llaman distinto: "Elegir su carpeta…" o, si encontró una parecida, "Es «…»".

### 23-11-2026 · Programa 0.7.1

- **"Ya está" cuenta cualquier formato.** Si un capítulo está en CBZ y tenés tildado PDF, figura igual como que ya lo tenés y dice "✔ ya está en CBZ". Antes aparecía como faltante.
- **La serie se completa sola también al abrir un capítulo directo**, con la que dice el título de la página. Al analizar otra dirección, la puesta sola se borra.
- **En tu colección se reconocen más números de capítulo:** "#12" y los de tres cifras ("Avengers 012"), sin contar el año entre paréntesis.
- **Pistas de nombres parecidos:** si en tu colección no hay una carpeta con el nombre de la serie pero sí una que empieza igual, lo avisa ("≈ parecido"), sin darla por tenida.
- Probado contra una carpeta real de Google Drive (`G:\Mi unidad`), además del sitio de prueba.

### 23-11-2026 · Programa 0.7.0

- **Registro de descargas:** el programa anota cada capítulo que baja. Lo que ya bajaste aparece marcado ("✔ ya lo bajaste") aunque hayas movido o borrado los archivos, y en un catálogo los títulos que ya tenés empezados dicen cuántos capítulos bajaste.
- **Historial:** el registro completo por serie, con cuántos capítulos, de cuál a cuál y cuáles faltan en el medio.
- **Tu colección:** otras carpetas donde mirar lo que ya tenés, con cualquier organización hasta dos niveles (`Mangas/One Piece`). Sirve para la carpeta de Google Drive de tu máquina: no hace falta dar acceso a la cuenta.

### 22-11-2026 · Programa 0.6.0

- **Revisar páginas:** en un capítulo se ven todas sus imágenes, con lo que el filtro tomó por publicidad apagado y el motivo. Un toque pone o saca cada una, y se bajan exactamente las elegidas. La cola dice cuántas descartó el filtro en cada capítulo.
- **Lo que ya tenés y lo que te falta:** la lista de capítulos marca los que ya están en la carpeta, dice cuáles faltan y los tilda. Se fija en el número y no en el nombre exacto, así que reconoce lo guardado con otro nombre o en una carpeta que se llama casi igual, y al descargar no lo duplica.
- **La serie se completa sola** al entrar a un título, para que todos sus capítulos vayan a la misma carpeta.
- **Plantilla de nombres y sagas propias**, como en la extensión. El tomo y el nombre de cada capítulo de la lista se pueden usar en el nombre del archivo.
- **Reintentar lo que falló:** vuelve a la cola todo lo que falló, quedó incompleto o se canceló.
- **Si el sitio pide esperar** (429 o 503 con `Retry-After`), no le vuelve a pedir nada antes de ese tiempo, con tope de un minuto: ni el capítulo siguiente ni un reintento.
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
| `estilos.js` | La hoja de estilos del diálogo y de la burbuja, como texto: va adentro de su shadow root (desde la 2.11) |
| `ajustes.js` | Las reglas de los ajustes (ritmo, esperas, adaptadores, carpeta base, versión nueva), las mismas para opciones, las pestañas, el armador y el service worker (desde la 2.11) |

---

## Pruebas

No hacen falta dependencias: alcanza con Node 22 o más nuevo.

```bash
bash tests/correr.sh        # sintaxis y pruebas en Node contra la última versión
node tests/e2e.js           # navegador real, sobre sitios de prueba servidos en la máquina
node tests/e2e_211.js       # solo lo que sumó la 2.11 (SOLO=cola,ritmo… para elegir áreas); e2e.js también lo corre
node tests/lote_largo.js    # un lote de decenas de capítulos seguidos
```

- El programa tiene las suyas: `cd programa` y `npm run prueba` (226 comprobaciones, unos 6 minutos y medio). `npm run avisos` aprieta de verdad los botones del aviso de fin de cola (muestra avisos en la pantalla). `node programa/tests/proxy.js --sitio <dirección> --codigo 503` es el proxy que provoca un 429 o un 503 de verdad delante de un sitio real; el programa lo usa con `MR_PROXY=<dirección del proxy> npm start` (detalle en la sección 11 de [DOCUMENTACION.md](DOCUMENTACION.md)).
- `bash tests/correr.sh` son 601 comprobaciones en Node; en el navegador, `SOLO=shadow node tests/e2e.js` (174) y `node tests/e2e_211.js` por tandas (`SOLO=iframes,cola,insignia`, `SOLO=ritmo,espera`, `SOLO=orden,adaptadores,carpeta,pegar,teclado,menores`, `SOLO=fondos` y `SOLO=imagenes`): cada comando tiene que entrar en 10 minutos.
- Las pruebas en navegador necesitan el Chromium de Playwright (`%LOCALAPPDATA%\ms-playwright\chromium-*`) o el de la variable `CHROMIUM`. El Chrome común ya no acepta cargar extensiones por línea de comandos.
- `node tests/probar_sitio.js "<dirección>"` informa qué detecta la extensión en una página, sin dejar archivos: también si el lector está en un iframe y en qué marco se abre el diálogo. Con un rango (`1100 1119`) baja esos capítulos, y con `guardar` el capítulo abierto, a una carpeta temporal que se borra. `PAUSA=0 CONCURRENCIA=8` ponen el ritmo del lote y `ADAPTADOR='{"sitio":"…","contenedor":"…"}'` un adaptador.
- `node tests/probar_version.js` hace de verdad el pedido a GitHub del aviso de versión nueva y dice qué contestó (con `--navegador`, además desde el popup). No es parte de ninguna suite: depende de la red.
- Las dos pruebas en navegador aceptan la carpeta de otra versión como argumento: `node tests/e2e_211.js "manga-reader-ext(ver 22-11-2026-7)"` muestra qué de lo nuevo fallaba antes.
- Las páginas de prueba de la 2.11 (y las de fondos de la 2.11.3: `fondo*.html`) están en `tests/fixtures/`.
- Todas las descargas de las pruebas van a una carpeta temporal que se borra al terminar.

## Cómo se cambia algo

Las versiones no se editan: se copia la última carpeta a una nueva con la fecha del día, se sube `version` en `manifest.json` y se trabaja ahí. Con cada versión se actualiza su `DOCUMENTACION.md` y se copia a la raíz. El detalle está en la sección 13 de [DOCUMENTACION.md](DOCUMENTACION.md).
