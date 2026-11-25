/**
 * Background Service Worker v2.11.4
 * - Menú contextual y atajo (Alt+S)
 * - Inyecta el script en las pestañas abiertas antes de instalar o actualizar (sin F5)
 * - Guardado: el documento offscreen baja las páginas una vez y arma PDF / CBZ / imágenes;
 *   desde acá se descargan con chrome.downloads
 * - Varios capítulos: abre cada uno en su pestaña, le pide que se guarde y la cierra
 */

// Las reglas de los ajustes (carpeta base, ritmo…) son las mismas que usan opciones y las pestañas
importScripts('ajustes.js');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Context menu ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'manga-save',
      title: '💾 Guardar capítulo (PDF / CBZ)',
      contexts: ['page', 'image'],
    });
    chrome.contextMenus.create({
      id: 'manga-batch',
      title: '📦 Descargar varios capítulos…',
      contexts: ['page'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const action = { 'manga-save': 'save', 'manga-batch': 'batch' }[info.menuItemId];
  if (action && tab?.id != null) tellTab(tab.id, { action }).catch(() => {});
});

// ── Atajo de teclado (Alt+S) ──────────────────────────

chrome.commands.onCommand.addListener((command, tab) => {
  if (tab?.id != null) tellTab(tab.id, { action: command }).catch(() => {});
});

// ── Hablarle a una pestaña ────────────────────────────
// Si la pestaña todavía no tiene el script (se abrió antes de instalar o actualizar la
// extensión), se lo inyecta y reintenta. Así no hace falta recargarla con F5.
// Se inyectan los mismos archivos, y en el mismo orden, que declara "content_scripts" en
// manifest.json: content.js usa lo que definen los otros (lo comprueba tests/test_descargas.js).
// No hay hoja de estilos que inyectar: va como texto en estilos.js y content.js la pone adentro
// del shadow root del diálogo.
const CONTENT_FILES = ['agrupar.js', 'plantilla.js', 'sagas.js', 'estilos.js', 'ajustes.js', 'content.js'];

// Marcos: el script corre en la página y en cada iframe (el lector de muchos sitios está en
// uno), y cada marco cuenta sus candidatas. Devuelve [{ frameId, n, urls, pedidas, cargadas,
// adaptado }]; n = -1 si ese marco no tiene una copia viva del script. Desde la 2.11.4, urls son
// las direcciones de las páginas que cuenta ese marco (cargadas o no), pedidas la que el navegador
// pidió de cada una si es otra, cargadas las que ya cargaron y adaptado si hay un adaptador: con eso
// se sabe si una imagen que pidió esperar es una página que faltó. (Hasta la 2.11.3 cada marco
// contestaba solo el número: se acepta igual, y ahí no se decide.)
async function contarMarcos(tabId) {
  const r = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => (window.__mangaReaderAlive?.() && typeof window.__mangaReaderCuenta === 'function' ? window.__mangaReaderCuenta() : -1),
  });
  const textos = (v) => (Array.isArray(v) ? v.filter(u => typeof u === 'string') : []);
  return (r || []).map(({ frameId, result: x }) => (typeof x === 'number' ? { frameId, n: x, urls: [], pedidas: [], cargadas: [], adaptado: false }
    : x && typeof x.n === 'number' ? { frameId, n: x.n, urls: textos(x.urls), pedidas: textos(x.pedidas), cargadas: textos(x.cargadas), adaptado: !!x.adaptado }
    : { frameId, n: -1, urls: [], pedidas: [], cargadas: [], adaptado: false }));
}

// El marco con más candidatas. Si empatan gana el de más arriba (la página es el 0): cuando
// las mismas imágenes están en la página y en un iframe, son un solo capítulo, no dos.
function marcoCon(marcos) {
  let mejor = { frameId: 0, n: 0 };
  for (const m of marcos) if (m.n > mejor.n || (m.n === mejor.n && m.frameId < mejor.frameId)) mejor = m;
  return mejor.frameId;
}

// Guardar se le pide al marco donde están las páginas. Lo demás (el diálogo de varios
// capítulos, que sale de la lista de la serie) va a la página.
const AL_LECTOR = new Set(['save', 'autoSave', 'yaGuardado']);

async function tellTab(tabId, msg) {
  let marcos = await contarMarcos(tabId);
  if (marcos.some(m => m.n < 0)) {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: CONTENT_FILES });
    marcos = await contarMarcos(tabId);
  }
  return chrome.tabs.sendMessage(tabId, msg, { frameId: AL_LECTOR.has(msg.action) ? marcoCon(marcos) : 0 });
}

