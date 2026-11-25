// Prueba en navegador de lo que sumó la 2.11, por área. La corre tests/e2e.js al final, y se
// puede correr sola (tarda mucho menos):
//   node tests/e2e_211.js ["<carpeta de la versión>"]       (sin argumento: la más nueva)
//   SOLO=shadow,iframes node tests/e2e_211.js               (solo esas áreas)
// Cada área va en su propio bloque: si una se corta, se anota como falla y siguen las demás.
// Así también se puede correr contra una versión anterior para ver qué no andaba.
// Las páginas de prueba están en tests/fixtures/ y se sirven en /fx/<nombre>.html; las
// imágenes de cualquier /fx/img/… son la misma página de 420×640.
const fs = require('fs'), path = require('path'), http = require('http');
const { lanzar, lote, pdfPages, sleep, root, ultimaVersion, RAIZ } = require('./navegador');

const zlib = require('zlib');
const FIXTURES = path.join(__dirname, 'fixtures');
const JPG = fs.readFileSync(path.join(FIXTURES, 'pagina.jpg'));       // 420×640

// Una imagen PNG gris de ese tamaño. En la serie "orden" cada página tiene un tamaño distinto,
// para poder leer en el PDF y en el CBZ en qué orden quedaron.
function pngGris(w, h, tono) {
  const trozo = (tipo, datos) => {
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(cuerpo));
    return Buffer.concat([largo, cuerpo, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8;
  const filas = Buffer.alloc((w + 1) * h, tono);
  for (let y = 0; y < h; y++) { filas[y * (w + 1)] = 0; if (y % 40 < 6) filas.fill(40, y * (w + 1) + 21, y * (w + 1) + w - 20); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(filas)), trozo('IEND', Buffer.alloc(0))]);
}
// Página 1: 420×640 (JPG) · página 2: 400×600 · página 3: 380×560
const DE_ORDEN = { 1: JPG, 2: pngGris(400, 600, 230), 3: pngGris(380, 560, 200) };
// Una tira de webtoon: más baja que el lado mínimo (250) de la detección automática
const TIRA = pngGris(420, 200, 215);
// El marcador de 1×1 que muestran las páginas con carga diferida hasta que se piden (2.11.4)
const PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
// Las páginas numeradas de las páginas de fondo (2.11.3): la n mide 400 + 4·n de ancho, así el
// orden se lee en el PDF
const NUMERADAS = Array.from({ length: 9 }, (_, n) => pngGris(400 + 4 * n, 600, 180 + n * 8));
const ordenNumerado = (archivo) => {
  const t = fs.readFileSync(archivo).toString('latin1');
  return (t.match(/\/MediaBox \[0 0 [\d.]+ [\d.]+\]/g) || []).map(s => (Math.round(+s.slice(15, -1).split(' ')[0]) - 400) / 4).join(',');
};
const TAMANOS = { '420x640': 1, '400x600': 2, '380x560': 3 };

// En qué orden quedaron las páginas de la serie "orden" en un PDF ("3,2,1"): cada página del PDF
// mide lo mismo que su imagen
function pdfOrden(archivo) {
  const t = fs.readFileSync(archivo).toString('latin1');
  return (t.match(/\/MediaBox \[0 0 [\d.]+ [\d.]+\]/g) || []).map(s => { const [w, h] = s.slice(15, -1).split(' ').map(Math.round); return TAMANOS[`${w}x${h}`] || '?'; }).join(',');
}
// Y en un CBZ: el nombre de cada entrada con la página que es ("001=3 002=2 003=1"), por su tamaño en bytes
function cbzOrden(archivo) {
  const b = fs.readFileSync(archivo), fin = b.length - 22, cual = new Map(Object.entries(DE_ORDEN).map(([n, d]) => [d.length, n])), out = [];
  let p = b.readUInt32LE(fin + 16);
  for (let i = 0; i < b.readUInt16LE(fin + 10); i++) {
    const n = b.readUInt16LE(p + 28), nombre = b.subarray(p + 46, p + 46 + n).toString();
    if (!/\.xml$/.test(nombre)) out.push(`${nombre.replace(/\.\w+$/, '')}=${cual.get(b.readUInt32LE(p + 24)) || '?'}`);
    p += 46 + n + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
  return out.join(' ');
}

// Sitio de prueba, en dos puertos: el segundo es "otro sitio" (otro origen) para el iframe del
// lector, y en las páginas se escribe %OTRO% donde va su dirección. `pedidos` cuenta lo que se
// pidió por dirección.
// Además de las páginas sueltas hay series enteras: /fx/<serie>/ es el listado (serie.html) y
// /fx/<serie>/leer/<n> cada capítulo (capitulo.html). `estado` deja romperlas desde la prueba:
//   estado.rotos    capítulos que dan 404, como "cola/2"
//   estado.imagen   función (dirección, pedido) → { status, headers } para que una imagen falle
//   estado.capitulo función (serie/n) → { status, headers } para que la página de un capítulo falle
//   estado.horas    a qué hora llegó cada pedido, por dirección: con eso se mide cuánto se esperó
async function sitio(pedidos = {}, estado = { rotos: new Set(), imagen: null, horas: {} }) {
  let otro = '';
  const atender = (req, res) => {
    const u = req.url.split('?')[0];
    pedidos[u] = (pedidos[u] || 0) + 1;
    (estado.horas[u] = estado.horas[u] || []).push(Date.now());
    const send = (type, body, status = 200, headers = {}) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers }); res.end(body); };
    // (%JPG64%: la página de prueba en base64, para un escaneo metido en un SVG como data:)
    const pagina = (archivo) => send('text/html; charset=utf-8', fs.readFileSync(path.join(FIXTURES, archivo), 'utf8').split('%OTRO%').join(otro).split('%JPG64%').join(JPG.toString('base64')));
    let m = u.match(/^\/fx\/([\w-]+\.html)$/);
    if (m && fs.existsSync(path.join(FIXTURES, m[1]))) return pagina(m[1]);
    if (/^\/fx\/[a-z]+\/$/.test(u)) return pagina('serie.html');
    m = u.match(/^\/fx\/([a-z]+)\/leer\/(\d+)$/);
    if (m) {
      if (estado.rotos.has(`${m[1]}/${m[2]}`)) return send('text/plain', 'no', 404);
      const mal = estado.capitulo ? estado.capitulo(`${m[1]}/${m[2]}`) : null;      // el sitio contesta "esperá" en vez del capítulo
      if (mal) return send('text/html; charset=utf-8', '<!doctype html><meta charset="UTF-8"><title>Esperá</title><p>Demasiados pedidos.</p>', mal.status, mal.headers || {});
      return pagina('capitulo.html');
    }
    m = u.match(/^\/fx\/img\/orden\/\d+\/([123])\.jpg$/);       // dicen .jpg, pero dos son PNG: la extensión mira el contenido
    if (m) return send(m[1] === '1' ? 'image/jpeg' : 'image/png', DE_ORDEN[m[1]]);
    if (/^\/fx\/img\/tiras\/[\w-]+\/\d+\.png$/.test(u)) return send('image/png', TIRA);
    m = u.match(/^\/fx\/img\/numerada\/([1-8])\.png$/);
    if (m) { const mal = estado.imagen ? estado.imagen(u, req) : null; return mal ? send('text/plain', 'no', mal.status, mal.headers || {}) : send('image/png', NUMERADAS[+m[1]]); }
    if (u === '/fx/img/px.png') return send('image/png', PX);         // el marcador de 1×1 de la carga diferida
    if (/^\/fx\/img\/[\w/-]+\.jpg$/.test(u)) {
      const mal = estado.imagen ? estado.imagen(u, req) : null;
      return mal ? send('text/plain', 'no', mal.status, mal.headers || {}) : send('image/jpeg', JPG);
    }
    send('text/plain', 'no', 404);
  };
  const abrir = () => new Promise(r => { const s = http.createServer(atender); s.listen(0, '127.0.0.1', () => r(s)); });
  const srv = await abrir(), srv2 = await abrir();
  otro = `http://localhost:${srv2.address().port}`;       // otro nombre y otro puerto: para el navegador es otro sitio
  return { url: `http://127.0.0.1:${srv.address().port}`, otro, pedidos, estado, cerrar: () => { for (const s of [srv, srv2]) { s.close(); s.closeAllConnections(); } } };
}

// Abre el listado de una serie de prueba con su diálogo de varios capítulos ya a la vista
async function abrirLote(b, url, cuantos = 4) {
  const pg = await b.cdp.open(url);
  await pg.waitFor(`document.readyState === 'complete'`, 'el listado');
  await pedir(b, url, 'batch');
  await pg.waitFor(`document.querySelectorAll('#mr-chapter .mr-chapter-item').length >= ${cuantos}`, 'la lista de capítulos');
  return pg;
}
const colaComo = (c) => (!c ? 'sin cola' : c.items.map(i => `${i.numero} ${i.estado}${i.error ? ' (' + i.error + ')' : ''}`).join(', '));
// Toca un botón del diálogo de varios capítulos y devuelve lo que dice el estado en ese mismo
// instante, antes de que corra nada más
const TOCAR = (boton) => `(() => { document.querySelector('${boton}').click(); return document.querySelector('#mr-chapter-status').textContent; })()`;
// Lo que ofrece la barra de la cola: su texto y los botones que están a la vista
const BARRA = `(() => { const q = (s) => ${RAIZ}.querySelector(s); const b = q('#mr-chapter-cola'); if (!b || b.hidden) return 'sin barra';
  return q('#mr-cola-texto').textContent.replace(/\\(\\d\\d\\/\\d\\d/, '(hoy') + ' [' + ['reanudar', 'reintentar', 'descartar'].map(k => q('#mr-cola-' + k)).filter(x => !x.hidden).map(x => x.textContent).join(' | ') + ']'; })()`;

// Lo que devuelve `cuerpo` (el texto de una función) en cada marco de la pestaña que tiene esa
// dirección: la página primero y después sus iframes. Corre en el mundo de la extensión, que ve
// la página de cada marco aunque sea de otro origen. Si no hay tal pestaña, [].
const enMarcos = (b, url, cuerpo) => b.ext.eval(`(async () => {
  const tab = (await chrome.tabs.query({})).find(t => t.url === ${JSON.stringify(url)});
  if (!tab) return [];
  const r = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: ${cuerpo} });
  return r.sort((x, y) => x.frameId - y.frameId).map(x => x.result); })()`);
// Lo mismo que el popup o Alt+S: pedirle al service worker que abra un diálogo en esa pestaña
// (la pestaña puede tardar un instante en aparecer con su dirección; si no aparece, se dice cuáles hay)
const pedir = (b, url, cmd) => b.ext.eval(`(async () => {
  let tab;
  for (let i = 0; i < 50 && !tab; i++) {
    tab = (await chrome.tabs.query({})).find(t => t.url === ${JSON.stringify(url)});
    if (!tab) await new Promise(r => setTimeout(r, 100));
  }
  if (!tab) throw new Error('no hay una pestaña en ' + ${JSON.stringify(url)} + '; hay: ' + (await chrome.tabs.query({})).map(t => t.url || t.pendingUrl || '(sin dirección)').join(' , '));
  return (await chrome.runtime.sendMessage({ action: 'tab', tabId: tab.id, command: ${JSON.stringify(cmd)} })).ok; })()`);
// Espera hasta que `listo(lo que devuelven los marcos)` y devuelve eso; pasado el tiempo, lo último que vio
async function esperarMarcos(b, url, cuerpo, listo, ms = 20000) {
  let r = [];
  for (const fin = Date.now() + ms; Date.now() < fin; await sleep(300)) {
    try { r = await enMarcos(b, url, cuerpo); } catch { r = []; }
    if (listo(r)) break;
  }
  return r;
}
// Evalúa `expr` en el service worker de la extensión (2.11.4): con eso se llama a lo mismo que llama
// Chrome cuando se toca un botón de la notificación. Si estaba dormido, se lo despierta con un pedido
// que no cambia nada.
async function enServicio(b, expr) {
  for (let i = 0; i < 20; i++) {
    const { targetInfos } = await b.cdp.send('Target.getTargets');
    const t = targetInfos.find(x => x.type === 'service_worker' && x.url.startsWith(`chrome-extension://${b.extId}/`));
    if (t) {
      const { sessionId } = await b.cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
      try {
        const r = await b.cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      } finally { await b.cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {}); }
    }
    await b.ext.eval(`chrome.runtime.sendMessage({ action: 'colaMarca', id: '-' }).catch(() => {})`);
    await sleep(300);
  }
  throw new Error('No encontré el service worker de la extensión');
}

// La interfaz de la extensión en ese marco (adentro del shadow root desde la 2.11)
const UI = `(document.querySelector('#mr-host')?.shadowRoot || document)`;
const donde = (r, campo) => r.map((m, i) => `${i ? 'iframe' : 'página'}: ${m?.[campo] ? 'sí' : 'no'}`).join(' · ');

// Espera a que aparezca un archivo descargado y dice qué tiene
async function pdfDe(archivo, ms = 30000) {
  for (const fin = Date.now() + ms; Date.now() < fin; await sleep(300)) {
    if (fs.existsSync(archivo) && fs.statSync(archivo).size > 0) { await sleep(300); return pdfPages(archivo); }
  }
  return '(no se guardó)';
}

