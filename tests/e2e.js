// Prueba en un navegador real. Carga la extensión en un Chromium sin interfaz y la usa
// sobre un sitio de prueba servido en esta máquina, armado como el sitio real: la página
// se dibuja con JavaScript, los capítulos no tienen links, los menores a 10 llevan cero
// adelante y las imágenes dicen ".png" pero son JPG. También hay un sitio "clásico" con
// links, carga diferida (data-src), un aviso y una página de créditos.
//
// Uso: node tests/e2e.js ["<carpeta de la versión>"]     (sin argumento: la más nueva)
//      CAPTURAS=<carpeta> node tests/e2e.js              (además guarda capturas de los diálogos)
// Qué navegador hace falta: ver tests/navegador.js.
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');
const { lanzar, lote, zipNames, pdfPages, sleep, root, ultimaVersion, RAIZ } = require('./navegador');

const version = process.argv[2] || ultimaVersion();
const EXT = path.join(root, version, 'manga-reader-ext');
const CAPTURAS = process.env.CAPTURAS || '';

let fails = 0;
function eq(label, got, want) {
  const g = typeof got === 'string' ? got : JSON.stringify(got), w = typeof want === 'string' ? want : JSON.stringify(want);
  const ok = g === w;
  if (!ok) fails++;
  console.log((ok ? 'OK   ' : 'FALLA') + ' ' + label + ' → ' + g + (ok ? '' : '   (esperado: ' + w + ')'));
}

// ── Imágenes de prueba ──
const JPG = fs.readFileSync(path.join(__dirname, 'fixtures', 'pagina.jpg'));       // 420×640
function pngGray(w, h, shade) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8;
  const raw = Buffer.alloc((w + 1) * h, shade);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;                                 // byte de filtro de la fila
    if (w > 60 && y % 40 < 6) raw.fill(40, y * (w + 1) + 21, y * (w + 1) + w - 20);   // rayas, para que no sea un plano liso
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG_PAGE = pngGray(420, 640, 230), PNG_LOGO = pngGray(800, 300, 120), PNG_BANNER = pngGray(700, 700, 90),
      PNG_CREDITS = pngGray(800, 300, 200), PNG_PX = pngGray(1, 1, 255);

// ── Sitio de prueba ──
const spa = (prefix, withList) => `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Sitio de Prueba</title></head>
<body style="margin:0;background:#222"><div id="root"></div><script>
const cap = (location.pathname.match(/todos\\/([^/]+)$/) || [])[1] || '01';
setTimeout(() => {
  document.title = 'Serie Prueba Manga ' + cap + '  - Sitio de Prueba';
  const root = document.getElementById('root');
  root.innerHTML = '<a href="/">Inicio</a> <a href="${prefix}/manga/es/todos">Manga</a> <a href="https://x.example/alguien">X</a>' +
    '<img class="mobile-logo" src="/images/logo.png"><div class="hex-select"><select><option value="" disabled selected>Lista de capítulos</option>' +
    '<option disabled>Cargando...</option></select></div><main id="pages"></main><img class="banner" src="/images/banner.png">';
  if (/^(0[1-9]|1[0-2])$/.test(cap)) {                 // existen del 01 al 12, con cero adelante
    for (let i = 0; i < 6; i++) root.querySelector('#pages').insertAdjacentHTML('beforeend',
      '<img class="list-manga" style="display:block" src="/mangafiles/es/todos/' + cap + '/' + String(i).padStart(2, '0') + '.png">');
  }
  ${withList ? `setTimeout(() => { const s = root.querySelector('select'); s.lastChild.remove();
    for (let n = 1; n <= 12; n++) s.insertAdjacentHTML('beforeend', '<option value="' + String(n).padStart(2, '0') + '">Capítulo ' + n + '</option>'); }, 300);` : ''}
}, 300);
</script></body></html>`;

const clasicoLista = `<!doctype html><html><head><meta charset="UTF-8"><title>Clásico - Todos los capítulos</title></head><body>
<h1>Clásico</h1>
<a href="/clasico/leer/1">Capítulo 1</a> <a href="/clasico/leer/2">Capítulo 2</a> <a href="/clasico/leer/3">Capítulo 3</a>
<a href="/clasico/leer/3">Último</a> <a href="/clasico/page/2">Siguiente</a> <a href="/noticias/2026">Noticias</a>
<a href="https://x.example/status/123456789">Tweet</a></body></html>`;
const clasicoCap = (n) => `<!doctype html><html><head><meta charset="UTF-8"><title>Clásico Capítulo ${n}: El comienzo | Sitio</title></head><body style="margin:0">
<img src="/images/logo.png">
${[1, 2, 3, 4, 5, 6].map(k => `<img style="display:block;width:420px;height:640px" src="/images/px.png" data-src="/clasico/img/${n}/${k}.jpg">`).join('\n')}
<a href="https://otro-sitio.example/"><img src="/clasico/img/${n}/aviso.jpg"></a>
<img src="/clasico/img/${n}/creditos.png">
</body></html>`;

// Lector que protege las páginas, como MANGA Plus: la dirección lleva un código (2010289 es el
// capítulo 104) y cada página se baja aparte y se muestra como imagen blob:. Alrededor quedan
// imágenes grandes del sitio (logo, banner, promoción) que no son el capítulo.
const protegido = `<!doctype html><html><head><meta charset="UTF-8"><title>Lector</title></head><body style="margin:0;background:#222">
<img src="/images/logo.png"><img src="/images/banner.png"><img src="/promo/oferta.png"><div id="pages"></div><script>
setTimeout(async () => {
  document.title = '[#104] Serie Protegida | Sitio';
  for (let i = 1; i <= 4; i++) {
    const data = await (await fetch('/protegido/datos/' + i)).blob();
    const img = document.createElement('img');
    img.style.display = 'block';
    img.src = URL.createObjectURL(data);
    document.getElementById('pages').appendChild(img);
  }
}, 300);
</script></body></html>`;

// Sitio de una sola serie, de los que llevan el número dentro del nombre de la página:
// /fan/leer/serie-fan-manga-<n>/ (con barra final). El título termina en un año, las páginas
// usan la carga diferida del navegador (loading="lazy"), hay dos <canvas> de adorno y el
// listado tiene un código largo en su dirección y los capítulos de más nuevo a más viejo.
const fanLista = `<!doctype html><html><head><meta charset="UTF-8"><title>Serie Fan Manga - Todos los capítulos 2026</title></head><body>
<h1>Serie Fan</h1><a href="/fan/">Inicio</a>
<a href="/fan/leer/serie-fan-manga-3/">Capítulo 3</a> <a href="/fan/leer/serie-fan-manga-2/">Capítulo 2</a> <a href="/fan/leer/serie-fan-manga-1/">Capítulo 1</a>
</body></html>`;
const fanCap = (n) => `<!doctype html><html><head><meta charset="UTF-8"><title>Leer Serie Fan Manga ${n} Español Online - 2026</title></head><body style="margin:0">
<canvas width="1280" height="720" style="position:fixed;inset:0;z-index:-1"></canvas>
<canvas width="300" height="600" style="float:right"></canvas>
<img src="/images/logo.png">
${[1, 2, 3, 4, 5, 6].map(k => `<img loading="lazy" width="420" height="640" style="display:block" src="/fan/img/${n}/${k}.jpg">`).join('\n')}
<a href="/fan/leer/serie-fan-manga-${n - 1}/">Anterior</a> <a href="/fan/leer/serie-fan-manga-${n + 1}/">Siguiente</a>
</body></html>`;

// Sitio armado como un blog: en todas las páginas hay una tira con el archivo por mes
// (/blog/2021/01/ "enero 2021"…), el mismo archivo en un desplegable y un calendario con
// links por día. La página de un mes muestra juntos los capítulos publicados ese mes.
const BLOG_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio'];
const blogLado = `<aside><h3>Archivo</h3>
${BLOG_MESES.map((m, i) => `<a href="/blog/2021/0${i + 1}/">${m} 2021</a>`).join(' ')}
<select><option value="">Elegir el mes</option>${BLOG_MESES.map((m, i) => `<option value="/blog/2021/0${i + 1}/"> ${m} 2021 (2)</option>`).join('')}</select>
<table><tr>${[14, 15, 16].map(d => `<td><a href="/blog/2021/01/${d}/">${d}</a></td>`).join('')}</tr></table></aside>`;
const blogImgs = (n) => [1, 2, 3, 4, 5, 6].map(k => `<img style="display:block" width="420" height="640" src="/blog/img/${n}/${k}.jpg">`).join('\n');
const blogInicio = `<!doctype html><html><head><meta charset="UTF-8"><title>Serie Blog – Leer online</title></head><body>${blogLado}
<h1>Serie Blog</h1>${[4, 3, 2, 1].map(n => `<a href="/blog/leer/serie-blog-manga-${n}/">Serie Blog Manga ${n}</a>`).join(' ')}</body></html>`;
const blogMes = `<!doctype html><html><head><meta charset="UTF-8"><title>enero 2021 – Serie Blog</title></head><body style="margin:0">${blogLado}
<h1>Mes: enero 2021</h1>
<h2><a href="/blog/leer/serie-blog-manga-2/">Serie Blog Manga 2</a></h2>${blogImgs(2)}
<h2><a href="/blog/leer/serie-blog-manga-1/">Serie Blog Manga 1</a></h2>${blogImgs(1)}</body></html>`;
const blogCap = (n) => `<!doctype html><html><head><meta charset="UTF-8"><title>Serie Blog Manga ${n} Español – Serie Blog</title></head><body style="margin:0">${blogLado}
${blogImgs(n)}</body></html>`;
// Un capítulo cuya dirección termina en un archivo, con el número en el medio del nombre y
// sin links a los otros capítulos: no hay de dónde sacar las demás direcciones.
const BLOG_HTML = '/blog/2021/02/serie-blog-manga-3-espanol.html';
const blogCapHtmlN = (n) => `<!doctype html><html><head><meta charset="UTF-8"><title>Ver Serie Blog Manga ${n} Español Completo Online</title></head><body style="margin:0">${blogLado}
${blogImgs(n)}</body></html>`;
const blogCapHtml = blogCapHtmlN(3);
// Capítulos sin número en la dirección ni (de fiar) en el título: solo se pueden numerar
// por el orden en que se pegan sus links. El título de uno termina en un año.
const SUELTOS = { 'la-llegada': 'Serie Suelta – La llegada', 'el-torneo': 'Serie Suelta – El torneo 2026', 'el-final': 'Serie Suelta – El final' };
const sueltoCap = (slug) => `<!doctype html><html><head><meta charset="UTF-8"><title>${SUELTOS[slug]}</title></head><body style="margin:0">
${[1, 2, 3, 4, 5, 6].map(k => `<img style="display:block" width="420" height="640" src="/sueltos/img/${slug}/${k}.jpg">`).join('\n')}</body></html>`;

// Serie cuya página separa los capítulos en tomos, cada uno con su título. Arriba hay un bloque
// de "Últimos capítulos" que repite uno, y al final un capítulo suelto debajo de otro título.
const tomosLista = `<!doctype html><html><head><meta charset="UTF-8"><title>Serie Tomos - Todos los capítulos</title></head><body>
<h1>Serie Tomos</h1>
<h3>Últimos capítulos</h3><a href="/tomos/leer/5">Capítulo 5</a>
<h3>Tomo 1: El comienzo</h3><a href="/tomos/leer/1">Capítulo 1</a> <a href="/tomos/leer/2">Capítulo 2</a>
<h3>Tomo 2: La huida</h3><a href="/tomos/leer/3">Capítulo 3</a> <a href="/tomos/leer/4">Capítulo 4</a> <a href="/tomos/leer/5">Capítulo 5</a>
<h3>Especiales</h3><a href="/tomos/leer/6">Capítulo 6</a></body></html>`;
const tomosCap = (n) => `<!doctype html><html><head><meta charset="UTF-8"><title>Serie Tomos Capítulo ${n} | Sitio</title></head><body style="margin:0">
${[1, 2, 3, 4, 5, 6].map(k => `<img style="display:block" width="420" height="640" src="/tomos/img/${n}/${k}.jpg">`).join('\n')}</body></html>`;

