// Service worker con chrome.* simulado: guardado (runBuild), inyección del script en la
// pestaña (tellTab) y un capítulo de un lote (batchChapter).
// Uso: node tests/test_descargas.js "<carpeta de la versión>/manga-reader-ext"
const fs = require('fs'), vm = require('vm'), path = require('path');
const { probador } = require('./extraer');
const src = fs.readFileSync(path.join(process.argv[2], 'background.js'), 'utf8');
// Los scripts que el manifest carga en cada pestaña: los que se inyectan a mano tienen que ser los mismos
const MANIFEST = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'manifest.json'), 'utf8'));
const SCRIPTS = MANIFEST.content_scripts[0].js;
// Hasta la 2.10 se inyectaba también la hoja de estilos; desde la 2.11 va adentro del shadow root
const CSS = (MANIFEST.content_scripts[0].css || []).map(f => `css ${f} | `).join('');
const { eq, fin } = probador();
const ev = () => { const ls = []; return { addListener: f => ls.push(f), removeListener: f => { const i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1); }, emit: (...a) => [...ls].forEach(f => f(...a)), count: () => ls.length }; };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Desde la 2.11 el script corre en todos los marcos de la pestaña y el service worker elige a cuál
// hablarle según cuántas candidatas cuenta cada uno
const MARCOS = (MANIFEST.content_scripts[0].all_frames === true);

