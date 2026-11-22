# Archivos y bibliotecas digitales en inglés con cómics de dominio público o licencia libre

Notas de investigación del 21-11-2026. Las comprobaciones técnicas las hice ese mismo día bajando el HTML crudo con curl (sin ejecutar JavaScript). Cuando un sitio bloqueó la descarga automática (Cloudflare "Just a moment...", 403), usé capturas del Wayback Machine y anoté su fecha. "No verificado" significa que no pude ver cómo entrega las imágenes.

Criterios de compatibilidad con la extensión (según el encargo): funciona sin cambios si las páginas son `<img>` con URL http(s) (directas o con data-src), si el capítulo entero está en una sola página y si el número de capítulo está en la URL o hay enlaces o un desplegable con los números. Hace falta adaptarla si hay una página por pantalla, botón "siguiente", URL por página, Referer obligatorio, scroll interno, iframe, URL sin número o fondos CSS. Lo marco como "protegido", y queda fuera, si usa cifrado, tiles mezclados, canvas, blob: o DRM.

## 1. ¿Qué archivos alojan cómics de dominio público de la Golden Age y la Silver Age (y obras con licencia libre)?

### Conclusión
Los dos archivos principales siguen siendo **Comic Book Plus** (≈48 000 libros, lee sin cuenta y baja con cuenta) y **Digital Comic Museum** (Golden Age, baja CBR/CBZ con cuenta gratuita). Los dos tienen un lector de una página por vista y bloquean a los clientes automáticos con Cloudflare. A eso se suman la colección "comics" del **Internet Archive** (≈119 000 ítems subidos por usuarios, con derechos mezclados) y dos lectores nuevos con el número entero en una sola página de `<img>`: **ComicBook Experience** (antes comicbooks.com/read, más de 20 000 números según la prensa) y **Comloc Vault** (unos 10 números). Para tiras de diario están **Barnacle Press** y **Comic Strip Library**, y como obra libre moderna con estética manga, **Pepper&Carrot** (CC BY 4.0).

### Hallazgos citados