// ── Message handler ───────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === 'offscreen') return; // es para el documento offscreen

  // Progreso de la bajada de páginas → al marco de la pestaña que pidió el guardado
  if (msg?.target === 'background' && msg.action === 'progress') {
    const quien = jobs.get(msg.jobId);
    if (quien?.tabId != null) {
      chrome.tabs.sendMessage(quien.tabId, { action: 'progress', done: msg.done, total: msg.total }, { frameId: quien.frameId }).catch(() => {});
      batchNote(quien.tabId, `bajando páginas ${msg.done}/${msg.total}`);
    }
    return;
  }

  const handlers = {
    build: () => runBuild(msg, sender),
    // Desde el popup (dice qué pestaña) o desde la burbuja de un iframe (es la suya)
    tab: () => tellTab(msg.tabId ?? sender.tab?.id, { action: msg.command }).then(() => ({})),
    batchChapter: () => batchChapter(msg, sender),
    batchCancel: () => batchCancel(sender),
    batchNote: () => { batchNote(sender.tab?.id, msg.text); return Promise.resolve({}); },
    candidato: () => candidato(sender),
    colaNueva: () => colaNueva(msg),
    colaMarca: () => colaMarca(msg),
    colaFin: () => colaFin(msg),
    colaReintentar: () => colaReintentar(msg),
    colaDescartar: () => colaDescartar(),
    imagenEnEspera: () => imagenEnEspera(msg, sender),
    insigniaLimpiar: () => insigniaLimpiar(),
    probarAdaptador: () => probarAdaptador(msg),
    // Un iframe no sabe cómo se llama el capítulo: el título y la dirección son los de la página
    contexto: () => chrome.tabs.sendMessage(sender.tab.id, { action: 'contexto' }, { frameId: 0 }).then(r => ({ contexto: r?.contexto || null })),
  };

  const h = handlers[msg?.action];
  if (h) {
    h().then(r => sendResponse({ ok: true, ...r }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

// La burbuja va en un solo marco de la pestaña: el que tiene más candidatas. Cada marco que
// parece un capítulo pregunta antes de mostrarla; a los demás se les avisa que la saquen.
// No se anota quién ganó: se cuenta de nuevo cada vez, así no depende de que el service worker
// siga despierto.
async function candidato(sender) {
  const tabId = sender.tab?.id;
  if (tabId == null) return { gana: true };
  const marcos = await contarMarcos(tabId);
  const mejor = marcoCon(marcos);
  for (const m of marcos) {
    if (m.frameId !== mejor && m.n >= 0) chrome.tabs.sendMessage(tabId, { action: 'ceder' }, { frameId: m.frameId }).catch(() => {});
  }
  return { gana: (sender.frameId || 0) === mejor };
}

// "Probar en esta página", desde opciones → Adaptadores por sitio: se prueba el adaptador en la
// pestaña de ese sitio que se usó último, en cada uno de sus marcos, y vale el que más encuentra
// (el lector puede estar en un iframe).
async function probarAdaptador({ host, adaptador }) {
  const de = (t) => { try { return new URL(t.url).hostname; } catch { return ''; } };
  const tab = (await chrome.tabs.query({})).filter(t => de(t) === host).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  if (!tab) throw new Error(`No hay ninguna pestaña abierta de ${host}: abrí un capítulo de ese sitio y probá de nuevo`);
  let marcos = await contarMarcos(tab.id);
  if (marcos.some(m => m.n < 0)) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: CONTENT_FILES });
    marcos = await contarMarcos(tab.id);
  }
  let mejor = null;
  for (const m of marcos) {
    const r = await chrome.tabs.sendMessage(tab.id, { action: 'probarAdaptador', adaptador }, { frameId: m.frameId }).catch(() => null);
    if (r && (!mejor || r.n > mejor.n || (mejor.error && !r.error))) mejor = r;
  }
  if (!mejor) throw new Error('La pestaña de ese sitio no contestó');
  return { n: mejor.n, urls: mejor.urls, error: mejor.error, pagina: mejor.pagina };
}

// ── Descargas ─────────────────────────────────────────

// Si el sistema rechaza el nombre (p. ej. acentos en un sistema sin UTF-8),
// reintenta con el mismo nombre sin acentos: "Capítulo" → "Capitulo".
async function safeDownload(opts) {
  try {
    return { id: await chrome.downloads.download(opts), filename: opts.filename };
  } catch (e) {
    if (!/invalid filename/i.test(e.message)) throw e;
    const filename = opts.filename.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '_');
    return { id: await chrome.downloads.download({ ...opts, filename }), filename };
  }
}

// chrome.downloads.download() responde apenas EMPIEZA la descarga. Esto espera el
// resultado real: 'complete', 'interrupted' (con el motivo) o 'timeout' si sigue en curso.
function waitDownload(id, ms = 20000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (state, error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.downloads.onChanged.removeListener(onChange);
      resolve({ state, error });
    };
    const onChange = (d) => {
      if (d.id === id && d.state && d.state.current !== 'in_progress') finish(d.state.current, d.error?.current);
    };
    const timer = setTimeout(() => finish('timeout'), ms);
    chrome.downloads.onChanged.addListener(onChange);
    // Por si terminó antes de empezar a escuchar
    chrome.downloads.search({ id }).then(([it]) => {
      if (it && it.state !== 'in_progress') finish(it.state, it.error);
    }).catch(() => {});
  });
}

// ── Guardado de un capítulo ───────────────────────────
// El service worker no puede crear Blob URLs, así que los archivos se arman en un
// documento offscreen y desde acá se descargan con chrome.downloads.

const jobs = new Map();         // jobId → { tabId, frameId } de quien lo pidió (para reenviarle el progreso)
const blobs = new Map();        // downloadId → blob URL (para liberarla al terminar)
let offscreenCreating = null;

async function ensureOffscreen() {
  if (chrome.runtime.getContexts) {
    const ctx = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (ctx.length) return;
  }
  if (!offscreenCreating) {
    offscreenCreating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Armar el PDF o CBZ del capítulo para descargarlo',
    }).catch(e => {
      if (!/single offscreen/i.test(e.message)) throw e; // ya existía → OK
    }).finally(() => { offscreenCreating = null; });
  }
  await offscreenCreating;
}