// build: lo que responde el documento offscreen · results: cómo termina cada descarga, por URL
// ('complete' por defecto, 'interrupted', 'hang') · onTabMessage: lo que responde la pestaña
// marcos: lo que cuenta cada marco de la pestaña, [[frameId, candidatas]…] (-1: no tiene el script);
// puede ser una función, para que cambie de una vez a la otra
// guardado: lo que hay en chrome.storage.local al empezar
function setup({ build, results = {}, invalidName = false, onTabMessage, marcos = [[0, 0]], guardado = {} } = {}) {
  const onChanged = ev(); let nextId = 1, jobN = 0, offscreen = 0;
  const items = {}, log = [], revoked = [], tabLog = [], t = { closed: 0, onRemove: null, insignias: [], colores: [], avisos: [], avisosCerrados: [], mostradas: [], abiertas: [] };
  // chrome.storage.local de mentira. Cada lectura y cada escritura tardan un instante, como las
  // de verdad: así se nota si dos cambios seguidos se pisan.
  const datos = JSON.parse(JSON.stringify(guardado)), escrituras = [];
  const instante = () => new Promise(r => setTimeout(r, 1));
  const copia = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const local = {
    get: async (claves) => { await instante(); const o = {}; for (const k of [].concat(claves || Object.keys(datos))) if (k in datos) o[k] = copia(datos[k]); return o; },
    set: async (o) => { await instante(); for (const [k, v] of Object.entries(o)) { datos[k] = copia(v); escrituras.push(k); } },
    remove: async (claves) => { await instante(); for (const k of [].concat(claves)) { delete datos[k]; escrituras.push('-' + k); } },
  };
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
    storage: { local, onChanged: ev() },
    // La insignia del ícono y las notificaciones: se anota lo que se les pide
    action: { setBadgeText: (o) => { t.insignias.push(o.text); }, setBadgeBackgroundColor: (o) => { t.colores.push(o.color); } },
    notifications: { onButtonClicked: ev(), create: (id, o) => { t.avisos.push({ id, ...o }); }, clear: (id) => { t.avisosCerrados.push(id); } },
    offscreen: { createDocument: async () => { offscreen++; }, closeDocument: async () => { t.closed++; offscreen = 0; } },
    downloads: {
      onChanged,
      show: (id) => { t.mostradas.push(id); },
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
      // (el marco de arriba es el 0 y no se anota: "msg 9 save" va arriba, "msg 9#3 save" al marco 3)
      sendMessage: async (tabId, m, o) => { tabLog.push(`msg ${tabId}${o?.frameId ? '#' + o.frameId : ''} ${m.action}`); return onTabMessage ? onTabMessage(tabId, m, o?.frameId || 0) : { ok: true }; },
      create: async (o) => { tabLog.push(`create ${o.url} active=${o.active}`); return { id: 50 }; },
      query: async () => t.abiertas,                       // las pestañas que hay abiertas: [{ id, url }]
      get: async (id) => ({ id, status: 'complete' }),
      remove: async (id) => { tabLog.push(`remove ${id}`); if (t.onRemove) t.onRemove(id); },
      update: async (id) => { tabLog.push(`update ${id}`); },
    },
    scripting: {
      insertCSS: async (o) => { tabLog.push('css ' + o.files.join('+')); },
      executeScript: async (o) => {
        if (o.func) {                                     // la cuenta de candidatas, marco por marco
          tabLog.push(`cuenta ${o.target.tabId}`);
          return (typeof marcos === 'function' ? marcos(o.target.tabId) : marcos).map(([frameId, result]) => ({ frameId, result }));
        }
        tabLog.push('js ' + o.files.join('+') + (o.target.allFrames ? ' en todos los marcos' : ''));
      },
    },
  };
  // El tiempo corre 500 veces más rápido para que la prueba no tarde (20 s → 40 ms),
  // conservando el orden de las esperas
  // (importScripts: así carga el service worker sus archivos compartidos, desde la 2.11)
  const ctx = { chrome, console, clearTimeout, setInterval, clearInterval, URL,
    importScripts: (...fs_) => { for (const f of fs_) vm.runInContext(fs.readFileSync(path.join(process.argv[2], f), 'utf8'), ctx); },
    setTimeout: (f, ms) => setTimeout(f, Math.ceil((ms || 0) / 500)), crypto: { randomUUID: () => 'job-' + (++jobN) } };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;Object.assign(globalThis, { blobs, jobs, workers, owners });', ctx);
  return Object.assign(t, { ctx, log, revoked, tabLog, onChanged, finishDownload, datos, escrituras });
}
// Un pedido como los que manda la pestaña (chrome.runtime.sendMessage): devuelve lo que se le contesta
const pedido = (t, msg, sender = SENDER) => new Promise(res => t.ctx.chrome.runtime.onMessage.emit(msg, sender, res));

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

  // ── Carpeta base (2.11): la opción carpetaBase en lugar de "MangaReader" ──
  if (/function carpetaBase\(/.test(src)) {
    const guardar = async (carpeta, meta = {}) => {
      const t = setup({ build: { ok: true, pages: 2, failed: [], files: FILES.slice(0, 1).concat(FILES.slice(2, 3)) }, guardado: carpeta === undefined ? {} : { carpetaBase: carpeta } });
      await t.ctx.runBuild({ ...REQ, formats: { pdf: true, imgs: true }, meta }, SENDER);
      return t.log.join(' | ');
    };
    const META = { web: 'https://sitio.com/manga/s/1', series: 'Sitio de prueba' };
    eq('carpeta base: sin la opción, la de siempre', await guardar(undefined, META), 'MangaReader/S/S 0001.pdf | MangaReader/S/S 0001/pagina_001.jpg');
    eq('  "Manga/{sitio}/{serie}": el archivo y las imágenes van ahí adentro', await guardar('Manga/{sitio}/{serie}', META),
      'Manga/sitio.com/Sitio de prueba/S/S 0001.pdf | Manga/sitio.com/Sitio de prueba/S/S 0001/pagina_001.jpg');
    eq('  con {anio}', await guardar('Leídos {anio}', META), `Leídos ${new Date().getFullYear()}/S/S 0001.pdf | Leídos ${new Date().getFullYear()}/S/S 0001/pagina_001.jpg`);
    eq('  si no se sabe la serie, se usa la primera carpeta del nombre; y un dato vacío no deja carpeta', await guardar('Manga/{sitio}/{serie}', {}), 'Manga/S/S/S 0001.pdf | Manga/S/S/S 0001/pagina_001.jpg');
    eq('  una carpeta que intenta salir de Descargas ("../x") no rompe: vale la de siempre', await guardar('../x', META), 'MangaReader/S/S 0001.pdf | MangaReader/S/S 0001/pagina_001.jpg');
    eq('  lo mismo con una ruta completa', await guardar('C:\\Manga', META), 'MangaReader/S/S 0001.pdf | MangaReader/S/S 0001/pagina_001.jpg');
  }

  // ── Hablarle a la pestaña ──
  if (!MARCOS) {                                  // hasta la 2.10: se le habla y, si no contesta, se inyecta
    let n = 0;
    const t = setup({ onTabMessage: () => { if (!n++) throw new Error('Could not establish connection. Receiving end does not exist.'); return { ok: true }; } });
    const r = await t.ctx.tellTab(9, { action: 'save' });
    eq('pestaña sin el script: se inyecta (los mismos archivos que carga el manifest, en su orden) y se reintenta',
      t.tabLog.join(' | ') + ' → ' + JSON.stringify(r), `msg 9 save | ${CSS}js ${SCRIPTS.join('+')} | msg 9 save → {"ok":true}`);
    const t2 = setup({ onTabMessage: () => ({ ok: true }) });
    await t2.ctx.tellTab(9, { action: 'save' });
    eq('pestaña con el script: no se inyecta nada', t2.tabLog.join(' | '), 'msg 9 save');
    const t3 = setup({ onTabMessage: () => { throw new Error('No tab with id: 9'); } });
    let r3; try { await t3.ctx.tellTab(9, { action: 'save' }); r3 = 'no falló'; } catch (e) { r3 = e.message; }
    eq('otro error no se tapa', r3 + ' · ' + t3.tabLog.join(' | '), 'No tab with id: 9 · msg 9 save');
  } else {                                        // 2.11: primero se cuentan las candidatas de cada marco
    let vueltas = 0;
    const t = setup({ marcos: () => (vueltas++ ? [[0, 6]] : [[0, -1]]) });
    const r = await t.ctx.tellTab(9, { action: 'save' });
    eq('pestaña sin el script: se inyecta en todos los marcos (los mismos archivos que carga el manifest, en su orden) y se le habla',
      t.tabLog.join(' | ') + ' → ' + JSON.stringify(r), `cuenta 9 | js ${SCRIPTS.join('+')} en todos los marcos | cuenta 9 | msg 9 save → {"ok":true}`);
    const t2 = setup({ marcos: [[0, 6]] });
    await t2.ctx.tellTab(9, { action: 'save' });
    eq('pestaña con el script: no se inyecta nada', t2.tabLog.join(' | '), 'cuenta 9 | msg 9 save');
    const t3 = setup({ marcos: [[0, 6]], onTabMessage: () => { throw new Error('No tab with id: 9'); } });
    let r3; try { await t3.ctx.tellTab(9, { action: 'save' }); r3 = 'no falló'; } catch (e) { r3 = e.message; }
    eq('otro error no se tapa', r3 + ' · ' + t3.tabLog.join(' | '), 'No tab with id: 9 · cuenta 9 | msg 9 save');

    // ── Marcos: el lector en un iframe ──
    const a = (marcos, msg) => { const x = setup({ marcos }); return x.ctx.tellTab(9, msg).then(() => x.tabLog.filter(l => l.startsWith('msg')).join(' | ')); };
    eq('guardar va al marco con más candidatas (el lector en un iframe)', await a([[0, 0], [3, 6]], { action: 'save' }), 'msg 9#3 save');
    eq('  con lo mismo arriba y en el iframe, va arriba: las páginas cuentan una vez', await a([[0, 6], [3, 6]], { action: 'save' }), 'msg 9 save');
    eq('  un marco sin nada no le gana a la página', await a([[0, 2], [4, 0], [5, -1]], { action: 'save' }), 'msg 9 save');
    eq('el diálogo de varios capítulos va siempre arriba: ahí está la lista de la serie', await a([[0, 0], [3, 6]], { action: 'batch' }), 'msg 9 batch');
    {
      const x = setup({ marcos: [[0, 0], [3, 6]] });
      x.ctx.chrome.commands.onCommand.emit('save', { id: 9 });
      await wait(20);
      eq('Alt+S con el lector en un iframe: el pedido llega al iframe', x.tabLog.filter(l => l.startsWith('msg')).join(' | '), 'msg 9#3 save');
    }
    {
      const x = setup({ marcos: [[0, 0], [3, 6], [7, 4]] });
      let resp;
      x.ctx.chrome.runtime.onMessage.emit({ action: 'candidato' }, { tab: { id: 9 }, frameId: 7 }, (r) => { resp = r; });
      await wait(20);
      const uno = `${JSON.stringify(resp)} · ${x.tabLog.filter(l => l.startsWith('msg')).join(' | ')}`;
      x.tabLog.length = 0;
      x.ctx.chrome.runtime.onMessage.emit({ action: 'candidato' }, { tab: { id: 9 }, frameId: 3 }, (r) => { resp = r; });
      await wait(20);
      eq('la burbuja queda en un solo marco: el que tiene más gana, y a los otros se les avisa que cedan',
        `${uno} || ${JSON.stringify(resp)} · ${x.tabLog.filter(l => l.startsWith('msg')).join(' | ')}`,
        '{"ok":true,"gana":false} · msg 9 ceder | msg 9#7 ceder || {"ok":true,"gana":true} · msg 9 ceder | msg 9#7 ceder');
    }
    {
      const x = setup({ marcos: [[0, 0], [3, 6]], onTabMessage: (id, m, f) => (m.action === 'contexto' ? { ok: true, contexto: { nombre: 'S/S 0007', marco: f } } : { ok: true }) });
      let resp;
      x.ctx.chrome.runtime.onMessage.emit({ action: 'contexto' }, { tab: { id: 9 }, frameId: 3 }, (r) => { resp = r; });
      await wait(20);
      eq('el iframe pide el nombre del capítulo: contesta la página de arriba', `${x.tabLog.join(' | ')} → ${resp?.contexto?.nombre} (marco ${resp?.contexto?.marco})`, 'msg 9 contexto → S/S 0007 (marco 0)');
    }
    {
      const x = setup({ build: (m) => { x.ctx.chrome.runtime.onMessage.emit({ target: 'background', action: 'progress', jobId: m.jobId, done: 1, total: 2 }, {}, () => {}); return { ok: true, pages: 2, failed: [], files: FILES.slice(0, 1) }; } });
      await x.ctx.runBuild({ ...REQ, formats: { pdf: true } }, { tab: { id: 7, index: 3 }, frameId: 3 });
      eq('el progreso de la bajada vuelve al marco que pidió el guardado', x.tabLog.filter(l => l.startsWith('msg')).join(' | '), 'msg 7#3 progress');
    }
  }

  // ── Un capítulo de un lote ──
  const CHAP = { url: 'https://s.com/manga/es/todos/05', formats: { pdf: true }, numero: 5, strict: true };
  {
    const t = setup({ marcos: [[0, 15]], onTabMessage: (id, m) => m.action === 'count' ? { ok: true, n: 15 } : { ok: true, complete: true, pages: 15, name: 'S/S 0005', lines: [] } });
    const r = await t.ctx.batchChapter(CHAP, SENDER);
    eq('capítulo bien: resultado', `${r.complete} ${r.pages} ${r.name}`, 'true 15 S/S 0005');
    eq('capítulo bien: abre en segundo plano al lado y cierra', t.tabLog[0] + ' … ' + t.tabLog[t.tabLog.length - 1], 'create https://s.com/manga/es/todos/05 active=false … remove 50');
    eq('capítulo bien: espera a que las páginas dejen de sumarse', t.tabLog.filter(l => l === (MARCOS ? 'cuenta 50' : 'msg 50 count')).length >= 3, true);
    eq('capítulo bien: no queda nada anotado', t.ctx.workers.size + t.ctx.owners.size, 0);
  }
  if (MARCOS) {                                   // el capítulo de un lote, con el lector en un iframe
    const t = setup({ marcos: [[0, 0], [3, 6]], onTabMessage: (id, m) => ({ ok: true, complete: true, pages: 6, name: 'S/S 0005', lines: [] }) });
    const r = await t.ctx.batchChapter(CHAP, { tab: { id: 7, index: 3 }, frameId: 0 });
    eq('lote con el lector en un iframe: se guarda desde el iframe', `${r.pages} páginas · ${t.tabLog.filter(l => l.startsWith('msg')).join(' | ')}`, '6 páginas · msg 50#3 autoSave');
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

  // ── La cola de un lote, guardada en chrome.storage (2.11) ──
  if (/function colaNueva\(/.test(src)) {
    const como = (c) => (!c ? 'sin cola' : c.items.map(i => `${i.numero} ${i.estado}${i.error ? ' (' + i.error + ')' : ''}`).join(', '));
    const ITEMS = [1, 2, 3, 4].map(n => ({ url: `https://s.com/c/${n}`, numero: n, titulo: `Capítulo ${n}`, volumen: n < 3 ? 'Tomo 1' : '' }));
    const NUEVA = { action: 'colaNueva', items: ITEMS, serie: 'S', formatos: { pdf: true }, sitio: 's.com', origen: 'https://s.com/serie', plantilla: 'https://s.com/c/{n}' };
    const t = setup({});
    const { id } = await pedido(t, NUEVA);
    const c0 = t.datos.cola;
    eq('encolar: la cola queda escrita en storage, con todo pendiente', como(c0), '1 pendiente, 2 pendiente, 3 pendiente, 4 pendiente');
    eq('  con su id, la fecha, y de cada capítulo la dirección, el número, el título y el tomo',
      `${c0.id === id && !!id} · ${typeof c0.fecha === 'number'} · ${JSON.stringify(c0.items[0])}`,
      'true · true · {"url":"https://s.com/c/1","numero":1,"titulo":"Capítulo 1","volumen":"Tomo 1","estado":"pendiente","error":""}');
    eq('  y lo que hace falta para seguirla después: serie, formatos, sitio, página de la serie y dirección con {n}',
      `${c0.serie} · ${JSON.stringify(c0.formatos)} · ${c0.sitio} · ${c0.origen} · ${c0.plantilla}`, 'S · {"pdf":true} · s.com · https://s.com/serie · https://s.com/c/{n}');
    await pedido(t, { action: 'colaMarca', id, numero: 1, estado: 'listo' });
    await pedido(t, { action: 'colaMarca', id, numero: 2, estado: 'fallo', error: 'Sin páginas (encontré 0)' });
    eq('cada cambio de estado se escribe, y el que falla guarda su motivo', como(t.datos.cola), '1 listo, 2 fallo (Sin páginas (encontré 0)), 3 pendiente, 4 pendiente');
    await Promise.all([pedido(t, { action: 'colaMarca', id, numero: 3, estado: 'fallo', error: 'HTTP 404' }), pedido(t, { action: 'colaMarca', id, numero: 4, estado: 'listo' })]);
    eq('  dos cambios a la vez no se pisan', como(t.datos.cola), '1 listo, 2 fallo (Sin páginas (encontré 0)), 3 fallo (HTTP 404), 4 listo');
    await pedido(t, { action: 'colaMarca', id: 'otra-cola', numero: 1, estado: 'fallo', error: 'x' });
    eq('  un cambio para otra cola (una que ya se descartó) no toca esta', como(t.datos.cola), '1 listo, 2 fallo (Sin páginas (encontré 0)), 3 fallo (HTTP 404), 4 listo');
    await pedido(t, { action: 'colaFin', id });
    eq('al terminar con fallas la cola queda guardada', como(t.datos.cola), '1 listo, 2 fallo (Sin páginas (encontré 0)), 3 fallo (HTTP 404), 4 listo');
    const re = await pedido(t, { action: 'colaReintentar', id });
    eq('reintentar: los que fallaron vuelven a pendiente, sin el motivo', `${como(t.datos.cola)} · devuelve ${re.cola.items.filter(i => i.estado === 'pendiente').length} pendientes`,
      '1 listo, 2 pendiente, 3 pendiente, 4 listo · devuelve 2 pendientes');
    await pedido(t, { action: 'colaMarca', id, numero: 2, estado: 'listo' });
    await pedido(t, { action: 'colaMarca', id, numero: 3, estado: 'listo' });
    await pedido(t, { action: 'colaFin', id });
    eq('cuando no queda nada pendiente ni con falla, la cola se borra', como(t.datos.cola), 'sin cola');

    const t2 = setup({ guardado: { cola: { id: 'vieja', fecha: 1, items: [{ url: 'u', numero: 9, estado: 'pendiente', error: '' }] } } });
    await pedido(t2, { action: 'colaDescartar' });
    eq('descartar la cola la borra', como(t2.datos.cola), 'sin cola');
    const t3 = setup({ guardado: { cola: { id: 'vieja', fecha: 1, items: [{ url: 'u', numero: 9, estado: 'pendiente', error: '' }] } } });
    const n = await pedido(t3, { ...NUEVA, items: ITEMS.slice(0, 2) });
    eq('un lote nuevo reemplaza a la cola que había', `${como(t3.datos.cola)} · ${n.id !== 'vieja'}`, '1 pendiente, 2 pendiente · true');
    // El capítulo que termina bien se anota desde el service worker: vale aunque la pestaña del lote ya no esté
    const t4 = setup({ marcos: [[0, 15]], onTabMessage: () => ({ ok: true, complete: true, pages: 15, name: 'S/S 0001', lines: [] }) });
    const q = await pedido(t4, NUEVA);
    await t4.ctx.batchChapter({ ...CHAP, url: ITEMS[0].url, numero: 1, cola: q.id }, SENDER);
    await wait(20);
    eq('el capítulo que se guarda bien queda listo en la cola aunque la pestaña del lote se haya cerrado', como(t4.datos.cola), '1 listo, 2 pendiente, 3 pendiente, 4 pendiente');

    // ── Insignia y notificación del lote ──
    if (/function insignia\(/.test(src)) {
      const aviso = (a) => (!a ? 'sin aviso' : `${a.title} · ${a.message} · [${a.buttons.map(x => x.title).join(' | ')}]`);
      const clic = async (x, indice) => { x.ctx.chrome.notifications.onButtonClicked.emit('mr-lote', indice); await wait(30); };
      // Un lote de 4 que termina con una falla
      const x = setup({ marcos: [[0, 0]] });
      const q1 = await pedido(x, NUEVA);
      for (const n of [1, 2, 3, 4]) await pedido(x, { action: 'colaMarca', id: q1.id, numero: n, estado: n === 3 ? 'fallo' : 'listo', error: 'HTTP 404' });
      eq('la insignia dice cuántos van mientras corre el lote', x.insignias.join(', '), '0/4, 1/4, 2/4, 3/4, 4/4');
      await pedido(x, { action: 'colaFin', id: q1.id, motivo: 'listo' });
      eq('  y queda roja si al terminar hubo fallas', `${x.insignias[x.insignias.length - 1]} ${x.colores[x.colores.length - 1]} (mientras corría: ${x.colores[0]})`, '4/4 #e74c3c (mientras corría: #667eea)');
      eq('notificación al terminar: el resumen y los dos botones', aviso(x.avisos[0]),
        'Manga Reader: lote terminado con fallas · 3 de 4 capítulos guardados · 1 con fallas · S · [Reintentar los que fallaron | Mostrar la carpeta]');
      x.datos.ultimaDescarga = 77;
      await clic(x, 1);
      eq('  "Mostrar la carpeta" abre la carpeta de la última descarga', `${x.mostradas.join(',')} · aviso cerrado: ${x.avisosCerrados.length}`, '77 · aviso cerrado: 1');
      x.tabLog.length = 0;
      x.abiertas = [{ id: 4, url: 'https://otro.com/' }, { id: 9, url: 'https://s.com/serie' }];
      await clic(x, 0);
      eq('  "Reintentar los que fallaron" vuelve a la pestaña de la serie y le pide que retome la cola', x.tabLog.filter(l => !l.startsWith('cuenta')).join(' | '), 'update 9 | msg 9 batch');
      x.tabLog.length = 0;
      x.abiertas = [];
      await clic(x, 0);
      eq('  si esa pestaña ya no está, la abre', x.tabLog.filter(l => !l.startsWith('cuenta')).join(' | '), 'create https://s.com/serie active=true | msg 50 batch');
      // Uno que sale entero
      const y = setup({});
      const q2 = await pedido(y, { ...NUEVA, items: ITEMS.slice(0, 2), serie: '' });
      for (const n of [1, 2]) await pedido(y, { action: 'colaMarca', id: q2.id, numero: n, estado: 'listo' });
      await pedido(y, { action: 'colaFin', id: q2.id, motivo: 'listo' });
      eq('sin fallas: insignia verde y un solo botón', `${y.insignias[y.insignias.length - 1]} ${y.colores[y.colores.length - 1]} · ${aviso(y.avisos[0])}`,
        '2/2 #2ecc71 · Manga Reader: lote terminado · 2 de 2 capítulos guardados · [Mostrar la carpeta]');
      y.datos.ultimaDescarga = 5;
      await clic(y, 0);
      eq('  y ese botón es el de la carpeta', y.mostradas.join(','), '5');
      await pedido(y, { action: 'insigniaLimpiar' });
      eq('la insignia se limpia al cerrar el diálogo', JSON.stringify(y.insignias[y.insignias.length - 1]), '""');
      // Cancelado por quien lo está mirando: no hace falta avisarle
      const z = setup({});
      const q3 = await pedido(z, NUEVA);
      await pedido(z, { action: 'colaMarca', id: q3.id, numero: 1, estado: 'listo' });
      await pedido(z, { action: 'colaFin', id: q3.id, motivo: 'cancelado' });
      eq('un lote cancelado no manda notificación, y la cola queda con lo que faltaba', `${aviso(z.avisos[0])} · ${como(z.datos.cola)}`, 'sin aviso · 1 listo, 2 pendiente, 3 pendiente, 4 pendiente');
    }
  }
  fin();
})();