const hits = {};                                        // pedidos de la extensión por dirección (los que mandan Accept: image/*)
function serve(req, res) {
  const u = req.url.split('?')[0];
  const send = (type, body, status = 200) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
  if (/^\/(b\/)?manga\/es\/todos(\/[^/]+)?$/.test(u)) return send('text/html; charset=utf-8', spa(u.startsWith('/b/') ? '/b' : '', u.startsWith('/b/')));
  if (u === '/clasico/') return send('text/html; charset=utf-8', clasicoLista);
  let m = u.match(/^\/clasico\/leer\/(\d+)$/);
  if (m) return +m[1] <= 3 ? send('text/html; charset=utf-8', clasicoCap(m[1])) : send('text/plain', 'no', 404);
  m = u.match(/^\/mangafiles\/es\/todos\/(\d+)\/(\d+)\.png$/);
  if (m) {
    if (req.headers.accept === 'image/*') {               // así pide la extensión; el navegador manda otra cosa
      const n = hits[u] = (hits[u] || 0) + 1;
      if (m[1] === '12' && m[2] === '03') return send('text/plain', 'no', 404);        // esta página nunca baja
      if (m[1] === '10' && m[2] === '02' && n === 1) return send('text/plain', 'ocupado', 503);   // esta falla una vez
    }
    return m[2] === '05' ? send('image/png', PNG_PAGE) : send('image/jpeg', JPG);       // dicen .png y son JPG, como el sitio real
  }
  if (/^\/clasico\/img\/\d+\/creditos\.png$/.test(u)) return send('image/png', PNG_CREDITS);
  if (/^\/clasico\/img\/\d+\/\w+\.jpg$/.test(u)) return send('image/jpeg', JPG);
  if (u === '/images/logo.png') return send('image/png', PNG_LOGO);
  if (u === '/images/banner.png') return send('image/png', PNG_BANNER);
  if (u === '/images/px.png') return send('image/png', PNG_PX);
  if (u === '/protegido/viewer/2010289') return send('text/html; charset=utf-8', protegido);
  if (/^\/protegido\/datos\/\d$/.test(u)) return send('image/jpeg', JPG);
  if (u === '/promo/oferta.png') return send('image/png', PNG_BANNER);
  if (u === '/fan/serie/1234567-serie-fan/') return send('text/html; charset=utf-8', fanLista);
  m = u.match(/^\/fan\/leer\/serie-fan-manga-(\d+)\/$/);
  if (m) return +m[1] >= 1 && +m[1] <= 3 ? send('text/html; charset=utf-8', fanCap(+m[1])) : send('text/plain', 'no', 404);
  if (/^\/fan\/img\/\d+\/\d\.jpg$/.test(u)) return send('image/jpeg', JPG);
  if (u === '/blog/') return send('text/html; charset=utf-8', blogInicio);
  if (u === BLOG_HTML) return send('text/html; charset=utf-8', blogCapHtml);
  if (u.startsWith(BLOG_HTML + '/')) { hits.blogInventada = (hits.blogInventada || 0) + 1; return send('text/plain', 'no', 404); }   // "….html/1": no existe
  m = u.match(/^\/blog\/2021\/0[1-6]\/serie-blog-manga-(\d+)-espanol\.html$/);       // cada capítulo en la carpeta de su mes
  if (m) return +m[1] >= 1 && +m[1] <= 4 ? send('text/html; charset=utf-8', blogCapHtmlN(+m[1])) : send('text/plain', 'no', 404);
  m = u.match(/^\/sueltos\/([a-z-]+)\.html$/);
  if (m && SUELTOS[m[1]]) return send('text/html; charset=utf-8', sueltoCap(m[1]));
  if (/^\/sueltos\/img\/[a-z-]+\/\d\.jpg$/.test(u)) return send('image/jpeg', JPG);
  if (/^\/blog\/2021\/0[1-6]\/(\d\d\/)?$/.test(u)) { hits.blogArchivo = (hits.blogArchivo || 0) + 1; return send('text/html; charset=utf-8', blogMes); }
  m = u.match(/^\/blog\/leer\/serie-blog-manga-(\d+)\/$/);
  if (m) return +m[1] >= 1 && +m[1] <= 4 ? send('text/html; charset=utf-8', blogCap(+m[1])) : send('text/plain', 'no', 404);
  if (/^\/blog\/img\/\d+\/\d\.jpg$/.test(u)) return send('image/jpeg', JPG);
  if (u === '/tomos/') return send('text/html; charset=utf-8', tomosLista);
  m = u.match(/^\/tomos\/leer\/(\d+)$/);
  if (m) return +m[1] >= 1 && +m[1] <= 6 ? send('text/html; charset=utf-8', tomosCap(+m[1])) : send('text/plain', 'no', 404);
  if (/^\/tomos\/img\/\d+\/\d\.jpg$/.test(u)) return send('image/jpeg', JPG);
  send('text/plain', 'no', 404);
}

