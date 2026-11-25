// Páginas dibujadas de fondo (content.js, desde la 2.11.3), sobre una página simulada: las
// direcciones de un background-image (url, image-set, degradés), de dónde salen (estilo
// calculado, ::before y ::after, reglas, <image> de SVG), el bloque que junta las páginas, y
// que la detección por <img> siga igual cuando no hay un lector de fondo.
// Uso: node tests/test_fondos.js "<carpeta de la versión>/manga-reader-ext"
// Contra una versión anterior a la 2.11.3 corre igual: así se ve qué hacía antes.
const fs = require('fs'), vm = require('vm'), path = require('path');
const { grab, line, probador } = require('./extraer');
const dir = path.resolve(process.argv[2]);
const src = fs.readFileSync(path.join(dir, 'content.js'), 'utf8');
const { eq, fin } = probador();
const SVG = 'http://www.w3.org/2000/svg';
const tiene = (re) => re.test(src);

// ── Una página simulada ──
// Un nodo: n(tag, { attrs, bg: { '': valor, '::before': valor }, img: { w, h, src }, caja: [w, h], ns, doc }, hijos)
const n = (tag, o = {}, hijos = []) => ({ tag, ...o, hijos });

// Un selector simple (tag, #id, .clase, tag.clase, [atributo]); varios separados por coma
function coincide(e, sel) {
  return sel.split(',').map(s => s.trim()).filter(Boolean).some(s => {
    const m = s.match(/^([a-z0-9-]*|\*)((?:[#.][\w-]+)*)((?:\[[\w-]+\])*)$/i);
    if (!m) throw new SyntaxError('selector que la página simulada no entiende: ' + s);
    if (m[1] && m[1] !== '*' && m[1].toLowerCase() !== e.localName) return false;
    for (const p of (m[2].match(/[#.][\w-]+/g) || [])) {
      if (p[0] === '#' && e.getAttribute('id') !== p.slice(1)) return false;
      if (p[0] === '.' && !String(e.getAttribute('class') || '').split(/\s+/).includes(p.slice(1))) return false;
    }
    for (const a of (m[3].match(/\[[\w-]+\]/g) || [])) if (e.getAttribute(a.slice(1, -1)) == null) return false;
    return true;
  });
}

// Arma el documento: { doc, todos } con los métodos que usan las funciones de content.js
// marco: es un iframe (window.self !== window.top) · medias: las consultas de @media que se cumplen ·
// vista: el tamaño de la ventana (la del marco, si es un iframe)
function documento(arbol, { url = 'https://sitio.com/leer/1', hojas = [], marco = false, medias = [], vista = [1280, 900] } = {}) {
  const todos = [];
  const doc = { baseURI: url, URL: url, styleSheets: hojas };
  const hacer = (nd, padre) => {
    const attrs = nd.attrs || {};
    const e = {
      nodeType: 1, localName: nd.tag, tagName: nd.tag.toUpperCase(), namespaceURI: nd.ns || 'http://www.w3.org/1999/xhtml',
      parentElement: padre, children: [], dataset: {}, _n: nd,
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      getBoundingClientRect: () => ({ width: (nd.caja || [0, 0])[0], height: (nd.caja || [0, 0])[1] }),
      contains(x) { for (let p = x; p; p = p.parentElement) if (p === e) return true; return false; },
      closest(sel) { for (let p = e; p; p = p.parentElement) { try { if (coincide(p, sel)) return p; } catch { return null; } } return null; },
      matches(sel) { return coincide(e, sel); },
      querySelectorAll(sel) { return todos.filter(x => x !== e && e.contains(x) && (sel === '*' || coincide(x, sel))); },
      querySelector(sel) { return e.querySelectorAll(sel)[0] || null; },
    };
    if (nd.tag === 'img') {
      const i = nd.img || {};
      Object.assign(e, { src: new URL(i.src, url).href, currentSrc: new URL(i.src, url).href, complete: i.complete !== false, naturalWidth: i.w || 0, naturalHeight: i.h || 0 });
      if (i.dataSrc) e.dataset = { src: i.dataSrc };        // carga diferida: la página real está en data-src
    }
    if (nd.tag === 'a') e.href = new URL(attrs.href, url).href;
    if (nd.doc) e.contentDocument = nd.doc;            // un iframe del mismo sitio
    todos.push(e);
    for (const h of nd.hijos || []) e.children.push(hacer(h, e));
    return e;
  };
  const raiz = hacer(arbol, null);
  Object.assign(doc, {
    nodeType: 9, documentElement: raiz,
    defaultView: { getComputedStyle: (e, pseudo) => ({ backgroundImage: ((e._n.bg || {})[pseudo || ''] || 'none') }),
                   matchMedia: (q) => ({ matches: medias.includes(q) }), self: marco ? { marco: 1 } : undefined, top: marco ? { arriba: 1 } : undefined, innerWidth: vista[0], innerHeight: vista[1] },
    querySelectorAll: (sel) => (sel === '*' ? todos.slice() : todos.filter(x => coincide(x, sel))),
    querySelector: (sel) => todos.find(x => coincide(x, sel)) || null,
  });
  Object.defineProperty(doc, 'images', { get: () => todos.filter(x => x.localName === 'img') });
  return { doc, todos };
}

// Carga las funciones de detección de content.js sobre ese documento. `medidas`: lo que devuelve
// probeSize por dirección (null = no carga); el resto carga con 800×1200.
// `adaptador`: { fondos, contenedor } para simular uno de opciones.
function cargar(d, { medidas = {}, adaptador = null } = {}) {
  const u = new URL(d.doc.baseURI);
  const ctx = { URL, console, document: d.doc, window: d.doc.defaultView,
    location: { href: u.href, origin: u.origin, hostname: u.hostname, pathname: u.pathname } };
  ctx.probeSize = async (url) => (url in medidas ? medidas[url] : { w: 800, h: 1200 });
  if (adaptador) {
    ctx.adaptadorAca = () => adaptador;
    // con un contenedor el adaptador señala las <img> de adentro (como imagenesConAdaptador)
    ctx.hayAdaptador = () => !!adaptador.contenedor;
    ctx.imagenesDeLaPagina = () => (adaptador.contenedor ? d.doc.querySelectorAll(adaptador.contenedor).flatMap(c => c.querySelectorAll('img')) : d.doc.querySelectorAll('img'));
  }
  vm.createContext(ctx);
  const LIN = [/const OURS = /, /const MIN_SIDE = /, /const PROBE_CONCURRENCY = /, /const noSlash = /];
  const LIN_NUEVAS = [/const SVG_NS = /, /let fondosRecientes = /, /const unaPorPagina = /, /const sinRellenos = /];
  const FN = [/function absUrl\(/, /function srcsetBest\(/, /function lazyUrl\(/, /function imgUrl\(/, /function urlDir\(/,
    /async function collectPages\(/, /function flagNonPages\(/, /function countCandidates\(/, /function looksLikeChapter\(/];
  const FN_NUEVAS = [/function direccionDeFondo\(/, /function urlsDeFondo\(/, /function fondosDe\(/, /function contenedorDeFondos\(/,
    /function fondosDelContenedor\(/, /async function paginasDeFondo\(/, /function lectorDeFondoEnMarcos\(/, /async function elegirFondo\(/, /function cuentaDeFondo\(/,
    /function destinoDeTapa\(/, /function esGrillaDeTapas\(/, /function serieDeFondo\(/, /function fondosDelAdaptador\(/, /function marcoHijo\(/,
    /function linkDeTarjeta\(/, /function linkQueNoEsPagina\(/, /function marcoGrande\(/, /function fondoValeAca\(/, /function hayMarcoGrande\(/,
    /function paginasQueCuenta\(/];
  vm.runInContext([...LIN.map(re => line(src, re)), ...LIN_NUEVAS.filter(tiene).map(re => line(src, re)),
    ...FN.map(re => grab(src, re)), ...FN_NUEVAS.filter(tiene).map(re => grab(src, re))].join('\n'), ctx);
  return ctx;
}
const paginas = (r) => r.pages.filter(p => !p.flag).map(p => p.url.replace(/^https:\/\/[^/]+/, '').slice(0, 60));

// ── Las páginas que se usan en las pruebas ──
// 8 páginas numeradas de fondo en #lector, 18 tapas de otras obras alrededor (cada una en su
// carpeta, como en Issuu), un logo de fondo en el encabezado y un pie con un degradé y otro logo
const tapa = (k) => n('a', { attrs: { href: `/obra/${k}` } }, [n('img', { img: { src: `https://img.sitio.com/tapas/obra-${k}/portada.jpg`, w: 331, h: 480 } })]);
// (la misma tapa como tarjeta con la imagen de fondo, como la dibujan muchos sitios)
const tapaDeFondo = (k) => n('a', { attrs: { href: `/obra/${k}` } }, [n('div', { attrs: { class: 'tapa' }, bg: { '': `url("https://img.sitio.com/tapas/obra-${k}/portada.jpg")` } })]);
const ocho = (hacer = tapa) => documento(n('html', {}, [n('body', { bg: { '': 'url("https://sitio.com/fondo-de-la-pagina.jpg")' } }, [
  n('header', {}, [n('div', { attrs: { class: 'logo' }, bg: { '': 'url("https://sitio.com/img/logo.png")' } }),
                   n('div', { attrs: { class: 'franja' }, bg: { '': 'linear-gradient(110deg, rgba(0, 0, 0, 0) 20%, rgb(255, 255, 255) 30%)' } })]),
  n('div', { attrs: { class: 'arriba' } }, Array.from({ length: 9 }, (_, i) => hacer(i + 1))),
  n('main', {}, [n('div', { attrs: { id: 'lector' } }, Array.from({ length: 8 }, (_, i) =>
    n('div', { attrs: { class: 'pagina' }, bg: { '': `url("https://cdn.sitio.com/cap/7/${String(i + 1).padStart(2, '0')}.png"), linear-gradient(rgb(0, 0, 0), rgb(9, 9, 9))` } })))]),
  n('div', { attrs: { class: 'abajo' } }, Array.from({ length: 9 }, (_, i) => hacer(i + 10))),
  n('footer', {}, [n('div', { bg: { '': 'linear-gradient(red, blue), url("https://sitio.com/img/pie.png")' } })]),
])]));

(async () => {
  // ── Las direcciones de un background-image ──
  {
    const ctx = cargar(documento(n('html')));
    if (typeof ctx.urlsDeFondo === 'function') {
      const u = (v, base) => ctx.urlsDeFondo(v, base).join(' | ');
      eq('url() con y sin comillas, y varias capas: cada dirección, y los degradés no', u('url("https://a.com/1.jpg"), linear-gradient(red, blue), url(https://a.com/2.jpg), url(\'https://a.com/3.jpg\')'),
        'https://a.com/1.jpg | https://a.com/2.jpg | https://a.com/3.jpg');
      eq('  none, solo degradés, y una coma o un paréntesis adentro de la dirección', `${u('none') || '(nada)'} · ${u('radial-gradient(circle, red, blue), repeating-linear-gradient(red 10%, blue 20%)') || '(nada)'} · ${u('url("https://a.com/a,b(1).jpg")')}`,
        '(nada) · (nada) · https://a.com/a,b(1).jpg');
      eq('image-set(): la de mayor resolución (x, dppx, dpi), con url() o con texto, y -webkit-image-set()',
        [u('image-set(url("https://a.com/p@1x.jpg") 1x, url("https://a.com/p@2x.jpg") 2x)'), u('image-set("https://a.com/q@2x.jpg" 2dppx, "https://a.com/q@1x.jpg" 1dppx)'),
         u('-webkit-image-set(url(https://a.com/r-96.jpg) 96dpi, url(https://a.com/r-288.jpg) 288dpi)'), u('image-set(url("https://a.com/s.avif") type("image/avif") 2x, url("https://a.com/s.jpg") 1x)')].join(' · '),
        'https://a.com/p@2x.jpg · https://a.com/q@2x.jpg · https://a.com/r-288.jpg · https://a.com/s.avif');
      eq('  relativas: contra la dirección que se le da (la de la hoja de estilo, en las reglas); data: y blob: quedan como están',
        `${u('url(../img/5.jpg)', 'https://sitio.com/css/lector.css')} · ${u('url("data:image/png;base64,AAAA")')} · ${u('url(blob:https://sitio.com/1234)')}`,
        'https://sitio.com/img/5.jpg · data:image/png;base64,AAAA · blob:https://sitio.com/1234');
    } else eq('las direcciones de un background-image', '(esta versión no lee fondos)', 'urlsDeFondo');
  }

  // ── 8 páginas de fondo entre 18 tapas sueltas ──
  {
    const d = ocho();
    const ctx = cargar(d);
    const r = await ctx.collectPages();
    eq('8 páginas numeradas de fondo y 18 tapas alrededor: entran las 8, en orden, y ninguna tapa',
      `${paginas(r).map(p => p.replace('/cap/7/', '')).join(',')} · tapas: ${r.pages.filter(p => /tapas/.test(p.url)).length} · de fondo: ${!!r.fondo}`,
      '01.png,02.png,03.png,04.png,05.png,06.png,07.png,08.png · tapas: 0 · de fondo: true');
    eq('  ni el logo del encabezado, ni el del pie, ni el fondo de <body>', r.pages.filter(p => /logo|pie|fondo-de-la/.test(p.url)).length, 0);
    eq('  el marco cuenta las 8 (así el service worker le habla a él) y parece un capítulo (burbuja)', `${ctx.countCandidates()} · ${ctx.looksLikeChapter()}`, '8 · true');
  }

  // ── Tapas dibujadas de fondo ──
  {
    // Las mismas 8 páginas, pero las 18 tapas son tarjetas con la imagen de fondo: hay más tapas
    // juntas (9 arriba) que páginas, y aun así el bloque elegido es el lector
    const ctx = cargar(ocho(tapaDeFondo));
    const r = await ctx.collectPages();
    eq('8 páginas de fondo y 18 tapas también de fondo (tarjetas con link a otras obras): entran las 8, en orden, y ninguna tapa',
      `${paginas(r).map(p => p.replace('/cap/7/', '')).join(',')} · tapas: ${r.pages.filter(p => /tapas/.test(p.url)).length} · cuenta ${ctx.countCandidates()}`,
      '01.png,02.png,03.png,04.png,05.png,06.png,07.png,08.png · tapas: 0 · cuenta 8');
    // La portada de un sitio con las tapas de fondo, un logo y un héroe de fondo, sin ninguna <img>
    const portada = documento(n('html', {}, [n('body', {}, [
      n('header', {}, [n('div', { attrs: { class: 'logo' }, bg: { '': 'url("https://sitio.com/img/logo.png")' } })]),
      n('div', { attrs: { class: 'heroe' }, bg: { '': 'url("https://sitio.com/img/heroe.jpg")' } }),
      n('div', { attrs: { class: 'grilla' } }, Array.from({ length: 12 }, (_, i) => tapaDeFondo(i + 1)))])]), { url: 'https://sitio.com/' });
    const cp = cargar(portada);
    const rp = await cp.collectPages();
    eq('  la portada de un sitio con 12 tapas de fondo, un logo y un héroe (sin ninguna <img>): no ofrece nada, el marco no cuenta y no hay burbuja',
      `${rp.pages.length} páginas · de fondo: ${!!rp.fondo} · cuenta ${cp.countCandidates()} · burbuja: ${cp.looksLikeChapter()}`, '0 páginas · de fondo: false · cuenta 0 · burbuja: false');
    // Un lector de fondo donde cada página lleva a la que sigue tiene la misma forma que un listado
    // cuyas tarjetas llevan a sus obras (/manga → /manga/obra-12, mucho más común): se toma por
    // tarjetas de un listado. Un adaptador que pide los fondos lo resuelve.
    const siguientes = () => documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'lector' } }, [1, 2, 3, 4].map(k =>
      n('a', { attrs: { href: `/leer/1/pagina/${k + 1}` } }, [n('div', { bg: { '': `url("https://cdn.sitio.com/l/${k}.jpg")` } })])))])]));
    const sinAd = await cargar(siguientes()).collectPages(), conAd = await cargar(siguientes(), { adaptador: { fondos: true, contenedor: '#lector' } }).collectPages();
    eq('  un lector de fondo donde cada página es un link a la que sigue (…/leer/1/pagina/2): pasa por un listado; con un adaptador que pide los fondos, entran las 4',
      `${paginas(sinAd).length} → ${paginas(conAd).map(p => p.split('/').pop()).join(',')}`, '0 → 1.jpg,2.jpg,3.jpg,4.jpg');
  }

  // ── Lo que encontró la tercera revisión ──
  {
    const lector = (hijos, o = {}) => documento(n('html', {}, [n('body', {}, [n('main', {}, [n('div', { attrs: { id: 'lector' } }, hijos)])])]), o);
    const solo = (r) => paginas(r).map(p => p.replace(/^.*\/cap\/7\//, '')).join(',');
    // Carga diferida por atributo: 3 páginas pintadas y 9 con su dirección en data-bg (y un marcador
    // borroso data: de más de 2000 letras de fondo mientras tanto)
    const borroso = 'data:image/jpeg;base64,' + '/9j/'.padEnd(3000, 'B');
    const diferida = lector(Array.from({ length: 12 }, (_, i) => {
      const u = `https://cdn.sitio.com/cap/7/${String(i + 1).padStart(2, '0')}.jpg`;
      return i < 3 ? n('div', { attrs: { class: 'pagina' }, bg: { '': `url("${u}")` } }) : n('div', { attrs: { class: 'pagina', 'data-bg': u }, bg: { '': `url("${borroso.slice(0, -i)}")` } });
    }));
    eq('carga diferida por atributo (3 páginas pintadas y 9 con data-bg y un marcador borroso data:): entran las 12, en orden, sin los marcadores',
      solo(await cargar(diferida).collectPages()), '01.jpg,02.jpg,03.jpg,04.jpg,05.jpg,06.jpg,07.jpg,08.jpg,09.jpg,10.jpg,11.jpg,12.jpg');
    // La miniatura borrosa con la misma dirección y otro ?w=, debajo de la entera
    const mismaDir = lector([1, 2, 3, 4].map(k => n('div', { attrs: { class: 'pagina' }, bg: { '': `url("https://cdn.sitio.com/cap/7/${k}.jpg?w=20&blur=30")` } },
      [n('div', { attrs: { class: 'completa' }, bg: { '': `url("https://cdn.sitio.com/cap/7/${k}.jpg?w=1200")` } })])));
    eq('  una miniatura borrosa con la misma dirección y otro ?w= debajo de cada página: entran las enteras', solo(await cargar(mismaDir).collectPages()), '1.jpg?w=1200,2.jpg?w=1200,3.jpg?w=1200,4.jpg?w=1200');
    // La entera en el ::after del mismo bloque, en otra carpeta
    const enAfter = lector([1, 2, 3, 4].map(k => n('div', { attrs: { class: 'pagina' }, bg: { '': `url("https://cdn.sitio.com/mini/${k}.jpg")`, '::after': `url("https://cdn.sitio.com/cap/7/${k}.jpg")` } })));
    eq('  la miniatura de fondo del bloque y la entera en su ::after (otra carpeta): entran las enteras', solo(await cargar(enAfter).collectPages()), '1.jpg,2.jpg,3.jpg,4.jpg');
    // Páginas que llegan en tandas: 3 bloques de 5
    const tandas = lector([0, 1, 2].map(t => n('div', { attrs: { class: 'tanda' } }, [1, 2, 3, 4, 5].map(k => n('div', { bg: { '': `url("https://cdn.sitio.com/cap/7/${String(t * 5 + k).padStart(2, '0')}.jpg")` } })))));
    eq('  páginas que llegan en tandas (3 bloques de 5): entran las 15', paginas(await cargar(tandas).collectPages()).length, 15);
    // La tapa del capítulo y los créditos, sin número, en la misma carpeta y en el bloque; y direcciones con el número fuera del nombre
    const conTapa = lector([n('div', { bg: { '': 'url("https://cdn.sitio.com/cap/7/cover.jpg")' } }), ...[1, 2, 3].map(k => n('div', { bg: { '': `url("https://cdn.sitio.com/cap/7/0${k}.jpg")` } })), n('div', { bg: { '': 'url("https://cdn.sitio.com/cap/7/creditos.png")' } })]);
    const porConsulta = lector([1, 2, 3].map(k => n('div', { bg: { '': `url("https://sitio.com/imagen.php?cap=7&p=${k}")` } })));
    const porCarpeta = lector([1, 2, 3].map(k => n('div', { bg: { '': `url("https://cdn.sitio.com/cap/7/${k}/full.webp")` } })));
    eq('  la tapa del capítulo y los créditos (sin número, en la misma carpeta) entran en su lugar; y el número en la consulta (imagen.php?p=N) o en la carpeta (cap/7/N/full.webp) también arma la serie',
      `${solo(await cargar(conTapa).collectPages())} | ${paginas(await cargar(porConsulta).collectPages()).length} | ${paginas(await cargar(porCarpeta).collectPages()).length}`, 'cover.jpg,01.jpg,02.jpg,03.jpg,creditos.png | 3 | 3');

    const como = async (d) => { const c = cargar(d); const r = await c.collectPages(); return `${r.pages.length} páginas · cuenta ${c.countCandidates()} · burbuja ${c.looksLikeChapter()}`; };
    // Un listado cuya dirección es el comienzo de la de sus obras (/manga → /manga/obra-N), y una aplicación con rutas por #
    const tarjetas = (href) => Array.from({ length: 12 }, (_, i) => n('a', { attrs: { href: href(i + 1) } }, [n('div', { bg: { '': `url("https://cdn.sitio.com/tapas/${i + 1}.jpg")` } })]));
    const listado = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { class: 'grilla' } }, tarjetas(k => `/manga/obra-${k}`))])]), { url: 'https://sitio.com/manga' });
    const app = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { class: 'grilla' } }, tarjetas(k => `#/obra/${k}`))])]), { url: 'https://sitio.com/#/catalogo' });
    eq('un listado en /manga cuyas tarjetas de fondo llevan a /manga/obra-N, y una aplicación con rutas por # (#/catalogo → #/obra/N): son tapas',
      `${await como(listado)} | ${await como(app)}`, '0 páginas · cuenta 0 · burbuja false | 0 páginas · cuenta 0 · burbuja false');
    // Tarjetas con el fondo en sí mismas y el link adentro (el título), con foto y avatar, o con una diapositiva y su botón "Ver más"
    const notas = documento(n('html', {}, [n('body', {}, [n('main', {}, Array.from({ length: 6 }, (_, i) => n('article', { attrs: { class: 'card' }, bg: { '': `url("https://cdn.diario.com/fotos/n${300 + i}.jpg")` } },
      [n('h2', {}, [n('a', { attrs: { href: `/nota/${300 + i}` } })])])))])]), { url: 'https://diario.com/' });
    const fotoYAvatar = documento(n('html', {}, [n('body', {}, [n('main', {}, Array.from({ length: 6 }, (_, i) => n('article', {}, [
      n('div', { attrs: { class: 'foto' }, bg: { '': `url("https://cdn.diario.com/fotos/f${700 + i}.jpg")` } }),
      n('div', { attrs: { class: 'avatar' }, bg: { '': `url("https://cdn.diario.com/avatars/${5000 + i}.jpg")` } }),
      n('h2', {}, [n('a', { attrs: { href: `/nota/${700 + i}` } })])])))])]), { url: 'https://diario.com/' });
    const slider = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { class: 'slider' } }, [1, 2, 3].map(k => n('div', { attrs: { class: 'slide' }, bg: { '': `url("https://diario.com/img/banner-${k}.jpg")` } },
      [n('a', { attrs: { href: `/promo/oferta-${k}` } })])))])]), { url: 'https://diario.com/' });
    eq('  tarjetas con el fondo en sí mismas y el link adentro, con foto y avatar, y un slider con su botón "Ver más": son tapas',
      `${await como(notas)} | ${await como(fotoYAvatar)} | ${await como(slider)}`, '0 páginas · cuenta 0 · burbuja false | 0 páginas · cuenta 0 · burbuja false | 0 páginas · cuenta 0 · burbuja false');
    // Recomendados patrocinados (llevan a otro sitio) y una tira de miniaturas para saltar de página (#pN)
    const patrocinados = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { class: 'recomendados' } }, Array.from({ length: 6 }, (_, i) =>
      n('a', { attrs: { href: `https://anunciante-${i}.com/oferta` } }, [n('span', { bg: { '': `url("https://images.taboola.com/taboola/image/fetch/thumbnails/a${9000 + i}.jpg")` } })])))])]), { url: 'https://diario.com/nota/123' });
    const tira = documento(n('html', {}, [n('body', {}, [
      n('main', {}, [n('div', { attrs: { id: 'lector' } }, Array.from({ length: 12 }, (_, i) => n('div', { attrs: { class: 'pagina' }, bg: { '': `url("https://cdn.sitio.com/cap/7/${String(i + 1).padStart(2, '0')}.jpg")` } })))]),
      n('aside', {}, [n('nav', {}, Array.from({ length: 12 }, (_, i) => n('a', { attrs: { href: `#p${i + 1}` } }, [n('span', { bg: { '': `url("https://cdn.sitio.com/cap/7/recortes/${i + 1}.jpg")` } })])))])])]));
    eq('  recomendados patrocinados (llevan a otro sitio) no son un lector; y una tira de miniaturas con anclas (#pN) no le gana a las páginas',
      `${await como(patrocinados)} | ${solo(await cargar(tira).collectPages()).split(',').length} páginas, la primera ${solo(await cargar(tira).collectPages()).split(',')[0]}`, '0 páginas · cuenta 0 · burbuja false | 12 páginas, la primera 01.jpg');
    // La burbuja decide como el diálogo: una nota con la foto principal en <img> y recomendados de fondo
    const conFoto = documento(n('html', {}, [n('body', {}, [n('img', { img: { src: 'https://diario.com/fotos/principal.jpg', w: 1024, h: 576 } }),
      n('div', { attrs: { class: 'rec' } }, [1, 2, 3, 4, 5, 6].map(k => n('div', { bg: { '': `url("https://cdn.diario.com/rec/r${k}.jpg")` } })))])]), { url: 'https://diario.com/nota/9' });
    const cf = cargar(conFoto);
    eq('  una nota con la foto principal en <img> y seis recomendados de fondo: el diálogo ofrece la foto, y no hay burbuja (deciden las <img>, como en el diálogo)',
      `${paginas(await cf.collectPages()).join(',').replace('https://diario.com', '')} · burbuja ${cf.looksLikeChapter()}`, '/fotos/principal.jpg · burbuja false');
    // Un reproductor de video en un iframe grande, con el póster de fondo: no es un lector
    const video = documento(n('html', {}, [n('body', {}, [n('div', { bg: { '': 'url("https://i.vimeocdn.com/video/1756432109-abc_640")' } }), n('video')])]), { url: 'https://player.vimeo.com/video/1', marco: true, vista: [800, 450] });
    eq('  un reproductor de video en un iframe de 800×450, con el póster de fondo: cuenta 0', cargar(video).countCandidates(), 0);
  }

  // ── Lo que encontró la tercera revisión (regresiones) ──
  {
    const como = async (d) => { const c = cargar(d); const r = await c.collectPages(); return `${r.pages.length} páginas · cuenta ${c.countCandidates()} · burbuja ${c.looksLikeChapter()}`; };
    // Los nombres que pone un empaquetador (Vite: palabra-código; webpack: solo el código), desparramados por la página
    const cascara = (urls) => documento(n('html', {}, [n('body', {}, [
      n('header', {}, [n('div', { attrs: { class: 'logo' }, bg: { '': `url("${urls[0]}")` } }), n('div', { attrs: { class: 'franja' }, bg: { '': `url("${urls[1]}")` } })]),
      n('main', {}, [n('p')]), n('footer', {}, [n('button', { bg: { '': `url("${urls[2]}")` } })])])]), { url: 'https://sitio.com/manga/one-piece/7' });
    const vite = cascara(['https://sitio.com/assets/logo-Bx3kQ9_z.png', 'https://sitio.com/assets/header-D4fT7aQ1.png', 'https://sitio.com/assets/lupa-C8rTq2Lm.png']);
    const webpack = cascara(['https://sitio.com/static/media/8f3a9c2e1b7d4f6a0c5e.png', 'https://sitio.com/static/media/1b2c3d4e5f6a7b8c9d0e.png', 'https://sitio.com/static/media/9e8d7c6b5a4f3e2d1c0b.png']);
    const icono = (k) => 'data:image/png;base64,' + 'iVBORw0KGgo'.padEnd(2200 + k, 'Q');
    const incrustados = cascara([icono(1), icono(2), icono(3)]);
    eq('los adornos de un sitio empaquetado (Vite: logo-Bx3kQ9_z.png…; webpack: códigos solos) desparramados por la página, e íconos incrustados como data: de 2200 letras: ni páginas, ni cuenta, ni burbuja',
      `${await como(vite)} | ${await como(webpack)} | ${await como(incrustados)}`,
      '0 páginas · cuenta 0 · burbuja false | 0 páginas · cuenta 0 · burbuja false | 0 páginas · cuenta 0 · burbuja false');
    // La página de arriba con dos adornos de una serie, juntos en un bloque, y un iframe grande de otro sitio (un lector en <img>, que cuenta 1)
    const conMarco = (k) => documento(n('html', {}, [n('body', {}, [
      n('div', { attrs: { class: 'cabecera' } }, Array.from({ length: k }, (_, i) => n('div', { bg: { '': `url("https://portal.com/img/bg${i + 1}.png")` } }))),
      n('iframe', { caja: [900, 700] })])]), { url: 'https://portal.com/read/tira/12' });
    eq('  dos fondos de una serie arriba y un iframe grande de otro sitio: la página cuenta 0 (compite el iframe); con 8, cuenta 8',
      `${cargar(conMarco(2)).countCandidates()} · ${cargar(conMarco(8)).countCandidates()}`, '0 · 8');
  }

  // ── image-set(), un SVG con <image>, una regla y un relleno data: ──
  {
    // (las páginas de un capítulo están en una carpeta: la página, la hoja de estilo y las imágenes)
    const d = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'visor' } }, [
      n('div', { attrs: { class: 'pg' }, bg: { '': 'image-set(url("https://cdn.sitio.com/v/01.jpg?d=1x") 1x, url("https://cdn.sitio.com/v/01.jpg?d=2x") 2x)' } }),
      n('div', { attrs: { class: 'pg' }, bg: { '': '-webkit-image-set(url("https://cdn.sitio.com/v/02.jpg?d=1x") 1x, url("https://cdn.sitio.com/v/02.jpg?d=2x") 2x)' } }),
      n('svg', { ns: SVG }, [n('image', { ns: SVG, attrs: { href: 'https://cdn.sitio.com/v/03.jpg' } }), n('image', { ns: SVG, attrs: { 'xlink:href': '04.jpg' } })]),
      n('div', { attrs: { class: 'pg p5' } }),                     // su fondo viene de una regla con ::before
      n('div', { attrs: { class: 'pg' }, bg: { '': 'url("data:image/gif;base64,R0lGODlhAQABAAAAACw=")' } }),    // relleno de un píxel
    ])])]), { url: 'https://cdn.sitio.com/v/visor.html',
      // (la regla es relativa a su hoja: contra la página daría /v/v/05.jpg)
      hojas: [{ href: 'https://cdn.sitio.com/lector.css', cssRules: [{ selectorText: '.p5::before', style: { backgroundImage: 'url("v/05.jpg")' } }] },
              { href: 'https://otro.com/x.css', get cssRules() { throw new Error('SecurityError'); } }] });
    const r = await cargar(d).collectPages();
    eq('image-set() (la de 2x), dos <image> de SVG (uno relativo), una regla con ::before (relativa a su hoja); sin el relleno data: ni la hoja de otro sitio',
      paginas(r).join(' | '), '/v/01.jpg?d=2x | /v/02.jpg?d=2x | /v/03.jpg | /v/04.jpg | /v/05.jpg');
  }

  // ── Solo degradés ──
  {
    const d = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'lector' } }, [
      n('div', { bg: { '': 'linear-gradient(red, blue)' } }), n('div', { bg: { '': 'radial-gradient(circle, red, blue), linear-gradient(red, blue)' } }),
      n('div', { bg: { '': 'none' } }), n('div', { bg: { '': 'conic-gradient(red, blue)' } })])])]));
    const ctx = cargar(d);
    const r = await ctx.collectPages();
    eq('una página con solo degradés (y none): no ofrece nada', `${r.pages.length} páginas · de fondo: ${!!r.fondo} · cuenta ${ctx.countCandidates()} · burbuja: ${ctx.looksLikeChapter()}`, '0 páginas · de fondo: false · cuenta 0 · burbuja: false');
  }

  // ── La detección por <img> sigue igual ──
  {
    // un capítulo de 6 páginas en su carpeta, un aviso que lleva a otro sitio, y además dos fondos
    // en un carrusel: las <img> arman un capítulo y ganan, como siempre
    const pag = (k) => n('img', { img: { src: `https://cdn.sitio.com/cap/12/${k}.jpg`, w: 800, h: 1200 } });
    const d = documento(n('html', {}, [n('body', {}, [
      n('div', { attrs: { class: 'carrusel' } }, [n('div', { bg: { '': 'url("https://sitio.com/c/1.jpg")' } }), n('div', { bg: { '': 'url("https://sitio.com/c/2.jpg")' } })]),
      n('div', { attrs: { id: 'paginas' } }, [pag(1), pag(2), pag(3), n('a', { attrs: { href: 'https://otro.com/oferta' } }, [n('img', { img: { src: 'https://ads.com/a.jpg', w: 800, h: 1200 } })]), pag(4), pag(5), pag(6)]),
    ])]));
    const r = await cargar(d).collectPages();
    eq('un capítulo en <img> con un aviso, y dos fondos de un carrusel: las <img> mandan, como siempre',
      `${r.pages.map(p => p.url.split('/').pop() + (p.flag ? ` [${p.flag}]` : '')).join(' ')} · de fondo: ${!!r.fondo}`,
      '1.jpg 2.jpg 3.jpg a.jpg [enlace a otro sitio] 4.jpg 5.jpg 6.jpg · de fondo: false');
    // un capítulo de un blog, cada imagen en su carpeta (no hay una carpeta con la mayoría), y un
    // fondo en el encabezado: las imágenes sueltas siguen siendo las páginas
    const blog = (k) => n('img', { img: { src: `https://blogger.googleusercontent.com/img/b/AVvX${k}/s1600/0${k}.jpg`, w: 800, h: 1200 } });
    const d2 = documento(n('html', {}, [n('body', {}, [n('header', { bg: { '': 'url("https://blog.com/cabecera.jpg")' } }), n('div', {}, [1, 2, 3, 4, 5].map(blog))])]));
    const r2 = await cargar(d2).collectPages();
    eq('  un capítulo de un blog (cada imagen en su carpeta) con un fondo en el encabezado: siguen las 5 imágenes',
      `${paginas(r2).length} · de fondo: ${!!r2.fondo}`, '5 · de fondo: false');
  }

  // ── Issuu: el lector de fondo en un iframe del mismo sitio, las tapas arriba ──
  {
    // (como el de verdad: la página pintada de fondo con su SVG, y adentro el mismo escaneo otra vez, en un SVG en línea)
    const escaneo = 'data:image/jpeg;charset=utf-8;base64,' + '/9j/'.padEnd(30000, 'A');
    const lector = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'issuu-reader' } }, [n('div', { attrs: { class: 'inner-container' } }, [
      n('section', { attrs: { class: 'page right' }, bg: { '': 'url("https://svg.issuu.com/abc/page_1.svg"), linear-gradient(110deg, rgba(0, 0, 0, 0) 20%, rgba(255, 255, 255, 0.3) 30%)' } },
        [n('div', { attrs: { class: 'page-svg' } }, [n('svg', { ns: SVG }, [n('image', { ns: SVG, attrs: { href: escaneo } })])])])])])])]),
      { url: 'https://issuu.com/rd4?p=1', marco: true });
    const arriba = documento(n('html', {}, [n('body', {}, [
      n('div', {}, Array.from({ length: 18 }, (_, i) => n('a', { attrs: { href: `/otro/docs/d${i}` } }, [n('img', { img: { src: `https://image.isu.pub/doc${i}/jpg/page_1_thumb_large.jpg`, w: 331, h: 480 } })]))),
      n('iframe', { caja: [869, 733], doc: lector.doc }),
    ])]), { url: 'https://issuu.com/x/docs/manga' });
    const ca = cargar(arriba), cl = cargar(lector);
    const ra = await ca.collectPages(), rl = await cl.collectPages();
    eq('Issuu, página de arriba: las 18 tapas no se ofrecen (el lector de fondo está en el iframe) y dice que no encontró páginas',
      `${ra.pages.filter(p => !p.flag).length} ofrecidas · sin páginas: ${!!ra.locked} · cuenta ${ca.countCandidates()}`, '0 ofrecidas · sin páginas: true · cuenta 0');
    eq('  el iframe del lector: su página de fondo (el SVG, una sola vez aunque el mismo escaneo esté adentro), y cuenta 1, así gana él',
      `${paginas(rl).join(',')} · de fondo: ${!!rl.fondo} · cuenta ${cl.countCandidates()}`, '/abc/page_1.svg · de fondo: true · cuenta 1');
    // Antes de que carguen las tapas (como en el Issuu de verdad el 24-11-2026: la imagen de un menú
    // y una tapa, cada una en su carpeta): la página de arriba no le empata al lector del iframe
    const temprano = (marco) => documento(n('html', {}, [n('body', {}, [
      n('div', { attrs: { role: 'menu' } }, [n('img', { img: { src: 'https://issuu.com/assets/media/CardUseCases.png', w: 801, h: 601 } })]),
      n('a', { attrs: { href: '/otro/docs/d1' } }, [n('img', { img: { src: 'https://image.isu.pub/doc1/jpg/page_1_thumb_large.jpg', w: 331, h: 480 } })]),
      n('iframe', { caja: [869, 733], doc: marco.doc })])]), { url: 'https://issuu.com/x/docs/manga' });
    // …y un aviso en un iframe about:blank (con su imagen de fondo) no le saca el lugar a la página
    const aviso = documento(n('html', {}, [n('body', {}, [n('div', { bg: { '': 'url("https://ads.com/creativo_300x600.jpg")' } })])]), { url: 'about:blank' });
    eq('  antes de que carguen las tapas (un menú y una tapa arriba): la página cuenta 0 y gana el iframe del lector; con un aviso en un about:blank en vez del lector, la página cuenta lo suyo',
      `${cargar(temprano(lector)).countCandidates()} · ${cargar(temprano(aviso)).countCandidates()}`, '0 · 1');
  }

  // ── Un lector de fondo que no se puede leer ──
  {
    const lector = (urls, medidas) => {
      const d = documento(n('html', {}, [n('body', {}, [
        n('div', {}, [3, 4, 5].map(k => n('a', { attrs: { href: `/obra/${k}` } }, [n('img', { img: { src: `https://img.sitio.com/tapas/obra-${k}/p.jpg`, w: 331, h: 480 } })]))),
        n('div', { attrs: { id: 'lector' } }, urls.map(u => n('div', { bg: { '': `url("${u}")` } })))])]));
      return cargar(d, { medidas }).collectPages();
    };
    const rb = await lector(['blob:https://sitio.com/1', 'blob:https://sitio.com/2', 'blob:https://sitio.com/3']);
    eq('un lector que pinta las páginas con blob: (no se pueden bajar) y tres tapas sueltas: no ofrece las tapas, dice que no encontró páginas',
      `${rb.pages.filter(p => !p.flag).length} ofrecidas · sin páginas: ${!!rb.locked} · de fondo: ${!!rb.fondo}`, '0 ofrecidas · sin páginas: true · de fondo: true');
    const rotas = ['https://cdn.sitio.com/x/1.jpg', 'https://cdn.sitio.com/x/2.jpg', 'https://cdn.sitio.com/x/3.jpg'];
    const rr = await lector(rotas, Object.fromEntries(rotas.map(u => [u, null])));
    eq('  páginas de fondo que no cargan: las mismas tapas tampoco se ofrecen, y cuenta las que fallaron',
      `${rr.pages.filter(p => !p.flag).length} ofrecidas · sin páginas: ${!!rr.locked} · fallaron ${rr.failed}`, '0 ofrecidas · sin páginas: true · fallaron 3');
  }

  // ── El adaptador puede pedir los fondos aunque haya <img> ──
  {
    const pag = (k) => n('img', { img: { src: `https://cdn.sitio.com/tapas/${k}.jpg`, w: 800, h: 1200 } });
    const arbol = () => documento(n('html', {}, [n('body', {}, [
      n('div', { attrs: { class: 'grilla' } }, [1, 2, 3, 4, 5, 6].map(pag)),         // seis imágenes en una carpeta: arman "un capítulo"
      n('div', { attrs: { id: 'lector' } }, [1, 2, 3, 4].map(k => n('div', { bg: { '': `url("https://cdn.sitio.com/fondo/${k}.jpg")` } })))])]));
    const sin = await cargar(arbol()).collectPages();
    const ctxA = cargar(arbol(), { adaptador: { fondos: true, contenedor: '#lector' } });
    const con = await ctxA.collectPages();
    eq('seis <img> en una carpeta y cuatro páginas de fondo: sin adaptador mandan las <img>; con uno que pide fondos, las de fondo',
      `${paginas(sin).map(p => p.split('/').slice(-2).join('/')).join(',')} → ${paginas(con).map(p => p.split('/').slice(-2).join('/')).join(',')} · cuenta ${ctxA.countCandidates()}`,
      'tapas/1.jpg,tapas/2.jpg,tapas/3.jpg,tapas/4.jpg,tapas/5.jpg,tapas/6.jpg → fondo/1.jpg,fondo/2.jpg,fondo/3.jpg,fondo/4.jpg · cuenta 4');
  }

  // ── Una grilla de tapas no es un capítulo ──
  {
    // Issuu antes de que cargue el lector: en la página están las tapas, cada una con su link a
    // otra publicación, y la imagen de un menú (sin link), como en la de verdad. No se ofrecen, y
    // el marco no compite por el diálogo.
    const d = documento(n('html', {}, [n('body', {}, [
      n('div', { attrs: { role: 'menu' } }, [n('img', { img: { src: 'https://issuu.com/assets/media/CardUseCases.png', w: 801, h: 601 } })]),
      n('div', {}, Array.from({ length: 17 }, (_, i) => n('a', { attrs: { href: `/otro/docs/d${i}` } }, [n('img', { img: { src: `https://image.isu.pub/doc${i}/jpg/page_1_thumb_large.jpg`, w: 331, h: 480 } })])))])]),
      { url: 'https://issuu.com/x/docs/manga' });
    const ctx = cargar(d);
    const r = await ctx.collectPages();
    eq('Issuu antes de que cargue el lector (17 tapas que llevan a otras publicaciones y la imagen de un menú): no se ofrece ninguna y dice que no encontró páginas',
      `${r.pages.filter(p => !p.flag).length} ofrecidas de ${r.pages.length} · sin páginas: ${!!r.locked} · tapas: ${!!r.tapas} · cuenta ${ctx.countCandidates()}`, '0 ofrecidas de 18 · sin páginas: true · tapas: true · cuenta 0');
    // Un capítulo de blog con 20 páginas sueltas y 4 miniaturas de "entradas relacionadas" que llevan a otras entradas: sigue igual
    const pagBlog = (k) => n('img', { img: { src: `https://blogger.googleusercontent.com/img/b/AVvX${k}/s1600/${k}.jpg`, w: 800, h: 1200 } });
    const rel = (k) => n('a', { attrs: { href: `/2026/11/entrada-${k}.html` } }, [n('img', { img: { src: `https://blogger.googleusercontent.com/img/b/REL${k}/s400/t.jpg`, w: 400, h: 300 } })]);
    const rb = await cargar(documento(n('html', {}, [n('body', {}, [n('div', {}, Array.from({ length: 20 }, (_, i) => pagBlog(i + 1))), n('div', {}, [1, 2, 3, 4].map(rel))])]))).collectPages();
    eq('  un capítulo de blog (20 páginas sueltas) con 4 miniaturas de entradas relacionadas: siguen las 24 imágenes, como siempre', `${paginas(rb).length} · tapas: ${!!rb.tapas}`, '24 · tapas: false');
    // Lo que no es una grilla de tapas sigue igual
    const blog = (k) => n('a', { attrs: { href: `https://blogger.googleusercontent.com/img/b/AVvX${k}/s1600/0${k}.jpg` } }, [n('img', { img: { src: `https://blogger.googleusercontent.com/img/b/AVvX${k}/s400/0${k}.jpg`, w: 800, h: 1200 } })]);
    const r2 = await cargar(documento(n('html', {}, [n('body', {}, [n('div', {}, [1, 2, 3, 4].map(blog))])]))).collectPages();
    const todas = (k) => n('img', { img: { src: `https://cdn.sitio.com/${k}/p.jpg`, w: 800, h: 1200 } });
    const r3 = await cargar(documento(n('html', {}, [n('body', {}, [n('a', { attrs: { href: '/leer/capitulo-2' } }, [1, 2, 3, 4].map(todas))])]))).collectPages();
    eq('  no lo son: un capítulo de blog con cada imagen enlazada a su archivo grande, ni imágenes que llevan todas al mismo lugar (el capítulo que sigue)',
      `${paginas(r2).length} · ${paginas(r3).length} · tapas: ${!!r2.tapas || !!r3.tapas}`, '4 · 4 · tapas: false');
    // Una portada: tapas y un fondo de cabecera. El fondo solo no es un lector.
    const r4 = await cargar(documento(n('html', {}, [n('body', {}, [n('div', { attrs: { class: 'portada' }, bg: { '': 'url("https://sitio.com/img/heroe.jpg")' } }),
      n('div', {}, [1, 2, 3, 4, 5, 6].map(k => n('a', { attrs: { href: `/obra/${k}` } }, [n('img', { img: { src: `https://sitio.com/tapas/${k}/t.jpg`, w: 300, h: 450 } })])))])]))).collectPages();
    eq('  la portada de un sitio (tapas y un fondo de cabecera): ni las tapas ni el fondo', `${paginas(r4).length} ofrecidas · de fondo: ${!!r4.fondo} · tapas: ${!!r4.tapas}`, '0 ofrecidas · de fondo: false · tapas: true');
  }

  // ── Los adornos de una página no son un lector ──
  {
    const blog = (k) => n('img', { img: { src: `https://blogger.googleusercontent.com/img/b/AVvX${k}/s1600/0${k}.jpg`, w: 800, h: 1200 } });
    const conAdornos = (adornos, cuantas = 5) => documento(n('html', {}, [n('body', {}, [
      n('header', { bg: { '': `url("${adornos[0]}")` } }),
      n('div', {}, Array.from({ length: cuantas }, (_, i) => blog(i + 1))),
      ...adornos.slice(1).map(u => n('div', { bg: { '': `url("${u}")` } }))])]));
    const r2 = cargar(conAdornos(['https://blog.com/cabecera.jpg', 'https://blog.com/iconos/lupa-18.png']));
    const rr2 = await r2.collectPages();
    eq('un capítulo de blog (5 <img> sueltas, cada una en su carpeta) con dos fondos de adorno: siguen las 5 <img> (con las dos clases, ganan las <img>)',
      `${paginas(rr2).length} · de fondo: ${!!rr2.fondo} · cuenta ${r2.countCandidates()} · burbuja: ${r2.looksLikeChapter()}`, '5 · de fondo: false · cuenta 1 · burbuja: false');
    const r3 = cargar(conAdornos(['https://blog.com/cabecera.jpg', 'https://blog.com/img/sprite-2.png', 'https://blog.com/img/pie-3.png'], 8));
    const rr3 = await r3.collectPages();
    eq('  con tres adornos (cabecera, sprite y pie): siguen las 8, y el marco cuenta lo de siempre (no corta antes la espera de un lote)',
      `${paginas(rr3).length} · de fondo: ${!!rr3.fondo} · cuenta ${r3.countCandidates()}`, '8 · de fondo: false · cuenta 1');
    const r4 = cargar(conAdornos(['https://blog.com/iconos/reaccion-1.png', 'https://blog.com/iconos/reaccion-2.png', 'https://blog.com/iconos/reaccion-3.png']));
    eq('  con tres íconos de reacción numerados de fondo (una serie): mandan las 5 <img>, y la burbuja la deciden ellas, como en la 2.11.2',
      `${paginas(await r4.collectPages()).length} · burbuja: ${r4.looksLikeChapter()}`, '5 · burbuja: false');
    // Íconos de redes (links a otros sitios), un carrusel de portada y un logo: ni burbuja ni páginas
    const redes = documento(n('html', {}, [n('body', {}, [n('nav', {}, ['facebook', 'x', 'whatsapp'].map(r =>
      n('a', { attrs: { href: `https://${r}.com/compartir` } }, [n('i', { bg: { '': `url("https://diario.com/iconos/${r}.svg")` } })])))])]), { url: 'https://diario.com/nota/123' });
    const carrusel = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { class: 'carrusel' } }, ['portada-verano', 'promo', 'ofertas'].map(s =>
      n('div', { attrs: { class: 'slide' }, bg: { '': `url("https://diario.com/img/${s}.jpg")` } })))])]), { url: 'https://diario.com/' });
    const logo = documento(n('html', {}, [n('body', {}, [n('header', {}, [n('div', { bg: { '': 'url("https://portal.com/img/logo.png")' } })])])]), { url: 'https://portal.com/read/tira/12' });
    const como = async (d) => { const c = cargar(d); const r = await c.collectPages(); return `${r.pages.length} páginas · cuenta ${c.countCandidates()} · burbuja ${c.looksLikeChapter()}`; };
    eq('  tres íconos de redes de fondo, un carrusel de tres diapositivas y un logo solo: ni páginas, ni cuenta, ni burbuja',
      `${await como(redes)} | ${await como(carrusel)} | ${await como(logo)}`,
      '0 páginas · cuenta 0 · burbuja false | 0 páginas · cuenta 0 · burbuja false | 0 páginas · cuenta 0 · burbuja false');
    // Ese logo solo, adentro de un iframe (un lector que muestra de a una página): ahí sí cuenta
    const enIframe = cargar(documento(n('html', {}, [n('body', {}, [n('div', { attrs: { class: 'page' }, bg: { '': 'url("https://svg.lector.com/doc/page.svg")' } })])]), { marco: true }));
    eq('  una sola imagen de fondo en un iframe (como el lector de Issuu): esa sí, y el marco cuenta 1', `${paginas(await enIframe.collectPages()).join(',')} · cuenta ${enIframe.countCandidates()}`, '/doc/page.svg · cuenta 1');
    // Un catálogo de tapas <img> con logo, héroe y pie de fondo (el explorador del programa usa estas mismas funciones)
    const catalogo = documento(n('html', {}, [n('body', {}, [
      n('header', { bg: { '': 'url("https://sitio.com/img/logo.png")' } }), n('div', { bg: { '': 'url("https://sitio.com/img/heroe.jpg")' } }),
      n('div', {}, Array.from({ length: 12 }, (_, i) => n('a', { attrs: { href: `/obra/${i + 1}` } }, [n('img', { img: { src: `https://sitio.com/covers/${i + 1}.jpg`, w: 300, h: 450 } })]))),
      n('footer', { bg: { '': 'url("https://sitio.com/img/pie.png")' } })])]), { url: 'https://sitio.com/' });
    const cc = cargar(catalogo);
    eq('  un catálogo de 12 tapas <img> con logo, héroe y pie de fondo: no es un lector de fondo y no hay burbuja (las <img> cuentan lo de siempre: las 12 de su carpeta)', `fondo ${cc.cuentaDeFondo(0, false)} · cuenta ${cc.countCandidates()} · burbuja ${cc.looksLikeChapter()}`, 'fondo 0 · cuenta 12 · burbuja false');
    // Miniaturas de fondo con el link al lado (en el título o en el nombre), no envolviéndolas: la
    // portada de un diario y los avatares de un foro. Las miniaturas son una serie, pero son tapas
    const notas = documento(n('html', {}, [n('body', {}, [n('main', {}, Array.from({ length: 6 }, (_, i) => n('article', {}, [
      n('div', { attrs: { class: 'foto' }, bg: { '': `url("https://cdn.diario.com/fotos/2026/11/nota-${1200 + i}.jpg")` } }),
      n('h2', {}, [n('a', { attrs: { href: `/nota/${100 + i}-un-titulo` } })])])))])]), { url: 'https://diario.com/' });
    const foro = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'hilo' } }, Array.from({ length: 5 }, (_, i) => n('div', { attrs: { class: 'post' } }, [
      n('div', { attrs: { class: 'autor' } }, [n('div', { attrs: { class: 'avatar' }, bg: { '': `url("https://foro.com/uploads/avatars/${5000 + i}.jpg")` } }), n('a', { attrs: { href: `/usuario/${i}` } })]),
      n('p')])))])]), { url: 'https://foro.com/hilo/77' });
    eq('  miniaturas de fondo con el link en el título (un diario) o en el nombre (avatares de un foro): son tapas, ni páginas, ni cuenta, ni burbuja',
      `${await como(notas)} | ${await como(foro)}`, '0 páginas · cuenta 0 · burbuja false | 0 páginas · cuenta 0 · burbuja false');
    // Un aviso en un iframe chico (300×250) con dos creativos numerados no compite con la página; un marco grande como un lector, sí
    const creativos = (vista) => documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'aviso' } }, [1, 2].map(k =>
      n('div', { bg: { '': `url("https://tpc.googlesyndication.com/simgad/${77000 + k}")` } })))])]), { url: 'https://ads.com/frame', marco: true, vista });
    eq('  un iframe de aviso de 300×250 con dos creativos numerados de fondo cuenta 0 (no le gana a la página); el mismo contenido en un marco de 900×700 cuenta 2',
      `${cargar(creativos([300, 250])).countCandidates()} · ${cargar(creativos([900, 700])).countCandidates()}`, '0 · 2');
    // Un lector de a una página (la página en <img>, sin link) y tres tapas de "relacionados": no es
    // una grilla de tapas (no son casi todas): se ofrecen las 4, como siempre, para destildar las tapas
    const deAUna = documento(n('html', {}, [n('body', {}, [
      n('img', { img: { src: 'https://cdn.sitio.com/one-piece/7/p1.jpg', w: 800, h: 1200 } }),
      n('div', {}, [1, 2, 3].map(k => n('a', { attrs: { href: `/manga/otra-${k}` } }, [n('img', { img: { src: `https://cdn.sitio.com/tapas/${k}/t.jpg`, w: 300, h: 450 } })])))])]),
      { url: 'https://sitio.com/manga/one-piece/7' });
    const rd = await cargar(deAUna).collectPages();
    eq('  un lector de a una página (la página sin link) con tres tapas de "relacionados": no es una grilla de tapas, se ofrecen las 4 como en la 2.11.2',
      `${paginas(rd).length} ofrecidas · tapas: ${!!rd.tapas} · sin páginas: ${!!rd.locked}`, '4 ofrecidas · tapas: false · sin páginas: false');
  }

  // ── Lo que no es de la serie de las páginas queda afuera ──
  {
    // Un "cargando" de fondo en el bloque que envuelve cada página, y una miniatura borrosa de
    // fondo con la página entera encima (LQIP): entran las 4 páginas enteras, y nada más
    const envueltas = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'lector' } }, [1, 2, 3, 4].map(k =>
      n('div', { attrs: { class: 'envoltorio' }, bg: { '': 'url("https://sitio.com/img/cargando.gif")' } }, [n('div', { bg: { '': `url("https://cdn.sitio.com/cap/9/${k}.jpg")` } })])))])]));
    const borrosas = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'lector' } }, [1, 2, 3, 4].map(k =>
      n('div', { bg: { '': `url("https://cdn.sitio.com/mini/${k}.jpg")` } }, [n('div', { bg: { '': `url("https://cdn.sitio.com/completa/${k}.jpg")` } })])))])]));
    eq('un "cargando" de fondo detrás de cada página, y una miniatura borrosa debajo de cada página: entran las 4 páginas, sin el "cargando" ni las miniaturas',
      `${paginas(await cargar(envueltas).collectPages()).map(p => p.replace('/cap/9/', '')).join(',')} | ${paginas(await cargar(borrosas).collectPages()).join(',')}`,
      '1.jpg,2.jpg,3.jpg,4.jpg | /completa/1.jpg,/completa/2.jpg,/completa/3.jpg,/completa/4.jpg');
    // Las reglas: la página tiene su fondo en línea y una regla le pone un "cargando" (lo pisa la
    // cascada); la versión @2x de un @media que no se cumple no cuenta, y la que se cumple sí
    const conReglas = (medias) => documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'lector' } }, [
      ...[1, 2, 3].map(k => n('div', { attrs: { class: 'pagina' }, bg: { '': `url("https://cdn.sitio.com/cap/4/${k}.jpg")` } })),
      n('div', { attrs: { class: 'pagina p4' } })])])]),
      { medias, hojas: [{ href: 'https://sitio.com/css/l.css', cssRules: [
        { selectorText: '.pagina', style: { backgroundImage: 'url("/img/cargando.gif")' } },
        { media: { mediaText: '(min-resolution: 2dppx)' }, cssRules: [{ selectorText: '.p4', style: { backgroundImage: 'url("https://cdn.sitio.com/cap/4/4.jpg")' } }] }] }] });
    eq('  las reglas: un "cargando" que pisa la cascada no entra; una página de un @media que no se cumple, tampoco; si se cumple, sí',
      `${paginas(await cargar(conReglas([])).collectPages()).map(p => p.split('/').pop()).join(',')} → ${paginas(await cargar(conReglas(['(min-resolution: 2dppx)'])).collectPages()).map(p => p.split('/').pop()).join(',')}`,
      '1.jpg,2.jpg,3.jpg → 1.jpg,2.jpg,3.jpg,4.jpg');
    // Páginas con nombres de código, en una carpeta
    const codigos = ['a8f3e9c1d2b47', '77bc12aa90f31', 'c0ffee12345ab', '9d8e7f6a5b4c3'];
    const rc = await cargar(documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'lector' } }, codigos.map(c => n('div', { bg: { '': `url("https://img.lector.com/i/${c}.jpg")` } })))])]))).collectPages();
    eq('  páginas con nombres de código en una carpeta también son una serie', `${paginas(rc).length} · de fondo: ${!!rc.fondo}`, '4 · de fondo: true');
    // Un iframe del mismo sitio con un aviso de fondo no esconde las <img> sueltas de la página
    const aviso = documento(n('html', {}, [n('body', {}, [n('div', { bg: { '': 'url("https://blog.com/anuncio/creativo.jpg")' } })])]));
    const conAviso = documento(n('html', {}, [n('body', {}, [n('div', {}, Array.from({ length: 20 }, (_, i) =>
      n('img', { img: { src: `https://blogger.googleusercontent.com/img/b/AVvX${i}/s1600/${i}.jpg`, w: 800, h: 1200 } }))), n('iframe', { caja: [300, 600], doc: aviso.doc })])]));
    const ra = cargar(conAviso), rra = await ra.collectPages();
    eq('  un iframe del mismo sitio con un aviso de fondo no esconde las 20 <img> sueltas de la página', `${paginas(rra).length} · sin páginas: ${!!rra.locked} · cuenta ${ra.countCandidates()}`, '20 · sin páginas: false · cuenta 1');
  }

  // ── El adaptador que pide los fondos respeta "ignorar" y toma todos los bloques ──
  {
    const lector = () => documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'lector' } }, [
      n('div', { attrs: { class: 'flecha' }, bg: { '': 'url("https://sitio.com/ui/izq.png")' } }),
      ...[1, 2, 3].map(k => n('div', { attrs: { class: 'pagina' }, bg: { '': `url("https://cdn.sitio.com/l/${k}.jpg")` } })),
      n('div', { attrs: { class: 'flecha' }, bg: { '': 'url("https://sitio.com/ui/der.png")' } })])])]));
    const con = (adaptador) => cargar(lector(), { adaptador }).collectPages().then(r => paginas(r).map(p => p.split('/').pop()).join(','));
    eq('un adaptador con "fondos": sin "ignorar" entra todo lo del bloque; con "ignorar: .flecha", las flechas no; con "contenedor: .pagina" (tres bloques), las tres',
      `${await con({ fondos: true, contenedor: '#lector' })} | ${await con({ fondos: true, contenedor: '#lector', ignorar: ['.flecha'] })} | ${await con({ fondos: true, contenedor: '.pagina' })}`,
      'izq.png,1.jpg,2.jpg,3.jpg,der.png | 1.jpg,2.jpg,3.jpg | 1.jpg,2.jpg,3.jpg');
  }

  // ── (2.11.4) Lo que cada marco le dice al service worker: sus páginas y cuáles cargaron ──
  // (con eso decide si una imagen que pidió esperar es una página que faltó, antes de pedir el guardado)
  if (tiene(/function paginasQueCuenta\(/)) {
    const P = 'https://sitio.com/cap/5/';
    const pag = (k, o = {}) => n('img', { img: { src: `${P}${k}.jpg`, w: 800, h: 1200, ...o } });
    const banner = n('img', { img: { src: 'https://sitio.com/publicidad/banner.jpg', w: 0, h: 0 } });          // roto: respondió 503
    const corto = (u) => u.replace(/^https:\/\/[^/]+/, '');
    const cuenta = (ctx) => { const n0 = ctx.countCandidates(); const r = ctx.paginasQueCuenta(); return `${n0} · ${r.urls.map(corto).join(' ')} · cargadas ${r.cargadas.length}`; };
    eq('6 páginas cargadas y un banner roto de otra carpeta: el marco dice sus 6 páginas, las 6 cargadas, y no el banner',
      cuenta(cargar(documento(n('html', {}, [n('body', {}, [banner, ...[1, 2, 3, 4, 5, 6].map(k => pag(k))])])))),
      '6 · /cap/5/1.jpg /cap/5/2.jpg /cap/5/3.jpg /cap/5/4.jpg /cap/5/5.jpg /cap/5/6.jpg · cargadas 6');
    eq('  la 3 rota (respondió 503): sigue entre las páginas, pero no entre las cargadas',
      cuenta(cargar(documento(n('html', {}, [n('body', {}, [1, 2, 3, 4, 5, 6].map(k => pag(k, k === 3 ? { w: 0, h: 0 } : {})))])))),
      '6 · /cap/5/1.jpg /cap/5/2.jpg /cap/5/3.jpg /cap/5/4.jpg /cap/5/5.jpg /cap/5/6.jpg · cargadas 5');
    // Carga diferida, como en el sitio "clásico" de e2e.js: cada <img> muestra un marcador de 1×1 y la
    // página está en data-src. Las páginas son esas, sin cargar todavía: el banner roto no es el capítulo
    const diferida = (k) => n('img', { img: { src: 'https://sitio.com/images/px.png', w: 1, h: 1, dataSrc: `${P}${k}.jpg` } });
    eq('  con carga diferida (marcador de 1×1 y la página en data-src): las páginas son las de data-src, sin cargar, y el banner roto no entra',
      cuenta(cargar(documento(n('html', {}, [n('body', {}, [banner, ...[1, 2, 3, 4, 5, 6].map(diferida)])])))).replace(/^\d+ · /, ''),
      '/cap/5/1.jpg /cap/5/2.jpg /cap/5/3.jpg /cap/5/4.jpg /cap/5/5.jpg /cap/5/6.jpg · cargadas 0');
    // Un adaptador que pide los fondos: las páginas son las de fondo, aunque el contenedor no tenga <img>
    const lectorFondo = documento(n('html', {}, [n('body', {}, [banner, n('div', { attrs: { id: 'reader' } }, [1, 2, 3, 4, 5, 6].map(k =>
      n('div', { attrs: { class: 'pagina' }, bg: { '': `url("${P}${k}.jpg")` } })))])]));
    eq('  con un adaptador que pide los fondos (y un contenedor sin <img>): las páginas son las 6 de fondo, no ninguna',
      cuenta(cargar(lectorFondo, { adaptador: { fondos: true, contenedor: '#reader' } })), '6 · /cap/5/1.jpg /cap/5/2.jpg /cap/5/3.jpg /cap/5/4.jpg /cap/5/5.jpg /cap/5/6.jpg · cargadas 0');
    // Con un adaptador, cada página puede estar en su carpeta: van todas
    const porCarpeta = documento(n('html', {}, [n('body', {}, [n('div', { attrs: { id: 'lector' } }, [1, 2, 3].map(k =>
      n('img', { img: { src: `https://sitio.com/p/${k}/img.jpg`, w: k === 2 ? 0 : 800, h: k === 2 ? 0 : 1200 } })))])]));
    eq('  con un adaptador y una carpeta por página: van las tres, y la rota no está entre las cargadas',
      cuenta(cargar(porCarpeta, { adaptador: { contenedor: '#lector' } })), '3 · /p/1/img.jpg /p/2/img.jpg /p/3/img.jpg · cargadas 2');
  }
  // (2.11.4) Las 18 tapas de alrededor del lector de fondo, 3 de ellas en una misma carpeta (las
  // subidas de un mes): esa carpeta no junta la mitad de las imágenes, así que no es el capítulo. Hasta
  // la 2.11.3 el marco contaba esas 3 (el diálogo ya ofrecía las 8 de fondo)
  if (tiene(/function fondosDe\(/)) {
    const tapaMes = (k) => n('a', { attrs: { href: `/obra/${k}` } }, [n('img', { img: { src: k <= 3 ? `https://img.sitio.com/subidas/2024-05/tapa-${k}.jpg` : `https://img.sitio.com/tapas/obra-${k}/portada.jpg`, w: 331, h: 480 } })]);
    const rm = cargar(ocho(tapaMes));
    eq('con 3 de las 18 tapas en una misma carpeta: el marco cuenta las 8 páginas de fondo (no esas 3) y el diálogo ofrece las 8',
      `${rm.countCandidates()} · ${paginas(await rm.collectPages()).length}`, '8 · 8');
  }
  fin();
})();
