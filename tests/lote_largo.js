// Lote largo: baja decenas de capítulos seguidos de una serie de prueba servida en esta
// máquina, para ver si la descarga de varios capítulos aguanta más de unos minutos.
// No es parte de tests/e2e.js porque tarda: se corre a pedido.
//
// Uso: node tests/lote_largo.js [capítulos=60] [demora por imagen en ms=120] ["<carpeta de la versión>"]
//      CON_VENTANA=1 node tests/lote_largo.js      (ventana minimizada: pestañas en segundo plano como en el Chrome de todos los días)
// Qué navegador hace falta: ver tests/navegador.js.
const fs = require('fs'), path = require('path'), http = require('http');
const { lanzar, lote, pdfPages, sleep, root, ultimaVersion } = require('./navegador');

const N = +process.argv[2] || 60;
const DEMORA = process.argv[3] === undefined ? 120 : +process.argv[3];
const EXT = path.join(root, process.argv[4] || ultimaVersion(), 'manga-reader-ext');
const PAGINAS = 8;
const JPG = fs.readFileSync(path.join(__dirname, 'fixtures', 'pagina.jpg'));

const lista = `<!doctype html><html><head><meta charset="UTF-8"><title>Serie Larga - Todos los capítulos</title></head><body><h1>Serie Larga</h1>
${Array.from({ length: N }, (_, i) => `<a href="/largo/leer/serie-larga-${N - i}/">Capítulo ${N - i}</a>`).join('\n')}</body></html>`;
const cap = (n) => `<!doctype html><html><head><meta charset="UTF-8"><title>Serie Larga Capítulo ${n} | Sitio</title></head><body style="margin:0">
${Array.from({ length: PAGINAS }, (_, k) => `<img style="display:block" width="420" height="640" src="/largo/img/${n}/${k + 1}.jpg">`).join('\n')}
<a href="/largo/leer/serie-larga-${n + 1}/">Siguiente</a></body></html>`;

const pedidos = {};                                      // páginas de capítulo servidas, por número
function serve(req, res) {
  const u = req.url.split('?')[0];
  const send = (type, body, status = 200) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
  if (u === '/largo/') return send('text/html; charset=utf-8', lista);
  let m = u.match(/^\/largo\/leer\/serie-larga-(\d+)\/$/);
  if (m) { pedidos[m[1]] = (pedidos[m[1]] || 0) + 1; return +m[1] >= 1 && +m[1] <= N ? send('text/html; charset=utf-8', cap(+m[1])) : send('text/plain', 'no', 404); }
  if (/^\/largo\/img\/\d+\/\d+\.jpg$/.test(u)) return setTimeout(() => send('image/jpeg', JPG), DEMORA);
  send('text/plain', 'no', 404);
}

(async () => {
  const srv = http.createServer(serve);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const SITE = `http://127.0.0.1:${srv.address().port}`;
  let b = null, code = 0;
  try {
    b = await lanzar(EXT);
    if (!b) { console.log('No encontré un Chromium que acepte --load-extension (ver tests/navegador.js).'); srv.close(); return; }
    console.log(`== Lote de ${N} capítulos de ${PAGINAS} páginas (${DEMORA} ms por imagen) · ${path.basename(path.dirname(EXT))} · ${process.env.CON_VENTANA ? 'con ventana' : 'sin interfaz'}`);
    await b.setStorage({ savePdf: true, saveCbz: false, saveImgs: false });
    const pg = await b.cdp.open(`${SITE}/largo/`);
    await pg.waitFor(`document.readyState === 'complete'`, 'el listado');
    await b.command(`${SITE}/largo/`, 'batch');
    await pg.waitFor(`document.querySelectorAll('#mr-chapter .mr-chapter-item').length === ${N}`, 'la lista de capítulos');
    await pg.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);

    const t0 = Date.now();
    const seg = () => Math.round((Date.now() - t0) / 1000);
    const hechos = () => pg.eval(`document.querySelectorAll('#mr-chapter .mr-chapter-item.ok').length`);
    let fin = '', visto = -1, quieto = 0;
    while (!fin) {
      await sleep(5000);
      fin = await pg.eval(`(() => { const s = document.querySelector('#mr-chapter-status'); return s && /^(✅ )?(Listo|Cancelado|Parado)/.test(s.textContent) ? s.textContent : ''; })()`);
      const n = await hechos();
      if (n !== visto) { if (n % 5 === 0 || fin) console.log(`  ${String(seg()).padStart(4)} s · ${n} guardados`); visto = n; quieto = 0; }
      else if (++quieto >= 36) {                           // 3 minutos sin avanzar
        console.log(`  ${seg()} s · SIN AVANZAR desde hace 3 minutos, con ${n} guardados`);
        console.log('  Estado: ' + await pg.eval(`document.querySelector('#mr-chapter-status').textContent`));
        code = 1;
        break;
      }
    }
    const filas = await pg.eval(`JSON.stringify([...document.querySelectorAll('#mr-chapter .mr-chapter-item')].reduce((a, r) => { const k = r.classList.contains('ok') ? 'ok' : r.classList.contains('warn') ? 'incompleto' : r.classList.contains('fail') ? r.querySelector('.mr-chapter-s').textContent : 'sin hacer'; a[k] = (a[k] || 0) + 1; return a; }, {}))`);
    const dir = path.join(b.dl, 'MangaReader', 'Serie Larga');
    const pdfs = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.pdf')).sort() : [];
    const malos = pdfs.filter(f => pdfPages(path.join(dir, f)) !== `${PAGINAS} × 420x640`);
    const repetidos = Object.entries(pedidos).filter(([, n]) => n > 1).length;
    console.log(`\nResultado a los ${seg()} s: ${(fin || '(no terminó)').split('\n').slice(0, 4).join(' / ')}`);
    console.log(`Filas: ${filas}`);
    console.log(`Archivos: ${pdfs.length} PDF de ${N}` + (malos.length ? ` · ${malos.length} con otra cantidad de páginas: ${malos.slice(0, 5).join(', ')}` : ` · todos de ${PAGINAS} páginas`) +
      (pdfs.some(f => /\(\d+\)\.pdf$/.test(f)) ? ' · HAY REPETIDOS' : ''));
    console.log(`Capítulos abiertos más de una vez: ${repetidos} · pestañas al final: ${await b.tabCount()}`);
    if (pdfs.length !== N || malos.length || !/^✅ Listo/.test(fin)) code = 1;
    console.log(code ? '\nFALLÓ' : '\nTODO OK');
  } catch (e) {
    console.log('Se cortó: ' + e.message);
    code = 1;
  }
  srv.close();
  if (b) await b.cerrar();
  process.exit(code);
})();
