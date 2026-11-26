# 📖 Manga Reader — programa de escritorio

Explora una página web por niveles (títulos → capítulos → páginas) y guarda los capítulos que elijas como **PDF**, **CBZ** o **imágenes**, en la carpeta que quieras.

Todo corre en tu máquina: no hay servidor ni cuenta. Es independiente de la extensión de Chrome y usa su mismo código para detectar páginas, armar nombres y generar los archivos.

**Estado: versión 0.11.0.** Funciona de punta a punta sobre los sitios de prueba. Los cambios de cada versión están en las [Actualizaciones](../README.md#actualizaciones) del README principal.

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

### Ver todo el sitio: la galería (0.11.0)

**Ver todo el sitio**, al lado de Analizar, toma la dirección pegada y arma la galería del sitio: todos los títulos de su listado, cada uno con su tapa. No cambia la exploración por niveles: la usa por detrás, y lo que se ve es la galería.

- **Sirve cualquier dirección del sitio.** Si es su listado, arranca ahí (y si es la portada y tiene el link a su listado completo, entra a ese). Si es un capítulo o una serie, sube sola hasta el listado. Si el sitio no tiene un listado recorrible, lo dice con esas palabras y muestra la página con la exploración de siempre.
- **Mientras recorre** dice cuántas páginas y cuántos títulos lleva, y las tapas van apareciendo. **Cancelar** corta en el acto y deja lo juntado.
- **El tope:** lee hasta 60 páginas del listado por corrida (se cambia en la galería, hasta 5.000, y queda guardado). Si el listado es más largo, la galería queda incompleta y lo dice; **Seguir desde donde quedó** continúa en la página siguiente. Cada página lleva unos 6 segundos: un catálogo de 1.300 páginas son más de dos horas.
- **Va despacio a propósito:** entre una página y la otra espera lo mismo que la cola, y si el sitio pide esperar (429 o 503) frena igual que la cola, y se puede retomar.
- **Buscador y filtros:** por nombre; lo que ya tengo (bajaste algo con el programa o está en tu colección) y lo que me falta; con tapa y sin tapa; desaparecidas; y tipo e idioma, si las tarjetas del sitio los dicen. Se combinan y quedan puestos para la próxima vez.
- **Las tapas son las del sitio.** Si una no carga queda un recuadro con la inicial; si el sitio no da tapas, la galería funciona igual.
- **Queda guardada por sitio,** con su fecha: la próxima vez aparece al instante, sin pedirle nada al sitio. **Refrescar** la recorre de nuevo: lo nuevo se suma, y lo que ya no aparece queda marcado como **desaparecida** (no se borra; si vuelve, se le saca la marca). **Olvidar** la borra.
- **Tocar una tapa** abre sus capítulos con la exploración de siempre, con su nombre puesto como serie. Un botón vuelve a la galería. Si en "Serie" había un nombre escrito a mano, queda ese (la serie escrita a mano no se pisa, como siempre): conviene borrarlo antes de pasar a otra serie.
- **Marcar series** (la casilla de cada tapa, o "Marcar las que se ven" con los filtros puestos): **Buscar lo nuevo** dice qué capítulos hay que no tenés de cada una, y **Encolar lo nuevo** los pone todos en la cola.

Lo que no recorre, y por qué, está en la sección 16 de [DOCUMENTACION.md](../DOCUMENTACION.md), con los resultados contra sitios de verdad.

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

- **Cancelar** corta lo que falta. El capítulo en curso se corta en el acto (0.10.4): se cierra su ventana y se borra lo que alcanzó a escribir.
- **Reintentar lo que falló** vuelve a poner en la cola todo lo que falló, quedó incompleto o se canceló. Antes borra los archivos que ese capítulo había escrito, para que no quede `nombre (1).pdf` al lado del que salió mal. Si cancelaste y reintentaste en medio de una bajada, el intento anterior se corta antes de que salga el nuevo (0.10.4; hasta la 0.10.3 seguía con su ventana abierta hasta terminar el paso en el que estaba).
- **Si el sitio pide esperar** (responde 429 o 503), el renglón lo dice: "el sitio pidió esperar", y el programa no le vuelve a pedir nada a ese sitio hasta que pase el freno: ni el capítulo que sigue en la cola ni un reintento, aunque toques **Reintentar** enseguida (el renglón muestra "el sitio pidió esperar: sigo en N s"). El freno es el mismo de la extensión: lo que pidió en `Retry-After` con tope de un minuto; **un minuto** si no dijo cuánto (o mandó algo que no se entiende, o una fecha vencida); nada con `Retry-After: 0`. La regla está escrita una sola vez, en la sección 4.19 de [DOCUMENTACION.md](../DOCUMENTACION.md). Vale igual para la página del capítulo y para sus imágenes (0.10.3; hasta la 0.10.2, sin cabecera seguía la pausa de siempre).
- **Si una página queda afuera porque el sitio pidió esperar,** el capítulo no se guarda a medias: queda "incompleto · no guardé nada, para no dejarlo a medias · el sitio pidió esperar (HTTP 503)", sin ningún archivo, para **Reintentar** (0.10.3). Vale cuando lo dice el armador y cuando el sitio contesta 429 o 503 a las imágenes que carga la página misma: cuenta una de la carpeta de las páginas del capítulo que no quedó entre ellas (si después cargó, no faltó; un aviso o la tapa de un "relacionado", de otra carpeta, no cortan nada). Un 429 sin cuerpo frena igual que cualquier otro. Si el capítulo ya estaba en la carpeta, sigue siendo "ya estaba".
- **Reintentar no se gasta:** un capítulo que falló dos veces se puede reintentar otra vez, y cada intento respeta el freno.
- **El avance se ve en el ícono** de la barra de tareas.
- **Al terminar**, si el programa no está a la vista, Windows muestra un aviso con el resumen ("12 guardados · 1 con problemas") y el ícono titila. El aviso trae los botones de la ventana (0.10.3): **Reintentar N que falló** (si algo falló), **Limpiar terminados** y **Abrir carpeta**. Cada uno hace lo mismo que su botón, por el mismo camino; el de reintentar respeta el freno del sitio. El primero también sale en pantalla (0.10.4): con `npm start`, la primera vez el programa prepara los avisos al arrancar (Electron crea su acceso directo en el menú Inicio con un aviso mudo), y si la cola termina en esos primeros segundos su aviso espera un poco, hasta que Windows toma el acceso directo. Con el programa instalado, el acceso directo lo deja el instalador. Hasta la 0.10.3, ese primer aviso quedaba en el centro de notificaciones (Win + N).

### Probar contra un sitio que pide esperar (el proxy de prueba)

`tests/proxy.js` es un proxy chico, sin dependencias, que se pone entre el programa y un sitio de verdad, reenvía todo y, cuando uno quiere, contesta 429 o 503 (con `Retry-After` o sin él), con contador y corte a partir del pedido N:

```bash
node tests/proxy.js --sitio https://one-piece-fans2.com --codigo 503 --retry-after 5 --solo paginas --veces 1
MR_PROXY=http://127.0.0.1:PUERTO npm start        # o: npm start -- --proxy=http://127.0.0.1:PUERTO
```

El programa le pregunta al proxy a qué sitio reenvía y le manda todo lo de ese sitio (la barra de título lo dice). Sin `MR_PROXY` ni `--proxy=` no se registra nada y todo va directo. Las opciones del proxy (`--desde`, `--veces`, `--ruta`, `--solo imagenes|paginas`) y los resultados de las corridas reales están en la sección 11 de [DOCUMENTACION.md](../DOCUMENTACION.md).

Desde la 0.10.4:

- **Con el proxy en uso se pide sin caché.** El programa limpia la caché al empezar a usarlo y manda `Cache-Control: no-cache` a lo de ese sitio. Así el armador vuelve a pedir por el proxy las imágenes que la página ya bajó, y el proxy también lo puede cortar a él. Sin el proxy, las imágenes se cachean como siempre.
- **Si el programa ya estaba abierto,** `MR_PROXY` no le llega a esa ventana: la ventana lo dice, con el botón **Cerrar y abrir de nuevo con el proxy**.
- **Todo junto, contra un sitio real y sin dejar archivos:** `node tests/proxy-real.js <dirección del capítulo> [la regla del proxy]` arranca el proxy, abre el programa con `MR_PROXY` y una carpeta de datos aparte, baja el capítulo, toca Reintentar si hace falta y muestra cada pedido que pasó por el proxy.

```bash
node tests/proxy-real.js https://one-piece-fans2.com/manga/es/todos/1104 --codigo 503 --solo imagenes --desde 3 --veces 2
```

## Qué no hace todavía

- **El instalador no está firmado**, y no se actualiza solo: para una versión nueva se arma y se instala otro.
- **Al bajar varios capítulos no se revisan las páginas de cada uno:** va el filtro automático. La revisión es para un capítulo por vez.
- **Las tapas son las que la página muestra.** Si una página no pone una imagen junto a cada título, no hay mosaico. Las miniaturas se piden a medida que quedan a la vista, de a 4, y no se guardan en el disco: al cerrar el programa se olvidan.
- **Las sagas y la plantilla no se sincronizan con la extensión:** se copian a mano de una a otra. Los favoritos tampoco: son dos listas.
- **No se conecta a Google Drive por internet:** usa la carpeta que Google Drive para ordenadores deja en la máquina. Sin eso instalado, no ve lo que tenés en el Drive.
- **En tu colección, las series se encuentran por el nombre de su carpeta.** Si la carpeta se llama distinto que la serie, o está más de dos niveles adentro, no la ve.
- **La galería ("Ver todo el sitio") no sigue una barra de páginas de solo números,** sin nada que marque cuál es la siguiente: lee la primera página y dice que quedó incompleta. Tampoco recorre un listado con tapas del tamaño de una página cuyos títulos cuelgan de la dirección del propio listado: la exploración lo toma por un capítulo.
- **Un catálogo grande no sale de una sola vez:** son unos 6 segundos por página. Se sube el tope o se sigue de a corridas. Explorando por niveles, "Traer todas" para a las 50 páginas.
- **La galería es una por sitio:** si un sitio tiene varios listados (por letra, por género), recorre uno.
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
| `src/freno.js` | El freno de la cola: la regla de la extensión (`esperaDelSitio` de `ajustes.js`), sin copiarla |
| `src/galeria.js` | La galería del sitio: el recorrido del listado (por dónde empieza, cuándo para, qué guarda). Usa la exploración de siempre |
| `src/pagina/galeria.js` | Lo de la galería que corre dentro de cada página: las tarjetas de la grilla y el aviso de páginas numeradas. No cambia el explorador |
| `tests/` | El sitio de prueba (`sitio.js`), el proxy de prueba (`proxy.js`), las pruebas (`prueba.js`, `freno.js`, `galeria.js`) y las que usan el programa de verdad (`avisos.js` con `clic-aviso.ps1` y `limpiar-avisos.ps1`; `proxy-abierto.js`, `proxy-real.js` y `galeria-real.js` con `ventana.js`) |

- **El código compartido no se copia a mano.** `generar.js` saca de la extensión las funciones de detección, nombres y capítulos (`content.js`), el agrupado por tomos (`agrupar.js`), la plantilla de nombres (`plantilla.js`), el armado de archivos (`offscreen.js`), la lectura de una lista de links pegada (`sitios.js`) y la lectura de las sagas (`opciones.js`). Un arreglo en la extensión llega al programa la próxima vez que se abre. El instalador lleva adentro la copia del momento en que se armó.
- **Las páginas web corren aisladas:** sin acceso a Node ni al disco, sin poder abrir ventanas, bajar archivos por su cuenta ni pedir permisos.
- **Las imágenes se piden con el Referer del capítulo,** como lo haría el navegador. Hay servidores que sin eso contestan 403.
- **La interfaz no carga nada de internet por su cuenta.** Las tapas y las miniaturas de las páginas las pide el programa con la sesión de las páginas (y su Referer), las achica a 240 px de ancho y se las pasa a la interfaz ya como imagen incrustada.
- **Los datos van siempre a la misma carpeta** (`%APPDATA%\manga-reader-programa`), se abra con `npm start` o instalado: `config.json` (opciones, plantilla, sagas, direcciones recientes, carpetas de tu colección), `links.json` (favoritos) y `descargas.json` (el registro de lo que se bajó).

## Pruebas

```bash
npm run prueba
```

Corren dentro de Electron contra un sitio de prueba servido en la máquina, y tardan 10 min 47 s (la 0.10.4, con 234, tardaba 7 min 46 s). Son 291 comprobaciones:

- **Explorar:** portada, catálogo paginado, directorio que carga al bajar, serie y capítulo.
- **Portada con tapas:** que no pase por capítulo (y que un capítulo con tapas al final lo siga siendo), que cada título traiga su tapa y que la miniatura se pida con el Referer del sitio.
- **El buscador del sitio:** encontrarlo en un formulario, en lo que declara el sitio y en un cuadro suelto; buscar con cada uno; un resultado solo; lo buscado bien escrito en la dirección.
- **Listas incompletas o escondidas:** el molde para completar por número (con y sin ceros adelante), la pestaña "Capítulos" con "Mostrar más" y el panel con barra propia.
- **Tarjetas:** que las que tienen tapa sean títulos aunque digan "Cap. N" o lleven un código, y que de cada una quede el nombre aparte de lo demás.
- **Catálogo, géneros y capítulos en renglones:** el link al listado que trae orden y número de página, los géneros aparte de los títulos, y una serie con el número en el renglón y más de un link por capítulo.
- **Renglones con link `#`:** capítulos cuyo link es un hash de la página, con el link real adentro, el número en un atributo y un código en la dirección; listas ocultas, un capítulo subido tres veces y los botones "Empezar a leer" y "Último capítulo". Que un renglón sin link real se descarte sin quedarse con el de al lado, que el botón `#` de un menú no le cambie el nombre a un link, y que no cuenten un atributo que no es un número, un `data-number` puesto en el bloque que envuelve la lista, uno con la posición del renglón ni el puesto de un ranking de series.
- **Bajar:** los tres formatos a una carpeta temporal, lo que ya estaba, lo que falla.
- **Lo que ya está:** por número, con otros nombres de archivo y en carpetas que se llaman casi igual; que otra serie parecida no cuente; cada formato aparte.
- **Plantilla y sagas:** el tomo y el nombre del capítulo en el nombre del archivo, y la carpeta por saga.
- **El freno, en Node** (también solo: `node tests/freno.js`): `esperaPedida` con "0", "3", una fecha vencida, "300" y vacío, y que el freno del programa sea el de la extensión en todos los casos.
- **Reintentar:** la página que le falta a un capítulo responde 503 las seis veces que el armador la pide (se cuentan los pedidos y se mide el tiempo entre el primero y el último: más de 16 s); el capítulo queda incompleto sin ningún archivo, el sitio frenado un minuto, y al reintentar sale entero.
- **El sitio pide esperar:** la página de un capítulo responde 503 sin `Retry-After` (el sitio queda frenado un minuto: el capítulo que sigue queda en cola diciendo "sigo en N s" y no se pide) y con `Retry-After: 3` (ni el reintento ni el capítulo siguiente se piden antes de los 3 s); y una imagen con `Retry-After: 3` se vuelve a pedir recién a los 3 s. Todo medido por la hora a la que le llega cada pedido al sitio de prueba.
- **Un 429 sin cuerpo y la tapa de un "relacionado" que responde 503** (sitio de prueba): el primero llega como una navegación con su código y frena un minuto (la prueba dice por dónde se supo); el segundo no corta el capítulo ni frena el sitio.
- **A través del proxy de prueba** (desde la interfaz): 503 y 429 sin cabecera (al tocar Reintentar, la cuenta arranca cerca de 60; en el mismo instante del clic en Cancelar se leen el número y los botones, y el reintento no sale), 503 con `Retry-After: 5` (cuenta hasta 1, sale a los 5 s o más y completa), corte desde el 6.º pedido (incompleto, con el motivo y sin archivo), un capítulo que ya estaba con una imagen que pide esperar ("ya estaba", y el sitio frenado), dos fallos seguidos del mismo capítulo (el botón se sigue ofreciendo y el tercer intento sale, respetando el freno) y los botones del aviso de fin de cola (cada uno dispara el mismo manejador que su botón de la ventana). Y que sin el proxy todo va directo.
- **El proxy y la caché** (0.10.4; el sitio de prueba deja cachear esas imágenes una hora): con el proxy, el armador vuelve a pedir por él las 6 imágenes que la página ya bajó, con `no-cache`; un 503 en cada pedido del armador por una de ellas deja el capítulo incompleto, sin archivo, y al reintentar baja entero. Sin el proxy, cada imagen se pide una sola vez y nada sale con `no-cache`.
- **Cancelar y reintentar en medio de una bajada** (0.10.4; el sitio de prueba retiene la página o las imágenes a pedido): mientras la página tarda en abrir, mientras el armador baja y mientras escribe. La ventana del intento viejo se cierra en menos de 2 s, el nuevo sale y queda un solo archivo entero, sin "(1)". Cancelar solo no deja nada del capítulo, ni su carpeta.
- **La galería del sitio, en Node** (0.11.0; también sola: `node tests/galeria.js`, con un sitio de mentira): las reglas del recorrido; que la galería se guarde en el disco y se vuelva a leer; que un refresco cortado no marque nada como desaparecido y, al seguirlo hasta el final, sí; y un recorrido largo interrumpido, que queda con lo juntado y se sigue desde ahí.
- **La galería del sitio** (0.11.0; un sitio de prueba por caso, por la interfaz y por el programa): un listado de 3 páginas con "Siguiente"; números de página, "Cargar más", uno que carga al bajar y uno de una sola página; una barra de solo números (incompleta, y lo dice); destacados repetidos en todas las páginas; un listado que da vueltas; un catálogo que mezcla carpetas en una misma grilla; el tope, "Seguir desde donde quedó" y Cancelar; un 503 en una página del listado (frena y se retoma); subir desde un capítulo; un sitio sin listado; las tapas con su Referer, una que no carga y un sitio sin tapas; el buscador y cada filtro, por separado y combinados, y que se recuerden; lo bajado marcado; marcar series, buscar lo nuevo y encolarlo; refrescar con un título que desaparece; y "Olvidar".
- **Páginas dibujadas de fondo:** la página de prueba de la extensión (8 páginas de fondo y 18 tapas alrededor): el explorador la toma por capítulo, devuelve las 8 en orden y ninguna tapa, y la baja entera.
- **Revisar páginas:** todas las imágenes con el motivo de las descartadas, y la bajada con las elegidas a mano.
- **Carpetas y series seguidas:** el aviso cuando una carpeta no está, atar a una serie una carpeta de otro nombre, y buscar y bajar lo nuevo de las series seguidas.
- **El registro y tu colección:** lo que se bajó sigue marcado aunque se borre el archivo; una carpeta de colección con otra organización; los títulos de un catálogo de los que ya hay algo.
- **Favoritos:** pegar, buscar, filtrar por tipo e idioma y quitar.
- **La interfaz:** todo lo anterior manejado desde la pantalla, más "Traer todas", las direcciones recientes y la serie puesta sola.

Aparte están las pruebas con el programa de verdad. No son parte de `npm run prueba`. Las de los avisos muestran cosas en la pantalla; las que abren el programa (con `tests/ventana.js`) no muestran su ventana, salvo con `VENTANA=1`.

- **Los botones del aviso, apretados de verdad:** `npm run avisos` muestra el aviso de fin de cola y aprieta cada botón con `tests/clic-aviso.ps1` (UI Automation de Windows, sin mover el mouse; espera 1,5 s antes de tocar, porque un toque en la animación de entrada del aviso se pierde). Abre una ventana del Explorador y la cierra al terminar. Cada aviso se aprieta al primer intento: si no sale en pantalla, la prueba falla (hasta la 0.10.3 lo mostraba otra vez). El que aprieta arranca antes de que salga el aviso, para estar mirando la pantalla cuando aparece.
- **El primer aviso, desde cero:** `npm run avisos:limpio` borra antes lo que el programa dejó en Windows (`tests/limpiar-avisos.ps1`: su acceso directo del menú Inicio, las claves de los botones y el ajuste de sus avisos) y corre la misma prueba. `npm run avisos:limpiar` solo borra, y es lo que conviene correr al terminar.
- **Sobre el programa instalado:** `"%LOCALAPPDATA%\Programs\Manga Reader\Manga Reader.exe" --prueba --avisos --pruebas=<carpeta tests de este repositorio>` (el instalado no trae las pruebas).
- **`MR_PROXY` con el programa ya abierto:** `npm run proxy-abierto` abre el programa dos veces, la segunda con el proxy, y comprueba que la ventana que estaba lo diga y que su botón lo vuelva a abrir con el proxy. Usa una carpeta de datos aparte (`MR_DATOS`), y lee y toca la ventana por el protocolo de depuración (`tests/ventana.js`).

- **La galería de un sitio de verdad:** `node tests/galeria-real.js <dirección> [tope]` abre el programa con una carpeta de datos aparte, toca "Ver todo el sitio" y cuenta el avance, cómo quedó, cuántos títulos y páginas, y qué pasó con las tapas. No deja nada.

Los resultados, con fecha y hora, están en las secciones 11 y 16 de [DOCUMENTACION.md](../DOCUMENTACION.md).

Durante las pruebas el programa arranca con todo de fábrica y no escribe ni la configuración ni los favoritos, ni el registro, así que no tocan los tuyos. Con `CAPTURAS=<carpeta>` guardan además capturas de la interfaz.