const AREAS = {
  // ═══ 1. El diálogo y la burbuja adentro de un shadow root ═══
  async shadow({ b, S, eq }) {
    console.log('\n── 2.11 · El diálogo y la burbuja, a salvo del CSS y de los scripts del sitio');
    const h = await b.cdp.open(`${S}/fx/hostil.html`);
    await h.waitFor(`!!document.querySelector('#mr-fab')`, 'la burbuja en la página con CSS hostil');
    eq('CSS hostil: el botón de la burbuja se ve (la página dice "button { display: none }")',
      await h.eval(`getComputedStyle(document.querySelector('#mr-fab .mr-fab-main')).display !== 'none'`), true);
    await b.command(`${S}/fx/hostil.html`, 'save');
    await h.waitFor(`document.querySelectorAll('#mr-save .mr-thumb').length >= 6`, 'el diálogo con sus miniaturas');
    eq('CSS hostil: el diálogo se abre', await h.eval(`!!document.querySelector('#mr-save')`), true);
    eq('  la grilla de miniaturas sigue en grilla, y el cuerpo en columna (la página dice "div { display: flex }")',
      await h.eval(`getComputedStyle(document.querySelector('#mr-thumbs')).display + ' · ' + getComputedStyle(document.querySelector('#mr-save .mr-save-body')).flexDirection`), 'grid · column');
    eq('  las miniaturas se ven enteras (la página dice "img { max-width: 20px }")',
      await h.eval(`Math.round(document.querySelector('#mr-save .mr-thumb img').getBoundingClientRect().width) >= 40`), true);
    eq('  el botón Guardar está a la vista y se puede tocar',
      await h.eval(`(() => { const r = ${RAIZ}, g = r.querySelector('#mr-save-go'), c = g.getBoundingClientRect();
        return getComputedStyle(g).display + ' · ' + (c.width > 0 && r.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2) === g ? 'se puede tocar' : 'no se puede tocar'); })()`), 'block · se puede tocar');
    eq('  la interfaz está en un solo #mr-host, con su shadow root abierto, y no hay nada suelto en la página',
      await h.eval(`document.querySelectorAll('#mr-host').length + ' host · ' + (document.querySelector('#mr-host')?.shadowRoot ? 'abierto' : 'sin root') + ' · sueltos: ' + document.body.querySelectorAll(':scope > [id^="mr-"]:not(#mr-host)').length`),
      '1 host · abierto · sueltos: 0');
    await h.waitFor(`!/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`, 'el fin de la búsqueda', 30000);
    await h.eval(`document.querySelector('#mr-save-go').click()`);
    eq('  y guarda el capítulo', await pdfDe(path.join(b.dl, 'MangaReader', 'Serie Hostil', 'Serie Hostil 0003.pdf')), '6 × 420x640');
    await h.close();

    const p = await b.cdp.open(`${S}/fx/barrido.html`);
    await p.waitFor(`document.readyState === 'complete'`, 'la página que barre');
    await b.command(`${S}/fx/barrido.html`, 'save');
    await p.waitFor(`!!document.querySelector('#mr-save-name')`, 'el diálogo en la página que barre', 10000).catch(() => {});
    await p.eval(`(() => { const n = document.querySelector('#mr-save-name'); if (n) { n.value = 'Barrido/A mano'; n.dispatchEvent(new Event('input', { bubbles: true })); } })()`);
    let vistas = 0;
    for (let i = 0; i < 10; i++) { await sleep(300); if (await p.eval(`!!document.querySelector('#mr-save')`)) vistas++; }
    eq('la página saca de <body> lo ajeno cada 500 ms: a los 3 s el diálogo sigue ahí',
      `${vistas} de 10 miradas · barridos: ${await p.eval('window.barridos > 0')} · el nombre escrito: ${await p.eval(`document.querySelector('#mr-save-name')?.value || '(sin diálogo)'`)}`,
      '10 de 10 miradas · barridos: true · el nombre escrito: Barrido/A mano');
    await p.close();
  },

  // ═══ 2. El lector en un iframe ═══
  async iframes({ b, S, eq }) {
    console.log('\n── 2.11 · El lector en un iframe');
    const estado = `() => { const ui = ${UI}; return { fab: !!ui.querySelector('#mr-fab'), dialogo: !!ui.querySelector('#mr-save'),
      nombre: ui.querySelector('#mr-save-name')?.value || '', miniaturas: ui.querySelectorAll('#mr-save .mr-thumb.on').length,
      listo: !!ui.querySelector('#mr-save') && !/Recorriendo|Buscando/.test(ui.querySelector('#mr-save-count')?.textContent || '') }; }`;
    const guardar = `() => { const g = ${UI}.querySelector('#mr-save-go'); if (g && !g.disabled) { g.click(); return true; } return false; }`;
    const caso = async (titulo, ruta, pdf, nombre) => {
      const url = S + ruta;
      const pg = await b.cdp.open(url);
      const fabs = await esperarMarcos(b, url, estado, r => r.some(m => m?.fab));
      eq(`${titulo}: se detecta el capítulo y la burbuja aparece una sola vez, donde están las páginas`, donde(fabs, 'fab'), 'página: no · iframe: sí');
      await pedir(b, url, 'save').catch(() => false);
      const dlg = await esperarMarcos(b, url, estado, r => r.some(m => m?.listo && m.miniaturas >= 6), 30000);
      const d = dlg.find(m => m?.dialogo) || {};
      eq('  el diálogo de guardar se abre en el iframe, con el nombre del capítulo de la página y sus 6 páginas',
        `${donde(dlg, 'dialogo')} · ${d.nombre || '(sin nombre)'} · ${d.miniaturas || 0} páginas`, `página: no · iframe: sí · ${nombre} · 6 páginas`);
      await enMarcos(b, url, guardar);
      eq('  y el guardado baja las 6 páginas', await pdfDe(path.join(b.dl, 'MangaReader', pdf)), '6 × 420x640');
      await pg.close();
    };
    await caso('iframe del mismo origen', '/fx/marco.html?capitulo=7', 'Serie Marco/Serie Marco 0007.pdf', 'Serie Marco/Serie Marco 0007');
    await caso('iframe de otro origen', '/fx/marco.html?capitulo=8&otro=1', 'Serie Marco/Serie Marco 0008.pdf', 'Serie Marco/Serie Marco 0008');
    // (el registro se escribe un instante después de que el archivo aparece en disco: se lo espera)
    let anotado = null;
    for (const fin = Date.now() + 8000; Date.now() < fin && !anotado; await sleep(200)) anotado = ((await b.storage('savedChapters')) || {})['Serie Marco/Serie Marco 0008'];
    eq('  queda anotado con la dirección de la página, no con la del iframe', (anotado?.url || '(no está)').replace(S, ''), '/fx/marco.html?capitulo=8&otro=1');

    // Las mismas páginas en la página y en un iframe
    const url = S + '/fx/doble.html';
    const pg = await b.cdp.open(url);
    const fabs = await esperarMarcos(b, url, estado, r => r.length === 2 && r.some(m => m?.fab));
    await sleep(1500);                                      // tiempo para que el otro marco también quiera mostrarla
    eq('las mismas imágenes en la página y en un iframe: una sola burbuja', (await enMarcos(b, url, estado)).filter(m => m?.fab).length + ' burbuja(s) en ' + fabs.length + ' marcos', '1 burbuja(s) en 2 marcos');
    await pedir(b, url, 'save').catch(() => false);
    const dlg = await esperarMarcos(b, url, estado, r => r.some(m => m?.listo && m.miniaturas >= 6), 30000);
    eq('  un solo diálogo, con 6 páginas', `${dlg.filter(m => m?.dialogo).length} diálogo(s) · ${(dlg.find(m => m?.dialogo) || {}).miniaturas || 0} páginas`, '1 diálogo(s) · 6 páginas');
    await enMarcos(b, url, guardar);
    eq('  el PDF sale con 6 páginas, no con 12', await pdfDe(path.join(b.dl, 'MangaReader', 'Serie Doble', 'Serie Doble 0002.pdf')), '6 × 420x640');
    await pg.close();

    // Varios capítulos, cada uno con su lector en un iframe
    const lista = S + '/fx/marcos.html';
    const lp = await b.cdp.open(lista);
    await lp.waitFor(`document.readyState === 'complete'`, 'el listado');
    await pedir(b, lista, 'batch');
    await lp.waitFor(`document.querySelectorAll('#mr-chapter .mr-chapter-item').length >= 2`, 'la lista de capítulos');
    await lp.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    const fin = await lote.fin(lp, 120000).catch(e => e.message);
    eq('un lote de capítulos con el lector en un iframe: se guardan los dos, con sus 6 páginas',
      `${String(fin).split('\n')[0]} · ${await pdfDe(path.join(b.dl, 'MangaReader', 'Serie Marco', 'Serie Marco 0001.pdf'), 3000)} · ${await pdfDe(path.join(b.dl, 'MangaReader', 'Serie Marco', 'Serie Marco 0002.pdf'), 3000)}`,
      '✅ Listo: 2 capítulos guardados · 6 × 420x640 · 6 × 420x640');
    await lp.close();
  },

  // ═══ 3. La cola del lote: guardada, con reintento y reanudar ═══
  async cola({ b, S, eq, estado }) {
    console.log('\n── 2.11 · La cola del lote: queda guardada, se reintenta y se reanuda');
    const pdf = (serie, n) => path.join(b.dl, 'MangaReader', serie, `${serie} ${String(n).padStart(4, '0')}.pdf`);
    await b.ext.eval(`chrome.storage.local.remove('cola')`);
    estado.rotos = new Set(['cola/2', 'cola/3']);
    const lista = S + '/fx/cola/';
    const pg = await abrirLote(b, lista);
    await pg.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    const fin = await lote.fin(pg, 180000).catch(e => e.message);
    eq('4 capítulos, dos dan 404: el lote sigue y termina con 2 fallas', String(fin).split('\n')[0], 'Listo: 2 capítulos guardados · 2 con problemas');
    eq('  la cola queda en storage, con el motivo de cada falla', colaComo(await b.storage('cola')), '1 listo, 2 fallo (Sin páginas (encontré 0)), 3 fallo (Sin páginas (encontré 0)), 4 listo');
    eq('  y el diálogo ofrece reintentarlos o descartar la cola', await pg.eval(BARRA),
      'Quedó un lote sin terminar (hoy): 2 fallaron. [Reintentar los 2 que fallaron | Descartar la cola]');
    estado.rotos = new Set();                               // el sitio vuelve a andar
    // (2.11.1) El estado se lee en el mismo instante del clic: leer la cola es una ida y vuelta, y
    // en ese rato no puede seguir a la vista el final del lote anterior
    const alReintentar = await pg.eval(TOCAR('#mr-cola-reintentar'));
    eq('  al tocar Reintentar el estado cambia en el momento: no sigue diciendo "Listo"', `${String(fin).split('\n')[0]} → ${alReintentar}`, 'Listo: 2 capítulos guardados · 2 con problemas → Preparando el lote…');
    await pg.waitFor(`/Cancelar/.test(document.querySelector('#mr-chapter-go').textContent)`, 'que arranque el reintento', 10000).catch(() => {});
    const fin2 = await lote.fin(pg, 180000).catch(e => e.message);
    eq('con el sitio arreglado, Reintentar baja esos dos', `${String(fin2).split('\n')[0]} · ${await pdfDe(pdf('Serie Cola', 2), 3000)} · ${await pdfDe(pdf('Serie Cola', 3), 3000)}`,
      '✅ Listo: 2 capítulos guardados · 6 × 420x640 · 6 × 420x640');
    eq('  y la cola queda vacía', colaComo(await b.storage('cola')) + ' · ' + await pg.eval(BARRA), 'sin cola · sin barra');
    await pg.close();

    // (2.11.1) Un lote que arranca justo después de otro, y Reanudar: lo mismo, en el primer instante
    const pe = await abrirLote(b, S + '/fx/estado/?caps=3', 3);
    await pe.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    const primero = String(await lote.fin(pe, 180000).catch(e => e.message)).split('\n')[0];
    // Los mismos tres de nuevo, sin saltear los ya guardados
    await pe.eval(`(() => { const s = document.querySelector('#mr-chapter-skip'); if (s.checked) s.click(); document.querySelector('#mr-chapter-all').click(); })()`);
    eq('termina un lote y arranca otro enseguida: en el primer instante el estado ya no dice "Listo"', `${primero} → ${await pe.eval(TOCAR('#mr-chapter-go'))}`, '✅ Listo: 3 capítulos guardados → Preparando el lote…');
    await pe.waitFor(`/Cancelar/.test(document.querySelector('#mr-chapter-go').textContent)`, 'que arranque el segundo lote', 10000).catch(() => {});
    await pe.eval(`document.querySelector('#mr-chapter-go').click()`);                 // se cancela: queda una cola para reanudar
    const cancelado = String(await lote.fin(pe, 120000).catch(e => e.message)).split('\n')[0].replace(/\d+ capítulos? guardados?/, 'N guardados');
    await pe.waitFor(`(() => { const r = document.querySelector('#mr-cola-reanudar'); return !!r && !r.hidden && !r.closest('[hidden]'); })()`, 'la barra con Reanudar', 10000).catch(() => {});
    eq('  y al tocar Reanudar, tampoco sigue a la vista el final del lote cancelado', `${cancelado} → ${await pe.eval(TOCAR('#mr-cola-reanudar'))}`, 'Cancelado: N guardados → Preparando el lote…');
    await pe.waitFor(`/Cancelar/.test(document.querySelector('#mr-chapter-go').textContent)`, 'que arranque', 10000).catch(() => {});
    const reanudado = String(await lote.fin(pe, 180000).catch(e => e.message)).split('\n')[0];
    eq('  Reanudar termina lo que faltaba, y la cola queda vacía', `${/^✅ Listo: \d capítulos? guardados?$/.test(reanudado)} · ${colaComo(await b.storage('cola'))}`, 'true · sin cola');
    // (2.11.1) Una cola a la que le falta un capítulo que mientras tanto se guardó de a uno: Reanudar
    // no tiene nada que bajar, y la cola se tiene que cerrar en vez de quedar ofrecida para siempre
    await pe.eval(`document.querySelector('#mr-chapter-close').click()`);
    const estadoUrl = S + '/fx/estado/?caps=3';
    await b.setStorage({ cola: { id: 'ya-guardado', fecha: Date.now(), serie: '', formatos: { pdf: true }, visible: false, sitio: '127.0.0.1', origen: estadoUrl, plantilla: '',
      items: [{ url: S + '/fx/estado/leer/2', numero: 2, titulo: 'Capítulo 2', volumen: '', estado: 'pendiente', error: '' }] } });
    await pedir(b, estadoUrl, 'batch');
    await pe.waitFor(`(() => { const r = document.querySelector('#mr-cola-reanudar'); return !!r && !r.hidden && !r.closest('[hidden]'); })()`, 'la barra con Reanudar', 10000).catch(() => {});
    await pe.eval(`document.querySelector('#mr-cola-reanudar').click()`);
    const sinNada = await pe.waitFor(`(() => { const t = document.querySelector('#mr-chapter-status').textContent; return /ya estaba guardado|No hay capítulos/.test(t) ? t : ''; })()`, 'el resultado de Reanudar', 15000).catch(e => e.message);
    await sleep(500);
    eq('Reanudar una cola cuyo capítulo ya se guardó de a uno: lo dice y la cola se cierra', `${sinNada} · ${colaComo(await b.storage('cola'))} · ${await pe.eval(BARRA)}`,
      'Lo que faltaba ya estaba guardado: no queda nada por bajar. · sin cola · sin barra');
    await pe.close();

    // Cerrar la pestaña a mitad de un lote
    const lista2 = S + '/fx/corte/';
    const base = await b.tabCount();
    const p2 = await abrirLote(b, lista2);
    await p2.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    let cola = null;
    for (const hasta = Date.now() + 60000; Date.now() < hasta; await sleep(200)) {
      cola = await b.storage('cola');
      if (cola && cola.items.some(i => i.estado === 'listo')) break;
    }
    await p2.close();                                       // se cierra con el lote por la mitad
    for (const hasta = Date.now() + 60000; Date.now() < hasta && (await b.tabCount()) > base; await sleep(300));   // termina el capítulo que estaba en curso
    await sleep(1500);
    cola = await b.storage('cola');
    const faltan = cola ? cola.items.filter(i => i.estado === 'pendiente').length : -1;
    eq('se cierra la pestaña a mitad de un lote de 4: la cola guarda lo que faltaba', `${faltan >= 2 && faltan <= 3 ? 'faltan 2 o 3' : 'faltan ' + faltan} · sin fallas: ${!!cola && cola.items.every(i => i.estado !== 'fallo')}`, 'faltan 2 o 3 · sin fallas: true');
    const p3 = await abrirLote(b, lista2);
    eq('al abrir de nuevo la página de la serie, ofrece reanudar con los que faltaban', await p3.eval(BARRA),
      `Quedó un lote sin terminar (hoy): faltan ${faltan} capítulos. [Reanudar (${faltan}) | Descartar la cola]`);
    await p3.eval(`document.querySelector('#mr-cola-reanudar').click()`);
    await p3.waitFor(`/Cancelar/.test(document.querySelector('#mr-chapter-go').textContent)`, 'que arranque', 10000).catch(() => {});
    const fin3 = await lote.fin(p3, 180000).catch(e => e.message);
    const estan = [];
    for (const n of [1, 2, 3, 4]) estan.push(await pdfDe(pdf('Serie Corte', n), 3000) === '6 × 420x640' ? n : `${n}: falta`);
    eq('  Reanudar baja lo que faltaba: quedan los 4 capítulos y la cola vacía', `${/^✅ Listo/.test(String(fin3))} · ${estan.join(',')} · ${colaComo(await b.storage('cola'))}`, 'true · 1,2,3,4 · sin cola');
    await p3.close();
  },

  // ═══ 4. Ritmo, concurrencia y espera cuando el sitio dice "esperá" (429) ═══
  async ritmo({ b, S, eq, estado, pedidos }) {
    console.log('\n── 2.11 · Ritmo del lote y espera ante un 429');
    const pdf = (serie, n) => path.join(b.dl, 'MangaReader', serie, `${serie} ${String(n).padStart(4, '0')}.pdf`);
    const lotear = async (url) => {
      const pg = await abrirLote(b, url, 3);
      await pg.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
      const fin = await lote.fin(pg, 240000).catch(e => e.message);
      await pg.close();
      return String(fin);
    };
    await b.ext.eval(`chrome.storage.local.remove('cola')`);
    await b.setStorage({ ritmo: { pausa: 0, espera429: 2 } });       // sin pausa entre capítulos, y la parada del lote de 2 s en vez de 60

    // Una imagen que responde 429. El sitio es estricto, como los de verdad: mientras no pasen
    // los 2 segundos que pide en Retry-After sigue respondiendo 429, y cada pedido apurado vuelve
    // a poner el reloj en cero. (Con Retry-After: 1 la 2.10 zafaba: reintentaba a ciegas a los 0,7 y 2,1 s.)
    let desde = 0, rechazos = 0;
    estado.imagen = (u, req) => {
      if (u !== '/fx/img/ritmo/2/3.jpg' || req.headers.accept !== 'image/*') return null;      // solo cuando la pide la extensión para guardarla
      const ahora = Date.now();
      if (desde && ahora - desde >= 1900) return null;
      desde = ahora; rechazos++;
      return { status: 429, headers: { 'Retry-After': '2' } };
    };
    const fin = await lotear(S + '/fx/ritmo/?caps=3');
    eq('429 con Retry-After en la 3ª imagen del 2º capítulo: espera lo que pide el sitio, el capítulo sale completo y el lote sigue',
      `${fin.split('\n')[0]} · capítulo 2: ${await pdfDe(pdf('Serie Ritmo', 2), 3000)} · rechazos del sitio: ${rechazos}`, '✅ Listo: 3 capítulos guardados · capítulo 2: 6 × 420x640 · rechazos del sitio: 1');
    estado.imagen = null;

    // Un capítulo entero que responde 429
    estado.capitulo = (clave) => (clave === 'pide/2' ? { status: 429 } : null);
    const antes = pedidos['/fx/pide/leer/2'] || 0;
    const fin2 = await lotear(S + '/fx/pide/?caps=3');
    eq('el capítulo entero responde 429: el lote para, lo reintenta una vez y, si vuelve a fallar, queda en falla con su motivo',
      `${fin2.split('\n').filter(l => /^Listo|Capítulo 2/.test(l)).join(' / ')} · se abrió ${(pedidos['/fx/pide/leer/2'] || 0) - antes} veces`,
      'Listo: 2 capítulos guardados · 1 con problemas / Capítulo 2: el sitio pidió esperar (HTTP 429) · se abrió 2 veces');
    eq('  y los otros capítulos se guardaron igual', `${await pdfDe(pdf('Serie Pide', 1), 3000)} · ${await pdfDe(pdf('Serie Pide', 3), 3000)} · cola: ${colaComo(await b.storage('cola'))}`,
      '6 × 420x640 · 6 × 420x640 · cola: 1 listo, 2 fallo (el sitio pidió esperar (HTTP 429)), 3 listo');
    estado.capitulo = null;

    // (2.11.1) Las imágenes de un capítulo responden 503: tiene que pasar lo mismo que cuando lo
    // responde su página. El sitio contesta 503 (con Retry-After: 1, para no alargar la prueba)
    // a cada imagen del capítulo 2 que pide la extensión para guardarla.
    let negadas = 0;
    estado.imagen = (u, req) => (/^\/fx\/img\/imagenes\/2\//.test(u) && req.headers.accept === 'image/*' ? (negadas++, { status: 503, headers: { 'Retry-After': '1' } }) : null);
    const p5 = await abrirLote(b, S + '/fx/imagenes/?caps=3', 3);
    await p5.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    let parado = '(no paró)', fin5 = '';
    for (const hasta = Date.now() + 240000; Date.now() < hasta && !fin5; await sleep(120)) {
      const t = await p5.eval(`document.querySelector('#mr-chapter-status')?.textContent || ''`).catch(() => '');
      // (la primera cuenta, que es la del capítulo que pidió esperar: desde la 2.11.2 el que sigue también espera)
      if (parado === '(no paró)' && /pidió esperar, sigo en/.test(t)) parado = t.replace(/\d+ s/, 'N s');
      if (/^(✅ )?(Listo|Cancelado|Parado)/.test(t)) fin5 = t;
    }
    eq('las imágenes de un capítulo responden 503: el lote para igual que cuando lo responde la página, y la falla dice que el sitio pidió esperar',
      `${parado} · ${fin5.split('\n').filter(l => /^Listo|Capítulo 2/.test(l)).join(' / ')}`,
      '(2/3) Capítulo 2: el sitio pidió esperar, sigo en N s… · Listo: 2 capítulos guardados · 1 con problemas / Capítulo 2: el sitio pidió esperar (HTTP 503)');
    const quedo = () => fs.readdirSync(path.join(b.dl, 'MangaReader', 'Serie Imagenes')).sort().join(' | ');
    // Cuántos pedidos le llegan al sitio sale de las constantes del armador que está cargado (no se
    // escribe a mano: tocar la concurrencia no tiene que romper esta prueba). Por cada intento del
    // capítulo arrancan a la vez tantas páginas como FETCH_CONCURRENCY (hay 6), cada una se pide
    // 1 + FETCH_RETRIES + WAIT_RETRIES veces, y después de la primera que queda afuera no se pide
    // ninguna más. El capítulo se intenta dos veces: la primera y el reintento del lote.
    const armador = await b.ext.eval(`fetch(chrome.runtime.getURL('offscreen.js')).then(r => r.text())`);
    const constante = (n) => +((armador.match(new RegExp(`const ${n} = (\\d+)`)) || [])[1]);
    const porPagina = 1 + constante('FETCH_RETRIES') + constante('WAIT_RETRIES');
    const porIntento = Math.min(constante('FETCH_CONCURRENCY'), 6) * porPagina;
    eq(`  no queda nada guardado a medias, la cola lo tiene como falla y el armador dejó de pedir apenas lo supo (${Math.min(constante('FETCH_CONCURRENCY'), 6)} páginas por intento, ${porPagina} pedidos cada una, 2 intentos)`,
      `${quedo()} · cola: ${colaComo(await b.storage('cola'))} · ${negadas} pedidos negados`,
      `Serie Imagenes 0001.pdf | Serie Imagenes 0003.pdf · cola: 1 listo, 2 fallo (el sitio pidió esperar (HTTP 503)), 3 listo · ${2 * porIntento} pedidos negados`);
    estado.imagen = null;                                   // el sitio vuelve a andar
    await p5.eval(`document.querySelector('#mr-cola-reintentar').click()`);
    await p5.waitFor(`/Cancelar/.test(document.querySelector('#mr-chapter-go').textContent)`, 'que arranque el reintento', 10000).catch(() => {});
    const fin6 = await lote.fin(p5, 180000).catch(e => e.message);
    eq('  con el sitio arreglado, Reintentar lo baja: entero, con su nombre y sin copias al lado',
      `${String(fin6).split('\n')[0]} · ${await pdfDe(pdf('Serie Imagenes', 2), 3000)} · ${quedo()} · cola: ${colaComo(await b.storage('cola'))}`,
      '✅ Listo: 1 capítulo guardado · 6 × 420x640 · Serie Imagenes 0001.pdf | Serie Imagenes 0002.pdf | Serie Imagenes 0003.pdf · cola: sin cola');
    await p5.close();
    await b.ext.eval(`chrome.storage.local.remove(['cola', 'ritmo'])`);

    // La página de opciones
    await b.ext.eval(`location.reload()`);
    await b.ext.waitFor(`document.readyState === 'complete' && !!document.querySelector('#ritmoGuardar') && document.querySelector('#ritmoPausa').value !== ''`, 'la sección del ritmo en opciones');
    eq('opciones: sin nada guardado muestra el ritmo de siempre', await b.ext.eval(`['ritmoPausa', 'ritmoCada', 'ritmoSeg', 'ritmoConc'].map(i => document.getElementById(i).value).join(' · ')`), '1.5 · 0 · 30 · 6');
    await b.ext.eval(`(() => { const v = { ritmoPausa: '25', ritmoCada: '10', ritmoSeg: '45', ritmoConc: '1' }; for (const [i, x] of Object.entries(v)) document.getElementById(i).value = x; document.getElementById('ritmoGuardar').click(); })()`);
    await b.ext.waitFor(`/Guardado/.test(document.querySelector('#ritmoMsg').textContent)`, 'el guardado del ritmo');
    const r = (await b.storage('ritmo')) || {};
    eq('  lo que se pasa de los límites se guarda en el límite (pausa 0–10, concurrencia 2–8), y los campos lo muestran',
      `${r.pausa} · ${r.descansoCada} · ${r.descansoSeg} · ${r.concurrencia} · campos: ${await b.ext.eval(`document.getElementById('ritmoPausa').value + ' y ' + document.getElementById('ritmoConc').value`)}`, '10 · 10 · 45 · 2 · campos: 10 y 2');
    await b.ext.eval(`chrome.storage.local.remove('ritmo')`);
  },

  // ═══ 4b. El sitio dice cuánto esperar: Retry-After de la página del capítulo (2.11.2) ═══
  async espera({ b, S, OTRO, eq, estado }) {
    console.log('\n── 2.11.2 · Retry-After de la página del capítulo, y el permiso webRequest');
    // ── El permiso: lo que dice chrome://extensions de la extensión cargada ──
    const cx = await b.cdp.open('chrome://extensions');
    await cx.waitFor(`!!(window.chrome && chrome.developerPrivate)`, 'chrome://extensions');
    const info = () => cx.eval(`new Promise(r => chrome.developerPrivate.getExtensionsInfo({ includeDisabled: true, includeTerminated: true }, (l) => {
      const e = (l || []).find(x => x.id === ${JSON.stringify(b.extId)});
      r(e ? { avisos: e.installWarnings || [], manifest: (e.manifestErrors || []).map(x => x.message), errores: (e.runtimeErrors || []).map(x => x.message) } : null); }))`);
    // (Chromium junta los errores de una extensión solo en modo desarrollador: se prende acá para mirarlos al final)
    await cx.eval(`new Promise(r => chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, () => r(true)))`).catch(() => false);
    const i0 = (await info()) || { avisos: ['la extensión no está'], manifest: [], errores: [] };
    const manifest = await b.ext.eval(`chrome.runtime.getManifest()`);
    const avisos = (m) => b.ext.eval(`new Promise(r => chrome.management.getPermissionWarningsByManifest(${JSON.stringify(JSON.stringify(m))}, (w) => r(w || [])))`);
    const con = await avisos(manifest), sin = await avisos({ ...manifest, permissions: (manifest.permissions || []).filter(p => p !== 'webRequest') });
    eq('el manifest pide webRequest, y la extensión carga sin advertencias ni errores (chrome://extensions)',
      `webRequest: ${(manifest.permissions || []).includes('webRequest')} · advertencias: ${i0.avisos.join(' | ') || 'ninguna'} · errores del manifest: ${i0.manifest.join(' | ') || 'ninguno'}`,
      'webRequest: true · advertencias: ninguna · errores del manifest: ninguno');
    eq('  y no suma advertencias de permisos al instalar: son las mismas que sin webRequest (el acceso a todos los sitios ya estaba)',
      `${JSON.stringify(con) === JSON.stringify(sin) ? 'las mismas' : 'distintas: ' + con.join(' | ')} (${con.length})`, `las mismas (${sin.length})`);

    // ── 503 con Retry-After: 4 en la página del capítulo 2, todas las veces ──
    await b.ext.eval(`chrome.storage.local.remove(['cola', 'esperaSitio'])`);
    await b.setStorage({ ritmo: { pausa: 0 } });             // sin pausa entre capítulos; sin cabecera, la parada es el minuto de siempre
    const horas = (u) => estado.horas[u] || [];
    const seg = (ms) => (Number.isFinite(ms) ? (ms / 1000).toFixed(1).replace('.', ',') + ' s' : 'no llegó');
    const rango = (ms) => (ms >= 4000 && ms < 15000 ? 'entre 4 y 15 s' : seg(ms));
    estado.capitulo = (clave) => (clave === 'espera/2' ? { status: 503, headers: { 'Retry-After': '4' } } : null);
    const pg = await abrirLote(b, S + '/fx/espera/?caps=3', 3);
    await pg.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    // Se mira el estado cada 100 ms: los números de cada cuenta regresiva y cómo termina
    const cuentas = [];
    let fin = '';
    for (const hasta = Date.now() + 120000; Date.now() < hasta && !fin; await sleep(100)) {
      const t = await pg.eval(`document.querySelector('#mr-chapter-status')?.textContent || ''`).catch(() => '');
      const n = +((t.match(/sigo en (\d+) s/) || [])[1] || 0);
      const ultima = cuentas[cuentas.length - 1];
      if (n && (!ultima || n > ultima[ultima.length - 1])) cuentas.push([n]);       // una cuenta nueva
      else if (n && n < ultima[ultima.length - 1]) ultima.push(n);
      if (/^(✅ )?(Listo|Cancelado|Parado)/.test(t)) fin = t;
    }
    const h2 = horas('/fx/espera/leer/2'), h3 = horas('/fx/espera/leer/3');
    const reintento = h2[1] - h2[0], siguiente = h3[0] - h2[1];
    eq('503 con Retry-After: 4 en la página del capítulo: "sigo en 4 s" y baja, antes del reintento y antes del capítulo siguiente',
      cuentas.map(c => c.join(',')).join(' / '), '4,3,2,1 / 4,3,2,1');
    eq(`  el reintento llega a los 4 s o más, y bastante antes de 60 (llegó a los ${seg(reintento)})`, rango(reintento), 'entre 4 y 15 s');
    eq(`  el capítulo siguiente también espera: llega a los 4 s o más del segundo 503 (llegó a los ${seg(siguiente)})`, rango(siguiente), 'entre 4 y 15 s');
    eq('  el capítulo 2 queda con "el sitio pidió esperar" y los otros se guardan',
      `${fin.split('\n').filter(l => /^Listo|Capítulo 2/.test(l)).join(' / ')} · cola: ${colaComo(await b.storage('cola'))}`,
      'Listo: 2 capítulos guardados · 1 con problemas / Capítulo 2: el sitio pidió esperar (HTTP 503) · cola: 1 listo, 2 fallo (el sitio pidió esperar (HTTP 503)), 3 listo');
    await pg.close();

    // ── Sin cabecera, o con una que no se entiende: un minuto ──
    // No se espera el minuto entero: en el mismo instante se lee el número de la cuenta, el botón y
    // cuántas veces se pidió el capítulo, y se cancela. Va al otro sitio (otro nombre): esa parada
    // no frena a las pruebas que siguen, que usan el primero.
    const unMinuto = async (serie, mal) => {
      await b.ext.eval(`chrome.storage.local.remove(['cola', 'esperaSitio'])`);
      estado.capitulo = (clave) => (clave === serie + '/2' ? mal : null);
      const pc = await abrirLote(b, `${OTRO}/fx/${serie}/?caps=3`, 3);
      await pc.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
      await pc.waitFor(`/sigo en \\d+ s/.test(document.querySelector('#mr-chapter-status').textContent)`, 'la cuenta regresiva', 60000);
      const r = await pc.eval(`(() => { const s = document.querySelector('#mr-chapter-status').textContent, g = document.querySelector('#mr-chapter-go');
        const boton = g.textContent; g.click(); return { n: +((s.match(/sigo en (\\d+) s/) || [])[1] || 0), boton, despues: document.querySelector('#mr-chapter-status').textContent }; })()`);
      const pedidosAlCancelar = horas(`/fx/${serie}/leer/2`).length;
      const final = String(await lote.fin(pc, 30000).catch(e => e.message)).split('\n')[0].replace(/\d+ capítulos? guardados?/, 'N guardados');
      await sleep(1500);                                   // si saliera el reintento, este es el momento
      const out = { n: r.n, boton: r.boton, despues: r.despues, pedidos: `${pedidosAlCancelar} y ${horas(`/fx/${serie}/leer/2`).length}`, final, cola: colaComo(await b.storage('cola')) };
      await pc.close();
      return out;
    };
    const cerca = (n) => (n >= 55 && n <= 60 ? 'entre 55 y 60 s' : `${n} s`);
    const s1 = await unMinuto('callado', { status: 503 });
    eq(`503 sin Retry-After: la cuenta arranca cerca de 60 (decía "sigo en ${s1.n} s")`, cerca(s1.n), 'entre 55 y 60 s');
    eq('  en ese instante el lote sigue esperando (el botón es Cancelar) y el capítulo se pidió una sola vez; al cancelar, el reintento no sale',
      `botón: ${s1.boton} → ${s1.despues} · pedidos del capítulo 2: ${s1.pedidos} · ${s1.final} · cola: ${s1.cola}`,
      'botón: Cancelar → Cancelando… · pedidos del capítulo 2: 1 y 1 · Cancelado: N guardados · cola: 1 listo, 2 pendiente, 3 pendiente');
    const s2 = await unMinuto('basura', { status: 503, headers: { 'Retry-After': 'pronto' } });
    eq(`una cabecera que no se entiende (Retry-After: pronto) vale lo mismo: un minuto (decía "sigo en ${s2.n} s")`, `${cerca(s2.n)} · pedidos del capítulo 2: ${s2.pedidos}`, 'entre 55 y 60 s · pedidos del capítulo 2: 1 y 1');

    estado.capitulo = null;
    await b.ext.eval(`chrome.storage.local.remove(['cola', 'esperaSitio', 'ritmo'])`);
    const i1 = (await info()) || { errores: ['la extensión no está'] };
    eq('  y mientras corrieron esos lotes la extensión no anotó ningún error (chrome://extensions)', i1.errores.join(' | ') || 'ninguno', 'ninguno');
    await cx.close();
  },

  // ═══ 5. Insignia del ícono y notificación al terminar ═══
  async insignia({ b, S, eq, estado }) {
    console.log('\n── 2.11 · Insignia y notificación del lote');
    await b.ext.eval(`chrome.storage.local.remove('cola')`);
    await b.setStorage({ ritmo: { pausa: 0 } });
    await b.ext.eval(`chrome.action.setBadgeText({ text: '' })`);
    estado.rotos = new Set(['aviso/2']);
    const pg = await abrirLote(b, S + '/fx/aviso/?caps=3', 3);
    await pg.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    // Mientras corre se mira la insignia cada tanto: no se ven todos los pasos, pero todos los que se ven son "n/3"
    const vistas = new Set();
    let fin = '';
    for (const hasta = Date.now() + 180000; Date.now() < hasta && !fin; await sleep(120)) {
      vistas.add(await b.ext.eval(`chrome.action.getBadgeText({})`));
      fin = await pg.eval(`(() => { const s = document.querySelector('#mr-chapter-status'); return s && /^(✅ )?(Listo|Cancelado|Parado)/.test(s.textContent) ? s.textContent : ''; })()`).catch(() => '');
    }
    await sleep(500);
    const pasos = [...vistas].filter(Boolean);
    eq('mientras corre el lote la insignia dice cuántos van, y termina en el total',
      `${pasos.length >= 2 && pasos.every(t => /^[0-3]\/3$/.test(t)) ? 'pasos n/3' : 'vistas: ' + pasos.join(',')} · al final ${await b.ext.eval(`chrome.action.getBadgeText({})`)}`, 'pasos n/3 · al final 3/3');
    eq('  roja, porque un capítulo falló', (await b.ext.eval(`chrome.action.getBadgeBackgroundColor({})`)).slice(0, 3).join(','), '231,76,60');
    const avisos = await b.ext.eval(`new Promise(r => chrome.notifications.getAll(n => r(Object.keys(n || {}))))`).catch(e => ['error: ' + e.message]);
    eq('  y queda la notificación del lote', avisos.join(',') || '(ninguna)', 'mr-lote');
    await pg.eval(`document.querySelector('#mr-chapter-close').click()`);
    await sleep(600);
    eq('al cerrar el diálogo la insignia se limpia', JSON.stringify(await b.ext.eval(`chrome.action.getBadgeText({})`)), '""');
    await pg.close();
    estado.rotos = new Set();
    await b.ext.eval(`chrome.storage.local.remove(['cola', 'ritmo']); chrome.notifications.clear('mr-lote')`);
  },

  // ═══ 6. El orden de las páginas ═══
  async orden({ b, S, eq }) {
    console.log('\n── 2.11 · El orden de las páginas: arrastrar, ▲▼, invertir y ordenar por número');
    const url = S + '/fx/orden/leer/1?pags=3';
    // El orden de las miniaturas, por el número de la imagen de cada una
    const ORDEN = `[...document.querySelectorAll('#mr-save .mr-thumb img')].map(i => i.src.match(/(\\d)\\.jpg$/)[1]).join(',')`;
    const abrir = async () => {
      const pg = await b.cdp.open(url);
      await pg.waitFor(`document.readyState === 'complete'`, 'el capítulo de 3 páginas');
      await pedir(b, url, 'save');
      await pg.waitFor(`document.querySelectorAll('#mr-save .mr-thumb.on').length >= 3 && !/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`, 'las 3 miniaturas', 30000);
      return pg;
    };
    const guardar = async (pg, nombre, cbz) => {
      await pg.eval(`(() => { const n = document.querySelector('#mr-save-name'); n.value = ${JSON.stringify(nombre)}; n.dispatchEvent(new Event('input', { bubbles: true }));
        if (document.querySelector('#mr-save-cbz').checked !== ${!!cbz}) document.querySelector('#mr-save-cbz').click(); document.querySelector('#mr-save-go').click(); })()`);
      await pg.waitFor(`/success|error/.test(document.querySelector('#mr-save-status').className)`, 'el guardado', 60000);
    };
    const archivo = (nombre, ext) => path.join(b.dl, 'MangaReader', nombre + '.' + ext);

    const p1 = await abrir();
    eq('3 páginas: salen en el orden de la página', await p1.eval(ORDEN), '1,2,3');
    await p1.eval(`document.querySelector('#mr-save-invertir').click()`);
    eq('Invertir da vuelta las miniaturas, y cada una dice su lugar nuevo', await p1.eval(ORDEN) + ' · ' + await p1.eval(`[...document.querySelectorAll('#mr-save .mr-thumb-n')].map(n => n.textContent).join(',')`), '3,2,1 · 1,2,3');
    await guardar(p1, 'Orden/Invertido', true);
    eq('  el PDF sale 3, 2, 1', pdfOrden(archivo('Orden/Invertido', 'pdf')), '3,2,1');
    eq('  y el CBZ numera en ese orden', cbzOrden(archivo('Orden/Invertido', 'cbz')), '001=3 002=2 003=1');
    await p1.eval(`document.querySelector('#mr-save-ordenar').click()`);
    eq('Ordenar por número las deja por el número del nombre de cada imagen', await p1.eval(ORDEN), '1,2,3');
    await p1.eval(`document.querySelector('#mr-save .mr-thumb[data-i="0"] [data-mv="1"]').click()`);
    eq('▼ en la primera la pasa al segundo lugar, sin destildarla', await p1.eval(ORDEN) + ' · tildadas: ' + await p1.eval(`document.querySelectorAll('#mr-save .mr-thumb.on').length`), '2,1,3 · tildadas: 3');
    await p1.eval(`document.querySelector('#mr-save .mr-thumb[data-i="2"] [data-mv="-1"]').click()`);
    eq('▲ en la última la sube un lugar', await p1.eval(ORDEN), '2,3,1');
    await p1.close();

    const p2 = await abrir();
    await p2.eval(`(() => { const t = (i) => document.querySelector('#mr-save .mr-thumb[data-i="' + i + '"]'), ev = (tipo) => new DragEvent(tipo, { bubbles: true, cancelable: true });
      t(0).dispatchEvent(ev('dragstart')); t(2).dispatchEvent(ev('dragover')); t(2).dispatchEvent(ev('drop')); })()`);
    eq('arrastrar la primera al final', await p2.eval(ORDEN), '2,3,1');
    await guardar(p2, 'Orden/Arrastrado', false);
    eq('  el PDF sale 2, 3, 1', pdfOrden(archivo('Orden/Arrastrado', 'pdf')), '2,3,1');
    await p2.close();
  },

  // ═══ 7. Adaptadores por sitio ═══
  async adaptadores({ b, S, eq }) {
    console.log('\n── 2.11 · Adaptadores por sitio');
    const url = S + '/fx/raro.html', HOST = '127.0.0.1';
    // Qué quedó tildado: cuántas páginas del capítulo (p1…p6) y cuántos señuelos (s01…s20)
    const TILDADAS = `(() => { const t = [...document.querySelectorAll('#mr-save .mr-thumb')].map(x => ({ on: x.classList.contains('on'), k: (x.querySelector('img').src.match(/\\/([ps])\\d+\\.jpg$/) || [])[1] }));
      const c = (k) => t.filter(x => x.k === k && x.on).length;
      return c('p') + ' páginas y ' + c('s') + ' señuelos tildados · ' + t.length + ' miniaturas'; })()`;
    const abrir = async () => {
      const pg = await b.cdp.open(url);
      await pg.waitFor(`document.readyState === 'complete' && document.images.length >= 26 && [...document.images].every(i => i.complete)`, 'la página con señuelos', 30000);
      await pedir(b, url, 'save');
      await pg.waitFor(`document.querySelectorAll('#mr-save .mr-thumb').length >= 6 && !/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`, 'el diálogo', 40000);
      return pg;
    };
    const poner = (a) => b.setStorage({ adaptadores: a ? { [HOST]: { contenedor: '', imagenes: '', ignorar: [], patron: '', ...a } } : {} });
    await poner(null);
    let pg = await abrir();
    eq('sin adaptador: la detección automática se queda con los señuelos y deja 3 páginas afuera', await pg.eval(TILDADAS), '3 páginas y 20 señuelos tildados · 26 miniaturas');
    await poner({ contenedor: '#visor-raro' });             // se guarda con la pestaña abierta: el diálogo se rehace solo
    await pg.waitFor(`document.querySelectorAll('#mr-save .mr-thumb').length === 6`, 'el diálogo con el adaptador', 15000).catch(() => {});
    eq('con un adaptador que dice el contenedor: exactamente las 6 páginas', await pg.eval(TILDADAS), '6 páginas y 0 señuelos tildados · 6 miniaturas');
    await pg.eval(`document.querySelector('#mr-save-go').click()`);
    eq('  y se guardan esas 6', await pdfDe(path.join(b.dl, 'MangaReader', 'Serie Rara', 'Serie Rara 0009.pdf')), '6 × 420x640');
    await pg.close();

    await poner({ imagenes: 'img', ignorar: ['.recomendados img'], patron: S + '/fx/rara/leer/{n}' });
    pg = await abrir();
    eq('con "imágenes" e "ignorar" en lugar del contenedor, lo mismo', await pg.eval(TILDADAS), '6 páginas y 0 señuelos tildados · 6 miniaturas');
    await pedir(b, url, 'batch');
    await pg.waitFor(`!!document.querySelector('#mr-chapter-tpl')`, 'el diálogo de varios capítulos');
    eq('la dirección de los capítulos del adaptador ya viene puesta en el diálogo de varios capítulos',
      (await pg.eval(`document.querySelector('#mr-chapter-tpl').value + ' · a la vista para revisar: ' + document.querySelector('#mr-chapter-more').open`)).replace(S, ''), '/fx/rara/leer/{n} · a la vista para revisar: false');
    await pg.close();

    // (2.11.1) Con un adaptador no queda nada del filtro automático: ni el lado mínimo, ni la carpeta
    // con más imágenes, ni el mínimo de 3 páginas. Un capítulo en tiras de 420×200, cada una en su
    // carpeta (el capítulo 2 tiene solo 2 tiras).
    const tiras = (n) => `${S}/fx/tiras.html?capitulo=${n}`;
    const verTiras = async () => {
      const t = await b.cdp.open(tiras(1));
      await t.waitFor(`document.readyState === 'complete' && document.images.length >= 5 && [...document.images].every(i => i.complete)`, 'el capítulo en tiras', 30000);
      await pedir(b, tiras(1), 'save');
      await t.waitFor(`!!document.querySelector('#mr-save-count') && !/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`, 'el diálogo', 40000);
      return t;
    };
    await poner(null);
    let t = await verTiras();
    eq('un capítulo en tiras más bajas que el lado mínimo, sin adaptador: la detección automática no encuentra páginas',
      (await t.eval(`document.querySelectorAll('#mr-save .mr-thumb').length + ' miniaturas · ' + document.querySelector('#mr-save-count').textContent`)).split(' · ').slice(0, 2).join(' · '), '0 miniaturas · No encontré páginas');
    await t.close();
    await poner({ contenedor: '#visor-tiras', patron: S + '/fx/tiras.html?capitulo={n}' });
    t = await verTiras();
    await t.waitFor(`document.querySelectorAll('#mr-save .mr-thumb').length >= 5`, 'las tiras en el diálogo', 15000).catch(() => {});
    eq('con el adaptador entran las 5 tiras: el tamaño no las deja afuera',
      await t.eval(`document.querySelectorAll('#mr-save .mr-thumb.on').length + ' de ' + document.querySelectorAll('#mr-save .mr-thumb').length + ' tildadas'`), '5 de 5 tildadas');
    await pedir(b, tiras(1), 'batch');
    await t.waitFor(`!!document.querySelector('#mr-chapter-tpl')`, 'el diálogo de varios capítulos');
    await lote.rango(t, 1, 2);
    await t.waitFor(`/Descargar 2/.test(document.querySelector('#mr-chapter-go').textContent)`, 'los dos capítulos marcados', 10000).catch(() => {});
    await t.eval(`document.querySelector('#mr-chapter-go').click()`);
    const finT = await lote.fin(t, 180000).catch(e => e.message);
    const pdfT = (n) => pdfDe(path.join(b.dl, 'MangaReader', 'Serie Tiras', `Serie Tiras 000${n}.pdf`), 3000);
    eq('  y un lote con ese adaptador las cuenta aunque cada una esté en otra carpeta, y guarda también el capítulo de solo 2 tiras',
      `${String(finT).split('\n').slice(0, 2).join(' / ')} · ${await pdfT(1)} · ${await pdfT(2)}`, '✅ Listo: 2 capítulos guardados · 5 × 420x200 · 2 × 420x200');
    await t.close();

    await poner({ contenedor: '#visor-raro >>' });
    pg = await abrir();
    eq('un selector inválido no rompe nada: en esa página sigue la detección automática', await pg.eval(TILDADAS), '3 páginas y 20 señuelos tildados · 26 miniaturas');
    // (2.11.1) y se avisa: si no, parece que el adaptador no hace nada
    eq('  y el diálogo avisa que el adaptador no se pudo usar', ((await pg.eval(`document.querySelector('#mr-save-warn-text').textContent`)).match(/el adaptador de este sitio tiene un selector inválido[^·]*/) || ['(no avisa)'])[0].trim(),
      'el adaptador de este sitio tiene un selector inválido: busqué las páginas como siempre');
    await poner(null);

    // La sección de opciones, con esa pestaña del sitio abierta
    await b.ext.eval(`location.reload()`);
    await b.ext.waitFor(`document.readyState === 'complete' && !!document.querySelector('#adGuardar') && !!document.querySelector('#adLista li')`, 'la sección de adaptadores en opciones');
    const escribir = (v) => b.ext.eval(`(() => { const v = ${JSON.stringify(v)}; for (const [i, x] of Object.entries(v)) document.getElementById(i).value = x; })()`);
    const mensaje = async (re) => (await b.ext.waitFor(`(() => { const t = document.querySelector('#adMsg').textContent; return ${re}.test(t) ? t : ''; })()`, 'el mensaje de adaptadores', 15000).catch(() => b.ext.eval(`document.querySelector('#adMsg').textContent`))).split(S).join('');
    await escribir({ adHost: url, adContenedor: '#visor-raro >>', adImagenes: '', adIgnorar: '', adPatron: '' });
    await b.ext.eval(`document.getElementById('adGuardar').click()`);
    eq('opciones: avisa del selector que el navegador no entiende, y no lo guarda',
      `${(await mensaje('/no entiende/')).split(':')[0]} · guardado: ${JSON.stringify((await b.storage('adaptadores')) || {})}`, 'El navegador no entiende este selector · guardado: {}');
    await escribir({ adContenedor: '#visor-raro' });
    await b.ext.eval(`document.getElementById('adProbar').click()`);
    eq('  "Probar en esta página" cuenta lo que encuentra y muestra las primeras 3 direcciones', await mensaje('/Encuentra|No encuentra|No hay|no contestó|inválido/'),
      'Encuentra 6 imágenes en /fx/raro.html. Las primeras: /fx/img/comun/p1.jpg · /fx/img/comun/p2.jpg · /fx/img/comun/p3.jpg');
    await b.ext.eval(`document.getElementById('adGuardar').click()`);
    await mensaje('/Guardado/');
    const g = ((await b.storage('adaptadores')) || {})[HOST] || {};
    eq('  al guardar queda por sitio, y aparece en la lista', `contenedor ${g.contenedor} · imágenes "${g.imagenes}" · ignorar ${JSON.stringify(g.ignorar)} · patrón "${g.patron}" · ${await b.ext.eval(`document.querySelector('#adLista .s-nombre')?.textContent + ' → ' + document.querySelector('#adLista .s-datos')?.textContent`)}`,
      'contenedor #visor-raro · imágenes "" · ignorar [] · patrón "" · 127.0.0.1 → contenedor: #visor-raro');
    await pg.close();
    await b.ext.eval(`chrome.storage.local.remove('adaptadores')`);
  },

  // ═══ 7b. Páginas dibujadas de fondo (2.11.3) ═══
  async fondos({ b, S, eq }) {
    console.log('\n── 2.11.3 · Páginas dibujadas de fondo: background-image, image-set(), SVG y un lector de fondo en un iframe');
    await b.ext.eval(`chrome.storage.local.remove('adaptadores')`);
    // Las miniaturas del diálogo (sin tildar: con un "-" adelante) y lo que dice
    const MINIS = `[...document.querySelectorAll('#mr-save .mr-thumb')].map(t => (t.classList.contains('on') ? '' : '-') + t.querySelector('img').src.replace(location.origin, '').replace('/fx/img/numerada/', '')).join(' ')`;
    const CUENTA = `document.querySelector('#mr-save-count').textContent`;
    const AVISO = `document.querySelector('#mr-save-warn-text').textContent`;
    const LISTO = `!!document.querySelector('#mr-save-count') && !/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`;
    const abrir = async (url, extra = 'true') => {
      const pg = await b.cdp.open(url);
      await pg.waitFor(`document.readyState === 'complete' && [...document.images].every(i => i.complete) && (${extra})`, 'la página', 30000);
      await sleep(600);
      return pg;
    };

    // 1) 8 páginas de fondo entre 18 tapas sueltas
    const u1 = S + '/fx/fondo.html';
    let pg = await abrir(u1);
    const burbuja = await pg.waitFor(`!!document.querySelector('#mr-fab')`, 'la burbuja', 12000).then(() => 'aparece', () => 'no aparece');
    await pedir(b, u1, 'save');
    await pg.waitFor(LISTO, 'el diálogo', 40000);
    eq('8 páginas numeradas de fondo y 18 tapas alrededor: aparece la burbuja, y en el diálogo entran las 8, en orden, sin ninguna tapa',
      `burbuja: ${burbuja} · ${await pg.eval(MINIS)}`, 'burbuja: aparece · 1.png 2.png 3.png 4.png 5.png 6.png 7.png 8.png');
    eq('  el diálogo dice que son páginas dibujadas de fondo, con la salida al adaptador',
      `${(await pg.eval(CUENTA)).split(' · ').slice(0, 2).join(' · ')} · ${/páginas dibujadas de fondo: si no son las del capítulo, decí dónde están con un adaptador/.test(await pg.eval(AVISO))}`,
      '8 de 8 páginas · páginas dibujadas de fondo · true');
    await pg.eval(`document.querySelector('#mr-save-go').click()`);
    const pdf1 = path.join(b.dl, 'MangaReader', 'Serie Fondo', 'Serie Fondo 0003.pdf');
    const hay1 = await pdfDe(pdf1, 30000);
    eq('  y el PDF tiene las 8, en ese orden (el ancho de cada página dice cuál es)', `${hay1.split(' × ')[0]} · ${fs.existsSync(pdf1) ? ordenNumerado(pdf1) : hay1}`, '8 · 1,2,3,4,5,6,7,8');
    await pg.close();
    // Las mismas 8, con las 18 tapas como tarjetas de fondo (9 juntas arriba: más que las páginas)
    const u1b = u1 + '?tapasDeFondo=1';
    pg = await abrir(u1b);
    await pedir(b, u1b, 'save');
    await pg.waitFor(LISTO, 'el diálogo', 40000);
    eq('  y si las tapas también son de fondo (tarjetas con link a otras obras), lo mismo: las 8, en orden, sin ninguna tapa', await pg.eval(MINIS), '1.png 2.png 3.png 4.png 5.png 6.png 7.png 8.png');
    await pg.close();

    // 2) image-set(), un SVG con <image>, una regla con ::before y un relleno data:
    const u2 = S + '/fx/fondo-set.html';
    pg = await abrir(u2);
    await pedir(b, u2, 'save');
    await pg.waitFor(LISTO, 'el diálogo', 40000);
    eq('image-set() (la de 2x), un SVG con dos <image> y una regla con ::before: las 5, en orden, y sin el relleno data: de un píxel',
      await pg.eval(MINIS), '1.png?d=2x 2.png?d=2x 3.png 4.png 5.png');
    await pg.eval(`document.querySelector('#mr-save-go').click()`);
    const pdf2 = path.join(b.dl, 'MangaReader', 'Serie Conjunto', 'Serie Conjunto 0002.pdf');
    const hay2 = await pdfDe(pdf2, 30000);
    eq('  y se guardan las 5', `${hay2.split(' × ')[0]} · ${fs.existsSync(pdf2) ? ordenNumerado(pdf2) : hay2}`, '5 · 1,2,3,4,5');
    await pg.close();

    // 3) Solo degradés
    const u3 = S + '/fx/fondo-degrade.html';
    pg = await abrir(u3);
    await sleep(2500);
    const sinBurbuja = !(await pg.eval(`!!document.querySelector('#mr-fab')`));
    await pedir(b, u3, 'save');
    await pg.waitFor(LISTO, 'el diálogo', 40000);
    eq('una página con solo degradés: ni burbuja ni páginas, y no deja guardar',
      `burbuja: ${sinBurbuja ? 'no' : 'sí'} · ${await pg.eval(CUENTA)} · miniaturas: ${await pg.eval(`document.querySelectorAll('#mr-save .mr-thumb').length`)} · Guardar ${await pg.eval(`document.querySelector('#mr-save-go').disabled ? 'apagado' : 'prendido'`)}`,
      'burbuja: no · No encontré páginas · bajá hasta el final del capítulo · miniaturas: 0 · Guardar apagado');
    await pg.close();
    // La portada de un sitio hecha con tarjetas de fondo (12 tapas con link, un logo y un héroe, sin <img>)
    const u3b = S + '/fx/fondo-catalogo.html';
    pg = await abrir(u3b);
    await sleep(2500);
    const sinBurbuja2 = !(await pg.eval(`!!document.querySelector('#mr-fab')`));
    await pedir(b, u3b, 'save');
    await pg.waitFor(LISTO, 'el diálogo', 40000);
    eq('la portada de un sitio con las tapas de fondo, un logo y un héroe: ni burbuja ni páginas (las tapas no son un lector)',
      `burbuja: ${sinBurbuja2 ? 'no' : 'sí'} · ${await pg.eval(CUENTA)} · miniaturas: ${await pg.eval(`document.querySelectorAll('#mr-save .mr-thumb').length`)} · Guardar ${await pg.eval(`document.querySelector('#mr-save-go').disabled ? 'apagado' : 'prendido'`)}`,
      'burbuja: no · No encontré páginas · bajá hasta el final del capítulo · miniaturas: 0 · Guardar apagado');
    await pg.close();

    // 4) Como Issuu: 18 tapas en la página y el lector de fondo en un iframe del mismo sitio
    const DIALOGO = `() => { const ui = ${UI}; const d = ui.querySelector('#mr-save'); return { dialogo: !!d,
      minis: d ? [...ui.querySelectorAll('#mr-save .mr-thumb')].map(t => (t.classList.contains('on') ? '' : '-') + t.querySelector('img').src.replace(location.origin, '').replace('/fx/img/numerada/', '').replace(/^blob:.*/, 'blob')).join(' ') : '',
      cuenta: ui.querySelector('#mr-save-count')?.textContent || '', listo: !!d && !/Recorriendo|Buscando/.test(ui.querySelector('#mr-save-count')?.textContent || '') }; }`;
    const marco = async (consulta) => {
      const url = S + '/fx/fondo-marco.html' + consulta;
      const p = await abrir(url);
      // que el iframe ya haya pintado sus dos páginas (si hay iframe)
      if (!/sinlector/.test(consulta)) await esperarMarcos(b, url, `() => [...document.querySelectorAll('section.page')].filter(s => /url\\(/.test(getComputedStyle(s).backgroundImage)).length`, r => r[1] === 2, 15000);
      await sleep(800);
      await pedir(b, url, 'save');
      const r = await esperarMarcos(b, url, DIALOGO, rr => rr.some(m => m?.listo), 40000);
      const d = r.find(m => m?.dialogo) || {};
      await p.close();
      return `${donde(r, 'dialogo')} · ${d.minis || 'sin miniaturas'} · ${d.cuenta || ''}`;
    };
    const issuu = await marco('');
    eq('como Issuu (18 tapas arriba, el lector de fondo en un iframe del mismo sitio): el diálogo se abre en el iframe con sus 2 páginas, sin ninguna tapa',
      issuu.split(' · ').slice(0, 3).join(' · '), 'página: no · iframe: sí · 1.png 2.png');
    const bloqueado = await marco('?blob=1');
    eq('  si el lector pinta las páginas con blob: (no se pueden bajar): no ofrece las tapas y dice que no encontró páginas',
      bloqueado, 'página: sí · iframe: no · sin miniaturas · No encontré páginas del capítulo en esta página. El lector las dibuja de fondo y no se pudieron leer.');
    const temprano = await marco('?sinlector=1');
    eq('  y si se abre antes de que cargue el lector (solo están las tapas, cada una lleva a otra página): tampoco las ofrece',
      temprano.replace(/(-\/fx\/img\/doc\d+\/jpg\/page_1_thumb_large\.jpg ?)+/, (m) => `${m.trim().split(' ').length} tapas sin tildar `), 'página: sí · 18 tapas sin tildar · No encontré páginas del capítulo en esta página. Lo que hay son tapas que llevan a otras páginas del sitio.');

    // 5) El adaptador puede pedir los fondos aunque haya <img> que armen un capítulo
    const u5 = S + '/fx/fondo-adaptador.html';
    const conAdaptador = async (adaptador) => {
      await b.setStorage({ adaptadores: adaptador ? { '127.0.0.1': adaptador } : {} });
      const p = await abrir(u5);
      await pedir(b, u5, 'save');
      await p.waitFor(LISTO, 'el diálogo', 40000);
      const m = (await p.eval(MINIS)).replace(/\/fx\/img\/grilla\//g, 'g');
      await p.close();
      return m;
    };
    eq('seis <img> en una carpeta y cuatro páginas de fondo: sin adaptador mandan las <img>; con uno que pide los fondos (#lector), las de fondo',
      `${await conAdaptador(null)} → ${await conAdaptador({ contenedor: '#lector', imagenes: '', ignorar: [], patron: '', fondos: true })}`,
      'g1.jpg g2.jpg g3.jpg g4.jpg g5.jpg g6.jpg → 1.png 2.png 3.png 4.png');
    await b.ext.eval(`chrome.storage.local.remove('adaptadores')`);

    // 6) Un lote en un sitio que arma la página con JavaScript: tres banners de fondo numerados desde
    //    el principio y las 6 páginas <img> recién a los 3 s. Las páginas son las <img>: el lote no
    //    da el capítulo por armado con los banners, ni los guarda.
    const pl = await abrirLote(b, S + '/fx/tarde/?caps=2', 2);
    await pl.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    const finTarde = String(await lote.fin(pl, 120000).catch(e => e.message)).split('\n')[0];
    await pl.close();
    const pdfTarde = (k) => path.join(b.dl, 'MangaReader', 'Serie Tarde', `Serie Tarde ${String(k).padStart(4, '0')}.pdf`);
    eq('un lote donde las 6 páginas <img> aparecen a los 3 s y hay tres banners de fondo numerados desde el principio: se guardan las páginas, no los banners',
      `${finTarde} · ${await pdfDe(pdfTarde(1), 20000)} · ${await pdfDe(pdfTarde(2), 20000)}`, '✅ Listo: 2 capítulos guardados · 6 × 420x640 · 6 × 420x640');

    // 7) La casilla de opciones
    await b.ext.eval(`location.reload()`);
    await b.ext.waitFor(`document.readyState === 'complete' && !!document.querySelector('#adFondos')`, 'la casilla de fondos en opciones');
    await b.ext.eval(`(() => { document.getElementById('adHost').value = 'revista.com'; document.getElementById('adContenedor').value = '#reader'; document.getElementById('adFondos').checked = true; document.getElementById('adGuardar').click(); })()`);
    await b.ext.waitFor(`/Guardado/.test(document.querySelector('#adMsg').textContent)`, 'el guardado del adaptador', 15000).catch(() => {});
    const guardado = ((await b.storage('adaptadores')) || {})['revista.com'] || {};
    eq('opciones: "Las páginas están dibujadas de fondo" se guarda con el adaptador y aparece en la lista',
      `fondos: ${guardado.fondos} · ${await b.ext.eval(`[...document.querySelectorAll('#adLista .s-datos')].map(s => s.textContent).join(' | ')`)}`,
      'fondos: true · contenedor: #reader · páginas dibujadas de fondo');
    await b.ext.eval(`chrome.storage.local.remove('adaptadores')`);
  },

  // ═══ 7b. Un 503 en las imágenes que carga la página del capítulo (2.11.4) ═══
  async imagenes({ b, S, eq, estado }) {
    console.log('\n── 2.11.4 · Un 503 en las imágenes que carga la página, el tercer intento, la notificación y un lector de una página por vez');
    const pdf = (serie, n) => path.join(b.dl, 'MangaReader', serie, `${serie} ${String(n).padStart(4, '0')}.pdf`);
    const horas = (u) => estado.horas[u] || [];
    const seg = (ms) => (Number.isFinite(ms) ? (ms / 1000).toFixed(1).replace('.', ',') + ' s' : 'no llegó');
    // La imagen la pidió la página (o la extensión al medirla), no el armador al guardarla (ese pide "image/*")
    const deLaPagina = (req) => req.headers.accept !== 'image/*';
    const ESTADO = `document.querySelector('#mr-chapter-status')?.textContent || ''`;
    const FIN = /^(✅ )?(Listo|Cancelado|Parado)/;
    // Sigue el estado del diálogo de varios capítulos hasta que termina un lote (uno nuevo: si ya
    // mostraba el final de otro, espera a que cambie) y anota la primera cuenta regresiva que ve
    const seguir = async (pg, antes = '') => {
      let cuenta = '', fin = '', cambio = !antes;
      for (const hasta = Date.now() + 180000; Date.now() < hasta && !fin; await sleep(120)) {
        const t = await pg.eval(ESTADO).catch(() => '');
        if (t !== antes) cambio = true;
        if (!cuenta && /pidió esperar, sigo en/.test(t)) cuenta = t.replace(/\d+ s/, 'N s');
        if (cambio && FIN.test(t)) fin = t;
      }
      return { cuenta, fin };
    };
    const frenado = async () => JSON.stringify((await b.storage('esperaSitio')) || {});
    await b.ext.eval(`chrome.storage.local.remove(['cola', 'esperaSitio', 'avisoBotones'])`);
    // Sin pausa entre capítulos; sin Retry-After, el sitio queda frenado 4 s en vez de un minuto. (Con
    // menos casi no se ve la cuenta regresiva: el freno corre desde la respuesta de la imagen, y el
    // service worker tarda un par de segundos en ver que las páginas dejaron de sumarse.)
    await b.setStorage({ ritmo: { pausa: 0, espera429: 4 } });

    // 0) Lo que el marco le dice al service worker: sus páginas y cuáles cargaron (la 3 respondió 503)
    estado.imagen = (u, req) => (u === '/fx/img/cuenta/1/3.jpg' && deLaPagina(req) ? { status: 503 } : null);
    const uc = S + '/fx/cuenta/leer/1';
    const pc = await b.cdp.open(uc);
    await pc.waitFor(`document.readyState === 'complete' && [...document.images].every(i => i.complete)`, 'el capítulo', 30000);
    await sleep(600);
    const [cuentaDelMarco] = await enMarcos(b, uc, `() => window.__mangaReaderCuenta()`);
    await pc.close();
    const corto = (u) => String(u).replace(/^.*\/fx\/img\/cuenta\/1\//, '');
    eq('lo que el marco le dice al service worker: cuántas páginas cuenta, cuáles son y cuáles cargaron (la 3 respondió 503 y está rota)',
      `${cuentaDelMarco?.n} · ${(cuentaDelMarco?.urls || []).map(corto).join(' ')} · cargadas: ${(cuentaDelMarco?.cargadas || []).map(corto).join(' ')}`,
      '6 · 1.jpg 2.jpg 3.jpg 4.jpg 5.jpg 6.jpg · cargadas: 1.jpg 2.jpg 4.jpg 5.jpg 6.jpg');

    // 1) Una página del capítulo 2 (la 3) responde 503 cuando la carga la página, las dos primeras veces.
    //    Se anota a qué capítulos el service worker les pidió guardar (envolviendo tellTab, que es por
    //    donde lo pide): al 2 no se le tiene que pedir nunca, porque se mira antes.
    let negadas = 0, alArmador = 0;
    estado.imagen = (u, req) => {
      if (!u.startsWith('/fx/img/rota/2/')) return null;
      if (!deLaPagina(req)) { alArmador++; return null; }
      return u === '/fx/img/rota/2/3.jpg' && negadas < 2 ? (negadas++, { status: 503 }) : null;
    };
    await enServicio(b, `(() => { globalThis.__guardar = []; globalThis.__tellTab = tellTab;
      tellTab = (id, m) => { if (m && m.action === 'autoSave') __guardar.push(m.numero); return __tellTab(id, m); }; return true; })()`);
    const pg = await abrirLote(b, S + '/fx/rota/?caps=3', 3);
    await pg.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    const l1 = await seguir(pg);
    const aGuardar = await enServicio(b, `(() => { const g = (globalThis.__guardar || []).slice(); if (globalThis.__tellTab) tellTab = globalThis.__tellTab; return g; })()`).catch(e => ['error: ' + e.message]);
    const h2 = horas('/fx/rota/leer/2'), h3 = horas('/fx/rota/leer/3'), i3 = horas('/fx/img/rota/2/3.jpg');
    eq('una página del capítulo responde 503 cuando la carga la página: el lote no guarda ese capítulo, dice el motivo y sigue con los otros',
      `${l1.cuenta} · ${l1.fin.split('\n').filter(l => /^Listo|Capítulo 2/.test(l)).join(' / ')}`,
      '(2/3) Capítulo 2: el sitio pidió esperar, sigo en N s… · Listo: 2 capítulos guardados · 1 con problemas / Capítulo 2: el sitio pidió esperar (HTTP 503)');
    eq('  no queda nada a medias: no hay archivo del capítulo 2, al marco del 2 nunca se le pidió que guarde (se miró antes: sí a los del 1 y el 3), el armador no pidió ninguna de sus páginas, y queda en la cola para Reintentar',
      `${b.ls('Serie Rota')} · se pidió guardar: ${aGuardar.join(', ')} · pedidos del armador: ${alArmador} · cola: ${colaComo(await b.storage('cola'))}`,
      'Serie Rota 0001.pdf Serie Rota 0003.pdf · se pidió guardar: 1, 3 · pedidos del armador: 0 · cola: 1 listo, 2 fallo (el sitio pidió esperar (HTTP 503)), 3 listo');
    eq(`  el sitio quedó frenado (4 s sin Retry-After en esta prueba): el reintento del lote llegó a los ${seg(h2[1] - i3[0])} del 503 y el capítulo siguiente a los ${seg(h3[0] - i3[1])} del segundo`,
      `${h2[1] - i3[0] >= 4000 ? 'esperó' : 'no esperó'} · ${h3[0] - i3[1] >= 4000 ? 'esperó' : 'no esperó'} · la página 3 se pidió ${i3.length} veces`, 'esperó · esperó · la página 3 se pidió 2 veces');

    // 2) Un tercer intento desde la cola: el capítulo falló dos veces (el intento y el reintento del
    //    lote). "Reintentar" lo vuelve a intentar, y espera lo que el sitio acaba de pedir (3 s)
    await b.setStorage({ esperaSitio: { '127.0.0.1': Date.now() + 3000 } });
    const tocado = Date.now();
    await pg.eval(`document.querySelector('#mr-cola-reintentar').click()`);
    const l2 = await seguir(pg, l1.fin);
    const h2b = horas('/fx/rota/leer/2');
    eq(`un tercer intento desde la cola (Reintentar, después de dos fallas): espera lo que pidió el sitio (el capítulo se pidió a los ${seg(h2b[2] - tocado)} del toque, con 3 s por esperar) y lo baja entero`,
      `${l2.cuenta} · ${h2b.length} pedidos del capítulo · ${h2b[2] - tocado >= 2800 ? 'esperó' : 'no esperó'} · ${l2.fin.split('\n')[0]} · ${await pdfDe(pdf('Serie Rota', 2), 5000)} · cola: ${colaComo(await b.storage('cola'))}`,
      '(1/1) Capítulo 2: el sitio pidió esperar, sigo en N s… · 3 pedidos del capítulo · esperó · ✅ Listo: 1 capítulo guardado · 6 × 420x640 · cola: sin cola');
    await pg.close();

    // 3) El 503 es de un banner de otra carpeta: el capítulo sale entero y el sitio no se frena
    await b.ext.eval(`chrome.storage.local.remove(['cola', 'esperaSitio'])`);
    let banner = 0;
    estado.imagen = (u) => (u === '/fx/img/publicidad/banner.jpg' ? (banner++, { status: 503, headers: { 'Retry-After': '30' } }) : null);
    const pb = await abrirLote(b, S + '/fx/banner/?caps=2', 2);
    await pb.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    const lb = await seguir(pb);
    eq('un banner de otra carpeta responde 503 (con Retry-After: 30) cuando lo carga la página: los capítulos salen enteros y el sitio no queda frenado',
      `${lb.fin.split('\n')[0]} · ${await pdfDe(pdf('Serie Banner', 1), 5000)} · ${await pdfDe(pdf('Serie Banner', 2), 5000)} · el banner se pidió ${banner} veces · frenado: ${await frenado()}`,
      '✅ Listo: 2 capítulos guardados · 6 × 420x640 · 6 × 420x640 · el banner se pidió 2 veces · frenado: {}');
    await pb.close();
    // Lo mismo con las páginas en carga diferida (un marcador de 1×1 y la página en data-src, que
    // nadie cambia en una pestaña de fondo): el banner roto no pasa por el capítulo
    const pd = await abrirLote(b, S + '/fx/diferida/?caps=2', 2);
    await pd.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    const ld = await seguir(pd);
    eq('  y con las páginas en carga diferida (marcador de 1×1, la página en data-src): el banner roto no es el capítulo, que sale entero',
      `${ld.fin.split('\n')[0]} · ${await pdfDe(pdf('Serie Diferida', 1), 5000)} · ${await pdfDe(pdf('Serie Diferida', 2), 5000)} · frenado: ${await frenado()}`,
      '✅ Listo: 2 capítulos guardados · 6 × 420x640 · 6 × 420x640 · frenado: {}');
    await pd.close();

    // 4) Los botones de la notificación, como los toca Chrome: se llama en el service worker al
    //    mismo oyente que llama Chrome (alTocarAviso, con la notificación y el número del botón).
    //    "Reintentar" retoma la cola en la pestaña de la serie con lo mismo que su botón de la ventana
    //    (seguirCola), y espera lo que pidió el sitio.
    await b.ext.eval(`chrome.storage.local.remove(['cola', 'esperaSitio', 'avisoBotones']); chrome.notifications.clear('mr-lote')`);
    let negadasT = 0;
    estado.imagen = (u, req) => (u === '/fx/img/toque/1/2.jpg' && deLaPagina(req) && negadasT < 2 ? (negadasT++, { status: 503 }) : null);
    const pt = await abrirLote(b, S + '/fx/toque/?caps=2', 2);
    await pt.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    const lt = await seguir(pt);
    const avisos = await b.ext.eval(`new Promise(r => chrome.notifications.getAll(n => r(Object.keys(n || {}))))`).catch(() => []);
    const botones1 = (await b.storage('avisoBotones')) || [];
    await b.setStorage({ esperaSitio: { '127.0.0.1': Date.now() + 3000 } });
    const tocadoT = Date.now();
    // (una versión sin alTocarAviso no tiene a quién llamar: se anota y sigue)
    const registrado = await enServicio(b, `(async () => { const es = chrome.notifications.onButtonClicked.hasListener(alTocarAviso); await alTocarAviso('mr-lote', 0); return es; })()`)
      .catch(e => 'error: ' + String(e.message).split('\n')[0]);
    const lt2 = registrado === true ? await seguir(pt, lt.fin) : { cuenta: '', fin: '(no se reintentó)' };
    const ht = horas('/fx/toque/leer/1');
    eq('la notificación del lote que terminó con una falla tiene "Reintentar" y "Mostrar la carpeta"; tocar "Reintentar" (llamando a alTocarAviso como Chrome) retoma la cola en la pestaña de la serie, espera lo que pidió el sitio y baja el capítulo entero',
      `${lt.fin.split('\n')[0]} · aviso: ${avisos.join(',')} [${botones1.join(', ')}] · oyente registrado: ${registrado} · ${lt2.cuenta} · ${ht[2] - tocadoT >= 2800 ? 'esperó' : 'no esperó (' + seg(ht[2] - tocadoT) + ')'} · ${lt2.fin.split('\n')[0]} · ${await pdfDe(pdf('Serie Toque', 1), 5000)}`,
      'Listo: 1 capítulo guardado · 1 con problemas · aviso: mr-lote [reintentar, carpeta] · oyente registrado: true · (1/1) Capítulo 1: el sitio pidió esperar, sigo en N s… · esperó · ✅ Listo: 1 capítulo guardado · 6 × 420x640');
    await sleep(500);
    // La de ese lote ya no tiene fallas: solo "Mostrar la carpeta". Se anota a qué descarga va en vez
    // de abrir el Explorador (mostrarCarpeta es lo único que se cambia, por un momento)
    const carpeta = await enServicio(b, `(async () => {
      const vistas = [], antes = mostrarCarpeta;
      mostrarCarpeta = (id) => { vistas.push(id); };
      try { await alTocarAviso('mr-lote', 0); } finally { mostrarCarpeta = antes; }
      const st = await chrome.storage.local.get(['ultimaDescarga', 'avisoBotones']);
      return { botones: st.avisoBotones || [], vistas, ultima: st.ultimaDescarga ?? null };
    })()`).catch(e => ({ botones: [], vistas: [], ultima: null, error: String(e.message).split('\n')[0] }));
    eq('  la notificación de ese lote ya no tiene fallas y tiene un solo botón: tocarlo muestra la carpeta de la última descarga',
      `[${carpeta.botones.join(', ')}] · ${carpeta.vistas.length === 1 && carpeta.vistas[0] === carpeta.ultima && carpeta.ultima != null ? 'mostró la de la última descarga' : JSON.stringify(carpeta)}`,
      '[carpeta] · mostró la de la última descarga');
    await pt.close();

    // 5) Guardando de a uno no se corta nada: se guarda lo que bajó, con el motivo. La 3 responde 503
    //    cuando la carga la página; además, al armador la 5 le responde 503 la primera vez (con
    //    Retry-After: 1): guardando de a uno eso tampoco frena el sitio
    await b.ext.eval(`chrome.storage.local.remove(['cola', 'esperaSitio']); chrome.notifications.clear('mr-lote')`);
    let alArmador5 = 0;
    estado.imagen = (u, req) => {
      if (u === '/fx/img/suelto/1/3.jpg' && deLaPagina(req)) return { status: 503 };
      if (u === '/fx/img/suelto/1/5.jpg' && !deLaPagina(req) && !alArmador5++) return { status: 503, headers: { 'Retry-After': '1' } };
      return null;
    };
    const us = S + '/fx/suelto/leer/1';
    const ps = await b.cdp.open(us);
    await ps.waitFor(`document.readyState === 'complete' && [...document.images].every(i => i.complete)`, 'el capítulo', 30000);
    await pedir(b, us, 'save');
    await ps.waitFor(`document.querySelectorAll('#mr-save .mr-thumb').length >= 5 && !/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`, 'el diálogo', 40000);
    await sleep(800);
    const aviso = await ps.eval(`document.querySelector('#mr-save-warn-text').textContent`);
    await ps.eval(`document.querySelector('#mr-save-go').click()`);
    await ps.waitFor(`/success|error/.test(document.querySelector('#mr-save-status').className)`, 'el guardado', 60000);
    const resultado = await ps.eval(`document.querySelector('#mr-save-status').textContent`);
    const anotado = Object.values((await b.storage('savedChapters')) || {}).some(v => /\/fx\/suelto\/leer\/1$/.test(v.url || ''));
    eq('guardando de a uno: una página no cargó porque el sitio pidió esperar; el diálogo lo dice, se guarda lo que bajó con el motivo, no queda anotado como guardado, y el sitio no se frena (eso es de los lotes; tampoco con el 503 que recibió el armador)',
      `${aviso.split(' · ')[0]} · ${await pdfDe(pdf('Serie Suelto', 1), 5000)} · ${resultado.split('\n').filter(l => /no cargó|no lo marqué/.test(l)).join(' / ')} · anotado: ${anotado} · el armador pidió la 5 ${alArmador5} veces · frenado: ${await frenado()}`,
      '⚠️ 1 página no cargó: el sitio pidió esperar (HTTP 503) · 5 × 420x640 · ⚠️ 1 página del capítulo no cargó (el sitio pidió esperar: HTTP 503) / ⚠️ Faltaron páginas: no lo marqué como guardado. Probá guardarlo de nuevo. · anotado: false · el armador pidió la 5 2 veces · frenado: {}');
    await ps.close();
    estado.imagen = null;

    // 6) Un lector de fondo que muestra una página por vez (como Issuu): el diálogo lo dice. Un
    //    capítulo de una sola página <img>, no.
    const DIALOGO = `() => { const ui = ${UI}; const d = ui.querySelector('#mr-save');
      return { dialogo: !!d, cuenta: ui.querySelector('#mr-save-count')?.textContent || '', listo: !!d && !/Recorriendo|Buscando/.test(ui.querySelector('#mr-save-count')?.textContent || '') }; }`;
    const ue = S + '/fx/fondo-marco.html?una=1';
    const pe = await b.cdp.open(ue);
    await pe.waitFor(`document.readyState === 'complete'`, 'la página', 30000);
    await esperarMarcos(b, ue, `() => [...document.querySelectorAll('section.page')].filter(s => /url\\(/.test(getComputedStyle(s).backgroundImage)).length`, r => r[1] === 1, 15000);
    await sleep(800);
    await pedir(b, ue, 'save');
    const re = await esperarMarcos(b, ue, DIALOGO, rr => rr.some(m => m?.listo), 40000);
    const de = re.find(m => m?.dialogo) || {};
    await pe.close();
    const uu = S + '/fx/unica/leer/1?pags=1';
    const pu = await b.cdp.open(uu);
    await pu.waitFor(`document.readyState === 'complete' && [...document.images].every(i => i.complete)`, 'el capítulo', 30000);
    await pedir(b, uu, 'save');
    await pu.waitFor(`document.querySelectorAll('#mr-save .mr-thumb').length >= 1 && !/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`, 'el diálogo', 40000);
    const cu = await pu.eval(`document.querySelector('#mr-save-count').textContent`);
    await pu.close();
    eq('un lector de fondo con una sola página a la vista: el diálogo dice que muestra una por vez y que se guarda la que está a la vista; un capítulo de una sola página <img> no lo dice',
      `${(de.cuenta || 'sin diálogo').split(' · ').slice(0, 3).join(' · ')} | ${cu.split(' · ').slice(0, 2).join(' · ')}`,
      '1 de 1 páginas · páginas dibujadas de fondo · el lector muestra una página por vez: se guarda la que está a la vista | 1 de 1 páginas · clic en una miniatura para incluirla o quitarla');
    // Un lector de fondo de dos páginas al que le falla una (responde 503): no es "una por vez", y el
    // diálogo dice que una no cargó y por qué
    estado.imagen = (u, req) => (u === '/fx/img/numerada/2.png' && deLaPagina(req) ? { status: 503 } : null);
    const DIALOGO2 = `() => { const ui = ${UI}; const d = ui.querySelector('#mr-save');
      return { dialogo: !!d, cuenta: ui.querySelector('#mr-save-count')?.textContent || '', aviso: ui.querySelector('#mr-save-warn-text')?.textContent || '',
        listo: !!d && !/Recorriendo|Buscando/.test(ui.querySelector('#mr-save-count')?.textContent || '') }; }`;
    const uf = S + '/fx/fondo-marco.html';
    const pf = await b.cdp.open(uf);
    await pf.waitFor(`document.readyState === 'complete'`, 'la página', 30000);
    await esperarMarcos(b, uf, `() => [...document.querySelectorAll('section.page')].filter(s => /url\\(/.test(getComputedStyle(s).backgroundImage)).length`, r => r[1] === 2, 15000);
    await sleep(800);
    await pedir(b, uf, 'save');
    const rf = await esperarMarcos(b, uf, DIALOGO2, rr => rr.some(m => m?.listo), 40000);
    const df = rf.find(m => m?.dialogo) || {};
    await pf.close();
    estado.imagen = null;
    eq('  un lector de fondo de dos páginas al que le falló una (503): no dice "una por vez", y avisa que una no cargó y por qué',
      `${(df.cuenta || 'sin diálogo').split(' · ').slice(0, 2).join(' · ')} · una por vez: ${/una página por vez/.test(df.cuenta || '')} · ${(df.aviso || '').split(' · ')[0]}`,
      '1 de 1 páginas · páginas dibujadas de fondo · una por vez: false · ⚠️ 1 página no cargó: el sitio pidió esperar (HTTP 503)');

    await b.ext.eval(`chrome.storage.local.remove(['cola', 'esperaSitio', 'ritmo', 'avisoBotones']); chrome.notifications.clear('mr-lote')`);
  },

  // ═══ 8. Carpeta base de las descargas ═══
  async carpeta({ b, S, eq }) {
    console.log('\n── 2.11 · Carpeta base de las descargas');
    await b.ext.eval(`chrome.storage.local.remove('carpetaBase')`);
    await b.ext.eval(`location.reload()`);
    await b.ext.waitFor(`document.readyState === 'complete' && !!document.querySelector('#carpetaGuardar') && document.querySelector('#carpetaBase').value !== ''`, 'la carpeta en opciones');
    const escribir = (v) => b.ext.eval(`(() => { const c = document.getElementById('carpetaBase'); c.value = ${JSON.stringify(v)}; c.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const ver = () => b.ext.eval(`document.getElementById('carpetaVista').textContent + ' · ' + document.getElementById('carpetaMsg').textContent`);
    eq('opciones: sin nada guardado, la carpeta de siempre', await b.ext.eval(`document.getElementById('carpetaBase').value + ' → ' + document.getElementById('carpetaVista').textContent`), 'MangaReader → Descargas/MangaReader/…');
    await escribir('Manga/{sitio}/{serie}');
    eq('  al escribir "Manga/{sitio}/{serie}" muestra cómo quedaría', await ver(), 'Descargas/Manga/sitio.com/One Piece/… · ');
    await b.ext.eval(`document.getElementById('carpetaGuardar').click()`);
    await b.ext.waitFor(`/guardada/.test(document.getElementById('carpetaMsg').textContent)`, 'el guardado de la carpeta');
    eq('  y se guarda', await b.storage('carpetaBase'), 'Manga/{sitio}/{serie}');

    const guardarCapitulo = async (n) => {
      const url = `${S}/fx/base/leer/${n}`;
      const pg = await b.cdp.open(url);
      await pg.waitFor(`document.readyState === 'complete'`, 'el capítulo');
      await pedir(b, url, 'save');
      await pg.waitFor(`document.querySelectorAll('#mr-save .mr-thumb.on').length >= 6 && !/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`, 'el diálogo', 30000);
      const destino = (await pg.eval(`document.querySelector('#mr-save-dest').textContent`)).split('\n')[0];
      await pg.eval(`document.querySelector('#mr-save-go').click()`);
      await pg.waitFor(`/success|error/.test(document.querySelector('#mr-save-status').className)`, 'el guardado', 60000);
      const estado = (await pg.eval(`document.querySelector('#mr-save-status').className`)).replace('mr-save-status ', '');
      await pg.close();
      return { destino, estado };
    };
    const uno = await guardarCapitulo(1);
    eq('con esa carpeta, el capítulo queda en Manga/<sitio>/<serie>/…, y el diálogo ya lo decía',
      `${await pdfDe(path.join(b.dl, 'Manga', '127.0.0.1', 'Serie Base', 'Serie Base', 'Serie Base 0001.pdf'), 5000)} · ${uno.destino}`,
      '6 × 420x640 · 📄 Descargas/Manga/127.0.0.1/Serie Base/Serie Base/Serie Base 0001.pdf');

    await escribir('../x');
    eq('"../x": la página de opciones avisa', (await ver()).replace(/^ · /, '').split(':')[0], '⚠️ No puede llevar ".." ni "."');
    await b.ext.eval(`document.getElementById('carpetaGuardar').click()`);
    await b.ext.waitFor(`/No la guardé/.test(document.getElementById('carpetaMsg').textContent)`, 'el aviso');
    eq('  y no la guarda: sigue la de antes', await b.storage('carpetaBase'), 'Manga/{sitio}/{serie}');
    await b.setStorage({ carpetaBase: '../x' });            // como si llegara mal desde una copia importada
    const dos = await guardarCapitulo(2);
    eq('  y si igual llega mal escrita, guardar no se rompe: va a la carpeta de siempre',
      `${dos.estado} · ${await pdfDe(path.join(b.dl, 'MangaReader', 'Serie Base', 'Serie Base 0002.pdf'), 5000)}`, 'success · 6 × 420x640');
    await b.ext.eval(`chrome.storage.local.remove('carpetaBase')`);
  },

  // ═══ 9. Pegar links: sin los ya guardados, y con el orden a elección ═══
  async pegar({ b, S, eq }) {
    console.log('\n── 2.11 · Pegar links: descarta los ya guardados, ordena e invierte');
    // Ya están guardados el 2 y el 4 de la serie
    const antes = (await b.storage('savedChapters')) || {};
    for (const n of [2, 4]) antes[`Serie Pegar/Serie Pegar 000${n}`] = { ts: Date.now(), pages: 6, url: `${S}/fx/pegar/leer/${n}` };
    await b.setStorage({ savedChapters: antes });
    const url = S + '/fx/hostil.html';                      // una página cualquiera: los capítulos salen de lo que se pega
    const pg = await b.cdp.open(url);
    await pg.waitFor(`document.readyState === 'complete'`, 'la página');
    await pedir(b, url, 'batch');
    await pg.waitFor(`!!document.querySelector('#mr-chapter-links-go')`, 'el diálogo de varios capítulos');
    const pegado = [5, 3, 1, 4, 2].map(n => `${S}/fx/pegar/leer/${n}`).join('\n');
    await pg.eval(`(() => { document.querySelector('#mr-chapter-links').value = ${JSON.stringify(pegado)}; document.querySelector('#mr-chapter-links-go').click(); })()`);
    const FILAS = `[...document.querySelectorAll('#mr-chapter .mr-chapter-item .mr-chapter-n')].map(n => n.textContent).join(',')`;
    eq('pegar 5 links desordenados con 2 ya guardados: quedan 3, ordenados', await pg.eval(FILAS), '1,3,5');
    eq('  y el aviso dice que descartó 2', (await pg.eval(`document.querySelector('#mr-chapter-links-msg').textContent`)).match(/\d+ descartados? porque ya l[oa]s? tenías guardados?/)?.[0] || '(no lo dice)',
      '2 descartados porque ya los tenías guardados');
    // (2.11.1) Con "Saltear los que ya guardé" destildado los querés bajar de nuevo: entran todos
    const pegar = (saltear) => pg.eval(`(() => { const s = document.querySelector('#mr-chapter-skip'); if (s.checked !== ${saltear}) s.click();
      document.querySelector('#mr-chapter-links').value = ${JSON.stringify(pegado)}; document.querySelector('#mr-chapter-links-go').click(); })()`);
    await pegar(false);
    eq('con "Saltear los que ya guardé" destildado, los ya guardados entran igual: van los 5', `${await pg.eval(FILAS)} · ${await pg.eval(`document.querySelector('#mr-chapter-go').textContent`)}`, '1,2,3,4,5 · Descargar 5 capítulos');
    const dicho = await pg.eval(`document.querySelector('#mr-chapter-links-msg').textContent`);
    eq('  y no aparece el aviso de descartados', /descartad/.test(dicho) ? dicho : 'sin aviso: ' + dicho.split('.')[0], 'sin aviso: Tomé 5 links: capítulos 1 a 5, con el número que trae cada link');
    await pegar(true);                                      // tildada de nuevo, como estaba
    eq('  al tildarla otra vez vuelven a quedar afuera', await pg.eval(FILAS), '1,3,5');
    await pg.eval(`document.querySelector('#mr-chapter-invertir').click()`);
    eq('Invertir da vuelta la lista (se baja primero lo de arriba)', await pg.eval(FILAS), '5,3,1');
    await pg.eval(`document.querySelector('#mr-chapter-ordenar').click()`);
    eq('Ordenar por número la deja del más bajo al más alto', await pg.eval(FILAS), '1,3,5');
    // Invertida, se baja en ese orden: el 5 queda guardado antes que el 1
    await b.setStorage({ ritmo: { pausa: 0 } });
    await pg.eval(`document.querySelector('#mr-chapter-invertir').click(); document.querySelector('#mr-chapter-serie').value = 'Serie Pegar'; document.querySelector('#mr-chapter-go').click()`);
    const fin = await lote.fin(pg, 180000).catch(e => e.message);
    const reg = (await b.storage('savedChapters')) || {};
    const cuando = (n) => reg[`Serie Pegar/Serie Pegar 000${n}`]?.ts || 0;
    eq('  y el lote baja en el orden de la lista', `${String(fin).split('\n')[0]} · ${cuando(5) && cuando(5) < cuando(3) && cuando(3) < cuando(1) ? '5, 3, 1' : 'otro orden'}`, '✅ Listo: 3 capítulos guardados · 5, 3, 1');
    await pg.close();
    await b.ext.eval(`chrome.storage.local.remove(['cola', 'ritmo'])`);
  },

  // ═══ 10. Teclado y accesibilidad ═══
  async teclado({ b, S, eq }) {
    console.log('\n── 2.11 · Teclado y accesibilidad de los diálogos');
    const url = S + '/fx/teclado/leer/1?pags=3';
    const pg = await b.cdp.open(url);
    await pg.waitFor(`document.readyState === 'complete' && document.images.length >= 3`, 'el capítulo');
    await pg.eval(`document.getElementById('antes').focus()`);
    // (Alt+S es un atajo del navegador y no se puede apretar desde acá: se pide lo mismo que pide el atajo)
    await pedir(b, url, 'save');
    await pg.waitFor(`document.querySelectorAll('#mr-save .mr-thumb.on').length >= 3 && !/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`, 'el diálogo', 30000);
    // El foco, mirado desde la página y adentro del shadow root
    const FOCO = `(() => { const a = document.activeElement, d = a && a.shadowRoot ? a.shadowRoot.activeElement : a;
      return !d ? 'nada' : d.classList?.contains('mr-thumb') ? 'miniatura ' + (+d.dataset.i + 1) : (d.id || d.tagName.toLowerCase()); })()`;
    eq('el diálogo se anuncia como diálogo, con nombre, y toma el foco',
      await pg.eval(`(() => { const d = document.querySelector('#mr-save'); return [d.getAttribute('role'), d.getAttribute('aria-modal'), d.getAttribute('aria-label')].join(' · '); })()`) + ' · foco en ' + await pg.eval(FOCO),
      'dialog · true · Guardar capítulo · foco en mr-save-name');
    eq('  todos sus controles tienen un nombre que se pueda leer', await pg.eval(`(() => { const r = ${RAIZ}.querySelector('#mr-save');
      const sinNombre = [...r.querySelectorAll('button, input, select, textarea')].filter(e => !(e.getAttribute('aria-label') || e.textContent.trim() || (e.id && r.querySelector('label[for="' + e.id + '"]')) || e.closest('label')));
      return sinNombre.length ? sinNombre.map(e => e.id || e.className).join(',') : 'todos'; })()`), 'todos');
    await pg.tecla('Tab', 8);                               // Mayús+Tab desde el primer control
    const ultimo = await pg.eval(FOCO);
    for (let i = 0; i < 30; i++) await pg.tecla('Tab');
    eq('el foco no se sale del diálogo: Mayús+Tab en el primero va al último, y con 30 Tab sigue adentro',
      `${ultimo !== 'mr-save-name' && ultimo !== 'antes' ? 'va al último' : 'quedó en ' + ultimo} · ${await pg.eval(`document.activeElement.id === 'mr-host' && !!document.activeElement.shadowRoot.activeElement?.closest('#mr-save')`) ? 'adentro' : 'afuera: ' + await pg.eval(FOCO)}`,
      'va al último · adentro');
    await pg.eval(`document.querySelector('#mr-save .mr-thumb[data-i="0"]').focus()`);
    const paso = [await pg.eval(FOCO)];
    for (let i = 0; i < 2; i++) { await pg.tecla('ArrowRight'); paso.push(await pg.eval(FOCO)); }
    eq('las flechas recorren las miniaturas', paso.join(' → '), 'miniatura 1 → miniatura 2 → miniatura 3');
    await pg.tecla(' ');
    eq('la barra espaciadora quita la que tiene el foco (y lo dice: aria-pressed)',
      await pg.eval(`[...document.querySelectorAll('#mr-save .mr-thumb')].map(t => (t.classList.contains('on') ? 'sí' : 'no') + '/' + t.getAttribute('aria-pressed')).join(' ')`), 'sí/true sí/true no/false');
    await pg.tecla('ArrowLeft');
    await pg.tecla('Home');
    eq('  flecha izquierda e Inicio también', await pg.eval(FOCO), 'miniatura 1');
    await pg.tecla('Escape');
    eq('Esc cierra el diálogo y el foco vuelve a donde estaba en la página', `${await pg.eval(`!document.querySelector('#mr-save')`) ? 'cerrado' : 'abierto'} · foco en ${await pg.eval(FOCO)}`, 'cerrado · foco en antes');

    // El de varios capítulos
    await pedir(b, url, 'batch');
    await pg.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo de varios capítulos');
    for (let i = 0; i < 40; i++) await pg.tecla('Tab');
    eq('el diálogo de varios capítulos: también es un diálogo con nombre y atrapa el foco',
      await pg.eval(`(() => { const d = document.querySelector('#mr-chapter'); return [d.getAttribute('role'), d.getAttribute('aria-modal'), d.getAttribute('aria-label')].join(' · ') + ' · ' +
        (document.activeElement.id === 'mr-host' && !!document.activeElement.shadowRoot.activeElement?.closest('#mr-chapter') ? 'foco adentro' : 'foco afuera'); })()`),
      'dialog · true · Descargar varios capítulos · foco adentro');
    await pg.tecla('Escape');
    eq('  y al cerrarlo con Esc el foco vuelve', `${await pg.eval(`!document.querySelector('#mr-chapter')`) ? 'cerrado' : 'abierto'} · foco en ${await pg.eval(FOCO)}`, 'cerrado · foco en antes');
    await pg.close();
  },

  // ═══ Menores: el registro en CSV, cuánto va a ocupar un lote y el aviso de versión nueva ═══
  async menores({ b, S, eq }) {
    console.log('\n── 2.11 · Menores: CSV del registro, tamaño estimado de un lote y versión nueva');
    // La estimación promedia lo ya guardado de ese sitio, y las otras áreas guardaron capítulos del
    // mismo sitio de prueba: se arranca con el registro vacío para que no dependa de cuáles corrieron antes
    await b.setStorage({ savedChapters: {} });
    // Al guardar un capítulo queda anotado cuánto pesó
    const url = S + '/fx/peso/leer/1';
    const pg = await b.cdp.open(url);
    await pg.waitFor(`document.readyState === 'complete'`, 'el capítulo');
    await pedir(b, url, 'save');
    await pg.waitFor(`document.querySelectorAll('#mr-save .mr-thumb.on').length >= 6 && !/Recorriendo|Buscando/.test(document.querySelector('#mr-save-count').textContent)`, 'el diálogo', 30000);
    await pg.eval(`document.querySelector('#mr-save-go').click()`);
    await pg.waitFor(`/success|error/.test(document.querySelector('#mr-save-status').className)`, 'el guardado', 60000);
    await pg.close();
    let reg = (await b.storage('savedChapters')) || {};
    eq('al guardar un capítulo queda anotado cuánto pesó', typeof reg['Serie Peso/Serie Peso 0001']?.kb === 'number' && reg['Serie Peso/Serie Peso 0001'].kb > 0, true);

    // Con eso se estima un lote antes de bajarlo
    const estimacion = async () => {
      const lp = await abrirLote(b, S + '/fx/peso/', 4);
      await lp.eval(`document.querySelector('#mr-chapter-all').click()`);
      const t = await lp.eval(`(() => { const p = document.querySelector('#mr-chapter-peso'); return p.hidden ? 'sin estimación' : p.textContent; })()`);
      await lp.close();
      return t;
    };
    const kb = reg['Serie Peso/Serie Peso 0001'].kb;
    eq('el diálogo de varios capítulos estima cuánto va a ocupar lo que falta (3 capítulos, como el que ya se guardó)',
      (await estimacion()).replace(/unos [\d,.]+ (KB|MB|GB)/, 'unos N'), 'Van a ocupar unos N (según 1 capítulo ya guardado).');
    reg['Serie Peso/Serie Peso 0001'].kb = 120 * 1024;       // como si cada capítulo pesara 120 MB
    await b.setStorage({ savedChapters: reg });
    eq('  y si pasa de 200 MB lo avisa antes de empezar', await estimacion(), '⚠️ Van a ocupar unos 360 MB (según 1 capítulo ya guardado): fijate que haya lugar en el disco.');
    reg['Serie Peso/Serie Peso 0001'].kb = kb;
    await b.setStorage({ savedChapters: reg });

    // El registro en CSV
    await b.ext.eval(`location.reload()`);
    await b.ext.waitFor(`document.readyState === 'complete' && !!document.querySelector('#exportarCsv')`, 'el botón del CSV en opciones');
    // (se mira lo que se iba a descargar: el texto que se le pasa al archivo)
    const csv = await b.ext.eval(`(async () => { let texto = ''; const real = URL.createObjectURL; URL.createObjectURL = (blob) => { blob.text().then(t => { texto = t; }); return real.call(URL, blob); };
      document.getElementById('exportarCsv').click(); for (let i = 0; i < 50 && !texto; i++) await new Promise(r => setTimeout(r, 100)); URL.createObjectURL = real;
      return texto.split('\\r\\n')[0].replace(/^\\uFEFF/, '') + ' · ' + (texto.includes('Serie Peso;Serie Peso 0001;1;') ? 'trae el capítulo guardado' : 'no trae el capítulo') + ' · ' + document.getElementById('guardadosMsg').textContent.replace(/\\d+/, 'N'); })()`);
    eq('opciones: "Exportar CSV" arma el registro con las columnas de la tabla', csv, 'Serie;Capítulo;Número;Fecha;Páginas;Dirección;Guardado como · trae el capítulo guardado · Registro exportado en CSV: N capítulos.');

    // El punto de versión nueva en el popup (lo que hay en main se anota una vez por día: acá se pone a mano)
    const popup = async (version) => {
      await b.setStorage({ versionVista: { ts: Date.now(), version } });
      const p = await b.cdp.open(`chrome-extension://${b.extId}/popup.html`);
      await p.waitFor(`document.readyState === 'complete' && !!document.querySelector('#btnSave')`, 'el popup');
      await sleep(400);
      const t = await p.eval(`(() => { const a = document.getElementById('versionNueva'); return a.hidden ? 'sin aviso' : a.textContent.trim() + ' · punto: ' + !!a.querySelector('.punto'); })()`);
      await p.close();
      return t;
    };
    const mia = await b.ext.eval(`chrome.runtime.getManifest().version`);
    eq('popup: si en main hay una versión más nueva, aparece el punto con el aviso', await popup('99.0.0'), `Hay una versión nueva: 99.0.0 (tenés la ${mia}) · punto: true`);
    eq('  y si es la misma (o más vieja), no', `${await popup(mia)} | ${await popup('2.0.0')}`, 'sin aviso | sin aviso');
    await b.ext.eval(`chrome.storage.local.remove('versionVista')`);
  },
};

// Corre las áreas pedidas (todas, o las de SOLO) y devuelve cuántas se cortaron
async function correr({ b, eq, solo = (process.env.SOLO || '').split(',').filter(Boolean) }) {
  const pedidos = {};
  const { url: S, otro: OTRO, estado, cerrar } = await sitio(pedidos);
  let cortes = 0;
  for (const [nombre, area] of Object.entries(AREAS)) {
    if (solo.length && !solo.includes(nombre)) continue;
    try { await area({ b, S, OTRO, eq, pedidos, estado }); }
    catch (e) { cortes++; eq(`[${nombre}] el área corrió entera`, 'se cortó: ' + e.message, 'sí'); }
  }
  cerrar();
  return cortes;
}

module.exports = { correr, AREAS, sitio };

if (require.main === module) (async () => {
  const version = process.argv[2] || ultimaVersion();
  let fails = 0;
  const eq = (label, got, want) => {
    const g = typeof got === 'string' ? got : JSON.stringify(got), w = typeof want === 'string' ? want : JSON.stringify(want);
    if (g !== w) fails++;
    console.log((g === w ? 'OK   ' : 'FALLA') + ' ' + label + ' → ' + g + (g === w ? '' : '   (esperado: ' + w + ')'));
  };
  const b = await lanzar(path.join(root, version, 'manga-reader-ext'));
  if (!b) { console.log('No encontré un Chromium que acepte --load-extension (ver tests/navegador.js). Prueba salteada.'); return; }
  console.log(`== ${version} en ${b.nombre} · lo nuevo de la 2.11`);
  try { await correr({ b, eq }); }
  catch (e) { fails++; console.log('FALLA la prueba se cortó: ' + e.message); }
  console.log(fails ? `\n${fails} FALLAS` : '\nTODO OK');
  await b.cerrar();
  process.exit(fails ? 1 : 0);
})();
