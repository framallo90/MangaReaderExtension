// Service worker con chrome.* simulado: guardado (runBuild), inyección del script en la
// pestaña (tellTab) y un capítulo de un lote (batchChapter).
// Uso: node tests/test_descargas.js "<carpeta de la versión>/manga-reader-ext"
const fs = require('fs'), vm = require('vm'), path = require('path');
const { probador } = require('./extraer');
const src = fs.readFileSync(path.join(process.argv[2], 'background.js'), 'utf8');
// Los scripts que el manifest carga en cada pestaña: los que se inyectan a mano tienen que ser los mismos
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'manifest.json'), 'utf8')).content_scripts[0].js;
const { eq, fin } = probador();
const ev = () => { const ls = []; return { addListener: f => ls.push(f), removeListener: f => { const i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1); }, emit: (...a) => [...ls].forEach(f => f(...a)), count: () => ls.length }; };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// build: lo que responde el documento offscreen · results: cómo termina cada descarga, por URL
// ('complete' por defecto, 'interrupted', 'hang') · onTabMessage: lo que responde la pestaña
function setup({ build, results = {}, invalidName = false, onTabMessage } = {}) {
  const onChanged = ev(); let nextId = 1, jobN = 0, offscreen = 0;
  const items = {}, log = [], revoked = [], tabLog = [], t = { closed: 0, onRemove: null };
  const finishDownload = (id, result) => {
    items[id].state = result;
    if (result === 'interrupted') items[id].error = 'FILE_FAILED';
    onChanged.emit({ id, state: { current: result }, ...(result === 'interrupted' ? { error: { current: 'FILE_FAILED' } } : {}) });
  };
  const chrome = {
    runtime: {
      onInstalled: ev(), onMessage: ev(),
      getContexts: async () => (offscreen ? [{}] : []),
      getPlatformInfo: async () => ({}),
      sendMessage: async (m) => {
        if (m.target !== 'offscreen') return {};
        if (m.action === 'revoke') { revoked.push(...m.urls); return undefined; }
        return typeof build === 'function' ? build(m) : build;
      },
    },
    contextMenus: { onClicked: ev(), removeAll: f => f && f(), create() {} },
    commands: { onCommand: ev() },
    offscreen: { createDocument: async () => { offscreen++; }, closeDocument: async () => { t.closed++; offscreen = 0; } },
    downloads: {
      onChanged,
      search: async ({ id }) => [items[id]],
      download: async (o) => {
        if (invalidName && /[^\x20-\x7E]/.test(o.filename)) throw new Error('Invalid filename');
        const id = nextId++;
        log.push(o.filename);
        items[id] = { id, state: 'in_progress', url: o.url };
        const result = results[o.url] || 'complete';
        if (result !== 'hang') setTimeout(() => finishDownload(id, result), 5);
        return id;
      },
    },
    tabs: {
      sendMessage: async (tabId, m) => { tabLog.push(`msg ${tabId} ${m.action}`); return onTabMessage ? onTabMessage(tabId, m) : { ok: true }; },
      create: async (o) => { tabLog.push(`create ${o.url} active=${o.active}`); return { id: 50 }; },
      get: async (id) => ({ id, status: 'complete' }),
      remove: async (id) => { tabLog.push(`remove ${id}`); if (t.onRemove) t.onRemove(id); },
      update: async (id) => { tabLog.push(`update ${id}`); },
    },
    scripting: {
      insertCSS: async (o) => { tabLog.push('css ' + o.files.join('+')); },
      executeScript: async (o) => { tabLog.push('js ' + o.files.join('+')); },
    },
  };
  // El tiempo corre 500 veces más rápido para que la prueba no tarde (20 s → 40 ms),
  // conservando el orden de las esperas
  const ctx = { chrome, console, clearTimeout, setInterval, clearInterval,
    setTimeout: (f, ms) => setTimeout(f, Math.ceil((ms || 0) / 500)), crypto: { randomUUID: () => 'job-' + (++jobN) } };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;Object.assign(globalThis, { blobs, jobs, workers, owners });', ctx);
  return Object.assign(t, { ctx, log, revoked, tabLog, onChanged, finishDownload });
}

const FILES = [
  { kind: 'pdf', url: 'blob:pdf', sizeKB: 100 }, { kind: 'cbz', url: 'blob:cbz', sizeKB: 120 },
  { kind: 'img', name: 'pagina_001.jpg', url: 'blob:i1', sizeKB: 50 }, { kind: 'img', name: 'pagina_002.png', url: 'blob:i2', sizeKB: 60 },
];
const REQ = { urls: ['u1', 'u2'], formats: { pdf: true, cbz: true, imgs: true }, title: 'S 0001', meta: {}, path: 'S/S 0001' };
const SENDER = { tab: { id: 7, index: 3 } };
const brief = (r) => `páginas=${r.pages} fallidas=[${r.failed}] archivos=[${r.files.map(f => f.kind + (f.error ? ' ERROR ' + f.error : '') + (f.savedAs ? ' como ' + f.savedAs : '')).join(', ')}] imgs=${r.imgs} imgsFallidas=${r.imgsFailed}`;

