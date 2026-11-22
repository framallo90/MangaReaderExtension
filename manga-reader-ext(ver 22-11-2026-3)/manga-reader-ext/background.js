/**
 * Background Service Worker v2.8.6
 * - Menú contextual y atajo (Alt+S)
 * - Inyecta el script en las pestañas abiertas antes de instalar o actualizar (sin F5)
 * - Guardado: el documento offscreen baja las páginas una vez y arma PDF / CBZ / imágenes;
 *   desde acá se descargan con chrome.downloads
 * - Varios capítulos: abre cada uno en su pestaña, le pide que se guarde y la cierra
 */

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

async function tellTab(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch (e) {
    if (!/receiving end|context invalidated|port closed/i.test(e.message)) throw e;
  }
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['styles.css'] });
  await chrome.scripting.executeScript({ target: { tabId }, files: ['sagas.js', 'content.js'] });
  return chrome.tabs.sendMessage(tabId, msg);
}

// ── Message handler ───────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === 'offscreen') return; // es para el documento offscreen

  // Progreso de la bajada de páginas → a la pestaña que pidió el guardado
  if (msg?.target === 'background' && msg.action === 'progress') {
    const tabId = jobs.get(msg.jobId);
    if (tabId != null) {
      chrome.tabs.sendMessage(tabId, { action: 'progress', done: msg.done, total: msg.total }).catch(() => {});
      batchNote(tabId, `bajando páginas ${msg.done}/${msg.total}`);
    }
    return;
  }

  const handlers = {
    build: () => runBuild(msg, sender),
    tab: () => tellTab(msg.tabId, { action: msg.command }).then(() => ({})),   // desde el popup
    batchChapter: () => batchChapter(msg, sender),
    batchCancel: () => batchCancel(sender),
    batchNote: () => { batchNote(sender.tab?.id, msg.text); return Promise.resolve({}); },
  };

  const h = handlers[msg?.action];
  if (h) {
    h().then(r => sendResponse({ ok: true, ...r }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

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

const jobs = new Map();         // jobId → tabId (para reenviar el progreso)
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

// Baja las páginas una vez y guarda lo pedido en MangaReader/<path>.pdf, .cbz y/o
// MangaReader/<path>/pagina_NNN.<ext>. Devuelve:
//   { pages, failed: [n…], files: [{kind, sizeKB, savedAs} | {kind, error}], imgs, imgsFailed, imgError }
async function runBuild({ urls, formats, title, meta, path }, sender) {
  if (!urls?.length) throw new Error('No hay páginas para guardar');
  // El trabajo se registra ANTES de preparar el documento offscreen: así la limpieza
  // de una descarga anterior no lo cierra justo cuando este trabajo lo necesita.
  const jobId = crypto.randomUUID();
  jobs.set(jobId, sender.tab?.id);
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

    const out = { pages: r.pages, failed: r.failed || [], files: [], imgs: 0, imgsFailed: 0, imgError: '' };
    for (const f of r.files) {
      const filename = f.kind === 'img' ? `MangaReader/${path}/${f.name}` : `MangaReader/${path}.${f.kind}`;
      try {
        const saved = await safeDownload({ url: f.url, filename, saveAs: false, conflictAction: 'uniquify' });
        blobs.set(saved.id, f.url);
        const res = await waitDownload(saved.id);
        if (res.state !== 'timeout' && blobs.delete(saved.id)) revoke([f.url]);
        if (res.state === 'interrupted') throw new Error(res.error || 'descarga interrumpida');
        if (f.kind === 'img') out.imgs++;
        else out.files.push({ kind: f.kind, sizeKB: f.sizeKB, savedAs: saved.filename !== filename ? saved.filename : '' });
      } catch (e) {
        if (![...blobs.values()].includes(f.url)) revoke([f.url]);
        if (f.kind === 'img') { out.imgsFailed++; out.imgError = e.message; }
        else out.files.push({ kind: f.kind, error: e.message });
      }
    }
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

// ── Varios capítulos seguidos ─────────────────────────
// La pestaña desde donde se inició el lote pide los capítulos de a uno. Cada capítulo
// se abre en una pestaña propia: ahí el sitio arma la página como siempre (aunque lo
// haga con JavaScript) y el content script la guarda con el mismo código de siempre.

const workers = new Map();      // pestaña que maneja el lote → pestaña del capítulo abierto
const owners = new Map();       // pestaña del capítulo → pestaña que maneja el lote
const cancelled = new Set();    // lotes cancelados (por pestaña que los maneja)

function batchNote(workerTabId, text) {
  const owner = owners.get(workerTabId);
  if (owner != null) chrome.tabs.sendMessage(owner, { action: 'batchNote', text }).catch(() => {});
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
    owners.set(tab.id, owner);
    const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('El capítulo tardó demasiado')), 240000); });
    const work = driveChapter(tab.id, msg);
    work.catch(() => {});                                // si gana el límite, su error posterior no queda suelto
    return await Promise.race([work, limit]);
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
  // 2) Que aparezcan las páginas del capítulo y dejen de sumarse (los sitios que arman
  //    la página con JavaScript tardan un poco más). Se pregunta desde acá porque en
  //    una pestaña en segundo plano los temporizadores de la página van lentos.
  let last = -1, stable = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(700);
    const n = (await tellTab(tabId, { action: 'count' }).catch(() => null))?.n ?? -1;
    if (n >= 3 && n === last) { if (++stable >= 2) break; } else stable = 0;
    if (n < 3 && i >= 14) break;                         // ~10 s sin nada que parezca un capítulo
    last = n;
  }
  // 3) Que se guarde sola
  const r = await tellTab(tabId, { action: 'autoSave', formats: msg.formats, serie: msg.serie, numero: msg.numero, strict: msg.strict });
  if (!r?.ok) throw new Error(r?.error || 'La pestaña del capítulo no respondió');
  return r;
}
