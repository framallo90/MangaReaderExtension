# 📖 Manga Reader — programa de escritorio

Explora una página web por niveles (títulos → capítulos → páginas) y guarda los capítulos que elijas como **PDF**, **CBZ** o **imágenes**, en la carpeta que quieras.

Todo corre en tu máquina: no hay servidor ni cuenta. Es independiente de la extensión de Chrome y usa su mismo código para detectar páginas, armar nombres y generar los archivos.

**Estado: versión 0.10.0.** Funciona de punta a punta sobre los sitios de prueba. Los cambios de cada versión están en las [Actualizaciones](../README.md#actualizaciones) del README principal.

## Cómo abrirlo

Hay dos formas:

- **Instalado.** `npm run instalador` arma `dist/Manga-Reader-Instalador-<versión>.exe`. Se instala como cualquier programa y queda con su acceso directo. El instalador no está firmado: la primera vez Windows puede mostrar "Windows protegió su PC"; se sigue con **Más información → Ejecutar de todas formas**.
- **Desde el código**, con [Node.js](https://nodejs.org) 22 o más nuevo:

```bash
cd programa
npm install      # una sola vez: baja Electron (unos 370 MB)
npm start
```

De las dos formas usa los mismos datos (favoritos, opciones, sagas), así que se puede pasar de una a otra sin perder nada.

## Cómo se usa

1. **Pegá una dirección** arriba y tocá **Analizar**. Puede ser la portada de un sitio, un catálogo, la página de una serie o un capítulo.
   - **Si es la portada de un sitio** y tiene un link a su listado completo ("Directorio", "Biblioteca", "Catálogo"), entra ahí solo: la portada suele mostrar apenas lo destacado. Para ver la portada, volvé por la ruta de arriba.
   - **El buscador del sitio, dentro del programa.** Si la página tiene un buscador, aparece un cuadro **🔎 Buscar en este sitio…** en esa misma barra: escribís un nombre, Enter, y el programa busca con el buscador del propio sitio y te muestra los resultados como una lista de títulos para entrar. Queda a mano mientras sigas en ese sitio.
   - **En todas las páginas** ese link queda a la vista, en una barra con su botón: **📚 El catálogo del sitio**. Lo encuentra aunque el link traiga el orden o el número de página (`/biblioteca?orden=populares&page=1`).
   - **Una portada llena de tapas no es un capítulo.** Las tapas son imágenes grandes, como las páginas de un capítulo, pero cada una lleva a la página de su serie: el programa las reconoce por eso y muestra los títulos en lugar de ofrecer "Descargar este capítulo".
   - **Las últimas direcciones** que analizaste a mano se ofrecen al escribir en el cuadro y, antes de analizar nada, en una lista para tocar.
2. **Mirá lo que encontró.** Antes de leer los links, baja hasta el final de la página, para que aparezca lo que carga de a poco. También abre lo que la página esconde: toca la pestaña "Capítulos", los botones "Ver más" / "Mostrar todos" y baja los paneles que tienen su propia barra. Cada pestaña es una lista de links de esa página:
   - **Capítulos:** links numerados, en orden. Son los únicos renglones que se tildan para bajar. Si la página los separa en volúmenes o sagas, aparecen agrupados y se puede tildar el grupo entero.
     - El número puede estar en la dirección, en el texto del link, en su renglón ("Capítulo 5 · Leer") o en el título que tiene encima.
     - Si un capítulo tiene más de un link (lo subió más de un grupo), queda uno solo y el renglón dice cuántas versiones hay.
   - **Títulos y links:** los demás links, agrupados por la carpeta de su dirección. Acá suelen estar las series de un catálogo. Son para entrar: tocar un renglón abre ese título y muestra sus capítulos; no tienen casilla. Si en realidad son los capítulos de una serie que los nombra sin número, **Son capítulos** deja tildarlos.
   - **Si la página muestra solo algunos capítulos** (el primero y el último, por ejemplo) y sus direcciones solo cambian en el número, aparece **Completar del N al M**: suma los del medio por número. Si alguno no existe en el sitio, al bajarlo dice que no encontró páginas.
   - **De una tarjeta queda el nombre.** Cuando un título viene en una tarjeta con más cosas (tipo, nota, estado, "204 caps"), el renglón muestra el nombre y, más apagado, lo demás. A "Serie" va solo el nombre.
   - **Géneros y filtros:** los links a géneros, etiquetas, tipos o autores (`/genero/accion`, `?genre=3`) van aparte, en la última pestaña: no son series, y tocar uno abre el listado de ese género.
   - **Con tapas:** si la página trae una imagen para sus títulos (la tapa de cada serie), la lista se muestra como un mosaico, con la tapa arriba y el nombre abajo. Tocar una tapa entra a ese título. El botón **🖼 Tapas** vuelve a la lista de renglones, y el programa recuerda cómo la dejaste.
3. **Bajá un nivel** tocando un título, o con la flecha **›** de un capítulo: abre esa página y la analiza. Si al entrar a una serie no encuentra su lista de capítulos, lo dice. La ruta de arriba recuerda por dónde entraste y sirve para volver.
4. **Si el listado sigue en más páginas**, aparecen dos botones:
   - **Traer más páginas** lee las 10 siguientes y suma lo que encuentra a la lista, sin repetir.
   - **Traer todas** sigue sola hasta el final. Para a las 50 páginas (se toca de nuevo para seguir), y mientras lee el botón dice **Parar**.
   - Las páginas se leen de a una, con un segundo de pausa entre cada una. Si el sitio deja de contestar bien, para, lo dice y deja lo que ya juntó.
5. **Tildá lo que querés**, elegí formatos y carpeta a la derecha, y tocá **Descargar**. Va a la cola.

Otras formas de cargar capítulos:

- **Si la página es un capítulo**, aparece una tarjeta con **Descargar este capítulo** y **Revisar páginas**.
- **Pegar links:** el botón de arriba abre un cuadro para pegar una lista de links como la tengas. Cada uno queda con su número, igual que en la extensión.

### Revisar las páginas de un capítulo

En la página de un capítulo, **Revisar páginas** muestra todas las imágenes que encontró, en orden, como en el diálogo de la extensión:

- **Las que van** tienen borde verde y su número de página.
- **Las que el filtro tomó por publicidad** están apagadas, con una ✕ y el motivo abajo ("enlace a otro sitio", "fuera de la carpeta del capítulo", "formato distinto al resto"…).
- **Un toque sobre una imagen la cambia:** si era una página y la tomó por aviso, la pone; si era un aviso y no lo detectó, la saca. Los números se reacomodan solos.
- **Todas**, **Ninguna** y **Como las detectó** cambian todas juntas.
- **Descargar N páginas** baja exactamente las elegidas, sin volver a abrir el capítulo.

Al bajar varios capítulos de una lista no hay revisión de cada uno: va el filtro automático, y la cola dice cuántas descartó ("6 páginas (1 descartada como publicidad)"). Si algo salió mal en uno, se entra a ese capítulo con la flecha › y se lo revisa.

### Lo que ya tenés y lo que te falta

Cuando la lista es de capítulos y se sabe de qué serie son (el cuadro **Serie**), el programa mira la carpeta:

- **Cada capítulo que ya está** aparece con **✔ ya está**, y arriba dice "Ya tenés 12 de 40. Te faltan: 4–7, 13–40."
- **Marcar los que faltan** tilda justo esos.
- **Se fija en el número, no en el nombre exacto.** Mira la carpeta de la serie y todo lo que tenga adentro (carpetas de saga o de tomo, archivos guardados con otra plantilla), y también las carpetas que se llaman igual salvo por mayúsculas, acentos o palabras de relleno: "One Piece" y "One Piece Manga" son la misma.
- **No compara series por parecido:** "Dragon Ball" y "Dragon Ball Super" son dos. Si lo hiciera, marcaría como bajados capítulos que no tenés.
- **Cuenta cualquier formato:** si lo tenés en CBZ y está tildado PDF, figura igual como que ya está, y dice **✔ ya está en CBZ**. Al descargar, en cambio, "Saltear" sí mira el formato tildado: si tildás a propósito uno que tenés en otro formato, se baja.

Con **Saltear lo que ya está en la carpeta**, al descargar se usa el mismo criterio: lo que ya está con otro nombre no se baja de nuevo.

### Seguir una serie y buscar lo nuevo

En la lista de capítulos de una serie, **📌 Seguir esta serie** la suma a **Siguiendo** (arriba). Desde ese panel:

- **Buscar lo nuevo** abre la página de cada serie seguida, de a una y con una pausa, y dice qué capítulos hay que no tenés: "One Piece: 3 nuevos: 1200–1202". "Nuevos" son los posteriores al último que tenés; si faltan otros más atrás, los nombra aparte.
- **Bajar N** pone en la cola lo nuevo de esa serie, con su nombre. **Bajar todo lo nuevo** hace lo mismo con todas.
- Tocar una serie la abre, y la ✕ la deja de seguir.

Siempre arranca con un toque tuyo: el programa no revisa nada por su cuenta ni en segundo plano.

### El registro: lo que ya bajaste, aunque ya no esté

El programa anota cada capítulo que termina de bajar. Ese registro no depende de los archivos: sigue ahí aunque los muevas, los subas a otro lado o los borres.

- **En una lista de capítulos**, lo que bajaste y ya no está en la carpeta aparece con **✔ ya lo bajaste** (con la fecha al pasar el mouse), y no entra en "Te faltan" ni en **Marcar los que faltan**.
- **En un catálogo**, los títulos de los que ya bajaste algo aparecen con **✔ N bajados**. Así, si volvés a encontrar una serie en otro sitio, se ve de entrada que ya la tenés empezada.
- **🗂 Historial** (arriba) muestra todo el registro por serie: cuántos capítulos, de cuál a cuál, cuáles faltan en el medio y cuándo fue el último. Se busca por serie, y la ✕ quita una serie del registro sin borrar ningún archivo.
- **Saltear** sigue mirando solo los archivos: si algo figura en el registro pero ya no lo tenés y lo tildás, se baja de nuevo.

El registro vive en `descargas.json`, al lado de la configuración. Anota lo que se baja con el programa desde esta versión; lo que bajaste antes no está, pero se reconoce igual si los archivos siguen en la carpeta o en tu colección.

### Tu colección (y Google Drive)

En **Tu colección** (a la derecha) se agregan otras carpetas donde mirar lo que ya tenés, además de la de descargas: donde guardás tus mangas, cómics o libros.

- **Se busca la carpeta de la serie por su nombre**, hasta dos niveles adentro: sirve tanto `Mangas/One Piece` como `One Piece` suelto.
- **Los capítulos se reconocen** si el archivo dice "Capítulo 12" o "#12", o lleva el número con tres cifras o más (`One Piece 0012`, `Avengers 012`). No cuentan un año entre paréntesis ("(2018)") ni el número de un tomo: "Tomo 12" no es el capítulo 12.
- **Aunque no reconozca los capítulos**, en un catálogo el título aparece con **✔ en tu colección** y dice en qué carpeta está.
- Lo que está en tu colección también se saltea al descargar.
- **Si una carpeta no está a la vista** (Google Drive cerrado, un disco sin conectar), aparece un aviso arriba: mientras tanto, lo que tengas ahí no figura como tenido y podrías bajarlo de nuevo. Tampoco deja descargar a una carpeta que no está.
- **Atar una carpeta a una serie:** cuando la carpeta se llama distinto que la serie ("Una Pieza" con capítulos de One Piece), en la lista de capítulos está **Elegir su carpeta…**: la elegís una vez y de ahí en más cuenta para esa serie. Si el programa encontró una de nombre parecido, ofrece directamente **Es «…»**. **Quitar el vínculo** la suelta; nunca se borra nada.
- **Nombres parecidos:** si no hay una carpeta con el nombre de la serie pero sí una que empieza igual ("Dragon Ball Super" y "Dragon Ball Super Manga Color"), el programa lo avisa con **≈ parecido** en el catálogo y con una línea en la lista de capítulos. Es solo una pista para que mires: no marca nada como tenido ni saltea nada.

**Con Google Drive.** El programa no entra a tu cuenta de Google: usa la carpeta que Google Drive deja en tu máquina.

1. Instalá [Google Drive para ordenadores](https://www.google.com/drive/download/) e iniciá sesión. Aparece una unidad nueva, por ejemplo `G:\Mi unidad`.
2. En el programa, en **Tu colección**, agregá la carpeta donde están tus mangas (por ejemplo `G:\Mi unidad\Mangas`). Desde ahí las listas marcan lo que ya tenés.
3. Si querés que lo nuevo vaya directo al Drive, elegí una carpeta del Drive en **Carpeta**: lo que se guarda ahí lo sube Google Drive solo.

Una forma cómoda de ordenarlo: una carpeta del Drive solo para lo que baja el programa (por ejemplo `Descargas Manga Reader`) como **Carpeta**, y las carpetas donde después lo acomodás (`Manga`, `Comics`, `Libros`) en **Tu colección**. Al mover algo de una a las otras, el programa lo sigue encontrando, y el registro lo recuerda aunque le cambies el nombre.

### Favoritos

El botón **⭐ Favoritos** abre tu lista de direcciones: sitios, catálogos o series a los que volvés seguido. Queda guardada en tu máquina entre una sesión y otra.

Al abrirlo aparecen el cuadro para pegar, ya con el cursor, y debajo la lista.

- **Pegá un link o muchos** en el cuadro (`Ctrl+V`) y quedan guardados en el momento, todos juntos. Un link por renglón, escrito como lo tengas:
  - `Mi sitio: https://sitio.com/ — lo que quieras anotar`
  - `- [Mi sitio](https://sitio.com/) una nota`
  - `https://sitio.com/catalogo` o `sitio.com/catalogo` (el nombre sale de la dirección)
  - Un renglón sin link es un título de grupo ("Manga en español:"): no se guarda, pero el tipo y el idioma que nombra valen para los que siguen.
  - También se puede pegar el contenido del archivo de sitios que exporta la extensión.
- **Si lo escribís a mano**, tocá **Guardar en favoritos** (o `Ctrl+Enter`).
- **＋ La dirección de arriba** guarda la que está en el cuadro principal. Si ya la analizaste, queda con el título de la página; si no, con el nombre del sitio.
- **Tocá un favorito** y lo analiza, igual que si lo pegaras arriba.
- **Los repetidos no entran:** la misma dirección con o sin `www.` o barra final cuenta como una sola. El aviso dice cuántos se guardaron y cuántos ya estaban.
- **Filtros:** un buscador (nombre, dirección o nota), **Tipo** (Manga o Cómics) e **Idioma** (Español, Inglés o sin idioma anotado). Se suman. Cada favorito muestra su tipo y su idioma, que se detectan al pegarlo; el que no dice de qué tipo es vale para los dos.
- La **✕** de cada renglón lo quita, y **Quitar todos** pide un segundo toque para confirmar.

La lista vive en `links.json`, dentro de la carpeta de datos del programa (en Windows, `%APPDATA%\manga-reader-programa`). No se sube a ningún lado. Para llevarla a otra máquina alcanza con copiar ese archivo.

### Nombres y carpetas

- Los archivos salen como `Serie/Saga/Serie 0012.pdf`, igual que en la extensión.
- **Serie:** al entrar a un título desde una lista (con la flecha › o tocando su tapa), el programa pone su nombre en el cuadro, con borde violeta. Así todos los capítulos de esa serie se guardan con el mismo nombre, en vez de depender del título de cada página, que a veces cambia y termina en dos carpetas. Si no es el que va, se escribe otro y el programa no lo vuelve a tocar. Si abrís un capítulo directo, sin pasar por una lista, pone la serie que dice el título de esa página. Al analizar otra dirección o abrir un favorito, la serie puesta sola se borra.
- **Serie vacía:** la serie sale del título de cada capítulo.
- El número es el de la lista. Si la lista no tiene número, sale del título del capítulo.
- **Saltear lo que ya está en la carpeta** mira el disco. Si lo destildás, no pisa nada: guarda `nombre (1).pdf`.

En **Nombres y sagas** (a la derecha, plegado) hay dos cosas más:

**Plantilla del nombre.** Otra forma de armar las carpetas y el nombre. Una `/` crea una carpeta y lo que va entre llaves se reemplaza por el dato de cada capítulo:

| Marcador | Qué pone |
|---|---|
| `{serie}` | El nombre de la serie |
| `{numero}` | El número del capítulo, con 4 cifras (`0005`) |
| `{saga}` | La saga, si la serie tiene sagas cargadas |
| `{volumen}` | El tomo del capítulo, cuando la página separa los capítulos en tomos |
| `{titulo}` | El nombre del capítulo en la lista |
| `{anio}` | El año en que lo guardás |
| `{sitio}` | El sitio de donde sale |

- Hay cuatro armadas: **De siempre**, **Por tomo**, **Con título** y **Por sitio**.
- Se guarda al escribirla, y debajo se ve cómo quedaría un capítulo bajado de una lista y uno suelto.
- Si un dato está vacío no queda nada en su lugar: ni la carpeta, ni el guion que lo separaba.
- Avisa si faltan `{numero}` y `{titulo}` (todos los capítulos se llamarían igual) o si un marcador no existe.

**Sagas propias.** Para que los capítulos de una serie se repartan en una carpeta por saga. Se escribe el nombre de la serie y, debajo, una saga por renglón con desde qué capítulo hasta cuál:

```
Naruto
1-244 Parte 1
245- Shippuden
```

Con eso, el capítulo 300 de Naruto se guarda en `Naruto/02 Shippuden/Naruto 0300.pdf`. Entre una serie y otra va un renglón en blanco. Viene incluida la de One Piece; las tuyas se suman y, si son de la misma serie, la reemplazan. Es el mismo formato que usa la extensión: se puede copiar de una a otra.

### La cola

Baja de a un capítulo, con una pausa entre uno y otro. Cada renglón dice en qué anda y, si falló, por qué.

- **Cancelar** corta lo que falta.
- **Reintentar lo que falló** vuelve a poner en la cola todo lo que falló, quedó incompleto o se canceló. De lo incompleto borra antes los archivos que había escrito, para que no quede `nombre (1).pdf` al lado del que salió mal.
- **El avance se ve en el ícono** de la barra de tareas.
- **Al terminar**, si el programa no está a la vista, Windows muestra un aviso con el resumen ("12 guardados · 1 con problemas") y el ícono titila.

## Qué no hace todavía

- **El instalador no está firmado**, y no se actualiza solo: para una versión nueva se arma y se instala otro.
- **Al bajar varios capítulos no se revisan las páginas de cada uno:** va el filtro automático. La revisión es para un capítulo por vez.
- **Las tapas son las que la página muestra.** Si una página no pone una imagen junto a cada título, no hay mosaico. Las miniaturas se piden a medida que quedan a la vista, de a 4, y no se guardan en el disco: al cerrar el programa se olvidan.
- **Las sagas y la plantilla no se sincronizan con la extensión:** se copian a mano de una a otra. Los favoritos tampoco: son dos listas.
- **No se conecta a Google Drive por internet:** usa la carpeta que Google Drive para ordenadores deja en la máquina. Sin eso instalado, no ve lo que tenés en el Drive.
- **En tu colección, las series se encuentran por el nombre de su carpeta.** Si la carpeta se llama distinto que la serie, o está más de dos niveles adentro, no la ve.
- **No recorre un sitio entero** de un saque: va nivel por nivel, y "Traer todas" para a las 50 páginas.
- **Encuentra el catálogo por el nombre del link o por su dirección** ("Biblioteca", "Directorio", `/library`, `/series`…). Si el sitio lo llama de otra forma, hay que entrar a mano tocando su link en la lista.
- **Los géneros se reconocen por una palabra de su dirección** (`/genero/`, `/tag/`, `?genre=`…). Si un sitio los arma de otra forma, pueden salir entre los títulos.
- **El buscador del sitio se encuentra de tres formas:** el que el sitio declara (schema.org), un formulario de búsqueda, o un cuadro de búsqueda suelto donde el programa escribe. Si el sitio lo muestra recién al tocar una lupa, o pide iniciar sesión, no aparece.
- **"Completar" solo sirve si la dirección lleva el número** (`…/capitulo-7`). Si cada capítulo tiene un código, no hay forma de armar las que faltan.
- **Una lista cuyos renglones no son links** (se abren con JavaScript) no se puede leer: el programa necesita la dirección de cada capítulo.
- **Las tarjetas con tapa se toman por títulos,** aunque digan "Cap. 12". Si una serie muestra sus capítulos con una miniatura cada uno y sin el número en la dirección, salen como "Títulos y links": con **Son capítulos** se tildan igual.
- **Los capítulos se reconocen por su número.** Una serie que los nombra sin número ("Prólogo", "El viaje") sale como "Títulos y links": con **Son capítulos** se tildan igual, y se bajan en el orden de la página.
- **Reconoce las tapas porque son links.** Si un sitio arma su portada con tapas que no llevan a ningún lado (se abren con JavaScript), la puede seguir tomando por un capítulo. En la portada de un sitio igual entra al listado completo si lo encuentra, y en cualquier página queda el botón **📚 El catálogo del sitio**
- **Un listado que carga al bajar** se recorre hasta 30 pantallas. Si seguía creciendo, avisa que puede faltar algo.
- **No guarda páginas protegidas** (las que un sitio entrega cifradas): en esos casos dice que no encontró páginas.

## Cómo está armado

| Carpeta o archivo | Qué es |
|---|---|
| `src/main.js` | El proceso principal: abre las páginas en ventanas ocultas, maneja la cola, mira el disco y escribe los archivos |
| `src/pagina/explorar.js` | El explorador: corre dentro de cada página y devuelve sus listas de links y sus páginas |
| `src/armador/` | Ventana oculta que baja las imágenes y arma PDF, CBZ e imágenes |
| `src/ui/` | La interfaz |
| `src/preload_ui.js` | Lo único que la interfaz puede pedirle al programa |
| `scripts/generar.js` | Arma `generado/` con el código de la última versión de la extensión |
| `scripts/abrir.js` | Genera y lanza Electron |
| `scripts/instalador.js` | Genera y arma el instalador de Windows en `dist/` |
| `build/icon.png` | El ícono del programa |
| `generado/`, `dist/` | Se crean solos. No se editan ni se suben al repositorio |
| `tests/` | El sitio de prueba y las pruebas |

- **El código compartido no se copia a mano.** `generar.js` saca de la extensión las funciones de detección, nombres y capítulos (`content.js`), el agrupado por tomos (`agrupar.js`), la plantilla de nombres (`plantilla.js`), el armado de archivos (`offscreen.js`), la lectura de una lista de links pegada (`sitios.js`) y la lectura de las sagas (`opciones.js`). Un arreglo en la extensión llega al programa la próxima vez que se abre. El instalador lleva adentro la copia del momento en que se armó.
- **Las páginas web corren aisladas:** sin acceso a Node ni al disco, sin poder abrir ventanas, bajar archivos por su cuenta ni pedir permisos.
- **Las imágenes se piden con el Referer del capítulo,** como lo haría el navegador. Hay servidores que sin eso contestan 403.
- **La interfaz no carga nada de internet por su cuenta.** Las tapas y las miniaturas de las páginas las pide el programa con la sesión de las páginas (y su Referer), las achica a 240 px de ancho y se las pasa a la interfaz ya como imagen incrustada.
- **Los datos van siempre a la misma carpeta** (`%APPDATA%\manga-reader-programa`), se abra con `npm start` o instalado: `config.json` (opciones, plantilla, sagas, direcciones recientes, carpetas de tu colección), `links.json` (favoritos) y `descargas.json` (el registro de lo que se bajó).

## Pruebas

```bash
npm run prueba
```

Corren dentro de Electron contra un sitio de prueba servido en la máquina. Son 174 comprobaciones:

- **Explorar:** portada, catálogo paginado, directorio que carga al bajar, serie y capítulo.
- **Portada con tapas:** que no pase por capítulo (y que un capítulo con tapas al final lo siga siendo), que cada título traiga su tapa y que la miniatura se pida con el Referer del sitio.
- **El buscador del sitio:** encontrarlo en un formulario, en lo que declara el sitio y en un cuadro suelto; buscar con cada uno; un resultado solo; lo buscado bien escrito en la dirección.
- **Listas incompletas o escondidas:** el molde para completar por número (con y sin ceros adelante), la pestaña "Capítulos" con "Mostrar más" y el panel con barra propia.
- **Tarjetas:** que las que tienen tapa sean títulos aunque digan "Cap. N" o lleven un código, y que de cada una quede el nombre aparte de lo demás.
- **Catálogo, géneros y capítulos en renglones:** el link al listado que trae orden y número de página, los géneros aparte de los títulos, y una serie con el número en el renglón y más de un link por capítulo.
- **Renglones con link `#`:** capítulos cuyo link es un hash de la página (con el link real adentro) y listas ocultas; que el botón `#` de un menú no le cambie el nombre a un link, y que un `data-chapter-number` que no es un número no cuente.
- **Bajar:** los tres formatos a una carpeta temporal, lo que ya estaba, lo que falla.
- **Lo que ya está:** por número, con otros nombres de archivo y en carpetas que se llaman casi igual; que otra serie parecida no cuente; cada formato aparte.
- **Plantilla y sagas:** el tomo y el nombre del capítulo en el nombre del archivo, y la carpeta por saga.
- **Reintentar:** un capítulo que queda incompleto sale entero al reintentar, sin archivo repetido.
- **Revisar páginas:** todas las imágenes con el motivo de las descartadas, y la bajada con las elegidas a mano.
- **Carpetas y series seguidas:** el aviso cuando una carpeta no está, atar a una serie una carpeta de otro nombre, y buscar y bajar lo nuevo de las series seguidas.
- **El registro y tu colección:** lo que se bajó sigue marcado aunque se borre el archivo; una carpeta de colección con otra organización; los títulos de un catálogo de los que ya hay algo.
- **Favoritos:** pegar, buscar, filtrar por tipo e idioma y quitar.
- **La interfaz:** todo lo anterior manejado desde la pantalla, más "Traer todas", las direcciones recientes y la serie puesta sola.

Durante las pruebas el programa arranca con todo de fábrica y no escribe ni la configuración ni los favoritos, ni el registro, así que no tocan los tuyos. Con `CAPTURAS=<carpeta>` guardan además capturas de la interfaz.
