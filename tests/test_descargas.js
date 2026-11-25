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
// (filtros: con qué filtro se registró cada oyente, por ejemplo los tipos de pedido de webRequest)
const ev = () => { const ls = [], filtros = []; return { addListener: (f, filtro) => { ls.push(f); filtros.push(filtro); }, removeListener: f => { const i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1); },
  emit: (...a) => [...ls].forEach(f => f(...a)), count: () => ls.length, hasListener: f => ls.includes(f), filtros }; };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Desde la 2.11 el script corre en todos los marcos de la pestaña y el service worker elige a cuál
// hablarle según cuántas candidatas cuenta cada uno
const MARCOS = (MANIFEST.content_scripts[0].all_frames === true);

// build: lo que responde el documento offscreen · results: cómo termina cada descarga, por URL
// ('complete' por defecto, 'interrupted', 'hang') · onTabMessage: lo que responde la pestaña
// marcos: lo que cuenta cada marco de la pestaña, [[frameId, candidatas]…] (-1: no tiene el script);
// puede ser una función, para que cambie de una vez a la otra. Desde la 2.11.4 cada marco dice
// además sus páginas y cuáles cargaron: [frameId, candidatas, urls, cargadas]
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
    // Las respuestas que ve el service worker (2.11.2: la cabecera Retry-After de la página del capítulo)
    webRequest: { onHeadersReceived: ev() },
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
      // (alAbrir: lo que pasa cuando la pestaña del capítulo carga, por ejemplo la respuesta que ve webRequest)
      create: async (o) => { tabLog.push(`create ${o.url} active=${o.active}`); if (t.alAbrir) t.alAbrir(50, o.url); return { id: 50 }; },
      query: async () => t.abiertas,                       // las pestañas que hay abiertas: [{ id, url }]
      get: async (id) => ({ id, status: 'complete' }),
      remove: async (id) => { tabLog.push(`remove ${id}`); if (t.onRemove) t.onRemove(id); },
      update: async (id) => { tabLog.push(`update ${id}`); },
    },
    scripting: {
      insertCSS: async (o) => { tabLog.push('css ' + o.files.join('+')); },
      executeScript: async (o) => {
        // el código con que respondió la página del capítulo (solo mira el marco de arriba): t.codigo, o 200
        if (o.func && !o.target.allFrames) return [{ frameId: 0, result: t.codigo || 200 }];
        if (o.func) {                                     // la cuenta de candidatas, marco por marco
          tabLog.push(`cuenta ${o.target.tabId}`);
          // (extra: lo demás que dice el marco desde la 2.11.4, como pedidas y adaptado)
          return (typeof marcos === 'function' ? marcos(o.target.tabId) : marcos).map(([frameId, result, urls, cargadas, extra]) =>
            ({ frameId, result: urls ? { n: result, urls, cargadas: cargadas || [], ...(extra || {}) } : result }));
        }
        tabLog.push('js ' + o.files.join('+') + (o.target.allFrames ? ' en todos los marcos' : ''));
      },
    },
  };
  // El tiempo corre 500 veces más rápido para que la prueba no tarde (20 s → 40 ms),
  // conservando el orden de las esperas
  // (importScripts: así carga el service worker sus archivos compartidos, desde la 2.11)
  const ctx = { chrome, console, clearTimeout, setInterval, clearInterval, URL, URLSearchParams,
    importScripts: (...fs_) => { for (const f of fs_) vm.runInContext(fs.readFileSync(path.join(process.argv[2], f), 'utf8'), ctx); },
    setTimeout: (f, ms) => setTimeout(f, Math.ceil((ms || 0) / 500)), crypto: { randomUUID: () => 'job-' + (++jobN) } };
  vm.createContext(ctx);
  // (imagenesEnEspera: lo que anotó de las imágenes que pidieron esperar, desde la 2.11.4)
  vm.runInContext(src + '\n;Object.assign(globalThis, { blobs, jobs, workers, owners, imagenesEnEspera: typeof imagenesEnEspera === "undefined" ? null : imagenesEnEspera });', ctx);
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
  { // (2.11.1) El sitio pidió esperar con alguna imagen: lo que informa el armador vuelve a quien guarda,
    // y lo que pide un lote (no guardar a medias) le llega al armador
    let visto = null;
    const armador = (m) => { visto = m; return { ok: true, pages: 1, failed: [2], files: FILES.slice(0, 1), esperar: { status: 503, retryAfter: '3' } }; };
    const r = await setup({ build: armador }).ctx.runBuild({ ...REQ, formats: { pdf: true } }, SENDER);
    eq('una página faltó porque el sitio respondió 503: el guardado suelto sale incompleto y lo dice', `fallidas=[${r.failed}] esperar=${r.esperar} · soloEntero=${visto.soloEntero}`, 'fallidas=[2] esperar=503 · soloEntero=false');
    await setup({ build: armador }).ctx.runBuild({ ...REQ, formats: { pdf: true }, soloEntero: true }, SENDER);
    eq('  el pedido de un lote le llega al armador con soloEntero', visto.soloEntero, true);
    const t = setup({ build: { ok: false, error: 'HTTP 503: el sitio pidió esperar' } });
    let e; try { await t.ctx.runBuild({ ...REQ, soloEntero: true }, SENDER); e = 'no falló'; } catch (x) { e = x.message; }
    eq('  y si el armador corta el capítulo, no se descarga nada y el motivo llega entero', `${e} · descargas: ${t.log.length}`, 'HTTP 503: el sitio pidió esperar · descargas: 0');
    const sin = await setup({ build: { ok: true, pages: 2, failed: [], files: FILES.slice(0, 1) } }).ctx.runBuild({ ...REQ, formats: { pdf: true } }, SENDER);
    eq('  sin nada que esperar, esperar=0', sin.esperar, 0);
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
  // Cuántas páginas tiene el capítulo se dice de las dos formas, para que cada prueba recorra el
  // mismo camino en todas las versiones: `marcos` es lo que cuenta la 2.11 (por marco) y la
  // respuesta al mensaje `count` es lo que preguntaban las anteriores (la 2.11 ya no lo manda).
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
    const t = setup({ marcos: [[0, 15]], onTabMessage: (id, m) => { if (m.action === 'autoSave') visto = m; return m.action === 'count' ? { ok: true, n: 15 } : { ok: true, complete: true, pages: 15, lines: [] }; } });
    await t.ctx.batchChapter({ ...CHAP, serie: 'S', fixed: true, volumen: 'Tomo 2', titulo: 'La huida' }, SENDER);
    eq('lote: a la pestaña del capítulo le llegan su tomo y su nombre (para la plantilla)', `${visto.serie} ${visto.numero} ${visto.fixed} ${visto.volumen} | ${visto.titulo}`, 'S 5 true Tomo 2 | La huida');
  }
  {
    const t = setup({ onTabMessage: (id, m) => m.action === 'count' ? { ok: true, n: 0 } : { ok: false, error: 'Sin páginas (encontré 0)' } });
    let r; try { await t.ctx.batchChapter(CHAP, SENDER); r = 'no falló'; } catch (e) { r = e.message; }
    eq('capítulo que no existe', r + ' · ' + t.tabLog[t.tabLog.length - 1], 'Sin páginas (encontré 0) · remove 50');
  }
  {
    const t = setup({ marcos: [[0, 15]], onTabMessage: (id, m) => m.action === 'count' ? { ok: true, n: 15 } : { ok: true, complete: true, pages: 15, lines: [] } });
    await t.ctx.batchChapter({ ...CHAP, visible: true }, SENDER);
    eq('a la vista: abre adelante y vuelve a la pestaña del lote', t.tabLog[0] + ' … ' + t.tabLog[t.tabLog.length - 1], 'create https://s.com/manga/es/todos/05 active=true … update 7');
  }
  { // Cancelar: se cierra la pestaña del capítulo y el pedido termina como "Cancelado"
    let reject;
    const t = setup({ marcos: [[0, 15]], onTabMessage: (id, m) => m.action === 'count' ? { ok: true, n: 15 } : new Promise((_, rej) => { reject = rej; }) });
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

  // ── El sitio dice cuánto esperar (2.11.2): Retry-After de la página del capítulo ──
  // La página del capítulo responde `codigo` con esa cabecera (null: sin cabecera). Devuelve el
  // error, cuántos segundos queda frenado ese sitio para el lote ("esperaSitio") y si el oyente de
  // webRequest estaba registrado mientras el capítulo estuvo abierto y quedó sacado después.
  {
    const capitulo = async ({ codigo = 503, retryAfter = null, guardado = {} } = {}) => {
      const t = setup({ marcos: [[0, 15]], guardado, onTabMessage: () => ({ ok: true, complete: true, pages: 15, name: 'S/S 0005', lines: [] }) });
      t.codigo = codigo;
      const oyente = t.ctx.chrome.webRequest.onHeadersReceived;
      let mientras = -1;
      t.alAbrir = (id) => {
        mientras = oyente.count();
        oyente.emit({ tabId: id, statusCode: codigo, type: 'main_frame', responseHeaders: retryAfter == null ? [] : [{ name: 'Retry-After', value: retryAfter }] });
      };
      const antes = Date.now();
      let error = 'no falló';
      try { await t.ctx.batchChapter(CHAP, SENDER); } catch (e) { error = e.message; }
      const hasta = (t.datos.esperaSitio || {})['s.com'];
      return `${error} · frena ${hasta ? Math.round((hasta - antes) / 1000) + ' s' : 'nada'} · oyente: ${mientras} mientras, ${oyente.count()} después`;
    };
    eq('la página del capítulo responde 503 con Retry-After: 4: ese sitio queda frenado 4 s para el lote',
      await capitulo({ retryAfter: '4' }), 'HTTP 503: el sitio pidió esperar · frena 4 s · oyente: 1 mientras, 0 después');
    eq('  429 con Retry-After: 12 → 12 s, no los 60 de siempre', await capitulo({ codigo: 429, retryAfter: '12' }), 'HTTP 429: el sitio pidió esperar · frena 12 s · oyente: 1 mientras, 0 después');
    eq('  si pide 300, un minuto: el tope', (await capitulo({ retryAfter: '300' })).split(' · ')[1], 'frena 60 s');
    eq('  sin cabecera, un minuto: no se baja a 2, 4 u 8 s', (await capitulo({})).split(' · ')[1], 'frena 60 s');
    eq('  una cabecera que no se entiende, o una fecha ya vencida, también un minuto',
      `${(await capitulo({ retryAfter: 'pronto' })).split(' · ')[1]} | ${(await capitulo({ retryAfter: 'Mon, 23 Nov 2026 12:00:00 GMT' })).split(' · ')[1]}`, 'frena 60 s | frena 60 s');
    eq('  sin cabecera, la parada sale de las opciones (ritmo.espera429)', (await capitulo({ guardado: { ritmo: { espera429: 30 } } })).split(' · ')[1], 'frena 30 s');
    eq('una página que responde bien no frena nada, y el oyente igual se saca', await capitulo({ codigo: 200 }), 'no falló · frena nada · oyente: 1 mientras, 0 después');

    // Las imágenes del capítulo pidieron esperar: el armador lo dice, y se anota con lo que pidieron
    const imagenes = async (sender) => {
      const ARMADO = { ok: false, error: 'HTTP 503: el sitio pidió esperar', esperar: { status: 503, retryAfter: '7' } };
      const BUILD = { action: 'build', urls: ['https://s.com/i/1.jpg'], formats: { pdf: true }, path: 'S/S 0005', title: 'S 0005', meta: {}, soloEntero: true };
      let t;
      t = setup({ marcos: [[0, 15]], build: ARMADO, onTabMessage: async (id, m) => {
        if (m.action !== 'autoSave') return { ok: true };
        const r = await pedido(t, BUILD, sender || { tab: { id }, frameId: 0 });     // como lo pide el capítulo abierto
        return { ok: false, error: r.error };
      } });
      const antes = Date.now();
      let error = 'no falló';
      try { await t.ctx.batchChapter(CHAP, SENDER); } catch (e) { error = e.message; }
      const hasta = (t.datos.esperaSitio || {})['s.com'];
      return `${error} · frena ${hasta ? Math.round((hasta - antes) / 1000) + ' s' : 'nada'}`;
    };
    eq('las imágenes de un capítulo de un lote responden 503 con Retry-After: 7: el sitio queda frenado 7 s', await imagenes(), 'HTTP 503: el sitio pidió esperar · frena 7 s');
    eq('  pero si el pedido no viene de un capítulo de un lote (guardar de a uno), no se frena nada', await imagenes({ tab: { id: 99 }, frameId: 0 }), 'HTTP 503: el sitio pidió esperar · frena nada');
  }

  // ── (2.11.4) Las imágenes que carga la página del capítulo ──
  // La pestaña del capítulo carga sus páginas y webRequest ve cada respuesta (`imagenes`: [dirección,
  // código, Retry-After]). El marco cuenta sus páginas y dice cuáles cargaron. Devuelve qué pasó con
  // el capítulo, cuánto quedó frenado el sitio, qué se le pidió al marco, con qué tipos escuchaba
  // webRequest mientras el capítulo estuvo abierto y qué quedó después.
  if (process.env.FORZAR || /function imagenesQuePidieronEsperar\(/.test(src)) {       // (FORZAR=1: también contra una versión anterior, para ver qué no andaba)
    const C = 'https://s.com/cap/5/';
    const PAGINAS = [1, 2, 3, 4, 5, 6].map(k => `${C}${k}.jpg`);
    const BANNER = 'https://s.com/publicidad/banner.jpg';
    // marcos: si se da, lo que cuenta cada marco (en vez de uno solo con urls y cargadas) · extra: lo
    // demás que dice el marco (pedidas, adaptado)
    const capitulo = async ({ imagenes = [], despues = [], urls = PAGINAS, cargadas, n = 6, extra = null, marcos = null, yaGuardado = false, saltear = true, cola = null, enElMarco = null } = {}) => {
      // (por defecto cargaron todas las que no respondieron 429 o 503)
      if (!cargadas) cargadas = urls.filter(u => !imagenes.some(([v, s]) => v === u && (s === 429 || s === 503)));
      const alMarco = [];
      let t;
      t = setup({ marcos: marcos || [[0, n, urls, cargadas, extra]], guardado: cola ? { cola } : {}, onTabMessage: async (id, m) => {
        alMarco.push(m.action);
        if (m.action === 'yaGuardado') return { ok: true, guardado: yaGuardado, name: 'S/S 0005' };
        if (m.action === 'autoSave' && enElMarco) return enElMarco(t, id);
        return { ok: true, complete: true, pages: 6, name: 'S/S 0005', lines: [] };
      } });
      const oyente = t.ctx.chrome.webRequest.onHeadersReceived;
      // (una respuesta: [dirección, código, Retry-After, pedido, pestaña]; el pedido sirve para seguir una redirección)
      const responde = (id, [url, statusCode, ra, requestId, tabId]) => oyente.emit({ tabId: tabId ?? id, url, statusCode, type: 'image', requestId,
        responseHeaders: ra == null ? [] : [{ name: 'Retry-After', value: ra }] });
      let tipos = '';
      t.alAbrir = (id) => {
        tipos = ((oyente.filtros[oyente.filtros.length - 1] || {}).types || []).join('+');
        oyente.emit({ tabId: id, statusCode: 200, type: 'main_frame', responseHeaders: [] });
        for (const x of imagenes) responde(id, x);
        for (const x of despues) responde(id, x);
      };
      t.responde = responde;
      const antes = Date.now();
      let r;
      try {
        const x = await t.ctx.batchChapter({ ...CHAP, saltear, ...(cola ? { cola: cola.id } : {}) }, SENDER);
        r = x.yaEstaba ? `ya estaba (${x.name})` : `guardado (${x.pages} páginas)`;
      } catch (e) { r = e.message; }
      await wait(20);
      const hasta = (t.datos.esperaSitio || {})['s.com'];
      return { r, frena: hasta ? Math.round((hasta - antes) / 1000) + ' s' : 'nada', marco: alMarco.join(',') || 'nada', tipos, despues: oyente.count(),
        anotadas: t.ctx.imagenesEnEspera ? t.ctx.imagenesEnEspera.size : -1, cola: t.datos.cola };
    };
    const como = (x) => `${x.r} · frena ${x.frena} · al marco: ${x.marco}`;

    let x = await capitulo({ imagenes: [[`${C}3.jpg`, 503, '6']] });
    eq('una página del capítulo (la 3) responde 503 con Retry-After: 6 al cargarla la página: no se le pide al marco que guarde, el sitio queda frenado 6 s y el capítulo falla con el motivo',
      como(x), 'HTTP 503: el sitio pidió esperar · frena 6 s · al marco: yaGuardado');
    eq('  mientras el capítulo estuvo abierto webRequest escuchaba la página y sus imágenes; al cerrarlo se dejó de escuchar y no quedó nada anotado',
      `${x.tipos} · oyentes después: ${x.despues} · anotadas: ${x.anotadas}`, 'main_frame+image · oyentes después: 0 · anotadas: 0');
    eq('  sin Retry-After, un minuto; con 429, lo mismo',
      `${(await capitulo({ imagenes: [[`${C}2.jpg`, 503]] })).frena} | ${como(await capitulo({ imagenes: [[`${C}4.jpg`, 429]] }))}`, '60 s | HTTP 429: el sitio pidió esperar · frena 60 s · al marco: yaGuardado');
    eq('una imagen de otra carpeta (un banner) responde 503: no corta ni frena, y el capítulo se guarda entero',
      como(await capitulo({ imagenes: [[BANNER, 503, '6']] })), 'guardado (6 páginas) · frena nada · al marco: autoSave');
    const COLA = { id: 'q1', fecha: 1, serie: 'S', formatos: { pdf: true }, sitio: 's.com', origen: 'https://s.com/serie', plantilla: '', items: [{ url: CHAP.url, numero: 5, titulo: '', volumen: '', estado: 'pendiente', error: '' }] };
    x = await capitulo({ imagenes: [[`${C}3.jpg`, 503, '6']], yaGuardado: true, cola: COLA });
    eq('si el capítulo ya estaba guardado sigue siendo "ya estaba" (sin pedirle que guarde), el sitio igual queda frenado y en la cola queda listo',
      `${como(x)} · cola: ${x.cola.items.map(i => `${i.numero} ${i.estado}`).join(', ')}`, 'ya estaba (S/S 0005) · frena 6 s · al marco: yaGuardado · cola: 5 listo');
    eq('  sin "Saltear los que ya guardé" no se pregunta: el capítulo falla igual (se quería bajar de nuevo)',
      como(await capitulo({ imagenes: [[`${C}3.jpg`, 503, '6']], yaGuardado: true, saltear: false })), 'HTTP 503: el sitio pidió esperar · frena 6 s · al marco: nada');
    eq('la misma imagen que después cargó no cuenta como faltante: si el marco la tiene cargada',
      como(await capitulo({ imagenes: [[`${C}3.jpg`, 503, '6']], cargadas: PAGINAS })), 'guardado (6 páginas) · frena nada · al marco: autoSave');
    eq('  y si la página la volvió a pedir y esta vez respondió bien',
      como(await capitulo({ imagenes: [[`${C}3.jpg`, 503, '6']], despues: [[`${C}3.jpg`, 200]] })), 'guardado (6 páginas) · frena nada · al marco: autoSave');
    eq('sin ninguna página en el marco, cualquier imagen que pidió esperar cuenta (también un banner)',
      como(await capitulo({ imagenes: [[BANNER, 503]], urls: [], cargadas: [], n: 0 })), 'HTTP 503: el sitio pidió esperar · frena 60 s · al marco: yaGuardado');
    // Una página que se pide recién al guardar (al medir las que no habían cargado): la pregunta la hace
    // el marco antes de guardar, y el service worker decide con la misma regla
    const pregunta = (urls) => async (t, id) => {
      t.responde(id, [`${C}6.jpg`, 503, '9']);
      const r = await pedido(t, { action: 'imagenEnEspera', urls }, { tab: { id }, frameId: 0 });
      return r.status ? { ok: false, error: `HTTP ${r.status}: el sitio pidió esperar` } : { ok: true, complete: true, pages: urls.length, name: 'S/S 0005', lines: [] };
    };
    eq('una página que responde 503 recién al guardar (al medirla): el marco pregunta antes de guardar, no se guarda y el sitio queda frenado lo que pidió',
      como(await capitulo({ enElMarco: pregunta(PAGINAS.slice(0, 5)) })), 'HTTP 503: el sitio pidió esperar · frena 9 s · al marco: autoSave');
    // La pregunta solo vale desde la pestaña de un capítulo de un lote. Mientras un lote tiene abierto
    // el suyo (la 50), otra pestaña (la 99) tiene una imagen que responde 503 y pregunta: no frena nada
    {
      let respuesta = null;
      const desdeOtra = async (t) => {
        t.responde(50, [`${C}6.jpg`, 503, '9', undefined, 99]);
        // (una versión que no entiende la pregunta no contesta: se espera un rato y sigue)
        respuesta = await Promise.race([pedido(t, { action: 'imagenEnEspera', urls: PAGINAS.slice(0, 5) }, { tab: { id: 99 }, frameId: 0 }), wait(300).then(() => 'sin respuesta')]);
        return { ok: true, complete: true, pages: 6, name: 'S/S 0005', lines: [] };
      };
      const x2 = await capitulo({ enElMarco: desdeOtra });
      eq('  esa pregunta desde una pestaña que no es la de un capítulo de un lote (con una imagen suya en 503, mientras corre un lote) no frena nada',
        `${JSON.stringify(respuesta)} · ${x2.r} · frena ${x2.frena}`, '{"ok":true} · guardado (6 páginas) · frena nada');
    }

    // Lo que encontró la revisión de la 2.11.4, caso por caso
    const sin3 = PAGINAS.filter(u => !u.endsWith('/3.jpg'));
    eq('un marco que cuenta páginas pero no dice cuáles (el script de una versión anterior) no se corta acá: decide autoSave, con las páginas medidas',
      como(await capitulo({ imagenes: [[BANNER, 503]], marcos: [[0, 6]] })), 'guardado (6 páginas) · frena nada · al marco: autoSave');
    {
      // La última cuenta de los marcos falla: vale la anterior, que tiene las páginas. (El marco
      // cuenta 2, así la espera dura las 15 vueltas, y la 15.ª es la que falla.)
      let vueltas = 0;
      const marcos = () => { if (++vueltas === 15) throw new Error('Frame with ID 0 was removed.'); return [[0, 2, PAGINAS, sin3]]; };
      eq('  si la última cuenta de los marcos falla, vale la anterior: un banner de otra carpeta sigue sin cortar, y la página 3 corta',
        `${como(await capitulo({ imagenes: [[BANNER, 503]], marcos }))} | ${(vueltas = 0, como(await capitulo({ imagenes: [[`${C}3.jpg`, 503, '6']], marcos })))}`,
        'guardado (6 páginas) · frena nada · al marco: autoSave | HTTP 503: el sitio pidió esperar · frena 6 s · al marco: yaGuardado');
    }
    const UNA = [1, 2, 3, 4, 5, 6].map(k => `https://s.com/p/${k}/img.jpg`);
    eq('con un adaptador y una carpeta por página, la página 3 que responde 503 es una de las páginas: corta (no vale "la carpeta de la mayoría")',
      como(await capitulo({ imagenes: [[UNA[2], 503, '6']], urls: UNA, extra: { adaptado: true } })), 'HTTP 503: el sitio pidió esperar · frena 6 s · al marco: yaGuardado');
    eq('dos páginas responden 503, la primera pide 10 s y la segunda 30: el sitio queda frenado lo que pidió la que más pidió',
      como(await capitulo({ imagenes: [[`${C}3.jpg`, 503, '10'], [`${C}5.jpg`, 429, '30']] })), 'HTTP 429: el sitio pidió esperar · frena 30 s · al marco: yaGuardado');
    eq('la página 3 se redirige a otro servidor, que responde 503: cuenta por la dirección que pidió la página (se sigue el pedido)',
      como(await capitulo({ imagenes: [[`${C}3.jpg`, 302, null, 77], ['https://cdn.s.com/x/3.jpg?t=abc', 503, '6', 77]], cargadas: sin3 })), 'HTTP 503: el sitio pidió esperar · frena 6 s · al marco: yaGuardado');
    eq('  con srcset el navegador pidió otra dirección (en otra carpeta), que respondió 503: cuenta, porque el marco dice cuál pidió',
      como(await capitulo({ imagenes: [['https://s.com/cap/5/hd/3.jpg', 503, '6']], cargadas: sin3, extra: { pedidas: ['https://s.com/cap/5/hd/3.jpg'] } })), 'HTTP 503: el sitio pidió esperar · frena 6 s · al marco: yaGuardado');
    // El lector vuelve a pedir la 3 con algo agregado ("?t=1") y esta vez carga; la 7 todavía no cargó
    const conT = [...sin3.slice(0, 2), `${C}3.jpg?t=1`, ...sin3.slice(2), `${C}7.jpg`];
    eq('la página 3 respondió 503 y el lector la volvió a pedir con "?t=1", y cargó: no faltó, aunque otra página todavía no cargó',
      como(await capitulo({ imagenes: [[`${C}3.jpg`, 503, '6']], urls: conT, cargadas: conT.slice(0, 6) })), 'guardado (6 páginas) · frena nada · al marco: autoSave');
    eq('  y si webRequest vio que "3.jpg?t=1" respondió bien, la falla de "3.jpg" se borra',
      como(await capitulo({ imagenes: [[`${C}3.jpg`, 503, '6']], despues: [[`${C}3.jpg?t=1`, 200]], urls: [...PAGINAS, `${C}7.jpg`], cargadas: sin3 })), 'guardado (6 páginas) · frena nada · al marco: autoSave');
    eq('  pero otra página de la misma ruta con otra consulta no la borra ("imagen.php?p=1" no es "?p=3")',
      como(await capitulo({ imagenes: [['https://s.com/imagen.php?cap=5&p=3', 503, '6']], despues: [['https://s.com/imagen.php?cap=5&p=1', 200]],
        urls: [1, 2, 3, 4].map(k => `https://s.com/imagen.php?cap=5&p=${k}`), cargadas: [1, 2, 4].map(k => `https://s.com/imagen.php?cap=5&p=${k}`) })),
      'HTTP 503: el sitio pidió esperar · frena 6 s · al marco: yaGuardado');
    eq('con el lector en un iframe (el marco 3, con una página que todavía no cargó) y un aviso roto en la página de arriba: decide el marco del lector, y el aviso no es una de sus páginas',
      como(await capitulo({ imagenes: [['https://s.com/ads/a.jpg', 503, '6']], marcos: [[0, 1, ['https://s.com/ads/a.jpg'], []], [3, 6, [...PAGINAS, `${C}7.jpg`], PAGINAS]] })), 'guardado (6 páginas) · frena nada · al marco: autoSave');
    eq('lo anotado es por pestaña: la página 3 de este capítulo respondió 503, pero en otra pestaña: este no se corta',
      como(await capitulo({ imagenes: [[`${C}3.jpg`, 503, '6', undefined, 99]], cargadas: sin3 })), 'guardado (6 páginas) · frena nada · al marco: autoSave');
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
      if (process.env.FORZAR || typeof y.ctx.alTocarAviso === 'function') {          // (2.11.4; FORZAR=1: también contra una versión anterior)
        eq('los botones los atiende alTocarAviso, el mismo oyente que llama Chrome cuando se toca uno (acá se lo llama igual: con la notificación y el número del botón)',
          `${x.ctx.chrome.notifications.onButtonClicked.hasListener(x.ctx.alTocarAviso)} · ${y.ctx.chrome.notifications.onButtonClicked.hasListener(y.ctx.alTocarAviso)}`, 'true · true');
        // La notificación se mostró con un solo botón ("Mostrar la carpeta") y después la cola cambió
        // (otro lote quedó con fallas): tocar ese botón sigue mostrando la carpeta, no reintenta
        y.datos.cola = { id: 'otra', fecha: 1, origen: 'https://s.com/serie', items: [{ url: 'u', numero: 9, estado: 'fallo', error: 'x' }] };
        y.tabLog.length = 0;
        y.abiertas = [{ id: 9, url: 'https://s.com/serie' }];
        await clic(y, 0);
        eq('  cada botón hace lo que dice aunque la cola haya cambiado desde que se mostró: "Mostrar la carpeta" no reintenta',
          `${y.mostradas.join(',')} · ${y.tabLog.filter(l => !l.startsWith('cuenta')).join(' | ') || 'no le habló a ninguna pestaña'}`, '5,5 · no le habló a ninguna pestaña');
        // Y al revés: se mostró con "Reintentar" y, antes de tocarlo, se reintentó desde la ventana y
        // salió todo (la cola ya se cerró): "Reintentar" no tiene nada que hacer, y no abre la carpeta
        x.datos.cola = null;
        x.tabLog.length = 0;
        x.abiertas = [{ id: 9, url: 'https://s.com/serie' }];
        const antes = x.mostradas.length;
        await clic(x, 0);
        eq('  y "Reintentar" no abre la carpeta', `${x.tabLog.filter(l => !l.startsWith('cuenta')).join(' | ') || 'ninguna pestaña'} · carpetas abiertas: ${x.mostradas.length - antes}`, 'ninguna pestaña · carpetas abiertas: 0');

        // El "Reintentar" de la notificación llega a la pestaña de la serie como el del diálogo: con reintentar
        const toque = async ({ abiertas, cargando = 0, falla = 0, colaDeOtro = false } = {}) => {
          const vistos = [];
          let gets = 0, cuentas = 0;
          const z2 = setup({ marcos: () => { if (++cuentas <= falla) throw new Error('Frame with ID 0 was removed.'); return [[0, 0]]; },
            onTabMessage: (id, m) => { vistos.push(`${id} ${m.action}${m.reintentar ? ' reintentar' : ''}`); return { ok: true }; } });
          const q = await pedido(z2, NUEVA);
          for (const k of [1, 2, 3, 4]) await pedido(z2, { action: 'colaMarca', id: q.id, numero: k, estado: k === 2 ? 'fallo' : 'listo', error: 'x' });
          await pedido(z2, { action: 'colaFin', id: q.id, motivo: 'listo' });
          await wait(10);
          // (otro lote, cancelado sin avisar, reemplazó la cola: la notificación que queda es la del primero)
          if (colaDeOtro) { await pedido(z2, { ...NUEVA, origen: 'https://b.com/serie', sitio: 'b.com' }); }
          z2.abiertas = abiertas;
          // (cargando: las veces que la pestaña dice "loading", como una descartada que se vuelve a cargar)
          z2.ctx.chrome.tabs.get = async (id) => ({ id, status: ++gets <= cargando ? 'loading' : 'complete' });
          z2.ctx.chrome.notifications.onButtonClicked.emit('mr-lote', 0);
          await wait(80);
          return `${z2.tabLog.filter(l => /^(update|create)/.test(l)).join(' | ') || 'no abrió nada'} · ${vistos.join(' | ') || 'ningún pedido'}`;
        };
        eq('  "Reintentar" le pide a la pestaña de la serie lo mismo que el botón del diálogo: abrir el diálogo y retomar lo que falló (reintentar: true)',
          await toque({ abiertas: [{ id: 9, url: 'https://s.com/serie' }] }), 'update 9 · 9 batch reintentar');
        eq('  la pestaña se reconoce aunque su dirección traiga datos de seguimiento (como la reconoce la extensión)',
          await toque({ abiertas: [{ id: 9, url: 'https://s.com/serie?utm_source=boletin' }] }), 'update 9 · 9 batch reintentar');
        eq('  una pestaña descartada (o que se está recargando) se espera hasta que termine de cargar, y si el primer pedido no llega se prueba otra vez',
          await toque({ abiertas: [{ id: 9, url: 'https://s.com/serie', discarded: true }], cargando: 3, falla: 1 }), 'update 9 · 9 batch reintentar');
        eq('  la notificación de un lote cuya cola reemplazó otro (que se canceló sin avisar) no retoma la de ese otro',
          await toque({ abiertas: [{ id: 9, url: 'https://s.com/serie' }, { id: 12, url: 'https://b.com/serie' }], colaDeOtro: true }), 'no abrió nada · ningún pedido');
      }
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