function revoke(urls) {
  if (urls.length) chrome.runtime.sendMessage({ target: 'offscreen', action: 'revoke', urls }).catch(() => {});
}

function closeOffscreenIfIdle() {
  if (!blobs.size && !jobs.size) chrome.offscreen.closeDocument().catch(() => {});
}

// La carpeta de Descargas donde va todo: "MangaReader", o la que diga la opción carpetaBase,
// que puede llevar {sitio}, {serie} y {anio}. Si la opción no sirve (un ".." escrito a mano en
// una copia importada), vale la de siempre: no es motivo para no guardar.
async function carpetaBase(meta = {}, path = '') {
  const tpl = (await chrome.storage.local.get(['carpetaBase'])).carpetaBase;
  if (typeof tpl !== 'string' || !tpl.trim()) return MR_AJUSTES.CARPETA_DEFECTO;
  let sitio = '';
  try { sitio = new URL(meta.web).hostname; } catch {}
  return MR_AJUSTES.aplicarCarpeta(tpl, { sitio, serie: meta.series || path.split('/')[0], anio: new Date().getFullYear() });
}

// Baja las páginas una vez y guarda lo pedido en <carpeta base>/<path>.pdf, .cbz y/o
// <carpeta base>/<path>/pagina_NNN.<ext>. Devuelve:
//   { pages, failed: [n…], files: [{kind, sizeKB, savedAs} | {kind, error}], imgs, imgsFailed, imgError, esperar }
// (`esperar`: el código, 429 o 503, si alguna página faltó porque el sitio pidió esperar; si no, 0)
async function runBuild({ urls, formats, title, meta, path, soloEntero }, sender) {
  if (!urls?.length) throw new Error('No hay páginas para guardar');
  // El trabajo se registra ANTES de preparar el documento offscreen: así la limpieza
  // de una descarga anterior no lo cierra justo cuando este trabajo lo necesita.
  const jobId = crypto.randomUUID();
  jobs.set(jobId, { tabId: sender.tab?.id, frameId: sender.frameId || 0 });
  try {
    // soloEntero: lo pide un lote, para que un capítulo al que el sitio le niega páginas (429 o
    // 503) no se guarde a medias (ver build en offscreen.js)
    const request = { target: 'offscreen', action: 'build', urls, formats, title, meta, jobId, soloEntero: !!soloEntero };
    let r;
    try {
      await ensureOffscreen();
      r = await chrome.runtime.sendMessage(request);
    } catch (e) {
      if (!/receiving end|message port closed/i.test(e.message)) throw e;
      await sleep(300);                                  // se estaba cerrando: recrearlo y reintentar
      await ensureOffscreen();
      r = await chrome.runtime.sendMessage(request);
    }
    // Las imágenes de un capítulo de un lote pidieron esperar: se anota igual que cuando lo pide
    // su página, con lo que hayan dicho en Retry-After
    if (r?.esperar && sitiosDeLote.has(sender.tab?.id)) await anotarEspera(sitiosDeLote.get(sender.tab.id), r.esperar.retryAfter).catch(() => {});
    if (!r?.ok) throw new Error(r?.error || 'No se pudo armar el archivo');

    const out = { pages: r.pages, failed: r.failed || [], files: [], imgs: 0, imgsKB: 0, imgsFailed: 0, imgError: '', esperar: r.esperar?.status || 0 };
    let ultima = null;                                   // la última descarga que salió bien: "Mostrar la carpeta" la busca
    const base = await carpetaBase(meta, path);
    for (const f of r.files) {
      const filename = f.kind === 'img' ? `${base}/${path}/${f.name}` : `${base}/${path}.${f.kind}`;
      try {
        const saved = await safeDownload({ url: f.url, filename, saveAs: false, conflictAction: 'uniquify' });
        blobs.set(saved.id, f.url);
        const res = await waitDownload(saved.id);
        if (res.state !== 'timeout' && blobs.delete(saved.id)) revoke([f.url]);
        if (res.state === 'interrupted') throw new Error(res.error || 'descarga interrumpida');
        ultima = saved.id;
        if (f.kind === 'img') { out.imgs++; out.imgsKB += f.sizeKB || 0; }
        else out.files.push({ kind: f.kind, sizeKB: f.sizeKB, savedAs: saved.filename !== filename ? saved.filename : '' });
      } catch (e) {
        if (![...blobs.values()].includes(f.url)) revoke([f.url]);
        if (f.kind === 'img') { out.imgsFailed++; out.imgError = e.message; }
        else out.files.push({ kind: f.kind, error: e.message });
      }
    }
    if (ultima != null) chrome.storage?.local.set({ ultimaDescarga: ultima }).catch(() => {});
    return out;
  } finally {
    jobs.delete(jobId);
    closeOffscreenIfIdle();
  }
}

// Descargas que seguían en curso cuando se dejó de esperarlas (por ejemplo, con el
// cartel "Guardar como" abierto): se libera el archivo cuando terminan.
chrome.downloads.onChanged.addListener((d) => {
  const url = blobs.get(d.id);
  const state = d.state?.current;
  if (!url || (state !== 'complete' && state !== 'interrupted')) return;
  blobs.delete(d.id);
  revoke([url]);
  closeOffscreenIfIdle();
});

