/**
 * Background Service Worker v2.0
 * - Menú contextual y atajo (Alt+S): guardar capítulo
 * - Descarga de imágenes en tamaño original
 * - PDF del capítulo (se arma en offscreen.html)
 */

// ── Context menu ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'manga-save',
      title: '💾 Guardar capítulo (PDF / CBZ)',
      contexts: ['page', 'image'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const action = info.menuItemId === 'manga-save' ? 'save' : null;
  if (action && tab?.id != null) chrome.tabs.sendMessage(tab.id, { action }).catch(() => {});
});

// ── Atajo de teclado (Alt+S) ──────────────────────────

chrome.commands.onCommand.addListener((command, tab) => {
  if (tab?.id != null) chrome.tabs.sendMessage(tab.id, { action: command }).catch(() => {});
});

// ── Message handler ───────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === 'offscreen') return; // es para el documento offscreen

  // Progreso del PDF → reenviar a la pestaña que lo pidió
  if (msg?.target === 'background' && msg.action === 'pdfProgress') {
    const tabId = pdfJobs.get(msg.jobId);
    if (tabId != null) {
      chrome.tabs.sendMessage(tabId, { action: 'pdfProgress', done: msg.done, total: msg.total }).catch(() => {});
    }
    return;
  }

  const handlers = {
    downloadImage: () => dlImage(msg.url, msg.filename),
    buildPdf: () => buildPdf(msg, sender),
    buildCbz: () => buildPdf(msg, sender),
  };

  const h = handlers[msg.action];
  if (h) {
    h().then(r => sendResponse({ ok: true, ...r }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

// ── Download (always original/full size) ──────────────

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

async function dlImage(url, filename) {
  // Try 1: direct download (preserves original size/format)
  try {
    const { id } = await safeDownload({ url, filename, saveAs: false });
    if (id) return {};
  } catch {}

  // Try 2: fetch via background (bypass CORS/referer) then download as data URL
  try {
    const r = await fetch(url, { headers: { 'Accept': 'image/*' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();

    // Fix extension based on actual content-type from server
    const ct = r.headers.get('content-type') || '';
    const realExt = ctToExt(ct);
    const fixedFilename = realExt ? filename.replace(/\.\w+$/, '.' + realExt) : filename;

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsDataURL(blob);
    });

    await safeDownload({ url: dataUrl, filename: fixedFilename, saveAs: false });
    return {};
  } catch (e) {
    throw new Error('No se pudo descargar: ' + e.message);
  }
}

// ── PDF del capítulo ──────────────────────────────────
// El service worker no puede crear Blob URLs, así que el PDF se arma en un
// documento offscreen y desde acá se descarga con chrome.downloads.

const pdfJobs = new Map();      // jobId → tabId (para reenviar el progreso)
const pdfBlobs = new Map();     // downloadId → blob URL (para liberarlo al terminar)
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
      justification: 'Armar el PDF del capítulo para descargarlo',
    }).catch(e => {
      if (!/single offscreen/i.test(e.message)) throw e; // ya existía → OK
    }).finally(() => { offscreenCreating = null; });
  }
  await offscreenCreating;
}

// Sirve para PDF y CBZ: el documento offscreen arma el archivo según `action`
async function buildPdf({ action, urls, title, meta, filename }, sender) {
  if (!urls?.length) throw new Error('No hay páginas para guardar');
  // El trabajo se registra ANTES de preparar el documento offscreen: así la limpieza
  // de una descarga anterior no lo cierra justo cuando este trabajo lo necesita.
  const jobId = crypto.randomUUID();
  pdfJobs.set(jobId, sender.tab?.id);
  try {
    const request = { target: 'offscreen', action, urls, title, meta, jobId };
    let r;
    try {
      await ensureOffscreen();
      r = await chrome.runtime.sendMessage(request);
    } catch (e) {
      if (!/receiving end|message port closed/i.test(e.message)) throw e;
      await new Promise(res => setTimeout(res, 300));   // se estaba cerrando: recrearlo y reintentar
      await ensureOffscreen();
      r = await chrome.runtime.sendMessage(request);
    }
    if (!r?.ok) throw new Error(r?.error || 'No se pudo armar el archivo');

    let saved;
    try {
      saved = await safeDownload({ url: r.url, filename, saveAs: false, conflictAction: 'uniquify' });
    } catch (e) {
      chrome.runtime.sendMessage({ target: 'offscreen', action: 'revoke', url: r.url }).catch(() => {});
      throw e;
    }
    pdfBlobs.set(saved.id, r.url);
    return { pages: r.pages, failed: r.failed, sizeKB: r.sizeKB, savedAs: saved.filename };
  } finally {
    pdfJobs.delete(jobId);
  }
}

chrome.downloads.onChanged.addListener((d) => {
  const url = pdfBlobs.get(d.id);
  const state = d.state?.current;
  if (!url || (state !== 'complete' && state !== 'interrupted')) return;
  pdfBlobs.delete(d.id);
  chrome.runtime.sendMessage({ target: 'offscreen', action: 'revoke', url }).catch(() => {});
  if (!pdfBlobs.size && !pdfJobs.size) chrome.offscreen.closeDocument().catch(() => {});
});

function ctToExt(contentType) {
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return null;
}