(async () => {
  let b = null;
  const srv = http.createServer(serve);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const SITE = `http://127.0.0.1:${srv.address().port}`;
  const HOST = '127.0.0.1';
  const shot = async (pg, name) => { if (CAPTURAS) { fs.mkdirSync(CAPTURAS, { recursive: true }); await pg.screenshot(path.join(CAPTURAS, name + '.png')); } };

  try {
    b = await lanzar(EXT);
    if (!b) { console.log('No encontré un Chromium que acepte --load-extension (ver tests/navegador.js). Prueba salteada.'); srv.close(); return; }
    console.log(`== ${version} en ${b.nombre}`);
    const { cdp, dl } = b;
    const file = (rel) => path.join(dl, 'MangaReader', rel);

    // ═══ 1. Guardar un capítulo, en una página armada con JavaScript ═══
    console.log('\n── Guardar un capítulo');
    const cap = await cdp.open(`${SITE}/manga/es/todos/11`);
    await cap.waitFor(`!!document.querySelector('#mr-fab')`, 'la burbuja');
    eq('aparece la burbuja en el capítulo', true, true);
    await Promise.all([b.command(`${SITE}/manga/es/todos/11`, 'save'), b.command(`${SITE}/manga/es/todos/11`, 'save')]);
    await cap.waitFor(`document.querySelectorAll('#mr-save .mr-thumb').length >= 8`, 'las miniaturas');
    eq('pedir el diálogo dos veces seguidas abre uno solo', await cap.eval(`document.querySelectorAll('#mr-save').length`), 1);
    eq('nombre sugerido', await cap.eval(`document.querySelector('#mr-save-name').value`), 'Serie Prueba/Serie Prueba 0011');
    eq('miniaturas: 6 páginas tildadas, logo y banner como publicidad',
      await cap.eval(`[...document.querySelectorAll('#mr-save .mr-thumb')].map(b => (b.classList.contains('on') ? 'P' : 'x') + (b.querySelector('.mr-thumb-ad') ? 'ad' : '')).join(' ')`), 'xad P P P P P P xad');
    // Recorrido automático: la página es más alta que la ventana, así que baja sola y vuelve
    await cap.waitFor(`!/Recorriendo/.test(document.querySelector('#mr-save-count').textContent) && getComputedStyle(document.querySelector('#mr-save-warn')).display === 'none'`, 'el fin del recorrido automático', 30000);
    eq('recorre la página sola y vuelve arriba', await cap.eval(`window.scrollY + ' · ' + document.querySelector('#mr-save-count').textContent.slice(0, 14)`), '0 · 6 de 8 páginas');
    eq('ofrece "Guardar y siguiente"', await cap.eval(`document.querySelector('#mr-save-next').hidden`), false);
    await cap.eval(`document.querySelector('#mr-save-cbz').click(); document.querySelector('#mr-save-imgs').click()`);
    await shot(cap, '1-guardar');
    await cap.eval(`document.querySelector('#mr-save-next').click()`);

    // "Guardar y siguiente": guarda, abre el 12 y el diálogo se abre solo
    await cap.waitFor(`location.pathname.endsWith('/12') && !!document.querySelector('#mr-save-name') && document.querySelector('#mr-save-name').value`, 'el capítulo siguiente con el diálogo abierto', 60000);
    eq('guardar y siguiente: abre el 12 con el diálogo listo', await cap.eval(`document.querySelector('#mr-save-name').value`), 'Serie Prueba/Serie Prueba 0012');
    eq('archivos del capítulo 11', b.ls('Serie Prueba'), 'Serie Prueba 0011 Serie Prueba 0011.cbz Serie Prueba 0011.pdf');
    eq('imágenes sueltas con su tipo real (la dirección decía .png)', b.ls('Serie Prueba/Serie Prueba 0011'), 'pagina_001.jpg pagina_002.jpg pagina_003.jpg pagina_004.jpg pagina_005.jpg pagina_006.png');
    eq('la imagen suelta es el original, byte a byte', fs.readFileSync(file('Serie Prueba/Serie Prueba 0011/pagina_001.jpg')).equals(JPG), true);
    eq('PDF: 5 JPG + 1 PNG, cada página del tamaño de su imagen', pdfPages(file('Serie Prueba/Serie Prueba 0011.pdf')), '6 × 420x640');
    eq('CBZ', zipNames(file('Serie Prueba/Serie Prueba 0011.cbz')).join(' '), '001.jpg 002.jpg 003.jpg 004.jpg 005.jpg 006.png ComicInfo.xml');
    const saved11 = (await b.storage('savedChapters'))['Serie Prueba/Serie Prueba 0011'];
    eq('queda anotado como guardado', `${saved11.pages} páginas · ${saved11.url}`, `6 páginas · ${SITE}/manga/es/todos/11`);

    // ═══ 2. Varios capítulos desde la página de un capítulo ═══
    console.log('\n── Varios capítulos, desde un capítulo');
    const tabs0 = await b.tabCount();
    await b.command(`${SITE}/manga/es/todos/12`, 'batch');
    await cap.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo de varios capítulos');
    eq('el diálogo se ve (fijo, con fondo) y cierra el de guardar',
      await cap.eval(`(() => { const c = getComputedStyle(document.querySelector('#mr-chapter')); return c.position + ' ' + (c.backgroundColor !== 'rgba(0, 0, 0, 0)') + ' ' + !document.querySelector('#mr-save'); })()`), 'fixed true true');
    eq('dirección de los capítulos', await cap.eval(`document.querySelector('#mr-chapter-tpl').value`), `${SITE}/manga/es/todos/{n}`);
    eq('lista inicial: el capítulo abierto', await lote.filas(cap), '12');
    await lote.rango(cap, 8, 11);
    eq('marcar del 8 al 11 (el 11 ya figura guardado)', await lote.filas(cap), '8* | 9* | 10* | 11* [✔ guardado] | 12');
    eq('el botón saltea el ya guardado', await cap.eval(`document.querySelector('#mr-chapter-go').textContent`), 'Descargar 3 capítulos');
    await cap.eval(`document.querySelector('#mr-chapter-go').click()`);
    await cap.waitFor(`document.querySelector('#mr-chapter-go').textContent === 'Cancelar'`, 'el lote en marcha');
    await sleep(2500);
    await shot(cap, '2-lote-en-marcha');
    const done1 = await lote.fin(cap);
    await shot(cap, '3-lote-listo');
    eq('resultado del lote', done1.split('\n')[0], '✅ Listo: 3 capítulos guardados');
    eq('filas', await lote.filas(cap), '8 [✅ 6 páginas] | 9 [✅ 6 páginas] | 10 [✅ 6 páginas] | 11* [✔ guardado] | 12');
    eq('archivos', b.ls('Serie Prueba').replace(/Serie Prueba /g, ''), '0008 0008.cbz 0008.pdf 0009 0009.cbz 0009.pdf 0010 0010.cbz 0010.pdf 0011 0011.cbz 0011.pdf');
    eq('PDF del 8', pdfPages(file('Serie Prueba/Serie Prueba 0008.pdf')), '6 × 420x640');
    eq('aprendió que el sitio usa cero adelante (probó /8, después /08)', (await b.storage('batchPad'))[HOST], 2);
    eq('la página que falló una vez se reintentó', hits['/mangafiles/es/todos/10/02.png'], 2);
    eq('PDF del 10 completo', pdfPages(file('Serie Prueba/Serie Prueba 0010.pdf')), '6 × 420x640');
    eq('no quedan pestañas abiertas', await b.tabCount(), tabs0);

    // Un capítulo con una página que no baja: se guarda lo que hay y no se anota como guardado
    await cap.eval(`document.querySelector('#mr-chapter-none').click()`);
    await lote.rango(cap, 12, 12);
    await cap.eval(`document.querySelector('#mr-chapter-go').click()`);
    const done2 = await lote.fin(cap);
    eq('capítulo con una página caída', done2.split('\n').slice(0, 2).join(' / '),
      'Listo: 0 capítulos guardados · 1 con problemas / Capítulo 12: No se pudo bajar la página 4 · Faltaron páginas: no lo marqué como guardado. Probá guardarlo de nuevo.');
    eq('  igual queda el PDF con las otras 5', pdfPages(file('Serie Prueba/Serie Prueba 0012.pdf')), '5 × 420x640');
    eq('  y no figura como guardado', !!(await b.storage('savedChapters'))['Serie Prueba/Serie Prueba 0012'], false);

    // Cancelar un lote en marcha
    await cap.eval(`document.querySelector('#mr-chapter-none').click()`);
    await lote.rango(cap, 4, 7);
    await cap.eval(`document.querySelector('#mr-chapter-go').click()`);
    await cap.waitFor(`/\\(1\\/4\\)/.test(document.querySelector('#mr-chapter-status').textContent)`, 'el primer capítulo del lote');
    await cap.eval(`document.querySelector('#mr-chapter-go').click()`);
    const done3 = await lote.fin(cap, 60000);
    eq('cancelar: corta y lo dice (sin tilde de "todo bien")', /^Cancelado: [01] capítulos? guardados?$/.test(done3.split('\n')[0]) ? 'Cancelado' : done3, 'Cancelado');
    eq('cancelar: no quedan pestañas abiertas', await b.tabCount(), tabs0);
    eq('cancelar: no siguió con el resto', b.existe('Serie Prueba/Serie Prueba 0007.pdf'), false);
    await cap.close();

    // ═══ 3. Varios capítulos desde la portada (la dirección no tiene número) ═══
    console.log('\n── Varios capítulos, desde la portada de la serie');
    const home = await cdp.open(`${SITE}/manga/es/todos`);
    await home.waitFor(`document.querySelectorAll('img.list-manga').length === 6`, 'la portada');
    await b.command(`${SITE}/manga/es/todos`, 'batch');
    await home.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo');
    eq('dirección supuesta, a la vista para revisarla', await home.eval(`document.querySelector('#mr-chapter-tpl').value + ' · ' + document.querySelector('#mr-chapter-more').open`), `${SITE}/manga/es/todos/{n} · true`);
    await lote.rango(home, 1, 3);
    await lote.rango(home, 13, 13);
    eq('marcados', await lote.filas(home), '1* | 2* | 3* | 13*');
    await shot(home, '4-lote-portada');
    await home.eval(`document.querySelector('#mr-chapter-go').click()`);
    const done4 = await lote.fin(home);
    eq('resultado: 3 guardados y el 13 no existe', done4.split('\n').slice(0, 2).join(' / '), 'Listo: 3 capítulos guardados · 1 con problemas / Capítulo 13: Sin páginas (encontré 2)');
    eq('archivos 1 a 3', ['0001', '0002', '0003'].map(n => b.existe(`Serie Prueba/Serie Prueba ${n}.pdf`)).join(' '), 'true true true');
    eq('no se creó nada para el 13', b.existe('Serie Prueba/Serie Prueba 0013.pdf'), false);
    await home.close();

    // ═══ 4. El desplegable de capítulos ya cargó ═══
    console.log('\n── Lista de capítulos tomada del desplegable');
    const sel = await cdp.open(`${SITE}/b/manga/es/todos/05`);
    await sel.waitFor(`document.querySelectorAll('select option').length > 10`, 'el desplegable');
    await b.command(`${SITE}/b/manga/es/todos/05`, 'batch');
    await sel.waitFor(`document.querySelectorAll('#mr-chapter .mr-chapter-item').length > 1`, 'la lista');
    eq('12 capítulos, del 1 al 12', await sel.eval(`(() => { const r = [...document.querySelectorAll('#mr-chapter .mr-chapter-n')].map(e => e.textContent); return r.length + ': ' + r[0] + '…' + r[r.length - 1]; })()`), '12: 1…12');
    eq('rango sugerido: del abierto al último', await sel.eval(`document.querySelector('#mr-chapter-from').value + '-' + document.querySelector('#mr-chapter-to').value`), '5-12');
    await sel.close();

    // ═══ 5. Sitio clásico: links, carga diferida, aviso y créditos ═══
    console.log('\n── Sitio con links y carga diferida');
    const cl = await cdp.open(`${SITE}/clasico/`);
    await cl.waitFor(`document.readyState === 'complete'`, 'el listado');
    eq('en el listado no hay burbuja', await cl.eval(`!!document.querySelector('#mr-fab')`), false);
    await b.command(`${SITE}/clasico/`, 'batch');
    await cl.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo');
    eq('capítulos tomados de los links (sin paginación ni noticias)', await lote.filas(cl), '1 | 2 | 3');
    await cl.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
    eq('resultado', (await lote.fin(cl)).split('\n')[0], '✅ Listo: 3 capítulos guardados');
    eq('nombre tomado del título de cada capítulo', b.ls('Clásico').replace(/Clásico /g, ''), '0001 0001.cbz 0001.pdf 0002 0002.cbz 0002.pdf 0003 0003.cbz 0003.pdf');
    eq('6 páginas: sin logo, aviso ni créditos', pdfPages(file('Clásico/Clásico 0002.pdf')), '6 × 420x640');
    await cl.close();

    // ═══ 6. Guardados y opciones, y el popup ═══
    console.log('\n── Página de guardados y popup');
    await b.ext.eval('location.reload()');
    await b.ext.waitFor(`document.querySelectorAll('details.serie').length === 2`, 'las series');
    eq('series y lo que falta', await b.ext.eval(`[...document.querySelectorAll('details.serie summary')].map(s => s.textContent.replace(/\\s+/g, ' ').trim()).join(' || ')`),
      'Clásico3 capítulos · del 1 al 3 || Serie Prueba7 capítulos · del 1 al 11Te faltan: 4–7');
    eq('sagas incluidas a la vista para editar', await b.ext.eval(`document.querySelector('#sagasText').value.split('\\n')[0]`), 'One Piece');
    await b.ext.eval(`document.querySelector('#sagasText').value += '\\n\\nSerie Prueba\\n1-6 Primera\\n7- Segunda'; document.querySelector('#sagasSave').click()`);
    await b.ext.waitFor(`/Guardado/.test(document.querySelector('#sagasMsg').textContent)`, 'las sagas guardadas');
    eq('sagas propias guardadas', JSON.stringify((await b.storage('sagas'))['serie prueba']), '[[1,6,"Primera"],[7,99999,"Segunda"]]');
    await b.ext.eval(`document.querySelector('details.serie:last-child').open = true`);
    await shot(b.ext, '5-guardados');

    const popup = await cdp.open(`chrome-extension://${b.extId}/popup.html`);
    await popup.waitFor(`document.readyState === 'complete' && document.querySelector('#autoScan').checked`, 'el popup');
    await popup.eval(`document.querySelector('#autoScan').click()`);
    await sleep(300);
    eq('popup: apagar el recorrido automático', await b.storage('autoScan'), false);
    await popup.eval(`document.querySelector('#autoScan').click()`);
    await shot(popup, '6-popup');
    await popup.close();

    // ═══ 7. Burbuja por sitio, sagas propias y actualizar sin F5 ═══
    console.log('\n── Burbuja por sitio y actualización sin recargar la pestaña');
    const c9 = await cdp.open(`${SITE}/manga/es/todos/09`);
    await c9.waitFor(`!!document.querySelector('#mr-fab')`, 'la burbuja');
    await c9.eval(`document.querySelector('#mr-fab .mr-fab-i').click()`);
    await shot(c9, '7-burbuja');
    await c9.eval(`document.querySelector('#mr-fab .mr-fab-site').click()`);
    await c9.waitFor(`!document.querySelector('#mr-fab')`, 'que se vaya la burbuja');
    eq('"No mostrar en este sitio": se va y queda anotado', (await b.storage('fabBlockedHosts')).join(','), HOST);
    await b.setStorage({ fabBlockedHosts: [] });
    await c9.waitFor(`!!document.querySelector('#mr-fab')`, 'que vuelva la burbuja');
    eq('al sacarlo de la lista, vuelve sin recargar', true, true);

    // Actualizar la extensión deja en la pestaña una copia vieja del script, ya sin conexión.
    // Acá no se puede recargar la extensión de verdad (este Chromium la bloquea), así que se
    // marca la copia como desconectada y se inyecta el script de nuevo, igual que hace el
    // service worker cuando la pestaña no le contesta.
    eq('una segunda inyección con la copia viva no hace nada', await b.ext.eval(`(async () => {
      const [tab] = await chrome.tabs.query({ url: ${JSON.stringify(SITE + '/manga/es/todos/09')} });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['sagas.js', 'content.js'] });
      return 'ok'; })()`) + ' ' + await c9.eval(`document.querySelectorAll('#mr-fab').length`), 'ok 1');
    await c9.evalInExtension(b.extId, `window.__mangaReaderAlive = () => false; 1`);
    await b.ext.eval(`(async () => {
      const [tab] = await chrome.tabs.query({ url: ${JSON.stringify(SITE + '/manga/es/todos/09')} });
      ${fs.existsSync(path.join(EXT, 'styles.css')) ? `await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });` : '/* desde la 2.11 no hay hoja que inyectar: va adentro del shadow root */'}
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['sagas.js', 'content.js'] }); })()`);
    eq('la copia nueva limpia lo que dejó la vieja', await c9.eval(`document.querySelectorAll('#mr-fab').length`), 0);
    await c9.waitFor(`!!document.querySelector('#mr-fab')`, 'la burbuja de la copia nueva');
    await b.command(`${SITE}/manga/es/todos/09`, 'save');
    await c9.waitFor(`!!document.querySelector('#mr-save-name') && document.querySelectorAll('#mr-save .mr-thumb').length >= 8`, 'el diálogo después de actualizar');
    eq('con la copia nueva abre sin F5, y con las sagas propias', await c9.eval(`document.querySelector('#mr-save-name').value`), 'Serie Prueba/02 Segunda/Serie Prueba 0009');
    eq('  una sola burbuja y un solo diálogo', await c9.eval(`document.querySelectorAll('#mr-fab').length + ' ' + document.querySelectorAll('#mr-save').length`), '1 1');
    eq('  ya figura como guardado (aunque ahora el nombre sea otro)', /^✔ Ya lo guardaste el .* como "Serie Prueba\/Serie Prueba 0009"$/.test(await c9.eval(`document.querySelector('#mr-save-seen').textContent`)), true);
    await c9.eval(`document.querySelector('#mr-save-go').click()`);
    await c9.waitFor(`/success|error/.test(document.querySelector('#mr-save-status').className)`, 'el guardado', 60000);
    eq('  y guarda', (await c9.eval(`document.querySelector('#mr-save-status').textContent`)).split('\n')[0].replace(/\(.*\)/, '(…)'), '✅ 📄 PDF de 6 páginas (…)');
    eq('  en la carpeta de la saga', b.ls('Serie Prueba/02 Segunda').includes('Serie Prueba 0009.pdf'), true);
    await c9.close();

    // ═══ 8. Sitios de manga y cómics (de la 2.8 a la 2.8.4: la extensión traía una lista incluida) ═══
    const conSitios = fs.existsSync(path.join(EXT, 'sitios.js'));
    const incluidos = conSitios ? require(path.join(EXT, 'sitios.js')).SITIOS.length : 0;
    if (conSitios && incluidos) {
      console.log('\n── Sitios de manga y cómics');
      const pop = await cdp.open(`chrome-extension://${b.extId}/popup.html`);
      await pop.waitFor(`document.readyState === 'complete' && !!globalThis.MR_SITIOS`, 'el popup');
      const total = await pop.eval('MR_SITIOS.SITIOS.length');
      await pop.eval(`document.querySelector('#btnSites').click()`);
      await pop.waitFor(`document.querySelectorAll('#lista .site').length > 0`, 'la lista de sitios');
      const nuevo = await pop.eval(`!!document.querySelector('#segIdioma')`);      // 2.8.3: división y filtro de idioma
      eq('la lista muestra todos los sitios incluidos', await pop.eval(`document.querySelectorAll('#lista .site').length`), total);
      if (nuevo) {
        const [nd, nl] = JSON.parse(await pop.eval(`JSON.stringify((() => { const d = MR_SITIOS.dividirSitios(MR_SITIOS.SITIOS); return [d.descargables.length, d.leer.length]; })())`));
        eq('  dividida en descargables y para leer, con la cantidad de cada una',
          await pop.eval(`[...document.querySelectorAll('#lista .sec')].map(h => h.querySelector('.sec-t').textContent + ' ' + h.querySelector('.sec-n').textContent).join(' | ')`),
          `📥 Descargables ${nd} | 👁 Para leer en el sitio ${nl}`);
        eq('  en "Descargables" todos se pueden bajar (✅ o 📥)',
          await pop.eval(`(() => { const i = [...document.querySelectorAll('.sec-body[data-sec="descargables"] .site-ico')].map(e => e.textContent); return i.length + ' ' + i.every(t => ['✅', '🟢', '📥'].includes(t)); })()`), `${nd} true`);
        eq('  en "Para leer" ninguno se puede bajar (👁 o ❔)',
          await pop.eval(`(() => { const i = [...document.querySelectorAll('.sec-body[data-sec="leer"] .site-ico')].map(e => e.textContent); return i.length + ' ' + i.every(t => ['👁', '❔'].includes(t)); })()`), `${nl} true`);
        eq('  y el contador', await pop.eval(`document.querySelector('#count').textContent`), `${total} sitios: ${nd} descargables y ${nl} para leer`);
      } else {
        eq('  y el contador', await pop.eval(`document.querySelector('#count').textContent`), `${total} sitios`);
      }
      eq('la "i" empieza cerrada', await pop.eval(`document.querySelector('#lista .site-info').hidden`), true);
      await pop.eval(`[...document.querySelectorAll('#lista .site')].find(s => s.textContent.includes('Pepper&Carrot')).querySelector('.site-i').click()`);
      eq('la "i" muestra tipo, si se guarda y la descripción',
        await pop.eval(`(() => { const s = [...document.querySelectorAll('#lista .site')].find(s => s.textContent.includes('Pepper&Carrot')); const i = s.querySelector('.site-info');
          return [i.hidden, i.querySelector('.site-kind').textContent, i.querySelector('.site-save').textContent, /David Revoy/.test(i.querySelector('.site-desc').textContent)].join(' | '); })()`),
        'false | Cómics · Gratis · Español e inglés | ✅ Se guarda con la extensión | true');
      await shot(pop, '8-sitios');
      const filtrar = async (sel) => { await pop.eval(`document.querySelector(${JSON.stringify(sel)}).click()`); return pop.eval(`document.querySelectorAll('#lista .site').length`); };
      const nManga = await filtrar('#seg [data-tipo="manga"]');
      eq('filtro Manga: solo sitios de manga, manhwa o webtoon',
        await pop.eval(`MR_SITIOS.filtrarSitios(MR_SITIOS.SITIOS, { tipo: 'manga' }).length`) === nManga && nManga > 0 && nManga < total, true);
      const nComics = await filtrar('#seg [data-tipo="comics"]');
      eq('filtro Cómics', await pop.eval(`MR_SITIOS.filtrarSitios(MR_SITIOS.SITIOS, { tipo: 'comics' }).length`) === nComics && nComics > 0, true);
      await filtrar('#seg [data-tipo="todos"]');
      const ordenado = (o) => JSON.stringify(o, Object.keys(o).sort());
      if (nuevo) {
        eq('idiomas para filtrar', await pop.eval(`[...document.querySelectorAll('#segIdioma button')].map(b => b.textContent).join(',')`), 'Todos,Español,Inglés');
        for (const [idioma, tag] of [['en', 'EN'], ['es', 'ES']]) {
          const nIdioma = await filtrar(`#segIdioma [data-idioma="${idioma}"]`);
          eq(`filtro ${tag}: solo sitios en ese idioma, en las dos secciones`,
            await pop.eval(`MR_SITIOS.filtrarSitios(MR_SITIOS.SITIOS, { idioma: '${idioma}' }).length`) === nIdioma && nIdioma > 0 && nIdioma < total &&
            await pop.eval(`[...document.querySelectorAll('#lista .site')].every(s => [...s.querySelectorAll('.tag')].some(t => t.textContent === '${tag}'))`), true);
        }
        eq('el filtro se recuerda', ordenado(await b.storage('sitiosFiltro')), '{"idioma":"es","plegadas":[],"tipo":"todos"}');
        await pop.eval(`document.querySelector('.sec[data-sec="leer"]').click()`);
        eq('plegar "Para leer": quedan solo los descargables', await pop.eval(`!document.querySelector('.sec-body[data-sec="leer"]') + ' ' + document.querySelector('.sec[data-sec="leer"]').getAttribute('aria-expanded') + ' ' + [...document.querySelectorAll('#lista .site-ico')].every(e => e.textContent !== '👁')`), 'true false true');
        eq('  y se recuerda', (await b.storage('sitiosFiltro')).plegadas.join(','), 'leer');
        await shot(pop, '8-sitios-plegado');
        await pop.eval(`document.querySelector('.sec[data-sec="leer"]').click()`);
        await filtrar('#segIdioma [data-idioma="todos"]');
        eq('desplegar y volver a "Todos"', await pop.eval(`document.querySelectorAll('#lista .site').length`), total);
      } else {
        const nGuardar = await filtrar('#soloGuardar');
        eq('filtro "Se pueden guardar": ninguno dice "solo para leer"', await pop.eval(`[...document.querySelectorAll('#lista .site-ico')].every(e => e.textContent !== '👁')`) && nGuardar < total, true);
        eq('el filtro se recuerda', ordenado(await b.storage('sitiosFiltro')), '{"soloEs":false,"soloGuardar":true,"tipo":"todos"}');
        await filtrar('#soloGuardar');
      }
      await pop.eval(`(() => { const q = document.querySelector('#buscar'); q.value = 'shueisha'; q.dispatchEvent(new Event('input')); })()`);
      const esperados = await pop.eval(`MR_SITIOS.filtrarSitios(MR_SITIOS.SITIOS, { texto: 'shueisha' }).map(s => s.nombre).sort().join(',')`);
      eq('buscar por texto de la descripción', esperados && await pop.eval(`[...document.querySelectorAll('#lista .site-name')].map(e => e.textContent).sort().join(',')`), esperados || '(ninguno)');
      await pop.close();

      // Agregar un sitio propio desde opciones, y abrirlo desde la lista
      await b.ext.eval(`(() => {
        document.querySelector('#sitioNombre').value = 'Mi lector de prueba';
        document.querySelector('#sitioUrl').value = '${SITE.replace('http://', '')}/manga/es/todos';
        document.querySelector('#sitioTipo').value = 'manga';
        document.querySelector('#sitioEs').checked = true;
        document.querySelector('#sitioDesc').value = 'Serie de prueba armada como el sitio real.';
        if (document.querySelector('#sitioDescarga')) document.querySelector('#sitioDescarga').checked = true;
        document.querySelector('#sitioGuardar').click(); })()`);
      await b.ext.waitFor(`/Agregado/.test(document.querySelector('#sitiosMsg').textContent)`, 'el sitio agregado');
      eq('mi sitio queda guardado (con https agregado)', (await b.storage('misSitios')).map(ordenado).join(),
        ordenado({ nombre: 'Mi lector de prueba', url: `https://${SITE.replace('http://', '')}/manga/es/todos`, tipo: 'manga', idiomas: ['es'], descripcion: 'Serie de prueba armada como el sitio real.', ...(nuevo ? { descargable: true } : {}) }));
      eq('  y aparece en la lista de opciones', await b.ext.eval(`document.querySelector('#misSitios .s-nombre').textContent`), 'Mi lector de prueba');
      // Editarlo para que apunte a http (el servidor de prueba no tiene https)
      await b.ext.eval(`(() => { document.querySelector('#misSitios button').click(); document.querySelector('#sitioUrl').value = '${SITE}/manga/es/todos'; document.querySelector('#sitioGuardar').click(); })()`);
      await b.ext.waitFor(`/Guardado/.test(document.querySelector('#sitiosMsg').textContent)`, 'el sitio editado');
      eq('editar mi sitio', (await b.storage('misSitios')).map(s => s.url).join(' '), `${SITE}/manga/es/todos`);
      await b.ext.eval(`(() => { document.querySelector('#sitioNombre').value = 'Repetido'; document.querySelector('#sitioUrl').value = '${SITE}/manga/es/todos/'; document.querySelector('#sitioGuardar').click(); })()`);
      await b.ext.waitFor(`/Ya está/.test(document.querySelector('#sitiosMsg').textContent)`, 'el aviso de repetido');
      eq('no deja agregar la misma dirección dos veces', (await b.storage('misSitios')).length, 1);
      await b.ext.eval(`document.querySelector('#sitioCancelar').click()`);

      const pop2 = await cdp.open(`chrome-extension://${b.extId}/popup.html`);
      await pop2.waitFor(`document.readyState === 'complete' && !!globalThis.MR_SITIOS`, 'el popup');
      await pop2.eval(`document.querySelector('#btnSites').click()`);
      await pop2.waitFor(`document.querySelectorAll('#lista .site').length > 0`, 'la lista');
      eq('mi sitio aparece primero, marcado TUYO', await pop2.eval(`(() => { const s = document.querySelector('#lista .site'); return s.querySelector('.site-name').textContent + ' · ' + s.querySelector('.tag.mio').textContent + ' · ' + s.querySelector('.site-ico').textContent; })()`), 'Mi lector de prueba · TUYO · ⭐');
      eq('  y suma uno al total', await pop2.eval(`document.querySelectorAll('#lista .site').length`), total + 1);
      if (nuevo) eq('  marcado "Se puede descargar", va primero en Descargables',
        await pop2.eval(`document.querySelector('.sec-body[data-sec="descargables"] .site .site-name').textContent`), 'Mi lector de prueba');
      const tabsAntes = await b.tabCount();
      await pop2.eval(`document.querySelector('#lista .site-open').click()`).catch(() => {});
      await sleep(1500);
      eq('tocar el nombre abre el sitio en una pestaña nueva', await b.ext.eval(`chrome.tabs.query({ url: ${JSON.stringify(SITE + '/manga/es/todos')} }).then(t => t.length)`), 1);
      eq('  (el popup se cierra solo)', (await b.tabCount()) - tabsAntes, 0);
      await b.ext.eval(`chrome.tabs.query({ url: ${JSON.stringify(SITE + '/manga/es/todos')} }).then(t => chrome.tabs.remove(t.map(x => x.id)))`);
      await b.ext.eval(`document.querySelector('#misSitios .danger').click()`);
      await sleep(400);
      eq('quitar mi sitio', (await b.storage('misSitios')).length, 0);
    }

    // ═══ 8b. Mi lista de sitios, pegada entera (2.8.5: la extensión ya no trae sitios) ═══
    if (conSitios && !incluidos) {
      console.log('\n── Mi lista de sitios (pegada entera)');
      const POPUP = `chrome-extension://${b.extId}/popup.html`;
      const abrirSitios = async () => {
        const p = await cdp.open(POPUP);
        await p.waitFor(`document.readyState === 'complete' && !!globalThis.MR_SITIOS`, 'el popup');
        await p.eval(`document.querySelector('#btnSites').click()`);
        return p;
      };
      const nombres = (p, dentro = '#lista') => p.eval(`[...document.querySelectorAll('${dentro} .site-name')].map(e => e.textContent).join(',')`);

      // Sin sitios: el popup explica cómo cargarlos
      const p0 = await abrirSitios();
      await p0.waitFor(`!!document.querySelector('#pegarLista')`, 'el aviso de lista vacía');
      eq('sin sitios cargados: el popup ofrece pegar la lista', await p0.eval(`document.querySelectorAll('#lista .site').length + ' · ' + document.querySelector('#pegarLista').textContent`), '0 · 📋 Pegar mi lista de sitios');
      await shot(p0, '8-sitios-vacio');
      await p0.close();

      // Pegar una lista en opciones: con títulos de grupo, link de Markdown, dirección sola, sin https:// y un repetido
      const pegar = (texto) => b.ext.eval(`(() => { const t = document.querySelector('#listaTexto'); t.value = ${JSON.stringify(texto)}; t.dispatchEvent(new Event('input')); })()`);
      await pegar(['Manga en español:',
        `Lector de prueba: ${SITE}/manga/es/todos — serie de prueba armada como el sitio real`,
        `- [Clásico](${SITE}/clasico/) con links y carga diferida`, '',
        'Cómics en inglés', 'https://comics.example/', 'www.tiras.example/hoy (tiras del día)', 'Otra vez: https://comics.example',
        'un renglón cualquiera sin dirección'].join('\n'));
      eq('pegar: muestra lo que detectó antes de agregar',
        await b.ext.eval(`document.querySelector('#listaVista').firstChild.textContent + ' ' + document.querySelectorAll('#listaVista li').length + ' · ' + document.querySelector('#listaAgregar').textContent`),
        'Encontré 4 sitios · 1 repetido en lo pegado: 4 · Agregar 4 sitios');
      await shot(b.ext, '8-pegar-lista');
      await b.ext.eval(`document.querySelector('#listaAgregar').click()`);
      await b.ext.waitFor(`/Agregados 4 sitios como descargables/.test(document.querySelector('#listaMsg').textContent)`, 'la lista agregada');
      eq('  quedan guardados con nombre, tipo, idioma y descripción detectados',
        (await b.storage('misSitios')).map(s => `${s.nombre}|${s.tipo}|${s.idiomas.join('+')}|${s.descargable}|${s.descripcion}`).join(' ; '),
        'Lector de prueba|manga|es|true|serie de prueba armada como el sitio real ; Clásico|manga|es|true|con links y carga diferida ; comics.example|comics|en|true| ; tiras.example|comics|en|true|tiras del día');
      eq('  y el cuadro queda vacío', await b.ext.eval(`document.querySelector('#listaTexto').value + '|' + document.querySelector('#listaAgregar').disabled`), '|true');

      // Otra lista, esta vez de sitios para leer, con uno que ya estaba
      await b.ext.eval(`document.querySelector('#listaDescarga').click()`);
      await pegar('Solo lectura: https://leer.example/ — manhwa en inglés\nhttps://comics.example/');
      eq('pegar otra lista: avisa lo que ya estaba',
        await b.ext.eval(`document.querySelector('#listaVista').firstChild.textContent + ' ' + document.querySelector('#listaAgregar').textContent`), 'Encontré 2 sitios · 1 ya está en tu lista: Agregar 1 sitio');
      await b.ext.eval(`document.querySelector('#listaAgregar').click()`);
      await b.ext.waitFor(`/Agregados 1 sitio como para leer · 1 ya estaba/.test(document.querySelector('#listaMsg').textContent)`, 'la segunda lista');
      eq('  la lista de opciones cuenta descargables y para leer', await b.ext.eval(`document.querySelector('#sitiosCuenta').textContent`), 'Tu lista: 5 sitios (4 descargables y 1 para leer)');
      await b.ext.eval(`(() => { const q = document.querySelector('#sitiosFiltro'); q.value = 'tiras'; q.dispatchEvent(new Event('input')); })()`);
      eq('  buscar en la lista de opciones', await b.ext.eval(`[...document.querySelectorAll('#misSitios .s-nombre')].map(e => e.textContent).join(',')`), 'tiras.example');
      await b.ext.eval(`(() => { const q = document.querySelector('#sitiosFiltro'); q.value = ''; q.dispatchEvent(new Event('input')); })()`);
      await b.ext.eval(`(() => { document.querySelector('#sitioNombre').value = 'Repetido'; document.querySelector('#sitioUrl').value = '${SITE}/clasico'; document.querySelector('#sitioGuardar').click(); })()`);
      await b.ext.waitFor(`/Ya está/.test(document.querySelector('#sitiosMsg').textContent)`, 'el aviso de repetido');
      eq('  agregar a mano uno que ya está: no lo repite', (await b.storage('misSitios')).length, 5);
      await b.ext.eval(`document.querySelector('#sitioCancelar').click()`);

      // En el popup: dividida, con filtros de tipo e idioma
      const pop = await abrirSitios();
      await pop.waitFor(`document.querySelectorAll('#lista .site').length === 5`, 'la lista');
      eq('popup: la lista dividida, con la cantidad de cada sección',
        await pop.eval(`[...document.querySelectorAll('#lista .sec')].map(h => h.querySelector('.sec-t').textContent + ' ' + h.querySelector('.sec-n').textContent).join(' | ')`), '📥 Descargables 4 | 👁 Para leer en el sitio 1');
      eq('  cada sitio en su sección', await nombres(pop, '.sec-body[data-sec="descargables"]') + ' / ' + await nombres(pop, '.sec-body[data-sec="leer"]'),
        'Clásico,comics.example,Lector de prueba,tiras.example / Solo lectura');
      eq('  contador', await pop.eval(`document.querySelector('#count').textContent`), '5 sitios: 4 descargables y 1 para leer');
      eq('  idiomas para filtrar', await pop.eval(`[...document.querySelectorAll('#segIdioma button')].map(b => b.textContent).join(',')`), 'Todos,Español,Inglés');
      await pop.eval(`document.querySelector('#segIdioma [data-idioma="es"]').click()`);
      eq('  filtro Español', await nombres(pop), 'Clásico,Lector de prueba');
      eq('  el filtro se recuerda', JSON.stringify(await b.storage('sitiosFiltro'), ['idioma', 'plegadas', 'tipo']), '{"idioma":"es","plegadas":[],"tipo":"todos"}');
      await pop.eval(`document.querySelector('#segIdioma [data-idioma="todos"]').click(); document.querySelector('#seg [data-tipo="comics"]').click()`);
      eq('  filtro Cómics', await nombres(pop), 'comics.example,tiras.example');
      await pop.eval(`document.querySelector('#seg [data-tipo="manga"]').click()`);
      eq('  filtro Manga (incluye manhwa)', await nombres(pop), 'Clásico,Lector de prueba,Solo lectura');
      await pop.eval(`document.querySelector('#seg [data-tipo="todos"]').click()`);
      await pop.eval(`[...document.querySelectorAll('#lista .site')].find(s => s.textContent.includes('Solo lectura')).querySelector('.site-i').click()`);
      eq('  la "i" muestra tipo, idioma, sección y descripción',
        await pop.eval(`(() => { const i = [...document.querySelectorAll('#lista .site')].find(s => s.textContent.includes('Solo lectura')).querySelector('.site-info');
          return [i.hidden, i.querySelector('.site-kind').textContent, i.querySelector('.site-save').textContent, i.querySelector('.site-desc').textContent].join(' | '); })()`),
        'false | Manhwa · Inglés | ⭐ Agregado por vos · lo marcaste para leer | manhwa en inglés');
      await shot(pop, '8-sitios');
      await pop.eval(`document.querySelector('.sec[data-sec="leer"]').click()`);
      eq('  plegar "Para leer" deja solo los descargables, y se recuerda', await nombres(pop) + ' · ' + (await b.storage('sitiosFiltro')).plegadas.join(','), 'Clásico,comics.example,Lector de prueba,tiras.example · leer');
      await pop.eval(`document.querySelector('.sec[data-sec="leer"]').click()`);
      await pop.eval(`(() => { const q = document.querySelector('#buscar'); q.value = 'diferida'; q.dispatchEvent(new Event('input')); })()`);
      eq('  buscar por texto de la descripción', await nombres(pop), 'Clásico');
      await pop.eval(`(() => { const q = document.querySelector('#buscar'); q.value = ''; q.dispatchEvent(new Event('input')); })()`);
      const tabsAntes = await b.tabCount();
      await pop.eval(`[...document.querySelectorAll('#lista .site')].find(s => s.textContent.includes('Lector de prueba')).querySelector('.site-open').click()`).catch(() => {});
      await sleep(1500);
      eq('  tocar el nombre abre el sitio en una pestaña nueva', await b.ext.eval(`chrome.tabs.query({ url: ${JSON.stringify(SITE + '/manga/es/todos')} }).then(t => t.length)`), 1);
      eq('  (el popup se cierra solo)', (await b.tabCount()) - tabsAntes, 0);
      await b.ext.eval(`chrome.tabs.query({ url: ${JSON.stringify(SITE + '/manga/es/todos')} }).then(t => chrome.tabs.remove(t.map(x => x.id)))`);

      // Quitar uno, y quitar todos
      await b.ext.eval(`document.querySelector('#misSitios .danger').click()`);
      await b.ext.waitFor(`/4 sitios/.test(document.querySelector('#sitiosCuenta').textContent)`, 'el sitio quitado');
      eq('quitar uno', (await b.storage('misSitios')).map(s => s.nombre).join(','), 'Clásico,comics.example,tiras.example,Solo lectura');
      await b.ext.eval(`window.confirm = () => true; document.querySelector('#sitiosQuitarTodos').click()`);
      await b.ext.waitFor(`document.querySelector('#sitiosCuenta').textContent === 'Tu lista'`, 'la lista vacía');
      eq('quitar todos', (await b.storage('misSitios')).length + ' · ' + await b.ext.eval(`document.querySelector('#sitiosQuitarTodos').hidden`), '0 · true');
    }

    // ═══ 9. Páginas sin dirección (blob:), direcciones con código y lotes que no encuentran nada (2.8.1) ═══
    // De la 2.8.1 a la 2.9.0 la extensión avisaba con 🔒 que el sitio protege las páginas. En
    // la 2.9.1 se sacó el aviso: no las guarda igual, y dice que no encontró páginas.
    const v9 = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version.split('.').map(Number);
    const conAviso = /PROTECTED_MSG/.test(fs.readFileSync(path.join(EXT, 'content.js'), 'utf8'));
    const sinAviso = !conAviso && (v9[0] > 2 || (v9[0] === 2 && (v9[1] > 9 || (v9[1] === 9 && v9[2] >= 1))));
    if (conAviso || sinAviso) {
      console.log('\n── Páginas sin dirección para bajar y direcciones con código');
      const PROT = `${SITE}/protegido/viewer/2010289`;
      const tabsP = await b.tabCount();
      const pr = await cdp.open(PROT);
      await pr.waitFor(`document.querySelectorAll('#pages img').length === 4 && [...document.querySelectorAll('#pages img')].every(i => i.complete)`, 'el lector protegido');
      await sleep(2500);
      eq('en un sitio protegido no aparece la burbuja', await pr.eval(`!!document.querySelector('#mr-fab')`), false);
      await b.command(PROT, 'save');
      if (conAviso) {
        await pr.waitFor(`/🔒/.test(document.querySelector('#mr-save-count')?.textContent || '')`, 'el aviso de páginas protegidas', 30000);
        eq('guardar: avisa que el sitio protege las páginas', (await pr.eval(`document.querySelector('#mr-save-count').textContent`)).startsWith('🔒 Este sitio protege las páginas del capítulo'), true);
      } else {
        await pr.waitFor(`/^No encontré/.test(document.querySelector('#mr-save-count')?.textContent || '')`, 'el resultado de la búsqueda de páginas', 30000);
        eq('guardar: dice que no encontró páginas, sin un aviso especial',
          // (la serie de prueba se llama "Serie Protegida": se busca el texto del aviso, no esa palabra)
          await pr.eval(`document.querySelector('#mr-save-count').textContent + ' · ' + /🔒|protege|cifrad/i.test(document.querySelector('#mr-save').textContent) + ' · ' + getComputedStyle(document.querySelector('#mr-save-warn')).display`),
          'No encontré páginas del capítulo en esta página. · false · none');
        eq('  el motivo de las miniaturas tampoco lo nombra', await pr.eval(`document.querySelector('#mr-save .mr-thumb').title`), 'Posible publicidad: no parece una página del capítulo · clic para incluir');
      }
      eq('  nombre con "[#104] Serie"', await pr.eval(`document.querySelector('#mr-save-name').value`), 'Serie Protegida/Serie Protegida 0104');
      eq('  logo, banner y promoción vienen destildados',
        await pr.eval(`[...document.querySelectorAll('#mr-save .mr-thumb')].map(b => b.classList.contains('on') ? 'P' : 'x').join(' ')`), 'x x x');
      eq('  no deja guardar ni inventa el siguiente', await pr.eval(`document.querySelector('#mr-save-go').disabled + ' ' + document.querySelector('#mr-save-next').hidden`), 'true true');
      await shot(pr, '9-protegido');

      await b.command(PROT, 'batch');
      await pr.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo de varios capítulos');
      eq('varios: no supone una dirección', await pr.eval(`JSON.stringify(document.querySelector('#mr-chapter-tpl').value) + ' ' + document.querySelector('#mr-chapter-more').open`), '"" true');
      eq('  explica que la dirección lleva un código', /2010289 es un código del sitio, no el capítulo 104/.test(await pr.eval(`document.querySelector('#mr-chapter-why').hidden ? '' : document.querySelector('#mr-chapter-why').textContent`)), true);
      await lote.rango(pr, 100, 104);
      eq('  del 100 al 104 marca solo el que tiene dirección', await lote.filas(pr), '104*');
      await pr.eval(`document.querySelector('#mr-chapter-go').click()`);
      const doneP = await lote.fin(pr, 90000);
      if (conAviso) {
        eq('  al descargar para enseguida y dice por qué', doneP.split('\n')[0] + ' / ' + doneP.split('\n')[1].startsWith('🔒 Este sitio protege las páginas'), 'Parado: 0 capítulos guardados / true');
        eq('  la fila', await lote.filas(pr), '104* [⚠️ protegido]');
      } else {
        eq('  al descargar lo informa como cualquier capítulo sin páginas', doneP.split('\n').slice(0, 2).join(' / ') + ' · ' + /🔒|protege|cifrad/i.test(doneP),
          'Listo: 0 capítulos guardados · 1 con problemas / Capítulo 104: Sin páginas (encontré 0) · false');
        eq('  la fila', await lote.filas(pr), '104* [⚠️ sin páginas]');
      }
      eq('  no se guardó nada', b.existe('Serie Protegida'), false);
      eq('  no quedan pestañas abiertas', await b.tabCount(), tabsP + 1);
      await pr.close();

      // Capítulos que no existen: el lote para a los 3 seguidos, en vez de abrir uno por uno
      const vac = await cdp.open(`${SITE}/manga/es/todos/12`);
      await vac.waitFor(`document.querySelectorAll('img.list-manga').length === 6`, 'el capítulo');
      await b.command(`${SITE}/manga/es/todos/12`, 'batch');
      await vac.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo');
      await lote.rango(vac, 2001, 2006);
      await vac.eval(`document.querySelector('#mr-chapter-go').click()`);
      const doneV = await lote.fin(vac, 120000);
      eq('3 seguidos sin páginas: para y dice por qué', doneV.split('\n')[0] + ' / ' + doneV.split('\n')[1].startsWith('Los primeros 3 capítulos no tenían páginas'),
        'Parado: 0 capítulos guardados · 3 con problemas / true');
      eq('  no siguió con el resto', await lote.filas(vac), '12 | 2001* [⚠️ sin páginas] | 2002* [⚠️ sin páginas] | 2003* [⚠️ sin páginas] | 2004* | 2005* | 2006*');
      eq('  abre la dirección para revisarla', await vac.eval(`document.querySelector('#mr-chapter-more').open`), true);
      await vac.close();
    }

    // ═══ 10. Sitio con el número dentro del nombre de la página (2.8.4) ═══
    const [vA, vB, vC] = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version.split('.').map(Number);
    if (vA > 2 || (vA === 2 && (vB > 8 || (vB === 8 && vC >= 4)))) {
      console.log('\n── Sitio con el número en el nombre de la página, título con un año y canvas de adorno');
      const FAN = `${SITE}/fan/leer/serie-fan-manga-`;
      const tabsF = await b.tabCount();
      const fl = await cdp.open(`${SITE}/fan/serie/1234567-serie-fan/`);
      await fl.waitFor(`document.readyState === 'complete'`, 'el listado');
      await b.command(`${SITE}/fan/serie/1234567-serie-fan/`, 'batch');
      await fl.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo');
      eq('listado con un código en su dirección: toma los capítulos de los links', await lote.filas(fl), '1 | 2 | 3');
      eq('  molde con el número en el nombre y barra final, sin aviso de código',
        await fl.eval(`document.querySelector('#mr-chapter-tpl').value + ' · ' + document.querySelector('#mr-chapter-why').hidden`), `${FAN}{n}/ · true`);
      await fl.eval(`document.querySelector('#mr-chapter-all').click(); document.querySelector('#mr-chapter-go').click()`);
      eq('  baja los tres', (await lote.fin(fl)).split('\n')[0], '✅ Listo: 3 capítulos guardados');
      eq('  nombre: el número de la dirección, no el año del título', b.ls('Serie Fan').replace(/Serie Fan /g, ''), '0001 0001.cbz 0001.pdf 0002 0002.cbz 0002.pdf 0003 0003.cbz 0003.pdf');
      eq('  6 páginas con carga diferida, sin el logo', pdfPages(file('Serie Fan/Serie Fan 0002.pdf')), '6 × 420x640');
      eq('  no quedan pestañas abiertas', await b.tabCount(), tabsF + 1);
      await fl.close();

      const fc = await cdp.open(`${FAN}2/`);
      await fc.waitFor(`document.readyState === 'complete'`, 'el capítulo');
      await b.command(`${FAN}2/`, 'save');
      await fc.waitFor(`/^6 de 7 páginas/.test(document.querySelector('#mr-save-count')?.textContent || '')`, 'las páginas del capítulo', 40000);
      eq('capítulo: 6 páginas y el logo aparte; los canvas no lo dan por protegido',
        (await fc.eval(`document.querySelector('#mr-save-count').textContent`)).slice(0, 14) + ' · ' + await fc.eval(`document.querySelector('#mr-save-count').classList.contains('mr-locked')`), '6 de 7 páginas · false');
      eq('  nombre y aviso de ya guardado', await fc.eval(`document.querySelector('#mr-save-name').value + ' · ' + /^✔ Ya lo guardaste/.test(document.querySelector('#mr-save-seen').textContent)`), 'Serie Fan/Serie Fan 0002 · true');
      eq('  ofrece "Guardar y siguiente"', await fc.eval(`document.querySelector('#mr-save-next').hidden`), false);
      await b.command(`${FAN}2/`, 'batch');
      await fc.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo de varios capítulos');
      eq('  varios capítulos desde el capítulo: molde y lista con los ya guardados',
        await fc.eval(`document.querySelector('#mr-chapter-tpl').value`) + ' · ' + await lote.filas(fc), `${FAN}{n}/ · 1 [✔ guardado] | 2 [✔ guardado] | 3 [✔ guardado]`);
      await shot(fc, '10-sitio-fan');
      await fc.close();
    }

    // ═══ 11. Sitio armado como un blog: el archivo por mes no son capítulos (2.8.6) ═══
    if (vA > 2 || (vA === 2 && (vB > 8 || (vB === 8 && vC >= 6)))) {
      console.log('\n── Sitio con archivo por mes (enero 2021, febrero 2021…)');
      const BLOG = `${SITE}/blog/`;
      const tabsB = await b.tabCount();
      const bl = await cdp.open(BLOG);
      await bl.waitFor(`document.readyState === 'complete'`, 'el inicio del blog');
      await b.command(BLOG, 'batch');
      await bl.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo');
      eq('la lista son los capítulos, no los meses ni los días', await lote.filas(bl), '1 | 2 | 3 | 4');
      eq('  con el nombre de cada capítulo', await bl.eval(`[...document.querySelectorAll('#mr-chapter .mr-chapter-t')].map(e => e.textContent).join(',')`),
        'Serie Blog Manga 1,Serie Blog Manga 2,Serie Blog Manga 3,Serie Blog Manga 4');
      eq('  y la dirección de los capítulos', await bl.eval(`document.querySelector('#mr-chapter-tpl').value`), `${BLOG}leer/serie-blog-manga-{n}/`);
      await shot(bl, '11-blog');
      hits.blogArchivo = 0;
      await lote.rango(bl, 1, 2);
      await bl.eval(`document.querySelector('#mr-chapter-go').click()`);
      eq('del 1 al 2: baja los capítulos 1 y 2', (await lote.fin(bl)).split('\n')[0], '✅ Listo: 2 capítulos guardados');
      eq('  cada uno con su nombre', b.ls('Serie Blog').replace(/Serie Blog /g, ''), '0001 0001.cbz 0001.pdf 0002 0002.cbz 0002.pdf');
      eq('  y solo sus 6 páginas (no las del mes entero)', pdfPages(file('Serie Blog/Serie Blog 0001.pdf')) + ' · ' + pdfPages(file('Serie Blog/Serie Blog 0002.pdf')), '6 × 420x640 · 6 × 420x640');
      eq('  sin abrir ninguna página del archivo', hits.blogArchivo, 0);
      eq('  no quedan pestañas abiertas', await b.tabCount(), tabsB + 1);
      await bl.close();

      // Desde un capítulo y desde la página de un mes
      const bc = await cdp.open(`${BLOG}leer/serie-blog-manga-3/`);
      await bc.waitFor(`document.readyState === 'complete'`, 'el capítulo');
      await b.command(`${BLOG}leer/serie-blog-manga-3/`, 'batch');
      await bc.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo');
      eq('desde un capítulo: sin meses en la lista', await lote.filas(bc) + ' · ' + await bc.eval(`document.querySelector('#mr-chapter-tpl').value`), `3 · ${BLOG}leer/serie-blog-manga-{n}/`);
      await bc.close();
      const bm = await cdp.open(`${BLOG}2021/01/`);
      await bm.waitFor(`document.readyState === 'complete'`, 'la página del mes');
      await b.command(`${BLOG}2021/01/`, 'batch');
      await bm.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo');
      eq('desde la página de un mes: ofrece los capítulos de ese mes, no "el capítulo 1" de 2021',
        await lote.filas(bm) + ' · ' + await bm.eval(`document.querySelector('#mr-chapter-tpl').value`), `1 [✔ guardado] | 2 [✔ guardado] · ${BLOG}leer/serie-blog-manga-{n}/`);
      await bm.close();
    }

    // ═══ 12. Dirección terminada en un archivo, sin el número al final ni links: no se inventa nada (2.8.7) ═══
    if (vA > 2 || (vA === 2 && (vB > 8 || (vB === 8 && vC >= 7)))) {
      console.log('\n── Capítulo en una dirección ….html sin el número al final');
      const tabsH = await b.tabCount();
      const bh = await cdp.open(SITE + BLOG_HTML);
      await bh.waitFor(`document.readyState === 'complete'`, 'el capítulo');
      await b.command(SITE + BLOG_HTML, 'save');
      await bh.waitFor(`/^6 de 6 páginas/.test(document.querySelector('#mr-save-count')?.textContent || '')`, 'las páginas del capítulo', 40000);
      eq('guardar el capítulo abierto anda igual: 6 páginas, sin "siguiente" inventado',
        (await bh.eval(`document.querySelector('#mr-save-count').textContent`)).slice(0, 14) + ' · ' + await bh.eval(`document.querySelector('#mr-save-next').hidden`), '6 de 6 páginas · true');
      hits.blogInventada = 0;
      await b.command(SITE + BLOG_HTML, 'batch');
      await bh.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo de varios capítulos');
      eq('varios capítulos: no supone "dirección + /número"', await bh.eval(`JSON.stringify(document.querySelector('#mr-chapter-tpl').value) + ' ' + document.querySelector('#mr-chapter-more').open`), '"" true');
      eq('  explica por qué no encontró los otros capítulos',
        /^⚠️ No encontré los otros capítulos: la dirección de esta página \(…\/serie-blog-manga-3-espanol\.html\) no termina en el número/.test(
          await bh.eval(`document.querySelector('#mr-chapter-why').hidden ? '' : document.querySelector('#mr-chapter-why').textContent`)), true);
      eq('  la lista queda vacía y no ofrece marcar un rango', await lote.filas(bh) + '|' + await bh.eval(`document.querySelector('#mr-chapter-count').textContent`), '|No encontré capítulos en esta página.');
      await lote.rango(bh, 1, 5);
      eq('  "del 1 al 5" no marca nada y dice qué falta',
        await lote.filas(bh) + '|' + await bh.eval(`document.querySelector('#mr-chapter-status').textContent + '|' + document.querySelector('#mr-chapter-go').disabled`),
        '|Sin una dirección con {n} solo se pueden marcar los capítulos de la lista|true');
      await shot(bh, '12-archivo-html');
      await sleep(1500);
      eq('  no abrió ninguna pestaña ni pidió una dirección inventada', `${(await b.tabCount()) - tabsH} ${hits.blogInventada}`, '1 0');
      // Con la dirección escrita a mano, el rango vuelve a funcionar
      await bh.eval(`(() => { const t = document.querySelector('#mr-chapter-tpl'); t.value = ${JSON.stringify(`${SITE}/blog/leer/serie-blog-manga-{n}/`)}; t.dispatchEvent(new Event('change')); })()`);
      await lote.rango(bh, 3, 4);
      eq('  escribiendo la dirección con {n}, el rango marca', await lote.filas(bh), '3* | 4*');
      await bh.close();
    }

    // ═══ 13. Pegar los links de los capítulos (2.9) ═══
    if (vA > 2 || (vA === 2 && vB >= 9)) {
      console.log('\n── Pegar los links de los capítulos');
      const tabsL = await b.tabCount();
      const pl = await cdp.open(SITE + BLOG_HTML);            // una página donde la extensión no puede armar la lista
      await pl.waitFor(`document.readyState === 'complete'`, 'el capítulo');
      await b.command(SITE + BLOG_HTML, 'batch');
      await pl.waitFor(`!!document.querySelector('#mr-chapter-links-go')`, 'el diálogo de varios capítulos');
      const pegarLinks = (texto, modo = 'auto', desde = '') => pl.eval(`(() => {
        document.querySelector('#mr-chapter-paste').open = true;
        document.querySelector('#mr-chapter-links').value = ${JSON.stringify(texto)};
        document.querySelector('#mr-chapter-links-mode').value = ${JSON.stringify(modo)};
        document.querySelector('#mr-chapter-links-from').value = ${JSON.stringify(String(desde))};
        document.querySelector('#mr-chapter-links-go').click(); })()`);
      const msgLinks = () => pl.eval(`document.querySelector('#mr-chapter-links-msg').textContent`);
      const cap = (mes, n) => `${SITE}/blog/2021/${mes}/serie-blog-manga-${n}-espanol.html`;

      await pegarLinks('');
      eq('sin links: lo dice y no cambia la lista', await msgLinks() + '|' + await lote.filas(pl), 'No encontré ningún link en lo que pegaste.|');

      // Pegado "como venga": títulos, número adelante en algunos, fuera de orden, uno repetido.
      // El número está en el medio del nombre de cada página y la carpeta del mes cambia.
      await pegarLinks(['Capítulos 01–04', '', `04: ${cap('04', '4')}`, `01: ${cap('01', '01')}`, cap('02', '3'), cap('01', '02'), `${cap('01', '01')}#repetido`, 'fin de la lista'].join('\n'));
      eq('lee los links con el número de cada uno, ordenados y todos marcados', await lote.filas(pl), '1* | 2* | 3* | 4*');
      eq('  dice qué hizo', await msgLinks(), 'Tomé 4 links: capítulos 1 a 4, con el número que trae cada link. 1 repetido no entró. Escribí el nombre de la serie en "Serie".');
      eq('  deja el rango y el campo Serie a la vista',
        await pl.eval(`document.querySelector('#mr-chapter-from').value + '-' + document.querySelector('#mr-chapter-to').value + ' ' + document.querySelector('#mr-chapter-more').open + ' ' + document.querySelector('#mr-chapter-go').textContent`), '1-4 true Descargar 4 capítulos');
      await shot(pl, '13-pegar-links');
      await pl.eval(`document.querySelector('#mr-chapter-serie').value = 'Serie Pegada'; document.querySelector('#mr-chapter-go').click()`);
      eq('descarga los 4', (await lote.fin(pl)).split('\n')[0], '✅ Listo: 4 capítulos guardados');
      eq('  con la serie escrita y el número de cada link', (b.ls('Serie Pegada').match(/Serie Pegada \d+\.pdf/g) || []).join(' | '), 'Serie Pegada 0001.pdf | Serie Pegada 0002.pdf | Serie Pegada 0003.pdf | Serie Pegada 0004.pdf');
      eq('  cada uno con sus 6 páginas', pdfPages(file('Serie Pegada/Serie Pegada 0002.pdf')) + ' · ' + pdfPages(file('Serie Pegada/Serie Pegada 0004.pdf')), '6 × 420x640 · 6 × 420x640');
      eq('  y quedan anotados como guardados, con su dirección', (await b.storage('savedChapters'))['Serie Pegada/Serie Pegada 0002']?.url, cap('01', '02'));
      eq('  no quedan pestañas abiertas', await b.tabCount(), tabsL + 1);

      // Volver a pegar los mismos: figuran guardados y se saltean
      await pegarLinks([cap('01', '01'), cap('01', '02')].join('\n'));
      eq('pegar links ya guardados: se saltean', await lote.filas(pl) + ' · ' + await pl.eval(`document.querySelector('#mr-chapter-go').textContent`), '1* [✔ guardado] | 2* [✔ guardado] · Descargar 0 capítulos');

      // Links sin número, de otro sitio (localhost en vez de 127.0.0.1): se numeran en el orden pegado
      const OTRO = SITE.replace('127.0.0.1', 'localhost');
      const sueltos = ['la-llegada', 'el-torneo', 'el-final'].map(s => `${OTRO}/sueltos/${s}.html`).join('\n');
      await pegarLinks(sueltos, 'reverse', 50);
      eq('"al revés": el último pegado es el primero', await pl.eval(`[...document.querySelectorAll('#mr-chapter .mr-chapter-item')].map(r => r.querySelector('.mr-chapter-n').textContent + ' ' + r.querySelector('.mr-chapter-t').textContent).join(' | ')`), '50 el final | 51 el torneo | 52 la llegada');
      await pegarLinks(sueltos, 'auto', 50);
      eq('sin número en los links: en el orden pegado, desde el que se pida', await pl.eval(`[...document.querySelectorAll('#mr-chapter .mr-chapter-item')].map(r => r.querySelector('.mr-chapter-n').textContent + ' ' + r.querySelector('.mr-chapter-t').textContent).join(' | ')`), '50 la llegada | 51 el torneo | 52 el final');
      eq('  y lo avisa', await msgLinks(), 'Tomé 3 links: capítulos 50 a 52, numerados en el orden en que los pegaste, desde 50. No encontré el número en los links.');
      await pl.eval(`document.querySelector('#mr-chapter-serie').value = 'Serie Suelta'; document.querySelector('#mr-chapter-go').click()`);
      eq('descarga los 3 de otro sitio', (await lote.fin(pl)).split('\n')[0], '✅ Listo: 3 capítulos guardados');
      eq('  el número es el de la lista, aunque el título de uno termine en 2026', (b.ls('Serie Suelta').match(/Serie Suelta \d+\.pdf/g) || []).join(' | '), 'Serie Suelta 0050.pdf | Serie Suelta 0051.pdf | Serie Suelta 0052.pdf');
      eq('  6 páginas', pdfPages(file('Serie Suelta/Serie Suelta 0051.pdf')), '6 × 420x640');
      eq('  no quedan pestañas abiertas', await b.tabCount(), tabsL + 1);
      await pl.close();
    }

    // ═══ 14. Tomos y plantilla de nombres (2.10) ═══
    if (vA > 2 || (vA === 2 && vB >= 10)) {
      console.log('\n── Tomos y plantilla de nombres');
      const tabsT = await b.tabCount();
      const tm = await cdp.open(`${SITE}/tomos/`);
      await tm.waitFor(`document.readyState === 'complete'`, 'el listado');
      await b.command(`${SITE}/tomos/`, 'batch');
      await tm.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo');
      const vista = () => tm.eval(`(() => { const q = (s) => ${RAIZ}.querySelector(s); return (q('#mr-chapter-tabs').hidden ? 'sin pestañas' : 'pestañas') + ' · ' +
        (q('#mr-tab-tomos').classList.contains('on') ? 'Tomos' : 'Capítulos') + ' · lista ' + (getComputedStyle(q('#mr-chapter-list')).display === 'none' ? 'oculta' : 'a la vista') +
        ' · tomos ' + (getComputedStyle(q('#mr-tomos-list')).display === 'none' ? 'ocultos' : 'a la vista'); })()`);
      const tomosFilas = () => tm.eval(`[...document.querySelectorAll('#mr-tomos-list .mr-tomo-item')].map(r => { const i = r.querySelector('input');
        return r.querySelector('.mr-chapter-t').textContent + ' [' + r.querySelector('.mr-chapter-r').textContent + '] ' + r.querySelector('.mr-chapter-s').textContent + (i.checked ? ' *' : i.indeterminate ? ' ~' : ''); }).join(' | ')`);
      const boton = () => tm.eval(`document.querySelector('#mr-chapter-go').textContent`);
      eq('capítulos de la página, sin repetir el de "Últimos capítulos"', await lote.filas(tm), '1 | 2 | 3 | 4 | 5 | 6');
      eq('la página separa en tomos: aparecen las pestañas, con Capítulos a la vista', await vista(), 'pestañas · Capítulos · lista a la vista · tomos ocultos');
      await tm.eval(`document.querySelector('#mr-tab-tomos').click()`);
      eq('pestaña Tomos', await vista(), 'pestañas · Tomos · lista oculta · tomos a la vista');
      eq('  agrupa por el título que cada capítulo tiene encima; el suelto va aparte', await tomosFilas(),
        'Tomo 1: El comienzo [1 a 2] 2 capítulos | Tomo 2: La huida [3 a 5] 3 capítulos | Sin volumen [6] 1 capítulo');
      await tm.eval(`document.querySelectorAll('#mr-tomos-list input')[1].click()`);
      eq('tildar un tomo marca sus capítulos', await lote.filas(tm) + ' · ' + await boton(), '1 | 2 | 3* | 4* | 5* | 6 · Descargar 3 capítulos');
      eq('  y queda tildado', await tomosFilas(), 'Tomo 1: El comienzo [1 a 2] 2 capítulos | Tomo 2: La huida [3 a 5] 3 capítulos * | Sin volumen [6] 1 capítulo');
      await tm.eval(`document.querySelector('#mr-tab-cap').click()`);
      await tm.eval(`document.querySelectorAll('#mr-chapter-list .mr-chapter-item input')[3].click()`);       // se destilda el 4
      await tm.eval(`document.querySelector('#mr-tab-tomos').click()`);
      eq('destildar un capítulo deja su tomo tildado a medias', await tomosFilas() + ' · ' + await boton(),
        'Tomo 1: El comienzo [1 a 2] 2 capítulos | Tomo 2: La huida [3 a 5] 3 capítulos ~ | Sin volumen [6] 1 capítulo · Descargar 2 capítulos');
      await tm.eval(`document.querySelectorAll('#mr-tomos-list input')[1].click()`);                           // a medias → tildado entero
      await tm.eval(`document.querySelectorAll('#mr-tomos-list input')[0].click()`);
      await tm.eval(`document.querySelectorAll('#mr-tomos-list input')[0].click()`);                           // y el tomo 1, ida y vuelta
      eq('destildar un tomo desmarca los suyos y no toca los demás', await lote.filas(tm), '1 | 2 | 3* | 4* | 5* | 6');
      await shot(tm, '14-tomos');

      // Plantilla de nombres con tomo y título. La serie queda automática (sale del título de cada capítulo).
      const TPL = '{serie}/{volumen}/{serie} {numero} - {titulo}';
      await b.setStorage({ esquemaNombres: TPL });
      await tm.waitFor(`/Tomo 2/.test(document.querySelector('#mr-chapter-ruta').textContent)`, 'el ejemplo con la plantilla nueva');
      eq('el diálogo muestra cómo va a quedar el primero marcado', await tm.eval(`document.querySelector('#mr-chapter-ruta').textContent`),
        'Ejemplo: Descargas/MangaReader/(serie)/Tomo 2- La huida/(serie) 0003 - Capítulo 3 · la serie sale del título de cada capítulo');
      await tm.eval(`(() => { const i = document.querySelector('#mr-chapter-serie'); i.value = 'Mi Serie'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      eq('  y con la serie escrita, el ejemplo la usa', await tm.eval(`document.querySelector('#mr-chapter-ruta').textContent`),
        'Ejemplo: Descargas/MangaReader/Mi Serie/Tomo 2- La huida/Mi Serie 0003 - Capítulo 3');
      await tm.eval(`(() => { const i = document.querySelector('#mr-chapter-serie'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await tm.eval(`document.querySelector('#mr-chapter-go').click()`);
      eq('descarga el tomo', (await lote.fin(tm)).split('\n')[0], '✅ Listo: 3 capítulos guardados');
      eq('  cada capítulo en la carpeta de su tomo, con su nombre de la lista', (b.ls('Serie Tomos/Tomo 2- La huida').match(/Serie Tomos \d+ - Capítulo \d\.pdf/g) || []).join(' | '),
        'Serie Tomos 0003 - Capítulo 3.pdf | Serie Tomos 0004 - Capítulo 4.pdf | Serie Tomos 0005 - Capítulo 5.pdf');
      eq('  con sus 6 páginas', pdfPages(file('Serie Tomos/Tomo 2- La huida/Serie Tomos 0004 - Capítulo 4.pdf')), '6 × 420x640');
      const reg = (await b.storage('savedChapters'))['Serie Tomos/Tomo 2- La huida/Serie Tomos 0003 - Capítulo 3'] || {};
      eq('  anotado con su serie y su número (el nombre ya no los dice)', `${reg.serie} ${reg.numero} · ${reg.pages} páginas`, 'Serie Tomos 3 · 6 páginas');
      eq('  el tomo muestra cuántos tiene guardados', await tomosFilas(),
        'Tomo 1: El comienzo [1 a 2] 2 capítulos | Tomo 2: La huida [3 a 5] 3 capítulos · 3 ✔ | Sin volumen [6] 1 capítulo');
      eq('  no quedan pestañas abiertas', await b.tabCount(), tabsT + 1);

      // El capítulo suelto: sin tomo no queda una carpeta vacía ni un guion colgando
      await tm.eval(`document.querySelectorAll('#mr-tomos-list input')[2].click(); document.querySelector('#mr-chapter-go').click()`);
      eq('capítulo sin tomo', (await lote.fin(tm)).split('\n')[0] + ' · ' + b.existe('Serie Tomos/Serie Tomos 0006 - Capítulo 6.pdf'), '✅ Listo: 1 capítulo guardado · true');
      await tm.close();

      // Guardando de a uno no hay tomo ni título: la misma plantilla da el nombre sin esos huecos
      const t1 = await cdp.open(`${SITE}/tomos/leer/1`);
      await t1.waitFor(`document.readyState === 'complete'`, 'el capítulo');
      await b.command(`${SITE}/tomos/leer/1`, 'save');
      await t1.waitFor(`!!document.querySelector('#mr-save-name') && document.querySelector('#mr-save-name').value`, 'el diálogo de guardar');
      eq('guardar de a uno con la plantilla', await t1.eval(`document.querySelector('#mr-save-name').value`), 'Serie Tomos/Serie Tomos 0001');
      // Cambiar la plantilla vale en las pestañas ya abiertas, sin recargarlas
      const reabrir = async () => {
        await t1.eval(`document.querySelector('#mr-save-close').click()`);
        await t1.waitFor(`!document.querySelector('#mr-save')`, 'el diálogo cerrado');
        await b.command(`${SITE}/tomos/leer/1`, 'save');
        await t1.waitFor(`!!document.querySelector('#mr-save-name') && document.querySelector('#mr-save-name').value`, 'el diálogo de guardar');
        return t1.eval(`document.querySelector('#mr-save-name').value`);
      };
      await b.setStorage({ esquemaNombres: '{sitio}/{anio}/{serie} {numero}' });
      await sleep(300);
      eq('otra plantilla, por sitio y año: vale sin recargar la pestaña', await reabrir(), `${HOST}/${new Date().getFullYear()}/Serie Tomos 0001`);
      await b.setStorage({ esquemaNombres: TPL });

      // Opciones: la plantilla guardada, la vista previa y los avisos
      await b.ext.eval('location.reload()');
      await b.ext.waitFor(`document.readyState === 'complete' && !!document.querySelector('#tplVista') && document.querySelector('#tplVista').textContent.length > 10`, 'la plantilla en opciones');
      const escribir = (t) => b.ext.eval(`(() => { const i = document.querySelector('#tplNombre'); i.value = ${JSON.stringify(t)}; i.dispatchEvent(new Event('input')); })()`);
      eq('opciones: muestra la plantilla guardada', await b.ext.eval(`document.querySelector('#tplNombre').value`), TPL);
      eq('  y cómo quedaría un capítulo de un lote y uno suelto', await b.ext.eval(`document.querySelector('#tplVista').textContent`),
        'En un lote: Descargas/MangaReader/One Piece/Tomo 1/One Piece 0005 - Capítulo 5.pdf\nDe a uno: Descargas/MangaReader/Naruto/Naruto 0300.pdf');
      eq('  la vista de guardados agrupa por la serie aunque el nombre termine en el título',
        await b.ext.eval(`[...document.querySelectorAll('details.serie summary')].map(s => s.textContent.replace(/\\s+/g, ' ').trim()).filter(t => t.startsWith('Serie Tomos')).join('')`),
        'Serie Tomos4 capítulos · del 3 al 6');
      await escribir('{serie}/{capitulo}');
      eq('  avisa si los nombres van a chocar y si un marcador no existe', await b.ext.eval(`document.querySelector('#tplAviso').textContent`),
        '⚠️ Sin {numero} ni {titulo}, todos los capítulos de una serie se llamarían igual.\n⚠️ No conozco {capitulo}: va a quedar escrito tal cual en el nombre.');
      await b.ext.eval(`document.querySelector('#nombres').scrollIntoView()`);
      await shot(b.ext, '15-plantilla');
      await b.ext.eval(`document.querySelector('#tplDefault').click(); document.querySelector('#tplGuardar').click()`);
      await b.ext.waitFor(`/predeterminada/.test(document.querySelector('#tplMsg').textContent)`, 'la plantilla predeterminada');
      eq('  volver a la predeterminada la quita de lo guardado', (await b.storage('esquemaNombres')) == null, true);
      await b.setStorage({ esquemaNombres: '{sitio}/{serie} {numero}' });
      await sleep(300);
      await b.ext.eval(`chrome.storage.local.remove('esquemaNombres')`);
      await sleep(300);
      eq('  y sin plantilla la pestaña vuelve al nombre de siempre', await reabrir(), 'Serie Tomos/Serie Tomos 0001');
      // En una página que no separa en tomos, el diálogo de varios capítulos es el de siempre
      await b.command(`${SITE}/tomos/leer/1`, 'batch');
      await t1.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo de varios capítulos');
      eq('sin tomos en la página no aparecen las pestañas', await t1.eval(`getComputedStyle(document.querySelector('#mr-chapter-tabs')).display + ' · ' + getComputedStyle(document.querySelector('#mr-chapter-list')).display + ' · ' + document.querySelector('#mr-chapter-ruta').textContent`),
        'none · block · Ejemplo: Descargas/MangaReader/Serie Tomos/Serie Tomos 0001');
      await t1.close();
    }

    // ═══ 15. Lo que sumó la 2.11 (shadow root, iframes, cola, orden de las páginas…) ═══
    // Va en tests/e2e_211.js, que también se puede correr solo. estilos.js existe desde la 2.11.
    if (fs.existsSync(path.join(EXT, 'estilos.js'))) await require('./e2e_211').correr({ b, eq });
  } catch (e) {
    fails++;
    console.log('FALLA la prueba se cortó: ' + e.message);
  }
  console.log(fails ? `\n${fails} FALLAS` : '\nTODO OK');
  srv.close();
  if (b) await b.cerrar();
  process.exit(fails ? 1 : 0);
})();