// ── La cola de un lote ────────────────────────────────
// Qué capítulos pidió un lote y cómo le fue a cada uno. Se guarda en chrome.storage.local
// ("cola") y no en la memoria de una pestaña: si se cierra a mitad de camino, queda anotado
// qué faltaba y se puede seguir. Hay una sola: un lote nuevo reemplaza a la anterior.
//   { id, fecha, serie, formatos, visible, sitio, origen, plantilla,
//     items: [{ url, numero, titulo, volumen, estado: 'pendiente' | 'listo' | 'fallo', error }] }
// origen es la página desde donde se pidió y plantilla la dirección con {n}: con eso se sigue.
// Los cambios pasan de a uno por colaTurno: cada uno lee, cambia y escribe, y dos a la vez se pisarían.
let colaTurno = Promise.resolve();

// cambio(cola actual | null) → la cola nueva, null para borrarla o undefined para dejarla como está
function conCola(cambio) {
  const p = colaTurno.then(async () => {
    const actual = (await chrome.storage.local.get(['cola'])).cola || null;
    const nueva = cambio(actual);
    if (nueva === undefined) return actual;
    if (nueva === null) await chrome.storage.local.remove('cola'); else await chrome.storage.local.set({ cola: nueva });
    return nueva;
  });
  colaTurno = p.catch(() => {});
  return p;
}

async function colaNueva(msg) {
  const cola = {
    id: crypto.randomUUID(), fecha: Date.now(), serie: msg.serie || '', formatos: msg.formatos || {}, visible: !!msg.visible,
    sitio: msg.sitio || '', origen: msg.origen || '', plantilla: msg.plantilla || '',
    // armado: la dirección se armó con el número (se vuelve a armar al seguir, por si el sitio
    // lleva ceros adelante); fixed: el número lo puso quien pegó el link
    items: (msg.items || []).map(i => ({ url: i.url || '', numero: i.numero, titulo: i.titulo || '', volumen: i.volumen || '',
      ...(i.armado ? { armado: true } : {}), ...(i.fixed ? { fixed: true } : {}), estado: 'pendiente', error: '' })),
  };
  await conCola(() => cola);
  insignia(cola);
  return { id: cola.id };
}

async function colaMarca({ id, numero, estado, error }) {
  let cambio = false;
  const cola = await conCola((c) => {
    const it = c && c.id === id ? c.items.find(i => i.numero === numero) : null;     // otra cola (ya descartada): no se toca esta
    if (!it || !['pendiente', 'listo', 'fallo'].includes(estado)) return undefined;
    it.estado = estado;
    it.error = estado === 'fallo' ? String(error || 'falló') : '';
    cambio = true;
    return c;
  });
  if (cambio) insignia(cola);
  return {};
}

// Terminó el lote: si no quedó nada pendiente ni con falla, la cola ya no hace falta.
// motivo: 'listo', 'parado' o 'cancelado' (ahí no se avisa: lo canceló quien lo está mirando).
async function colaFin({ id, motivo }) {
  let vista = null;                                       // la cola como quedó, antes de borrarla
  await conCola((c) => {
    if (!c || c.id !== id) return undefined;
    vista = JSON.parse(JSON.stringify(c));
    return c.items.every(i => i.estado === 'listo') ? null : undefined;
  });
  if (vista) {
    insignia(vista, true);
    if (motivo !== 'cancelado') avisarFin(vista);
  }
  return {};
}

async function colaReintentar({ id }) {
  const cola = await conCola((c) => {
    if (!c || c.id !== id) return undefined;
    for (const i of c.items) if (i.estado === 'fallo') { i.estado = 'pendiente'; i.error = ''; }
    return c;
  });
  if (cola) insignia(cola);
  return { cola };
}

// ── Insignia y aviso del lote ─────────────────────────
// Un lote largo corre en pestañas de fondo: sin esto es a ciegas. La insignia del ícono dice
// cuántos van ("12/40") y al final queda verde o roja; la notificación avisa que terminó.
const COLOR = { corre: '#667eea', bien: '#2ecc71', mal: '#e74c3c' };
const AVISO = 'mr-lote';

function insignia(cola, fin = false) {
  if (!chrome.action) return;
  const hechos = cola.items.filter(i => i.estado !== 'pendiente').length;
  const fallos = cola.items.filter(i => i.estado === 'fallo').length;
  chrome.action.setBadgeText({ text: `${hechos}/${cola.items.length}` });
  chrome.action.setBadgeBackgroundColor({ color: !fin ? COLOR.corre : fallos ? COLOR.mal : COLOR.bien });
}

// Se limpia cuando se cierra el diálogo de varios capítulos: ya no hay lote a la vista
function insigniaLimpiar() {
  chrome.action?.setBadgeText({ text: '' });
  return Promise.resolve({});
}

// Los botones de la notificación, en orden. Qué botones tiene la que está a la vista queda anotado
// ("avisoBotones"): así un toque se entiende aunque el service worker se haya dormido, y aunque la
// cola haya cambiado desde que se mostró (si no, "Mostrar la carpeta" podía reintentar).
const BOTONES_DEL_AVISO = { reintentar: 'Reintentar los que fallaron', carpeta: 'Mostrar la carpeta' };

