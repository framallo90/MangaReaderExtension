# Archivos, bibliotecas y repositorios en español (España y Latinoamérica) para leer historietas legítimas

Notas de investigación. Fecha de consulta: 21-11-2026. "Verificado" quiere decir que bajé la página o el archivo con `curl` o consulté una API ese día. Cuando dice "no verificado" es porque el sitio rechazó la conexión o devolvió una página anti-bots, o porque no llegué a abrirlo.

Método extra: para saber qué títulos de historieta y humor gráfico tiene cada biblioteca usé la API pública de Europeana, que agrega BNE, ARCA, Prensa Histórica, UAB, Galiciana y otras (`https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=...`, consultada el 21-11-2026). Los números de Europeana cuentan registros, que casi siempre son números sueltos de una revista, y sirven como orden de magnitud. También hay ruido: por ejemplo, partituras tituladas "historieta".

Criterio de la extensión, resumido: anda sola si las páginas son `<img>` con URL http(s) y todo el número está en una sola página. Hay que adaptarla si es una página por pantalla, si exige Referer, si tiene panel de scroll propio, iframe o fondos CSS. Lo que es "protegido" (cifrado, teselas mezcladas, canvas, blob:, DRM) queda fuera.

---

## 1. España: BNE (Biblioteca Digital Hispánica y Hemeroteca Digital), Prensa Histórica, ARCA, Biblioteca de Catalunya y MDC, UAB, regionales y Cervantes Virtual. ¿Cuáles tienen tebeos y cómo se ven?

### Takeaway
El material español abierto es casi todo **prensa satírica y de humor gráfico (1880-1936) y revistas infantiles catalanas anteriores a la guerra**: Madrid Cómico, Gedeón, Buen Humor, Muchas Gracias, La Risa, The Monigoty, Correo de los Niños en la BNE; En Patufet, Virolet, Papitu, Cu-Cut! y L'Esquella de la Torratxa en ARCA; El Mundo Cómico y El Clown en Prensa Histórica. **Los tebeos clásicos de posguerra (TBO, Pulgarcito, Chicos, Flechas y Pelayos) no aparecen en ninguna biblioteca pública digital abierta.** Varias plataformas bloquearon el acceso automático (BNE devolvió 403, ARCA rechazó la conexión, la UAB tiene anti-bots Anubis), así que el comportamiento de los visores quedó mayormente sin verificar.

### Cited Findings

