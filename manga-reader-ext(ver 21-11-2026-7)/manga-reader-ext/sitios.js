/**
 * Manga Reader v2.8.4 — Sitios de manga y cómics
 * Lista de accesos directos que muestra el ícono de la extensión, más las funciones para
 * filtrarla y para validar los sitios que agrega el usuario. La usan popup.js y opciones.js.
 *
 * Solo plataformas legítimas donde los capítulos se leen en el mismo sitio, con el catálogo
 * completo y al día. No van tiendas, préstamos de biblioteca, archivos de números sueltos,
 * secciones de diarios ni sitios que dejaron de actualizarse o van a cerrar. Revisada el 21-11-2026.
 *
 * Campos de cada sitio:
 *   tipo     manga | manhwa | webtoon | comics | tiras | historieta | mixto
 *   idiomas  ['es', 'en']
 *   modelo   gratis | gratis con anuncios | freemium | suscripción
 *   guardar  funciona       la extensión guarda los capítulos (probado)
 *            permitido      dominio público o licencia libre
 *            descarga_oficial  el sitio da o vende el archivo (PDF, CBZ, EPUB) sin DRM
 *            no_permite     solo para leer: sus términos no dejan copiar o el contenido está protegido
 *            sin_verificar  condiciones no confirmadas
 */