function avisarFin(cola) {
  if (!chrome.notifications) return;
  const total = cola.items.length;
  const listos = cola.items.filter(i => i.estado === 'listo').length;
  const fallos = cola.items.filter(i => i.estado === 'fallo').length;
  const pend = total - listos - fallos;
  const botones = [...(fallos ? ['reintentar'] : []), 'carpeta'];
  // (avisoCola: de qué lote es; si otro lote reemplazó a su cola, su "Reintentar" ya no tiene qué retomar)
  chrome.storage.local.set({ avisoBotones: botones, avisoCola: cola.id }).catch(() => {});
  chrome.notifications.create(AVISO, {
    type: 'basic', iconUrl: chrome.runtime.getURL ? chrome.runtime.getURL('icons/icon128.png') : 'icons/icon128.png',
    title: fallos ? 'Manga Reader: lote terminado con fallas' : 'Manga Reader: lote terminado',
    message: `${listos} de ${total} capítulos guardados` + (fallos ? ` · ${fallos} con fallas` : '') + (pend ? ` · ${pend} sin bajar` : '') + (cola.serie ? ` · ${cola.serie}` : ''),
    buttons: botones.map(b => ({ title: BOTONES_DEL_AVISO[b] })),
  });
}

// Lo que hace cada botón. "Reintentar" es el mismo de la ventana: la pestaña de la serie retoma la
// cola con seguirCola(true), igual que el botón "Reintentar" del diálogo de varios capítulos, y por
// eso frena lo que el sitio haya pedido esperar antes de cada capítulo. "Mostrar la carpeta" abre la
// carpeta de la última descarga (la ventana no tiene ese botón).
const ACCIONES_DEL_AVISO = {
  // (una notificación de un lote cuya cola ya reemplazó otro no retoma la de ese otro)
  reintentar: (st) => (st.avisoCola && st.cola?.id !== st.avisoCola ? null : reintentarDesdeAviso(st.cola)),
  carpeta: (st) => mostrarCarpeta(st.ultimaDescarga),
};
function mostrarCarpeta(id) { if (id != null) chrome.downloads.show(id); }

// Chrome llama a esto con la notificación y el número del botón que se tocó (las pruebas también:
// así se prueba lo mismo que hace un toque, sin depender de que Windows dibuje la notificación)
async function alTocarAviso(id, indice) {
  if (id !== AVISO) return;
  const st = await chrome.storage.local.get(['cola', 'ultimaDescarga', 'avisoBotones', 'avisoCola']);
  const hayFallos = !!st.cola && st.cola.items.some(i => i.estado === 'fallo');
  const botones = Array.isArray(st.avisoBotones) ? st.avisoBotones : hayFallos ? ['reintentar', 'carpeta'] : ['carpeta'];
  chrome.notifications.clear(id);
  const accion = ACCIONES_DEL_AVISO[botones[indice]];
  if (accion) await Promise.resolve(accion(st)).catch(() => {});
}
if (chrome.notifications?.onButtonClicked) chrome.notifications.onButtonClicked.addListener(alTocarAviso);

// "Reintentar los que fallaron" desde la notificación: se vuelve a la página de la serie (la
// misma pestaña si sigue abierta) y el diálogo de varios capítulos retoma la cola.
async function reintentarDesdeAviso(cola) {
  if (!cola?.origen) return;
  // La pestaña de la serie se reconoce como la reconoce la extensión (pageKey de content.js): sin
  // los datos de seguimiento de la consulta, con la consulta ordenada y sin importar la barra final
  const clave = (u) => {
    try {
      const x = new URL(u);
      const q = new URLSearchParams(x.search);
      for (const k of [...q.keys()]) if (/^(utm_|fbclid$|gclid$|ref$)/i.test(k)) q.delete(k);
      q.sort();
      const s = q.toString();
      return (x.origin + x.pathname + (s ? '?' + s : '')).replace(/\/(?=\?|$)/, '');
    } catch { return String(u || '').split('#')[0].replace(/\/(?=\?|$)/, ''); }
  };
  let tab = (await chrome.tabs.query({})).find(t => clave(t.url) === clave(cola.origen));
  // (una pestaña descartada para ahorrar memoria se vuelve a cargar al activarla: hay que esperarla,
  // igual que a una nueva)
  if (tab) await chrome.tabs.update(tab.id, { active: true });
  else tab = await chrome.tabs.create({ url: cola.origen, active: true });
  const cargada = async () => { for (let i = 0; i < 100 && (await chrome.tabs.get(tab.id)).status !== 'complete'; i++) await sleep(300); };
  await cargada();
  // Si justo se estaba recargando, el primer pedido no le llega: se espera y se prueba otra vez
  try { return await tellTab(tab.id, { action: 'batch', reintentar: true }); }
  catch { await sleep(1000); await cargada(); return tellTab(tab.id, { action: 'batch', reintentar: true }); }
}

async function colaDescartar() {
  await conCola(() => null);
  return {};
}

// ── Varios capítulos seguidos ─────────────────────────
// La pestaña desde donde se inició el lote pide los capítulos de a uno. Cada capítulo
// se abre en una pestaña propia: ahí el sitio arma la página como siempre (aunque lo
// haga con JavaScript) y el content script la guarda con el mismo código de siempre.

