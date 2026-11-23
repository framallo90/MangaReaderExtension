// Prueba en navegador de lo que sumó la 2.11, por área. La corre tests/e2e.js al final, y se
// puede correr sola (tarda mucho menos):
//   node tests/e2e_211.js ["<carpeta de la versión>"]       (sin argumento: la más nueva)
//   SOLO=shadow,iframes node tests/e2e_211.js               (solo esas áreas)
// Cada área va en su propio bloque: si una se corta, se anota como falla y siguen las demás.
// Así también se puede correr contra una versión anterior para ver qué no andaba.
// Las páginas de prueba están en tests/fixtures/ y se sirven en /fx/<nombre>.html; las
// imágenes de cualquier /fx/img/… son la misma página de 420×640.
const fs = require('fs'), path = require('path'), http = require('http');
const { lanzar, pdfPages, sleep, root, ultimaVersion, RAIZ } = require('./navegador');

const FIXTURES = path.join(__dirname, 'fixtures');
const JPG = fs.readFileSync(path.join(FIXTURES, 'pagina.jpg'));       // 420×640

// Sitio de prueba: `pedidos` cuenta lo que se pidió por dirección
function sitio(pedidos = {}) {
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    pedidos[u] = (pedidos[u] || 0) + 1;
    const send = (type, body, status = 200) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
    const m = u.match(/^\/fx\/([\w-]+\.html)$/);
    if (m && fs.existsSync(path.join(FIXTURES, m[1]))) return send('text/html; charset=utf-8', fs.readFileSync(path.join(FIXTURES, m[1])));
    if (/^\/fx\/img\/[\w/-]+\.jpg$/.test(u)) return send('image/jpeg', JPG);
    send('text/plain', 'no', 404);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, url: `http://127.0.0.1:${srv.address().port}`, pedidos })));
}

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
};

// Corre las áreas pedidas (todas, o las de SOLO) y devuelve cuántas se cortaron
async function correr({ b, eq, solo = (process.env.SOLO || '').split(',').filter(Boolean) }) {
  const pedidos = {};
  const { srv, url: S } = await sitio(pedidos);
  let cortes = 0;
  for (const [nombre, area] of Object.entries(AREAS)) {
    if (solo.length && !solo.includes(nombre)) continue;
    try { await area({ b, S, eq, pedidos }); }
    catch (e) { cortes++; eq(`[${nombre}] el área corrió entera`, 'se cortó: ' + e.message, 'sí'); }
  }
  srv.close(); srv.closeAllConnections();
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
