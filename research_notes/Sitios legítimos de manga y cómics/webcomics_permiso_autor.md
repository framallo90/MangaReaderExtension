# Webcomics y webmanga gratis con permiso del autor para copiar o descargar (licencias libres o permiso explícito) y cómo se alojan

Notas de investigación, 21-11-2026. Contexto: extensión de Chrome que guarda el capítulo abierto (PDF/CBZ/imágenes). Funciona sin cambios cuando el capítulo entero está en una sola página como `<img>` con URLs http(s) (también `data-src`), y para lotes necesita el número de capítulo en la URL o una lista de capítulos. Hay que adaptarla para: una página de cómic por URL, servidores que piden Referer, panel con scroll propio, iframes, URLs sin número (slugs o fechas), fondos CSS. Lo protegido (cifrado, mosaicos mezclados, solo canvas, blob:, DRM) queda afuera.

Leyenda de cada ficha: **Descarga** = "permitida (licencia)" si la licencia o una declaración del autor autoriza copiar o redistribuir; "no mencionada" si no hay nada; "restringida" si los términos la limitan. **Formato** = cómo se presentan las páginas y qué tan compatible es con la extensión.

Nota general sobre licencias: toda licencia Creative Commons (incluso NC y ND) permite copiar y redistribuir la obra sin cambios, con atribución; NC prohíbe el uso comercial y ND prohíbe obras derivadas. Guardar una copia personal entra holgadamente en cualquiera de ellas. Los defensores de la cultura libre no consideran "libres" las variantes NC/ND ([Wikipedia, cultura libre, vía búsqueda](https://en.wikipedia.org/wiki/Free-culture_movement)).

## 1. ¿Qué webcomics usan Creative Commons u otras licencias libres? ¿Cuáles tienen traducción al español?

### Conclusión
El caso más completo para la extensión es Pepper&Carrot: CC BY 4.0, 70 idiomas (español al 100 %, con variantes latinoamericana y mexicana), el episodio entero en una página como `<img>`, número de episodio en la URL y fuentes en alta resolución que el propio autor ofrece. Los demás clásicos con CC (xkcd, Cat and Girl, Sandra and Woo, Irregular Webcomic, Darths & Droids y otros) son tiras o páginas sueltas, con una página de cómic por URL. Para esos habría que adaptar la extensión. De los clásicos, solo xkcd tiene traducción al español, y es no oficial.

### Hallazgos con fuente

**Ficha por obra (internacionales, en inglés salvo aclaración):**

- **Pepper&Carrot**, de David Revoy. Fantasía humorística sobre una bruja y su gato. [peppercarrot.com](https://www.peppercarrot.com/es/webcomics/peppercarrot.html)
  - Licencia: "Pepper&Carrot webcomics, translations and artworks are licensed under a Creative Commons Attribution 4.0 International license" salvo indicación en contrario (por ejemplo, fan-arts). El sitio prohíbe además la "AI derivation" — [página de licencia](https://www.peppercarrot.com/en/license/index.html)
  - Idiomas: el sitio lista 70; el español figura completo (100 % del cómic y del sitio), con variantes "Spanish Latino" y mexicana — [página de licencia/idiomas](https://www.peppercarrot.com/en/license/index.html)
  - Descarga: permitida (licencia), y el autor la ofrece. Cada episodio enlaza una carpeta "Hi-res/print files (JPG, PNG, PDF...)" (`/0_sources/ep01_Potion-of-Flight/hi-res/`), un zip con los archivos Krita (.kra), un zip con los textos de los globos en SVG de Inkscape, una página de fuentes por episodio y el repositorio git `framagit.org/peppercarrot/webcomics`. No hay CBZ — [episodio 1 en español](https://www.peppercarrot.com/es/webcomic/ep01_Potion-of-Flight.html)
  - Formato: el episodio completo en una sola página, con cada página como imagen (por ejemplo `https://www.peppercarrot.com/0_sources/ep01_Potion-of-Flight/low-res/es_Pepper-and-Carrot_by-David-Revoy_E01P01.jpg`) y su transcripción. URL `…/es/webcomic/epNN_Titulo.html`, con número de dos dígitos y slug. El índice lista 39 episodios, del 1 al 39 ("The Tavern") — [índice en español](https://www.peppercarrot.com/es/webcomics/peppercarrot.html); [episodio 1](https://www.peppercarrot.com/es/webcomic/ep01_Potion-of-Flight.html)
- **MiniFantasyTheater**, de David Revoy. Tiras cortas en el mundo de Pepper&Carrot. Licencia **CC BY-SA 4.0** — [página de licencia](https://www.peppercarrot.com/en/license/index.html); índice en [peppercarrot.com/en/webcomics/miniFantasyTheater.html](https://www.peppercarrot.com/en/webcomics/miniFantasyTheater.html). Un lector chileno de terceros dice tener 76 tiras ([lectormanga.cl](https://lectormanga.cl/)); el número no está confirmado en el sitio del autor.
- **xkcd**, de Randall Munroe. Humor sobre ciencia y tecnología. [xkcd.com](https://xkcd.com/)
  - Licencia: "This work is licensed under a Creative Commons Attribution-NonCommercial 2.5 License". Aclara: "you are free to copy and reuse any of my drawings (noncommercially) as long as you tell people where they're from" y "you don't need my permission to post these pictures on your website" — [xkcd.com/license.html](https://xkcd.com/license.html)
  - Descarga: permitida (licencia, solo uso no comercial). El autor no ofrece archivos para bajar.
  - Español: la página "about" lista "Translations (unofficial): Spanish, Russian, German" — [xkcd.com/about](https://xkcd.com/about/). No pude confirmar si la traducción al español sigue activa.
  - Formato: una tira por URL, numerada (`xkcd.com/NNN/`). El patrón sale del [archivo](https://xkcd.com/archive); el número por URL es un dato conocido, no lo verifiqué contra una tira.
- **Cat and Girl**, de Dorothy Gambrell. Humor filosófico. [catandgirl.com](https://catandgirl.com/)
  - Licencia: "licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 2.5 License" (pie de página) — [catandgirl.com](https://catandgirl.com/)
  - Estado: activo. La tira más reciente es "Once Upon a Time", del 18-11-2026, y sale "new every Tuesday" — [catandgirl.com](https://catandgirl.com/)
  - Formato: una tira por URL, con slug y sin número (`catandgirl.com/once-upon-a-time/`). Está hecho con WordPress (`wp-content/uploads`) y tiene navegación First/Previous/Next/Last — [catandgirl.com](https://catandgirl.com/)
- **Sandra and Woo**, de Oliver Knörzer (guion) y Puri Andini (dibujo). Humor con una nena y un mapache.
  - Licencia: "Creative Commons Attribution-NonCommercial-NoDerivs 3.0 Unported License". Cubre solo las tiras del archivo, no el resto del arte del sitio — [anuncio en sandraandwoo.com](https://www.sandraandwoo.com/gaia/2012/01/22/gaia-now-published-under-creative-commons-license/)
  - Formato: una tira por URL, con fecha y slug (`/2000/01/01/welcome-to-sandra-and-woo/`) — [misma fuente](https://www.sandraandwoo.com/gaia/2012/01/22/gaia-now-published-under-creative-commons-license/)
- **Gaia**, de los mismos autores. Fantasía. CC BY-NC-ND 3.0 desde enero de 2012. Hay edición en alemán (`/gaiade/`); en español no encontré. URLs con fecha y slug (`/gaia/2012/03/01/…/`) — [anuncio](https://www.sandraandwoo.com/gaia/2012/01/22/gaia-now-published-under-creative-commons-license/)
- **Scarlet**, alojado en sandraandwoo.com. URL con slug numerado (`/scarlet/comic/the-machine-of-eternal-summer-001/`); el número de página va dentro del slug. El anuncio de licencia no lo incluye, así que su licencia **no está verificada** — [misma fuente](https://www.sandraandwoo.com/gaia/2012/01/22/gaia-now-published-under-creative-commons-license/)
- **Irregular Webcomic!**, de David Morgan-Mar. Fotocómic con figuras de Lego. Licencia "Creative Commons Attribution-Noncommercial-Share Alike 4.0 International Licence". Una tira por URL numerada (`irregularwebcomic.net/4838.html`) — [irregularwebcomic.net/4838.html](https://irregularwebcomic.net/4838.html)
- **Darths & Droids**, de The Comic Irregulars (David Morgan-Mar y otros). Fotocómic con capturas de las películas de Star Wars. El blog del autor dice que los cómics se publican "under a Creative Commons licence, so all of the art of previous comics is available for remixing"; no indica la variante — [dangermouse.net](https://dangermouse.net/blog/category/art/webcomics). URL numerada (`darthsanddroids.net/episodes/1519.html`) — [ejemplo](https://darthsanddroids.net/episodes/1519.html). Ojo: las capturas de cine tienen derechos propios que la licencia del cómic no cubre.
- **Theft! A History of Music** y **Bound by Law**, del Center for the Study of the Public Domain (Duke). Cómics divulgativos sobre derechos de autor. Licencia CC BY-NC-SA 2.5 ("freely available for translation"). Hay traducciones al portugués, francés, italiano, portugués de Brasil, polaco y alemán; **no al español**. Ofrece zips de páginas sin texto en JPG (~7 MB y ~90 MB) y PNG (~40 MB) — [cspd.law.duke.edu/comics/translate](https://cspd.law.duke.edu/comics/translate/)
- **Fodongo: A Free Culture Comics Zine #3**, editado por jectoons (Emiliano Carrasco). En inglés. "This issue, except where noted, is licensed CC-BY-SA 4.0". Incluye *Toby Black* de BurnedCoffee (CC BY 4.0), *Here, There and Above* de Federico Kempke (CC BY-SA 4.0), *Dungeon Dad* de SPRAK (CC BY-SA 4.0) y *La Rana* de jectoons (CC0 1.0). Se baja en PDF desde itch.io, a voluntad — [itch.io](https://jectoons.itch.io/fodongo-a-free-culture-comics-zine-3)
- **Random Vignettes Season 1**, de jectoons. Presentado como "free-culture comic, under a CC-BY 4.0 International license" y vendido en PDF — [itch.io](https://jectoons.itch.io/random-vignettes-season-1). El sitio jectoons.net tenía el certificado vencido al consultarlo (fetch fallido).

**Obras que figuran con licencia CC en la [lista de Wikipedia de obras importantes con Creative Commons](https://en.wikipedia.org/wiki/List_of_major_Creative_Commons%E2%80%93licensed_works).** Ahí varias no tienen referencia, y no las verifiqué en el sitio del autor:
- Bunny, de Huw Davies: CC BY-NC-SA 3.0 (sin referencia).
- Diesel Sweeties, de Richard Stevens III: CC BY-NC 2.5 (sin referencia).
- Erfworld: CC BY-NC-SA 3.0 (sin referencia ni descripción).
- Homem-Grilo, de Cadu Simões: superhéroe brasileño, en portugués, CC BY-SA 4.0.
- Jesus and Mo, de "Mohammed Jones": sátira religiosa, CC BY-NC-SA 3.0 (sin referencia).
- Johnny Wander: CC BY-NC 3.0 (se cita la edición en libro).
- Mimi & Eunice, de Nina Paley: CC BY-SA 3.0 (sin referencia). Su URL vieja `blog.ninapaley.com/mimi-eunice/` redirige a `ninapaley.com` (fetch propio con redirección).
- Overcompensating: CC BY-NC 3.0 (sin referencia).
- Seedfeeder (obras para Wikipedia): CC BY-SA 3.0 o dominio público.

La [categoría de Wikipedia "Creative Commons-licensed comics"](https://en.wikipedia.org/wiki/Category:Creative_Commons-licensed_comics) suma, según el resumen de búsqueda, Hyperbole and a Half y Octopus Pie; la variante de licencia no está verificada.

**Sitios en español que alojan obras CC de terceros:**
- **LectorManga.cl**, de Chile. Su FAQ dice "Solo publica completas obras con licencia libre" y el pie, "Los cómics alojados se publican con licencias Creative Commons o de dominio público, con créditos a sus autores". Aloja Pepper&Carrot (39 episodios), MiniFantasyTheater (76 tiras), *Civic.AI* (7 capítulos) y varias historias cortas; por título no indica autor ni licencia. Por defecto lee "modo libro", página por página, con opción de "desplazamiento" vertical. URL con número de capítulo: `/leer/{slug}/{n}/`. No ofrece descargas. El operador es anónimo ("proyecto independiente") y el sitio tiene publicidad — [lectormanga.cl](https://lectormanga.cl/)

### Inferencias
- Para la extensión, Pepper&Carrot es el caso de prueba ideal: episodio entero en una página, `<img>` comunes de su propio dominio y número en la URL (`ep01_`). Probablemente haga falta que `detectChapter` reconozca el patrón `epNN_`. Además, el índice enlaza todos los episodios, así que el modo por lotes funcionaría con la lista de enlaces. Para máxima calidad conviene la carpeta `hi-res/` que da el autor y no las imágenes `low-res/` que se ven en pantalla.
- Casi todos los clásicos con CC en inglés (xkcd, Cat and Girl, Sandra and Woo, Gaia, Irregular Webcomic, Darths & Droids) siguen el modelo "una tira o página por URL". Para guardar "un capítulo" habría que seguir el enlace "Next" o recorrer URLs numeradas. En xkcd, Irregular Webcomic y Darths & Droids el número está en la URL; en Cat and Girl la URL es solo un slug, y en Sandra and Woo y Gaia, una fecha.
- Los nombres de archivo de Pepper&Carrot (`es_Pepper-and-Carrot_by-David-Revoy_E01P01.jpg`) incluyen idioma, episodio y página. Sirven para ordenar y nombrar sin adivinar.
- El nombre "LectorManga" coincide con marcas de sitios piratas conocidos. El .cl declara alojar solo obras libres, pero su operador es anónimo y vive de la publicidad. Para obras libres conviene ir a la fuente original (por ejemplo, peppercarrot.com/es), que además da mejor calidad.

### Vacíos
- No pude confirmar si la traducción no oficial de xkcd al español sigue en línea, ni en qué URL. La búsqueda no devolvió es.xkcd.com.
- No verifiqué en el sitio de cada autor las licencias de Bunny, Diesel Sweeties, Jesus and Mo, Johnny Wander, Overcompensating, Erfworld, Mimi & Eunice (que según mis conocimientos previos Paley habría pasado a CC0, sin confirmar), Hyperbole and a Half ni Octopus Pie. Tampoco su estado actual: Erfworld, Hyperbole and a Half y Octopus Pie probablemente estén terminados o inactivos, también sin confirmar.
- Un directorio de la década de 2010 mencionado en los resultados lista "Everyday Blues" y "Erma" como obras con CC. Es dudoso (Erma es una serie de Webtoon) y no lo verifiqué.
- No llegué a revisar otros candidatos que conozco de memoria pero no confirmé en esta sesión: Geek&Poke (CC BY 3.0, inactivo), Abstruse Goose (CC BY-NC, posiblemente caído), turnoff.us, CommitStrip, Grise Bouille (de Gee, en francés, CC BY-SA), Spacetrawler, Nerf NOW!!, Ozy and Millie. Habría que verificarlos uno por uno.
- Para MiniFantasyTheater no verifiqué el formato de página.

## 2. ¿Qué webcomics en español (España y Latinoamérica) se leen gratis y tienen licencia libre o permiso explícito?

### Conclusión
Hay muy pocos webcomics en español con licencia libre declarada, y los buscadores casi no los indexan por licencia. Lo más sólido es: Pepper&Carrot traducido (CC BY), El Vosque (España, CC BY-NC-SA 3.0, en pausa), la revista paraguaya CoquitoMAN (con CC, aunque la variante es confusa) y Faneo, una plataforma española donde cada autor elige su licencia CC. Los portales grandes en español (TusComics, GlobalComix en español, Webtoon) no dan permiso de descarga por defecto.

### Hallazgos con fuente
- **El Vosque**, de Moran y Laurielle (España). "Cómic de humor, fantasía y asesinatos".
  - Licencia: "está licenciado bajo Creative Commons Reconocimiento-NoComercial-CompartirIgual 3.0 Unported License" — [elvosque.es](https://elvosque.es/)
  - Estado: "el cómic está en hiatus" — [elvosque.es](https://elvosque.es/)
  - Descarga: permitida por la licencia (uso no comercial). Los tomos impresos se venden en tienda.teconcerveza.es y los digitales en Lektu, donde el primero es gratis — [elvosque.es](https://elvosque.es/)
  - Formato: una tira por URL, con serie, ID numérico y slug (`elvosque.es/comic/ohdiosas/3015/otono-1`); navegación primero/anterior — [elvosque.es](https://elvosque.es/)
- **CoquitoMAN** (Paraguay), revista de historietas de humor para chicos, jóvenes y adultos. Usa Creative Commons según una entrevista de CC Paraguay, que la describe como "(CC – By – ND – SA)". Esa combinación es contradictoria, porque ND y SA se excluyen; la entrevista también habla de la versión 4.0 — [creativecommons.org.py](https://www.creativecommons.org.py/coquitoman-una-historieta-que-elige-utilizar-cc/)
- **Pepper&Carrot en español**: traducción completa, más variantes "Spanish Latino" y mexicana, con la misma licencia CC BY 4.0. URL `peppercarrot.com/es/webcomic/epNN_….html` — [licencia/idiomas](https://www.peppercarrot.com/en/license/index.html); [índice es](https://www.peppercarrot.com/es/webcomics/peppercarrot.html)
- **xkcd en español** (no oficial): figura en la página "about" de xkcd ("Translations (unofficial): Spanish…") — [xkcd.com/about](https://xkcd.com/about/)
- **Faneo** (faneo.es), comunidad española de webcomics: "Puedes otorgarle a tu cómic una licencia Creative Commons, publicarlo bajo Copyright o incluso cederlo al Dominio Público". Se presenta en Beta, con "© 2026" en el pie. Para traducir una obra ajena exige "el permiso del autor original y que debes marcarlo como trabajo derivado". Tiene dos modos de lectura: por páginas (cada imagen es una página, con capítulos opcionales) o scroll vertical (imágenes apiladas por capítulo). URL de obra `faneo.es/comics/{nombre}/` — [faneo.es/info/help](https://www.faneo.es/info/help/). Una guía de TusComics la describe como "comunidad veterana, sin ánimo de lucro y mantenida con trabajo voluntario" — [tuscomics.com](https://tuscomics.com/recursos/donde-publicar-webcomic)
- **TusComics** (tuscomics.com), portal de webcomics en español en Beta. El autor conserva sus derechos y cede solo una "licencia no exclusiva para que la obra pueda mostrarse dentro del portal". Descarga: no autorizada por defecto (no mencionada) — [tuscomics.com/recursos/donde-publicar-webcomic](https://tuscomics.com/recursos/donde-publicar-webcomic). Según el resumen de búsqueda, todo el catálogo es de acceso libre, sin suscripciones — [tuscomics.com](https://tuscomics.com/)
- **GlobalComix en español** tiene secciones de títulos y de manga en español ([globalcomix.com/browse/es](https://globalcomix.com/browse/es), [/browse/es/manga](https://globalcomix.com/browse/es/manga)). Algunos son gratis y otros piden suscripción; la licencia no figura por obra.
- **Ediciones de la Terraza** (Argentina) publica libros ilustrados bajo CC BY-SA 4.0, y en uno las ilustraciones son no comerciales. No son webcomics; lo anoto como dato lateral — [edicioneslaterraza.com.ar](https://edicioneslaterraza.com.ar/project-tag/licencias-creative-commons/)
- Las búsquedas en español por "Reconocimiento-NoComercial-CompartirIgual" y "Atribución-NoComercial-CompartirIgual" con "webcomic" o "historieta" solo devolvieron El Vosque como webcomic concreto — [búsqueda 1](https://elvosque.es/authors/); la [búsqueda latinoamericana](https://co.creativecommons.net/tipos-de-licencias/) no trajo ninguno.

### Inferencias
- Para probar la extensión en español, la mejor opción es Pepper&Carrot en `/es/`. El Vosque sirve como caso "una tira por URL" con un número interno en la URL (`/3015/`), que no es un número de capítulo.
- En Faneo, las obras en modo scroll vertical deberían funcionar como "capítulo entero en una página" y las de modo por páginas necesitarían adaptación. No verifiqué si muestra `<img>` comunes. Ahí la licencia es por obra: habría que leer la ficha de cada una antes de bajarla.
- Muchos webcomics latinoamericanos conocidos (Dosis Diarias de Alberto Montt, Liniers, Gaturro, Macanudo) no tienen licencia libre verificable. Para Dosis Diarias, la búsqueda no encontró ninguna declaración de licencia ([resultados](https://en.wikipedia.org/wiki/Alberto_Montt)).

### Vacíos
- No encontré un directorio de webcomics en español con licencia libre; probablemente no exista. Para encontrar más casos habría que revisar el pie de página de cada obra en Faneo.
- No pude confirmar la licencia exacta ni el sitio actual de CoquitoMAN, ni si sigue publicándose.
- No encontré webcomics en español de Chile, Colombia, México o Argentina con licencia CC confirmada.
- No verifiqué si Grise Bouille u otros cómics libres franceses tienen traducción al español.

## 3. ¿Qué webcomics originales de estilo manga (OEL, "manga" en español) tienen licencia libre?

### Conclusión
No encontré webmanga original con licencia libre verificada, ni en inglés ni en español. La búsqueda específica no devolvió títulos. Lo más cercano: Pepper&Carrot y MiniFantasyTheater (fantasía con influencias del manga y la animación, CC BY / CC BY-SA), Gaia (fantasía dibujada por Puri Andini, CC BY-NC-ND 3.0) y las obras libres que aloja LectorManga.cl con formato de lector de manga.

### Hallazgos con fuente
- La búsqueda "manga webcomic Creative Commons CC BY-SA" encontró pocos títulos de manga con CC BY-SA. El caso histórico más conocido es un experimento de Kodansha en 2009, que publicó un manga en línea con términos CC no comerciales y sin derivadas, no CC BY-SA — [Sankaku Complex, 2009](https://news.sankakucomplex.com/2009/02/01/kodansha-publishes-creative-commons-manga-online/)
- Gaia (Knörzer/Andini), fantasía, CC BY-NC-ND 3.0 — [anuncio](https://www.sandraandwoo.com/gaia/2012/01/22/gaia-now-published-under-creative-commons-license/)
- Pepper&Carrot (CC BY 4.0) y MiniFantasyTheater (CC BY-SA 4.0) — [licencia](https://www.peppercarrot.com/en/license/index.html)
- LectorManga.cl se presenta como "lector manga en español" y aloja solo obras CC o de dominio público, incluida la historia original "La última luz", cuya licencia no figura — [lectormanga.cl](https://lectormanga.cl/)
- GlobalComix tiene una sección de manga en español, con licencias no indicadas — [globalcomix.com/browse/es/manga](https://globalcomix.com/browse/es/manga)

### Inferencias
- El webmanga OEL y el "manga" hecho en España o Latinoamérica viven sobre todo en Webtoon Canvas, Tapas, GlobalComix y TusComics/Faneo, donde la licencia por defecto es "todos los derechos reservados" más la licencia de exhibición que se cede a la plataforma. Encontrar uno con CC requiere revisar obra por obra; en Faneo la licencia se elige por obra.
- Lo de "estilo manga" de Gaia y Pepper&Carrot es mi apreciación; ninguna fuente lo describe así.

### Vacíos
- No encontré ningún OEL manga con CC confirmado (por ejemplo, de Morevna Project u otros proyectos de cultura libre que conozco de memoria). Haría falta otra pasada de búsqueda, por ejemplo en itch.io con la etiqueta "free culture" o "creative commons" + "manga".
- No encontré "manga" español con licencia CC confirmada.

## 4. ¿Qué patrones de página y de URL dominan (una página por URL, tira vertical larga, archivos)?

### Conclusión
Conviven tres modelos. (a) Webcomic clásico con CMS propio o de WordPress: una página o tira por URL, con slug, fecha o índice numérico; es el más común entre las obras con CC. (b) Tira vertical larga por episodio (Webtoon, Tapas, el modo vertical de Faneo): episodio entero en una página. (c) Episodio completo en una página con varias páginas de cómic apiladas, como Pepper&Carrot. Para la extensión, (b) y (c) andan casi sin cambios; (a) necesita seguir el "Next" o generar URLs.

### Hallazgos con fuente
- **Comic Easel** (plugin de WordPress de Frumph, sucesor del tema ComicPress): funciona con cualquier tema, usa un tipo de entrada "comic", puede meter el slug del capítulo en la URL y admite URLs con fecha. No es una actualización de ComicPress; el plugin CP2CE convierte de uno a otro — [GitHub Frumph/comic-easel](https://github.com/Frumph/comic-easel). Un usuario describe la ruta por índice `example.com/comic/20` → página 20 — [soporte de WordPress](https://wordpress.org/support/topic/index-based-permalinks/)
- **Toocheke** (tema + plugin Toocheke Companion): la versión 2.8 sumó una pestaña "Permalinks" para personalizar los slugs de cómics, series, **manga** y sus taxonomías — [wordpress.org/plugins/toocheke-companion](https://wordpress.org/plugins/toocheke-companion/)
- **Webcomic** (plugin de WordPress): la navegación se basa solo en la fecha de publicación de las entradas — [readme](https://cdn.jsdelivr.net/wp/webcomic/tags/4.4.1/readme.txt)
- **ComicControl** (CMS propio, alternativa a WordPress). Lo creó Erin Burt, ex desarrolladora de Hiveworks, y hay un fork mantenido. Cada módulo (cómic, blog, about, galería) es su propia página — [GitHub mrencyc/ComicControl](https://www.github.com/mrencyc/ComicControl). En sitios de ese ecosistema las URLs de cómic son `/comic/{slug}` o `/comic/{fecha}`: por ejemplo `egscomics.com/comic/2010-03-01` y `shortpacked.com/comic/donk` (resultados de búsqueda: [egscomics](https://egscomics.com/comic/2010-03-01), [shortpacked](https://www.shortpacked.com/comic/donk))
- **Hiveworks** lista sus obras terminadas o en pausa en [hiveworkscomics.com/completed](https://hiveworkscomics.com/completed). Son sitios con derechos reservados, no CC.
- Ejemplos concretos de patrones entre las obras con CC:
  - Número en la URL: xkcd (`/NNN/`), Irregular Webcomic (`/4838.html`) — [fuente](https://irregularwebcomic.net/4838.html) — y Darths & Droids (`/episodes/1519.html`) — [fuente](https://darthsanddroids.net/episodes/1519.html)
  - Solo slug: Cat and Girl (WordPress) — [fuente](https://catandgirl.com/)
  - Fecha + slug: Sandra and Woo y Gaia — [fuente](https://www.sandraandwoo.com/gaia/2012/01/22/gaia-now-published-under-creative-commons-license/)
  - Serie + ID + slug: El Vosque — [fuente](https://elvosque.es/)
  - Episodio entero en una página con número + slug: Pepper&Carrot (`epNN_Titulo.html`) — [fuente](https://www.peppercarrot.com/es/webcomic/ep01_Potion-of-Flight.html)
  - Lector por páginas con número de capítulo en la URL (`/leer/{slug}/{n}/`) y modo vertical opcional: LectorManga.cl — [fuente](https://lectormanga.cl/)
  - Dos modos (páginas o scroll vertical) según la obra: Faneo — [fuente](https://www.faneo.es/info/help/)
- **GlobalComix** tiene un "Interactive Reading Mode" que avanza "panel-by-panel" y habla de "page-to-page comics and manga" — [FAQ](https://globalcomix.com/support/faq)
- **Webtoon:** las imágenes salen de un CDN de Naver (pstatic). Un hilo general sobre CDNs que bloquean por Referer y una respuesta sobre un sitio estilo Webtoon recomiendan mandar User-Agent y Referer de la página — [curl mailing list](https://curl.se/mail/archive-2024-05/0016.html). No hay confirmación directa para `webtoon-phinf.pstatic.net`.

### Inferencias
- En la mayoría de los webcomics con licencia libre, "capítulo" no es una unidad de la página: es una tira por URL. La adaptación con más rendimiento sería un modo "seguir Siguiente hasta N páginas" o "recorrer URLs numeradas" (xkcd, Irregular, Darths & Droids). Las URLs con slug (Cat and Girl) o fecha (Sandra and Woo) exigen seguir el enlace `rel="next"` o el botón "Next", que en WordPress con Comic Easel suele tener una clase CSS estable.
- En los sitios de WordPress (Comic Easel/Toocheke) la imagen del cómic suele ser un `<img>` común dentro de un contenedor del plugin, sin protección. Es inferencia: no inspeccioné el HTML de un sitio concreto.
- Toocheke tiene un tipo de contenido "manga" propio, posiblemente con capítulos agrupados. Conviene revisarlo si aparece un webmanga autoalojado.

### Vacíos
- No verifiqué el HTML real (clases, atributos `data-src`, `rel="next"`) de Comic Easel, Toocheke, ComicControl ni ComicFury.
- No encontré documentación del patrón de URL de ComicFury (lo que sé de memoria: subdominios `*.thecomicseries.com` y similares con `/comics/N`); la búsqueda no lo confirmó.
- No confirmé si las imágenes de Webtoon o Tapas exigen Referer: la búsqueda no trajo fuentes específicas.

## 5. ¿Qué dicen los términos de las plataformas (Webtoon, Tapas, ComicFury, GlobalComix) sobre guardar o descargar?

### Conclusión
Ninguna plataforma da permiso general para descargar. Webtoon prohíbe copiar o reproducir y limita las descargas a 30 días en un solo dispositivo, además de prohibir el scraping. ComicFury da una licencia de visualización "transitoria" y prohíbe redistribuir o espejar. GlobalComix pide la suscripción Gold para leer sin conexión y vende PDF sin DRM de algunos lanzamientos. Los términos de Tapas no se pudieron leer. En todas, el autor conserva sus derechos y puede licenciar su obra como quiera, pero la licencia tiene que declararla él.

### Hallazgos con fuente
- **WEBTOON** (incluye Canvas), términos de uso en inglés:
  - Licencia al usuario para "access, view, download (for a limited time), and use such Digital Content… solely for your personal, non-commercial use"; las descargas van a "only one device which will be maintained for up to thirty (30) days" y "may be automatically deleted… after thirty (30) days" (sección 4(b)) — [webtoons.com/en/terms](https://www.webtoons.com/en/terms)
  - "You may not copy, redistribute, transmit, sell, rent, lease, convey…" y "You may not duplicate or otherwise reproduce (including but not limited to "burning")…" en "any physical medium, memory or device" (4(c)) — [misma fuente](https://www.webtoons.com/en/terms)
  - Prohíbe eludir el DRM o la protección contra copia (4(c)), el "crawling," "scraping," or harvesting of content" y "any other unauthorized automated means" (6(b)(iii)) — [misma fuente](https://www.webtoons.com/en/terms)
  - Los creadores de Canvas le dan a WEBTOON una licencia "nonexclusive, perpetual, irrevocable, royalty-free, worldwide, transferable, sublicensable"; la modificación se limita a promoción (8(a)). Solo leí los primeros 100.000 de ~224.000 caracteres — [misma fuente](https://www.webtoons.com/en/terms)
- **ComicFury:**
  - Al lector: licencia para "temporarily download one copy of the materials" for "personal, non-commercial transitory viewing only"; prohíbe "transfer the materials to another person or "mirror" the materials on any other server"; al terminar la licencia hay que "destroy any downloaded materials" (sección 2) — [comicfury.com/tos.php](https://comicfury.com/tos.php)
  - Al autor: "you retain ownership over your uploaded content"; la licencia a ComicFury es no exclusiva y revocable borrando el contenido (sección 3); el dueño "may do as you wish with content you own" — [misma fuente](https://comicfury.com/tos.php)
  - Los términos no mencionan scraping ni bots. La política de privacidad menciona una API — [misma fuente](https://comicfury.com/tos.php)
- **GlobalComix:**
  - "A GlobalComix Gold membership is required to download Collection Unlocks for Offline Reading" — [FAQ](https://globalcomix.com/support/faq)
  - Los PDF comprados son "DRM-free and grant access to a downloadable PDF that you own permanently"; el creador puede ponerles precio — [FAQ](https://globalcomix.com/support/faq); modelo anunciado junto con Top Cow — [GamesRadar](https://gamesradar.com/globalcomix-partners-with-top-cow-and-announces-downloadable-pdf-sales-model)
  - El creador "retain[s] the full rights to all of your work"; cobrar es opcional y, publicado un lanzamiento, sus páginas "become available to read for anyone on the internet" — [FAQ](https://globalcomix.com/support/faq)
  - No usa el contenido para entrenar IA visual generativa sin consentimiento expreso del creador — [AI policy](https://globalcomix.com/ai-policy)
  - El texto de los términos no se pudo leer: `globalcomix.com/terms` da 404.
- **Tapas:** `tapas.io/terms` redirige a un artículo de Zendesk que dio 403, y `/policies/terms` y `/policies/terms-of-service` dieron 404. Según el resumen de ToS;DR, "Tapas Media does not claim ownership rights of your Content" — [tosdr (punto aprobado)](https://edit.tosdr.org/points/5580). No pude confirmar qué dicen sobre descargar o hacer scraping.
- **Faneo y TusComics** (en español): Faneo deja que el autor elija CC, copyright o dominio público ([ayuda de Faneo](https://www.faneo.es/info/help/)). TusComics solo recibe una licencia no exclusiva de exhibición ([TusComics](https://tuscomics.com/recursos/donde-publicar-webcomic)). Ninguno menciona descargas.

### Inferencias
- Con Webtoon, guardar con la extensión choca con la letra de los términos aunque sea para uso personal: la única descarga permitida es la de la app, por 30 días. Además, la app usa DRM, lo que la ubica en "protegido". Solo se justificaría una obra de Canvas cuyo autor declare una licencia CC en la descripción, y aun así hay que tener en cuenta la cláusula anti-scraping.
- ComicFury es la plataforma más neutral: el autor conserva todo, así que si declara una licencia CC, esa licencia rige para su obra. Sin declaración, el lector solo tiene la "transitory viewing" de la sección 2.
- En GlobalComix, la vía legítima de descarga son los PDF sin DRM que el creador decida vender. El modo sin conexión requiere Gold y vive dentro de la app.

### Vacíos
- No obtuve el texto de los términos de Tapas ni de GlobalComix: ambos fetch fallaron (404/403).
- No verifiqué los términos de Hiveworks ni de las plataformas en español (Faneo, TusComics) más allá de sus páginas de ayuda.
- No leí la segunda mitad de los términos de WEBTOON (caracteres 100.000 a 224.000).