// ── El sitio pidió esperar ────────────────────────────
// Cuando un capítulo de un lote responde 429 o 503 —su página o sus imágenes—, a ese sitio no
// se le pide nada hasta que pase lo que pidió: lo que diga en Retry-After, con tope de un
// minuto, o un minuto si no dijo cuánto (MR_AJUSTES.esperaDelSitio). Queda anotado por sitio en
// chrome.storage ("esperaSitio": { sitio: hasta cuándo }) y la pestaña del lote lo lee antes de
// cada pedido: frena el reintento de ese capítulo y también el capítulo siguiente.
//
// El Retry-After de la página viene en la respuesta del documento, y de la navegación solo se
// ve el código: para leer la cabecera hace falta webRequest. Se recuerda la del último
// documento de cada pestaña, si respondió 429 o 503.
// Se escucha solo mientras un lote tiene un capítulo abierto (`escuchar`): un oyente registrado
// siempre despertaría al service worker con cada página que se abre en el navegador. Mientras
// dura el capítulo el service worker está despierto igual (batchChapter lo mantiene).
//
// Desde la 2.11.4 se escuchan también las imágenes que carga la página: una imagen rota no dice
// por qué, y sin esto un capítulo con una página en 503 se guardaba con las que cargaron, como si
// estuviera entero. Se anota, por pestaña, cada imagen que contestó 429 o 503; cuáles cuentan lo
// decide imagenQuePidioEsperar, antes de pedirle al marco que guarde.
const pedidos = new Map();      // pestaña → { retryAfter, cuando } de su último documento, si pidió esperar
const imagenesEnEspera = new Map();   // pestaña → [{ url, original?, status, retryAfter, cuando }] de sus imágenes que contestaron 429 o 503
const redirecciones = new Map();      // pedido (requestId) → la primera dirección de una imagen que se redirigió
const retryAfterDe = (d) => { const h = (d.responseHeaders || []).find(x => String(x.name).toLowerCase() === 'retry-after'); return h ? String(h.value || '') : ''; };

// ¿Es la misma imagen? La misma dirección, aunque la página le haya agregado algo a la consulta para
// volver a pedirla (un lector que reintenta con "?t=…"): mismo sitio y ruta, y cada dato de la
// consulta de `a` también en la de `b`. (Así "imagen.php?cap=7&p=3" no es la misma que la de p=1.)
function mismaImagen(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    const x = new URL(a), y = new URL(b);
    if (x.origin !== y.origin || x.pathname !== y.pathname) return false;
    for (const [k, v] of x.searchParams) if (!y.searchParams.getAll(k).includes(v)) return false;
    return true;
  } catch { return false; }
}

function alResponder(d) {
  const espera = d.statusCode === 429 || d.statusCode === 503;
  if (d.type === 'image') {
    if (d.tabId == null || d.tabId < 0) return;           // (las del armador no son de una pestaña)
    // Una imagen que se redirige se sigue por su pedido: la página la pidió con la primera dirección
    if (d.statusCode >= 300 && d.statusCode < 400 && d.statusCode !== 304) {
      if (d.requestId != null && !redirecciones.has(d.requestId)) redirecciones.set(d.requestId, d.url);
      if (redirecciones.size > 500) redirecciones.delete(redirecciones.keys().next().value);
      return;
    }
    const original = (d.requestId != null && redirecciones.get(d.requestId)) || '';
    if (d.requestId != null) redirecciones.delete(d.requestId);
    const lista = imagenesEnEspera.get(d.tabId) || [];
    if (!espera) {
      // Cargó: si antes había pedido esperar (con esta dirección o con la primera, o con alguna de las
      // dos y menos datos en la consulta), ya no faltó
      const nueva = lista.filter(x => ![x.url, x.original].some(f => f && (mismaImagen(f, d.url) || (original && mismaImagen(f, original)))));
      if (nueva.length !== lista.length) imagenesEnEspera.set(d.tabId, nueva);
      return;
    }
    const nueva = lista.filter(x => x.url !== d.url).slice(-199);
    nueva.push({ url: d.url, ...(original ? { original } : {}), status: d.statusCode, retryAfter: retryAfterDe(d), cuando: Date.now() });
    imagenesEnEspera.set(d.tabId, nueva);
    return;
  }
  if (!espera) { pedidos.delete(d.tabId); return; }
  pedidos.set(d.tabId, { retryAfter: retryAfterDe(d), cuando: Date.now() });
}
let oyentes = 0;                // capítulos de lote abiertos ahora (puede haber lotes en varias pestañas)
function escuchar(si) {
  const ev = chrome.webRequest?.onHeadersReceived;
  if (!ev) return;
  if (si && oyentes++ === 0) ev.addListener(alResponder, { urls: ['http://*/*', 'https://*/*'], types: ['main_frame', 'image'] }, ['responseHeaders']);
  if (!si && oyentes > 0 && --oyentes === 0) { ev.removeListener(alResponder); pedidos.clear(); imagenesEnEspera.clear(); redirecciones.clear(); }
}
const sitiosDeLote = new Map(); // pestaña del capítulo → sitio (host) al que el lote le pidió ese capítulo

