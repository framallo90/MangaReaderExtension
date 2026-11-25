/**
 * Manga Reader v2.11.4 - Content Script
 * Guarda el capítulo abierto como PDF, CBZ y/o imágenes sueltas con el nombre del tomo.
 * Detecta páginas que no son del capítulo (logos, banners, publicidad, créditos) y
 * muestra miniaturas para tildar/destildar a mano.
 * También maneja la descarga de varios capítulos seguidos: cada uno se abre en su
 * pestaña y se guarda ahí con este mismo código.
 */

(function () {
  // Una sola instancia viva por pestaña. Si quedó una de antes de actualizar la extensión
  // (ya sin conexión con ella), se la limpia y esta ocupa su lugar: no hace falta F5.
  if (window.__mangaReaderAlive?.()) return;
  try { window.__mangaReaderCleanup?.(); } catch {}

  const OURS = '#mr-host, #mr-save, #mr-chapter, #mr-fab';      // lo que esta extensión inserta en la página (el host, y lo que insertaba antes de la 2.11)
  const MIN_SIDE = 250;          // menos que esto: íconos, logos chicos, banners
  const PROBE_CONCURRENCY = 6;   // imágenes sin cargar que se miden a la vez (si no hay otra cosa en opciones)
  const BATCH_PAUSE = 1500;      // respiro entre capítulos de un lote, en ms (ídem: el que vale es el de `ritmo`)
  const BATCH_MAX_EMPTY = 3;     // capítulos seguidos "sin páginas" después de los cuales el lote para
  const FAB_MAX_TRIES = 40;      // revisiones de la burbuja antes de dejar de mirar la página
  const HOST_VUELTAS = 20;       // veces que se repone el host en 2 s; pasado eso, la página lo está sacando en serio y se espera

  const store = chrome.storage.local;
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  const offs = [];               // para soltar los listeners globales al limpiar
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    offs.push(() => target.removeEventListener(type, fn, opts));
  }
  function cleanup() {
    offs.splice(0).forEach(f => { try { f(); } catch {} });
    document.querySelectorAll(OURS).forEach(e => e.remove());
  }
  document.querySelectorAll(OURS).forEach(e => e.remove());
  window.__mangaReaderAlive = alive;
  window.__mangaReaderCleanup = cleanup;
  // Lo que el service worker le pide a cada marco de la pestaña: cuántas candidatas tiene (para
  // hablarle al que tiene las páginas y saber cuándo terminó de armarse un capítulo) y, desde la
  // 2.11.4, las direcciones de esas páginas y cuáles ya cargaron (para saber si una imagen que
  // pidió esperar es una página que faltó)
  window.__mangaReaderCuenta = () => ({ n: countCandidates(), ...paginasQueCuenta() });

  // ── En un iframe ────────────────────────────────────
  // Este script corre en la página y en cada uno de sus iframes. Cuando el lector está en un
  // iframe, las páginas están ahí pero el capítulo es el de la página de arriba: su título, su
  // dirección y su sitio. Se le piden por el service worker, que es la única forma de leerlos
  // si el iframe es de otro origen.
  const enMarco = window !== window.top;
  let arriba = null;             // { nombre, capitulo, clave, sitio, titulo } de la página de arriba
  async function pedirArriba() {
    if (!enMarco) return null;
    try { arriba = (await bg({ action: 'contexto' }, 5000)).contexto || null; } catch { arriba = null; }
    return arriba;
  }
  const capituloAca = () => (!arriba ? detectChapter() : arriba.capitulo ? { ...arriba.capitulo, sitio: arriba.sitio } : null);
  const nombreAca = () => (arriba ? arriba.nombre : suggestName());
  const claveAca = () => (arriba ? arriba.clave : pageKey());
  const sitioAca = () => (arriba ? arriba.sitio : location.hostname);

  // ── Dónde vive la interfaz ──────────────────────────
  // El diálogo y la burbuja van adentro del shadow root de un solo elemento, #mr-host, con su
  // hoja de estilos ahí mismo (estilos.js). Sueltos en la página, cualquier regla del sitio
  // los desarmaba: un "div { display: flex }", un "img { max-width: 100% }", un "button {
  // display: none }". El root es abierto para que las pruebas y el programa puedan entrar por
  // document.querySelector('#mr-host').shadowRoot.
  // El estilo del host va en línea y con !important: él sí está en la página, a merced de su CSS.
  const HOST_STYLE = ['all: initial', 'position: fixed', 'top: 0', 'left: 0', 'width: 0', 'height: 0', 'display: block',
    'z-index: 2147483647'].map(d => d + ' !important').join('; ');
  let hostEl = null;
  let hostVigia = null;          // mira si la página saca el host
  let hostVentana = 0, hostEnVentana = 0, hostEspera = null;

  // ¿Hay algo nuestro a la vista? (se pregunta tarde: las variables se declaran más abajo)
  const hayInterfaz = () => !!(saveEl || chapterEl || fabEl);

  function ponerHost() {
    if (!hostEl || hostEl.isConnected) return;
    (document.body || document.documentElement).appendChild(hostEl);
  }

  // Hay sitios que barren de <body> lo que no pusieron ellos. Si el host desaparece con algo
  // adentro, se repone (es el mismo elemento: el diálogo vuelve como estaba). Con tope: si lo
  // sacan más de HOST_VUELTAS veces en 2 segundos es una pelea, y se reintenta recién al rato.
  function vigilarHost() {
    if (hostVigia || typeof MutationObserver === 'undefined') return;
    let mirado = null;
    const reponer = () => {
      if (document.body && document.body !== mirado) { mirado = document.body; hostVigia.observe(mirado, { childList: true }); }   // <body> nuevo
      if (!hostEl || hostEl.isConnected || !hayInterfaz()) return;
      const ahora = Date.now();
      if (ahora - hostVentana > 2000) { hostVentana = ahora; hostEnVentana = 0; }
      if (hostEnVentana++ < HOST_VUELTAS) return ponerHost();
      if (!hostEspera) hostEspera = setTimeout(() => { hostEspera = null; reponer(); }, 2000);
    };
    hostVigia = new MutationObserver(reponer);
    hostVigia.observe(document.documentElement, { childList: true });
    reponer();
    offs.push(() => { hostVigia.disconnect(); hostVigia = null; clearTimeout(hostEspera); });
  }

  // El shadow root donde se inserta la interfaz (crea el host la primera vez)
  function uiRoot() {
    if (!hostEl) {
      hostEl = document.createElement('div');
      hostEl.id = 'mr-host';
      hostEl.style.cssText = HOST_STYLE;
      const root = hostEl.attachShadow({ mode: 'open' });
      // Hoja adoptada: no depende de que la página permita <style> en línea (CSP)
      try { const hoja = new CSSStyleSheet(); hoja.replaceSync(globalThis.MR_CSS || ''); root.adoptedStyleSheets = [hoja]; }
      catch { const st = document.createElement('style'); st.textContent = globalThis.MR_CSS || ''; root.appendChild(st); }
    }
    ponerHost();
    vigilarHost();
    return hostEl.shadowRoot;
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  const fmtSize = (kb) => kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';

  // ── Background messaging ────────────────────────────

  function bg(msg, ms = 40000) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Timeout')), ms);
      chrome.runtime.sendMessage(msg, r => {
        clearTimeout(t);
        if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
        if (!r) return rej(new Error('Sin respuesta'));
        r.ok ? res(r) : rej(new Error(r.error || 'Error'));
      });
    });
  }

  // ── Image helpers ───────────────────────────────────

  // URL absoluta http(s) o '' (descarta placeholders data:/blob:, resuelve rutas relativas)
  function absUrl(u, base = document.baseURI) {
    if (!u || /^(data|blob):/i.test(u)) return '';
    try {
      const a = new URL(u, base).href;
      return /^https?:/i.test(a) ? a : '';
    } catch { return ''; }
  }

  // De un srcset ("a.jpg 800w, b.jpg 1600w") se queda con la imagen más grande
  function srcsetBest(s) {
    let best = '', bestN = -1;
    for (const part of String(s || '').split(',')) {
      const [u, d] = part.trim().split(/\s+/);
      const n = parseFloat(d) || 1;
      if (u && n > bestN) { best = u; bestN = n; }
    }
    return best;
  }

  // URL real de lazy loading (data-src y variantes), si la hay
  function lazyUrl(img) {
    const d = img.dataset || {};
    return absUrl(d.src || d.lazySrc || d.original || srcsetBest(d.srcset || d.lazySrcset));
  }

  function imgUrl(img) {
    const lazy = lazyUrl(img);
    if (lazy && (img.naturalWidth || 0) < MIN_SIDE) return lazy;   // todavía muestra el placeholder
    return absUrl(img.src) || absUrl(img.currentSrc) || lazy;
  }

  // Tamaño real de una imagen (para páginas lazy que todavía muestran el placeholder)
  function probeSize(url, ms = 8000) {
    return new Promise((resolve) => {
      const im = new Image();
      const t = setTimeout(() => { im.src = ''; resolve(null); }, ms);
      im.onload = () => { clearTimeout(t); resolve({ w: im.naturalWidth, h: im.naturalHeight }); };
      im.onerror = () => { clearTimeout(t); resolve(null); };
      im.src = url;
    });
  }

  function urlDir(url) { return url.split(/[?#]/)[0].replace(/[^/]*$/, ''); }

  // ── Adaptadores por sitio ───────────────────────────
  // Donde la detección automática no acierta (las páginas en un bloque raro, rodeadas de tapas
  // de otras series), el usuario dice dónde están con selectores CSS: opciones → "Adaptadores
  // por sitio". Hay uno por host. Con un adaptador, las páginas se buscan ahí y solo ahí.
  let adaptadores = {};           // { host: { contenedor, imagenes, ignorar: [], patron } }
  let adaptadorRoto = '';         // el selector del adaptador que el navegador no entendió, si pasó

  // La carpeta de Descargas donde queda un capítulo, para mostrarla antes de guardar. La arma el
  // service worker con la misma regla (opción "carpeta base": MangaReader si no se dijo otra).
  let carpetaTpl = '';
  const baseDe = (serie) => MR_AJUSTES.aplicarCarpeta(carpetaTpl || MR_AJUSTES.CARPETA_DEFECTO, { sitio: sitioAca(), serie, anio: new Date().getFullYear() });

  // El de este sitio: el de la página o, en un iframe, también el de la página de arriba
  const adaptadorAca = () => adaptadores[location.hostname] || adaptadores[sitioAca()] || null;

  // Las imágenes que señala un adaptador, o null si no dice dónde buscar. Tira un error si
  // alguno de sus selectores es inválido.
  function imagenesConAdaptador(a) {
    if (!a || (!a.contenedor && !a.imagenes)) return null;
    const raices = a.contenedor ? [...document.querySelectorAll(a.contenedor)] : [document];
    let imgs = raices.flatMap(r => [...r.querySelectorAll(a.imagenes || 'img')])
      .flatMap(el => (el.tagName === 'IMG' ? [el] : [...el.querySelectorAll('img')]));      // "imagenes" puede señalar el bloque de cada página
    for (const sel of a.ignorar || []) imgs = imgs.filter(el => !el.matches(sel) && !el.closest(sel));
    return [...new Set(imgs)];
  }

  // De qué imágenes se parte para buscar las páginas: las del adaptador o, si no hay (o sus
  // selectores no sirven), todas las de la página, como siempre.
  function imagenesDeLaPagina() {
    try {
      const r = imagenesConAdaptador(adaptadorAca());
      adaptadorRoto = '';
      if (r) return r;
    } catch (e) { adaptadorRoto = e.message; }
    return [...document.querySelectorAll('img')];
  }

  // ¿Hay un adaptador mandando en esta página? (uno con selectores, y que se entiendan)
  function hayAdaptador() {
    try { return !!imagenesConAdaptador(adaptadorAca()); } catch { return false; }
  }

  // "Probar en esta página", desde opciones: qué encuentra un adaptador acá, sin guardarlo
  function probarAdaptador(a) {
    try {
      const n = globalThis.MR_AJUSTES.normalizarAdaptador(a);
      // Con "páginas dibujadas de fondo": las imágenes de fondo de sus bloques, en su orden (lo mismo que al guardar)
      if (n.fondos) {
        if (n.contenedor) document.querySelectorAll(n.contenedor);            // (un selector inválido tira el error acá)
        const r = fondosDelAdaptador(n);
        const urls = r ? r.adentro.map(c => c.url).filter(u => !/^blob:/i.test(u)) : [];
        return { n: urls.length, urls: urls.slice(0, 3).map(u => (/^data:/i.test(u) ? u.slice(0, 40) + '…' : u)), error: '' };
      }
      const imgs = imagenesConAdaptador(n);
      if (!imgs) return { n: 0, urls: [], error: 'Sin "contenedor" ni "imágenes" no hay dónde buscar' };
      const urls = [...new Set(imgs.map(imgUrl).filter(Boolean))];
      return { n: urls.length, urls: urls.slice(0, 3), error: '' };
    } catch (e) {
      return { n: 0, urls: [], error: 'Selector inválido: ' + e.message };
    }
  }

  // ── Páginas dibujadas de fondo ──────────────────────
  // Hay lectores que no usan <img>: pintan cada página como fondo de un bloque (background-image,
  // a veces con un SVG adentro) o con un <image> de SVG. Sin esto la detección no las ve y se
  // queda con cualquier imagen suelta de la página (en Issuu, 18 tapas de otras publicaciones),
  // que es peor que no encontrar nada porque parece que anduvo. Por eso entran solo cuando no
  // queda ninguna <img> que pueda ser una página, o si el adaptador lo pide; tienen que parecer un
  // lector (una serie de imágenes: 01.png, 02.png…), no los adornos de una página; y el diálogo
  // dice que son páginas dibujadas de fondo, porque es una deducción.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let fondosRecientes = null;      // { cuando, clave, r }: la última lectura rápida de los fondos (para contar seguido sin recorrer la página cada vez)

  // La dirección de una imagen de fondo. Las data: y las blob: quedan tal cual: las data: solo
  // valen adentro del contenedor elegido, y las blob: no se pueden bajar.
  function direccionDeFondo(u, base) {
    const t = String(u || '').trim();
    if (!t) return '';
    if (/^(data|blob):/i.test(t)) return t;
    try { const a = new URL(t, base || document.baseURI).href; return /^https?:/i.test(a) ? a : ''; } catch { return ''; }
  }

  // Las direcciones de un valor de background-image: cada url(…) y, de un image-set(), la de
  // mayor resolución. Los degradés y none no tienen dirección: no cuentan.
  function urlsDeFondo(valor, base) {
    const v = String(valor || '');
    if (!/url\(|image-set\(/i.test(v)) return [];
    // Corta en las comas de afuera, respetando comillas y paréntesis
    const partir = (s) => {
      const out = [];
      let d = 0, q = '', ini = 0;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
        if (c === '"' || c === "'") q = c;
        else if (c === '(') d++;
        else if (c === ')') d--;
        else if (c === ',' && d === 0) { out.push(s.slice(ini, i).trim()); ini = i + 1; }
      }
      out.push(s.slice(ini).trim());
      return out.filter(Boolean);
    };
    // El primer pedazo de un candidato: url(…) o "…"; devuelve [dirección, lo que sigue]
    const primero = (s) => {
      let m = s.match(/^url\(\s*(['"])([\s\S]*?)\1\s*\)/i) || s.match(/^url\(\s*()([^)]*?)\s*\)/i);
      if (!m) m = s.match(/^(['"])([\s\S]*?)\1/);
      return m ? [m[2].replace(/\\(["'\\])/g, '$1'), s.slice(m[0].length)] : ['', s];
    };
    const urls = [];
    for (const capa of partir(v)) {
      if (/^url\(/i.test(capa)) { const u = direccionDeFondo(primero(capa)[0], base); if (u) urls.push(u); continue; }
      const set = capa.match(/^(?:-webkit-)?image-set\(([\s\S]*)\)$/i);
      if (!set) continue;                                   // degradé, none, cross-fade…: sin dirección
      let mejor = '', mejorX = -1;
      for (const cand of partir(set[1])) {
        const [dir, resto] = primero(cand);
        if (!dir) continue;
        const r = resto.match(/(\d*\.?\d+)\s*(x|dppx|dpi|dpcm)\b/i);
        const unidad = r ? r[2].toLowerCase() : 'x';
        const x = !r ? 1 : unidad === 'dpi' ? +r[1] / 96 : unidad === 'dpcm' ? +r[1] * 2.54 / 96 : +r[1];
        if (x > mejorX) { mejor = dir; mejorX = x; }
      }
      const u = direccionDeFondo(mejor, base);
      if (u) urls.push(u);
    }
    return urls;
  }

  // Las imágenes de fondo de un documento (o de un bloque suyo): [{ el, url, i, capa, k }], cada
  // dirección una vez, en el orden del documento (`i` es el lugar del elemento; `capa`, 1 si está en
  // su ::before y 2 si está en su ::after, que se pintan sobre su fondo; `k`, el orden en que se
  // encontró). Salen del estilo calculado de cada elemento y de su ::before y ::after, de los
  // atributos de carga diferida (data-bg y parecidos: la página todavía no se pintó, como data-src
  // en las <img>), de las reglas de las hojas de estilo que se pueden leer (las de otro sitio no) y
  // de los <image> de los SVG en línea. El fondo de <html> y de <body> es el de la página entera.
  // De las reglas vale solo lo que el estilo calculado no muestra (un estado como :hover, una clase
  // que se pone después): un elemento que ya tiene su fondo calculado se queda con ese, como en la
  // cascada, y un @media que no se cumple (la versión @2x, la de imprimir) no cuenta.
  // `rapido`: solo el estilo calculado de cada elemento, los atributos y los <image> de SVG, para
  // contar seguido (la burbuja y el service worker preguntan a cada rato); el diálogo lee todo.
  function fondosDe(doc, raiz, rapido) {
    doc = doc || document;
    raiz = raiz || doc;
    const todos = [...(raiz.nodeType === 1 ? [raiz] : []), ...raiz.querySelectorAll('*')];
    const lugar = new Map(todos.map((el, i) => [el, i]));
    const vistos = new Set(), conFondo = new Set(), out = [];
    const anotar = (el, url, capa = 0) => {
      if (!url || vistos.has(url) || !lugar.has(el)) return;
      vistos.add(url);
      out.push({ el, url, i: lugar.get(el), capa, k: out.length });
    };
    const fuera = (el) => el.localName === 'html' || el.localName === 'body' || !!el.closest(OURS);
    const ver = doc.defaultView || window;
    const DIFERIDA = ['data-bg', 'data-background', 'data-background-image', 'data-bg-src', 'data-lazy-background', 'data-bgset'];
    for (const el of todos) {
      if (fuera(el)) continue;
      [null, '::before', '::after'].slice(0, rapido ? 1 : 3).forEach((pseudo, capa) => {
        let v = '';
        try { v = ver.getComputedStyle(el, pseudo).backgroundImage; } catch {}
        if (!v || v === 'none' || !/url\(|image-set\(/i.test(v)) return;
        conFondo.add(el);
        for (const u of urlsDeFondo(v, doc.baseURI)) anotar(el, u, capa);
      });
      for (const at of DIFERIDA) {
        const v = String(el.getAttribute(at) || '').trim();
        if (v) anotar(el, /url\(|image-set\(/i.test(v) ? urlsDeFondo(v, doc.baseURI)[0] : direccionDeFondo(v.split(/[\s,]+/)[0], doc.baseURI));
      }
      if (el.localName === 'image' && el.namespaceURI === SVG_NS) {
        anotar(el, direccionDeFondo(el.getAttribute('href') || el.getAttribute('xlink:href'), doc.baseURI));
      }
    }
    if (!rapido) {
      const recorrer = (reglas, base) => {
        for (const r of reglas) {
          if (r.styleSheet) { try { recorrer(r.styleSheet.cssRules, r.styleSheet.href || base); } catch {} continue; }      // @import
          if (r.cssRules && !r.selectorText) {                                                                              // @media, @supports, @layer
            const m = r.media && r.media.mediaText;
            if (m && typeof ver.matchMedia === 'function' && !ver.matchMedia(m).matches) continue;
            try { recorrer(r.cssRules, base); } catch {}
            continue;
          }
          const v = (r.style && r.style.backgroundImage) || '';
          if (!r.selectorText || !/url\(|image-set\(/i.test(v)) continue;
          const sel = r.selectorText.replace(/::?(?:before|after|hover|focus-within|focus-visible|focus|active|visited|link|first-line|first-letter)\b/gi, '').trim();
          let els = [];
          try { els = sel ? raiz.querySelectorAll(sel) : []; } catch { continue; }
          for (const el of els) if (!fuera(el) && !conFondo.has(el)) for (const u of urlsDeFondo(v, base)) anotar(el, u);
        }
      };
      for (const hoja of doc.styleSheets || []) {
        let reglas = null;
        try { reglas = hoja.cssRules; } catch {}           // de otro sitio: no se puede leer
        if (reglas) recorrer(reglas, hoja.href || doc.baseURI);
      }
    }
    return out.sort((a, b) => a.i - b.i || a.k - b.k);
  }

  // La serie de una imagen de fondo: su dirección con los números (y los códigos de 12 letras o más
  // que tienen números, sin contar la palabra de adelante: logo-Bx3kQ9_z.png y header-D4fT7aQ1.png,
  // los nombres que pone un empaquetador, son dos series) cambiados por #. Las páginas de un capítulo son una serie (cap/7/01.png, cap/7/02.png…;
  // page_1.svg; códigos en una carpeta; cap/7/3/full.webp; imagen.php?cap=7&p=3); los adornos de una
  // página no: una dirección sin ningún número no es de ninguna serie ('': logo.png, lupa.svg,
  // facebook.svg). La consulta cuenta solo si la ruta no tiene números (así ?w=20 no separa una
  // página de su miniatura borrosa). Las data: son la serie 'data:' y las blob:, 'blob:'.
  function serieDeFondo(url) {
    if (/^data:/i.test(url)) return 'data:';
    if (/^blob:/i.test(url)) return 'blob:';
    let u;
    try { u = new URL(url); } catch { return ''; }
    const comun = (s) => s.replace(/(?=[A-Za-z0-9_]*\d)[A-Za-z0-9_]{12,}/g, '#').replace(/\d+/g, '#');
    if (/\d/.test(u.pathname)) return comun(u.host) + comun(u.pathname);
    if (/\d/.test(u.search)) return comun(u.host) + u.pathname + comun(u.search);
    return '';
  }

  // El bloque que concentra las páginas de fondo de una serie: el más de adentro que tiene al menos
  // ocho de cada diez (las páginas de un lector están juntas, aunque vengan en tandas de a varias).
  // Devuelve el elemento, o null si no hay ninguna.
  function contenedorDeFondos(cands) {
    if (!cands.length) return null;
    const cuenta = new Map();
    for (const c of cands) for (let e = c.el.parentElement; e; e = e.parentElement) cuenta.set(e, (cuenta.get(e) || 0) + 1);
    let mejor = null, hondo = -1;
    for (const [e, n] of cuenta) {
      if (n < cands.length * 0.8) continue;
      let h = 0;
      for (let x = e; x; x = x.parentElement) h++;
      if (h > hondo) { mejor = e; hondo = h; }
    }
    return mejor;
  }

  // De una página dibujada dos veces queda la de arriba: si un bloque con imagen tiene adentro otro
  // con imagen, el de adentro (la página entera sobre su miniatura borrosa); en un mismo bloque, la
  // del ::after, después la del ::before, después la primera capa de su fondo.
  const unaPorPagina = (cands) => cands.filter(c => !cands.some(o => o !== c && ((o.el !== c.el && c.el.contains(o.el)) || (o.el === c.el && ((o.capa || 0) > (c.capa || 0) || ((o.capa || 0) === (c.capa || 0) && o.k < c.k))))));
  const sinRellenos = (cands) => cands.filter(c => !(/^data:/i.test(c.url) && c.url.length < 20000));     // un ícono incrustado, no un escaneo

  // El link de la tarjeta de una imagen de fondo: el que la envuelve o, si no, el de su tarjeta: el
  // bloque más chico, desde ella misma hasta cuatro niveles más arriba, que tiene links, siempre que
  // no junte otras imágenes de su misma serie (las páginas de un lector están juntas: no tienen
  // tarjeta propia) y que sus links vayan todos al mismo lugar. La tarjeta puede tener otras imágenes
  // (la foto y el avatar de una nota). null si no tiene. `serie`: los elementos de su serie.
  function linkDeTarjeta(el, serie) {
    const propio = el.closest('a[href]');
    if (propio) return propio;
    let t = el;
    for (let k = 0; k <= 4 && t; k++, t = t.parentElement) {
      if (k && serie.some(o => o !== el && !el.contains(o) && t.contains(o))) return null;
      const links = [...t.querySelectorAll('a[href]')];
      if (!links.length) continue;
      const lugares = new Set(links.map(a => noSlash(String(a.href).split('#')[0])));
      return lugares.size === 1 ? links[0] : null;
    }
    return null;
  }

  // ¿El link que envuelve a una imagen dice que no es una página? Si lleva a otro sitio (un
  // recomendado patrocinado) o a otra parte de esta misma página (una tira de miniaturas para saltar
  // de página). Un link a la imagen en grande no cuenta.
  function linkQueNoEsPagina(a) {
    if (!a) return false;
    try {
      const u = new URL(a.href, document.baseURI);
      if (!/^https?:$/i.test(u.protocol) || /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(u.pathname)) return false;
      if (u.origin !== location.origin) return true;
      const sin = (x) => noSlash(String(x).split('#')[0]);
      return sin(u.href) === sin(location.href) && u.hash.length > 1 && !/^#!?\//.test(u.hash);
    } catch { return false; }
  }

  // Las páginas de fondo que encuentra la detección automática: { cont, adentro, fuerte } o null.
  //  1. Se agrupan por serie. De cada serie se sacan las que no son páginas: las que llevan a otro
  //     sitio o a otra parte de esta página, y las tapas (tres o más cuyo link, el que las envuelve o
  //     el de su tarjeta, lleva a páginas distintas del sitio: las tarjetas de un listado).
  //  2. Entra la serie que parece un lector: dos o más, sin direcciones data: ni de miniaturas
  //     (thumbs, mini, blur…); entre esas, la más grande; a igualdad, la que se pinta más arriba. Y
  //     tiene que estar junta en un bloque, no desparramada por toda la página.
  //     Una serie data: solo entra si no hay una con dirección (Issuu pone el mismo escaneo como
  //     data: adentro de la página que pinta de fondo).
  //  3. De esa serie, lo que está en el bloque que la concentra, una imagen por página (la de
  //     arriba), más lo que esté en su misma carpeta y en ese bloque aunque no tenga número (la tapa
  //     del capítulo, los créditos), en el orden del documento.
  // `fuerte`: dos o más, como un lector. Si no, es una sola imagen (la única con número, o la única
  // imagen de fondo), que solo vale en un iframe (el lector de Issuu muestra de a una página).
  function fondosDelContenedor(cands) {
    cands = sinRellenos(cands);
    const grupos = new Map(), solas = [];
    for (const c of cands) {
      const k = serieDeFondo(c.url);
      if (k) (grupos.get(k) || grupos.set(k, []).get(k)).push(c); else solas.push(c);
    }
    let conTapas = false;
    for (const [k, g] of [...grupos]) {
      const els = g.map(c => c.el);
      let quedan = g.filter(c => !linkQueNoEsPagina(c.el.closest('a[href]')));
      const destinos = quedan.map(c => { const a = typeof linkDeTarjeta === 'function' ? linkDeTarjeta(c.el, els) : null; return a ? destinoDeTapa(a) : ''; });
      const tapas = destinos.filter(Boolean);
      if (tapas.length >= 3 && new Set(tapas).size >= Math.max(3, tapas.length * 0.8)) { conTapas = true; quedan = quedan.filter((c, i) => !destinos[i]); }
      if (quedan.length) grupos.set(k, quedan); else grupos.delete(k);
    }
    const capa = (c) => { let n = 0; for (let x = c.el; x; x = x.parentElement) n++; return n * 3 + (c.capa || 0); };
    const miniatura = (g) => /(?:^|[\/_.-])(?:thumbs?|thumbnails?|minis?|small|preview|blur|lqip|placeholder)(?:[\/_.\-]|$)/i.test(g[0].url.split('?')[0]);
    const nota = (g) => {
      const datos = /^data:/i.test(g[0].url), mini = miniatura(g);
      return [!datos && !mini && g.length >= 2 ? 1 : 0, g.length, datos ? 0 : 1, mini ? 0 : 1, g.reduce((s, c) => s + capa(c), 0) / g.length];
    };
    const gana = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
    const ordenadas = [...grupos.values()].map(g => ({ g, n: nota(g) })).sort((a, b) => (gana(a.n, b.n) ? -1 : gana(b.n, a.n) ? 1 : 0));
    // Las páginas de un lector están juntas en un bloque: una serie desparramada por toda la página
    // (el bloque que la junta es el <body>: el logo en el encabezado, la lupa, el pie) es de adornos,
    // aunque tenga números. Vale si son hijas directas del <body> (un lector de una página sola).
    let mejor = null, cont = null;
    for (const { g } of ordenadas) {
      const c = contenedorDeFondos(g);
      if (!c || (/^(?:body|html)$/.test(c.localName) && !g.every(x => x.el.parentElement === c))) continue;
      mejor = g; cont = c;
      break;
    }
    if (!mejor) {
      // ninguna con número: vale solo si es la única imagen de fondo (y no hay tapas alrededor)
      const sueltas = solas.filter(c => !/^data:/i.test(c.url));
      return sueltas.length === 1 && !conTapas ? { cont: sueltas[0].el.parentElement, adentro: sueltas, fuerte: false } : null;
    }
    let adentro = mejor.filter(c => cont.contains(c.el));
    const deLaSerie = unaPorPagina(adentro).length;
    // (lo que no tiene número se suma solo a un lector: a una imagen suelta no la hace una serie)
    const carpeta = deLaSerie >= 2 && /^https?:/i.test(adentro[0]?.url || '') ? urlDir(adentro[0].url) : '';
    const sinNumero = (u) => !/\d/.test(u.split(/[?#]/)[0].replace(/^.*\//, ''));
    if (carpeta) adentro = adentro.concat(cands.filter(c => !mejor.includes(c) && cont.contains(c.el) && /^https?:/i.test(c.url) && urlDir(c.url) === carpeta && sinNumero(c.url)));
    adentro = unaPorPagina(adentro).sort((a, b) => a.i - b.i || a.k - b.k);
    return adentro.length ? { cont, adentro, fuerte: deLaSerie >= 2 } : null;
  }

  // Con un adaptador que pide los fondos no se filtra nada: entran las imágenes de fondo de todos
  // los bloques que señale "contenedor" (o de la página), en su orden, una por página, salvo lo que
  // diga "ignorar" y, si dice "imágenes", solo las de esos elementos. { cont, adentro, fuerte } o null.
  function fondosDelAdaptador(a, rapido) {
    let raices = [document];
    if (a.contenedor) { try { raices = [...document.querySelectorAll(a.contenedor)]; } catch { raices = []; } }
    raices = raices.filter(r => !raices.some(o => o !== r && o.contains(r)));       // un bloque adentro de otro ya está
    let cands = raices.flatMap(r => fondosDe(document, r, rapido));
    const cumple = (el, sel) => { try { return el.matches(sel) || !!el.closest(sel); } catch { return false; } };
    for (const sel of a.ignorar || []) cands = cands.filter(c => !cumple(c.el, sel));
    if (a.imagenes) cands = cands.filter(c => cumple(c.el, a.imagenes));
    const vistas = new Set();
    cands = unaPorPagina(sinRellenos(cands)).filter(c => !vistas.has(c.url) && vistas.add(c.url));
    return cands.length ? { cont: null, adentro: cands, fuerte: cands.length >= 2 } : null;
  }

  // ¿Esta página está adentro de otra (un iframe)? (las funciones sueltas que usa el programa no tienen enMarco)
  function marcoHijo() {
    if (typeof enMarco === 'boolean') return enMarco;
    try { return window.self !== window.top; } catch { return true; }
  }

  // ¿El marco tiene el tamaño de un lector? Los avisos en iframes son chicos (300×250, 728×90, 300×600)
  function marcoGrande() {
    try { return window.innerWidth >= 400 && window.innerHeight >= 400; } catch { return false; }
  }

  // ¿La página tiene un iframe grande (de 400 × 400 o más)? Ahí puede estar el lector.
  function hayMarcoGrande() {
    for (const f of document.querySelectorAll('iframe, frame')) {
      const c = f.getBoundingClientRect();
      if (c.width >= 400 && c.height >= 400) return true;
    }
    return false;
  }

  // ¿Valen acá las páginas de fondo que se encontraron? En la página, si son un lector (dos o más de
  // una serie); en un iframe, si el marco es grande como un lector (ahí vale también una sola: el de
  // Issuu muestra de a una página) y no es un reproductor de video (su póster va de fondo).
  function fondoValeAca(r) {
    if (!r) return false;
    if (!marcoHijo()) return r.fuerte;
    return marcoGrande() && !document.querySelector('video');
  }

  // Las páginas dibujadas de fondo de este documento, ya medidas (y de paso, comprobado que se
  // pueden leer): { pages, failed, faltantes, locked, fondo: true, total, fuerte } o null si no hay.
  // `adaptador`: el que pide los fondos, si lo hay. (faltantes, desde la 2.11.4: las que no cargaron)
  async function paginasDeFondo(adaptador) {
    const r = adaptador ? fondosDelAdaptador(adaptador) : fondosDelContenedor(fondosDe(document, document));
    if (!r) return null;
    const legibles = r.adentro.filter(c => !/^blob:/i.test(c.url));
    const medidas = new Array(legibles.length);
    let next = 0;
    const aLaVez = typeof ritmo === 'object' && ritmo ? ritmo.concurrencia : PROBE_CONCURRENCY;
    await Promise.all(Array.from({ length: Math.min(aLaVez, legibles.length) }, async () => {
      while (next < legibles.length) {
        const k = next++;
        medidas[k] = await probeSize(legibles[k].url);
      }
    }));
    // Sin el lado mínimo: una página dibujada de fondo puede no tener caja propia, y su imagen
    // (un SVG, por ejemplo) puede no decir su tamaño. Vale que se haya podido cargar.
    const pages = [];
    legibles.forEach((c, k) => { if (medidas[k]) pages.push({ url: c.url, w: medidas[k].w, h: medidas[k].h, external: false, flag: '' }); });
    const faltantes = legibles.filter((c, k) => !medidas[k]).map(c => c.url);
    return { pages, failed: faltantes.length, faltantes, locked: !pages.length, fondo: true, total: r.adentro.length, fuerte: r.fuerte };
  }

  // ¿Hay un iframe grande, del mismo sitio, con un lector de fondo? Issuu pone el lector en uno.
  // Vale uno de dos o más páginas de una serie, o uno que muestra de a una página (con número en
  // la dirección) si el iframe es una página del sitio: un about:blank con una imagen de fondo es
  // como se ponen muchos avisos, y un reproductor de video tiene su póster de fondo. Los iframes de
  // otro sitio no se pueden mirar desde acá: entre esos decide el service worker, por lo que cuenta
  // cada marco.
  function lectorDeFondoEnMarcos() {
    for (const f of document.querySelectorAll('iframe, frame')) {
      const caja = f.getBoundingClientRect();
      if (caja.width < 400 || caja.height < 400) continue;
      let doc = null;
      try { doc = f.contentDocument; } catch {}
      if (!doc || !doc.documentElement || doc.querySelector('video')) continue;
      // un lector de fondo no tiene páginas en <img>: si el iframe las tiene, es otra cosa
      if ([...doc.images].some(i => i.naturalWidth >= MIN_SIDE && i.naturalHeight >= MIN_SIDE)) continue;
      const r = fondosDelContenedor(fondosDe(doc, doc, true));
      if (r && (r.fuerte || (/^https?:/i.test(doc.URL || '') && serieDeFondo(r.adentro[0].url)))) return true;
    }
    return false;
  }

  // ¿Van las páginas de fondo en lugar de las <img>? Cuando el adaptador lo pide; o, sin
  // adaptador, solo si no quedó ninguna <img> que pueda ser una página (las tapas de otras cosas
  // y lo que el filtro marcó no cuentan): con candidatas de las dos clases, ganan las <img>. Y un
  // lector de fondo tiene que parecerlo (fondoValeAca). Si el lector de fondo está en un iframe del
  // mismo sitio, acá no hay nada que ofrecer: el diálogo dice que no encontró páginas.
  // Devuelve lo que tiene que devolver collectPages, o null para seguir con las <img>.
  // (recibe un objeto y lo desarma adentro: el programa saca esta función con un extractor que
  // toma la primera llave como comienzo del cuerpo)
  async function elegirFondo(datos) {
    const { pages, mainDir, adaptado, locked } = datos;
    const a = typeof adaptadorAca === 'function' ? adaptadorAca() : null;
    if (a && a.fondos) {
      // con el adaptador no se filtra nada: si no hay fondos, valen las <img> que señale
      const fondo = await paginasDeFondo(a);
      return fondo && fondo.pages.length ? fondo : null;
    }
    if (adaptado || mainDir || locked || pages.some(p => !p.flag)) return null;
    const fondo = await paginasDeFondo();
    if (fondoValeAca(fondo)) return fondo;
    if (lectorDeFondoEnMarcos()) return { pages: [], failed: 0, locked: true, fondo: true, total: 0 };
    return null;
  }

  // Cuántas páginas de fondo cuenta este marco, sin medirlas (para el service worker y la
  // burbuja, que preguntan seguido). Para la burbuja, la lectura rápida de la página se recuerda
  // dos segundos; para el service worker (`fresco`) se lee cada vez: el lote espera a que el
  // número deje de cambiar, y un número recordado lo engañaría.
  // `n`: lo que contaron las <img> (las de la carpeta con más); `total`: todas las <img> grandes.
  // Devuelve lo que tiene que contar el marco: con <img> que cuentan, esas; si no, un lector de
  // fondo (o una sola imagen de fondo, en un iframe). Con pocas <img> sueltas (menos de 3 en total)
  // y un lector de fondo en un iframe del mismo sitio, 0: el capítulo está en el iframe.
  function cuentaDeFondo(n, adaptado, total, fresco) {
    const a = typeof adaptadorAca === 'function' ? adaptadorAca() : null;
    const clave = a && a.fondos ? JSON.stringify(a) : '';
    const ahora = Date.now();
    if (fresco || !fondosRecientes || fondosRecientes.clave !== clave || ahora - fondosRecientes.cuando > 2000) {
      fondosRecientes = { cuando: ahora, clave, r: a && a.fondos ? fondosDelAdaptador(a, true) : fondosDelContenedor(fondosDe(document, document, true)) };
    }
    const r = fondosRecientes.r;
    const legibles = r ? r.adentro.filter(c => !/^blob:/i.test(c.url)).length : 0;
    if (a && a.fondos) return legibles || n;
    if (adaptado) return n;
    // (en la página de arriba, dos páginas de fondo no le compiten a un iframe grande: puede ser
    // un lector en <img> de otro sitio, que cuenta lo suyo)
    if (!n && fondoValeAca(r)) return !marcoHijo() && legibles < 3 && hayMarcoGrande() ? 0 : legibles;
    if (n && (total ?? n) < 3 && lectorDeFondoEnMarcos()) return 0;          // el capítulo está en el iframe: este marco no compite
    return n;
  }

  // ── Tapas de otras cosas ────────────────────────────
  // A dónde lleva una imagen (una <img>, o un bloque con imagen de fondo) si es una tapa: un link
  // (que la envuelve) a otra página del mismo sitio, que no es una imagen ni esta misma página. Un
  // listado en /manga cuyas tapas llevan a /manga/obra-12 también son tapas. Sin el #, salvo en las
  // aplicaciones que arman sus páginas con él (#/obra/12). '' si no lo es.
  function destinoDeTapa(el) {
    const a = el.closest('a[href]');
    if (!a) return '';
    try {
      const u = new URL(a.href, document.baseURI);
      if (u.origin !== location.origin || /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(u.pathname)) return '';
      const sin = (x) => { const v = new URL(x, document.baseURI); return noSlash(v.origin + v.pathname + v.search + (/^#!?\//.test(v.hash) ? v.hash : '')); };
      const destino = sin(u.href);
      return destino === sin(location.href) ? '' : destino;
    } catch { return ''; }
  }

  // ¿Estas imágenes son una grilla de tapas? Tres o más tapas (imágenes que llevan a otra página
  // del sitio), que son casi todas las imágenes (nueve de cada diez) y llevan casi todas a páginas
  // distintas: la portada de un sitio, un listado, o las tapas de "más publicaciones" alrededor de
  // un lector (en Issuu, antes de que cargue el iframe del lector, es lo único que hay, junto con
  // la imagen de un menú). No son un capítulo y no se ofrecen como si lo fueran. Solo se mira
  // cuando las imágenes no arman un capítulo: un capítulo de verdad tiene su carpeta. Con menos
  // tapas (una página de un lector de a una y tres "relacionados") se ofrecen todas, como siempre.
  // `destinos`: el de cada imagen suelta ('' si no es una tapa).
  function esGrillaDeTapas(destinos) {
    const tapas = destinos.filter(Boolean);
    return tapas.length >= 3 && tapas.length >= destinos.length * 0.9 && new Set(tapas).size >= Math.max(3, tapas.length * 0.8);
  }

  // ── Detección de páginas ────────────────────────────
  // Devuelve { pages: [{url, w, h, external, flag}], failed } en orden de lectura (orden
  // del DOM), sin duplicados. flag = '' si es página del capítulo, o el motivo por el que
  // se sospecha que no lo es. failed = páginas del capítulo que no se pudieron cargar.
  // locked = true si el lector muestra las páginas como imágenes blob:, que no tienen una
  // dirección para bajar. Esas no se guardan, y lo que queda a la vista (logos, banners)
  // tampoco es el capítulo: viene destildado para no guardarlo como si lo fuera. No hay
  // un aviso especial: el diálogo dice que no encontró páginas. Los <canvas> no se cuentan.

  async function collectPages() {
    const seen = new Set();
    const entries = [];
    const failedUrls = [];
    let lockedCount = 0;
    // Con un adaptador del sitio no se filtra nada, tampoco por tamaño: lo que señalan sus
    // selectores son las páginas (las tiras de un webtoon no llegan al lado mínimo). Lo que no
    // sea página se saca con "ignorar".
    const adaptado = typeof hayAdaptador === 'function' && hayAdaptador();
    const big = (w, h) => (adaptado ? w > 0 && h > 0 : w >= MIN_SIDE && h >= MIN_SIDE);
    for (const img of (typeof imagenesDeLaPagina === 'function' ? imagenesDeLaPagina() : document.querySelectorAll('img'))) {
      if (img.closest(OURS)) continue;
      if (/^blob:/i.test(img.currentSrc || img.src || '')) {
        if (!img.complete || big(img.naturalWidth, img.naturalHeight)) lockedCount++;     // cargando o grande
        continue;
      }
      const url = imgUrl(img);
      if (!url || seen.has(url)) continue;
      const link = img.closest('a[href]');
      let external = false;
      try { external = !!link && new URL(link.href, document.baseURI).origin !== location.origin; } catch {}
      const tapa = typeof destinoDeTapa === 'function' ? destinoDeTapa(img) : '';

      // Lazy pendiente (data-src) o imagen que el navegador todavía no bajó (loading="lazy"):
      // se mide la imagen real, y de paso queda cargada
      const lazyPending = url === lazyUrl(img) && (img.naturalWidth || 0) < MIN_SIDE;
      if (lazyPending || !img.complete) {
        seen.add(url);
        entries.push({ url, external, tapa, probe: true });
        continue;
      }
      if (!img.naturalWidth) { seen.add(url); failedUrls.push(url); continue; }   // imagen rota
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (big(w, h)) {
        seen.add(url);
        entries.push({ url, external, tapa, w, h });
      }
    }

    // Las que faltan medir se cargan de a pocas: todas juntas, con una conexión lenta
    // las últimas se quedan sin tiempo y cuentan como caídas sin estarlo.
    const pending = entries.filter(e => e.probe);
    let next = 0;
    // (el programa usa esta función sin el resto del archivo: ahí no hay `ritmo` y vale la constante)
    const aLaVez = typeof ritmo === 'object' && ritmo ? ritmo.concurrencia : PROBE_CONCURRENCY;
    await Promise.all(Array.from({ length: Math.min(aLaVez, pending.length) }, async () => {
      while (next < pending.length) {
        const e = pending[next++];
        e.size = await probeSize(e.url);
      }
    }));

    const pages = [];
    for (const e of entries) {
      if (e.probe) {
        if (!e.size) { failedUrls.push(e.url); continue; }          // no cargó (error o timeout)
        if (!big(e.size.w, e.size.h)) continue;
        e.w = e.size.w; e.h = e.size.h;
      }
      pages.push({ url: e.url, w: e.w, h: e.h, external: e.external, flag: '', ...(e.tapa ? { tapa: e.tapa } : {}) });
    }
    const mainDir = adaptado ? null : flagNonPages(pages);
    // Sin un capítulo en <img>: ¿son una grilla de tapas?
    let tapas = false;
    if (!adaptado && !mainDir && typeof esGrillaDeTapas === 'function' && esGrillaDeTapas(pages.filter(p => !p.flag).map(p => p.tapa || ''))) {
      for (const p of pages) p.flag ||= 'tapa de otra página del sitio';
      tapas = true;
    }
    // Solo cuentan como "faltantes" las que fallaron dentro de la carpeta del capítulo
    // (un banner o pixel roto del sitio no es una página perdida)
    // (`faltantes`, desde la 2.11.4: cuáles son, para decir por qué no cargaron si se sabe)
    const faltantes = adaptado ? failedUrls : mainDir ? failedUrls.filter(u => urlDir(u) === mainDir) : [];
    const failed = faltantes.length;
    // Páginas sin dirección: al menos 2, y lo que se encontró no arma un capítulo (no hay una
    // carpeta con la mayoría de las imágenes) o es menos que esas
    const locked = lockedCount >= 2 && ((!mainDir && !adaptado) || lockedCount >= pages.filter(p => !p.flag).length);
    if (locked) for (const p of pages) p.flag ||= 'no parece una página del capítulo';
    // No quedó ninguna <img> que pueda ser una página: ¿están dibujadas de fondo? (el programa
    // usa esta función suelta: si no tiene elegirFondo, sigue como siempre)
    const deFondo = typeof elegirFondo === 'function' ? await elegirFondo({ pages, mainDir, adaptado, locked }) : null;
    if (deFondo) return deFondo;
    // Una grilla de tapas no es el capítulo: se muestran destildadas y el diálogo dice que no encontró páginas
    return tapas ? { pages, failed, faltantes, locked: true, tapas: true } : { pages, failed, faltantes, locked };
  }

  // Las imágenes que la página pidió y el sitio contestó con 429 o 503, según el registro de tiempos
  // de la página (Resource Timing). Se anotan apenas llegan: ese registro se llena (250 entradas) y
  // lo que viene después ya no se puede buscar.
  const esperasVistas = new Map();          // dirección → 429 o 503
  try {
    const obs = new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) if (e.responseStatus === 429 || e.responseStatus === 503) esperasVistas.set(e.name, e.responseStatus);
    });
    obs.observe({ type: 'resource', buffered: true });
    offs.push(() => obs.disconnect());
  } catch {}

  // Por qué no cargaron estas páginas, si se sabe (2.11.4): el código 429 o 503 con que contestó el
  // sitio cuando la página las pidió, o 0. Sale del registro de tiempos de la página, que tiene el
  // código de las imágenes del mismo sitio (o de otro que lo permite); de otro sitio da 0 y no se
  // sabe. Lo usa el diálogo de guardar, que no corta nada: solo lo dice.
  function codigoDeEspera(urls) {
    for (const u of urls || []) {
      let es = [];
      try { es = performance.getEntriesByName(u); } catch {}
      const s = esperasVistas.get(u) || (es.length ? es[es.length - 1].responseStatus : 0);
      if (s === 429 || s === 503) return s;
    }
    return 0;
  }

  // Marca lo que probablemente no es una página del capítulo
  function flagNonPages(pages) {
    if (pages.length < 3) return null;

    // 1) Carpeta del capítulo = la carpeta donde está la mayoría de las imágenes
    const count = new Map();
    for (const p of pages) count.set(urlDir(p.url), (count.get(urlDir(p.url)) || 0) + 1);
    const [mainDir, mainCount] = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    const hasMainDir = mainCount >= 3 && mainCount >= pages.length * 0.5;

    // Un link a otro sitio delata un aviso… salvo que lo tenga la mayoría de las imágenes:
    // ahí es el lector el que envuelve cada página en un link (por ejemplo, a su CDN).
    const linkRule = pages.filter(p => p.external).length <= pages.length / 2;

    for (const p of pages) {
      if (linkRule && p.external) p.flag = 'enlace a otro sitio';
      else if (hasMainDir && urlDir(p.url) !== mainDir) p.flag = 'fuera de la carpeta del capítulo';
      else if (/\.gif$/i.test(p.url.split(/[?#]/)[0])) p.flag = 'GIF animado';
    }

    // 2) Últimas páginas con formato distinto al del resto (créditos / publicidad del scan)
    const good = pages.filter(p => !p.flag);
    if (good.length < 5) return hasMainDir ? mainDir : null;
    const ratios = good.map(p => p.w / p.h).sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    const fits = (p) => {
      const q = (p.w / p.h) / median;
      return (q > 0.75 && q < 1.33)      // página normal
          || (q > 1.6 && q < 2.4)        // doble página
          || (q > 0.42 && q < 0.6);      // página simple cuando la mayoría son dobles
    };
    // En tiras largas (webtoon) el alto de cada imagen varía: no hay un "formato" que comparar.
    // Tampoco si menos de dos tercios de las páginas se parecen entre sí.
    const uniform = median >= 0.4 && good.filter(fits).length >= good.length * 0.66;
    if (uniform) {
      for (let i = good.length - 1; i >= Math.max(0, good.length - 3); i--) {
        if (fits(good[i])) break;          // solo la cola contigua
        good[i].flag = 'formato distinto al resto';
      }
    }
    return hasMainDir ? mainDir : null;
  }

  // Cantidad de imágenes en la carpeta más poblada, cargadas o no. La usa la descarga de
  // varios capítulos para saber cuándo un capítulo abierto en otra pestaña terminó de armarse.
  // `soloImagenes`: lo que cuentan las <img>, sin mirar los fondos (para el guardado de un lote).
  function countCandidates(soloImagenes) {
    // Con un adaptador cuentan todas las que señala: del tamaño que sean y estén en la carpeta
    // que estén (hay sitios que ponen cada página en una carpeta distinta)
    const adaptado = typeof hayAdaptador === 'function' && hayAdaptador();
    const dirs = new Map(), destinos = [];
    for (const img of (typeof imagenesDeLaPagina === 'function' ? imagenesDeLaPagina() : document.querySelectorAll('img'))) {
      if (img.closest(OURS)) continue;
      const url = imgUrl(img);
      if (!url) continue;
      if (!adaptado && img.complete && img.naturalWidth && (img.naturalWidth < MIN_SIDE || img.naturalHeight < MIN_SIDE)) continue;
      const d = urlDir(url);
      dirs.set(d, (dirs.get(d) || 0) + 1);
      if (!adaptado && typeof destinoDeTapa === 'function') destinos.push(destinoDeTapa(img));
    }
    let n = adaptado ? [...dirs.values()].reduce((a, b) => a + b, 0) : Math.max(0, ...dirs.values());
    // Una grilla de tapas no es un capítulo: este marco no compite por el diálogo con ellas. Se mira
    // cuando las imágenes no arman la carpeta de un capítulo, con la misma regla que collectPages
    // (flagNonPages): 3 o más en una carpeta que junte la mitad. (Hasta la 2.11.3, solo con menos de
    // 3: unas tapas que compartían carpeta —las subidas de un mes— contaban como el capítulo.)
    const todas = [...dirs.values()].reduce((a, b) => a + b, 0);
    if (!adaptado && (n < 3 || n < todas * 0.5) && typeof esGrillaDeTapas === 'function' && esGrillaDeTapas(destinos)) n = 0;
    if (soloImagenes) return n;
    // Sin un capítulo en <img> (o si el adaptador pide los fondos), lo que cuenta es el lector de
    // fondo, si lo hay: así el service worker le habla al marco que tiene las páginas
    const pideFondos = typeof adaptadorAca === 'function' && !!(adaptadorAca() || {}).fondos;
    if (typeof cuentaDeFondo === 'function' && (pideFondos || (!adaptado && n < 3))) return cuentaDeFondo(n, adaptado, [...dirs.values()].reduce((a, b) => a + b, 0), true);
    return n;
  }

  // Las páginas que cuenta este marco, para el service worker (2.11.4): { urls, pedidas, cargadas,
  // adaptado }. urls son las <img> de la carpeta más poblada (todas, con un adaptador), cargadas o no:
  // también las rotas y las que todavía muestran el marcador de la carga diferida, como las mide
  // collectPages. O, si lo que cuenta el marco es su lector de fondo (sin un capítulo en <img>, o con
  // un adaptador que pide los fondos), las de fondo de la última lectura rápida. pedidas: la dirección
  // que el navegador pidió de verdad para cada una, si es otra (srcset). cargadas: las que ya cargaron;
  // de las de fondo no se sabe (lo sabe el service worker, que vio las respuestas).
  function paginasQueCuenta() {
    const adaptado = typeof hayAdaptador === 'function' && hayAdaptador();
    const porCarpeta = new Map();
    for (const img of (typeof imagenesDeLaPagina === 'function' ? imagenesDeLaPagina() : document.querySelectorAll('img'))) {
      if (img.closest(OURS)) continue;
      const url = imgUrl(img);
      if (!url || /^(data|blob):/i.test(url)) continue;
      const pendiente = url === lazyUrl(img) && (img.naturalWidth || 0) < MIN_SIDE;     // muestra el marcador: no cargó
      if (!adaptado && !pendiente && img.complete && img.naturalWidth && (img.naturalWidth < MIN_SIDE || img.naturalHeight < MIN_SIDE)) continue;
      const pedida = pendiente ? '' : absUrl(img.currentSrc) || absUrl(img.src) || '';
      const d = urlDir(url);
      if (!porCarpeta.has(d)) porCarpeta.set(d, []);
      porCarpeta.get(d).push({ url, pedida, cargada: !pendiente && img.complete && img.naturalWidth > 0 });
    }
    const grupos = [...porCarpeta.values()];
    let paginas = adaptado ? grupos.flat() : grupos.sort((a, b) => b.length - a.length)[0] || [];
    const pideFondos = typeof adaptadorAca === 'function' && !!(adaptadorAca() || {}).fondos;
    const r = fondosRecientes && fondosRecientes.r;
    if ((pideFondos || (!adaptado && paginas.length < 3)) && r?.adentro?.length) {
      const deFondo = r.adentro.filter(c => /^https?:/i.test(c.url));
      if (deFondo.length) paginas = deFondo.map(c => ({ url: c.url, pedida: '', cargada: false }));
    }
    const urls = [...new Set(paginas.map(p => p.url))];
    return {
      urls,
      pedidas: [...new Set(paginas.map(p => p.pedida).filter(u => u && !urls.includes(u)))],
      cargadas: [...new Set(paginas.filter(p => p.cargada).flatMap(p => [p.url, p.pedida]).filter(Boolean))],
      adaptado,
    };
  }

  // ── Nombres de archivo ──────────────────────────────

  function sanitizeSegment(s) {
    let out = s
      .replace(/[<>:"\\|?*\x00-\x1F]/g, ' ')   // caracteres prohibidos en Windows
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .replace(/[.\s]+$/, '')
      .substring(0, 100)
      .trim();
    if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(out)) out = '_' + out;
    return out;
  }

  function sanitizePath(name) {
    return String(name || '').split('/').map(sanitizeSegment).filter(Boolean).join('/') || 'Manga';
  }

  // ── Detección de serie / número / saga ──────────────
  // Las sagas incluidas están en sagas.js; las que cargues en "Guardados y opciones"
  // se suman a esas (y las reemplazan si son de la misma serie).
  const SAGAS = globalThis.MR_SAGAS || {};
  let userSagas = {};
  let esquemaNombres = null;          // plantilla de nombres propia (opciones); null = la de siempre
  // Ritmo de las descargas (opciones): pausa entre capítulos, descanso cada tantos, imágenes a la vez
  let ritmo = globalThis.MR_AJUSTES ? MR_AJUSTES.normalizarRitmo({ pausa: BATCH_PAUSE / 1000, concurrencia: PROBE_CONCURRENCY }) : null;

  // Número de capítulo en la dirección como parámetro: ?capitulo=12, ?ch=12, ?c=12…
  function chapterParam() {
    for (const [k, v] of new URLSearchParams(location.search)) {
      if (/^(cap|capitulo|chapter|ch|c|ep|episodio|episode)$/i.test(k) && /^\d{1,5}(\.\d+)?$/.test(v)) return v;
    }
    return null;
  }

  // Saca de la serie lo que no es parte del nombre: "Leer …", "… Vol. 3", "… Manga"
  function cleanSerie(s) {
    return String(s || '')
      .replace(/^(?:leer|lee)\s+/i, '')
      .replace(/[\s\-–—:,]*(?:vol(?:umen|ume)?\.?|tomo)\s*\d+\s*$/i, '')
      .replace(/[\s\-–—:,]+(?:manga|cap[ií]tulo|chapter)\s*$/i, '')
      .replace(/[\s\-–—:,(\[]+$/, '')
      .trim();
  }

  // Devuelve {serie, numero, raw} leyendo el título de la página y la URL, o null.
  // numero puede tener decimales (capítulos extra como el 1134.5); raw es el número tal
  // como estaba escrito ("01").
  function detectChapter() {
    const og = document.querySelector('meta[property="og:title"]')?.content || '';
    const full = (og || document.title || document.querySelector('h1')?.textContent || '')
      .replace(/\s+/g, ' ').trim().split(/\s+\|\s+/)[0];
    const done = (serie, raw) => {
      serie = cleanSerie(serie);
      return serie ? { serie, numero: parseFloat(raw), raw } : null;
    };
    let m, r;

    // 1) "Serie Capítulo 12: título del capítulo". La palabra clave (Capítulo, Ch., Cap., #)
    //    tiene que ir separada de la serie: así "Bleach 686" no se corta en "Blea" + "ch 686".
    //    Lo que viene después del número es el título del capítulo y no se usa.
    m = full.match(/^(.+?)(?:[\s\-–—:,]+(?:cap[ií]tulo|chapter|episodio|cap\.?|ch\.?)|\s*#)\s*(\d{1,5}(?:\.\d+)?)(?!\d)/i);
    if (m && (r = done(m[1], m[2]))) return r;

    // 2) "Capítulo 12 - Serie"
    m = full.match(/^(?:cap[ií]tulo|chapter|episodio|cap\.?|ch\.?)\s*(\d{1,5}(?:\.\d+)?)\s*[\-–—:,]\s*(.+)$/i);
    if (m && (r = done(m[2].split(/\s+[-–—]\s+/)[0], m[1]))) return r;

    // 2b) "[#104] Serie" (así titula MANGA Plus): entre corchetes no hay duda de que es el número
    m = full.match(/^\[\s*#?\s*(\d{1,5}(?:\.\d+)?)\s*\][\s\-–—:,]*(.+)$/);
    if (m && (r = done(m[2].split(/\s+[-–—]\s+/)[0], m[1]))) return r;

    let base = full;
    const parts = base.split(/\s+[-–—]\s+/);     // quitar " - Nombre del sitio"
    if (parts.length > 1 && /\d/.test(parts[0]) && !/\d/.test(parts[parts.length - 1])) base = parts.slice(0, -1).join(' - ');

    // 3) El número de la dirección aparece suelto en el título: ese es el capítulo, aunque el
    //    título termine en otro número ("Leer Serie 7 Español Online - 2026"). La serie es lo
    //    que hay antes ("Leer One Piece 1134 Online" → One Piece). Si aparece dos veces vale
    //    la última ("Kaiju No. 8 8").
    // El número tiene que estar entero: de un código como /viewer/2010289 no sale el "10289"
    const urlNum = location.pathname.match(/(?<![\d.])(\d{1,5}(?:\.\d+)?)\/?$/)?.[1] || chapterParam();
    if (urlNum && base) {
      const n = String(parseFloat(urlNum)).replace('.', '\\.');
      m = base.match(new RegExp(`^(.+)[\\s\\-–—:,#(]+0*${n}(?!\\.?\\d)`));
      if (m && (r = done(m[1], urlNum))) return r;
    }

    // 4) "Serie 12" o "Serie Manga 12 - Nombre del sitio": el número al final
    m = base.match(/^(.*?)(?:[\s\-–—:,]+manga|\s*#)?[\s\-–—:,]*(\d{1,5}(?:\.\d+)?)\s*$/i);
    if (m && (r = done(m[1], m[2]))) return r;

    // 5) "#104 Serie": el número adelante, sin corchetes
    m = full.match(/^#\s*(\d{1,5}(?:\.\d+)?)[\s\-–—:,]+(.+)$/);
    if (m && (r = done(m[2].split(/\s+[-–—]\s+/)[0], m[1]))) return r;

    // 6) El título no trae el número: sale de la dirección, y la serie es el título sin números
    if (urlNum && base) {
      const serie = base.replace(/\d+(\.\d+)?/g, '').replace(/\s+/g, ' ').trim() || base;
      return { serie, numero: parseFloat(urlNum), raw: urlNum };
    }
    return null;
  }

  // 12 → "0012", 1134.5 → "1134.5" (4 dígitos para que ordene bien por nombre)
  function fmtNum(n) {
    const [int, dec] = String(n).split('.');
    return int.padStart(4, '0') + (dec ? '.' + dec : '');
  }

  // Nombre ya ordenado para {serie, numero}: "One Piece/11 Saga Final/One Piece 1134".
  // Con una plantilla propia cargada en opciones (esquemaNombres) el nombre sale de ella.
  function nameFor(c) {
    if (esquemaNombres) return nombrePorPlantilla(esquemaNombres, c);
    const serie = sanitizeSegment(c.serie.replace(/\//g, '-'));
    const num = fmtNum(c.numero);                          // 0001 → ordena bien por nombre
    const sagas = userSagas[serie.toLowerCase()] || SAGAS[serie.toLowerCase()];
    const n = Math.floor(c.numero);                         // el 1057.5 va con el 1057
    const i = sagas ? sagas.findIndex(([a, b]) => n >= a && n <= b) : -1;
    const saga = i >= 0 ? `${String(i + 1).padStart(2, '0')} ${sagas[i][2]}/` : '';
    return sanitizePath(`${serie}/${saga}${serie} ${num}`);
  }

  // Valor de cada marcador de la plantilla para un capítulo {serie, numero, volumen?, titulo?,
  // anio?, sitio?}. {serie}, {saga} y {numero} son los mismos del nombre de siempre. {volumen}
  // y {titulo} solo se conocen en un lote (salen de la lista de capítulos); si no, quedan vacíos.
  function contextoPlantilla(c) {
    const serie = sanitizeSegment(String(c.serie || '').replace(/\//g, '-'));
    const sagas = userSagas[serie.toLowerCase()] || SAGAS[serie.toLowerCase()];
    const n = Math.floor(c.numero);
    const i = sagas ? sagas.findIndex(([a, b]) => n >= a && n <= b) : -1;
    return {
      serie,
      saga: i >= 0 ? `${String(i + 1).padStart(2, '0')} ${sagas[i][2]}` : '',
      volumen: c.volumen || '',
      numero: c.numero != null ? fmtNum(c.numero) : '',
      titulo: c.titulo || '',
      anio: String(c.anio ?? new Date().getFullYear()),
      sitio: c.sitio || location.hostname,
    };
  }

  // Nombre de un capítulo según una plantilla. El armado y la limpieza están en plantilla.js,
  // que también usa la vista previa de opciones.
  function nombrePorPlantilla(tpl, c) {
    return aplicarPlantilla(tpl, contextoPlantilla(c));
  }

  function suggestName() {
    const c = detectChapter();
    if (c) return nameFor(c);
    const t = (document.title || 'Manga').split(/\s+\|\s+/)[0];
    return sanitizePath(t.replace(/\//g, '-'));
  }

  // Dirección para reconocer un capítulo ya guardado. Incluye ?capitulo=12 y similares
  // (en esos sitios todos los capítulos comparten la misma ruta), pero no los parámetros
  // de seguimiento (utm_…, fbclid…), que cambian sin cambiar de capítulo.
  function pageKey(loc = location) {
    const q = new URLSearchParams(loc.search);
    for (const k of [...q.keys()]) if (/^(utm_|fbclid$|gclid$|ref$)/i.test(k)) q.delete(k);
    q.sort();
    const s = q.toString();
    return loc.origin + loc.pathname + (s ? '?' + s : '');
  }

  // Dos direcciones son la misma aunque una termine en "/" y la otra no
  const noSlash = (u) => String(u || '').replace(/\/(?=\?|$)/, '');

  // ── Capítulos: dirección por número ─────────────────

  // Parte la dirección de un capítulo en {pre, num, post}: "…/todos/1134" → pre "…/todos/",
  // num "1134". El número puede estar al final de la ruta o en un parámetro (?capitulo=12).
  function splitChapterUrl(href) {
    let u;
    try { u = new URL(href); } catch { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    const p = u.pathname.match(/^(.*?)(?<![\d.])(\d{1,5}(?:\.\d+)?)((?:\.html?|\.php|\/)?)$/);
    if (p) return { pre: u.origin + p[1], num: p[2], post: p[3] + u.search };
    const q = u.search.match(/^(.*[?&](?:cap|capitulo|chapter|ch|c|ep|episodio|episode)=)(\d{1,5}(?:\.\d+)?)(&.*)?$/i);
    if (q) return { pre: u.origin + u.pathname + q[1], num: q[2], post: q[3] || '' };
    return null;
  }

  // Formas de escribir un número en la dirección: "5", "05", "005" (hay sitios que le
  // ponen ceros adelante). Primero la del ancho que ya se sabe que usa el sitio.
  function numForms(n, width = 1) {
    const [int, dec] = String(n).split('.');
    const mk = (w) => int.padStart(w, '0') + (dec ? '.' + dec : '');
    return [...new Set([mk(width), mk(1), mk(2), mk(3)])];
  }

  // ¿Es una dirección del archivo por fecha de un blog (/2021/01/ o /2021/01/15/) y no un
  // capítulo? Los sitios hechos con WordPress traen una tira de esos links ("enero 2021",
  // "febrero 2021"…) que terminan en un número chico, igual que un capítulo, pero abren la
  // página con todo lo publicado ese mes. `s` es lo que devuelve splitChapterUrl.
  const MONTH_RE = /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|sep?tiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
  function isDateArchive(s, text = '') {
    if (/cap[ií]tulo|chapter|episod|\bcap\b|\bch\b|#\s*\d/i.test(text)) return false;      // el texto dice que es un capítulo
    const n = parseFloat(s.num);
    if (!Number.isInteger(n)) return false;
    let path;
    try { path = new URL(s.pre).pathname; } catch { return false; }
    if (/\/(?:19|20)\d{2}\/(?:0?[1-9]|1[0-2])\/$/.test(path)) return n >= 1 && n <= 31;    // …/2021/01/15: un día
    // …/2021/01: un mes, si el texto nombra el mes o el año ("enero 2021"). Sin eso podría
    // ser el capítulo 1 de una serie cuyo código en el sitio es 2021, y se deja pasar.
    const year = path.match(/\/((?:19|20)\d{2})\/$/)?.[1];
    return !!year && n >= 1 && n <= 12 && (MONTH_RE.test(text) || new RegExp(`(?<!\\d)${year}(?!\\d)`).test(text));
  }

  // Capítulos que se pueden abrir desde esta página. Salen de los links <a>, de las
  // opciones de un <select> y de la dirección de la página misma. Devuelve
  //   { list: [{numero, title, url?, raw?, seccion?}], pat: {pre, post} | null, guessed, code, file, width, current }
  // pat es el molde de las direcciones (pre + número + post); guessed = true si no hubo de
  // dónde sacarlo y se supuso "esta dirección + /número"; width, los dígitos mínimos del número.
  // seccion = el título que el capítulo tiene encima en la página cuando nombra un tomo, un
  // volumen o una saga ("Tomo 3: La huida"), o el grupo de su opción en el desplegable. Con
  // eso se arma la pestaña "Tomos" (tomosDe, en agrupar.js).
  // code = un código del sitio en la dirección (6 cifras o más, como /viewer/2010289 de
  // MANGA Plus, que es el capítulo 104) cuando tampoco hay links de capítulos. Ahí no hay
  // molde (pat = null): con el número no se puede adivinar la dirección de otro capítulo.
  // file = el nombre del archivo cuando la dirección termina en uno (….html, ….php) sin el
  // número al final y tampoco hay links de capítulos. Tampoco hay molde: "archivo.html/5"
  // no existe en ningún sitio, así que no se supone.
  // Si la dirección termina en un número de hasta 5 cifras, se confía en ella aunque el
  // título diga otro número: hay títulos que terminan en un año, y sitios que cambian de
  // capítulo sin recargar y dejan el título viejo.
  function collectChapters() {
    const here = location.href.split('#')[0];
    const ownRaw = splitChapterUrl(here);
    const own = ownRaw && !isDateArchive(ownRaw, document.title) ? ownRaw : null;     // la página del archivo de un mes no es un capítulo
    const title = detectChapter();
    let code = '';
    const groups = new Map();       // molde → { pat, items: número → capítulo }
    const optionNums = [];
    let width = 1;
    const widthOf = (s) => { if (/^0\d/.test(s)) width = Math.max(width, s.split('.')[0].length); };
    const label = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 70) || `Capítulo ${n}`;
    const tomo = (s) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return SECCION_RE.test(s) ? { seccion: s } : {}; };

    // El título que cada link tiene encima en la página, si nombra un tomo. Un mismo capítulo
    // puede estar enlazado dos veces (en "Últimos capítulos" y en su tomo): vale donde lo tenga.
    const tomoDe = new Map();
    reiniciarSeccion();
    for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, summary, a[href]')) {
      if (el.closest(OURS)) continue;
      if (el.tagName !== 'A') { capturarSeccion(el.textContent); continue; }
      const href = String(el.href).split('#')[0];
      if (!tomoDe.has(href) && SECCION_RE.test(seccionVigente())) tomoDe.set(href, seccionVigente());
    }

    const add = (href, text, seccion) => {
      const s = splitChapterUrl(href);
      if (!s || !href.startsWith(location.origin + '/')) return;
      if (/(?:^|[/?&])(?:page|pagina|pag|p)[/=]$/i.test(s.pre)) return;       // paginación, no capítulos
      if (isDateArchive(s, text)) return;                                       // archivo por mes o por día, no capítulos
      const key = s.pre + '\n' + s.post;
      let g = groups.get(key);
      if (!g) groups.set(key, g = { pat: { pre: s.pre, post: s.post }, items: new Map() });
      const n = parseFloat(s.num);
      if (!g.items.has(n)) g.items.set(n, { numero: n, title: label(text, n), url: href, raw: s.num, ...tomo(seccion) });
    };

    for (const a of document.querySelectorAll('a[href]')) {
      const href = String(a.href).split('#')[0];
      if (!a.closest(OURS)) add(href, a.textContent, tomoDe.get(href));
    }
    for (const o of document.querySelectorAll('select option')) {
      const v = String(o.value || '').trim();
      if (!v || o.disabled) continue;
      const grupo = o.parentElement?.tagName === 'OPTGROUP' ? o.parentElement.label : '';      // <optgroup label="Tomo 3">
      if (/^\d{1,5}(\.\d+)?$/.test(v)) optionNums.push({ raw: v, text: o.textContent, grupo });     // el valor es el número
      else if (/[/?=]/.test(v)) add(absUrl(v).split('#')[0], o.textContent, grupo);                 // el valor es una dirección
      else {
        const t = String(o.textContent || '').match(/(\d{1,5}(?:\.\d+)?)/);                 // el número está en el texto
        if (t) optionNums.push({ raw: t[1], text: o.textContent, grupo });
      }
    }

    // Molde: el de esta misma página si su dirección tiene número; si no, el del grupo de
    // links más grande; si no hay nada, se supone "esta dirección + /número"… salvo que la
    // dirección lleve un código del sitio o termine en un archivo: ahí no se supone nada, y
    // los números sueltos de un desplegable tampoco sirven porque no hay con qué armar su dirección.
    let best = null;
    for (const g of groups.values()) if (!best || g.items.size > best.items.size) best = g;
    let pat = null, group = null, guessed = false, file = '';
    const last = location.pathname.replace(/\/+$/, '').split('/').pop();
    if (own) {
      pat = { pre: own.pre, post: own.post };
      group = groups.get(own.pre + '\n' + own.post) || null;
      widthOf(own.num);
    } else if (best && best.items.size >= 2) {
      pat = best.pat;
      group = best;
    } else if ((code = last.match(/\d{6,}/)?.[0] || '')) {
      optionNums.length = 0;
    } else if (/\.(?:x?html?|shtml|php\d?|aspx?|jsp|cgi)$/i.test(last)) {
      file = last;
      optionNums.length = 0;
    } else {
      pat = { pre: location.origin + location.pathname.replace(/\/+$/, '') + '/', post: location.search };
      guessed = true;
      if (title) widthOf(title.raw);
    }

    const byNum = new Map();
    if (group) for (const it of group.items.values()) { byNum.set(it.numero, it); widthOf(it.raw); }
    for (const o of optionNums) {
      const n = parseFloat(o.raw);
      widthOf(o.raw);
      if (!byNum.has(n)) byNum.set(n, { numero: n, title: label(o.text, n), raw: o.raw, ...tomo(o.grupo) });
    }
    // El capítulo que está abierto entra siempre, con la dirección que ya se sabe que anda
    const current = own ? parseFloat(own.num) : (title ? title.numero : null);
    if (current != null && (own || guessed || code || file)) {
      const had = byNum.get(current);
      byNum.set(current, { numero: current, title: had?.title || `Capítulo ${current}`, url: here, ...tomo(had?.seccion) });
    }
    const list = [...byNum.values()].sort((a, b) => a.numero - b.numero);
    return { list, pat, guessed, code, file, width, current };
  }

  // Dirección del capítulo siguiente al que está abierto, o ''
  function nextChapterUrl() {
    const ch = collectChapters();
    if (ch.current == null) return '';
    const after = ch.list.find(c => c.numero > ch.current);
    if (after?.url) return after.url;
    if (after && ch.pat) return ch.pat.pre + (after.raw || numForms(after.numero, ch.width)[0]) + ch.pat.post;
    const rel = document.querySelector('link[rel~="next"], a[rel~="next"]');
    if (rel?.href && absUrl(rel.href)) return absUrl(rel.href);
    return ch.pat ? ch.pat.pre + numForms(Math.floor(ch.current) + 1, ch.width)[0] + ch.pat.post : '';
  }

  // Capítulos a partir de un texto con links pegados, escrito como venga: un link por
  // renglón o varios juntos, con o sin algo adelante ("01: https://…", "Capítulo 12 - https://…")
  // y con renglones sin link en el medio (títulos), que se ignoran. A cada link le toca un número:
  //   · 'label': el que está escrito justo antes del link, si todos lo tienen y no se repite;
  //   · 'link':  el que trae el propio link en el nombre de su página. Si el nombre tiene
  //              varios números ("serie-2-manga-104-2025"), vale el que cambia de un link a otro;
  //   · 'order': el orden en que están pegados, desde `start` ('reverse': del último al primero).
  // mode 'auto' prueba en ese orden; 'order' y 'reverse' numeran por orden sin mirar los links.
  // Devuelve { items: [{numero, url, title, raw}] ordenados por número, how, dup }.
  function chaptersFromLinks(text, mode = 'auto', start = 1) {
    const found = [], seen = new Set();
    let dup = 0;
    for (const line of String(text || '').split(/\r?\n/)) {
      const re = /https?:\/\/[^\s<>"']+/gi;
      let m, from = 0;
      while ((m = re.exec(line))) {
        let raw = m[0].replace(/[.,;:!?\]»”]+$/, '');
        while (raw.endsWith(')') && (raw.match(/\(/g) || []).length < (raw.match(/\)/g) || []).length) raw = raw.slice(0, -1);
        const before = line.slice(from, m.index);
        from = m.index + m[0].length;
        let u;
        try { u = new URL(raw); } catch { continue; }
        const url = u.href.split('#')[0];
        if (seen.has(noSlash(url))) { dup++; continue; }
        seen.add(noSlash(url));
        let seg = u.pathname.replace(/\/+$/, '').split('/').pop() || u.hostname;
        try { seg = decodeURIComponent(seg); } catch {}
        seg = seg.replace(/\.(?:x?html?|shtml|php\d?|aspx?|jsp|cgi)$/i, '');
        // Números de hasta 5 cifras en el nombre de la página (un código más largo no es un capítulo)
        let nums = seg.match(/(?<![\d.])\d{1,5}(?:\.\d+)?(?![\d.])/g) || [];
        if (!nums.length) { const s = splitChapterUrl(url); if (s) nums = [s.num]; }       // ?capitulo=12
        found.push({ url, nums, label: before.match(/(\d{1,5}(?:\.\d+)?)\s*[:.)\-–—]?\s*$/)?.[1] || '',
                     title: seg.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70) });
      }
    }
    if (!found.length) return { items: [], how: '', dup };

    const distinct = (vals) => vals.every(Boolean) && new Set(vals.map(parseFloat)).size === vals.length;
    let raws = null, how = 'order';
    if (mode === 'auto') {
      const labels = found.map(f => f.label);
      if (distinct(labels)) { raws = labels; how = 'label'; }
      else if (found.every(f => f.nums.length)) {
        const k = found[0].nums.length;
        if (found.every(f => f.nums.length === k)) {
          for (let j = k - 1; j >= 0 && !raws; j--) { const v = found.map(f => f.nums[j]); if (distinct(v)) raws = v; }
        } else {
          const last = found.map(f => f.nums[f.nums.length - 1]), first = found.map(f => f.nums[0]);
          raws = distinct(last) ? last : distinct(first) ? first : null;
        }
        if (raws) how = 'link';
      }
    }
    const n0 = Number.isFinite(+start) ? +start : 1;
    const items = found.map((f, i) => ({
      numero: raws ? parseFloat(raws[i]) : n0 + (mode === 'reverse' ? found.length - 1 - i : i),
      raw: raws ? raws[i] : '', url: f.url, title: f.title,
    })).sort((a, b) => a.numero - b.numero);
    return { items, how: raws ? how : mode === 'reverse' ? 'reverse' : 'order', dup };
  }

  // ── Guardar ─────────────────────────────────────────

  let savedMap = {};              // capítulos ya guardados: { ruta: {ts, pages, url} }
  const KINDS = { pdf: ['📄', 'PDF'], cbz: ['📚', 'CBZ'] };

  // Guarda las páginas `urls` como `path` en los formatos pedidos. Lo usan el diálogo y la
  // descarga de varios capítulos. `nums` son los números de página que ve el usuario (para
  // decir cuáles fallaron); `missing`, páginas que ya se sabía que no habían cargado.
  // Devuelve { lines, complete, pages, failedNums }.
  // `soloEntero` lo pasa el lote: si el sitio pide esperar (429 o 503) con alguna página, el
  // capítulo no se guarda a medias y la falla lo dice (el lote para y lo reintenta).
  // `porque` (2.11.4): el código, 429 o 503, si las `missing` no cargaron porque el sitio pidió esperar.
  async function saveCore(path, urls, formats, chap, nums, missing = 0, soloEntero = false, porque = 0) {
    const last = path.split('/').pop();
    // Con una plantilla propia las carpetas ya no dicen cuál es la serie ni la saga: salen del
    // capítulo (si el nombre es el que armó la plantilla y no uno escrito a mano).
    const tpl = esquemaNombres && chap && chap.numero != null && !isNaN(chap.numero) && nameFor(chap) === path ? contextoPlantilla(chap) : null;
    const arc = tpl ? tpl.saga.replace(/^\d+\s+/, '')
      : path.split('/').length >= 3 ? path.split('/').slice(-2, -1)[0].replace(/^\d+\s+/, '') : '';
    let r;
    try {
      r = await bg({
        action: 'build', urls, formats, path, title: last, soloEntero,
        meta: { title: last, series: chap?.serie, number: chap?.numero, arc, web: claveAca() },
      }, 60000 + urls.length * 20000);
    } catch (e) {
      return { lines: [`⚠️ ${e.message}`], complete: false, pages: 0, failedNums: [] };
    }

    const lines = [];
    let anyError = false;
    for (const f of r.files) {
      const [icon, label] = KINDS[f.kind] || ['', f.kind];
      if (f.error) { anyError = true; lines.push(`⚠️ ${label}: ${f.error}`); continue; }
      lines.push(`${icon} ${label} de ${r.pages} páginas (${fmtSize(f.sizeKB)})`);
      if (f.savedAs) lines.push(`   guardado como ${f.savedAs}`);
    }
    if (formats.imgs) {
      if (r.imgs) lines.push(`🖼 ${r.imgs} imágenes` + (r.imgsFailed ? ` · ${r.imgsFailed} no se pudieron guardar` : ''));
      else { anyError = true; lines.push(`⚠️ Imágenes: ${r.imgError || 'no se pudieron guardar'}`); }
    }
    const failedNums = r.failed.map(k => (nums ? nums[k - 1] : k));
    if (failedNums.length) {
      // Si faltaron porque el sitio pidió esperar (429 o 503), se dice: no es una página rota,
      // y conviene probar de nuevo en un rato en vez de enseguida.
      const pidio = r.esperar ? ` (el sitio pidió esperar: HTTP ${r.esperar})` : '';
      lines.push((failedNums.length === 1 ? `⚠️ No se pudo bajar la página ${failedNums[0]}`
                                          : `⚠️ No se pudieron bajar las páginas ${failedNums.join(', ')}`) + pidio);
    }
    if (missing) lines.push((missing === 1 ? '⚠️ 1 página del capítulo no cargó' : `⚠️ ${missing} páginas del capítulo no cargaron`) + (porque ? ` (el sitio pidió esperar: HTTP ${porque})` : ''));

    // Se anota como guardado solo si entraron todas las páginas elegidas
    const complete = !anyError && !failedNums.length && !r.imgsFailed && !missing;
    if (complete) {
      savedMap = (await store.get(['savedChapters'])).savedChapters || {};
      // serie y numero solo se anotan con una plantilla propia: la página de guardados los
      // necesita para agrupar y decir qué falta, y ahí no los puede sacar del nombre
      // kb: lo que pesó todo lo guardado de este capítulo. Con eso se estima cuánto va a ocupar un lote.
      const kb = r.files.reduce((a, f) => a + (f.sizeKB || 0), 0) + (r.imgsKB || 0);
      savedMap[path] = { ts: Date.now(), pages: urls.length, url: claveAca(), ...(tpl ? { serie: tpl.serie, numero: chap.numero } : {}), ...(kb ? { kb } : {}) };
      await store.set({ savedChapters: savedMap });
    } else if (!anyError) {
      lines.push('⚠️ Faltaron páginas: no lo marqué como guardado. Probá guardarlo de nuevo.');
    }
    return { lines, complete, pages: r.pages, failedNums };
  }

  // ── Teclado ─────────────────────────────────────────
  // Los dos diálogos se pueden usar sin mouse: se anuncian como diálogos, el foco no se sale de
  // ellos con Tab y, al cerrarlos, vuelve a donde estaba en la página.
  const ENFOCABLES = 'button, input, select, textarea, summary, a[href], [tabindex]';
  const enfocables = (caja) => [...caja.querySelectorAll(ENFOCABLES)].filter(e => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length);

  // Tab en el último control vuelve al primero, y Mayús+Tab en el primero va al último
  function atraparFoco(caja, e) {
    if (e.key !== 'Tab') return;
    const lista = enfocables(caja);
    if (!lista.length) return;
    const i = lista.indexOf(caja.getRootNode().activeElement);
    if (e.shiftKey ? i <= 0 : i === lista.length - 1) {
      e.preventDefault();
      lista[e.shiftKey ? lista.length - 1 : 0].focus();
    }
  }

  let focoAntes = null;           // lo que tenía el foco en la página antes de abrir un diálogo
  function recordarFoco() {
    if (saveEl || chapterEl) return;                           // ya hay un diálogo abierto: vale lo anotado al abrir ese
    const a = document.activeElement;
    focoAntes = a && a !== document.body && a !== hostEl ? a : null;
  }
  function devolverFoco() {
    if (saveEl || chapterEl) return;                           // queda otro diálogo abierto: el foco sigue ahí
    try { if (focoAntes?.isConnected) focoAntes.focus(); } catch {}
    focoAntes = null;
  }

  // Flechas entre las miniaturas (la grilla tiene 5 columnas), Inicio y Fin. Con Alt, la flecha
  // izquierda o derecha cambia de lugar la página: lo mismo que arrastrarla. La barra espaciadora
  // la tilda o destilda sin hacer nada acá: cada miniatura es un botón.
  function flechasMiniaturas(e) {
    const m = e.target.closest?.('.mr-thumb');
    if (!m || !/^(Arrow(Left|Right|Up|Down)|Home|End)$/.test(e.key)) return;
    e.preventDefault();
    const todas = [...saveEl.querySelectorAll('.mr-thumb')], i = todas.indexOf(m);
    const paso = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -5, ArrowDown: 5 }[e.key];
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? todas.length - 1 : Math.min(todas.length - 1, Math.max(0, i + paso));
    if (e.altKey && Math.abs(paso) === 1) return moverPagina(i, j);
    todas[j].focus();
  }

  // ── Diálogo "Guardar capítulo" ──────────────────────

  let saveEl = null;
  let opening = false;            // se está abriendo un diálogo (pedirlo dos veces seguidas no abre dos)
  let saving = false;
  let pages = [];                 // [{url, w, h, flag, on}]
  let pagesLoaded = false;
  let lastFailed = 0;             // páginas del capítulo que no cargaron en la última búsqueda
  let lastFaltan = [];            // y sus direcciones (2.11.4: para decir por qué, si se sabe)
  let lastLocked = false;        // las páginas del capítulo no tienen dirección para bajar (imágenes blob:)
  let lastFondo = false;          // las páginas salieron de imágenes de fondo (una deducción: se avisa)
  let lastFondoTotal = 0;         // cuántas páginas dibuja ese lector de fondo, cargaran o no (2.11.4)
  let lastTapas = false;          // lo que hay son tapas que llevan a otras páginas del sitio: no se ofrecen
  let loadSeq = 0;
  let reachedBottom = false;      // ¿se llegó al final de la página en algún momento?
  let reloadTimer = null;
  let nextUrl = '';               // capítulo siguiente, para "Guardar y siguiente"

  const sv = (sel) => saveEl?.querySelector(sel);

  function setSaveStatus(text, type = '') {
    const el = sv('#mr-save-status');
    if (el) { el.textContent = text; el.className = 'mr-save-status' + (type ? ' ' + type : ''); }
  }

  async function openSaveDialog() {
    if (saveEl) { sv('#mr-save-name')?.focus(); return; }
    if (opening) return;
    opening = true;
    try {
      const st = await store.get(['savePdf', 'saveCbz', 'saveImgs', 'saveFolders', 'savedChapters', 'autoScan']);
      await pedirArriba();
      if (saveEl) return;                                       // se abrió otro mientras se esperaba
      if (!batchRunning) closeChapterDialog();
      const folder = (st.saveFolders || {})[sitioAca()] || '';
      let name = nombreAca();
      if (folder && !name.includes('/')) name = `${folder}/${name}`;   // solo si no se pudo detectar la serie
      savedMap = st.savedChapters || {};
      // Desde un iframe no se ofrece "Guardar y siguiente": el que tiene que cambiar de capítulo
      // es la página de arriba, y el aviso para abrir el diálogo al llegar se anota por origen
      nextUrl = enMarco ? '' : nextChapterUrl();

      recordarFoco();
      saveEl = document.createElement('div');
      saveEl.id = 'mr-save';
      saveEl.setAttribute('role', 'dialog');
      saveEl.setAttribute('aria-modal', 'true');
      saveEl.setAttribute('aria-label', 'Guardar capítulo');
      saveEl.innerHTML = `
        <div class="mr-head">
          <span class="mr-title">💾 Guardar capítulo</span>
          <button class="mr-b mr-x" id="mr-save-close" title="Cerrar (Esc)" aria-label="Cerrar">✕</button>
        </div>
        <div class="mr-save-body">
          <label class="mr-save-label" for="mr-save-name">Nombre del tomo</label>
          <input id="mr-save-name" class="mr-save-name" type="text" spellcheck="false" autocomplete="off">
          <div class="mr-save-hint">Usá <b>/</b> para carpetas · ej: <i>One Piece/Tomo 110</i></div>
          <div class="mr-save-opts">
            <label><input type="checkbox" id="mr-save-pdf"> 📄 PDF</label>
            <label><input type="checkbox" id="mr-save-cbz"> 📚 CBZ</label>
            <label><input type="checkbox" id="mr-save-imgs"> 🖼 Imágenes</label>
          </div>
          <div class="mr-save-seen" id="mr-save-seen"></div>
          <div class="mr-save-dest" id="mr-save-dest"></div>
          <div class="mr-save-count" id="mr-save-count">Buscando páginas…</div>
          <div class="mr-save-warn" id="mr-save-warn"><span id="mr-save-warn-text"></span>
            <button id="mr-save-scan" type="button">Recorrer la página</button></div>
          <div class="mr-save-orden" id="mr-save-orden" hidden>
            <button class="mr-orden-btn" id="mr-save-invertir" type="button" title="Da vuelta el orden de las páginas">⇅ Invertir</button>
            <button class="mr-orden-btn" id="mr-save-ordenar" type="button" title="Las ordena por el número que trae el nombre de cada imagen">Ordenar por número</button>
          </div>
          <div class="mr-thumbs" id="mr-thumbs" role="group" aria-label="Páginas del capítulo: flechas para moverse, barra espaciadora para incluir o quitar"></div>
          <div class="mr-save-btns">
            <button class="mr-save-go" id="mr-save-go" type="button">Guardar</button>
            <button class="mr-save-go mr-save-next" id="mr-save-next" type="button"
                    title="Guarda y abre el capítulo siguiente (Ctrl+Enter)">Guardar y siguiente ▶</button>
          </div>
          <div class="mr-save-status" id="mr-save-status"></div>
        </div>`;
      uiRoot().appendChild(saveEl);
      makeDraggable(saveEl, saveEl.querySelector('.mr-head'));

      const input = sv('#mr-save-name');
      input.value = name;
      sv('#mr-save-pdf').checked = st.savePdf !== false;
      sv('#mr-save-cbz').checked = st.saveCbz === true;
      sv('#mr-save-imgs').checked = st.saveImgs === true;      // por defecto solo PDF
      sv('#mr-save-next').hidden = !nextUrl;

      input.addEventListener('input', refresh);
      sv('#mr-save-pdf').addEventListener('change', refresh);
      sv('#mr-save-cbz').addEventListener('change', refresh);
      sv('#mr-save-imgs').addEventListener('change', refresh);
      // Teclado en todo el diálogo: Enter guarda, Ctrl+Enter guarda y sigue, Esc cierra.
      // Las teclas no pasan al sitio: muchos lectores cambian de capítulo con las flechas.
      saveEl.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') return closeSaveDialog();
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); saveChapter(e.ctrlKey && !!nextUrl); }
        atraparFoco(saveEl, e);
        flechasMiniaturas(e);
      });
      for (const type of ['keyup', 'keypress']) saveEl.addEventListener(type, (e) => e.stopPropagation());
      sv('#mr-save-close').onclick = closeSaveDialog;
      sv('#mr-save-go').onclick = () => saveChapter(false);
      sv('#mr-save-next').onclick = () => saveChapter(true);
      sv('#mr-save-scan').onclick = scanPage;
      sv('#mr-save-invertir').onclick = () => ordenarPaginas('invertir');
      sv('#mr-save-ordenar').onclick = () => ordenarPaginas('numero');

      reachedBottom = atBottom();
      window.addEventListener('scroll', onPageScroll, { passive: true });
      document.addEventListener('load', onImageLoad, true);      // 'load' de <img> no burbujea → captura

      refresh();
      input.focus();
      input.select();
      loadPages();
      // Si no llegaste al final, la página se recorre sola para que carguen todas las imágenes
      if (st.autoScan !== false && !reachedBottom) scanPage();
    } finally {
      opening = false;
    }
  }

  async function loadPages() {
    const seq = ++loadSeq;
    const found = await collectPages();
    if (!saveEl || seq !== loadSeq) return;                    // se cerró, o ya hay una búsqueda más nueva
    // Lo tildado se lee DESPUÉS de esperar: así se respetan los clics hechos mientras buscaba.
    // Salvo que la búsqueda nueva haya cambiado la marca de esa página (por ejemplo, al aparecer
    // más abajo una grilla de tapas, lo que antes parecía una página resultó no serlo): ahí vale la marca nueva.
    const prev = new Map(pages.map(p => [p.url, p.on])), marcaAntes = new Map(pages.map(p => [p.url, p.flag || '']));
    let nuevas = found.pages.map(p => ({ ...p, on: prev.has(p.url) && marcaAntes.get(p.url) === (p.flag || '') ? prev.get(p.url) : !p.flag }));
    // Si las cambiaste de lugar, ese orden se respeta al volver a buscar: lo que aparece nuevo va al final
    if (ordenManual) {
      const lugar = new Map(pages.map((p, i) => [p.url, i]));
      nuevas = nuevas.map((p, i) => [p, lugar.has(p.url) ? lugar.get(p.url) : pages.length + i]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    }
    pages = nuevas;
    lastFailed = found.failed;
    lastFaltan = found.faltantes || [];
    lastLocked = found.locked;
    lastFondo = !!found.fondo;
    lastFondoTotal = found.fondo ? found.total ?? found.pages.length : 0;
    lastTapas = !!found.tapas;
    pagesLoaded = true;
    renderThumbs();
    refresh();
  }

  // ── Orden de las páginas ────────────────────────────
  // El orden de las miniaturas es el del PDF, el del CBZ y el de la numeración de las imágenes
  // sueltas. Sale del orden en que las páginas están en el sitio, que no siempre es el de
  // lectura: se pueden arrastrar, mover con ▲▼, invertir u ordenar por el número de su nombre.
  let ordenManual = false;        // las cambiaste de lugar: ese orden se respeta al volver a buscar
  let arrastrada = -1;            // la miniatura que se está arrastrando

  function moverPagina(desde, hasta) {
    if (saving || desde === hasta || desde < 0 || hasta < 0 || desde >= pages.length || hasta >= pages.length) return;
    pages.splice(hasta, 0, pages.splice(desde, 1)[0]);
    ordenManual = true;
    renderThumbs();
    refresh();
    sv(`.mr-thumb[data-i="${hasta}"]`)?.focus();               // el foco sigue a la página que se movió
  }

  // El número que trae el nombre de la imagen ("…/cap-12/007.jpg" → 7): el último que tenga
  function numeroDeImagen(url) {
    let nombre = url.split(/[?#]/)[0].split('/').pop() || '';
    try { nombre = decodeURIComponent(nombre); } catch {}
    const n = nombre.match(/\d+/g);
    return n ? parseInt(n[n.length - 1], 10) : Infinity;
  }

  function ordenarPaginas(como) {
    if (saving || pages.length < 2) return;
    if (como === 'invertir') pages.reverse();
    else pages = pages.map((p, i) => [p, numeroDeImagen(p.url), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
    ordenManual = true;
    renderThumbs();
    refresh();
  }

  function renderThumbs() {
    const box = sv('#mr-thumbs');
    if (!box) return;
    const top = box.scrollTop;                                 // que no salte arriba al volver a dibujar
    box.innerHTML = pages.map((p, i) => `
      <button class="mr-thumb ${p.on ? 'on' : 'off'}" data-i="${i}" type="button" draggable="true" aria-pressed="${p.on}"
              aria-label="${esc(`Página ${i + 1} de ${pages.length}${p.flag ? ', posible publicidad' : ''}`)}"
              title="${esc(p.flag ? `Posible publicidad: ${p.flag}` : `Página ${i + 1}`)} · clic para ${p.on ? 'quitar' : 'incluir'} · arrastrala o usá ▲▼ para cambiarla de lugar">
        <img src="${esc(p.url)}" loading="lazy" alt="" draggable="false">
        <span class="mr-thumb-n">${i + 1}</span>
        <span class="mr-thumb-mv" data-mv="-1" title="Mover antes">▲</span><span class="mr-thumb-mv" data-mv="1" title="Mover después">▼</span>
        ${p.flag ? '<span class="mr-thumb-ad">AD</span>' : ''}
      </button>`).join('');
    box.scrollTop = top;
    const soltar = () => { arrastrada = -1; box.querySelectorAll('.mr-arrastrando, .mr-destino').forEach(x => x.classList.remove('mr-arrastrando', 'mr-destino')); };
    box.querySelectorAll('.mr-thumb').forEach(b => {
      const i = +b.dataset.i;
      b.onclick = (e) => {
        if (saving) return;
        const mv = e.target.closest('[data-mv]');
        if (mv) return moverPagina(i, i + +mv.dataset.mv);      // ▲▼: cambia de lugar, no la quita
        const p = pages[i];
        p.on = !p.on;
        b.classList.toggle('on', p.on);
        b.classList.toggle('off', !p.on);
        b.setAttribute('aria-pressed', String(p.on));
        refresh();
      };
      b.ondragstart = (e) => {
        if (saving) return e.preventDefault();
        arrastrada = i;
        b.classList.add('mr-arrastrando');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch {}
      };
      b.ondragover = (e) => { if (arrastrada >= 0 && arrastrada !== i) { e.preventDefault(); b.classList.add('mr-destino'); } };
      b.ondragleave = () => b.classList.remove('mr-destino');
      b.ondrop = (e) => { e.preventDefault(); const desde = arrastrada; soltar(); moverPagina(desde, i); };
      b.ondragend = soltar;
    });
  }

  function refresh() {
    if (!saveEl) return;
    const path = sanitizePath(sv('#mr-save-name').value);
    const pdf = sv('#mr-save-pdf').checked, cbz = sv('#mr-save-cbz').checked, imgs = sv('#mr-save-imgs').checked;
    const lines = [];
    const base = baseDe(capituloAca()?.serie || path.split('/')[0]);
    if (pdf) lines.push(`📄 Descargas/${base}/${path}.pdf`);
    if (cbz) lines.push(`📚 Descargas/${base}/${path}.cbz`);
    if (imgs) lines.push(`🖼 Descargas/${base}/${path}/`);
    sv('#mr-save-dest').textContent = lines.join('\n') || 'Elegí al menos un formato';

    const onCount = pages.filter(p => p.on).length;
    const ads = pages.filter(p => p.flag && !p.on).length;
    const count = sv('#mr-save-count');
    if (scanning) {
      count.textContent = 'Recorriendo la página para cargar todas las imágenes…' + (pages.length ? ` (${pages.length} hasta ahora)` : '');
    } else if (pagesLoaded && lastLocked) {
      // (con un lector de fondo que no se pudo leer, las imágenes sueltas de la página no se ofrecen)
      count.textContent = 'No encontré páginas del capítulo en esta página.' + (lastFondo ? ' El lector las dibuja de fondo y no se pudieron leer.' : lastTapas ? ' Lo que hay son tapas que llevan a otras páginas del sitio.' : '');
    } else if (pages.length) {
      count.textContent =
        `${onCount} de ${pages.length} páginas` + (lastFondo ? ' · páginas dibujadas de fondo' : '') +
        // (2.11.4) Un lector de fondo que dibuja una sola página (como el de Issuu) muestra una por
        // vez: se guarda la que está a la vista, no el documento entero. Se mira cuántas dibuja, no
        // cuántas cargaron (a uno de varias le pudo fallar alguna). Un capítulo de una sola <img> no lo dice.
        (lastFondo && lastFondoTotal === 1 && pages.length === 1 ? ' · el lector muestra una página por vez: se guarda la que está a la vista' : '') +
        (ads ? ` · ${ads} descartada${ads === 1 ? '' : 's'} como publicidad` : '') +
        ' · clic en una miniatura para incluirla o quitarla';
    } else if (pagesLoaded) {
      count.textContent = 'No encontré páginas · bajá hasta el final del capítulo';
    }
    sv('#mr-save-orden').hidden = pages.length < 2 || lastLocked;
    const blocked = saving || (!pdf && !cbz && !imgs) || !onCount;
    sv('#mr-save-go').disabled = blocked;
    sv('#mr-save-next').disabled = blocked;

    // ¿Ya lo guardaste? (por nombre, o por la dirección de esta página)
    const here = noSlash(claveAca());
    const hit = savedMap[path] ? [path, savedMap[path]] : Object.entries(savedMap).find(([, v]) => noSlash(v.url) === here);
    const seen = sv('#mr-save-seen');
    if (hit) {
      const d = new Date(hit[1].ts);
      const when = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      seen.textContent = `✔ Ya lo guardaste el ${when} (${hit[1].pages} páginas)` + (hit[0] !== path ? ` como "${hit[0]}"` : '');
    } else seen.textContent = '';

    // ¿Pueden faltar páginas?
    const warns = [];
    if (pagesLoaded && lastFailed && !lastLocked) {
      const cod = codigoDeEspera(lastFaltan);                  // (2.11.4) si se sabe por qué: el sitio pidió esperar
      warns.push((lastFailed === 1 ? '1 página no cargó' : `${lastFailed} páginas no cargaron`) + (cod ? `: el sitio pidió esperar (HTTP ${cod})` : ''));
    }
    if (pagesLoaded && !reachedBottom && !scanning && !lastLocked) warns.push('no llegaste al final de la página, pueden faltar páginas');
    // Un adaptador con un selector que el navegador no entiende (puede venir de una copia importada:
    // opciones no deja guardarlo así) no se usa. Se avisa, para que no parezca que el adaptador no hace nada.
    if (pagesLoaded && adaptadorRoto) warns.push('el adaptador de este sitio tiene un selector inválido: busqué las páginas como siempre');
    // Las de fondo son una deducción: si no son las del capítulo, el adaptador dice dónde están
    if (pagesLoaded && lastFondo && pages.length && !lastLocked) warns.push('son páginas dibujadas de fondo: si no son las del capítulo, decí dónde están con un adaptador (⚙️ → Adaptadores por sitio)');
    sv('#mr-save-warn-text').textContent = warns.length ? '⚠️ ' + warns.join(' · ') : '';
    sv('#mr-save-warn').style.display = warns.length ? '' : 'none';
    sv('#mr-save-scan').disabled = saving || scanning;
  }

  // ── Páginas sin cargar ──────────────────────────────

  let scanning = false;
  const atBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 300;

  function onPageScroll() {
    if (!reachedBottom && !scanning && atBottom()) { reachedBottom = true; refresh(); }
  }

  // Cuando termina de cargar una imagen nueva de la página, se vuelve a contar
  function onImageLoad(e) {
    if (e.target?.tagName !== 'IMG' || e.target.closest(OURS) || saving || scanning) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => { if (saveEl && !saving && !scanning) loadPages(); }, 800);
  }

  // Baja sola desde arriba hasta el final de ESTA página, para que el sitio cargue las
  // imágenes que trae a medida que bajás, y espera a que terminen de cargar.
  async function scrollThrough(keepGoing = () => true) {
    for (let step = 0, y = 0; step < 400 && keepGoing(); step++) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await sleep(300);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (y >= max) break;                                    // la altura se relee: puede crecer
      y = Math.min(y + window.innerHeight * 0.9, max);
    }
    for (let i = 0; i < 20 && keepGoing(); i++) {             // hasta 6 s más para las que quedaron cargando
      const loading = [...document.images].some(im => !im.complete && !im.closest(OURS) && im.getBoundingClientRect().height > 0);
      if (!loading) break;
      await sleep(300);
    }
  }

  // Recorre la página y vuelve a donde estabas. Corre sola al abrir el diálogo si no
  // llegaste al final (se puede apagar desde el ícono de la extensión) o con el botón.
  async function scanPage() {
    if (scanning || saving) return;
    scanning = true;
    refresh();
    const start = window.scrollY;
    await scrollThrough(() => !!saveEl && !saving);
    reachedBottom = true;
    window.scrollTo({ top: start, behavior: 'instant' });
    scanning = false;
    if (saveEl) { refresh(); await loadPages(); }
  }

  function closeSaveDialog() {
    if (saveEl) { saveEl.remove(); saveEl = null; devolverFoco(); }
    pages = []; pagesLoaded = false; lastFailed = 0; lastFaltan = []; lastLocked = false; lastFondo = false; lastFondoTotal = 0; lastTapas = false; loadSeq++;
    ordenManual = false; arrastrada = -1;
    clearTimeout(reloadTimer);
    window.removeEventListener('scroll', onPageScroll);
    document.removeEventListener('load', onImageLoad, true);
  }

  async function saveChapter(thenNext = false) {
    if (saving || !saveEl) return;
    const path = sanitizePath(sv('#mr-save-name').value);
    const formats = { pdf: sv('#mr-save-pdf').checked, cbz: sv('#mr-save-cbz').checked, imgs: sv('#mr-save-imgs').checked };
    if (!formats.pdf && !formats.cbz && !formats.imgs) return setSaveStatus('Elegí al menos un formato', 'error');

    const sel = pages.map((p, i) => ({ url: p.url, n: i + 1, on: p.on })).filter(p => p.on);
    if (!sel.length) return setSaveStatus('No hay páginas seleccionadas', 'error');

    saving = true;
    refresh();
    sv('#mr-save-name').value = path;
    saveEl.querySelectorAll('.mr-thumb.fail').forEach(b => b.classList.remove('fail'));

    // Recordar opciones y la carpeta de la serie para este sitio
    const st = await store.get(['saveFolders']);
    const folders = st.saveFolders || {};
    folders[sitioAca()] = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    store.set({ savePdf: formats.pdf, saveCbz: formats.cbz, saveImgs: formats.imgs, saveFolders: folders });

    setSaveStatus(`⏳ Bajando páginas: 0/${sel.length}…`, 'working');
    // (2.11.4) Guardando de a uno no se corta nada: se guarda lo que bajó. Si una página del capítulo
    // no cargó porque el sitio pidió esperar, el resultado lo dice y no queda anotado como guardado
    // (se puede volver a guardar entero en un rato)
    const cod = codigoDeEspera(lastFaltan);
    const r = await saveCore(path, sel.map(p => p.url), formats, capituloAca(), sel.map(p => p.n), cod ? lastFailed : 0, false, cod);
    saving = false;
    if (!saveEl) return;
    for (const n of r.failedNums) sv(`.mr-thumb[data-i="${n - 1}"]`)?.classList.add('fail');
    refresh();
    setSaveStatus(`${r.complete ? '✅ ' : ''}${r.lines.join('\n')}`, r.complete ? 'success' : 'error');
    if (thenNext && r.complete) goNext();
  }

  // "Guardar y siguiente": abre el capítulo que sigue y deja anotado que hay que abrir
  // el diálogo cuando cargue (sessionStorage es de esta pestaña y de este sitio).
  function goNext() {
    if (!nextUrl) return;
    try { sessionStorage.setItem('mrAutoOpen', String(Date.now())); } catch {}
    setSaveStatus('✅ Guardado. Abriendo el capítulo siguiente…', 'success');
    location.href = nextUrl;
  }

  // ── Varios capítulos: guardado automático ───────────
  // Corre en la pestaña que el service worker abrió para un capítulo del lote.

  function note(text) {
    try { chrome.runtime.sendMessage({ action: 'batchNote', text }, () => void chrome.runtime.lastError); } catch {}
  }

  // fixed = el número viene de la lista de links que pegó el usuario: manda sobre lo que
  // diga el título de la página. volumen y titulo son el tomo y el nombre que el capítulo
  // tiene en la lista del lote: solo los usa la plantilla de nombres ({volumen}, {titulo}).
  async function autoSave({ formats, serie, numero, strict, fixed, volumen, titulo, saltear }) {
    note('buscando las páginas…');
    await pedirArriba();                                                    // en un iframe, el capítulo es el de la página de arriba
    if (document.visibilityState === 'visible') await scrollThrough();      // dispara la carga diferida
    let found = await collectPages();
    // Páginas de fondo deducidas (sin un adaptador que las pida): si las <img> del capítulo todavía no
    // aparecieron (un sitio que arma la página con JavaScript), se las espera hasta 8 s antes de
    // dar por páginas unos fondos que pueden ser adornos (banner-1.jpg, -2, -3). Si aparecen, mandan.
    if (found.fondo && !(adaptadorAca() || {}).fondos) {
      for (let i = 0; i < 16 && countCandidates(true) < 3; i++) await sleep(500);
      if (countCandidates(true) >= 3) found = await collectPages();
    }
    const urls = found.pages.filter(p => !p.flag).map(p => p.url);
    // (2.11.4) ¿El sitio contestó 429 o 503 a alguna página mientras se cargaban? El service worker
    // ya lo miró antes de pedir el guardado; esto cubre las que se pidieron recién acá, al medir las
    // que faltaban. Lo decide él, con lo que anotó, y si cuenta deja al sitio frenado.
    // (las páginas que se van a guardar y las que no cargaron: con eso sabe cuáles faltaron)
    const espera = await bg({ action: 'imagenEnEspera', urls: [...urls, ...(found.faltantes || [])], cargadas: urls, adaptado: hayAdaptador() || !!(adaptadorAca() || {}).fondos }, 5000).catch(() => null);
    let ruta = null, errRuta = null;
    try { ruta = await rutaDelLote({ serie, numero, strict, fixed, volumen, titulo }); } catch (e) { errRuta = e; }
    if (espera?.status) {
      // No se guarda nada a medias. Si ya estaba guardado (y el lote saltea los guardados), sigue siendo "ya estaba".
      if (ruta && saltear && await guardadoAca(ruta.path)) return { name: ruta.path, yaEstaba: true, pages: 0, complete: false, lines: [] };
      throw new Error(`HTTP ${espera.status}: el sitio pidió esperar`);
    }
    // Menos de 3 imágenes no es un capítulo… salvo que un adaptador haya dicho cuáles son: ahí
    // vale lo que haya, aunque sea una sola
    if (urls.length < (hayAdaptador() || !!(adaptadorAca() || {}).fondos ? 1 : 3)) throw new Error(`Sin páginas (encontré ${urls.length})`);
    if (errRuta) throw errRuta;
    const { path, c } = ruta;

    note(`bajando ${urls.length} páginas…`);
    const r = await saveCore(path, urls, formats, c, null, found.failed, true);
    return { name: path, pages: r.pages, complete: r.complete, lines: r.lines };
  }

  // Cómo se llama el capítulo de un lote abierto en esta pestaña: { path, c }. Lo usan autoSave y,
  // desde la 2.11.4, la pregunta "¿ya estaba guardado?" del service worker. Si la dirección se armó
  // a partir del número y el sitio abrió otro capítulo (o su portada), no sirve: un error.
  async function rutaDelLote({ serie, numero, strict, fixed, volumen, titulo }) {
    if (enMarco && !arriba) await pedirArriba();                           // en un iframe, el capítulo es el de la página de arriba
    let c = capituloAca();
    if (strict && c && numero != null && c.numero !== numero) throw new Error(`Sin páginas: se abrió el capítulo ${c.numero}`);
    if (fixed && numero != null) {
      // Sin nombre de serie escrito: el que sale del título, o el título sin sus números
      const fromTitle = cleanSerie((arriba?.titulo || document.title || '').split(/\s+\|\s+/)[0].replace(/\d+(\.\d+)?/g, ' ').replace(/\s+/g, ' ').trim());
      c = { serie: serie || c?.serie || fromTitle || 'Manga', numero };
    } else if (serie) c = { serie, numero: c?.numero ?? numero };
    if (c) Object.assign(c, { volumen: volumen || '', titulo: titulo || '', ...(arriba ? { sitio: arriba.sitio } : {}) });      // también con la serie automática
    return { path: c && c.numero != null && !isNaN(c.numero) ? nameFor(c) : nombreAca(), c };
  }

  // ¿Este capítulo ya está guardado? Por el nombre, o por la dirección de esta página: lo mismo que
  // mira el diálogo de guardar ("✔ Ya lo guardaste…")
  async function guardadoAca(path) {
    const guardados = (await store.get(['savedChapters'])).savedChapters || {};
    const aca = noSlash(claveAca());
    return !!guardados[path] || Object.values(guardados).some(v => noSlash(v?.url || '') === aca);
  }

  // La pregunta del service worker antes de no guardar un capítulo de un lote (2.11.4)
  async function yaGuardado(msg) {
    let ruta;
    try { ruta = await rutaDelLote(msg); } catch { return { guardado: false }; }
    return { guardado: await guardadoAca(ruta.path), name: ruta.path };
  }

  // ── Varios capítulos: diálogo ───────────────────────
  // Se abre desde el ícono de la extensión, el clic derecho o la burbuja, tanto en la
  // página de un capítulo como en la del listado de la serie.

  let chapterEl = null;
  let chapters = [];              // [{numero, title, url?, raw?, seccion?, on, saved, state, note}]
  let chapterWidth = 1;           // dígitos mínimos del número en la dirección
  let batchRunning = false;
  let batchStop = false;
  let batchLabel = '';
  let vistaTomos = false;         // la pestaña "Tomos" está a la vista (en vez de "Capítulos")
  let tomos = [];                 // los capítulos agrupados por tomo (tomosDe), tal como se muestran

  const sc = (sel) => chapterEl?.querySelector(sel);

  function setChapterStatus(text, type = '') {
    const el = sc('#mr-chapter-status');
    if (el) { el.textContent = text; el.className = 'mr-save-status' + (type ? ' ' + type : ''); }
  }

  async function openChapterDialog() {
    if (chapterEl) { sc('#mr-chapter-from')?.focus(); return; }
    if (opening) return;
    opening = true;
    try {
      const st = await store.get(['savePdf', 'saveCbz', 'saveImgs', 'savedChapters', 'batchPad', 'batchVisible']);
      closeSaveDialog();
      savedMap = st.savedChapters || {};

      recordarFoco();
      chapterEl = document.createElement('div');
      chapterEl.id = 'mr-chapter';
      chapterEl.setAttribute('role', 'dialog');
      chapterEl.setAttribute('aria-modal', 'true');
      chapterEl.setAttribute('aria-label', 'Descargar varios capítulos');
      chapterEl.innerHTML = `
        <div class="mr-head">
          <span class="mr-title">📦 Descargar varios capítulos</span>
          <button class="mr-b mr-x" id="mr-chapter-close" title="Cerrar (Esc)" aria-label="Cerrar">✕</button>
        </div>
        <div class="mr-save-body">
          <div class="mr-chapter-cola" id="mr-chapter-cola" hidden>
            <span id="mr-cola-texto"></span>
            <div class="mr-chapter-row">
              <button class="mr-chapter-btn" id="mr-cola-reanudar" type="button">Reanudar</button>
              <button class="mr-chapter-btn" id="mr-cola-reintentar" type="button">Reintentar</button>
              <button class="mr-chapter-btn" id="mr-cola-descartar" type="button" title="Olvida lo que faltaba. Lo ya guardado no se toca">Descartar la cola</button>
            </div>
          </div>
          <div class="mr-chapter-row">
            <span class="mr-save-label">Del</span>
            <input id="mr-chapter-from" class="mr-save-name mr-chapter-num" type="number" min="0" step="any" autocomplete="off" aria-label="Desde el capítulo">
            <span class="mr-save-label">al</span>
            <input id="mr-chapter-to" class="mr-save-name mr-chapter-num" type="number" min="0" step="any" autocomplete="off" aria-label="Hasta el capítulo">
            <button class="mr-chapter-btn" id="mr-chapter-range" type="button">Marcar</button>
          </div>
          <div class="mr-chapter-row">
            <button class="mr-chapter-btn" id="mr-chapter-all" type="button">Todos</button>
            <button class="mr-chapter-btn" id="mr-chapter-none" type="button">Ninguno</button>
            <button class="mr-chapter-btn" id="mr-chapter-reload" type="button" title="Volver a buscar capítulos en la página">↻ Buscar de nuevo</button>
          </div>
          <div class="mr-chapter-row">
            <button class="mr-chapter-btn" id="mr-chapter-ordenar" type="button" title="Del capítulo más bajo al más alto: en ese orden se bajan">Ordenar por número</button>
            <button class="mr-chapter-btn" id="mr-chapter-invertir" type="button" title="Da vuelta la lista: se baja primero lo que está arriba">⇅ Invertir</button>
          </div>
          <div class="mr-save-count" id="mr-chapter-count"></div>
          <div class="mr-save-count" id="mr-chapter-peso" hidden></div>
          <div class="mr-save-hint mr-chapter-why" id="mr-chapter-why" hidden></div>
          <div class="mr-chapter-tabs" id="mr-chapter-tabs" hidden>
            <button class="mr-chapter-tab on" id="mr-tab-cap" type="button">Capítulos</button>
            <button class="mr-chapter-tab" id="mr-tab-tomos" type="button" title="Los capítulos agrupados por los tomos que separa la página">Tomos</button>
          </div>
          <div class="mr-chapter-list" id="mr-chapter-list"></div>
          <div class="mr-chapter-list" id="mr-tomos-list" hidden></div>
          <details class="mr-chapter-more" id="mr-chapter-more">
            <summary>Dirección y nombre de los capítulos</summary>
            <label class="mr-save-label" for="mr-chapter-tpl">Dirección</label>
            <input id="mr-chapter-tpl" class="mr-save-name" type="text" spellcheck="false" autocomplete="off">
            <div class="mr-save-hint"><b>{n}</b> es el número del capítulo. Con eso se arman los que no están en la lista.</div>
            <label class="mr-save-label" for="mr-chapter-serie">Serie</label>
            <input id="mr-chapter-serie" class="mr-save-name" type="text" spellcheck="false" autocomplete="off"
                   placeholder="Automática: sale del título de cada capítulo">
            <div class="mr-save-hint">Cada capítulo se guarda con el mismo nombre y carpetas que al guardarlo de a uno.</div>
            <div class="mr-save-hint mr-chapter-ruta" id="mr-chapter-ruta"></div>
          </details>
          <details class="mr-chapter-more" id="mr-chapter-paste">
            <summary>Pegar los links de los capítulos</summary>
            <textarea id="mr-chapter-links" class="mr-save-name mr-chapter-links" rows="4" spellcheck="false" autocomplete="off" aria-label="Links de los capítulos"
                      placeholder="Pegá los links, uno por renglón o todos juntos. Lo que no sea un link se ignora."></textarea>
            <div class="mr-chapter-row">
              <select id="mr-chapter-links-mode" class="mr-save-name mr-chapter-select" title="De dónde sale el número de cada capítulo" aria-label="De dónde sale el número de cada capítulo">
                <option value="auto">Número: el de cada link</option>
                <option value="order">Número: en el orden pegado</option>
                <option value="reverse">Número: en el orden pegado, al revés</option>
              </select>
              <span class="mr-save-label">desde</span>
              <input id="mr-chapter-links-from" class="mr-save-name mr-chapter-num" type="number" min="0" step="any" autocomplete="off" placeholder="1" aria-label="Número del primer link">
            </div>
            <button class="mr-chapter-btn" id="mr-chapter-links-go" type="button">Usar estos links</button>
            <div class="mr-save-hint" id="mr-chapter-links-msg">El número sale del propio link (o del que escribas adelante: "12: link"). Si los links no lo traen, elegí "en el orden pegado".</div>
          </details>
          <div class="mr-save-opts">
            <label><input type="checkbox" id="mr-chapter-pdf"> 📄 PDF</label>
            <label><input type="checkbox" id="mr-chapter-cbz"> 📚 CBZ</label>
            <label><input type="checkbox" id="mr-chapter-imgs"> 🖼 Imágenes</label>
          </div>
          <label class="mr-chapter-check"><input type="checkbox" id="mr-chapter-skip" checked> Saltear los que ya guardé</label>
          <label class="mr-chapter-check"><input type="checkbox" id="mr-chapter-visible"> Abrir cada capítulo a la vista (probalo si salen sin páginas)</label>
          <button class="mr-save-go" id="mr-chapter-go" type="button">Descargar</button>
          <div class="mr-save-status" id="mr-chapter-status"></div>
        </div>`;
      uiRoot().appendChild(chapterEl);
      makeDraggable(chapterEl, chapterEl.querySelector('.mr-head'));

      sc('#mr-chapter-pdf').checked = st.savePdf !== false;
      sc('#mr-chapter-cbz').checked = st.saveCbz === true;
      sc('#mr-chapter-imgs').checked = st.saveImgs === true;
      sc('#mr-chapter-visible').checked = st.batchVisible === true;
      chapterWidth = (st.batchPad || {})[location.hostname] || 1;

      chapterEl.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape' && !batchRunning) return closeChapterDialog();
        if (e.key === 'Enter' && /^mr-chapter-(from|to)$/.test(e.target.id)) { e.preventDefault(); markRange(); }
        atraparFoco(chapterEl, e);
      });
      for (const type of ['keyup', 'keypress']) chapterEl.addEventListener(type, (e) => e.stopPropagation());
      sc('#mr-chapter-close').onclick = closeChapterDialog;
      sc('#mr-chapter-range').onclick = markRange;
      sc('#mr-chapter-all').onclick = () => { for (const c of chapters) c.on = true; renderChapters(); };
      sc('#mr-chapter-none').onclick = () => { for (const c of chapters) c.on = false; renderChapters(); };
      sc('#mr-chapter-reload').onclick = () => loadChapters(true);
      sc('#mr-chapter-ordenar').onclick = () => { if (!batchRunning) { alReves = false; ordenarCapitulos(); renderChapters(); } };
      sc('#mr-chapter-invertir').onclick = () => { if (!batchRunning) { alReves = !alReves; ordenarCapitulos(); renderChapters(); } };
      sc('#mr-tab-cap').onclick = () => { vistaTomos = false; renderChapters(); };
      sc('#mr-tab-tomos').onclick = () => { vistaTomos = true; renderChapters(); };
      sc('#mr-chapter-links-go').onclick = useLinks;
      sc('#mr-chapter-go').onclick = () => runBatch();
      sc('#mr-cola-reanudar').onclick = () => seguirCola(false);
      sc('#mr-cola-reintentar').onclick = () => seguirCola(true);
      sc('#mr-cola-descartar').onclick = () => bg({ action: 'colaDescartar' }).catch(() => {}).then(mostrarCola);
      sc('#mr-chapter-tpl').addEventListener('change', () => { markSaved(); renderChapters(); });
      sc('#mr-chapter-serie').addEventListener('input', showRoute);
      for (const id of ['pdf', 'cbz', 'imgs', 'skip']) sc(`#mr-chapter-${id}`).addEventListener('change', refreshChapters);
      // Un solo listener para toda la lista: puede tener más de mil capítulos
      sc('#mr-chapter-list').addEventListener('change', (e) => {
        const row = e.target.closest('.mr-chapter-item');
        if (row && chapters[+row.dataset.i]) { chapters[+row.dataset.i].on = e.target.checked; refreshChapters(); }
      });
      // Tildar un tomo marca todos sus capítulos (y destildarlo, ninguno)
      sc('#mr-tomos-list').addEventListener('change', (e) => {
        const g = tomos[+e.target.closest('.mr-tomo-item')?.dataset.g];
        if (!g || batchRunning) return;
        for (const c of g.items) c.on = e.target.checked;
        renderChapters();
        sc(`.mr-tomo-item[data-g="${tomos.indexOf(g)}"] input`)?.focus();        // la lista se redibujó: el foco sigue en ese tomo
      });
      vistaTomos = false;

      loadChapters(false);
      mostrarCola();
      sc('#mr-chapter-from').focus();
    } finally {
      opening = false;
    }
  }

  // Busca los capítulos en la página y arma la lista. Al volver a buscar se conserva lo tildado.
  function loadChapters(keep) {
    const found = collectChapters();
    const prev = new Map(chapters.map(c => [c.numero, c]));
    chapterWidth = Math.max(chapterWidth, found.width);
    chapters = found.list.map(c => ({ ...c, on: keep ? !!prev.get(c.numero)?.on : false, state: '', note: '' }));
    if (keep) {
      for (const c of prev.values()) {
        const i = chapters.findIndex(x => x.numero === c.numero);
        if (i < 0) chapters.push(c);
        else if (c.fixed) chapters[i] = c;            // los links que pegaste mandan sobre lo que se encuentre en la página
      }
    }
    ordenarCapitulos();

    if (!keep) {
      // Si el adaptador del sitio trae la dirección de los capítulos, vale esa: no hay nada que suponer
      const patron = adaptadorAca()?.patron || '';
      sc('#mr-chapter-tpl').value = patron || (found.pat ? found.pat.pre + '{n}' + found.pat.post : '');
      // Sin lista ni número en la dirección no hay forma de saber cómo son las direcciones:
      // se muestra la que se supuso para que la revises
      sc('#mr-chapter-more').open = !patron && ((found.guessed && found.list.length < 2) || !found.pat);
      const why = sc('#mr-chapter-why');
      const ending = 'Así no se pueden armar las direcciones de los otros capítulos. Si sabés cómo son, escribila abajo con {n} en lugar del número.';
      why.hidden = !found.code && !found.file;
      why.textContent = found.code
        ? `⚠️ La dirección de este capítulo no lleva su número: ${found.code} es un código del sitio` +
          (found.current != null ? `, no el capítulo ${found.current}` : '') + '. ' + ending
        : found.file
          ? `⚠️ No encontré los otros capítulos: la dirección de esta página (…/${found.file}) no termina en el número del capítulo, ` +
            'y en la página no hay links a capítulos que reconozca. ' + ending
          : '';
      const max = chapters.length ? chapters[chapters.length - 1].numero : '';
      sc('#mr-chapter-from').value = found.current ?? (chapters.length ? chapters[0].numero : '');
      sc('#mr-chapter-to').value = max !== '' && found.current != null ? Math.max(max, found.current) : max;
    }
    markSaved();
    renderChapters();
  }

  // El orden de la lista es el orden en que se bajan: por número, o al revés (del último al
  // primero) si se la invirtió. Cada vez que la lista cambia se vuelve a ordenar así.
  let alReves = false;
  function ordenarCapitulos() {
    chapters.sort((a, b) => (alReves ? b.numero - a.numero : a.numero - b.numero));
  }

  // De una lista de capítulos con dirección, los que ya figuran en el registro de guardados no
  // se vuelven a bajar. Devuelve { items, descartados }. Se compara como en el resto: por la
  // dirección sin parámetros de seguimiento y sin importar la barra final.
  // `saltear` es la casilla "Saltear los que ya guardé": destildada, entran todos (los querés
  // bajar de nuevo) y no hay nada descartado que avisar.
  function quitarGuardados(items, guardado, saltear = true) {
    if (!saltear) return { items, descartados: 0 };
    const claves = new Set(Object.values(guardado || {}).map(v => noSlash(v.url)));
    const quedan = items.filter(c => { try { return !claves.has(noSlash(pageKey(new URL(c.url)))); } catch { return true; } });
    return { items: quedan, descartados: items.length - quedan.length };
  }

  // "Usar estos links": la lista pasa a ser la de los links pegados, cada uno con su número,
  // todos marcados. Sirve cuando la extensión no puede sacar los capítulos de la página.
  function useLinks() {
    if (batchRunning) return;
    const say = (text, bad) => { const m = sc('#mr-chapter-links-msg'); m.textContent = text; m.classList.toggle('mr-bad', !!bad); m.classList.toggle('mr-done', !bad); };
    const mode = sc('#mr-chapter-links-mode').value;
    const from = parseFloat(sc('#mr-chapter-links-from').value);
    const start = !isNaN(from) ? from : (parseFloat(sc('#mr-chapter-from').value) || 1);
    const r = chaptersFromLinks(sc('#mr-chapter-links').value, mode, start);
    if (!r.items.length) return say('No encontré ningún link en lo que pegaste.', true);
    if (r.items.length > 3000) return say('Son demasiados links juntos (más de 3000).', true);
    // Los que ya están en el registro no entran (salvo que hayas destildado "Saltear los que ya
    // guardé": ahí los querés bajar de nuevo). Los números ya se asignaron: no se corren.
    const limpio = quitarGuardados(r.items, savedMap, sc('#mr-chapter-skip').checked);
    if (!limpio.items.length) return say(`Los ${r.items.length} links que pegaste ya los tenías guardados: no hay nada para bajar.`, true);
    r.items = limpio.items;

    alReves = false;
    chapters = r.items.map(c => ({ numero: c.numero, title: c.title || `Capítulo ${c.numero}`, url: c.url, fixed: true, on: true, state: '', note: '' }));
    const first = chapters[0].numero, last = chapters[chapters.length - 1].numero;
    sc('#mr-chapter-from').value = first;
    sc('#mr-chapter-to').value = last;
    sc('#mr-chapter-why').hidden = true;
    markSaved();
    renderChapters();
    setChapterStatus('');

    const n = chapters.length;
    const how = { label: 'con el número escrito adelante de cada link', link: 'con el número que trae cada link',
                  order: `numerados en el orden en que los pegaste, desde ${first}`, reverse: `numerados del último al primero, desde ${first}` }[r.how];
    // Números que faltan en el medio (solo si son pocos: puede que no existan o que falte pegar alguno)
    const have = new Set(chapters.map(c => c.numero)), missing = [];
    if (r.how === 'label' || r.how === 'link') for (let k = Math.ceil(first); k <= last && missing.length <= 12; k++) if (!have.has(k)) missing.push(k);
    say(`Tomé ${n} link${n === 1 ? '' : 's'}: ${n === 1 ? `capítulo ${first}` : `capítulos ${first} a ${last}`}, ${how}.` +
      (mode === 'auto' && r.how === 'order' ? ' No encontré el número en los links.' : '') +
      (missing.length && missing.length <= 12 ? ` En el medio falta${missing.length === 1 ? '' : 'n'}: ${missing.join(', ')}.` : '') +
      (r.dup ? ` ${r.dup} repetido${r.dup === 1 ? '' : 's'} no entr${r.dup === 1 ? 'ó' : 'aron'}.` : '') +
      (limpio.descartados ? ` ${limpio.descartados} descartado${limpio.descartados === 1 ? '' : 's'} porque ya ${limpio.descartados === 1 ? 'lo' : 'los'} tenías guardado${limpio.descartados === 1 ? '' : 's'}.` : '') +
      (sc('#mr-chapter-serie').value.trim() ? '' : ' Escribí el nombre de la serie en "Serie".'));
    // El nombre de la serie queda a la vista: con links pegados conviene escribirlo
    sc('#mr-chapter-more').open = true;
    if (!sc('#mr-chapter-serie').value.trim()) sc('#mr-chapter-serie').focus();
  }

  // Molde de las direcciones según lo que diga el campo "Dirección": {pre, post} o null
  function tplParts() {
    const v = (sc('#mr-chapter-tpl')?.value || '').trim();
    const k = v.indexOf('{n}');
    if (k < 0 || !/^https?:\/\//i.test(v)) return null;
    return { pre: v.slice(0, k), post: v.slice(k + 3) };
  }

  // Direcciones a probar para un capítulo. Los de la lista tienen la suya; a los que se
  // agregaron por número se les prueba el número con y sin ceros adelante.
  function chapterUrls(c) {
    if (c.url) return [{ url: c.url, form: '' }];
    const t = tplParts();
    if (!t) return [];
    const forms = [...new Set([c.raw, ...numForms(c.numero, chapterWidth)].filter(Boolean))];
    return forms.map(form => ({ url: t.pre + form + t.post, form }));
  }

  function markSaved() {
    const keys = new Set(Object.values(savedMap).map(v => noSlash(v.url)));
    for (const c of chapters) {
      c.saved = chapterUrls(c).some(({ url }) => {
        try { return keys.has(noSlash(pageKey(new URL(url)))); } catch { return false; }
      });
    }
  }

  // "Del … al …": marca ese rango. Los números que no están en la lista se agregan
  // usando la dirección con {n}.
  function markRange() {
    if (batchRunning) return;
    let a = parseFloat(sc('#mr-chapter-from').value), b = parseFloat(sc('#mr-chapter-to').value);
    if (isNaN(a) && isNaN(b)) return setChapterStatus('Escribí desde qué capítulo y hasta cuál', 'error');
    if (isNaN(a)) a = b;
    if (isNaN(b)) b = a;
    if (a > b) [a, b] = [b, a];
    if (b - a > 3000) return setChapterStatus('Es un rango demasiado grande', 'error');
    if (tplParts()) {
      const have = new Set(chapters.map(c => c.numero));
      for (let n = Math.ceil(a); n <= Math.floor(b); n++) {
        if (!have.has(n)) chapters.push({ numero: n, title: `Capítulo ${n}`, on: false, state: '', note: '' });
      }
      ordenarCapitulos();
      markSaved();
    }
    const inRange = chapters.filter(c => c.numero >= a && c.numero <= b);
    for (const c of inRange) c.on = true;
    if (inRange.length || tplParts()) setChapterStatus('');
    else setChapterStatus('Sin una dirección con {n} solo se pueden marcar los capítulos de la lista', 'error');
    renderChapters();
    sc('.mr-chapter-item input:checked')?.closest('.mr-chapter-item')?.scrollIntoView({ block: 'nearest' });
  }

  const STATE_ICON = { run: '⏳', ok: '✅', warn: '⚠️', fail: '⚠️' };
  const rowNote = (c) => (STATE_ICON[c.state] ? STATE_ICON[c.state] + ' ' : '') + (c.note || (c.saved && !c.state ? '✔ guardado' : ''));

  // Dibuja la lista de capítulos y, si la página los separa en tomos, la pestaña "Tomos".
  // Las dos listas muestran lo mismo (qué capítulos están marcados) de dos maneras.
  function renderChapters() {
    const list = sc('#mr-chapter-list');
    if (!list) return;
    tomos = tomosDe(chapters);
    const hayTomos = tomos.some(g => g.seccion);
    if (!hayTomos) vistaTomos = false;
    sc('#mr-chapter-tabs').hidden = !hayTomos;
    sc('#mr-tab-cap').classList.toggle('on', !vistaTomos);
    sc('#mr-tab-tomos').classList.toggle('on', vistaTomos);
    list.hidden = vistaTomos;
    sc('#mr-tomos-list').hidden = !vistaTomos;
    list.innerHTML = chapters.map((c, i) => `
      <label class="mr-chapter-item ${c.state}" data-i="${i}">
        <input type="checkbox" ${c.on ? 'checked' : ''} ${batchRunning ? 'disabled' : ''}>
        <span class="mr-chapter-n">${c.numero}</span>
        <span class="mr-chapter-t">${esc(c.title)}</span>
        <span class="mr-chapter-s">${esc(rowNote(c))}</span>
      </label>`).join('');
    renderTomos();
    refreshChapters();
  }

  // Un renglón por tomo: tildado si todos sus capítulos están marcados, a medias si solo algunos
  function renderTomos() {
    const list = sc('#mr-tomos-list');
    list.innerHTML = !vistaTomos ? '' : tomos.map((g, i) => {
      const n = g.items.length, saved = g.items.filter(c => c.saved).length;
      return `
      <label class="mr-tomo-item${g.seccion ? '' : ' mr-tomo-sin'}" data-g="${i}">
        <input type="checkbox" ${g.items.every(c => c.on) ? 'checked' : ''} ${batchRunning ? 'disabled' : ''}>
        <span class="mr-chapter-t">${esc(g.nombre)}</span>
        <span class="mr-chapter-r">${esc(rangoTomos(g))}</span>
        <span class="mr-chapter-s">${n} capítulo${n === 1 ? '' : 's'}${saved ? ` · ${saved} ✔` : ''}</span>
      </label>`;
    }).join('');
    list.querySelectorAll('input').forEach((inp, i) => {
      const on = tomos[i].items.filter(c => c.on).length;
      inp.indeterminate = on > 0 && on < tomos[i].items.length;
    });
  }

  // Tomo de un capítulo de la lista: el del grupo en el que aparece en la pestaña "Tomos"
  const tomoOf = (c, grupos = tomos) => grupos.find(g => g.seccion && g.items.includes(c))?.seccion || '';

  // Muestra cómo va a quedar guardado un capítulo (el primero marcado), para verlo antes de descargar
  function showRoute() {
    const el = sc('#mr-chapter-ruta');
    if (!el) return;
    const c = chapters.find(x => x.on) || chapters[0];
    // Sin serie escrita sale del título de cada capítulo: acá se muestra la de esta página, si
    // es un capítulo; desde un listado no se sabe todavía, y queda "(serie)" en su lugar
    const serie = sanitizeSegment(sc('#mr-chapter-serie').value.replace(/\//g, '-')) || detectChapter()?.serie || '';
    el.textContent = !c ? '' : `Ejemplo: Descargas/${baseDe(serie || '(serie)')}/${nameFor({ serie: serie || '(serie)', numero: c.numero, volumen: tomoOf(c), titulo: c.title || '' })}` +
      (serie ? '' : ' · la serie sale del título de cada capítulo');
  }

  function setRow(c, state, text) {
    c.state = state;
    c.note = text;
    const row = sc(`.mr-chapter-item[data-i="${chapters.indexOf(c)}"]`);
    if (!row) return;
    row.className = 'mr-chapter-item ' + state;
    row.querySelector('.mr-chapter-s').textContent = rowNote(c);
    if (state === 'run') row.scrollIntoView({ block: 'nearest' });
  }

  function batchTodo() {
    const skip = sc('#mr-chapter-skip').checked;
    return chapters.filter(c => c.on && !(skip && c.saved));
  }

  function refreshChapters() {
    if (!chapterEl) return;
    const marked = chapters.filter(c => c.on).length;
    const todo = batchTodo().length;
    const saved = chapters.filter(c => c.saved).length;
    sc('#mr-chapter-count').textContent = chapters.length
      ? `${chapters.length} capítulo${chapters.length === 1 ? '' : 's'} · ${marked} marcado${marked === 1 ? '' : 's'}` +
        (saved ? ` · ${saved} ya guardado${saved === 1 ? '' : 's'}` : '')
      : 'No encontré capítulos en esta página.' + (tplParts() ? ' Escribí el rango y tocá Marcar.' : '');
    // Cuánto va a ocupar, según lo que pesaron los capítulos ya guardados de este sitio (o de
    // esta serie). Si es mucho se avisa antes de empezar; sin nada guardado todavía, no se dice nada.
    const peso = sc('#mr-chapter-peso');
    const est = MR_AJUSTES.estimarLote(savedMap, { sitio: location.hostname, serie: sc('#mr-chapter-serie').value.trim() || detectChapter()?.serie || '' }, todo);
    peso.hidden = !est || batchRunning;
    if (est) {
      const mucho = est.kb >= MR_AJUSTES.AVISO_TAMANO_KB;
      peso.textContent = (mucho ? '⚠️ ' : '') + `Van a ocupar unos ${MR_AJUSTES.tamanoLegible(est.kb)} (según ${est.de} capítulo${est.de === 1 ? '' : 's'} ya guardado${est.de === 1 ? '' : 's'})` +
        (mucho ? ': fijate que haya lugar en el disco.' : '.');
      peso.classList.toggle('mr-mucho', mucho);
    }
    const anyFmt = sc('#mr-chapter-pdf').checked || sc('#mr-chapter-cbz').checked || sc('#mr-chapter-imgs').checked;
    const go = sc('#mr-chapter-go');
    go.textContent = batchRunning ? 'Cancelar' : `Descargar ${todo} capítulo${todo === 1 ? '' : 's'}`;
    go.classList.toggle('mr-cancel', batchRunning);
    go.disabled = !batchRunning && (!todo || !anyFmt);
    for (const id of ['range', 'all', 'none', 'reload', 'ordenar', 'invertir']) sc(`#mr-chapter-${id}`).disabled = batchRunning;
    showRoute();
  }

  function closeChapterDialog() {
    if (batchRunning) { batchStop = true; bg({ action: 'batchCancel' }).catch(() => {}); }
    if (chapterEl) { chapterEl.remove(); chapterEl = null; devolverFoco(); bg({ action: 'insigniaLimpiar' }).catch(() => {}); }      // ya no hay lote a la vista
    chapters = [];
  }

  // ── La cola del lote ────────────────────────────────
  // Lo que pidió el último lote y cómo le fue a cada capítulo queda en chrome.storage ("cola",
  // la escribe el service worker). Si quedó algo sin bajar —se cerró la pestaña, se canceló o
  // falló—, el diálogo lo ofrece al abrirse en ese sitio y al terminar un lote.

  // Muestra (o esconde) la barra de la cola según lo que haya guardado
  async function mostrarCola() {
    const cola = (await store.get(['cola'])).cola;
    const barra = sc('#mr-chapter-cola');
    if (!barra) return;
    const pend = cola ? cola.items.filter(i => i.estado === 'pendiente').length : 0;
    const fallos = cola ? cola.items.filter(i => i.estado === 'fallo').length : 0;
    barra.hidden = batchRunning || !cola || cola.sitio !== location.hostname || !(pend + fallos);
    if (barra.hidden) return;
    const d = new Date(cola.fecha);
    const cuando = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const partes = [pend ? `falta${pend === 1 ? '' : 'n'} ${pend} capítulo${pend === 1 ? '' : 's'}` : '',
                    fallos ? `${fallos} ${fallos === 1 ? 'falló' : 'fallaron'}` : ''].filter(Boolean);
    sc('#mr-cola-texto').textContent = `Quedó un lote sin terminar (${cuando}${cola.serie ? ', ' + cola.serie : ''}): ${partes.join(' y ')}.`;
    sc('#mr-cola-reanudar').hidden = !pend;
    sc('#mr-cola-reanudar').textContent = `Reanudar (${pend})`;
    sc('#mr-cola-reintentar').hidden = !fallos;
    sc('#mr-cola-reintentar').textContent = fallos === 1 ? 'Reintentar el que falló' : `Reintentar los ${fallos} que fallaron`;
  }

  // El botón "Reintentar los que fallaron" de la notificación del lote: abre el diálogo de varios
  // capítulos y hace lo mismo que su botón "Reintentar" (seguirCola(true)). Si el diálogo se estaba
  // abriendo justo en ese momento, se espera a que esté.
  async function abrirLoteYSeguir(reintentar) {
    await openChapterDialog();
    for (let i = 0; i < 50 && !chapterEl && opening; i++) await sleep(100);
    if (reintentar) seguirCola(true);
  }

  // Sigue la cola guardada: la lista del diálogo pasa a ser lo que le falta y arranca.
  // Con `fallados`, los que fallaron vuelven antes a pendiente.
  let colaArrancando = false;     // ya se tocó Reanudar o Reintentar y todavía se está leyendo la cola
  async function seguirCola(fallados) {
    if (batchRunning || colaArrancando || !chapterEl) return;
    // El estado cambia ya, igual que en runBatch: leer la cola es una ida y vuelta, y mientras
    // tanto seguiría a la vista el final del lote anterior ("Listo", "Cancelado"), como si el
    // botón no hubiera hecho nada. Y un segundo clic en ese rato cancelaría el lote recién arrancado.
    colaArrancando = true;
    setChapterStatus('Preparando el lote…', 'working');
    let cola = null;
    try {
      cola = (await store.get(['cola'])).cola;
      if (cola && fallados) cola = (await bg({ action: 'colaReintentar', id: cola.id }).catch(() => ({}))).cola || cola;
    } finally { colaArrancando = false; }
    const faltan = cola ? cola.items.filter(i => i.estado === 'pendiente') : [];
    if (!faltan.length || !chapterEl) { setChapterStatus(''); return mostrarCola(); }
    if (cola.plantilla) sc('#mr-chapter-tpl').value = cola.plantilla;
    sc('#mr-chapter-serie').value = cola.serie || '';
    for (const k of ['pdf', 'cbz', 'imgs']) sc(`#mr-chapter-${k}`).checked = !!(cola.formatos || {})[k];
    sc('#mr-chapter-visible').checked = !!cola.visible;
    // Los que se armaron con el número van sin dirección: se arma de nuevo, con los ceros que use el sitio
    chapters = faltan.map(i => ({ numero: i.numero, title: i.titulo || `Capítulo ${i.numero}`, ...(i.armado ? {} : { url: i.url }),
      ...(i.volumen ? { seccion: i.volumen } : {}), fixed: !!i.fixed, on: true, state: '', note: '' }));
    markSaved();
    renderChapters();
    runBatch(cola.id);
  }

  // Baja los capítulos marcados, uno tras otro. Con un lote en marcha, el mismo botón lo cancela.
  // `seguir` es el id de la cola guardada cuando se la está siguiendo; si no, se arma una nueva.
  async function runBatch(seguir = '') {
    if (!chapterEl) return;
    if (batchRunning) {
      batchStop = true;
      setChapterStatus('Cancelando…', 'working');
      bg({ action: 'batchCancel' }).catch(() => {});
      return;
    }
    const formats = { pdf: sc('#mr-chapter-pdf').checked, cbz: sc('#mr-chapter-cbz').checked, imgs: sc('#mr-chapter-imgs').checked };
    if (!formats.pdf && !formats.cbz && !formats.imgs) return setChapterStatus('Elegí al menos un formato', 'error');
    const todo = batchTodo();
    if (!todo.length) {
      // Siguiendo una cola: si todo lo que faltaba ya está guardado (se bajó de a uno mientras
      // tanto) no hay nada que hacer, y la cola se cierra. Si no, "Reanudar" quedaría ofrecido
      // para siempre sin poder hacer nada.
      if (seguir && chapters.some(c => c.on)) {
        for (const c of chapters) if (c.on) await bg({ action: 'colaMarca', id: seguir, numero: c.numero, estado: 'listo' }).catch(() => {});
        await bg({ action: 'colaFin', id: seguir, motivo: 'cancelado' }).catch(() => {});      // (sin notificación: no se bajó nada)
        mostrarCola();
        return setChapterStatus('Lo que faltaba ya estaba guardado: no queda nada por bajar.', 'success');
      }
      return setChapterStatus('No hay capítulos para bajar', 'error');
    }
    if (todo.some(c => !c.url) && !tplParts()) {
      sc('#mr-chapter-more').open = true;
      return setChapterStatus('A la dirección de los capítulos le falta {n}', 'error');
    }
    const serie = sanitizeSegment(sc('#mr-chapter-serie').value.replace(/\//g, '-'));
    const visible = sc('#mr-chapter-visible').checked;
    // (2.11.4) A un capítulo al que le faltó una página porque el sitio pidió esperar no se lo
    // guarda; si al abrirlo resulta que ya estaba guardado (y se saltean los guardados), sigue siendo "ya estaba"
    const saltear = sc('#mr-chapter-skip').checked;
    store.set({ savePdf: formats.pdf, saveCbz: formats.cbz, saveImgs: formats.imgs, batchVisible: visible });

    batchRunning = true;
    batchStop = false;
    for (const c of chapters) { c.state = ''; c.note = ''; }
    renderChapters();
    // El estado cambia ya, antes de guardar la cola (que es una ida y vuelta al service worker):
    // si no, por un instante sigue a la vista el "Listo" del lote anterior, como si no hubiera arrancado.
    setChapterStatus('Preparando el lote…', 'working');

    const problems = [];
    let okCount = 0, yaEstaban = 0, calls = 0, empty = 0, halt = '';
    const startWidth = chapterWidth;
    const grupos = tomosDe(chapters);                      // el tomo de cada capítulo, para {volumen}

    // La cola: una nueva con lo que se va a bajar, o la guardada que se está siguiendo. En esa,
    // lo que se saltea por estar ya guardado se da por listo (si no, nunca terminaría).
    let colaId = seguir;
    const anotar = (c, estado, error = '') => bg({ action: 'colaMarca', id: colaId, numero: c.numero, estado, error }).catch(() => {});
    if (colaId) {
      for (const c of chapters) if (c.on && !todo.includes(c)) await anotar(c, 'listo');
    } else {
      colaId = (await bg({ action: 'colaNueva', serie, formatos: formats, visible, sitio: location.hostname, origen: pageKey(),
        plantilla: (sc('#mr-chapter-tpl')?.value || '').trim(),
        items: todo.map(c => ({ url: chapterUrls(c)[0]?.url || '', numero: c.numero, titulo: c.title || '', volumen: tomoOf(c, grupos), armado: !c.url, fixed: !!c.fixed })),
      }).catch(() => ({}))).id || '';
    }
    mostrarCola();

    // Cuando un capítulo responde 429 o 503 (su página o sus imágenes), el service worker anota
    // hasta cuándo no pedirle a ese sitio ("esperaSitio"): lo que dijo en Retry-After, con tope de
    // un minuto, o un minuto si no dijo cuánto. Acá se frena hasta ese momento antes de cada
    // pedido, con la cuenta regresiva a la vista: vale para el reintento y para el capítulo que sigue.
    const faltaEsperar = async (c) => {
      let sitio = '';
      try { sitio = new URL(chapterUrls(c)[0].url).hostname; } catch {}
      const hasta = ((await store.get(['esperaSitio'])).esperaSitio || {})[sitio] || 0;
      return Math.max(0, hasta - Date.now());
    };
    // (2.11.4) La espera se vuelve a leer cada segundo: si mientras tanto el sitio pidió más (por
    // ejemplo, a otro lote del mismo sitio), se espera eso. Cada vuelta duerme hasta el próximo
    // segundo entero que falta, así la cuenta baja de a uno sin saltearse números.
    const frenar = async (c) => {
      for (let ms = await faltaEsperar(c); ms > 0 && !batchStop && chapterEl; ms = await faltaEsperar(c)) {
        const s = Math.ceil(ms / 1000);
        setRow(c, 'run', `el sitio pidió esperar: sigo en ${s} s`);
        setChapterStatus(`${batchLabel}: el sitio pidió esperar, sigo en ${s} s…`, 'working');
        await sleep(ms - (s - 1) * 1000 + 5);
      }
    };

    let yaEspero = false;                                  // el lote ya reintentó un capítulo porque el sitio pidió esperar
    for (let i = 0; i < todo.length && !batchStop && !halt && chapterEl; i++) {
      const c = todo[i];
      batchLabel = `(${i + 1}/${todo.length}) Capítulo ${c.numero}`;
      let res = null, err = null;
      // Un intento del capítulo: prueba sus direcciones hasta que una tiene páginas
      const intentar = async () => {
        res = null; err = null;
        for (const { url, form } of chapterUrls(c)) {
          const pause = MR_AJUSTES.pausaAntes(calls++, ritmo);
          const texto = pause >= 10000 ? `descanso de ${Math.round(pause / 1000)} s…` : 'abriendo…';
          setRow(c, 'run', texto);
          setChapterStatus(`${batchLabel}: ${texto}`, 'working');
          try {
            res = await bg({ action: 'batchChapter', url, formats, serie, numero: c.numero, strict: !c.url, fixed: !!c.fixed, visible,
                             volumen: tomoOf(c, grupos), titulo: c.title || '', pause, cola: colaId, saltear }, 300000 + pause);
            if (/^0\d/.test(form)) chapterWidth = Math.max(chapterWidth, form.split('.')[0].length);   // el sitio usa ceros adelante
            break;
          } catch (e) {
            err = e;
            if (batchStop || !/^sin páginas/i.test(e.message)) break;       // solo se prueba otra forma del número si no había páginas
          }
        }
      };
      const motivo = () => (res ? (res.complete || res.yaEstaba ? '' : res.lines.join(' ')) : err?.message || '');
      // A un sitio que pidió esperar no se le pide nada antes de tiempo (lo pudo pedir el capítulo
      // anterior, o un lote de hace un momento)
      await frenar(c);
      if (!chapterEl) break;                                // se cerró el diálogo mientras esperaba: queda pendiente
      if (!batchStop) await intentar();
      // El sitio pidió esperar (429 o 503), con la página del capítulo o con sus imágenes: seguir
      // pidiendo solo alarga el castigo. Se espera lo que pidió y el capítulo se reintenta, una
      // sola vez por lote; si vuelve a pasar, queda en falla (y el que sigue también espera).
      if (!batchStop && chapterEl && MR_AJUSTES.pidioEsperar(motivo()) && !yaEspero) {
        yaEspero = true;
        await frenar(c);
        if (!batchStop && chapterEl) await intentar();
      }
      const esperar = MR_AJUSTES.pidioEsperar(motivo());
      const noPages = !res && /^sin páginas/i.test(err?.message || '');
      empty = noPages ? empty + 1 : 0;
      if (res?.yaEstaba) {
        // (2.11.4) Le faltó una página porque el sitio pidió esperar, pero ya estaba guardado: no hay
        // nada que reintentar (el sitio igual quedó frenado, y el que sigue espera)
        yaEstaban++;
        c.saved = true;
        setRow(c, 'ok', 'ya estaba guardado');
        await anotar(c, 'listo');
      } else if (res?.complete) {
        okCount++;
        c.saved = true;
        setRow(c, 'ok', `${res.pages} páginas`);
        await anotar(c, 'listo');
      } else if (esperar && (res || !batchStop)) {
        // Lo pidió la página del capítulo, lo pidieron sus imágenes al guardarlas o al cargarlas en la
        // página: es lo mismo. No se guardó nada a medias y queda en la cola para "Reintentar". El
        // motivo lleva el código (desde la 2.11.4).
        const codigo = (motivo().match(/HTTP (429|503)/) || [])[1];
        const why = 'el sitio pidió esperar' + (codigo ? ` (HTTP ${codigo})` : '');
        problems.push(`Capítulo ${c.numero}: ${why}`);
        setRow(c, 'fail', 'pidió esperar');
        await anotar(c, 'fallo', why);
      } else if (res) {
        const why = res.lines.filter(l => l.startsWith('⚠️')).map(l => l.replace(/^⚠️\s*/, '')).join(' · ') || 'quedó incompleto';
        problems.push(`Capítulo ${c.numero}: ${why}`);
        setRow(c, 'warn', 'incompleto');
        await anotar(c, 'fallo', why);
      } else if (batchStop) {
        setRow(c, '', '');                                    // cancelado: queda pendiente en la cola
      } else {
        const why = err ? err.message : 'no se pudo abrir';
        problems.push(`Capítulo ${c.numero}: ${why}`);
        setRow(c, 'fail', noPages ? 'sin páginas' : 'falló');
        await anotar(c, 'fallo', why);
      }
      // Varios seguidos sin páginas: la dirección no es la de los capítulos, o no hay más
      if (empty >= BATCH_MAX_EMPTY && i < todo.length - 1) {
        const pasted = todo.every(x => x.fixed);              // links pegados: no hay una dirección con {n} que revisar
        halt = okCount
          ? `${empty} capítulos seguidos no tenían páginas` + (pasted ? '.' : ': puede que el sitio no tenga más con esa dirección.')
          : pasted
            ? `Los primeros ${empty} links no tenían páginas: revisá que sean de capítulos.`
            : `Los primeros ${empty} capítulos no tenían páginas: la dirección no debe ser la de los capítulos. Revisala en "Dirección y nombre de los capítulos".`;
        if (!okCount && !pasted) sc('#mr-chapter-more').open = true;
      }
    }

    batchRunning = false;
    // Si salió todo, la cola se borra; si no, queda ofrecida. De paso se avisa que terminó.
    await bg({ action: 'colaFin', id: colaId, motivo: batchStop ? 'cancelado' : halt ? 'parado' : 'listo' }).catch(() => {});
    mostrarCola();
    if (chapterWidth !== startWidth) {
      const pad = (await store.get(['batchPad'])).batchPad || {};
      pad[location.hostname] = chapterWidth;
      store.set({ batchPad: pad });
    }
    if (!chapterEl) return;
    savedMap = (await store.get(['savedChapters'])).savedChapters || {};
    markSaved();
    refreshChapters();
    for (const c of chapters) if (c.on && c.state === 'ok') c.on = false;       // lo que salió bien se destilda
    renderChapters();
    const head = `${batchStop ? 'Cancelado' : halt ? 'Parado' : 'Listo'}: ${okCount} capítulo${okCount === 1 ? '' : 's'} guardado${okCount === 1 ? '' : 's'}` +
                 (yaEstaban ? ` · ${yaEstaban} ya estaba${yaEstaban === 1 ? '' : 'n'} guardado${yaEstaban === 1 ? '' : 's'}` : '') +
                 (problems.length ? ` · ${problems.length} con problemas` : '');
    const hint = problems.some(p => /sin páginas/i.test(p)) && !visible
      ? '\nSi el capítulo existe, probá tildar "Abrir cada capítulo a la vista".' : '';
    const clean = !problems.length && !batchStop && !halt;
    setChapterStatus([(clean ? '✅ ' : '') + head, ...(halt ? [halt] : []), ...problems].join('\n') + hint,
                     problems.length || halt ? 'error' : clean ? 'success' : 'working');
  }

  function makeDraggable(el, h) {
    let sx, sy, sl, st;
    h.style.cursor = 'grab';
    h.onmousedown = (e) => {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault(); sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect(); sl = r.left; st = r.top;
      h.style.cursor = 'grabbing';
      const mv = (ev) => { el.style.right = 'auto'; el.style.left = (sl + ev.clientX - sx) + 'px'; el.style.top = (st + ev.clientY - sy) + 'px'; };
      const up = () => { h.style.cursor = 'grab'; document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    };
  }

  // ── Burbuja flotante ────────────────────────────────
  // Aparece en páginas que parecen un capítulo. Clic = guardar; se arrastra a cualquier
  // lugar (recuerda la posición); la "i" muestra los controles rápidos.

  let fabEl = null;
  let fabPos = { r: 24, b: 24 };

  function looksLikeChapter() {
    // Con un adaptador, el capítulo es lo que señalan sus selectores: alcanza con que haya algo
    // cargado ahí, del tamaño que sea (las reglas de abajo son las de la detección automática)
    const adaptado = typeof hayAdaptador === 'function' && hayAdaptador();
    const dirs = new Map();
    const grandes = [];                               // a dónde lleva cada <img> que el diálogo ofrecería ('' si no es una tapa)
    for (const img of (typeof imagenesDeLaPagina === 'function' ? imagenesDeLaPagina() : document.querySelectorAll('img'))) {
      if (img.closest(OURS)) continue;                // las miniaturas del diálogo no cuentan
      const u = imgUrl(img);                          // las blob: no tienen dirección: no cuentan
      if (u && (adaptado ? img.naturalWidth > 0 : img.naturalWidth >= MIN_SIDE && img.naturalHeight >= 600)) {
        const d = urlDir(u);
        dirs.set(d, (dirs.get(d) || 0) + 1);
      }
      if (u && !adaptado && img.naturalWidth >= MIN_SIDE && img.naturalHeight >= MIN_SIDE) grandes.push(typeof destinoDeTapa === 'function' ? destinoDeTapa(img) : '');
    }
    const pideFondos = typeof adaptadorAca === 'function' && !!(adaptadorAca() || {}).fondos;
    if (adaptado) return dirs.size > 0 || (pideFondos && cuentaDeFondo(0, true) > 0);
    if (Math.max(0, ...dirs.values()) >= 3) return true;      // 3+ imágenes grandes en la misma carpeta
    // Un lector que dibuja las páginas de fondo también parece un capítulo, con 3 o más; pero si hay
    // <img> que el diálogo ofrecería (todas menos una grilla de tapas), deciden ellas, como en el diálogo
    const hayImagenes = grandes.length > 0 && !(typeof esGrillaDeTapas === 'function' && esGrillaDeTapas(grandes));
    return !hayImagenes && typeof cuentaDeFondo === 'function' && cuentaDeFondo(0, false) >= 3;
  }

  function placeFab(pos) {
    const r = Math.min(Math.max(8, pos.r), window.innerWidth - 60);
    const b = Math.min(Math.max(8, pos.b), window.innerHeight - 60);
    fabEl.style.right = r + 'px';
    fabEl.style.bottom = b + 'px';
    // El cartel de ayuda se abre hacia donde haya lugar
    const rect = fabEl.getBoundingClientRect();
    fabEl.classList.toggle('mr-fab-low', rect.top < 340);
    fabEl.classList.toggle('mr-fab-leftside', rect.left < 280);
    return { r, b };
  }

  async function showFab() {
    if (fabEl || cedido) return;
    const st = await store.get(['fabEnabled', 'fabPos', 'fabBlockedHosts']);
    if (st.fabEnabled === false || fabEl) return;
    // Con iframes de por medio la burbuja va en un solo marco, el que tiene más páginas: se
    // pregunta antes de mostrarla. Una página sin iframes no pregunta nada.
    if (enMarco || window.frames.length) {
      await pedirArriba();
      if ((st.fabBlockedHosts || []).includes(sitioAca())) return;      // el sitio es el de la página de arriba
      const r = await bg({ action: 'candidato' }, 8000).catch(() => null);
      if (r && !r.gana) { cedido = true; return; }
      if (fabEl || cedido) return;
    }
    fabPos = st.fabPos || { r: 24, b: 24 };

    fabEl = document.createElement('div');
    fabEl.id = 'mr-fab';
    fabEl.innerHTML = `
      <button class="mr-fab-main" type="button" title="Guardar capítulo (Alt+S) · arrastrá para mover" aria-label="Guardar capítulo">💾</button>
      <button class="mr-fab-i" type="button" title="Controles rápidos" aria-label="Controles rápidos">i</button>
      <div class="mr-fab-info" hidden>
        <div class="mr-fab-info-title">Controles rápidos</div>
        <ul>
          <li><b>Clic en la burbuja</b> — guardar capítulo</li>
          <li><b>Arrastrar la burbuja</b> — moverla de lugar</li>
          <li><kbd>Alt</kbd>+<kbd>S</kbd> — abrir "Guardar capítulo"</li>
          <li><kbd>Enter</kbd> — guardar · <kbd>Esc</kbd> — cerrar</li>
          <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> — guardar y abrir el siguiente</li>
          <li><b>Clic en una miniatura</b> — incluir o quitar esa página</li>
          <li><b>/</b> en el nombre — crea carpetas</li>
        </ul>
        <button class="mr-fab-btn mr-fab-batch" type="button">📦 Descargar varios capítulos</button>
        <button class="mr-fab-btn mr-fab-site" type="button">No mostrar en este sitio</button>
        <button class="mr-fab-btn mr-fab-hide" type="button">Ocultar burbuja en todos lados</button>
        <div class="mr-fab-note">Se reactiva desde el ícono de la extensión</div>
      </div>`;
    uiRoot().appendChild(fabEl);
    fabPos = placeFab(fabPos);

    const main = fabEl.querySelector('.mr-fab-main');
    const info = fabEl.querySelector('.mr-fab-info');
    let drag = null;

    main.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, r: fabPos.r, b: fabPos.b, moved: false };
      try { main.setPointerCapture(e.pointerId); } catch {}
    });
    main.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;     // tolerancia: un clic no es arrastre
      drag.moved = true;
      fabEl.classList.add('mr-fab-dragging');
      info.hidden = true;
      fabPos = placeFab({ r: drag.r - dx, b: drag.b - dy });
    });
    const endDrag = (e) => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      fabEl.classList.remove('mr-fab-dragging');
      try { main.releasePointerCapture(e.pointerId); } catch {}
      if (moved) store.set({ fabPos });
      else if (e.type === 'pointerup') openSaveDialog();
    };
    main.addEventListener('pointerup', endDrag);
    main.addEventListener('pointercancel', endDrag);

    fabEl.querySelector('.mr-fab-i').onclick = () => { info.hidden = !info.hidden; placeFab(fabPos); };
    // La lista de capítulos está en la página de arriba: desde un iframe, el diálogo se abre allá
    fabEl.querySelector('.mr-fab-batch').onclick = () => { info.hidden = true; enMarco ? bg({ action: 'tab', command: 'batch' }).catch(() => {}) : openChapterDialog(); };
    fabEl.querySelector('.mr-fab-hide').onclick = () => store.set({ fabEnabled: false });
    fabEl.querySelector('.mr-fab-site').onclick = async () => {
      const hosts = (await store.get(['fabBlockedHosts'])).fabBlockedHosts || [];
      if (!hosts.includes(sitioAca())) hosts.push(sitioAca());
      store.set({ fabBlockedHosts: hosts });
    };
  }

  function hideFab() { if (fabEl) { fabEl.remove(); fabEl = null; } }

  // Estos dos se registran una sola vez, no cada vez que aparece la burbuja
  // (composedPath: visto desde el documento, un clic adentro del shadow root tiene por target al host)
  on(document, 'pointerdown', (e) => {
    if (fabEl && !e.composedPath().includes(fabEl)) fabEl.querySelector('.mr-fab-info').hidden = true;
  });
  on(window, 'resize', () => { if (fabEl) fabPos = placeFab(fabPos); });

  let fabOff = false;             // la burbuja está oculta en todos lados
  let fabBlocked = false;         // …o solo en este sitio
  let cedido = false;             // otro marco de la pestaña tiene más páginas: la burbuja va allá
  let fabCheckTimer = null;
  let fabTries = 0;
  let fabHref = location.href;

  function fabSettings(s) {
    fabOff = s.fabEnabled === false;
    fabBlocked = (s.fabBlockedHosts || []).includes(sitioAca());
  }

  // Plantilla de nombres guardada en opciones. Vacía o igual a la predeterminada es "sin
  // plantilla": el nombre se arma como siempre (nameFor).
  const esquemaDe = (v) => (typeof v === 'string' && v.trim() && v.trim() !== PLANTILLA_DEFECTO ? v.trim() : null);

  const onStorage = (ch, area) => {
    if (area !== 'local') return;
    if (ch.sagas) userSagas = ch.sagas.newValue || {};
    if (ch.esquemaNombres) { esquemaNombres = esquemaDe(ch.esquemaNombres.newValue); showRoute(); }
    if (ch.ritmo) ritmo = MR_AJUSTES.normalizarRitmo(ch.ritmo.newValue);
    if (ch.carpetaBase) { carpetaTpl = typeof ch.carpetaBase.newValue === 'string' ? ch.carpetaBase.newValue : ''; refresh(); showRoute(); }
    // Cambió el adaptador con el diálogo abierto: se busca de nuevo y la selección empieza de cero
    // (lo que estaba destildado por sospechoso ahora puede ser justo lo que señala el adaptador)
    if (ch.adaptadores) { adaptadores = ch.adaptadores.newValue || {}; fabTries = 0; if (saveEl && !saving) { pages = []; ordenManual = false; loadPages(); } }
    if (ch.fabEnabled || ch.fabBlockedHosts) {
      store.get(['fabEnabled', 'fabBlockedHosts']).then(s => {
        fabSettings(s);
        if (fabOff || fabBlocked) hideFab();
        else { fabTries = 0; if (looksLikeChapter()) showFab(); }
      });
    }
  };
  chrome.storage.onChanged.addListener(onStorage);
  offs.push(() => chrome.storage.onChanged.removeListener(onStorage));

  // ¿Es un capítulo? Se revisa al rato de cargar y otra vez cada vez que termina de
  // cargar una imagen o bajás por la página, hasta que aparece la burbuja. En los sitios
  // que cargan las páginas a medida que bajás, al principio puede haber menos de 3.
  // Si después de varias revisiones no lo parece, se deja de mirar (para no gastar en
  // páginas que no son de manga) hasta que cambie la dirección.
  function checkFab() {
    if (!alive()) return cleanup();                 // la extensión se actualizó: esta copia ya no sirve
    if (location.href !== fabHref) {                // el sitio cambió de página sin recargar
      fabHref = location.href;
      fabTries = 0;
      cedido = false;                               // otra página: se vuelve a preguntar
      if (!saveEl && !chapterEl) hideFab();
    }
    if (fabEl || fabOff || fabBlocked || fabCheckTimer || fabTries >= FAB_MAX_TRIES) return;
    fabCheckTimer = setTimeout(() => {
      fabCheckTimer = null;
      fabTries++;
      if (!fabEl && !fabOff && !fabBlocked && looksLikeChapter()) showFab();
    }, 700);
  }
  store.get(['fabEnabled', 'fabBlockedHosts', 'sagas', 'esquemaNombres', 'ritmo', 'adaptadores', 'carpetaBase']).then(s => {
    fabSettings(s); userSagas = s.sagas || {}; esquemaNombres = esquemaDe(s.esquemaNombres);
    if (s.ritmo) ritmo = MR_AJUSTES.normalizarRitmo(s.ritmo);
    adaptadores = s.adaptadores || {};
    carpetaTpl = typeof s.carpetaBase === 'string' ? s.carpetaBase : '';
  });
  on(document, 'load', (e) => { if (e.target?.tagName === 'IMG') checkFab(); }, true);
  on(window, 'scroll', checkFab, { passive: true });
  setTimeout(checkFab, 1500);
  setTimeout(checkFab, 5000);

  // ── Mensajes ────────────────────────────────────────

  const onMessage = (msg, sender, sendResponse) => {
    switch (msg?.action) {
      case 'ping': sendResponse({ ok: true }); return;
      case 'save': openSaveDialog(); sendResponse({ ok: true }); return;
      // (reintentar: viene del botón de la notificación del lote, y el diálogo retoma lo que falló)
      case 'batch': abrirLoteYSeguir(!!msg.reintentar); sendResponse({ ok: true }); return;
      // Lo pide un iframe de esta página: el capítulo que tiene adentro es el de acá
      case 'contexto':
        sendResponse({ ok: true, contexto: { nombre: suggestName(), capitulo: detectChapter(), clave: pageKey(), sitio: location.hostname, titulo: document.title } });
        return;
      case 'ceder': cedido = true; hideFab(); return;
      case 'probarAdaptador': sendResponse({ ok: true, ...probarAdaptador(msg.adaptador), pagina: location.href }); return;
      case 'autoSave':
        autoSave(msg).then(r => sendResponse({ ok: true, ...r })).catch(e => sendResponse({ ok: false, error: e.message }));
        return true;
      // (2.11.4) Al capítulo de un lote le faltó una página porque el sitio pidió esperar: ¿ya estaba guardado?
      case 'yaGuardado':
        yaGuardado(msg).then(r => sendResponse({ ok: true, ...r })).catch(e => sendResponse({ ok: false, error: e.message }));
        return true;
      case 'progress':
        if (saving) setSaveStatus(`⏳ Bajando páginas: ${msg.done}/${msg.total}…`, 'working');
        return;
      case 'batchNote':
        if (batchRunning && !batchStop) {
          setChapterStatus(`${batchLabel}: ${msg.text}`, 'working');
          const running = chapters.find(c => c.state === 'run');
          if (running) setRow(running, 'run', msg.text);
        }
        return;
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);
  offs.push(() => chrome.runtime.onMessage.removeListener(onMessage));

  // Si venís de "Guardar y siguiente", el diálogo se abre solo cuando el capítulo terminó de armarse
  (async () => {
    let t = 0;
    try { t = +sessionStorage.getItem('mrAutoOpen') || 0; sessionStorage.removeItem('mrAutoOpen'); } catch {}
    if (!t || Date.now() - t > 60000) return;
    for (let i = 0; i < 40 && alive(); i++) {
      await sleep(500);
      if (looksLikeChapter()) return openSaveDialog();
    }
  })();
})();
