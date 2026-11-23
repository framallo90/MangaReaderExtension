/**
 * Background Service Worker v2.11.0
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
// uno), y cada marco cuenta sus candidatas. Devuelve [{ frameId, n }]; n = -1 si ese marco no
// tiene una copia viva del script.
async function contarMarcos(tabId) {
  const r = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => (window.__mangaReaderAlive?.() && typeof window.__mangaReaderCuenta === 'function' ? window.__mangaReaderCuenta() : -1),
  });
  return (r || []).map(x => ({ frameId: x.frameId, n: typeof x.result === 'number' ? x.result : -1 }));
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
const AL_LECTOR = new Set(['save', 'autoSave']);

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
//   { pages, failed: [n…], files: [{kind, sizeKB, savedAs} | {kind, error}], imgs, imgsFailed, imgError }
async function runBuild({ urls, formats, title, meta, path }, sender) {
  if (!urls?.length) throw new Error('No hay páginas para guardar');
  // El trabajo se registra ANTES de preparar el documento offscreen: así la limpieza
  // de una descarga anterior no lo cierra justo cuando este trabajo lo necesita.
  const jobId = crypto.randomUUID();
  jobs.set(jobId, { tabId: sender.tab?.id, frameId: sender.frameId || 0 });
  try {
    const request = { target: 'offscreen', action: 'build', urls, formats, title, meta, jobId };
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
    if (!r?.ok) throw new Error(r?.error || 'No se pudo armar el archivo');

    const out = { pages: r.pages, failed: r.failed || [], files: [], imgs: 0, imgsKB: 0, imgsFailed: 0, imgError: '' };
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

function avisarFin(cola) {
  if (!chrome.notifications) return;
  const total = cola.items.length;
  const listos = cola.items.filter(i => i.estado === 'listo').length;
  const fallos = cola.items.filter(i => i.estado === 'fallo').length;
  const pend = total - listos - fallos;
  chrome.notifications.create(AVISO, {
    type: 'basic', iconUrl: chrome.runtime.getURL ? chrome.runtime.getURL('icons/icon128.png') : 'icons/icon128.png',
    title: fallos ? 'Manga Reader: lote terminado con fallas' : 'Manga Reader: lote terminado',
    message: `${listos} de ${total} capítulos guardados` + (fallos ? ` · ${fallos} con fallas` : '') + (pend ? ` · ${pend} sin bajar` : '') + (cola.serie ? ` · ${cola.serie}` : ''),
    // (qué botones hay sale de la cola guardada: así el clic se entiende aunque el service worker se haya dormido)
    buttons: [...(fallos ? [{ title: 'Reintentar los que fallaron' }] : []), { title: 'Mostrar la carpeta' }],
  });
}

if (chrome.notifications?.onButtonClicked) {
  chrome.notifications.onButtonClicked.addListener(async (id, indice) => {
    if (id !== AVISO) return;
    const st = await chrome.storage.local.get(['cola', 'ultimaDescarga']);
    const hayFallos = !!st.cola && st.cola.items.some(i => i.estado === 'fallo');
    const accion = hayFallos ? ['reintentar', 'carpeta'][indice] : 'carpeta';
    chrome.notifications.clear(id);
    if (accion === 'carpeta') { if (st.ultimaDescarga != null) chrome.downloads.show(st.ultimaDescarga); return; }
    reintentarDesdeAviso(st.cola).catch(() => {});
  });
}

// "Reintentar los que fallaron" desde la notificación: se vuelve a la página de la serie (la
// misma pestaña si sigue abierta) y el diálogo de varios capítulos retoma la cola.
async function reintentarDesdeAviso(cola) {
  const igual = (u) => String(u || '').split('#')[0].replace(/\/(?=\?|$)/, '');
  let tab = (await chrome.tabs.query({})).find(t => igual(t.url) === igual(cola.origen));
  if (tab) await chrome.tabs.update(tab.id, { active: true });
  else {
    tab = await chrome.tabs.create({ url: cola.origen, active: true });
    for (let i = 0; i < 100 && (await chrome.tabs.get(tab.id)).status !== 'complete'; i++) await sleep(300);
  }
  return tellTab(tab.id, { action: 'batch', reintentar: true });
}

async function colaDescartar() {
  await conCola(() => null);
  return {};
}

// ── Varios capítulos seguidos ─────────────────────────
// La pestaña desde donde se inició el lote pide los capítulos de a uno. Cada capítulo
// se abre en una pestaña propia: ahí el sitio arma la página como siempre (aunque lo
// haga con JavaScript) y el content script la guarda con el mismo código de siempre.

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
  try {
    tab = await chrome.tabs.create({ url: msg.url, active: !!msg.visible, index: sender.tab.index + 1, openerTabId: owner });
    workers.set(owner, tab.id);
    owners.set(tab.id, { tab: owner, frame: sender.frameId || 0 });
    const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('El capítulo tardó demasiado')), 240000); });
    const work = driveChapter(tab.id, msg);
    work.catch(() => {});                                // si gana el límite, su error posterior no queda suelto
    const r = await Promise.race([work, limit]);
    // El que salió bien se anota desde acá: vale aunque la pestaña del lote ya se haya cerrado.
    // Los que fallan los anota ella, que es la que sabe si quedaba otra dirección por probar.
    if (msg.cola && r?.complete) colaMarca({ id: msg.cola, numero: msg.numero, estado: 'listo' }).catch(() => {});
    return r;
  } catch (e) {
    throw cancelled.has(owner) ? new Error('Cancelado') : e;
  } finally {
    clearInterval(keep);
    clearTimeout(timer);
    if (tab) {
      workers.delete(owner);
      owners.delete(tab.id);
      await chrome.tabs.remove(tab.id).catch(() => {});
    }
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
  if (codigo === 429 || codigo === 503) throw new Error(`HTTP ${codigo}: el sitio pidió esperar`);
  // 2) Que aparezcan las páginas del capítulo y dejen de sumarse (los sitios que arman
  //    la página con JavaScript tardan un poco más). Se pregunta desde acá porque en
  //    una pestaña en segundo plano los temporizadores de la página van lentos.
  //    Vale el marco que más tiene, no la suma: si las mismas páginas están en la página y en
  //    un iframe, se contarían dos veces.
  let last = -1, stable = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(700);
    const n = Math.max(-1, ...(await contarMarcos(tabId).catch(() => [])).map(m => m.n));
    if (n >= 3 && n === last) { if (++stable >= 2) break; } else stable = 0;
    if (n < 3 && i >= 14) break;                         // ~10 s sin nada que parezca un capítulo
    last = n;
  }
  // 3) Que se guarde sola
  const r = await tellTab(tabId, { action: 'autoSave', formats: msg.formats, serie: msg.serie, numero: msg.numero, strict: msg.strict, fixed: !!msg.fixed,
    volumen: msg.volumen || '', titulo: msg.titulo || '' });
  if (!r?.ok) throw new Error(r?.error || 'La pestaña del capítulo no respondió');
  return r;
}