// De las imágenes que la página pidió y el sitio contestó con 429 o 503, las que cuentan: las páginas
// del capítulo que no cargaron. Una falla cuenta si es una de las páginas, o si es de su carpeta (la
// carpeta de la mayoría, sin un adaptador: con uno, cada página puede estar en otra), y no cargó
// después (con esa dirección, o con la misma y algo agregado a la consulta). Una de otra carpeta (un
// aviso, un banner, la tapa de un "relacionado", aunque sea del mismo sitio) no es del capítulo. Sin
// ninguna página, cualquiera. Devuelve las que cuentan, de la más vieja a la más nueva.
//   urls: las páginas, cargadas o no (de ahí sale la carpeta) · pedidas: la dirección que el
//   navegador pidió de cada una, si es otra (srcset) · cargadas: las que cargaron · n: cuántas cuenta
//   el marco (si dice que tiene pero no cuáles, no se decide acá) · adaptado: hay un adaptador.
//   exigirFaltante: además, solo si alguna de las páginas no cargó (para la cuenta rápida de los
//   marcos, que puede estar atrasada: si ya cargaron todas, nada faltó).
// (Es la regla del programa de escritorio, imagenQuePidioEsperar en su main.js, con lo que la
// extensión necesita además: los adaptadores, las redirecciones y las páginas que se vuelven a pedir.)
function imagenesQuePidieronEsperar(tabId, { n = null, urls = [], pedidas = [], cargadas = [], adaptado = false, exigirFaltante = false } = {}) {
  const fallas = imagenesEnEspera.get(tabId) || [];
  if (!fallas.length) return [];
  const resuelta = (x) => cargadas.some(c => mismaImagen(x.url, c) || (x.original && mismaImagen(x.original, c)));
  if (!urls.length) return n > 0 ? [] : fallas.filter(x => !resuelta(x));
  if (exigirFaltante && urls.every(u => cargadas.includes(u))) return [];
  const paginas = [...urls, ...pedidas];
  const esPagina = (u) => !!u && paginas.some(p => mismaImagen(p, u));
  const carpeta = (u) => String(u).split(/[?#]/)[0].replace(/[^/]*$/, '');
  const cuenta = new Map();
  for (const u of urls) cuenta.set(carpeta(u), (cuenta.get(carpeta(u)) || 0) + 1);
  const principal = adaptado ? '' : [...cuenta].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const deLaCarpeta = (u) => !!u && !!principal && carpeta(u) === principal;
  return fallas.filter(x => !resuelta(x) && (esPagina(x.url) || esPagina(x.original) || deLaCarpeta(x.url) || deLaCarpeta(x.original)));
}

// La misma pregunta desde el capítulo abierto, justo antes de guardar (autoSave): sirve para las
// imágenes que se pidieron recién ahí, al medir las que todavía no habían cargado. Solo vale en la
// pestaña de un capítulo de un lote; si cuenta, el sitio queda frenado por el mismo camino.
// `urls`: las páginas ya medidas, las que cargaron y las que no · `cargadas`: las que cargaron.
async function imagenEnEspera({ urls, cargadas, adaptado }, sender) {
  const tabId = sender.tab?.id;
  if (tabId == null || !sitiosDeLote.has(tabId)) return {};
  const todas = Array.isArray(urls) ? urls.filter(u => typeof u === 'string') : [];
  const fallas = imagenesQuePidieronEsperar(tabId, { n: todas.length, urls: todas, cargadas: Array.isArray(cargadas) ? cargadas : todas, adaptado: !!adaptado });
  if (!fallas.length) return {};
  await frenarPor(sitiosDeLote.get(tabId), fallas);
  return { status: fallas[fallas.length - 1].status };
}

// Deja al sitio frenado por cada imagen que pidió esperar: anotarEspera se queda con la que más
// pide, contada desde que llegó cada respuesta (no solo la primera: una que llegó después puede
// pedir más)
async function frenarPor(sitio, fallas) {
  for (const f of fallas) await anotarEspera(sitio, f.retryAfter, f.cuando).catch(() => {});
}

// Anota hasta cuándo no pedirle a ese sitio. `desde` es cuándo llegó la respuesta que lo pidió.
async function anotarEspera(sitio, retryAfter, desde = Date.now()) {
  if (!sitio) return;
  const st = await chrome.storage.local.get(['ritmo', 'esperaSitio']);
  const hasta = desde + MR_AJUSTES.esperaDelSitio(retryAfter, st.ritmo, desde);
  const ahora = Date.now();
  const esperas = Object.fromEntries(Object.entries(st.esperaSitio || {}).filter(([, t]) => t > ahora));   // las vencidas se van
  esperas[sitio] = Math.max(esperas[sitio] || 0, hasta);
  await chrome.storage.local.set({ esperaSitio: esperas });
}
const sitioDe = (url) => { try { return new URL(url).hostname; } catch { return ''; } };

const workers = new Map();      // pestaña que maneja el lote → pestaña del capítulo abierto
const owners = new Map();       // pestaña del capítulo → { tab, frame } que maneja el lote
const cancelled = new Set();    // lotes cancelados (por pestaña que los maneja)

function batchNote(workerTabId, text) {
  const owner = owners.get(workerTabId);
  if (owner) chrome.tabs.sendMessage(owner.tab, { action: 'batchNote', text }, { frameId: owner.frame }).catch(() => {});
}

async function batchCancel(sender) {
  const owner = sender.tab?.id;
  cancelled.add(owner);
  const w = workers.get(owner);
  if (w != null) await chrome.tabs.remove(w).catch(() => {});
  return {};
}

async function batchChapter(msg, sender) {
  const owner = sender.tab?.id;
  if (owner == null) throw new Error('Falta la pestaña de origen');
  if (!/^https?:\/\//i.test(msg.url || '')) throw new Error('Dirección no válida');
  cancelled.delete(owner);
  if (msg.pause) await sleep(msg.pause);                 // respiro entre capítulos, para no cargar al sitio
  if (cancelled.has(owner)) throw new Error('Cancelado');

  // Mientras dura el capítulo hay que mantener despierto al service worker
  const keep = setInterval(() => chrome.runtime.getPlatformInfo().catch(() => {}), 20000);
  let tab, timer;
  escuchar(true);                                        // antes de abrirla: la respuesta llega enseguida
  try {
    tab = await chrome.tabs.create({ url: msg.url, active: !!msg.visible, index: sender.tab.index + 1, openerTabId: owner });
    workers.set(owner, tab.id);
    owners.set(tab.id, { tab: owner, frame: sender.frameId || 0 });
    sitiosDeLote.set(tab.id, sitioDe(msg.url));
    const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('El capítulo tardó demasiado')), 240000); });
    const work = driveChapter(tab.id, msg);
    work.catch(() => {});                                // si gana el límite, su error posterior no queda suelto
    const r = await Promise.race([work, limit]);
    // El que salió bien se anota desde acá: vale aunque la pestaña del lote ya se haya cerrado.
    // Los que fallan los anota ella, que es la que sabe si quedaba otra dirección por probar.
    // (Uno que ya estaba guardado también queda listo: no hay nada que reintentar.)
    if (msg.cola && (r?.complete || r?.yaEstaba)) colaMarca({ id: msg.cola, numero: msg.numero, estado: 'listo' }).catch(() => {});
    return r;
  } catch (e) {
    throw cancelled.has(owner) ? new Error('Cancelado') : e;
  } finally {
    clearInterval(keep);
    clearTimeout(timer);
    if (tab) {
      workers.delete(owner);
      owners.delete(tab.id);
      sitiosDeLote.delete(tab.id);
      pedidos.delete(tab.id);
      imagenesEnEspera.delete(tab.id);
      await chrome.tabs.remove(tab.id).catch(() => {});
    }
    escuchar(false);
    if (msg.visible) chrome.tabs.update(owner, { active: true }).catch(() => {});
  }
}

