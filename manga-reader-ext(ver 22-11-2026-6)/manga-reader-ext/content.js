/**
 * Manga Reader v2.9.1 - Content Script
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

  const OURS = '#mr-save, #mr-chapter, #mr-fab';      // lo que esta extensión inserta en la página
  const MIN_SIDE = 250;          // menos que esto: íconos, logos chicos, banners
  const PROBE_CONCURRENCY = 6;   // imágenes sin cargar que se miden a la vez
  const BATCH_PAUSE = 1500;      // respiro entre capítulos de un lote (ms)
  const BATCH_MAX_EMPTY = 3;     // capítulos seguidos "sin páginas" después de los cuales el lote para
  const FAB_MAX_TRIES = 40;      // revisiones de la burbuja antes de dejar de mirar la página

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
    const big = (w, h) => w >= MIN_SIDE && h >= MIN_SIDE;
    for (const img of document.querySelectorAll('img')) {
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

      // Lazy pendiente (data-src) o imagen que el navegador todavía no bajó (loading="lazy"):
      // se mide la imagen real, y de paso queda cargada
      const lazyPending = url === lazyUrl(img) && (img.naturalWidth || 0) < MIN_SIDE;
      if (lazyPending || !img.complete) {
        seen.add(url);
        entries.push({ url, external, probe: true });
        continue;
      }
      if (!img.naturalWidth) { seen.add(url); failedUrls.push(url); continue; }   // imagen rota
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w >= MIN_SIDE && h >= MIN_SIDE) {
        seen.add(url);
        entries.push({ url, external, w, h });
      }
    }

    // Las que faltan medir se cargan de a pocas: todas juntas, con una conexión lenta
    // las últimas se quedan sin tiempo y cuentan como caídas sin estarlo.
    const pending = entries.filter(e => e.probe);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, pending.length) }, async () => {
      while (next < pending.length) {
        const e = pending[next++];
        e.size = await probeSize(e.url);
      }
    }));

    const pages = [];
    for (const e of entries) {
      if (e.probe) {
        if (!e.size) { failedUrls.push(e.url); continue; }          // no cargó (error o timeout)
        if (e.size.w < MIN_SIDE || e.size.h < MIN_SIDE) continue;
        e.w = e.size.w; e.h = e.size.h;
      }
      pages.push({ url: e.url, w: e.w, h: e.h, external: e.external, flag: '' });
    }
    const mainDir = flagNonPages(pages);
    // Solo cuentan como "faltantes" las que fallaron dentro de la carpeta del capítulo
    // (un banner o pixel roto del sitio no es una página perdida)
    const failed = mainDir ? failedUrls.filter(u => urlDir(u) === mainDir).length : 0;
    // Páginas sin dirección: al menos 2, y lo que se encontró no arma un capítulo (no hay una
    // carpeta con la mayoría de las imágenes) o es menos que esas
    const locked = lockedCount >= 2 && (!mainDir || lockedCount >= pages.filter(p => !p.flag).length);
    if (locked) for (const p of pages) p.flag ||= 'no parece una página del capítulo';
    return { pages, failed, locked };
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
  function countCandidates() {
    const dirs = new Map();
    for (const img of document.querySelectorAll('img')) {
      if (img.closest(OURS)) continue;
      const url = imgUrl(img);
      if (!url) continue;
      if (img.complete && img.naturalWidth && (img.naturalWidth < MIN_SIDE || img.naturalHeight < MIN_SIDE)) continue;
      const d = urlDir(url);
      dirs.set(d, (dirs.get(d) || 0) + 1);
    }
    return Math.max(0, ...dirs.values());
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

  // Nombre ya ordenado para {serie, numero}: "One Piece/11 Saga Final/One Piece 1134"
  function nameFor(c) {
    const serie = sanitizeSegment(c.serie.replace(/\//g, '-'));
    const num = fmtNum(c.numero);                          // 0001 → ordena bien por nombre
    const sagas = userSagas[serie.toLowerCase()] || SAGAS[serie.toLowerCase()];
    const n = Math.floor(c.numero);                         // el 1057.5 va con el 1057
    const i = sagas ? sagas.findIndex(([a, b]) => n >= a && n <= b) : -1;
    const saga = i >= 0 ? `${String(i + 1).padStart(2, '0')} ${sagas[i][2]}/` : '';
    return sanitizePath(`${serie}/${saga}${serie} ${num}`);
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
  //   { list: [{numero, title, url?, raw?}], pat: {pre, post} | null, guessed, code, file, width, current }
  // pat es el molde de las direcciones (pre + número + post); guessed = true si no hubo de
  // dónde sacarlo y se supuso "esta dirección + /número"; width, los dígitos mínimos del número.
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

    const add = (href, text) => {
      const s = splitChapterUrl(href);
      if (!s || !href.startsWith(location.origin + '/')) return;
      if (/(?:^|[/?&])(?:page|pagina|pag|p)[/=]$/i.test(s.pre)) return;       // paginación, no capítulos
      if (isDateArchive(s, text)) return;                                       // archivo por mes o por día, no capítulos
      const key = s.pre + '\n' + s.post;
      let g = groups.get(key);
      if (!g) groups.set(key, g = { pat: { pre: s.pre, post: s.post }, items: new Map() });
      const n = parseFloat(s.num);
      if (!g.items.has(n)) g.items.set(n, { numero: n, title: label(text, n), url: href, raw: s.num });
    };

    for (const a of document.querySelectorAll('a[href]')) {
      if (!a.closest(OURS)) add(String(a.href).split('#')[0], a.textContent);
    }
    for (const o of document.querySelectorAll('select option')) {
      const v = String(o.value || '').trim();
      if (!v || o.disabled) continue;
      if (/^\d{1,5}(\.\d+)?$/.test(v)) optionNums.push({ raw: v, text: o.textContent });     // el valor es el número
      else if (/[/?=]/.test(v)) add(absUrl(v).split('#')[0], o.textContent);                 // el valor es una dirección
      else {
        const t = String(o.textContent || '').match(/(\d{1,5}(?:\.\d+)?)/);                 // el número está en el texto
        if (t) optionNums.push({ raw: t[1], text: o.textContent });
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
      if (!byNum.has(n)) byNum.set(n, { numero: n, title: label(o.text, n), raw: o.raw });
    }
    // El capítulo que está abierto entra siempre, con la dirección que ya se sabe que anda
    const current = own ? parseFloat(own.num) : (title ? title.numero : null);
    if (current != null && (own || guessed || code || file)) {
      const had = byNum.get(current);
      byNum.set(current, { numero: current, title: had?.title || `Capítulo ${current}`, url: here });
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
  async function saveCore(path, urls, formats, chap, nums, missing = 0) {
    const last = path.split('/').pop();
    const arc = path.split('/').length >= 3 ? path.split('/').slice(-2, -1)[0].replace(/^\d+\s+/, '') : '';
    let r;
    try {
      r = await bg({
        action: 'build', urls, formats, path, title: last,
        meta: { title: last, series: chap?.serie, number: chap?.numero, arc, web: pageKey() },
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
      lines.push(failedNums.length === 1 ? `⚠️ No se pudo bajar la página ${failedNums[0]}`
                                         : `⚠️ No se pudieron bajar las páginas ${failedNums.join(', ')}`);
    }
    if (missing) lines.push(missing === 1 ? '⚠️ 1 página del capítulo no cargó' : `⚠️ ${missing} páginas del capítulo no cargaron`);

    // Se anota como guardado solo si entraron todas las páginas elegidas
    const complete = !anyError && !failedNums.length && !r.imgsFailed && !missing;
    if (complete) {
      savedMap = (await store.get(['savedChapters'])).savedChapters || {};
      savedMap[path] = { ts: Date.now(), pages: urls.length, url: pageKey() };
      await store.set({ savedChapters: savedMap });
    } else if (!anyError) {
      lines.push('⚠️ Faltaron páginas: no lo marqué como guardado. Probá guardarlo de nuevo.');
    }
    return { lines, complete, pages: r.pages, failedNums };
  }

  // ── Diálogo "Guardar capítulo" ──────────────────────

  let saveEl = null;
  let opening = false;            // se está abriendo un diálogo (pedirlo dos veces seguidas no abre dos)
  let saving = false;
  let pages = [];                 // [{url, w, h, flag, on}]
  let pagesLoaded = false;
  let lastFailed = 0;             // páginas del capítulo que no cargaron en la última búsqueda
  let lastLocked = false;         // las páginas del capítulo no tienen dirección para bajar (imágenes blob:)
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
      if (!batchRunning) closeChapterDialog();
      const folder = (st.saveFolders || {})[location.hostname] || '';
      let name = suggestName();
      if (folder && !name.includes('/')) name = `${folder}/${name}`;   // solo si no se pudo detectar la serie
      savedMap = st.savedChapters || {};
      nextUrl = nextChapterUrl();

      saveEl = document.createElement('div');
      saveEl.id = 'mr-save';
      saveEl.innerHTML = `
        <div class="mr-head">
          <span class="mr-title">💾 Guardar capítulo</span>
          <button class="mr-b mr-x" id="mr-save-close" title="Cerrar (Esc)">✕</button>
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
          <div class="mr-thumbs" id="mr-thumbs"></div>
          <div class="mr-save-btns">
            <button class="mr-save-go" id="mr-save-go" type="button">Guardar</button>
            <button class="mr-save-go mr-save-next" id="mr-save-next" type="button"
                    title="Guarda y abre el capítulo siguiente (Ctrl+Enter)">Guardar y siguiente ▶</button>
          </div>
          <div class="mr-save-status" id="mr-save-status"></div>
        </div>`;
      document.body.appendChild(saveEl);
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
      });
      for (const type of ['keyup', 'keypress']) saveEl.addEventListener(type, (e) => e.stopPropagation());
      sv('#mr-save-close').onclick = closeSaveDialog;
      sv('#mr-save-go').onclick = () => saveChapter(false);
      sv('#mr-save-next').onclick = () => saveChapter(true);
      sv('#mr-save-scan').onclick = scanPage;

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
    // Lo tildado se lee DESPUÉS de esperar: así se respetan los clics hechos mientras buscaba
    const prev = new Map(pages.map(p => [p.url, p.on]));
    pages = found.pages.map(p => ({ ...p, on: prev.has(p.url) ? prev.get(p.url) : !p.flag }));
    lastFailed = found.failed;
    lastLocked = found.locked;
    pagesLoaded = true;
    renderThumbs();
    refresh();
  }

  function renderThumbs() {
    const box = sv('#mr-thumbs');
    if (!box) return;
    const top = box.scrollTop;                                 // que no salte arriba al volver a dibujar
    box.innerHTML = pages.map((p, i) => `
      <button class="mr-thumb ${p.on ? 'on' : 'off'}" data-i="${i}" type="button"
              title="${esc(p.flag ? `Posible publicidad: ${p.flag}` : `Página ${i + 1}`)} · clic para ${p.on ? 'quitar' : 'incluir'}">
        <img src="${esc(p.url)}" loading="lazy" alt="">
        <span class="mr-thumb-n">${i + 1}</span>
        ${p.flag ? '<span class="mr-thumb-ad">AD</span>' : ''}
      </button>`).join('');
    box.scrollTop = top;
    box.querySelectorAll('.mr-thumb').forEach(b => {
      b.onclick = () => {
        if (saving) return;
        const p = pages[+b.dataset.i];
        p.on = !p.on;
        b.classList.toggle('on', p.on);
        b.classList.toggle('off', !p.on);
        refresh();
      };
    });
  }

  function refresh() {
    if (!saveEl) return;
    const path = sanitizePath(sv('#mr-save-name').value);
    const pdf = sv('#mr-save-pdf').checked, cbz = sv('#mr-save-cbz').checked, imgs = sv('#mr-save-imgs').checked;
    const lines = [];
    if (pdf) lines.push(`📄 Descargas/MangaReader/${path}.pdf`);
    if (cbz) lines.push(`📚 Descargas/MangaReader/${path}.cbz`);
    if (imgs) lines.push(`🖼 Descargas/MangaReader/${path}/`);
    sv('#mr-save-dest').textContent = lines.join('\n') || 'Elegí al menos un formato';

    const onCount = pages.filter(p => p.on).length;
    const ads = pages.filter(p => p.flag && !p.on).length;
    const count = sv('#mr-save-count');
    if (scanning) {
      count.textContent = 'Recorriendo la página para cargar todas las imágenes…' + (pages.length ? ` (${pages.length} hasta ahora)` : '');
    } else if (pagesLoaded && lastLocked) {
      count.textContent = 'No encontré páginas del capítulo en esta página.';
    } else if (pages.length) {
      count.textContent =
        `${onCount} de ${pages.length} páginas` + (ads ? ` · ${ads} descartada${ads === 1 ? '' : 's'} como publicidad` : '') +
        ' · clic en una miniatura para incluirla o quitarla';
    } else if (pagesLoaded) {
      count.textContent = 'No encontré páginas · bajá hasta el final del capítulo';
    }
    const blocked = saving || (!pdf && !cbz && !imgs) || !onCount;
    sv('#mr-save-go').disabled = blocked;
    sv('#mr-save-next').disabled = blocked;

    // ¿Ya lo guardaste? (por nombre, o por la dirección de esta página)
    const here = noSlash(pageKey());
    const hit = savedMap[path] ? [path, savedMap[path]] : Object.entries(savedMap).find(([, v]) => noSlash(v.url) === here);
    const seen = sv('#mr-save-seen');
    if (hit) {
      const d = new Date(hit[1].ts);
      const when = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      seen.textContent = `✔ Ya lo guardaste el ${when} (${hit[1].pages} páginas)` + (hit[0] !== path ? ` como "${hit[0]}"` : '');
    } else seen.textContent = '';

    // ¿Pueden faltar páginas?
    const warns = [];
    if (pagesLoaded && lastFailed && !lastLocked) warns.push(lastFailed === 1 ? '1 página no cargó' : `${lastFailed} páginas no cargaron`);
    if (pagesLoaded && !reachedBottom && !scanning && !lastLocked) warns.push('no llegaste al final de la página, pueden faltar páginas');
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
    if (saveEl) { saveEl.remove(); saveEl = null; }
    pages = []; pagesLoaded = false; lastFailed = 0; lastLocked = false; loadSeq++;
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
    folders[location.hostname] = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    store.set({ savePdf: formats.pdf, saveCbz: formats.cbz, saveImgs: formats.imgs, saveFolders: folders });

    setSaveStatus(`⏳ Bajando páginas: 0/${sel.length}…`, 'working');
    const r = await saveCore(path, sel.map(p => p.url), formats, detectChapter(), sel.map(p => p.n));
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
  // diga el título de la página.
  async function autoSave({ formats, serie, numero, strict, fixed }) {
    note('buscando las páginas…');
    if (document.visibilityState === 'visible') await scrollThrough();      // dispara la carga diferida
    const found = await collectPages();
    const urls = found.pages.filter(p => !p.flag).map(p => p.url);
    if (urls.length < 3) throw new Error(`Sin páginas (encontré ${urls.length})`);

    let c = detectChapter();
    // Si la dirección se armó a partir del número y el sitio abrió otro capítulo (o su portada), no sirve
    if (strict && c && numero != null && c.numero !== numero) throw new Error(`Sin páginas: se abrió el capítulo ${c.numero}`);
    if (fixed && numero != null) {
      // Sin nombre de serie escrito: el que sale del título, o el título sin sus números
      const fromTitle = cleanSerie((document.title || '').split(/\s+\|\s+/)[0].replace(/\d+(\.\d+)?/g, ' ').replace(/\s+/g, ' ').trim());
      c = { serie: serie || c?.serie || fromTitle || 'Manga', numero };
    } else if (serie) c = { serie, numero: c?.numero ?? numero };
    const path = c && c.numero != null && !isNaN(c.numero) ? nameFor(c) : suggestName();

    note(`bajando ${urls.length} páginas…`);
    const r = await saveCore(path, urls, formats, c, null, found.failed);
    return { name: path, pages: r.pages, complete: r.complete, lines: r.lines };
  }

  // ── Varios capítulos: diálogo ───────────────────────
  // Se abre desde el ícono de la extensión, el clic derecho o la burbuja, tanto en la
  // página de un capítulo como en la del listado de la serie.

  let chapterEl = null;
  let chapters = [];              // [{numero, title, url?, raw?, on, saved, state, note}]
  let chapterWidth = 1;           // dígitos mínimos del número en la dirección
  let batchRunning = false;
  let batchStop = false;
  let batchLabel = '';

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

      chapterEl = document.createElement('div');
      chapterEl.id = 'mr-chapter';
      chapterEl.innerHTML = `
        <div class="mr-head">
          <span class="mr-title">📦 Descargar varios capítulos</span>
          <button class="mr-b mr-x" id="mr-chapter-close" title="Cerrar">✕</button>
        </div>
        <div class="mr-save-body">
          <div class="mr-chapter-row">
            <span class="mr-save-label">Del</span>
            <input id="mr-chapter-from" class="mr-save-name mr-chapter-num" type="number" min="0" step="any" autocomplete="off">
            <span class="mr-save-label">al</span>
            <input id="mr-chapter-to" class="mr-save-name mr-chapter-num" type="number" min="0" step="any" autocomplete="off">
            <button class="mr-chapter-btn" id="mr-chapter-range" type="button">Marcar</button>
          </div>
          <div class="mr-chapter-row">
            <button class="mr-chapter-btn" id="mr-chapter-all" type="button">Todos</button>
            <button class="mr-chapter-btn" id="mr-chapter-none" type="button">Ninguno</button>
            <button class="mr-chapter-btn" id="mr-chapter-reload" type="button" title="Volver a buscar capítulos en la página">↻ Buscar de nuevo</button>
          </div>
          <div class="mr-save-count" id="mr-chapter-count"></div>
          <div class="mr-save-hint mr-chapter-why" id="mr-chapter-why" hidden></div>
          <div class="mr-chapter-list" id="mr-chapter-list"></div>
          <details class="mr-chapter-more" id="mr-chapter-more">
            <summary>Dirección y nombre de los capítulos</summary>
            <label class="mr-save-label" for="mr-chapter-tpl">Dirección</label>
            <input id="mr-chapter-tpl" class="mr-save-name" type="text" spellcheck="false" autocomplete="off">
            <div class="mr-save-hint"><b>{n}</b> es el número del capítulo. Con eso se arman los que no están en la lista.</div>
            <label class="mr-save-label" for="mr-chapter-serie">Serie</label>
            <input id="mr-chapter-serie" class="mr-save-name" type="text" spellcheck="false" autocomplete="off"
                   placeholder="Automática: sale del título de cada capítulo">
            <div class="mr-save-hint">Cada capítulo se guarda con el mismo nombre y carpetas que al guardarlo de a uno.</div>
          </details>
          <details class="mr-chapter-more" id="mr-chapter-paste">
            <summary>Pegar los links de los capítulos</summary>
            <textarea id="mr-chapter-links" class="mr-save-name mr-chapter-links" rows="4" spellcheck="false" autocomplete="off"
                      placeholder="Pegá los links, uno por renglón o todos juntos. Lo que no sea un link se ignora."></textarea>
            <div class="mr-chapter-row">
              <select id="mr-chapter-links-mode" class="mr-save-name mr-chapter-select" title="De dónde sale el número de cada capítulo">
                <option value="auto">Número: el de cada link</option>
                <option value="order">Número: en el orden pegado</option>
                <option value="reverse">Número: en el orden pegado, al revés</option>
              </select>
              <span class="mr-save-label">desde</span>
              <input id="mr-chapter-links-from" class="mr-save-name mr-chapter-num" type="number" min="0" step="any" autocomplete="off" placeholder="1">
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
      document.body.appendChild(chapterEl);
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
      });
      for (const type of ['keyup', 'keypress']) chapterEl.addEventListener(type, (e) => e.stopPropagation());
      sc('#mr-chapter-close').onclick = closeChapterDialog;
      sc('#mr-chapter-range').onclick = markRange;
      sc('#mr-chapter-all').onclick = () => { for (const c of chapters) c.on = true; renderChapters(); };
      sc('#mr-chapter-none').onclick = () => { for (const c of chapters) c.on = false; renderChapters(); };
      sc('#mr-chapter-reload').onclick = () => loadChapters(true);
      sc('#mr-chapter-links-go').onclick = useLinks;
      sc('#mr-chapter-go').onclick = runBatch;
      sc('#mr-chapter-tpl').addEventListener('change', () => { markSaved(); renderChapters(); });
      for (const id of ['pdf', 'cbz', 'imgs', 'skip']) sc(`#mr-chapter-${id}`).addEventListener('change', refreshChapters);
      // Un solo listener para toda la lista: puede tener más de mil capítulos
      sc('#mr-chapter-list').addEventListener('change', (e) => {
        const row = e.target.closest('.mr-chapter-item');
        if (row && chapters[+row.dataset.i]) { chapters[+row.dataset.i].on = e.target.checked; refreshChapters(); }
      });

      loadChapters(false);
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
    chapters.sort((a, b) => a.numero - b.numero);

    if (!keep) {
      sc('#mr-chapter-tpl').value = found.pat ? found.pat.pre + '{n}' + found.pat.post : '';
      // Sin lista ni número en la dirección no hay forma de saber cómo son las direcciones:
      // se muestra la que se supuso para que la revises
      sc('#mr-chapter-more').open = (found.guessed && found.list.length < 2) || !found.pat;
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
      chapters.sort((x, y) => x.numero - y.numero);
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

  function renderChapters() {
    const list = sc('#mr-chapter-list');
    if (!list) return;
    list.innerHTML = chapters.map((c, i) => `
      <label class="mr-chapter-item ${c.state}" data-i="${i}">
        <input type="checkbox" ${c.on ? 'checked' : ''} ${batchRunning ? 'disabled' : ''}>
        <span class="mr-chapter-n">${c.numero}</span>
        <span class="mr-chapter-t">${esc(c.title)}</span>
        <span class="mr-chapter-s">${esc(rowNote(c))}</span>
      </label>`).join('');
    refreshChapters();
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
    const anyFmt = sc('#mr-chapter-pdf').checked || sc('#mr-chapter-cbz').checked || sc('#mr-chapter-imgs').checked;
    const go = sc('#mr-chapter-go');
    go.textContent = batchRunning ? 'Cancelar' : `Descargar ${todo} capítulo${todo === 1 ? '' : 's'}`;
    go.classList.toggle('mr-cancel', batchRunning);
    go.disabled = !batchRunning && (!todo || !anyFmt);
    for (const id of ['range', 'all', 'none', 'reload']) sc(`#mr-chapter-${id}`).disabled = batchRunning;
  }

  function closeChapterDialog() {
    if (batchRunning) { batchStop = true; bg({ action: 'batchCancel' }).catch(() => {}); }
    if (chapterEl) { chapterEl.remove(); chapterEl = null; }
    chapters = [];
  }

  // Baja los capítulos marcados, uno tras otro. Con un lote en marcha, el mismo botón lo cancela.
  async function runBatch() {
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
    if (!todo.length) return setChapterStatus('No hay capítulos para bajar', 'error');
    if (todo.some(c => !c.url) && !tplParts()) {
      sc('#mr-chapter-more').open = true;
      return setChapterStatus('A la dirección de los capítulos le falta {n}', 'error');
    }
    const serie = sanitizeSegment(sc('#mr-chapter-serie').value.replace(/\//g, '-'));
    const visible = sc('#mr-chapter-visible').checked;
    store.set({ savePdf: formats.pdf, saveCbz: formats.cbz, saveImgs: formats.imgs, batchVisible: visible });

    batchRunning = true;
    batchStop = false;
    for (const c of chapters) { c.state = ''; c.note = ''; }
    renderChapters();

    const problems = [];
    let okCount = 0, calls = 0, empty = 0, halt = '';
    const startWidth = chapterWidth;
    for (let i = 0; i < todo.length && !batchStop && !halt && chapterEl; i++) {
      const c = todo[i];
      batchLabel = `(${i + 1}/${todo.length}) Capítulo ${c.numero}`;
      setRow(c, 'run', 'abriendo…');
      setChapterStatus(`${batchLabel}: abriendo…`, 'working');
      let res = null, err = null;
      for (const { url, form } of chapterUrls(c)) {
        try {
          res = await bg({ action: 'batchChapter', url, formats, serie, numero: c.numero, strict: !c.url, fixed: !!c.fixed, visible,
                           pause: calls++ ? BATCH_PAUSE : 0 }, 300000);
          if (/^0\d/.test(form)) chapterWidth = Math.max(chapterWidth, form.split('.')[0].length);   // el sitio usa ceros adelante
          break;
        } catch (e) {
          err = e;
          if (batchStop || !/^sin páginas/i.test(e.message)) break;       // solo se prueba otra forma del número si no había páginas
        }
      }
      const noPages = !res && /^sin páginas/i.test(err?.message || '');
      empty = noPages ? empty + 1 : 0;
      if (res?.complete) {
        okCount++;
        c.saved = true;
        setRow(c, 'ok', `${res.pages} páginas`);
      } else if (res) {
        const why = res.lines.filter(l => l.startsWith('⚠️')).map(l => l.replace(/^⚠️\s*/, '')).join(' · ') || 'quedó incompleto';
        problems.push(`Capítulo ${c.numero}: ${why}`);
        setRow(c, 'warn', 'incompleto');
      } else if (batchStop) {
        setRow(c, '', '');
      } else {
        problems.push(`Capítulo ${c.numero}: ${err ? err.message : 'no se pudo abrir'}`);
        setRow(c, 'fail', noPages ? 'sin páginas' : 'falló');
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
    const dirs = new Map();
    for (const img of document.querySelectorAll('img')) {
      if (img.closest(OURS)) continue;                // las miniaturas del diálogo no cuentan
      const u = imgUrl(img);                          // las blob: no tienen dirección: no cuentan
      if (u && img.naturalWidth >= MIN_SIDE && img.naturalHeight >= 600) {
        const d = urlDir(u);
        dirs.set(d, (dirs.get(d) || 0) + 1);
      }
    }
    return Math.max(0, ...dirs.values()) >= 3;      // 3+ imágenes grandes en la misma carpeta
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
    if (fabEl) return;
    const st = await store.get(['fabEnabled', 'fabPos']);
    if (st.fabEnabled === false || fabEl) return;
    fabPos = st.fabPos || { r: 24, b: 24 };

    fabEl = document.createElement('div');
    fabEl.id = 'mr-fab';
    fabEl.innerHTML = `
      <button class="mr-fab-main" type="button" title="Guardar capítulo (Alt+S) · arrastrá para mover">💾</button>
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
    document.body.appendChild(fabEl);
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
    fabEl.querySelector('.mr-fab-batch').onclick = () => { info.hidden = true; openChapterDialog(); };
    fabEl.querySelector('.mr-fab-hide').onclick = () => store.set({ fabEnabled: false });
    fabEl.querySelector('.mr-fab-site').onclick = async () => {
      const hosts = (await store.get(['fabBlockedHosts'])).fabBlockedHosts || [];
      if (!hosts.includes(location.hostname)) hosts.push(location.hostname);
      store.set({ fabBlockedHosts: hosts });
    };
  }

  function hideFab() { if (fabEl) { fabEl.remove(); fabEl = null; } }

  // Estos dos se registran una sola vez, no cada vez que aparece la burbuja
  on(document, 'pointerdown', (e) => {
    if (fabEl && !fabEl.contains(e.target)) fabEl.querySelector('.mr-fab-info').hidden = true;
  });
  on(window, 'resize', () => { if (fabEl) fabPos = placeFab(fabPos); });

  let fabOff = false;             // la burbuja está oculta en todos lados
  let fabBlocked = false;         // …o solo en este sitio
  let fabCheckTimer = null;
  let fabTries = 0;
  let fabHref = location.href;

  function fabSettings(s) {
    fabOff = s.fabEnabled === false;
    fabBlocked = (s.fabBlockedHosts || []).includes(location.hostname);
  }

  const onStorage = (ch, area) => {
    if (area !== 'local') return;
    if (ch.sagas) userSagas = ch.sagas.newValue || {};
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
      if (!saveEl && !chapterEl) hideFab();
    }
    if (fabEl || fabOff || fabBlocked || fabCheckTimer || fabTries >= FAB_MAX_TRIES) return;
    fabCheckTimer = setTimeout(() => {
      fabCheckTimer = null;
      fabTries++;
      if (!fabEl && !fabOff && !fabBlocked && looksLikeChapter()) showFab();
    }, 700);
  }
  store.get(['fabEnabled', 'fabBlockedHosts', 'sagas']).then(s => { fabSettings(s); userSagas = s.sagas || {}; });
  on(document, 'load', (e) => { if (e.target?.tagName === 'IMG') checkFab(); }, true);
  on(window, 'scroll', checkFab, { passive: true });
  setTimeout(checkFab, 1500);
  setTimeout(checkFab, 5000);

  // ── Mensajes ────────────────────────────────────────

  const onMessage = (msg, sender, sendResponse) => {
    switch (msg?.action) {
      case 'ping': sendResponse({ ok: true }); return;
      case 'save': openSaveDialog(); sendResponse({ ok: true }); return;
      case 'batch': openChapterDialog(); sendResponse({ ok: true }); return;
      case 'count': sendResponse({ ok: true, n: countCandidates() }); return;
      case 'autoSave':
        autoSave(msg).then(r => sendResponse({ ok: true, ...r })).catch(e => sendResponse({ ok: false, error: e.message }));
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