**BNE: Hemeroteca Digital (HD) y Biblioteca Digital Hispánica (BDH). España.**
- Ahora BNE Digital (`bnedigital.bne.es`) reúne la Hemeroteca Digital (miles de cabeceras, casi 110 millones de páginas), que conserva su portal propio. El proyecto de integración empezó en octubre de 2025 — [BNE Digital](https://bne.es/en/catalogues/bne-digital); [CENL](https://www.cenl.org/the-national-library-of-spain-launches-bne-digital-the-platform-for-accessing-its-digital-heritage/)
- Títulos de humor gráfico o infantiles en la HD, con su cantidad de registros en Europeana (21-11-2026): *Madrid Cómico* (1.161), *Gedeón* (885), *Buen Humor* (Madrid, 424), *Muchas Gracias* (Madrid, 396), *La Risa* (Madrid, 1888; 158), *Correo de los Niños* (números de 1913-1914), *The Monigoty* (Barcelona, 1897) y la argentina *Caras y Caretas* (2.231). Los enlaces apuntan a `hemerotecadigital.bne.es/details.vm?q=id:...` — [API de Europeana, consulta de ejemplo](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=title:%22Madrid%20comico%22&qf=DATA_PROVIDER:%22National%20Library%20of%20Spain%22)
- *Caras y Caretas* (Buenos Aires): la HD de la BNE tiene más de 2.000 números — [argentina.gob.ar](https://www.argentina.gob.ar/node/149410). La serie preservada va del 08-10-1898 al 07-10-1939 — [Portal ISSN](https://portal.issn.org/resource/issn/0327-6384)
- Búsquedas por título en Europeana restringidas a la BNE: **0 resultados** para "TBO", "Pulgarcito", "Billiken" y "PBT". "Pinocho", "Macaco", "Chiquitín" y "Flechas y Pelayos" solo devuelven homónimos (grabados, partituras, libros) — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=title:%22Pulgarcito%22&qf=DATA_PROVIDER:%22National%20Library%20of%20Spain%22)
- Licencia: las imágenes de dominio público de bne.es y de sus catálogos digitales (BDH y HD) están bajo **CC BY 4.0**, y su uso público es libre, sin autorización previa — [BNE, procedimiento de reproducción](https://www.bne.es/sites/default/files/repositorio-archivos/procedimiento_normas_reproduccion.pdf); [datos.gob.es](https://datos.gob.es/es/catalogo/ea0019768-biblioteca-digital-documentos-en-dominio-publico1); [Xataka](https://www.xataka.com/legislacion-y-derechos/bne-libera-25-millones-digitalizaciones-obras-dominio-publico-se-podran-usar-gratis-incluso-para-fines-comerciales). **Contradicción:** en los metadatos que la BNE envía a Europeana, esos mismos números (Correo de los Niños, The Monigoty) figuran como **CC BY-NC-SA 4.0** — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=tebeo&qf=DATA_PROVIDER:%22National%20Library%20of%20Spain%22)
- Visor: **no verificado**. `hemerotecadigital.bne.es` devolvió **HTTP 403** a `curl` y a WebFetch el 21-11-2026. Patrones de URL según Europeana: la HD usa `details.vm?q=id:<id>` y la ficha nueva `hd/es/card?sid=<n>`; la BDH usa `bdh-rd.bne.es/viewer.vm?id=<id>&page=1`, con el número de página en la URL — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=historieta&qf=DATA_PROVIDER:%22National%20Library%20of%20Spain%22); [AHIRA, otras colecciones (enlace card?sid=)](https://ahira.com.ar/otras-colecciones-digitales/)
- La BNE armó en 2023 una colección sobre el cómic dentro del Archivo de la Web Española. Es archivo web, no tebeos digitalizados — [Blog UVaDOC](https://uvadoc.blogs.uva.es/2023/09)
- Para descarga masiva legal, la BNE publica en datos.gob.es un dataset de metadatos de obras de dominio público con enlace al objeto digital y al OCR — [datos.gob.es](https://datos.gob.es/es/catalogo/ea0019768-biblioteca-digital-documentos-en-dominio-publico1)

**Biblioteca Virtual de Prensa Histórica (BVPH, Ministerio de Cultura). `https://prensahistorica.mcu.es`. España.**
- Licencia: **CC BY 4.0** en todos los registros que envía a Europeana — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=humor%C3%ADstico&qf=DATA_PROVIDER:%22Virtual%20Library%20of%20Historical%20Press%22)
- Títulos de humor: *El Mundo Cómico: semanario humorístico* (números sueltos del año I al año IV, por lo menos hasta el n.º 149) y *El Clown: periódico semanal festivo y humorístico* (años I-II). También tiene 155 registros de *Caras y Caretas* y artículos sobre historieta ("Breve historia de la historieta española", "Bibliografía básica sobre la historieta", "El tebeo, el 'cómic' y Dios dirá"). Las URL siguen el patrón `prensahistorica.mcu.es/es/consulta/registro.do?id=<n>` — [ejemplo: El Mundo Cómico n.º 1](https://prensahistorica.mcu.es/es/consulta/registro.do?id=11000020312); [El Clown](https://prensahistorica.mcu.es/es/consulta/registro.do?id=4049)
- Visor: **no verificado**. Con `curl`, `registro.do` y `grupo.cmd` devuelven una carcasa HTML de unos 24 KB armada por JavaScript, con un `registrar_primera_visita.do`, sin imágenes ni enlaces a PDF. Las URL de manifiesto IIIF que probé dieron 404 (verificado el 21-11-2026) — [registro de ejemplo](https://prensahistorica.mcu.es/es/consulta/registro.do?id=11000020313)

**ARCA, Arxiu de Revistes Catalanes Antigues (Biblioteca de Catalunya). `https://arca.bnc.cat/arcabib_pro/`. Cataluña.**
- Es un portal abierto de revistas que ya no se publican y que son importantes para la historia de Cataluña — [bnc.cat, ARCA](https://bnc.cat/digital/arca/angles/texts/arca.htm)
- Registros en Europeana con proveedor ARCA (21-11-2026): *En Patufet* (2.271), *L'Esquella de la Torratxa* (3.133), *Papitu* (1.269), *Cu-Cut!* (560), *Virolet* (469), *Mainada* (131), *Jordi* (76). URL del tipo `arca.bnc.cat/arcabib_pro/ca/consulta/registro.do?id=10000108821` (En Patufet, año 1, n.º 4) — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=En%20Patufet)
- Derechos: los números de *En Patufet* figuran como **"In Copyright" (rightsstatements.org InC)** en Europeana. Se pueden leer, pero no se declaran de dominio público — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=En%20Patufet)
- *En Patufet* fue una revista infantil en catalán (Barcelona, 1904-1938) y llegó a ser el semanario catalán de más tirada (65.000 ejemplares) — [Wikipedia](https://en.wikipedia.org/wiki/En_Patufet)
- Visor: **no verificado**. `arca.bnc.cat` rechazó la conexión (ECONNREFUSED en el puerto 443) tanto desde `curl` como desde WebFetch el 21-11-2026.
- *TBO* se publicó en castellano (Barcelona, 1917-1983), así que probablemente no esté en ARCA, que es de revistas en catalán — [búsqueda: Enciclopèdia](https://www.enciclopedia.cat/gran-enciclopedia-catalana/tbo). La BC completó en papel su colección del TBO a partir del depósito legal y de donaciones (alrededor de 2010) — [tríptico TBO de la BC](https://www.bnc.cat/eng/content/download/105904/1615409/file/tríptic_TBO.pdf). Su fondo en papel supera los 12.000 títulos de cómic — [Dossier Còmic de la BC](https://www.bnc.cat/esl/content/download/134165/1978132/version/1/file/Dossier_Comic_BC_def.pdf)

**Memòria Digital de Catalunya (MDC, CSUC/BC). `https://mdc.csuc.cat`. Cataluña.**
- Usa CONTENTdm (URL `mdc.csuc.cat/cdm/ref/collection/...`). Tiene ítems vinculados a Patufet, como el espectáculo "Patufet films" (1935, manuscrito de la BC, derechos "CNE") o los "Versos catalans copiats d'En Patufet" (1910, CC BY-NC-ND), pero no la revista completa — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=En%20Patufet)

**Dipòsit Digital de Documents de la UAB (DDD). `https://ddd.uab.cat`. Cataluña.**
- *Virolet: suplement il·lustrat d'En Patufet*, con **Public Domain Mark 1.0** — [ddd.uab.cat/record/27382](https://ddd.uab.cat/record/27382); [Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=En%20Patufet)
- Colección de **fanzines** de historieta de los años 80 en adelante: *ZZZ: Tebeo*, *Tintachina: tebeo castellano-leonés*, *Punkomix*, *El Sub.Tebeo* (1983), *El Tebeo del Paraíso: las mejores historietas de Pamplona*, *Trok de bak*, *Tebeo de la nit*, *Camello* (1983), entre otros. Derechos **InC-EDU** (con derechos de autor, uso educativo permitido) — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=tebeo&qf=DATA_PROVIDER:%22Autonomous%20University%20of%20Barcelona%22); [ejemplo](https://ddd.uab.cat/record/267536)
- Descarga directa: el PDF `https://ddd.uab.cat/pub/fanzines/camello/camello_a1983n6.pdf` respondió **200, application/pdf, 57 MB** (verificado el 21-11-2026). Las fichas HTML (`/record/...`, `/search`) muestran primero un **desafío anti-bots Anubis** (prueba de trabajo en JS) — verificado con curl y [WebFetch](https://ddd.uab.cat/record/27382?ln=en)
- También existe la colección "Revistes antigues d'art i cultura" — [ddd.uab.cat/collection/raac](https://ddd.uab.cat/collection/raac?ln=ca)

**Dadun, repositorio de la Universidad de Navarra.**
- *L'Auca d'en Patufet* (Folch i Torres, 1920), material gráfico con **CC0** — [hdl.handle.net/10171/31925](https://hdl.handle.net/10171/31925)

**Museo Pedagógico de Aragón.**
- Aporta 34 registros con "tebeo" a Europeana. No revisé el contenido — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=tebeo&rows=0&profile=facets&facet=DATA_PROVIDER)

**Galiciana (Biblioteca y Arquivo Dixital de Galicia).**
- Una búsqueda de "tebeo / historieta / revista infantil" en español fuera de la BNE devolvió **un solo** resultado de Galiciana: un "Recorte de prensa" con CC BY-NC-ND. Galiciana sí aporta 29 registros de *Caras y Caretas* — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=Caras%20y%20Caretas&rows=0&profile=facets&facet=DATA_PROVIDER)

**Liburuklik (Biblioteca Digital Vasca).**
- Al lanzarse se limitó a material hasta 1940, para evitar problemas de derechos — [Berria 2011, en euskadi.eus](https://www.euskadi.eus/web01-a2oteus/eu/contenidos/informacion/bibliotecas_prensa_2011/eu_bib_pren/adjuntos/2011-09-28Berria.pdf). El cómic en euskera *Ipurbeltz* (1978-1995) no aparece digitalizado — [Tebeosfera, ficha de Ipurbeltz](https://tebeosfera.com/colecciones/ipurbeltz_1978_erein.html)

**Biblioteca Virtual Miguel de Cervantes.**
- Tiene **estudios** sobre historieta y humor gráfico (por ejemplo, "Animales y otras especies del humor satírico en la prensa del siglo XIX", "Testimonios entre viñetas" y "Un vistazo a la última década de la narrativa gráfica colombiana"), no colecciones de tebeos — [Cervantes Virtual](https://cervantesvirtual.com/obra/testimonios-entre-vinetas-1070850/); [Cervantes Virtual](https://www.cervantesvirtual.com/obra/un-vistazo-a-la-ultima-decada-de-la-narrativa-grafica-colombiana-en-tres-trazos-1161109)

**Tebeosfera (catálogo de referencia).**
- Manuel Barrero dice que digitalizaron "unos 100.000 tebeos españoles previos a 1968", que "Es un tesoro y está al alcance de investigadores". No menciona plataforma pública, URL ni formato, y no recibieron ayuda pública — [Revista Mercurio, 19-04-2026](https://www.revistamercurio.es/2026/04/19/manuel-barrero-hemos-conseguido-digitalizar-unos-100-000-tebeos-espanoles-previos-a-1968-que-es-la-fecha-en-la-que-el-tebeo-espanol-se-transforma-por-completo/)

**Arxiu Municipal de Granollers.**
- Digitalizó y difunde 22 documentos gráficos del fondo Josep Escobar (dibujos y cómics originales; Escobar fue dibujante de *Pulgarcito*) — [Granollers](https://www.granollers.cat/printpdf/noticies/arxiu/l%E2%80%99arxiu-difon-i-fa-accessible-el-fons-documental-de-josep-escobar-pare-dels-populars); [XAM, Diputació de Barcelona, 15-01-2025](https://xam.diba.cat/printpdf/news/2025/01/15/arxiu-municipal-de-granollers-difon-fa-accessible-fons-documental-de-josep-escobar-p)

**Memoria de Madrid (Hemeroteca Municipal).**
- AHIRA lo lista como colección digital — [AHIRA, otras colecciones](https://ahira.com.ar/otras-colecciones-digitales/). No confirmé que tenga revistas infantiles digitalizadas: las memorias 2023-2025 de la Hemeroteca Municipal no lo mencionan — [Memoria 2025](https://bibliotecas.madrid.es/UnidadesDescentralizadas/Bibliotecas/BibliotecasEspecializadas/HemerotecaMunipal/CalidadEvaluacion/Memorias/ficheros/Memoria%202025.pdf)

### Inferences
- ARCA (`arcabib_pro/.../consulta/registro.do?id=`), BVPH (`prensahistorica.mcu.es/es/consulta/registro.do?id=`) y Galiciana (`arquivo.galiciana.gal/arpadweb/gl/consulta/registro.do?id=`) comparten el mismo patrón de URL, así que probablemente corren la misma plataforma (DIGIBIB, de DIGIBÍS). Si es así, adaptar la extensión a una cubriría las tres. Es una inferencia por las URL, sin verificar.
- El número de página en la URL del visor de la BDH (`viewer.vm?id=...&page=1`) sugiere un visor de una página por pantalla, que es un caso a adaptar. No verificado.
- La ausencia de TBO y Pulgarcito se explica por los derechos: en España, los autores muertos después de 1940 siguen protegidos 80 años. Lo legal y abierto se concentra antes de 1936 o en material cedido, como los fanzines de la UAB.
- La UAB entrega PDF directos, así que ahí la extensión no hace falta. El desafío Anubis (UAB e IAI) se resuelve solo en un navegador real, pero podría trabar descargas en lote hechas con `fetch` desde el service worker sin cookies.
- Licencia práctica: BNE y BVPH son las más claras (CC BY 4.0, pese a la contradicción BY-NC-SA en Europeana). ARCA marca *En Patufet* como "In Copyright": se puede leer y guardar para uso personal, pero no redistribuir.

### Gaps
- No pude ver cómo presentan las páginas los visores de BNE HD/BDH (403), ARCA (conexión rechazada), BVPH (carcasa JS), MDC (CONTENTdm, que no abrí) ni Galiciana. Tampoco confirmé si ofrecen PDF por número ni IIIF.
- Biblioteca Virtual de Andalucía, Biblioteca Digital de Castilla y León, BIVALDI (Valencia), Jable (Canarias), DARA (Aragón), Biblioteca Digital de Murcia y Memoria de Madrid: no busqué títulos de humor o historieta, por falta de tiempo.
- No encontré ninguna fuente pública con *TBO*, *Pulgarcito*, *Chicos*, *Flechas y Pelayos*, *Pinocho*, *Macaco* ni *Chiquilín* digitalizados con acceso abierto.

---

## 2. Argentina: BNMM, AHIRA, archivos de historieta y repositorios universitarios (Caras y Caretas, Billiken, Patoruzú, Rico Tipo, Hora Cero, Misterix)

### Takeaway
**AHIRA es, por lejos, la mejor fuente argentina.** Tiene unos 324 títulos y entre ellos más de 20 de historieta y humor gráfico: *Patoruzú*, *Hora Cero Suplemento Semanal*, *Fierro*, *Skorpio*, *Anteojito*, *Pucará*, *Satiricón*, *Tío Landrú*, *Locuras de Isidoro*, *Chaupinela* y otros. Cada número es un **PDF directo** con su número en la URL. *Caras y Caretas* se lee completa en la Hemeroteca Digital de la BNE (España). **No encontré digitalizaciones legítimas y abiertas de *Billiken*, *Rico Tipo* ni *Misterix*.** Trapalanda (BNMM) no respondió.

### Cited Findings

**AHIRA, Archivo Histórico de Revistas Argentinas. `https://ahira.com.ar`. Argentina.**
- Archivo digital abierto y gratuito, creado por investigadores de la UBA (letras, historia y ciencias de la comunicación) y dirigido por Sylvia Saítta. Más de 150 revistas digitalizadas según una fuente de 2025 — [FLACSO, 2025](https://www.flacso.org.ar/wp-content/uploads/2025/04/06-Ahira_Repositorio-digital.pdf); [La Izquierda Diario](https://www.laizquierdadiario.com/Sylvia-Saitta-Ahira-un-kiosco-de-revistas-pero-en-internet). Al recorrer las 14 páginas del listado el 21-11-2026 conté **324 títulos** — [ahira.com.ar/revistas](https://ahira.com.ar/revistas/)
- Títulos de historieta o humor gráfico en el listado (por el nombre; solo abrí *Patoruzú*): `patoruzu`, `hora-cero-suplemento-semanal`, `fierro`, `skorpio`, `anteojito`, `pucara`, `el-diario-de-los-chicos`, `locuras-de-isidoro`, `tio-landru`, `satiricon`, `los-humores-de-satiricon`, `chaupinela`, `mengano`, `humi`, `4-patas`, `lupin`, `ld-literatura-dibujada`, `tiras-de-cuero`, `le-chiste`, `suplemento-de-humor-y-ciencia-ficcion`, `hurra`, `satira-humor` — [ahira.com.ar/revistas](https://ahira.com.ar/revistas/) (verificado el 21-11-2026)
- **Cómo se presenta (verificado el 21-11-2026):** cada revista tiene una página paginada (`/revistas/patoruzu/page/2/` … `/page/11/`, 12 números por página) con enlaces a cada número (`/ejemplares/patoruzu-no-1/` … `patoruzu-no-12/`) y **enlaces directos al PDF** (`/wp-content/uploads/2020/06/Patoruzu-001.pdf` … `-012.pdf`). `Patoruzu-001.pdf` responde **200, application/pdf, 12,1 MB**. La página del número no tiene `<iframe>` ni `<embed>` en el HTML estático — [Patoruzú en AHIRA](https://ahira.com.ar/revistas/patoruzu/); [PDF n.º 1](https://ahira.com.ar/wp-content/uploads/2020/06/Patoruzu-001.pdf)
- Estudios preliminares en PDF: *Patoruzú* (presentación e índice de Martín Greco), *Anteojito*, *Pucará*, *Fierro*, *El Diario de los Chicos*, *Hora Cero* (Leibovich, "La historia de Hora Cero, la revista que dio origen a El Eternauta") — [Greco, Patoruzú](https://ahira.com.ar/wp-content/uploads/2020/06/Greco-Revista-Patoruzú-Presentacion.pdf); [Leibovich, Hora Cero](https://ahira.com.ar/wp-content/uploads/2024/04/Leibovich-La-historia-de-Hora-Cero-la-revista-que-dio-origen-a-El-Eternauta.pdf); [Rey, Fierro](https://ahira.com.ar/wp-content/uploads/2019/09/Rey-Fierro.pdf); [Greco, Anteojito](https://ahira.com.ar/wp-content/uploads/2023/12/Greco-Anteojito-Presentacion.pdf)
- El suplemento semanal de *Hora Cero* se puede bajar — [jrmora.com](https://jrmora.com/en/weekly-supplement-hora-cero-available-downloading/). *Satiricón* está digitalizada — [Diario Jornada](https://www.diariojornada.com.ar/228786/sociedad/digitalizaron_satiricon_la_clasica_revista_de_los_anos_)
- Términos: "La gestión del permiso para la publicación o la cita del material que Ahira pone a libre disposición del público será responsabilidad de lxs interesadx/s. El Consejo de Dirección no lo tramita ni otorga." Al pie: "©2018-2020 Ahira.com.ar - Derechos Reservados" — [Sobre el proyecto](https://ahira.com.ar/sobre-el-proyecto/)
- AHIRA mantiene una lista de otras colecciones digitales: Biblioteca Argentina (prensa histórica, `biblioargentina.gob.ar/prensa-historica`), `publicaciones.bn.gob.ar` (BNMM), AméricaLee (CeDInCI), Memoria Académica (FaHCE-UNLP), Hemeroteca Digital de Santa Fe, el visor del IAI de Berlín, revistas-culturales.de, Anáforas (Uruguay), Memoria Chilena, Hemeroteca Digital de la BNE, ARCA, BVPH, Memoria de Madrid y otras — [AHIRA, otras colecciones digitales](https://ahira.com.ar/otras-colecciones-digitales/)

**Biblioteca Nacional Mariano Moreno (BNMM): Trapalanda y publicaciones.**
- Trapalanda, la biblioteca digital de la BNMM, se lanzó en 2014 con unas 6.000 obras (libros antiguos, revistas, diarios, manuscritos) — [MDZ, 2014](https://www.mdzol.com/sociedad/2014/8/13/trapalanda-una-gran-noticia-para-la-cultura-940834.html/amp)
- `trapalanda.bn.gov.ar` **no respondió** (curl código 000) el 21-11-2026. No verificado.
- En 2015, la BNMM y Abuelas de Plaza de Mayo publicaron *Historietas x la identidad* (35 historias en viñetas). Ver la sección 5 — [La Capital](https://www.lacapital.com.ar/educacion/un-libro-textos-y-vinetas-nietas-y-nietos-que-recuperaron-su-identidad-n10153149.html/amp)

***Caras y Caretas* (1898-1939).**
- Se lee completa en la HD de la BNE (más de 2.000 números) — [argentina.gob.ar](https://www.argentina.gob.ar/node/149410). Además aporta 155 registros de la BVPH, 111 de un repositorio universitario español (nombre truncado en Europeana: "Documentary Repository of the University of S…") y 29 de Galiciana — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=Caras%20y%20Caretas&rows=0&profile=facets&facet=DATA_PROVIDER)
- HathiTrust tiene un tomo de 1898, que es una serie parcial — [Portal ISSN](https://portal.issn.org/resource/issn/0327-6384)
- *PBT*: el IAI de Berlín aporta ilustraciones sueltas (caricaturas de 1906-1916) a la Deutsche Digitale Bibliothek, no números completos — [DDB](https://www.deutsche-digitale-bibliothek.de/item/S32QAJHBGLIYJVZTNUGVWUA4C7KRLI5P?lang=en)
- El portal revistas-culturales.de tiene una página temática sobre *Caras y Caretas* — [revistas-culturales.de](https://www.revistas-culturales.de/en/themen/caras-y-caretas)

**Hemeroteca Digital de la Provincia de Santa Fe. `https://www.santafe.gob.ar/hemeroteca/`.**
- Diarios santafesinos de las décadas de 1910 y 1920. No encontré revistas de historieta — [Hemeroteca Santa Fe](https://www.santafe.gob.ar/hemeroteca/buscar/403/)

**educ.ar (Ministerio de Educación).**
- Historietas sobre María Remedios del Valle, ganadoras de un concurso del Ministerio de Cultura, con licencia **CC BY-NC-SA** — [educ.ar](https://www.educ.ar/recursos/157132/las-historietas-de-maria-remedios-del-valle)

### Inferences
- En AHIRA la extensión no hace falta: cada número es un PDF descargable, con el número en la URL (`patoruzu-no-N`, `Patoruzu-00N.pdf`), así que hasta una descarga en lote sería trivial con el listado de enlaces. Pero la extensión, tal como está, guarda `<img>` y no PDF enlazados.
- *Fierro* y *Skorpio* siguen con derechos. Que estén en AHIRA sugiere permisos de los titulares, aunque AHIRA no lo dice explícitamente. Uso personal sí; republicar requiere permiso, según los términos.

### Gaps
- *Billiken*, *Rico Tipo*, *Misterix*, *Intervalo*, *D'Artagnan*, *Tit-Bits* y *El Tony*: no encontré ninguna colección digital legítima y abierta.
- No pude verificar Trapalanda ni `publicaciones.bn.gob.ar`, ni si la BNMM tiene historietas digitalizadas.
- No revisé uno por uno los títulos de AHIRA aparte de *Patoruzú*. No sé si todos los números de *Fierro*, *Skorpio* o *Hora Cero* tienen PDF ni cuántos hay de cada uno.
- Museo del Humor (MuHu, Buenos Aires), Biblioteca del Congreso y Biblioteca Nacional de Maestros: no investigados.

---

## 3. México, Chile, Uruguay, Colombia, Perú, Cuba y otros: ¿quién tiene historietas o revistas de humor digitalizadas?

### Takeaway
**Chile (Memoria Chilena) es la fuente más rica fuera de AHIRA y la BNE.** Tiene un minisitio sobre la historieta chilena (1858-1998) con *El Peneca*, *Mampato*, *Chicos i grandes* (25 números) y *Trauko*, todo en **PDF directo**. Uruguay tiene *Mundo Uruguayo* (1919-1967) en el repositorio de la Udelar. México tiene la prensa satírica del siglo XIX en la HNDM y un **catálogo** (no confirmado como lector) de más de 1.400 historietas ("pepines"). Colombia, Perú y Cuba tienen poco: caricatura y revistas infantiles sueltas.

### Cited Findings

**Chile: Memoria Chilena (Biblioteca Nacional de Chile). `https://www.memoriachilena.gob.cl`.**
- Minisitio "Historieta en Chile (1858-1998)", actualizado en 2019 junto con el Archivo de Láminas y Estampas de la BN — [Memoria Chilena](https://www.memoriachilena.gob.cl/temas/index.asp?id_ut=elcomicenchile)
- *Chicos i grandes* (1908): 25 números para leer y descargar, una revista pionera de la historieta infantil — [Memoria Chilena](https://www.memoriachilena.gob.cl/602/w3-article-594962.html)
- Minisitios de *Mampato* (con portadas de números de 1974 y 1976 y la primera y la última aventura de Themo Lobos), *El Peneca (1908-1960)*, "Departamento de Historietas de Zig-Zag" y "Revistas e historietas" — [Mampato](https://www.memoriachilena.gob.cl/602/w3-article-100696.html); [Revistas e historietas](https://www.memoriachilena.gob.cl/602/w3-article-94495.html); [Depto. de Historietas de Zig-Zag](https://www.memoriachilena.gob.cl/602/w3-article-596622.html)
- En 2021 se sumaron ocho tomos de la revista *Zig-Zag* — [The Clinic](https://www.theclinic.cl/2021/02/05/para-los-nostalgicos-ocho-tomos-zig-zag-vuelven-de-manera-digital-a-memoria-chilena/)
- **Formato (verificado el 21-11-2026):** cada objeto lleva a un **PDF directo**, por ejemplo `http://www.memoriachilena.gob.cl/archivos2/pdfs/MC0059221.pdf` ("Mampato", Themo Lobos, primera historieta, 1968, págs. 9-12) y `MC0059218.pdf` (última aventura, 1977). La ficha tiene metadatos y un botón "Descargar". Al pie dice "derechos reservados - 2025" — [ficha 61962](https://www.memoriachilena.gob.cl/602/w3-article-61962.html); [ficha 61959](https://www.memoriachilena.gob.cl/602/w3-article-61959.html)
- La Biblioteca Nacional Digital de Chile (`bibliotecanacionaldigital.gob.cl`) respondió 200, pero no saqué datos de historieta — [BND](https://www.bibliotecanacionaldigital.gob.cl/)

**Uruguay.**
- *Mundo Uruguayo*: los números de 1919 a 1967 están digitalizados en el repositorio de la Udelar, se buscan por número y se bajan en PDF — [UC Berkeley Library Update](https://update.lib.berkeley.edu/?p=32895)
- Anáforas (FIC-Udelar), `https://anaforas.fic.edu.uy/jspui/`, corre sobre DSpace JSPUI y respondió 200 el 21-11-2026 — [Anáforas](https://anaforas.fic.edu.uy/jspui/). Digitalizó la revista *Disculpe* — [Contemporánea, FHCE](https://ojs.fhce.edu.uy/index.php/cont/article/download/2706/3705/10933). Tuvo un proyecto del Endangered Archives Programme de la British Library (EAP1466) para rescatar diarios del siglo XIX de Montevideo — [BL EAP1466](https://eap.bl.uk/node/4601)
- Biblioteca Nacional de Uruguay: biblioteca digital DSpace (`bibliotecadigital.bibna.gub.uy`, enlazada desde AHIRA) y un proyecto para escanear prensa uruguaya del siglo XIX y la primera mitad del XX — [AHIRA, otras colecciones](https://ahira.com.ar/otras-colecciones-digitales/); [gub.uy](https://www.gub.uy/presidencia/comunicacion/noticias/biblioteca-nacional-descentralizara-acceso-textos-siglos-xix-xx-mediante)

**México.**
- Hemeroteca Nacional Digital de México (HNDM, UNAM), `https://hndm.iib.unam.mx`: más de 8 millones de imágenes de más de mil títulos, lanzada en 2012 — [UNAM Global](https://unamglobal.unam.mx/global_tv/hemeroteca-nacional-de-mexico-80-anos-preservando-la-memoria/). Tiene prensa satírica de caricatura, como *El Ahuizote* (1874-1876, tomo I, n.º 1-47), con un PDF de "descripción y descarga" — [HNDM, El Ahuizote](https://hndm.iib.unam.mx/consulta/publicacion/verDescripcionDescarga/558ff9217d1e32523086135f.pdf). `hndm.iib.unam.mx` **no respondió** a curl el 21-11-2026.
- Catálogo digital de historietas mexicanas (pepines.unam.mx, Hemeroteca Nacional): **más de 1.400 series** del siglo XX, en categorías de aventura, humor, melodrama y didácticas — [Gaceta UNAM](https://www.gaceta.unam.mx/presenta-la-unam-catalogo-digital-de-historietas-mexicanas/). **Contradicción:** un titular de UNAM Global dice "UNAM digitaliza más de mil 400 historietas mexicanas (Memín Pingüín, Kalimán, La Familia Burrón…)" — [UNAM Global](https://unamglobal.unam.mx/global_revista/unam-digitaliza-mas-de-mil-400-historietas-mexicanas-memin-pinguin-kaliman-la-familia-burron-entre-otras/) — pero otras descripciones hablan de fichas bibliográficas, sin confirmar que se puedan leer las páginas. `pepines.unam.mx` no respondió el 21-11-2026.
- El Center for Research Libraries tiene registros digitales de *El Ahuizote* — [CRL](https://digitalcollections.crl.edu/record/65626?ln=en)

**Colombia.**
- La Biblioteca Virtual del Banco de la República, creada en 1996 por la Biblioteca Luis Ángel Arango, digitalizó 539 caricaturas originales de comienzos del siglo XX — [Banrepcultural](https://www.cervantesvirtual.com/obra/la-biblioteca-virtual-del-banco-de-la-republica-23-anos-divulgando-el-patrimonio-colombiano-y-abriendo-puertas-a-la-informacion-1121714/); [boletín BLAA](https://admin.banrepcultural.org/sites/default/files/media/document/boletin_blaa_inves_6_0.pdf)
- *Chanchito* (revista infantil, 1933-1934, 63 números; la BNC tenía registrados solo 21) fue digitalizada por un proyecto del Politécnico Grancolombiano para consultarla en BibloRed — [Radio Nacional](https://radionacional.co/cultura/literatura/revista-infantil-chanchito-historia-y-digitalizacion-2023); [El Espectador](https://www.elespectador.com/el-magazin-cultural/profesores-del-politecnico-grancolombiano-regresan-la-revista-chanchito-a-la-vida/)

**Perú.**
- *Monos y Monadas* (semanario festivo y de caricaturas de Leonidas Yerovi, con Julio Málaga Grenet como director artístico; hay portadas de 1906) está en el Endangered Archives Programme de la British Library (EAP1601) — [BL EAP1601-1-37](https://eap.bl.uk/archive-file/EAP1601-1-37). La BNP muestra portadas en Google Arts & Culture — [Google Arts & Culture](https://artsandculture.google.com/story/wwXRAlZPZLDVfw)
- Según la revista *Fénix* de la BNP, *Monos y Monadas*, *Variedades* y *Don Lunes* forman la etapa temprana de la historieta peruana — [Fénix, BNP](https://revistafenix.bnp.gob.pe/index.php/fenix/article/download/250/1707/292)

**Cuba.**
- No encontré un repositorio abierto con *Palante* o *Dedeté*. El proyecto académico "Cuban Comics in the Castro Era" (USC Scalar) muestra portadas y fichas — [USC Scalar](https://scalar.usc.edu/works/comics-in-the-castro-era/title-and-publications.57)

### Inferences
- En Memoria Chilena (PDF), la Udelar (PDF) y probablemente la HNDM (PDF de descarga) ya hay descarga directa, así que la extensión no hace falta.
- "Derechos reservados" en Memoria Chilena significa que se puede leer y bajar para uso personal, no redistribuir.
- Los objetos del Endangered Archives Programme de la British Library suelen verse en un visor de imágenes página por página. Sería un caso a adaptar, pero no lo verifiqué.

### Gaps
- No pude abrir ni verificar el formato de la HNDM, pepines.unam.mx, la Biblioteca Virtual del Banrep (CONTENTdm, según mi conocimiento, sin verificar), la Biblioteca Digital de la BNP, la BND de Chile ni la Biblioteca Nacional de Uruguay.
- No sé si *Trauko* (Chile) tiene PDF completos ni cuántos números hay. El dato de que en 2025 se sumaron originales de Vicar, Themo Lobos y Mario Igor al "Archivo de la Gráfica Chilena" salió de un resumen de búsqueda y no lo verifiqué en una página concreta.
- Venezuela (*Fantoches*), Ecuador, Bolivia, Paraguay, Centroamérica, Puerto Rico y República Dominicana: no investigados.
- Una fuente mencionó que la revista infantil cubana *Pulgarcito* (1919) se preservó con la Biblioteca Nacional José Martí, pero no pude confirmar dónde está ni si se puede leer en línea.

---

## 4. Fuentes multinacionales: Europeana, sucesores de la World Digital Library, Internet Archive, Wikimedia Commons, IAI de Berlín y otras

### Takeaway
**Europeana sirve como buscador** de lo que tienen BNE, ARCA, BVPH, UAB y Galiciana, pero redirige al sitio de cada proveedor para leer. **Internet Archive no sirve como fuente general:** la búsqueda por tema de historieta trae sobre todo subidas de cómics con derechos sin licencia visible, así que hay que verificar ítem por ítem. **Wikimedia Commons** tiene imágenes sueltas (portadas y caricaturas), no números completos. El **IAI de Berlín** y la **British Library (EAP)** tienen revistas latinoamericanas, con visores que no pude verificar.

### Cited Findings
- **Europeana** (`https://www.europeana.eu`), consulta del 21-11-2026: "historieta" da 4.968 resultados (BNE 4.108, Museo de Culturas Europeas de Berlín 196, Generalitat de Catalunya 64, MDC 51); "tebeo" da 513 (BNE 455, Museo Pedagógico de Aragón 34, UAB 9); "En Patufet" da 2.287 (ARCA 2.271); "Caras y Caretas" da 2.540 (BNE 2.231, BVPH 155, un repositorio universitario español 111, Galiciana 29). Cada registro enlaza al sitio del proveedor (`edmIsShownAt`). Muchos resultados de "historieta" en la BNE son partituras ("historieta fox-trot") — [API de Europeana](https://api.europeana.eu/record/v2/search.json?wskey=api2demo&query=historieta&rows=0&profile=facets&facet=DATA_PROVIDER)
- **Internet Archive:** la búsqueda `subject:(historieta OR historietas OR tebeo OR tebeos OR cómic) AND mediatype:texts` devuelve 40.915 ítems, y los primeros 40 son sobre todo subidas de cómics comerciales con derechos (por ejemplo, decenas de números de *Walt Disney's Comics and Stories* de 1945 a 2007) sin URL de licencia. Pocos tienen licencia CC — [IA advancedsearch](https://archive.org/advancedsearch.php?q=subject%3Ahistorieta+AND+mediatype%3Atexts&fl%5B%5D=identifier&rows=50&output=json) (verificado el 21-11-2026)
- **Wikimedia Commons** (API, 21-11-2026): `Category:Caras y Caretas (Argentina)` tiene 15 miembros, con subcategorías de portadas, caricaturas, avisos, fotos, obras de arte y dibujantes (José María Cao, Manuel Mayol); `Category:En Patufet` tiene 7 archivos; `Category:Comics of Spain` tiene 56 miembros (incluye "Comics magazines of Spain", "Comics of Catalonia" y "Webcomics from Spain"); `Category:Comics of Argentina` tiene 26 (personajes, el Paseo de la Historieta, El Eternauta, Mafalda); `Category:TBO (magazine)` no existe o está vacía — [Commons: Caras y Caretas](https://commons.wikimedia.org/wiki/Category:Caras_y_Caretas_(Argentina)); [Commons: Comics of Spain](https://commons.wikimedia.org/wiki/Category:Comics_of_Spain). Commons solo acepta archivos de dominio público o con licencia libre — [Commons: preguntas frecuentes](https://c.enwp.org/wiki/Commons:FAQ/es). Hay categorías de números de 1948 de revistas uruguayas — [Commons: Magazines of Uruguay, 1948](https://commons.wikimedia.org/wiki/Category:Magazines_of_Uruguay,_1948)
- **Ibero-Amerikanisches Institut (IAI, Berlín)**, colecciones digitales en `https://digital.iai.spk-berlin.de/viewer/`. Tiene un programa para adquirir y digitalizar revistas culturales latinoamericanas de fines del siglo XIX en adelante, incluidas revistas populares — [CRL](https://crl.edu/node/12551). El visor mostró un **desafío anti-bots Anubis** a curl el 21-11-2026 (no verificado más allá de eso)
- **British Library, Endangered Archives Programme:** EAP1601 (Perú, *Monos y Monadas*) y EAP1466 (Uruguay, Anáforas) — [EAP1601](https://eap.bl.uk/archive-file/EAP1601-1-37); [EAP1466](https://eap.bl.uk/node/4601)
- **Google Arts & Culture:** la BNP tiene historias sobre caricatura peruana (Málaga Grenet, *Monos y Monadas*, *Variedades*) y hay un asset de *TBO* — [Google A&C, caricatura peruana](https://artsandculture.google.com/story/CQVh1sAKCCY6iA); [Google A&C, TBO](https://artsandculture.google.com/asset/tbo/ZgGLn69yEpgI3A)
- **revistas-culturales.de:** portal de revistas culturales latinoamericanas digitalizadas, con páginas temáticas, por ejemplo de *Caras y Caretas* — [revistas-culturales.de](https://www.revistas-culturales.de/en/themen/caras-y-caretas)

### Inferences
- Google Arts & Culture muestra las imágenes como teselas de zoom profundo sin descarga. Según mi conocimiento del sitio, que no verifiqué hoy, entra en la categoría "protegido/teselas", así que conviene no apuntar ahí.
- En Internet Archive solo conviene recomendar ítems subidos por instituciones o con licencia explícita. La mayoría de las "historietas" en español de IA son subidas de usuarios sin permiso visible, y por las reglas del encargo no hay que listarlas.
- Europeana sirve para encontrar números con su URL exacta en BNE, ARCA o BVPH, o sea, como índice para descargas en lote, pero el contenido se lee en el sitio del proveedor.

### Gaps
- No investigué el sucesor de la World Digital Library (colección de la Library of Congress) ni la BDPI (Biblioteca Digital del Patrimonio Iberoamericano).
- No verifiqué el visor del IAI (es Goobi, a juzgar por la ruta `/viewer/`, pero no lo confirmé), ni si tiene números completos de *Caras y Caretas*, *PBT* o *Fray Mocho*.
- Del resto de HathiTrust no sé cuánto hay de revistas argentinas o españolas de humor con acceso completo.

---

## 5. Historietas contemporáneas en español compartidas libremente por autores o instituciones

### Takeaway
Hay poco material contemporáneo con licencia libre explícita. Lo más sólido: ***Historietas x la identidad*** (BNMM y Abuelas, PDF gratis), las historietas del **Ministerio de Cultura en educ.ar (CC BY-NC-SA)** y la traducción al español de ***Pepper&Carrot* (CC BY 4.0)**. Además, AHIRA, Memoria Chilena (*Trauko*) y la UAB (fanzines, InC-EDU) muestran cómic moderno con permiso, pero no con licencia libre.

### Cited Findings
- ***Historietas x la identidad*** (BNMM y Abuelas de Plaza de Mayo, 2015, 35 historias) se publicó como libro digital y se puede bajar gratis desde el 10-03-2016 en `abuelas.org.ar/archivos/publicacion/HistorietasIdentidad.pdf`. No verifiqué si el enlace sigue activo — [Atlante, Univ. de Lille](https://atlante.univ-lille.fr/data/images/atlante-10-2/239-262-c.-pouzol.pdf); [La Capital](https://www.lacapital.com.ar/educacion/un-libro-textos-y-vinetas-nietas-y-nietos-que-recuperaron-su-identidad-n10153149.html/amp). Abuelas aloja muchos PDF en `abuelas.org.ar/register/public/...`, con contenido sin verificar — [ejemplo](https://abuelas.org.ar/register/public/1683741640088-263825747.pdf)
- **educ.ar**: historietas sobre María Remedios del Valle (Ministerio de Cultura), **CC BY-NC-SA** — [educ.ar](https://www.educ.ar/recursos/157132/las-historietas-de-maria-remedios-del-valle). El recurso "Mafalda y sus amigos" figura con CC BY-NC-SA (Plan Nacional de Lecturas), pero parece ser una propuesta didáctica, no la historieta de Quino liberada — [educ.ar](https://www.educ.ar/recursos/154511/mafalda-y-sus-amigos)
- ***Pepper&Carrot*** (David Revoy, origen francés): todo bajo **CC BY 4.0**, con sitio en español; el autor aclaró que no puede restringir ni revocar obras ya publicadas con CC BY — [peppercarrot.com/es, filosofía](https://peppercarrot.com/es/philosophy/index.html); [PDF libre del libro 1](https://www.davidrevoy.com/article549/peppercarrot-free-pdf-of-book-one/show)
- **Fanzines de la UAB** (años 80 en adelante): con derechos, uso educativo permitido (InC-EDU), PDF directos — [ddd.uab.cat](https://ddd.uab.cat/record/267536)
- ***Trauko*** (Chile, underground): según la búsqueda, Memoria Chilena la publicó porque "Actualmente no existen archivos públicos sobre historieta reciente chilena". No abrí la página en concreto — [Memoria Chilena, Historieta en Chile](https://www.memoriachilena.gob.cl/temas/index.asp?id_ut=elcomicenchile)

### Inferences
- Para la extensión, *Pepper&Carrot* sería un caso de prueba legal ideal, porque un episodio es una página con viñetas en imágenes. **No verifiqué** la estructura del HTML: el índice en español no mostró enlaces a episodios en el HTML estático, así que podría cargarse por JS.

### Gaps
- No encontré colecciones de cómics gratuitos de organismos oficiales de España (ministerios, la UE en español), México (CONAFE, SEP), Chile (Mineduc) ni Colombia (Maguaré o el Ministerio de Cultura). No llegué a buscarlas.
- No encontré webcómics en español con licencia CC de autores hispanohablantes de forma sistemática; solo aparece la subcategoría "Webcomics from Spain" en Commons.