(function () {
  const SITIOS = [
    // ── Manga, manhwa y webtoon ──
    {"nombre":"MANGA Plus","url":"https://mangaplus.shueisha.co.jp/","tipo":"manga","idiomas":["es","en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Capítulos nuevos de Shueisha gratis, en simultáneo con Japón, y suscripción MAX para el archivo. One Piece, Jujutsu Kaisen y más."},
    {"nombre":"MANGA MILLION","url":"https://mangamillion.shueisha.co.jp/","tipo":"manga","idiomas":["es","en"],"modelo":"gratis","guardar":"sin_verificar","descripcion":"Unos 400 manga de Shueisha (One Piece, Naruto, Bleach, Spy x Family) en más de 100 idiomas, español incluido. Gratis y sin registro hasta fines de 2027."},
    {"nombre":"VIZ / Shonen Jump","url":"https://www.viz.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Los últimos capítulos de Shonen Jump gratis y membresía para el archivo completo. También VIZ Manga, con títulos de Shogakukan."},
    {"nombre":"Manga UP!","url":"https://global.manga-up.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Manga de Square Enix con lecturas gratis diarias, monedas y suscripción VAULT PASS. Se lee en el navegador; las compras van por la app."},
    {"nombre":"MangaPlaza","url":"https://mangaplaza.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Más de 170.000 capítulos de manga japonés con lecturas gratis, compras y Premium. Recibe las compras de MANGA MIRAI."},
    {"nombre":"comici MANGA","url":"https://manga.comici.jp/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Revistas de varias editoriales japonesas (Comic Growl, Kimicomi y otras) en inglés. Disponible en Argentina, México y España."},
    {"nombre":"Coolmic","url":"https://coolmic.me/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Manga japonés con licencia en inglés, con varias exclusivas y scroll vertical. Capítulos gratis por espera, tickets y suscripción Unlimited. Tiene sección para adultos."},
    {"nombre":"Omoi (ex Azuki)","url":"https://www.omoi.com/","tipo":"manga","idiomas":["en"],"modelo":"freemium","guardar":"descarga_oficial","descripcion":"Manga con licencia: lectura gratis con anuncios y Premium mensual. Algunas series venden tomos en ePub sin DRM."},
    {"nombre":"WEBTOON en español","url":"https://www.webtoons.com/es/","tipo":"webtoon","idiomas":["es"],"modelo":"freemium","guardar":"no_permite","descripcion":"Edición en español de WEBTOON: series gratis con calendario diario, monedas para adelantar capítulos y CANVAS con autores indie."},
    {"nombre":"WEBTOON en inglés","url":"https://www.webtoons.com/en/","tipo":"webtoon","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"La plataforma de webtoons más grande: series Originals gratis, monedas para adelantar capítulos y CANVAS con autores independientes."},
    {"nombre":"Lezhin en español","url":"https://www.lezhin.es/","tipo":"manhwa","idiomas":["es"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Webtoons coreanos exclusivos en español, sobre todo romance y BL, con episodios nuevos cada día y pago por capítulo. Tiene sección para adultos."},
    {"nombre":"Manta","url":"https://manta.net/es","tipo":"manhwa","idiomas":["es","en"],"modelo":"suscripción","guardar":"sin_verificar","descripcion":"Suscripción mensual de RIDI para leer manhwa sin límite en español e inglés; también tiene secciones de manga y novelas."},
    {"nombre":"Tappytoon","url":"https://www.tappytoon.com/en","tipo":"manhwa","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Manhwa oficial en inglés con capítulos gratis por espera, puntos y membresía. Romance, fantasía y BL."},
    {"nombre":"Toomics","url":"https://toomics.com/esp","tipo":"manhwa","idiomas":["es","en"],"modelo":"suscripción","guardar":"no_permite","descripcion":"Webtoons coreanos con membresía VIP y monedas, en español, inglés y otros idiomas. Más de 50.000 episodios. Tiene sección para adultos."},
    // ── Manga y cómics ──
    {"nombre":"GlobalComix","url":"https://globalcomix.com/","tipo":"mixto","idiomas":["es","en"],"modelo":"freemium","guardar":"descarga_oficial","descripcion":"Cómics y manga de editoriales y autores, muchos gratis, con sección en español. Suscripción Gold para el resto; algunos lanzamientos se venden en PDF sin DRM."},
    {"nombre":"Comikey","url":"https://comikey.com/","tipo":"mixto","idiomas":["en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Manga y webtoons con licencia, con el primer capítulo gratis, pases diarios y lectura con anuncios. Catálogo en inglés y en portugués."},
    {"nombre":"MangaToon","url":"https://mangatoon.mobi/es","tipo":"mixto","idiomas":["es","en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Cómics y novelas en español, inglés y otros idiomas, con anuncios y monedas. Romance, fantasía, LGBT+ y más."},
    {"nombre":"WebComics","url":"https://www.webcomicsapp.com/","tipo":"mixto","idiomas":["en","es"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Manhwa, manga y manhua con lecturas gratis diarias y suscripción Premium, en inglés, español y otros idiomas."},
    // ── Cómics y tiras ──
    {"nombre":"Marvel Comics","url":"https://www.marvelcomicsapp.com/","tipo":"comics","idiomas":["en"],"modelo":"suscripción","guardar":"no_permite","descripcion":"Más de 35.000 cómics de Marvel con una suscripción y números nuevos cada semana. Reemplaza a Marvel Unlimited, que cierra el 7-12-2026. Lo opera WEBTOON."},
    {"nombre":"Panel Syndicate","url":"http://panelsyndicate.com/","tipo":"comics","idiomas":["es","en"],"modelo":"gratis","guardar":"descarga_oficial","descripcion":"Cómics de autor (Vaughan, Martín, Brubaker, Monteys) en PDF, CBR o CBZ sin DRM. Pagás lo que quieras, incluso 0. Muchos títulos en español."},
    {"nombre":"Pepper&Carrot","url":"https://www.peppercarrot.com/es/webcomics/peppercarrot.html","tipo":"comics","idiomas":["es","en"],"modelo":"gratis","guardar":"funciona","descripcion":"Webcómic de fantasía de David Revoy, completo en español y con licencia libre (CC BY 4.0). La extensión guarda cada episodio."},
    {"nombre":"GoComics","url":"https://www.gocomics.com/","tipo":"tiras","idiomas":["es","en"],"modelo":"freemium","guardar":"sin_verificar","descripcion":"Tiras de diario oficiales (Calvin and Hobbes, Garfield, Peanuts) y en español, como Gaturro. Gratis con anuncios lo reciente; el archivo completo es Premium."},
    {"nombre":"Comics Kingdom","url":"https://comicskingdom.com/","tipo":"tiras","idiomas":["es","en"],"modelo":"freemium","guardar":"no_permite","descripcion":"Tiras oficiales de King Features con sección en español (Popeye, Macanudo, Rex Morgan). Prueba gratis; el archivo de 100 años es por suscripción."},
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
    const descargable = s?.descargable === true;           // lo marca el usuario: decide en qué sección va
    return { ok: true, sitio: { nombre, url: u.href, tipo, idiomas, descripcion, descargable, guardar: 'propio', mio: true } };
  }

  // Descargable: el sitio da el archivo, la licencia permite copiarlo o la extensión lo guarda.
  // En los del usuario, lo que haya marcado él.
  function esDescargable(s) {
    return SE_GUARDA.has(s?.guardar) || (s?.guardar === 'propio' && s.descargable === true);
  }

  // La división de la lista: { descargables, leer } (cada parte conserva el orden recibido)
  function dividirSitios(lista) {
    return { descargables: lista.filter(esDescargable), leer: lista.filter(s => !esDescargable(s)) };
  }

  // Idiomas que aparecen en la lista, en el orden de IDIOMAS: para armar el filtro
  function idiomasDe(lista) {
    const hay = new Set(lista.flatMap(s => s.idiomas || []));
    return Object.keys(IDIOMAS).filter(i => hay.has(i));
  }

  // Lista completa: los del usuario primero (si repiten uno incluido, gana el del usuario) y
  // después los incluidos, cada grupo por nombre
  function juntarSitios(base, mios) {
    const propios = (mios || []).map(normalizarSitio).filter(r => r.ok).map(r => r.sitio);
    const usadas = new Set(propios.map(s => claveUrl(s.url)));
    const orden = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    return [...propios.sort(orden), ...base.filter(s => !usadas.has(claveUrl(s.url))).slice().sort(orden)];
  }

  // filtro: { tipo: 'todos' | 'manga' | 'comics', idioma: 'todos' | 'es' | 'en' | …, soloEs, soloGuardar, texto }
  // (soloEs y soloGuardar son los filtros de la 2.8: siguen andando)
  function filtrarSitios(lista, f = {}) {
    const q = String(f.texto || '').trim().toLowerCase();
    const idioma = f.idioma && f.idioma !== 'todos' ? f.idioma : f.soloEs ? 'es' : '';
    return lista.filter(s =>
      (f.tipo === 'manga' ? ES_MANGA.has(s.tipo) : f.tipo === 'comics' ? ES_COMICS.has(s.tipo) : true) &&
      (!idioma || (s.idiomas || []).includes(idioma)) &&
      (!f.soloGuardar || esDescargable(s)) &&
      (!q || `${s.nombre} ${s.descripcion} ${TIPOS[s.tipo] || ''} ${s.url}`.toLowerCase().includes(q)));
  }

  // "Manga · Gratis · Español e inglés"
  function resumenSitio(s) {
    const idiomas = (s.idiomas || []).map(i => IDIOMAS[i]).filter(Boolean);
    const lang = idiomas.length > 1 ? idiomas.slice(0, -1).join(', ') + ' e ' + idiomas[idiomas.length - 1].toLowerCase() : idiomas[0] || '';
    const modelo = s.modelo ? s.modelo[0].toUpperCase() + s.modelo.slice(1) : '';
    return [TIPOS[s.tipo] || 'Sitio', modelo, lang].filter(Boolean).join(' · ');
  }

  const api = { SITIOS, TIPOS, GUARDAR, IDIOMAS, SE_GUARDA, claveUrl, normalizarSitio, juntarSitios, filtrarSitios, resumenSitio,
                esDescargable, dividirSitios, idiomasDe };
  globalThis.MR_SITIOS = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
