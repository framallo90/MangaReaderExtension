/**
 * Manga Reader v2.8 — Sitios de manga y cómics
 * Lista de accesos directos que muestra el ícono de la extensión, más las funciones para
 * filtrarla y para validar los sitios que agrega el usuario. La usan popup.js y opciones.js.
 *
 * Solo sitios legítimos: plataformas oficiales, archivos de dominio público, obras con
 * licencia libre, bibliotecas y tiendas sin DRM. Revisada el 21-11-2026.
 *
 * Campos de cada sitio:
 *   tipo     manga | manhwa | webtoon | comics | tiras | historieta | mixto
 *   idiomas  ['es', 'en']
 *   modelo   gratis | gratis con anuncios | freemium | pago | suscripción | préstamo de biblioteca
 *   guardar  funciona       la extensión guarda los capítulos (probado)
 *            permitido      dominio público o licencia libre
 *            descarga_oficial  el sitio da o vende el archivo (PDF, CBZ, EPUB) sin DRM
 *            no_permite     solo para leer: sus términos no dejan copiar o el contenido está protegido
 *            sin_verificar  condiciones no confirmadas
 */
(function () {
  const SITIOS = [
    // ── Manga, manhwa y webtoon ──
    {"nombre":"Alpha Manga","url":"https://www.alpha-manga.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Isekai y fantasía de AlphaPolis en inglés: tres capítulos gratis, \"Wait & read\" y tickets. Tsukimichi, entre otros."},
    {"nombre":"BOOK☆WALKER","url":"https://bookwalker.com/","tipo":"manga","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"Tienda de KADOKAWA con más de 79.000 manga y novelas de varias editoriales y lecturas gratis. Las descargas usan DRM LCP."},
    {"nombre":"comici MANGA","url":"https://manga.comici.jp/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Revistas de varias editoriales japonesas (Comic Growl, Kimicomi y otras) en inglés. Disponible en Argentina, México y España."},
    {"nombre":"Coolmic","url":"https://coolmic.me/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Manga japonés con licencia en inglés, con varias exclusivas y scroll vertical. Capítulos gratis por espera, tickets y suscripción Unlimited. Tiene sección para adultos."},
    {"nombre":"eManga","url":"https://emanga.com/","tipo":"manga","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"Tienda de manga digital y en papel: Tezuka, Vampire Hunter D, BL y GL. Los tomos digitales se bajan en PDF, ePub y CBZ."},
    {"nombre":"Irodori Aqua","url":"https://aqua.irodoricomics.com/","tipo":"manga","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"Manga y doujinshi traducidos oficialmente, para todo público. Las compras se bajan en PDF de alta resolución (3200 px)."},
    {"nombre":"J-Novel Club","url":"https://j-novel.club/","tipo":"manga","idiomas":["en"],"modelo":"suscripción","guardar":"descarga_oficial","descripcion":"Manga y novelas ligeras por capítulos con membresía. Los ebooks comprados en el sitio se bajan en EPUB sin DRM."},
    {"nombre":"Lezhin en español","url":"https://www.lezhin.es/","tipo":"manhwa","idiomas":["es"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Webtoons coreanos exclusivos en español, sobre todo romance y BL, con episodios nuevos cada día y pago por capítulo. Tiene sección para adultos."},
    {"nombre":"Lezhin en inglés","url":"https://www.lezhinus.com/en","tipo":"manhwa","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Edición en inglés de Lezhin: manhwa de romance, BL, drama y fantasía con monedas y membresía VIP. Tiene sección para adultos."},
    {"nombre":"MANGA MILLION","url":"https://mangamillion.shueisha.co.jp/","tipo":"manga","idiomas":["es","en"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Unos 400 títulos de Shueisha en más de 100 idiomas, gratis y sin registro por tiempo limitado. Lanzado en agosto de 2026."},
    {"nombre":"MANGA Plus","url":"https://mangaplus.shueisha.co.jp/","tipo":"manga","idiomas":["es","en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Capítulos nuevos de Shueisha gratis, en simultáneo con Japón, y suscripción MAX para el archivo. One Piece, Jujutsu Kaisen y más."},
    {"nombre":"MANGA Plus Creators","url":"https://medibang.com/mpc/","tipo":"manga","idiomas":["en","es"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Manga de autores amateurs de todo el mundo, en inglés y español, con premios mensuales de los editores de Shueisha."},
    {"nombre":"Manga UP!","url":"https://global.manga-up.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Manga de Square Enix con lecturas gratis diarias, monedas y suscripción VAULT PASS. Se lee en el navegador; las compras van por la app."},
    {"nombre":"MangaPlaza","url":"https://mangaplaza.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Más de 170.000 capítulos de manga japonés con lecturas gratis, compras y Premium. Recibe las compras de MANGA MIRAI."},
    {"nombre":"Manta","url":"https://manta.net/es","tipo":"manhwa","idiomas":["es","en"],"modelo":"suscripción","guardar":"sin_verificar","descripcion":"Suscripción mensual de RIDI para leer manhwa sin límite en español e inglés; también tiene secciones de manga y novelas."},
    {"nombre":"Omoi (ex Azuki)","url":"https://www.omoi.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"descarga_oficial","descripcion":"Manga con licencia: lectura gratis con anuncios y Premium mensual. Algunas series venden tomos en ePub sin DRM."},
    {"nombre":"Planeta Cómic digital","url":"https://www.planetadelibros.com/seleccion-editorial/comic-digital/92","tipo":"manga","idiomas":["es"],"modelo":"pago","guardar":"sin_verificar","descripcion":"Manga en eBook de Planeta Cómic (España): Dragon Ball Super, Dragon Ball SD, Psycho Pass y otros. No indica formato ni DRM."},
    {"nombre":"Renta!","url":"https://www.ebookrenta.com/","tipo":"manga","idiomas":["en"],"modelo":"pago","guardar":"sin_verificar","descripcion":"Alquiler y compra de manga en inglés. Volviendo de un mantenimiento por incidente de seguridad: hoy solo deja leer lo ya comprado."},
    {"nombre":"Saturday AM","url":"https://www.saturday-am.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Editorial de manga global con más de 30 autores de todo el mundo, dueños de sus series. Revistas digitales y lector web Manga Hype."},
    {"nombre":"SuBLime (VIZ)","url":"https://www.sublimemanga.com/","tipo":"manga","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"Sello BL de VIZ Media. Vende tomos digitales en PDF y EPUB para bajar desde su propio sitio, además de un lector web."},
    {"nombre":"Tappytoon","url":"https://www.tappytoon.com/en","tipo":"manhwa","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Manhwa oficial en inglés con capítulos gratis por espera, puntos y membresía. Romance, fantasía y BL."},
    {"nombre":"Toomics","url":"https://toomics.com/esp","tipo":"manhwa","idiomas":["es","en"],"modelo":"suscripción","guardar":"no_permite","descripcion":"Webtoons coreanos con membresía VIP y monedas, en español, inglés y otros idiomas. Más de 50.000 episodios. Tiene sección para adultos."},
    {"nombre":"VIZ / Shonen Jump","url":"https://www.viz.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Los últimos capítulos de Shonen Jump gratis y membresía para el archivo completo. También VIZ Manga, con títulos de Shogakukan."},
    {"nombre":"WEBTOON en español","url":"https://www.webtoons.com/es/","tipo":"webtoon","idiomas":["es"],"modelo":"freemium","guardar":"no_permite","descripcion":"Edición en español de WEBTOON: series gratis con calendario diario, monedas para adelantar capítulos y CANVAS con autores indie."},
    {"nombre":"WEBTOON en inglés","url":"https://www.webtoons.com/en/","tipo":"webtoon","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"La plataforma de webtoons más grande: series Originals gratis, monedas para adelantar capítulos y CANVAS con autores independientes."},
    // ── Manga y cómics ──
    {"nombre":"Comics Plus","url":"https://comicsplusapp.com/","tipo":"mixto","idiomas":["es","en"],"modelo":"préstamo de biblioteca","guardar":"no_permite","descripcion":"Novelas gráficas y manga sin listas de espera a través de bibliotecas y escuelas adheridas: Dark Horse, Image, IDW, Kodansha. Tiene títulos en español."},
    {"nombre":"Comikey","url":"https://comikey.com/","tipo":"mixto","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Manga y webtoons con licencia, con el primer capítulo gratis, pases diarios y lectura con anuncios. Catálogo en inglés y en portugués."},
    {"nombre":"Fanatical","url":"https://www.fanatical.com/en/categories/manga","tipo":"mixto","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"Tienda de bundles que a veces vende manga sin DRM, como Attack on Titan o Vinland Saga de Kodansha. Hoy ofrece manga filipino."},
    {"nombre":"Faneo","url":"https://www.faneo.es/","tipo":"mixto","idiomas":["es"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Comunidad española de cómic y manga de autor, sin registro para leer. Cada autor elige licencia: Creative Commons, copyright o dominio público."},
    {"nombre":"GlobalComix","url":"https://globalcomix.com/","tipo":"mixto","idiomas":["es","en"],"modelo":"freemium","guardar":"descarga_oficial","descripcion":"Cómics y manga de editoriales y autores, muchos gratis, con sección en español. Suscripción Gold para el resto; algunos lanzamientos se venden en PDF sin DRM."},
    {"nombre":"hoopla","url":"https://www.hoopladigital.com/comic","tipo":"mixto","idiomas":["es","en"],"modelo":"préstamo de biblioteca","guardar":"no_permite","descripcion":"Cómics y manga gratis con carnet de una biblioteca adherida (sobre todo EE. UU.), con filtro de cómics en español."},
    {"nombre":"Humble Bundle","url":"https://www.humblebundle.com/books","tipo":"mixto","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"Paquetes temporales de cómics y manga a precio reducido, con descarga en PDF, ePub y a veces CBZ, sin DRM."},
    {"nombre":"INKR Comics","url":"https://comics.inkr.com/","tipo":"mixto","idiomas":["en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Manga, manhua, webtoons y cómics con monedas gratis semanales, alquiler y membresía. Hoy es parte de GlobalComix."},
    {"nombre":"Izneo","url":"https://www.izneo.com/","tipo":"mixto","idiomas":["en"],"modelo":"pago","guardar":"no_permite","descripcion":"Librería digital franco-belga de BD, comics y manga, con catálogo en inglés y suscripción. No vende archivos sin DRM."},
    {"nombre":"Kindle Cómics (ex Comixology)","url":"https://www.amazon.com/comics-manga/home","tipo":"mixto","idiomas":["en"],"modelo":"pago","guardar":"no_permite","descripcion":"La tienda de cómics de Kindle, que absorbió a Comixology. Comixology Originals incluidos con Prime, Comixology Unlimited o Kindle+. Con DRM."},
    {"nombre":"Libby (OverDrive)","url":"https://libbyapp.com/","tipo":"mixto","idiomas":["es","en"],"modelo":"préstamo de biblioteca","guardar":"no_permite","descripcion":"Préstamo de novelas gráficas y manga con carnet de biblioteca: DC, Marvel, Image, IDW y Panini México en español, según cada biblioteca."},
    {"nombre":"MangaToon","url":"https://mangatoon.mobi/es","tipo":"mixto","idiomas":["es","en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Cómics y novelas en español, inglés y otros idiomas, con anuncios y monedas. Romance, fantasía, LGBT+ y más."},
    {"nombre":"Neon Ichiban","url":"https://neonichiban.com/","tipo":"mixto","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"Tienda de cómics y manga digitales (DC, Marvel, Dark Horse, IDW, Kodansha) con sección gratis. Algunos títulos traen descarga en PDF."},
    {"nombre":"Sweet Shop","url":"https://sweetshop.app/","tipo":"mixto","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"Tienda y app de cómics (Image, IDW, Dark Horse, Fantagraphics, Kodansha y más). Las editoriales que lo habilitan dan copia en PDF sin DRM."},
    {"nombre":"Tapas","url":"https://tapas.io/","tipo":"mixto","idiomas":["es","en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Webcomics y novelas de autores occidentales y manhwa coreano, con sección «Léelo en español». Episodios gratis y otros con monedas o espera."},
    {"nombre":"WebComics","url":"https://www.webcomicsapp.com/","tipo":"mixto","idiomas":["en","es"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Manhwa, manga y manhua con lecturas gratis diarias y suscripción Premium, en inglés, español y otros idiomas."},
    // ── Cómics, tiras e historieta ──
    {"nombre":"2000 AD","url":"https://2000ad.com/","tipo":"comics","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"La revista británica de Judge Dredd y su fondo editorial. Todo lo comprado se baja en PDF y CBZ desde la tienda web, sin límite de descargas."},
    {"nombre":"AHIRA (revistas argentinas)","url":"https://ahira.com.ar/revistas/","tipo":"historieta","idiomas":["es"],"modelo":"gratis","guardar":"descarga_oficial","descripcion":"Historieta argentina clásica en PDF: Patoruzú, Fierro, Skorpio, Hora Cero, Anteojito, Satiricón y más de 20 revistas de humor e historieta."},
    {"nombre":"ArcaMax Comics","url":"https://www.arcamax.com/comics","tipo":"tiras","idiomas":["en"],"modelo":"gratis con anuncios","guardar":"sin_verificar","descripcion":"Unas 90 tiras de diario (Peanuts, Garfield, Doonesbury, Zits) y unos 70 humoristas editoriales, actualizados a diario."},
    {"nombre":"Barnacle Press","url":"https://www.barnaclepress.com/","tipo":"tiras","idiomas":["en"],"modelo":"gratis","guardar":"permitido","descripcion":"Archivo de tiras de diario antiguas de dominio público, ordenadas por tira y fecha. No se actualiza desde 2021."},
    {"nombre":"Biblioteca Pública Digital de Chile","url":"https://www.bpdigital.cl/","tipo":"comics","idiomas":["es"],"modelo":"préstamo de biblioteca","guardar":"no_permite","descripcion":"Préstamo digital gratuito del Sistema Nacional de Bibliotecas Públicas de Chile, con novelas gráficas y cómics chilenos, por 14 días."},
    {"nombre":"Biblioteca Virtual de Prensa Histórica","url":"https://prensahistorica.mcu.es/","tipo":"historieta","idiomas":["es"],"modelo":"gratis","guardar":"permitido","descripcion":"Prensa histórica del Ministerio de Cultura de España, con semanarios humorísticos como El Mundo Cómico y El Clown, bajo licencia CC BY 4.0."},
    {"nombre":"BibloRed: cómic colombiano","url":"https://www.bibliotecadigitaldebogota.gov.co/sets/2252/","tipo":"comics","idiomas":["es"],"modelo":"préstamo de biblioteca","guardar":"sin_verificar","descripcion":"Colección de BibloRed con 65 historietas, novelas gráficas y webcómics colombianos. Para acceder a todo hay que afiliarse gratis a BibloRed."},
    {"nombre":"Cat and Girl","url":"https://catandgirl.com/","tipo":"tiras","idiomas":["en"],"modelo":"gratis","guardar":"permitido","descripcion":"Tira de humor filosófico de Dorothy Gambrell, nueva cada martes, con licencia CC BY-NC-SA 2.5."},
    {"nombre":"Clarín: Humor","url":"https://www.clarin.com/humor","tipo":"tiras","idiomas":["es"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Tiras y chistes diarios del diario argentino: Altuna, Sendra, Tabaré, Erlich, El Niño Rodríguez, Maitena, Crist, Decur, Fidel y más."},
    {"nombre":"Comic Book Plus","url":"https://comicbookplus.com/","tipo":"comics","idiomas":["en"],"modelo":"gratis","guardar":"descarga_oficial","descripcion":"Decenas de miles de cómics, revistas y pulps de dominio público de la Golden y Silver Age. Se leen sin cuenta; para bajar hace falta registrarse gratis."},
    {"nombre":"Comic Strip Library","url":"https://comicstriplibrary.org/","tipo":"tiras","idiomas":["en"],"modelo":"gratis","guardar":"permitido","descripcion":"Biblioteca catalogada de tiras de diario de dominio público anteriores a 1923."},
    {"nombre":"Cómics de la Unión Europea","url":"https://learning-corner.learning.europa.eu/learning-materials_es","tipo":"comics","idiomas":["es","en"],"modelo":"gratis","guardar":"descarga_oficial","descripcion":"Material didáctico oficial de la UE con cómics en PDF en todas sus lenguas, español incluido (filtrar por tipo «Cómic»)."},
    {"nombre":"Comics Kingdom","url":"https://comicskingdom.com/","tipo":"tiras","idiomas":["es","en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Tiras oficiales de King Features con sección en español (Popeye, Macanudo, Rex Morgan). Prueba gratis; el archivo de 100 años es por suscripción."},
    {"nombre":"Condorito","url":"https://www.condorito.cl/descargas","tipo":"historieta","idiomas":["es"],"modelo":"gratis","guardar":"descarga_oficial","descripcion":"Sitio oficial del personaje de Pepo, con descarga gratuita en PDF de la edición facsimilar del primer libro de Condorito (1955)."},
    {"nombre":"Cyanide & Happiness","url":"https://explosm.net/","tipo":"tiras","idiomas":["en"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Sitio oficial de la tira de humor negro de Explosm, con una tira nueva por día y todo el archivo."},
    {"nombre":"DC Universe Infinite","url":"https://www.dcuniverseinfinite.com/","tipo":"comics","idiomas":["en"],"modelo":"suscripción","guardar":"no_permite","descripcion":"Servicio oficial de DC con miles de cómics de DC, Vertigo y Black Label. Lectura sin conexión solo dentro de la app."},
    {"nombre":"Digital Comic Museum","url":"https://digitalcomicmuseum.com/","tipo":"comics","idiomas":["en"],"modelo":"gratis","guardar":"descarga_oficial","descripcion":"Archivo de cómics de la Golden Age revisados como de dominio público, con descarga en CBR/CBZ para usuarios registrados (cuenta gratuita)."},
    {"nombre":"Dosis Diarias (Alberto Montt)","url":"http://www.dosisdiarias.com/","tipo":"tiras","idiomas":["es"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Blog oficial del humorista chileno Alberto Montt, con archivo de viñetas de 2006 a 2019. No se actualiza desde 2019."},
    {"nombre":"DriveThruComics","url":"https://www.drivethrucomics.com/","tipo":"comics","idiomas":["en"],"modelo":"pago","guardar":"descarga_oficial","descripcion":"Tienda de cómics digitales en PDF sin DRM (algunos con marca de agua) de editoriales chicas y medianas, además de títulos gratuitos."},
    {"nombre":"educ.ar: historietas","url":"https://www.educ.ar/buscador?q=historieta","tipo":"comics","idiomas":["es"],"modelo":"gratis","guardar":"permitido","descripcion":"Historietas educativas del portal oficial argentino, como Valencia y las de María Remedios del Valle, con licencia CC BY-NC-SA."},
    {"nombre":"El Jueves","url":"https://tienda.rba.es/revistas/el-jueves","tipo":"historieta","idiomas":["es"],"modelo":"suscripción","guardar":"no_permite","descripcion":"La revista satírica española. Con la suscripción se lee en la web y en la app (PDF dentro de la app); eljueves.es hoy redirige a esta tienda."},
    {"nombre":"El País: Las Viñetas","url":"https://elpais.com/opinion/vinetas/","tipo":"tiras","idiomas":["es"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Viñetas diarias de El Roto, Peridis, Flavita Banana, Riki Blanco, Sciammarella y Daniella Martí. Archivo de Forges en el mismo diario."},
    {"nombre":"El Vosque","url":"https://elvosque.es/","tipo":"tiras","idiomas":["es"],"modelo":"gratis","guardar":"permitido","descripcion":"Webcomic español de humor, fantasía y asesinatos, con licencia CC BY-NC-SA 3.0. Está en pausa, pero el archivo completo sigue en línea."},
    {"nombre":"elDiario.es: Viñetas","url":"https://www.eldiario.es/opinion/vinetas/","tipo":"tiras","idiomas":["es"],"modelo":"gratis con anuncios","guardar":"sin_verificar","descripcion":"Viñetas de humor político de Manel Fontdevila, Bernardo Vergara y otros autores en el diario español."},
    {"nombre":"Fanzines de la UAB","url":"https://ddd.uab.cat/collection/fanzines","tipo":"historieta","idiomas":["es"],"modelo":"gratis","guardar":"descarga_oficial","descripcion":"Fanzines de historieta españoles de los 80 en adelante (El Sub.Tebeo, Camello, Tintachina) en PDF, en el repositorio de la Universidad Autónoma de Barcelona."},
    {"nombre":"Gaturro (GoComics)","url":"https://www.gocomics.com/gaturro","tipo":"tiras","idiomas":["es"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"La tira diaria de Gaturro, de Nik, publicada oficialmente en GoComics y actualizada todos los días."},
    {"nombre":"GoComics","url":"https://www.gocomics.com/","tipo":"tiras","idiomas":["es","en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Tiras de diario oficiales (Calvin and Hobbes, Garfield, Peanuts) y algunas en español. Gratis con anuncios lo reciente; el archivo completo es Premium."},
    {"nombre":"Hemeroteca Digital BNE","url":"https://hemerotecadigital.bne.es/","tipo":"historieta","idiomas":["es"],"modelo":"gratis","guardar":"permitido","descripcion":"Prensa histórica española de dominio público con revistas satíricas y de humor gráfico (Madrid Cómico, Gedeón, Buen Humor) y Caras y Caretas."},
    {"nombre":"Historietas Reales","url":"https://historietasreales.wordpress.com/","tipo":"comics","idiomas":["es"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Blog colectivo de historietistas argentinos (2005-2021) con historietas autobiográficas y series por entregas. Algunas tienen PDF gratis de sus autores."},
    {"nombre":"Hiveworks Comics","url":"https://www.hiveworkscomics.com/","tipo":"comics","idiomas":["en"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Editorial de webcomics independientes (Girl Genius, Dumbing of Age, Sleepless Domain), todos gratis con páginas nuevas cada día."},
    {"nombre":"Internet Archive: cómics","url":"https://archive.org/details/comics","tipo":"comics","idiomas":["en"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Más de 100.000 ítems de cómics escaneados. Usar solo los que sean de dominio público o tengan licencia libre: la licencia la declara quien sube cada ítem."},
    {"nombre":"itch.io: cómics","url":"https://itch.io/comics","tipo":"comics","idiomas":["en"],"modelo":"freemium","guardar":"descarga_oficial","descripcion":"Miles de cómics, fanzines y webcomics independientes vendidos por sus autores, muchos gratis o a voluntad y con descarga en PDF/CBZ."},
    {"nombre":"La Jornada: Cartones","url":"https://www.jornada.com.mx/cartones","tipo":"tiras","idiomas":["es"],"modelo":"gratis con anuncios","guardar":"sin_verificar","descripcion":"Cartones políticos diarios de los moneros del diario mexicano La Jornada, como El Fisgón."},
    {"nombre":"Macanudo en español (Comics Kingdom)","url":"https://comicskingdom.com/macanudo-spanish","tipo":"tiras","idiomas":["es"],"modelo":"freemium","guardar":"no_permite","descripcion":"Macanudo, la tira de Liniers, en su versión oficial en español distribuida por King Features. También está en inglés."},
    {"nombre":"Marvel Comics (con WEBTOON)","url":"https://marvel.webtoon.com/","tipo":"comics","idiomas":["en"],"modelo":"suscripción","guardar":"no_permite","descripcion":"Servicio que reemplaza a Marvel Unlimited desde el 16-11-2026: más de 35.000 cómics de Marvel. Opera WEBTOON; con bloqueo por región."},
    {"nombre":"Memoria Chilena: historieta","url":"https://www.memoriachilena.gob.cl/602/w3-article-595.html","tipo":"historieta","idiomas":["es"],"modelo":"gratis","guardar":"descarga_oficial","descripcion":"Minisitio de la Biblioteca Nacional de Chile sobre El Peneca, Mampato, Chicos i grandes y Trauko, con muchos números para leer y bajar en PDF."},
    {"nombre":"Página/12: Humor","url":"https://www.pagina12.com.ar/humor/","tipo":"tiras","idiomas":["es"],"modelo":"gratis con anuncios","guardar":"sin_verificar","descripcion":"Sección de humor gráfico del diario argentino, con las viñetas de Rudy y otros humoristas."},
    {"nombre":"Panel Syndicate","url":"http://panelsyndicate.com/","tipo":"comics","idiomas":["es","en"],"modelo":"gratis","guardar":"descarga_oficial","descripcion":"Cómics de autor (Vaughan, Martín, Brubaker, Monteys) en PDF, CBR o CBZ sin DRM. Pagás lo que quieras, incluso 0. Muchos títulos en español."},
    {"nombre":"Pepper&Carrot","url":"https://www.peppercarrot.com/es/webcomics/peppercarrot.html","tipo":"comics","idiomas":["es","en"],"modelo":"gratis","guardar":"funciona","descripcion":"Webcómic de fantasía de David Revoy, completo en español y con licencia libre (CC BY 4.0). La extensión guarda cada episodio."},
    {"nombre":"Sandra and Woo","url":"https://www.sandraandwoo.com/","tipo":"tiras","idiomas":["en"],"modelo":"gratis","guardar":"permitido","descripcion":"Webcomic de humor sobre una nena y su mapache, con licencia CC BY-NC-ND 3.0. En el mismo sitio está Gaia, con la misma licencia."},
    {"nombre":"TusComics","url":"https://tuscomics.com/","tipo":"comics","idiomas":["es"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Portal en beta de webcómics y cómic independiente en español, gratis para leer. Los autores conservan sus derechos."},
    {"nombre":"xkcd","url":"https://xkcd.com/","tipo":"tiras","idiomas":["en"],"modelo":"gratis","guardar":"permitido","descripcion":"Tiras de humor sobre ciencia y tecnología de Randall Munroe, con licencia CC BY-NC 2.5 que permite copiar sin fines comerciales."},
    {"nombre":"xkcd en español","url":"https://es.xkcd.com/","tipo":"tiras","idiomas":["es"],"modelo":"gratis","guardar":"permitido","descripcion":"Traducción no oficial de tiras de xkcd, enlazada desde el sitio original, con la misma licencia CC BY-NC 2.5. Se actualiza de forma esporádica."},
    {"nombre":"Zestworld","url":"https://www.zestworld.com/","tipo":"comics","idiomas":["en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Plataforma de cómics de autor (Joëlle Jones, Jim Mahfood, Eric Canete) con suscripciones por creador. Sigue en línea, pero con poca actividad."},
  ];

  const TIPOS = {
    manga: 'Manga', manhwa: 'Manhwa', webtoon: 'Webtoon', comics: 'Cómics',
    tiras: 'Tiras', historieta: 'Historieta', mixto: 'Manga y cómics',
  };
  const ES_MANGA = new Set(['manga', 'manhwa', 'webtoon', 'mixto']);
  const ES_COMICS = new Set(['comics', 'tiras', 'historieta', 'mixto']);

  const GUARDAR = {
    funciona: { icono: '✅', texto: 'Se guarda con la extensión' },
    permitido: { icono: '🟢', texto: 'Permite copias: dominio público o licencia libre' },
    descarga_oficial: { icono: '📥', texto: 'El sitio da su propia descarga (PDF, CBZ o EPUB)' },
    no_permite: { icono: '👁', texto: 'Solo para leer: no permite guardar' },
    sin_verificar: { icono: '❔', texto: 'Condiciones sin verificar' },
    propio: { icono: '⭐', texto: 'Agregado por vos' },
  };
  const SE_GUARDA = new Set(['funciona', 'permitido', 'descarga_oficial']);
  const IDIOMAS = { es: 'Español', en: 'Inglés' };

  // Dirección para comparar dos sitios: sin "www.", sin barra final y sin el #
  function claveUrl(u) {
    try {
      const x = new URL(u);
      return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase();
    } catch { return String(u || '').toLowerCase(); }
  }

  // Valida un sitio que agrega el usuario. Devuelve { ok, sitio } o { ok: false, error }
  function normalizarSitio(s) {
    const nombre = String(s?.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    let url = String(s?.url || '').trim();
    if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;      // "sitio.com" → "https://sitio.com"
    let u;
    try { u = new URL(url); } catch { return { ok: false, error: 'La dirección no es válida' }; }
    if (!/^https?:$/.test(u.protocol)) return { ok: false, error: 'La dirección tiene que empezar con http:// o https://' };
    if (!nombre) return { ok: false, error: 'Falta el nombre' };
    const tipo = TIPOS[s?.tipo] ? s.tipo : 'mixto';
    const idiomas = Array.isArray(s?.idiomas) ? s.idiomas.filter(i => IDIOMAS[i]) : [];
    const descripcion = String(s?.descripcion || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    return { ok: true, sitio: { nombre, url: u.href, tipo, idiomas, descripcion, guardar: 'propio', mio: true } };
  }

  // Lista completa: los del usuario primero (si repiten uno incluido, gana el del usuario) y
  // después los incluidos, cada grupo por nombre
  function juntarSitios(base, mios) {
    const propios = (mios || []).map(normalizarSitio).filter(r => r.ok).map(r => r.sitio);
    const usadas = new Set(propios.map(s => claveUrl(s.url)));
    const orden = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    return [...propios.sort(orden), ...base.filter(s => !usadas.has(claveUrl(s.url))).slice().sort(orden)];
  }

  // filtro: { tipo: 'todos' | 'manga' | 'comics', soloEs, soloGuardar, texto }
  function filtrarSitios(lista, f = {}) {
    const q = String(f.texto || '').trim().toLowerCase();
    return lista.filter(s =>
      (f.tipo === 'manga' ? ES_MANGA.has(s.tipo) : f.tipo === 'comics' ? ES_COMICS.has(s.tipo) : true) &&
      (!f.soloEs || s.idiomas.includes('es')) &&
      (!f.soloGuardar || SE_GUARDA.has(s.guardar)) &&
      (!q || `${s.nombre} ${s.descripcion} ${TIPOS[s.tipo] || ''} ${s.url}`.toLowerCase().includes(q)));
  }

  // "Manga · Gratis · Español e inglés"
  function resumenSitio(s) {
    const idiomas = (s.idiomas || []).map(i => IDIOMAS[i]).filter(Boolean);
    const lang = idiomas.length > 1 ? idiomas.slice(0, -1).join(', ') + ' e ' + idiomas[idiomas.length - 1].toLowerCase() : idiomas[0] || '';
    const modelo = s.modelo ? s.modelo[0].toUpperCase() + s.modelo.slice(1) : '';
    return [TIPOS[s.tipo] || 'Sitio', modelo, lang].filter(Boolean).join(' · ');
  }

  const api = { SITIOS, TIPOS, GUARDAR, IDIOMAS, SE_GUARDA, claveUrl, normalizarSitio, juntarSitios, filtrarSitios, resumenSitio };
  globalThis.MR_SITIOS = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