**Comic Book Plus (CBP)**: https://comicbookplus.com/
- Dice que solo aloja material de dominio público: "We only hold comic books and images that are in the Public Domain". Atribuye ese estado a derechos que no se renovaron o que nunca se aplicaron bien — [Comic Book Plus (fragmento del buscador)](https://comicbookplus.com/?cid=1507)
- Tamaño: un fragmento del buscador de una página de categoría de CBP decía "Total: 48,274 books" y 197 agregados hace poco. No pude abrir la página para confirmarlo porque Cloudflare devolvió 403 el 21-11-2026 — [CBP](https://comicbookplus.com/?cid=1507). En 2014 la prensa hablaba de "más de 22 000" cómics de la Golden y la Silver Age — [Open Culture 2014](https://www.openculture.com/2014/03/download-over-22000-golden-silver-age-comic-books-from-the-comic-book-plus-archive.html)
- Además de cómics tiene fanzines, pulps y revistas — [Guía de la Universidad de Michigan](https://guides.lib.umich.edu/comics/web)
- Aviso en la ficha de cada libro (captura del 12-07-2026): "We aim to house only Public Domain content… Utilizing our downloadable content, is strictly at your own risk". La ficha también cuenta descargas ("Downloads:112") y pide iniciar sesión para bajar ("download files please", "download & join our forum please") — [Wayback, CBP dlid=20000](https://web.archive.org/web/20260712023832/https://comicbookplus.com/?dlid=20000)
- Se lee sin cuenta, pero para descargar hay que tener una — [CreativePro](https://creativepro.com/a-repository-of-thousands-of-free-comics) / [Open Culture 2014](https://www.openculture.com/2014/03/download-over-22000-golden-silver-age-comic-books-from-the-comic-book-plus-archive.html)

**Digital Comic Museum (DCM)**: https://digitalcomicmuseum.com/
- Solo Golden Age. El personal y los usuarios revisan cada archivo para confirmar que está libre de derechos y en dominio público — [Open Culture 2018](https://openculture.com/2018/11/free-download-15000-free-golden-age-comics-digital-comic-museum.html); [Toy Tales](https://toytales.ca/digital-comic-museum)
- En 2018 tenía más de 15 000 cómics. Para descargar hace falta una cuenta gratuita, que también da acceso al foro — [Open Culture 2018](https://openculture.com/2018/11/free-download-15000-free-golden-age-comics-digital-comic-museum.html)
- Las descargas vienen en CBR o CBZ. Una guía alemana dice que también se puede leer en el navegador — [GIGA](https://www.giga.de/downloads/comic-maker/specials/comics-online-lesen-und-herunterladen-das-digital-comic-museum/)
- Lo recomiendan guías de bibliotecas como la de la Universidad de Michigan ("free downloadable versions of public domain comics from the Golden Age") — [UMich](https://guides.lib.umich.edu/comics/web)

**ComicBook Experience (antes "ComicBooks.com Reading Room")**: https://comicbookexperience.com/read
- Se presentó en agosto de 2026 con "more than 20,000 digitized and restored golden-age comics", "several hundred more issues added every day" y géneros de superhéroes, western, romance, funny animal, terror, ciencia ficción y humor — [Open Culture, agosto de 2026](https://www.openculture.com/2026/08/read-20000-golden-age-comic-books-free-online.html). Boing Boing lo describió como lectura en el navegador "one deep-zoomable page at a time" — [Boing Boing, 12-08-2026](https://boingboing.net/2026/08/12/comicbooks-reading-room.html)
- **Cambio de dominio, verificado el 21-11-2026:** `https://comicbooks.com/read/4-most-boys-37` responde con un 301 a `https://comicbookexperience.com/read/4-most-boys-37`, y `comicbooks.com/about`, `/terms` y `/faq` devuelven 410 (Gone). La página "About" del dominio nuevo dice: "ComicBook Experience preserves the public-domain reading room, restored scans and illustrated-history exhibitions developed at ComicBooks.com… The collection is a preserved edition. It does not offer current market prices or continuously generated new content." También dice que conserva escaneos, registros y créditos de fuente, que el catálogo viene de la Grand Comics Database bajo CC BY-SA 4.0 y da un correo para correcciones — [About de ComicBook Experience](https://comicbookexperience.com/about)
- En el filtro de editoriales del catálogo aparece la entrada "Public Domain — Edo/Meiji Japan", que podría ser material japonés antiguo afín al manga. No revisé qué contiene — [Reading room](https://comicbookexperience.com/read)

**Comloc Vault (comicshoplocator.com)**: https://www.comicshoplocator.com/comics/read/
- Título de la página: "Read Golden Age Comics Online Free | Comloc Vault". Su lista estructurada (ItemList) declara `numberOfItems: 10`, por ejemplo Blue Bolt #1, Planet Comics #1 y #3, Crime Does Not Pay #22 y Web of Mystery #1. Describe sus títulos como de dominio público. En cada número da la fuente: "Source: Internet Archive — scan courtesy Internet Archive comics collection (paper/fiche restoration scan)". Verificado el 21-11-2026 — [Comloc Vault](https://www.comicshoplocator.com/comics/read/), [Blue Bolt #1](https://www.comicshoplocator.com/comics/read/blue-bolt-1/)
- El propio sitio dice que tiene números de ciencia ficción, terror, crimen y superhéroes de los años 40 y 50 cuyos derechos no se renovaron (fragmento del buscador) — [Comloc Vault](https://www.comicshoplocator.com/comics/read/)

**Internet Archive, colección "comics"**: https://archive.org/details/comics
- `collection:comics` devuelve **118 932 ítems**, y `mediatype:texts AND subject:comics`, 44 300 (API advancedsearch, consultada el 21-11-2026) — [API del IA](https://archive.org/advancedsearch.php?q=collection%3Acomics&rows=0&output=json)
- Ejemplo de ítem: `BlueBoltV712` ofrece Image Container PDF, DjVu, "Single Page Processed JP2 ZIP", OCR y torrent. Su `licenseurl` es CC BY 3.0, asignado por quien lo subió, y está en la colección `webcomicuniverse`. Eso muestra que los derechos que figuran en el IA los declara el que sube el archivo — [Metadatos de BlueBoltV712](https://archive.org/metadata/BlueBoltV712)
- Una guía de biblioteca lo presenta como colección gratuita de cómics y novelas gráficas digitalizados — [resultado del buscador, guías de bibliotecas](https://guides.library.unt.edu/comics-studies/research)

**Barnacle Press (tiras de diario de dominio público)**: https://www.barnaclepress.com/
- Archivo de tiras antiguas ordenadas por tira y fecha, por ejemplo Kid-ology (1920–1921), You Know Me Al, Professor Wayupski y Adventures of Johnny Mouse. La última entrada del blog es del 07-10-2021: el sitio sigue en línea (21-11-2026) pero parece inactivo — [Barnacle Press](https://www.barnaclepress.com/), [Kid-ology](https://www.barnaclepress.com/comic/Kid-ology/)

**Comic Strip Library**: https://comicstriplibrary.org/
- Archivo gratuito de tiras de dominio público, todas anteriores a 1923 y bien catalogadas — [FLOW (sanglorian)](https://sanglorian.github.io/flow/the-comic-strip-library). El Oregon Cartoon Project lo llamó "proof-of-concept… work-in-progress", en una nota sin fecha — [Oregon Cartoon Project](https://oregoncartoonproject.org/free-resource-the-comic-strip-library/)
- Técnicamente, el 21-11-2026 era una SPA en React con TanStack Router. Las rutas son `/browse`, `/browse/results`, `/display/$id`, `/about`, `/copyright` y `/links`, y los recursos salen de `https://comic-strip-library.s3.us-west-2.amazonaws.com` (lo saqué del bundle JS) — [comicstriplibrary.org](https://comicstriplibrary.org/)

**Obras modernas con licencia libre (estilo manga/webcomic)**
- **Pepper&Carrot** (David Revoy), https://www.peppercarrot.com/: licencia CC BY 4.0 — [About](https://www.peppercarrot.com/en/about/). Cada episodio ofrece fuentes, renders listos y paquetes zip — [Episodio 7, sources](https://peppercarrot.com/en/webcomic/ep07_The-Wish__sources.html). Hubo un PDF gratuito del libro 1 en resolución web y de imprenta — [davidrevoy.com](https://www.davidrevoy.com/article549/peppercarrot-free-pdf-of-book-one/show). Hay recopilaciones de los volúmenes 1 y 2 en KDE Store bajo CC BY 4.0 — [KDE Store](https://store.kde.org/p/1316702)

### Inferencias
- Para bajar en lote, lo más práctico en CBP, DCM e Internet Archive es la descarga directa que ya ofrecen (CBZ/CBR/PDF/JP2 ZIP) y no el lector. En CBP y DCM hace falta una cuenta gratuita.
- ComicBook Experience parece haber pasado de proyecto en crecimiento (agosto de 2026) a "edición preservada" (noviembre de 2026). La cifra de 20 000 y el "cientos por día" de la prensa pueden haber quedado viejos. Su página About lo confirma de forma indirecta.
- En el Internet Archive, que un cómic esté en la colección "comics" no garantiza que sea de dominio público: hay que revisar cada ítem.

### Vacíos
- No pude abrir directamente ninguna página de CBP ni de DCM (Cloudflare devolvió 403 el 21-11-2026), así que no confirmé su tamaño actual ni sus términos completos (FAQ y reglas). DCM: tamaño actual desconocido. El último dato que encontré es "más de 15 000" en 2018.
- No encontré la cifra total de números de ComicBook Experience al 21-11-2026: el HTML inicial lista solo 48 enlaces y el resto se carga por búsqueda.
- No investigué Google Books, DPLA, Open Library, Papers Past (Nueva Zelanda), Canadiana ni la British Library por falta de llamadas. Quedan pendientes como posibles fuentes, sin datos.

## 2. ¿Qué bibliotecas nacionales, universitarias y de museos tienen tiras o cómics digitalizados y legibles en línea?

### Conclusión
Las bibliotecas institucionales aportan sobre todo **tiras de diario** y arte original, no números completos de comic books. Chronicling America (Library of Congress) cubre hasta 1963 con páginas de diario de dominio público, incluidos los suplementos de historietas. Trove (Australia) tiene diarios de 1803 a 1955. HathiTrust y Wikimedia Commons tienen recopilaciones y tiras sueltas. La colección de comic books de la LoC (más de 140 000 números) **no** está digitalizada para el público, y el Billy Ireland (Ohio State) digitalizó solo una parte chica de su colección.

### Hallazgos citados
**Library of Congress (LoC)**
- La colección física tiene más de 140 000 números de más de 12 000 títulos y es la colección pública más grande del país. Se consulta en sala, con fines de investigación. La digitalización es selectiva (se digitaliza tras estabilizar el ejemplar) — [Blog de la LoC, 2022](https://blogs.loc.gov/headlinesandheroes/2022/08/live-long-and-repair-caring-for-the-library-of-congress-comic-book-collection/)
- **Webcomics Web Archive**: archivo web de cómics creados para internet, con unos 40 al lanzarse — [LoC](https://www.loc.gov/collections/webcomics-web-archive/about-this-collection/). Es material con derechos, archivado, no de dominio público.
- La exposición "Comic Art: 120 Years of Panels and Pages" se puede ver en línea. Son obras sueltas, no series completas — [LoC](https://www.loc.gov/exhibitions/comic-art/exhibition-items/)
- **Chronicling America**: `https://chroniclingamerica.loc.gov/` devuelve un 308 a `https://www.loc.gov/chroniclingamerica/` (verificado el 21-11-2026). La LoC "cree que los diarios de Chronicling America son de dominio público o no tienen restricciones de derechos conocidas", con la salvedad de que los títulos de menos de 95 años pueden incluir material de terceros con derechos — [LoC, Rights and Access](https://www.loc.gov/collections/chronicling-america/about-this-collection/rights-and-access/). La colección llega a 1963 — [LoC, About](https://www.loc.gov/collections/chronicling-america/about-this-collection/). Las páginas se bajan en PDF o JPEG2000 — [ayuda de Chronicling America (archivada)](https://webarchive.library.unt.edu/web/20090109183838/http://www.loc.gov/chroniclingamerica/help.html). El blog de la LoC destaca tiras disponibles en Chronicling America — [Headlines & Heroes](https://blogs.loc.gov/headlinesandheroes/2020/11/a-feast-of-funnies-thanksgiving-comic-strips/)

**HathiTrust**: https://www.hathitrust.org/
- Cualquiera puede leer en línea las obras de dominio público. Quienes no pertenecen a una institución miembro bajan **página por página**, y la descarga del libro completo solo se ofrece si el volumen **no** lo digitalizó Google. Los miembros bajan el PDF completo de todo el dominio público. Para descargar en general hay que iniciar sesión — [HathiTrust, Access](https://hathitrust.org/access); [Guía de la FSU](https://guides.lib.fsu.edu/hathitrust/download); [Guía de Illinois](https://guides.library.illinois.edu/hathi/get_access)
- Los volúmenes de dominio público que digitalizó Google se bajan completos en Google Books — [HathiTrust, What You Can Download](https://hathitrust.atlassian.net/wiki/x/IYBKjg)

**Wikimedia Commons**: https://commons.wikimedia.org/
- Hay categorías por obra. Ejemplo: "Category:Little Nemo in Slumberland" tenía 7 subcategorías y 16 archivos, con escaneos como uno de 1906 de la National Gallery of Art (archivo original de 3166×4000 px). Verificado el 21-11-2026 — [Commons](https://commons.wikimedia.org/wiki/Category:Little_Nemo_in_Slumberland). También existe "Category:Public domain comics" — [Commons](https://commons.wikimedia.org/wiki/Category:Public_domain_comics)

**Billy Ireland Cartoon Library & Museum (Ohio State University)**: https://cartoons.osu.edu/
- Sus colecciones digitales son imágenes escaneadas de viñetas, tiras, fotos y recortes, pero se digitalizó solo una parte chica del total. Tiene búsqueda por palabra clave y facetas, exposiciones digitales (por ejemplo "B. Walker's World") y una base de arte original. Los legajos biográficos no están digitalizados — [Billy Ireland, Resource for Online Research](https://cartoons.osu.edu/?p=6877); [Digital Exhibits](https://cartoons.osu.edu/exhibits/digital-exhibits); [Search collections](https://cartoons.osu.edu/collections-and-research/search-collections)

**Trove (National Library of Australia)**: https://trove.nla.gov.au/
- Acceso gratuito a diarios australianos digitalizados de 1803 a 1955, con búsqueda de texto. También tiene revistas con un filtro de acceso libre. Las fuentes que encontré no dicen qué tiras están digitalizadas — [NLA, Australian newspapers online](https://www.library.gov.au/research/research-guides-0/australian-newspapers-research-guide-new/australian-newspapers-online); [Trove, About](https://trove.nla.gov.au/about)

**Project Gutenberg**
- Existe la estantería "Books about Comics (Graphic works)" (`/ebooks/subject/41234`). No pude ver qué contiene porque el sitio devolvió 503 al bot el 21-11-2026 — [Gutenberg](https://m.gutenberg.org/ebooks/subject/41234). Gutenberg solo publica obras de dominio público en EE. UU. — [FAQ de Gutenberg](https://www.gutenberg.org/help/faq)

**Guías universitarias**
- La guía de la Universidad de Michigan recomienda solo Comic Book Plus y Digital Comic Museum como fuentes gratuitas de cómics digitalizados. OverDrive y Underground & Independent Comics piden login de la universidad — [UMich](https://guides.lib.umich.edu/comics/web)
- La guía de Michigan State University sobre la Golden Age solo da consejos de búsqueda en el catálogo, sin recursos en línea para leer — [MSU](https://libguides.lib.msu.edu/golden-age-comics-spc)
- La guía de la UNT suma la Lambiek Comiclopedia y el Stripper's Guide de Allan Holtz, para contexto pero no para leer números — [UNT](https://guides.library.unt.edu/comics-studies/research)

### Inferencias
- Para tiras de diario de dominio público (Little Nemo, Krazy Kat y otras), la fuente institucional más amplia es Chronicling America, pero sirve como página de diario completa y no como "capítulo". No encaja bien en el modelo capítulo→PDF de la extensión. Sí sirve la descarga oficial de cada página en PDF o JP2.
- Ninguna gran biblioteca nacional de EE. UU. ofrece hoy una colección amplia de comic books completos de la Golden Age leíbles en línea. Ese hueco lo cubren CBP, DCM y el IA.

### Vacíos
- No pude verificar el visor de loc.gov ni el de HathiTrust: los dos devolvieron 403 o un desafío de Cloudflare a curl el 21-11-2026.
- No encontré cifras de cuántas tiras o páginas de historietas hay en Chronicling America ni en Trove.
- DPLA, Smithsonian, British Library, Library and Archives Canada, Papers Past, Duke, la Universidad de Florida, VCU y Columbia: sin investigar.

## 3. ¿Qué dicen los términos de cada sitio sobre descargas y copias personales?

### Conclusión
Los archivos aficionados (CBP y DCM) **promueven la descarga**: piden una cuenta gratuita y se cubren con avisos de dominio público y de "uso bajo tu propio riesgo". Las instituciones declaran el material como de dominio público o "sin restricciones conocidas" (LoC) o limitan el formato de descarga según quién sos (HathiTrust). Pepper&Carrot es CC BY 4.0 y permite todo con atribución. En el Internet Archive la licencia la declara quien sube el archivo.

### Hallazgos citados
- **CBP**: "We aim to house only Public Domain content. If you suspect that any of our material may be infringing copyright, please use our contact page… Utilizing our downloadable content, is strictly at your own risk." Para bajar hay que iniciar sesión — [Wayback, 12-07-2026](https://web.archive.org/web/20260712023832/https://comicbookplus.com/?dlid=20000)
- **DCM**: descarga gratuita con registro, CBR o CBZ, con archivos revisados por el personal para confirmar el dominio público — [Open Culture 2018](https://openculture.com/2018/11/free-download-15000-free-golden-age-comics-digital-comic-museum.html); [Toy Tales](https://toytales.ca/digital-comic-museum). La página de inicio muestra anuncios de Google AdSense (captura del 20-06-2025) — [Wayback DCM /preview/](https://web.archive.org/web/20250620222956/https://www.digitalcomicmuseum.com/preview/)
- **ComicBook Experience**: no encontré términos de uso. Las páginas de términos de comicbooks.com devuelven 410. La página About solo trata correcciones, atribución del catálogo (GCD, CC BY-SA 4.0) y fuentes por obra — [About](https://comicbookexperience.com/about). No vi ningún botón de descarga en la página del número (HTML del 21-11-2026).
- **Comloc Vault**: da fuente y crédito al Internet Archive en cada número. No encontré términos específicos sobre descargas — [Blue Bolt #1](https://www.comicshoplocator.com/comics/read/blue-bolt-1/)
- **Internet Archive**: la licencia por ítem la pone quien lo sube (ejemplo: `licenseurl` CC BY 3.0 en BlueBoltV712) — [Metadatos del IA](https://archive.org/metadata/BlueBoltV712)
- **LoC / Chronicling America**: dominio público o sin restricciones conocidas, con la salvedad de material de terceros en títulos de menos de 95 años. Pide citar la URL — [Rights and Access](https://www.loc.gov/collections/chronicling-america/about-this-collection/rights-and-access/)
- **HathiTrust**: dominio público con descarga página por página para cualquiera y libro completo solo si no lo digitalizó Google (o para miembros). Pide iniciar sesión — [HathiTrust](https://hathitrust.org/access); [FSU](https://guides.lib.fsu.edu/hathitrust/download)
- **Pepper&Carrot**: CC BY 4.0, con fuentes en alta resolución y zips oficiales — [About](https://www.peppercarrot.com/en/about/); [Episodio 7, sources](https://peppercarrot.com/en/webcomic/ep07_The-Wish__sources.html)
- **Wikimedia Commons**: la licencia va por archivo. Ver la página de cada archivo — [Commons](https://commons.wikimedia.org/wiki/Category:Little_Nemo_in_Slumberland)

### Inferencias
- Los sitios que verifiqué técnicamente no tienen cláusulas que prohíban guardar copias personales de material de dominio público. CBP y DCM directamente ofrecen descargas. El riesgo legal real pasa por si cada título es de verdad de dominio público: CBP misma habla de "aim to", y un mensaje en el foro de CBP advierte que antes de dar un cómic por libre hay que revisar los años cercanos ([foro de CBP, fragmento del buscador](https://comicbookplus.com/forum/?topic=76.0)).
- Conocimiento general, no verificado en esta sesión: en EE. UU., las obras publicadas antes de 1931 son de dominio público desde el 01-01-2026 (plazo de 95 años). Lo posterior depende de si se renovó el copyright.

### Vacíos
- No leí los términos completos de CBP, DCM (bloqueados), ComicBook Experience (no existen o están dados de baja) ni los términos de uso del Internet Archive.
- No sé si DCM o CBP limitan descargas por día o por cuenta.

## 4. ¿Cómo presenta las páginas el lector de cada sitio? (criterios de la extensión)

### Conclusión
Funcionan **sin cambios, o casi**: **ComicBook Experience** (los 36 `<img>` del número en una sola página, con número en la URL), **Comloc Vault** (todos los `<img>` webp con lazy nativo y número en la URL) y **Pepper&Carrot** (todos los `<img>` en una página, con episodio numerado). Hay que **adaptarla** para **Comic Book Plus** (un solo `<img>` que el JS cambia página por página), **DCM** (visor con URL por página) e **Internet Archive** (BookReader), pero los tres ofrecen descarga directa. **Barnacle Press** muestra miniaturas y enlaces al tamaño completo. **LoC** y **HathiTrust** no los pude verificar. **Ningún sitio verificado está "protegido"** (no vi canvas, blob:, cifrado ni tiles mezclados).

### Hallazgos citados (lo que vi y cuándo)
- **ComicBook Experience** (21-11-2026, HTML crudo de `/read/4-most-boys-37/`): 36 `<img src="https://img.comicbookexperience.com/reading/9052/0001.jpg" … alt="4 Most Boys #37 — page 1 of 36" width="1600" height="2358">`. Las dos primeras tienen `loading="eager"` y las demás `loading="lazy"` nativo, con `src` completo desde el HTML (no hay data-src). Van dentro de un `<div class="strip" data-strip data-count="36">` con JS de arrastre y deslizamiento (`strip.scrollLeft`, `step(...)`) y enlaces permanentes por página con `#p<N>`. La URL termina en el número del ejemplar (`4-most-boys-37`) y el índice `/read` lista enlaces por número — [Página del número](https://comicbookexperience.com/read/4-most-boys-37/); [Reading room](https://comicbookexperience.com/read)
- **Comloc Vault** (21-11-2026, `/comics/read/blue-bolt-1/`): 74 `<img>` en total, de las cuales las páginas son `<img src="/comics/read/blue-bolt-1/pages/p002.webp" width="1200" height="1695" loading="lazy" … alt="Blue Bolt #1 (1940), page 2">`: rutas relativas del mismo dominio, en WebP, todas en una sola página — [Blue Bolt #1](https://www.comicshoplocator.com/comics/read/blue-bolt-1/)
- **Pepper&Carrot** (21-11-2026, episodio 1): todas las páginas son `<img src="https://www.peppercarrot.com/0_sources/ep01_Potion-of-Flight/low-res/en_Pepper-and-Carrot_by-David-Revoy_E01P01.jpg">` en una sola página, en baja resolución. Hay enlace a la carpeta `hi-res/` y a zips (`_art-pack.zip`, `_lang-pack.zip`). La URL lleva el número de episodio (`ep01_…`) — [Episodio 1](https://www.peppercarrot.com/en/webcomic/ep01_Potion-of-Flight.html)
- **Comic Book Plus** (captura del Wayback del 12-07-2026; la página en vivo da 403 a clientes automáticos): la ficha `?dlid=20000` (Kid Eternity 12) tiene un solo `<img id="maincomic" src="https://box01.comicbookplus.com/viewer/20/20f88ce2efe0d3459f0bc4d17834f18b/0.jpg" onclick="turnpage(1)">`. El JS en línea define `comicnumpages=52` y `comicloc="viewer/20/…"`, y al cambiar de página hace `document.getElementById("maincomic").src=website+comicloc+"/"+page+".jpg"`. Es una página por vista, con imágenes en otro host (box01) y URL predecibles 0..N-1. Los números no están en la URL (`dlid` es un ID interno) — [Wayback CBP](https://web.archive.org/web/20260712023832/https://comicbookplus.com/?dlid=20000)
- **Digital Comic Museum**: la portada del visor `/preview/` (captura del 20-06-2025) se llama "Digital Comic Museum Viewer", enlaza a `index.php?did=34323` y carga las miniaturas con `data-lazy="https://digitalcomicmuseum.com/thumbnails/34323.jpg"` — [Wayback, 20-06-2025](https://web.archive.org/web/20250620222956/https://www.digitalcomicmuseum.com/preview/). Una captura **antigua (22-10-2015)** del visor `index.php?did=100` mostraba enlaces por página (`page=1`, `page=2`…), imágenes en `/images/pages/100/N.jpg` y desplegables de editorial, título y número — [Wayback, 2015](https://web.archive.org/web/20151022225950/http://digitalcomicmuseum.com/preview/index.php?did=100). La estructura actual del visor no la verifiqué.
- **Internet Archive** (21-11-2026): la página `details/BlueBoltV712` carga `BookReaderJSIA.php` (el BookReader del IA). Los archivos que se pueden bajar son PDF, DjVu y JP2 ZIP — [Ítem](https://archive.org/details/BlueBoltV712); [Metadatos](https://archive.org/metadata/BlueBoltV712)
- **Barnacle Press** (21-11-2026, `/comic/Kid-ology/`): las miniaturas son `<img class="thumb lg_ajax" src="https://www.barnaclepress.com/wp-admin/admin-ajax.php?action=lg_image_request&file=Kid-ology/1920-02-14.jpg&thumb=1">`, y el tamaño completo está solo como `<a href="https://www.barnaclepress.com/cmcvlt/Kid-ology/slides/1920-02-14.jpg">` para una lightbox. Las tiras van por fecha y no por número — [Kid-ology](https://www.barnaclepress.com/comic/Kid-ology/)
- **Comic Strip Library** (21-11-2026): SPA en React. El HTML inicial no trae ningún `<img>` (solo `<div id="root">`). Las imágenes vienen de S3 (`comic-strip-library.s3.us-west-2.amazonaws.com`) y la vista individual está en `/display/$id`. No verifiqué cómo muestra las tiras porque no ejecuté JS — [comicstriplibrary.org](https://comicstriplibrary.org/)
- **Wikimedia Commons** (21-11-2026): las páginas de categoría muestran miniaturas `<img loading="lazy" src="https://thumb.wikimedia.org/…/250px-….jpg" srcset="…500px… 2x" data-file-width="3166">`. El original está en la página de cada archivo — [Commons](https://commons.wikimedia.org/wiki/Category:Little_Nemo_in_Slumberland)
- **LoC / Chronicling America** y **HathiTrust**: el 21-11-2026 loc.gov devolvió 403 a curl y HathiTrust, un desafío de Cloudflare ("Just a moment..."). Sin verificar.
- **Comic Book Plus / Digital Comic Museum en vivo**: los dos devolvieron 403 con el desafío de Cloudflare "Just a moment..." a curl y a WebFetch el 21-11-2026 (verificado). En un Chrome real con el usuario adelante, el desafío se resuelve solo, así que no lo considero protección de imágenes.

### Inferencias (tabla de compatibilidad con la extensión)

| Sitio | Lector | ¿Funciona sin cambios? | Descarga directa |
|---|---|---|---|
| ComicBook Experience | Todos los `<img>` en el HTML, lazy nativo, contenedor "strip" con arrastre o deslizamiento | Probablemente sí: las URL ya están en `src`. Riesgo: si "strip" es un panel con scroll interno horizontal, las imágenes lazy fuera de vista no se cargan, lo que importa si la extensión filtra por tamaño ya cargado. URL con número | No vi |
| Comloc Vault | Todos los `<img>` webp, lazy nativo, una sola página | Sí (son pocos números, unos 10) | No vi |
| Pepper&Carrot | Todos los `<img>` en una página | Sí, pero en baja resolución. La alta está en `hi-res/` y en zips | Sí (zips oficiales, PDF del libro 1) |
| Comic Book Plus | Un `<img>` que cambia por JS (una página por vista) | No: hay que adaptarla (las URL `…/viewer/<hash>/<n>.jpg` son predecibles, `comicnumpages` está en el HTML). `dlid` sin número de ejemplar | Sí, con cuenta (CBZ y otros) |
| Digital Comic Museum | Visor con URL por página (evidencia de 2015), desplegables | No: hay que adaptarla | Sí, CBR/CBZ con cuenta gratuita |
| Internet Archive | BookReader (JS) | No: hay que adaptarla | Sí: PDF, JP2 ZIP, DjVu en el ítem de ejemplo (que haya CBR/CBZ originales en otros ítems no está verificado) |
| Barnacle Press | Miniaturas `<img>` + enlaces a lightbox | No del todo: solo tomaría miniaturas. Hay que seguir los `<a href>` | No |
| Comic Strip Library | SPA, imágenes en S3 | No verificado | No verificado |
| Wikimedia Commons | Galería de miniaturas | No aplica: son tiras sueltas, el original está en cada página | Sí (archivo original por página) |
| LoC / Chronicling America | No verificado (probablemente visor con zoom) | No verificado | Sí: PDF/JP2 por página ([ayuda](https://webarchive.library.unt.edu/web/20090109183838/http://www.loc.gov/chroniclingamerica/help.html)) |
| HathiTrust | No verificado | No verificado | Página por página (libro completo según quién lo digitalizó) |

- Ningún sitio verificado usa canvas, blob:, cifrado ni tiles mezclados: ninguno entra en la categoría "protegido".
- No vi indicios de que haga falta Referer en ComicBook Experience (CDN `img.comicbookexperience.com`), CBP (`box01.comicbookplus.com`) ni Barnacle Press, pero no lo probé: el HTML crudo no lo muestra. Es justo el pendiente "Referer" del proyecto.

### Vacíos
- No probé en un navegador real (con JS) ComicBook Experience, Comic Strip Library, BookReader del IA, loc.gov ni HathiTrust. Lo que digo de BookReader más allá de que el script está presente no está verificado.
- No probé si alguna CDN de imágenes exige Referer (haría falta una petición con y sin Referer desde la misma IP; no la hice).
- El visor actual de DCM solo lo vi en una captura de 2015. Puede haber cambiado.
