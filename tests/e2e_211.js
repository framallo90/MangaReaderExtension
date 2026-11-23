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

const FIXTURES = path.join(__dirname, 'fixtures');
const JPG = fs.readFileSync(path.join(FIXTURES, 'pagina.jpg'));       // 420×640

// Sitio de prueba, en dos puertos: el segundo es "otro sitio" (otro origen) para el iframe del
// lector, y en las páginas se escribe %OTRO% donde va su dirección. `pedidos` cuenta lo que se
// pidió por dirección.
// Además de las páginas sueltas hay series enteras: /fx/<serie>/ es el listado (serie.html) y
// /fx/<serie>/leer/<n> cada capítulo (capitulo.html). `estado` deja romperlas desde la prueba:
//   estado.rotos    capítulos que dan 404, como "cola/2"
//   estado.imagen   función (dirección, pedido) → { status, headers } para que una imagen falle
async function sitio(pedidos = {}, estado = { rotos: new Set(), imagen: null }) {
  let otro = '';
  const atender = (req, res) => {
    const u = req.url.split('?')[0];
    pedidos[u] = (pedidos[u] || 0) + 1;
    const send = (type, body, status = 200, headers = {}) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers }); res.end(body); };
    const pagina = (archivo) => send('text/html; charset=utf-8', fs.readFileSync(path.join(FIXTURES, archivo), 'utf8').split('%OTRO%').join(otro));
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
const pedir = (b, url, cmd) => b.ext.eval(`(async () => {
  const tab = (await chrome.tabs.query({})).find(t => t.url === ${JSON.stringify(url)});
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
    await pg.eval(`document.querySelector('#mr-cola-reintentar').click()`);
    await pg.waitFor(`/Cancelar/.test(document.querySelector('#mr-chapter-go').textContent)`, 'que arranque el reintento', 10000).catch(() => {});
    const fin2 = await lote.fin(pg, 180000).catch(e => e.message);
    eq('con el sitio arreglado, Reintentar baja esos dos', `${String(fin2).split('\n')[0]} · ${await pdfDe(pdf('Serie Cola', 2), 3000)} · ${await pdfDe(pdf('Serie Cola', 3), 3000)}`,
      '✅ Listo: 2 capítulos guardados · 6 × 420x640 · 6 × 420x640');
    eq('  y la cola queda vacía', colaComo(await b.storage('cola')) + ' · ' + await pg.eval(BARRA), 'sin cola · sin barra');
    await pg.close();

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
      'Listo: 2 capítulos guardados · 1 con problemas / Capítulo 2: el sitio pidió esperar · se abrió 2 veces');
    eq('  y los otros capítulos se guardaron igual', `${await pdfDe(pdf('Serie Pide', 1), 3000)} · ${await pdfDe(pdf('Serie Pide', 3), 3000)} · cola: ${colaComo(await b.storage('cola'))}`,
      '6 × 420x640 · 6 × 420x640 · cola: 1 listo, 2 fallo (el sitio pidió esperar), 3 listo');
    estado.capitulo = null;
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

module.exports = { correr, AREAS };

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