async function driveChapter(tabId, msg) {
  // 1) Que termine de cargar la página
  for (let i = 0; i < 150; i++) {
    const t = await chrome.tabs.get(tabId);
    if (t.status === 'complete') break;
    await sleep(300);
  }
  // 1b) Si el sitio contestó "esperá" (429) o que está ocupado (503), no hay capítulo que buscar:
  //     se avisa con ese motivo, para que el lote pare un rato en vez de seguir pidiendo.
  const codigo = await chrome.scripting.executeScript({ target: { tabId }, func: () => performance.getEntriesByType('navigation')[0]?.responseStatus || 0 })
    .then(r => (r?.[0]?.frameId ? 0 : r?.[0]?.result) || 0, () => 0);
  if (codigo === 429 || codigo === 503) {
    // Cuánto pidió: lo que traía la cabecera de esa respuesta (si webRequest no la vio, un minuto)
    const p = pedidos.get(tabId);
    await anotarEspera(sitiosDeLote.get(tabId) || sitioDe(msg.url), p?.retryAfter, p?.cuando).catch(() => {});
    throw new Error(`HTTP ${codigo}: el sitio pidió esperar`);
  }
  // 2) Que aparezcan las páginas del capítulo y dejen de sumarse (los sitios que arman
  //    la página con JavaScript tardan un poco más). Se pregunta desde acá porque en
  //    una pestaña en segundo plano los temporizadores de la página van lentos.
  //    Vale el marco que más tiene, no la suma: si las mismas páginas están en la página y en
  //    un iframe, se contarían dos veces.
  let last = -1, stable = 0, marcos = [];
  for (let i = 0; i < 30; i++) {
    await sleep(700);
    const cuenta = await contarMarcos(tabId).catch(() => null);
    if (cuenta) marcos = cuenta;                         // (si una vuelta falla, vale la última que anduvo)
    const n = Math.max(-1, ...(cuenta || []).map(m => m.n));
    if (n >= 3 && n === last) { if (++stable >= 2) break; } else stable = 0;
    if (n < 3 && i >= 14) break;                         // ~10 s sin nada que parezca un capítulo
    last = n;
  }
  const capitulo = { serie: msg.serie, numero: msg.numero, strict: msg.strict, fixed: !!msg.fixed, volumen: msg.volumen || '', titulo: msg.titulo || '' };
  // 2b) (2.11.4) Si el sitio contestó 429 o 503 a una de las páginas mientras la página las
  //     cargaba, pidió esperar: el sitio queda frenado y el capítulo no se arma con las que cargaron
  //     (como cuando lo dice su página o el armador). Se mira antes de pedirle al marco que guarde,
  //     con las páginas que cuenta el marco elegido. Si ya estaba guardado (y el lote saltea los
  //     guardados), sigue siendo "ya estaba".
  const elegido = marcos.length ? marcos.find(m => m.frameId === marcoCon(marcos)) : null;
  const fallas = elegido ? imagenesQuePidieronEsperar(tabId, { ...elegido, exigirFaltante: true }) : [];
  if (fallas.length) {
    await frenarPor(sitiosDeLote.get(tabId) || sitioDe(msg.url), fallas);
    if (msg.saltear) {
      const ya = await chrome.tabs.sendMessage(tabId, { action: 'yaGuardado', ...capitulo }, { frameId: elegido.frameId }).catch(() => null);
      if (ya?.guardado) return { ok: true, yaEstaba: true, name: ya.name || '', pages: 0, complete: false, lines: [] };
    }
    throw new Error(`HTTP ${fallas[fallas.length - 1].status}: el sitio pidió esperar`);
  }
  // 3) Que se guarde sola
  const r = await tellTab(tabId, { action: 'autoSave', formats: msg.formats, ...capitulo, saltear: !!msg.saltear });
  if (!r?.ok) throw new Error(r?.error || 'La pestaña del capítulo no respondió');
  return r;
}