(async () => {
  // ── Guardado ──
  {
    const t = setup({ build: { ok: true, pages: 2, failed: [], files: FILES } });
    const r = await t.ctx.runBuild(REQ, SENDER);
    eq('todo bien: nombres de archivo', t.log.join(' | '), 'MangaReader/S/S 0001.pdf | MangaReader/S/S 0001.cbz | MangaReader/S/S 0001/pagina_001.jpg | MangaReader/S/S 0001/pagina_002.png');
    eq('todo bien: resultado', brief(r), 'páginas=2 fallidas=[] archivos=[pdf, cbz] imgs=2 imgsFallidas=0');
    eq('todo bien: se liberan los 4 archivos en memoria', [...t.revoked].sort().join(','), 'blob:cbz,blob:i1,blob:i2,blob:pdf');
    eq('todo bien: se cierra el documento offscreen', t.closed >= 1, true);
    eq('todo bien: sin listeners colgados (queda solo el fijo)', t.onChanged.count(), 1);
    eq('todo bien: sin trabajos colgados', t.ctx.jobs.size + t.ctx.blobs.size, 0);
  }
  {
    const t = setup({ build: { ok: true, pages: 2, failed: [], files: FILES }, results: { 'blob:i2': 'interrupted' } });
    const r = await t.ctx.runBuild(REQ, SENDER);
    eq('una imagen no se pudo escribir', brief(r) + ' motivo=' + r.imgError, 'páginas=2 fallidas=[] archivos=[pdf, cbz] imgs=1 imgsFallidas=1 motivo=FILE_FAILED');
    eq('  igual se liberan todos', new Set(t.revoked).size, 4);
  }
  {
    const t = setup({ build: { ok: true, pages: 2, failed: [], files: FILES.slice(0, 2) }, results: { 'blob:pdf': 'interrupted' } });
    const r = await t.ctx.runBuild({ ...REQ, formats: { pdf: true, cbz: true } }, SENDER);
    eq('el PDF se corta y el CBZ sale', brief(r), 'páginas=2 fallidas=[] archivos=[pdf ERROR FILE_FAILED, cbz] imgs=0 imgsFallidas=0');
  }
  {
    const t = setup({ build: { ok: true, pages: 14, failed: [3, 9], files: FILES.slice(0, 1) } });
    const r = await t.ctx.runBuild({ ...REQ, formats: { pdf: true } }, SENDER);
    eq('páginas que no bajaron: se informa cuáles', brief(r), 'páginas=14 fallidas=[3,9] archivos=[pdf] imgs=0 imgsFallidas=0');
  }
  {
    const t = setup({ build: { ok: true, pages: 2, failed: [], files: FILES.slice(0, 1) }, invalidName: true });
    const r = await t.ctx.runBuild({ ...REQ, path: 'Capítulo/Capítulo 0001', formats: { pdf: true } }, SENDER);
    eq('el sistema rechaza los acentos → sin acentos', brief(r), 'páginas=2 fallidas=[] archivos=[pdf como MangaReader/Capitulo/Capitulo 0001.pdf] imgs=0 imgsFallidas=0');
  }
  {
    const t = setup({ build: { ok: false, error: 'No se pudo leer ninguna página (HTTP 403)' } });
    let r; try { await t.ctx.runBuild(REQ, SENDER); r = 'no falló'; } catch (e) { r = e.message; }
    eq('no se pudo bajar nada', r, 'No se pudo leer ninguna página (HTTP 403)');
    eq('  sin trabajos colgados', t.ctx.jobs.size, 0);
    eq('  no descargó nada', t.log.length, 0);
  }
  {
    const t = setup({ build: { ok: true, pages: 2, failed: [], files: FILES } });
    let r; try { await t.ctx.runBuild({ ...REQ, urls: [] }, SENDER); r = 'no falló'; } catch (e) { r = e.message; }
    eq('sin páginas', r, 'No hay páginas para guardar');
  }
  { // Con "Preguntar dónde guardar" la descarga queda esperando: no se da por fallida ni se libera antes de tiempo
    const t = setup({ build: { ok: true, pages: 2, failed: [], files: FILES.slice(0, 1) }, results: { 'blob:pdf': 'hang' } });
    const r = await t.ctx.runBuild({ ...REQ, formats: { pdf: true } }, SENDER);
    eq('descarga que sigue en curso: no cuenta como falla', brief(r), 'páginas=2 fallidas=[] archivos=[pdf] imgs=0 imgsFallidas=0');
    eq('  todavía no se libera', t.revoked.length, 0);
    t.finishDownload(1, 'complete');
    await wait(5);
    eq('  se libera cuando termina', t.revoked.join(','), 'blob:pdf');
    eq('  sin listeners colgados', t.onChanged.count(), 1);
  }

  // ── Hablarle a la pestaña ──
  {
    let n = 0;
    const t = setup({ onTabMessage: () => { if (!n++) throw new Error('Could not establish connection. Receiving end does not exist.'); return { ok: true }; } });
    const r = await t.ctx.tellTab(9, { action: 'save' });
    eq('pestaña sin el script: se inyecta (los mismos archivos que carga el manifest, en su orden) y se reintenta',
      t.tabLog.join(' | ') + ' → ' + JSON.stringify(r), `msg 9 save | css styles.css | js ${SCRIPTS.join('+')} | msg 9 save → {"ok":true}`);
  }
  {
    const t = setup({ onTabMessage: () => ({ ok: true }) });
    await t.ctx.tellTab(9, { action: 'save' });
    eq('pestaña con el script: no se inyecta nada', t.tabLog.join(' | '), 'msg 9 save');
  }
  {
    const t = setup({ onTabMessage: () => { throw new Error('No tab with id: 9'); } });
    let r; try { await t.ctx.tellTab(9, { action: 'save' }); r = 'no falló'; } catch (e) { r = e.message; }
    eq('otro error no se tapa', r + ' · ' + t.tabLog.join(' | '), 'No tab with id: 9 · msg 9 save');
  }

  // ── Un capítulo de un lote ──
  const CHAP = { url: 'https://s.com/manga/es/todos/05', formats: { pdf: true }, numero: 5, strict: true };
  {
    const t = setup({ onTabMessage: (id, m) => m.action === 'count' ? { ok: true, n: 15 } : { ok: true, complete: true, pages: 15, name: 'S/S 0005', lines: [] } });
    const r = await t.ctx.batchChapter(CHAP, SENDER);
    eq('capítulo bien: resultado', `${r.complete} ${r.pages} ${r.name}`, 'true 15 S/S 0005');
    eq('capítulo bien: abre en segundo plano al lado y cierra', t.tabLog[0] + ' … ' + t.tabLog[t.tabLog.length - 1], 'create https://s.com/manga/es/todos/05 active=false … remove 50');
    eq('capítulo bien: espera a que las páginas dejen de sumarse', t.tabLog.filter(l => l === 'msg 50 count').length >= 3, true);
    eq('capítulo bien: no queda nada anotado', t.ctx.workers.size + t.ctx.owners.size, 0);
  }
  if (SCRIPTS.includes('plantilla.js')) {      // 2.10: el tomo y el nombre que el capítulo tiene en la lista llegan a su pestaña
    let visto = null;
    const t = setup({ onTabMessage: (id, m) => { if (m.action === 'autoSave') visto = m; return m.action === 'count' ? { ok: true, n: 15 } : { ok: true, complete: true, pages: 15, lines: [] }; } });
    await t.ctx.batchChapter({ ...CHAP, serie: 'S', fixed: true, volumen: 'Tomo 2', titulo: 'La huida' }, SENDER);
    eq('lote: a la pestaña del capítulo le llegan su tomo y su nombre (para la plantilla)', `${visto.serie} ${visto.numero} ${visto.fixed} ${visto.volumen} | ${visto.titulo}`, 'S 5 true Tomo 2 | La huida');
  }
  {
    const t = setup({ onTabMessage: (id, m) => m.action === 'count' ? { ok: true, n: 0 } : { ok: false, error: 'Sin páginas (encontré 0)' } });
    let r; try { await t.ctx.batchChapter(CHAP, SENDER); r = 'no falló'; } catch (e) { r = e.message; }
    eq('capítulo que no existe', r + ' · ' + t.tabLog[t.tabLog.length - 1], 'Sin páginas (encontré 0) · remove 50');
  }
  {
    const t = setup({ onTabMessage: (id, m) => m.action === 'count' ? { ok: true, n: 15 } : { ok: true, complete: true, pages: 15, lines: [] } });
    await t.ctx.batchChapter({ ...CHAP, visible: true }, SENDER);
    eq('a la vista: abre adelante y vuelve a la pestaña del lote', t.tabLog[0] + ' … ' + t.tabLog[t.tabLog.length - 1], 'create https://s.com/manga/es/todos/05 active=true … update 7');
  }
  { // Cancelar: se cierra la pestaña del capítulo y el pedido termina como "Cancelado"
    let reject;
    const t = setup({ onTabMessage: (id, m) => m.action === 'count' ? { ok: true, n: 15 } : new Promise((_, rej) => { reject = rej; }) });
    t.onRemove = () => reject && reject(new Error('The message port closed before a response was received.'));
    const p = t.ctx.batchChapter(CHAP, SENDER).then(() => 'no falló', e => e.message);
    await wait(300);
    await t.ctx.batchCancel(SENDER);
    eq('cancelar', await p, 'Cancelado');
  }
  {
    const t = setup({});
    let r; try { await t.ctx.batchChapter({ ...CHAP, url: 'javascript:alert(1)' }, SENDER); r = 'no falló'; } catch (e) { r = e.message; }
    eq('dirección que no es http', r + ' · pestañas abiertas: ' + t.tabLog.length, 'Dirección no válida · pestañas abiertas: 0');
  }
  fin();
})();
