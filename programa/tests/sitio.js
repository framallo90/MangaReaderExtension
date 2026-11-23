// Sitio de prueba del programa, servido en esta máquina. Tiene los tres niveles que
// recorre el explorador y los casos que complican:
//   /                 portada: algunas series, menú con "Directorio", archivo por mes y "Siguiente"
//   /?page=2, 3       las páginas siguientes de ese listado
//   /directorio/      el listado completo: carga más títulos a medida que se baja
//   /buscar?s=…       el buscador que la portada declara (schema.org)
//   /app/             un cuadro de búsqueda suelto: los resultados aparecen en la misma página
//   /serie/alfa/      capítulos separados en "Volumen 1" y "Volumen 2", con el número en la dirección
//   /serie/beta/      capítulos cuya dirección es un código: el número está solo en el texto del link
//   /leer/alfa-N/     capítulo con carga diferida de imágenes
//   /leer/inestable-1/  capítulo con una página que falla al principio (para reintentar)
//   /leer/avisos-1/   capítulo con un aviso en el medio (para revisar las páginas a mano)
//   /ver/900000N      capítulo sin número en la dirección ni en el título; su servidor de
//                     imágenes exige el Referer del sitio
const http = require('http'), fs = require('fs'), path = require('path');
const JPG = fs.readFileSync(path.join(__dirname, '..', '..', 'tests', 'fixtures', 'pagina.jpg'));     // 420×640

const pagina = (titulo, cuerpo) => `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title></head><body style="margin:0">${cuerpo}</body></html>`;
const menu = '<nav><a href="/">Inicio</a> <a href="/directorio/">Directorio</a> <a href="/acerca">Acerca</a> <a href="/contacto">Contacto</a></nav>';
const archivo = '<aside><h3>Archivo</h3><a href="/2021/01/">enero 2021</a> <a href="/2021/02/">febrero 2021</a> <a href="/2021/03/">marzo 2021</a></aside>';
const imagenes = (carpeta, diferida) => [1, 2, 3, 4, 5, 6].map(k =>
  `<img ${diferida ? 'loading="lazy" ' : ''}width="420" height="640" style="display:block" src="/img/${carpeta}/${k}.jpg">`).join('\n');
const serie = (nombre) => `<a href="/serie/${nombre.toLowerCase().replace(/ /g, '-')}/">${nombre}</a>`;

// La portada muestra 4 series por página, en 3 páginas
const PORTADA = [['Alfa', 'Beta', 'Gama 3', 'Delta'], ['Épsilon', 'Zeta', 'Alfa'], ['Eta']];
// (la portada declara su buscador como pide schema.org: el programa lo usa desde ahí)
const declarado = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', url: '/',
  potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: '/buscar?s={search_term_string}' }, 'query-input': 'required name=search_term_string' } }] })}</script>`;
const portada = (n) => pagina('Sitio de prueba – Catálogo' + (n > 1 ? ` (página ${n})` : ''), `${menu}${declarado}<h1>Catálogo</h1>
${n === 1 ? '<a href="/serie/alfa/"><img src="/tapa.jpg" alt="Alfa" width="120"></a>' : ''}
${PORTADA[n - 1].map(serie).join(' ')}
${archivo}${n > 1 ? `<a href="/?page=${n - 1}">Anterior</a> ` : ''}${n < PORTADA.length ? `<a href="/?page=${n + 1}" rel="next">Siguiente</a>` : ''}`);

// El directorio tiene 15 series y las va mostrando de a 5 cuando se llega al final
const DIRECTORIO = ['Alfa', 'Beta', 'Delta', 'Épsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Ómicron', 'Pi'];
const directorio = pagina('Sitio de prueba – Directorio', `${menu}<h1>Directorio</h1><div id="lista"></div>
<script>
const series = ${JSON.stringify(DIRECTORIO)};
let mostradas = 0;
function mas() {
  for (let k = 0; k < 5 && mostradas < series.length; k++, mostradas++) {
    const a = document.createElement('a');
    a.href = '/serie/' + series[mostradas].toLowerCase() + '/';
    a.textContent = series[mostradas];
    a.style.cssText = 'display:block;height:300px';
    document.getElementById('lista').appendChild(a);
  }
}
mas();
addEventListener('scroll', () => { if (innerHeight + scrollY >= document.documentElement.scrollHeight - 50) setTimeout(mas, 100); });
</script>`);

// Una página con un cuadro de búsqueda suelto (sin formulario): los resultados aparecen ahí
// mismo mientras se escribe, sin cambiar de dirección
const buscadorSuelto = pagina('Sitio de prueba – Buscador', `${menu}<h1>Buscador</h1><input id="b" placeholder="Buscar serie…"><div id="res"></div>
<script>
const series = ${JSON.stringify(DIRECTORIO)};
document.getElementById('b').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.getElementById('res').innerHTML = !q ? '' : series.filter(s => s.toLowerCase().includes(q)).map(s => '<a href="/serie/' + s.toLowerCase() + '/">' + s + '</a>').join(' ');
});
</script>`);

const serieAlfa = pagina('Alfa – Todos los capítulos', `${menu}<h1>Alfa</h1>
<h2>Volumen 1</h2><a href="/leer/alfa-1/">Capítulo 1</a> <a href="/leer/alfa-2/">Capítulo 2</a>
<h2>Volumen 2</h2><a href="/leer/alfa-3/">Capítulo 3</a> <a href="/leer/alfa-4/">Capítulo 4</a>
<h3>Otras series</h3>${['Beta', 'Gama 3', 'Delta'].map(serie).join(' ')}${archivo}`);

const serieBeta = pagina('Beta – Capítulos', `${menu}<h1>Beta</h1>
<a href="/ver/9000003">Capítulo 3: El final</a> <a href="/ver/9000002">Capítulo 2</a> <a href="/ver/9000001">Capítulo 1</a>`);

// ── Otro sitio: la portada es una grilla de tapas ──
// Con iniciar({ tapas: true }). Cada tapa es una imagen grande que lleva a su obra: en la
// mitad de las tarjetas el link envuelve a la imagen y en la otra mitad va al lado, como
// título. El link al listado completo tiene un ícono adelante, y hay otro sin texto.
//   /                portada: 8 tapas (su servidor exige el Referer del sitio) y una tira de 10 géneros
//   /biblioteca      el listado completo: 12 obras (/directorio muestra lo mismo)
//   /obra/N/nombre   la página de una obra, con dos capítulos
//   /obra/2/dos      la de otra obra, con los capítulos en renglones (el número no está en el link)
//   /obra/3/tres     solo muestra el primer capítulo y el último (los del medio salen por número)
//   /obra/6/seis     lo mismo, con ceros adelante en el número de la dirección
//   /obra/4/cuatro   la lista aparece al tocar la pestaña "Capítulos" y sigue con "Mostrar más"
//   /obra/5/cinco    la lista está en un panel con barra propia, que carga más al bajar
//   /novedades       tarjetas con tapa, nombre, tipo, nota y último capítulo (no son capítulos)
//   /buscar?q=…      el buscador del sitio (un formulario en el encabezado)
//   /lector/5        capítulo donde cada página es un link al capítulo siguiente, con tapas
//                    de otras obras al final
//   /lector/7        capítulo donde cada página es un link a su vista de a una
const OBRAS = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce'];
const tapa = (nombre, i) => {
  const dir = `/obra/${i + 1}/${nombre.toLowerCase()}`, img = `<img loading="lazy" width="150" height="225" src="/tapas/${i + 1}.jpg" alt="">`;
  return i % 2 ? `<div class="tarjeta">${img}<a href="${dir}">${nombre}</a></div>` : `<a class="tarjeta" href="${dir}">${img}<span>${nombre}</span></a>`;
};
const grilla = (obras) => `<div style="display:flex;flex-wrap:wrap;gap:8px">${obras.map(tapa).join('')}</div>`;
const menuTapas = `<header><a href="/"><img src="/tapas/logo.jpg" width="60" height="60" alt="Sitio de tapas"></a>
<nav><a href="/biblioteca?orden=populares&page=1"><i></i>📚 Biblioteca</a> <a href="/directorio" aria-label="Explorar todo"><svg width="16" height="16"></svg></a> <a href="/grupos">Grupos</a> <a href="/ingresar">Ingresar</a></nav>
<form action="/buscar" method="get"><input type="hidden" name="tipo" value="todo"><input type="search" name="q" placeholder="Buscar…"></form></header>`;
// Tarjetas como las de "últimas actualizaciones": la tapa, el tipo, el nombre (más grande), la
// nota y el último capítulo. Llevan a una dirección con un código, y los números son seguidos:
// igual son títulos distintos, no los capítulos de una serie.
const CODIGOS = ['xkaa', 'pqzb', 'mmtc', 'ryud'];
const chico = 'display:block;font-size:10px';
const novedades = pagina('Sitio de tapas — Novedades', `${menuTapas}<h2>Últimas actualizaciones</h2><div style="display:flex;gap:8px">${CODIGOS.map((c, i) =>
  `<a href="/c/${c}" style="display:block;width:160px"><img loading="lazy" width="150" height="225" src="/tapas/${i + 1}.jpg" alt=""><span style="${chico}">MANHWA</span><span style="display:block;font-size:15px;font-weight:bold">${OBRAS[i]}</span><span style="${chico}">9.00</span><span style="${chico}">Cap. ${12 + i}</span></a>`).join('')}</div>
<h2>Por código</h2><div style="display:flex;gap:8px">${CODIGOS.map((c, i) =>
  `<a href="/manga/${101 + i}" style="display:block;width:160px"><img loading="lazy" width="150" height="225" src="/tapas/${i + 5}.jpg" alt=""><b style="display:block">${OBRAS[i + 4]}</b><span style="${chico}">Finalizado</span><span style="${chico}">${204 + i} caps</span></a>`).join('')}</div>`);
// Una obra que solo muestra el primer capítulo y el último: los del medio se piden por número
const obraPrimeroYUltimo = pagina('Obra Tres — capítulos', `${menuTapas}<h1>Tres</h1>
<a href="/lector-tres/1"><span>Empezar a leer</span> <span>Cap. 1</span></a> <a href="/lector-tres/40">Último capítulo Cap. 40</a>`);
const obraConCeros = pagina('Obra Seis — capítulos', `${menuTapas}<h1>Seis</h1>
<a href="/leer-seis/cap-007-es">Capítulo 7</a> <a href="/leer-seis/cap-120-es">Capítulo 120</a>`);
// Una obra cuya lista aparece al tocar la pestaña "Capítulos", y de a 5 con "Mostrar más"
const obraConPestana = pagina('Obra Cuatro — capítulos', `${menuTapas}<h1>Cuatro</h1>
<div role="tablist"><button role="tab" aria-selected="true">Información</button> <button role="tab" aria-selected="false" id="tc">Capítulos (15)</button></div>
<div id="panel">Una sinopsis.</div>
<script>
let n = 0;
function mas() {
  for (let k = 0; k < 5 && n < 15; k++) {
    n++;
    const a = document.createElement('a');
    a.href = '/lector-cuatro/' + n;
    a.textContent = 'Capítulo ' + n;
    a.style.display = 'block';
    document.getElementById('lista').appendChild(a);
  }
  if (n >= 15) document.getElementById('mas').remove();
}
document.getElementById('tc').addEventListener('click', () => {
  document.getElementById('panel').innerHTML = '<div id="lista"></div><button id="mas">Mostrar más</button>';
  document.getElementById('mas').addEventListener('click', () => setTimeout(mas, 150));
  mas();
});
</script>`);
// Una obra con la lista en un panel con su propia barra: carga de a 4 cuando se llega al final
const obraConPanel = pagina('Obra Cinco — capítulos', `${menuTapas}<h1>Cinco</h1>
<div id="panel" style="height:200px;overflow-y:auto"><div id="lista"></div></div>
<script>
let n = 0;
const panel = document.getElementById('panel');
function mas() {
  for (let k = 0; k < 4 && n < 12; k++) {
    n++;
    const a = document.createElement('a');
    a.href = '/lector-cinco/' + n;
    a.textContent = 'Capítulo ' + n;
    a.style.cssText = 'display:block;height:80px';
    document.getElementById('lista').appendChild(a);
  }
}
mas();
panel.addEventListener('scroll', () => { if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 20) setTimeout(mas, 100); });
</script>`);
const GENEROS = ['Acción', 'Aventura', 'Comedia', 'Drama', 'Fantasía', 'Misterio', 'Romance', 'Terror', 'Deportes', 'Recuentos'];
const generos = `<aside><h3>Géneros</h3>${GENEROS.map((g, i) => `<a href="/genero/g${i + 1}">${g}</a>`).join(' ')}</aside>`;
const portadaTapas = pagina('Sitio de tapas — Leer online', `${menuTapas}${generos}<h2>Populares</h2>${grilla(OBRAS.slice(0, 8))}`);
// La página de una obra con los capítulos en renglones: el número está en el título del renglón
// y no en el link (que es un botón sin texto, con un código en su dirección), y un capítulo
// puede tener más de un link porque lo subió más de un grupo.
const obraEnRenglones = pagina('Obra Dos — capítulos', `${menuTapas}<h1>Dos</h1><ul>
<li><h4>Capítulo 3: El final</h4><ul><li>Grupo A <a href="/ver-obra/900231"><i></i></a></li></ul></li>
<li><h4>Capítulo 2: El viaje</h4><ul><li>Grupo A <a href="/ver-obra/900221"><i></i></a></li><li>Grupo B <a href="/ver-obra/900222"><i></i></a></li></ul></li>
<li><div>Capítulo 1 <a href="/ver-obra/900211">Leer</a></div></li>
</ul>`);
const bibliotecaTapas = pagina('Sitio de tapas — Biblioteca', `${menuTapas}<h1>Biblioteca</h1>${grilla(OBRAS)}`);
const filaCap = (n) => `<li class="upload-link" data-chapter-number="${n}"><a href="#">Capítulo ${n}</a> <div class="chapter-detail" style="display:none"><a href="/view_uploads/${n}">Leer online</a></div></li>`;
const capitulosPrueba = pagina('Capítulos de prueba hash y ocultos', `${menu}<h1>Capítulos de prueba</h1>
<a href="/view_uploads/1">Empezar a leer</a> <a href="/view_uploads/103">Último capítulo</a>
<ul id="visibles">${[...Array(10)].map((_, i) => filaCap(i + 1)).join('')}</ul>
<ul id="ocultos" style="display:none">${[...Array(99)].map((_, i) => filaCap(i + 11)).join('')}</ul>`);
// Lo que no es un renglón de capítulo: el botón href="#" de un menú desplegable (no le pone su
// nombre al primer link del menú) y un renglón cuyo data-chapter-number no es un número
const capitulosRaros = pagina('Capítulos de prueba: menú desplegable y número raro', `<nav><ul><li><a href="/">Inicio</a></li>
<li class="dropdown"><a href="#">Series</a><ul><li><a href="/serie/alfa/">Alfa</a></li><li><a href="/serie/beta/">Beta</a></li><li><a href="/serie/delta/">Delta</a></li></ul></li></ul></nav>
<ul>${[1, 2, 3].map(filaCap).join('')}<li class="upload-link" data-chapter-number="extra"><a href="#">Especial</a> <div class="chapter-detail" style="display:none"><a href="/view_uploads/900">Leer online</a></div></li></ul>`);
const lectorTapas = (n) => pagina(`Obra Uno Capítulo ${n} | Sitio de tapas`, menuTapas +
  [1, 2, 3, 4, 5, 6].map(k => `<a href="${n === 5 ? '/lector/6' : `/lector/${n}/pagina/${k}`}"><img width="420" height="640" style="display:block" src="/tapas/paginas/${n}/${k}.jpg"></a>`).join('\n') +
  (n === 5 ? `<h3>También te puede gustar</h3>${grilla(OBRAS.slice(1, 4))}` : ''));

function iniciar({ tapas = false } = {}) {
  const pedidos = { sinReferer: 0, capitulos: {}, portada: 0 };
  const srv = http.createServer((req, res) => {
    const [u, consulta = ''] = req.url.split('?');
    const enviar = (tipo, cuerpo, estado = 200) => { res.writeHead(estado, { 'Content-Type': tipo, 'Cache-Control': 'no-store' }); res.end(cuerpo); };
    const html = (cuerpo) => enviar('text/html; charset=utf-8', cuerpo);
    if (tapas) {
      if (u === '/') return html(portadaTapas);
      if (u === '/biblioteca' || u === '/directorio') return html(bibliotecaTapas);
      if (u === '/lector/5' || u === '/lector/7') return html(lectorTapas(+u.slice(-1)));
      if (u === '/obra/2/dos') return html(obraEnRenglones);
      if (u === '/obra/3/tres') return html(obraPrimeroYUltimo);
      if (u === '/obra/4/cuatro') return html(obraConPestana);
      if (u === '/obra/5/cinco') return html(obraConPanel);
      if (u === '/obra/6/seis') return html(obraConCeros);
      if (u === '/novedades') return html(novedades);
      if (u === '/buscar') {
        // El buscador del sitio: las obras cuyo nombre tiene lo buscado
        const q = (new URLSearchParams(consulta).get('q') || '').toLowerCase();
        pedidos.busquedas = (pedidos.busquedas || []).concat(consulta);
        return html(pagina('Sitio de tapas — Búsqueda', `${menuTapas}<h1>Resultados</h1><div style="display:flex;flex-wrap:wrap;gap:8px">${OBRAS.map((n, i) => n.toLowerCase().includes(q) ? tapa(n, i) : '').join('')}</div>`));
      }
      const obra = u.match(/^\/obra\/(\d+)\/\w+$/);
      if (obra && OBRAS[obra[1] - 1]) {
        return html(pagina(`Obra ${OBRAS[obra[1] - 1]} — capítulos`, `${menuTapas}<h1>${OBRAS[obra[1] - 1]}</h1><a href="/lector/5">Capítulo 5</a> <a href="/lector/7">Capítulo 7</a>`));
      }
      if (/^\/tapas\/\d+\.jpg$/.test(u)) {
        // Las tapas solo se entregan si el pedido viene del sitio, como hacen muchos servidores de imágenes
        if (!String(req.headers.referer || '').startsWith(`http://${req.headers.host}/`)) { pedidos.sinReferer++; return enviar('text/plain', 'no', 403); }
        pedidos.tapas = (pedidos.tapas || 0) + 1;
        return enviar('image/jpeg', JPG);
      }
      if (/^\/tapas\/(?:\w+\.jpg|paginas\/\d\/\d\.jpg)$/.test(u)) return enviar('image/jpeg', JPG);
      return enviar('text/plain', 'no', 404);
    }
    if (u === '/') {
      const n = +(new URLSearchParams(consulta).get('page') || 1);
      pedidos.portada++;
      return n >= 1 && n <= PORTADA.length ? html(portada(n)) : enviar('text/plain', 'no', 404);
    }
    if (u === '/directorio/') return html(directorio);
    if (u === '/app/') return html(buscadorSuelto);
    if (u === '/buscar') {
      const q = (new URLSearchParams(consulta).get('s') || '').toLowerCase();
      return html(pagina('Sitio de prueba – Búsqueda', `${menu}<h1>Resultados</h1>${DIRECTORIO.filter(s => s.toLowerCase().includes(q)).map(serie).join(' ')}`));
    }
    if (u === '/serie/alfa/') return html(serieAlfa);
    if (u === '/serie/beta/') return html(serieBeta);
    if (u === '/capitulos-prueba/') return html(capitulosPrueba);
    if (u === '/capitulos-raros/') return html(capitulosRaros);
    let m = u.match(/^\/leer\/alfa-(\d+)\/$/);
    if (m) {
      pedidos.capitulos[u] = (pedidos.capitulos[u] || 0) + 1;
      return +m[1] >= 1 && +m[1] <= 4 ? html(pagina(`Alfa Capítulo ${m[1]} | Sitio de prueba`, menu + imagenes('alfa/' + m[1], true))) : enviar('text/plain', 'no', 404);
    }
    // Un capítulo con una página que falla las tres primeras veces que se la pide: la primera
    // bajada queda incompleta y al reintentar sale entera
    if (u === '/leer/inestable-1/') return html(pagina('Inestable Capítulo 1 | Sitio de prueba', menu + imagenes('inestable/1', false)));
    if (/^\/img\/inestable\/1\/\d\.jpg$/.test(u)) {
      // (solo cuenta cuando la pide el armador, que manda "Accept: image/*"; a la página se la entrega siempre)
      if (u.endsWith('/3.jpg') && req.headers.accept === 'image/*' && (pedidos.inestable = (pedidos.inestable || 0) + 1) <= 3) return enviar('text/plain', 'ocupado', 503);
      return enviar('image/jpeg', JPG);
    }
    // Un capítulo con un aviso en el medio (una imagen que lleva a otro sitio)
    if (u === '/leer/avisos-1/') {
      pedidos.avisos = (pedidos.avisos || 0) + 1;
      const pags = [1, 2, 3, 4, 5, 6].map(k => `<img width="420" height="640" style="display:block" src="/img/avisos/1/${k}.jpg">`);
      pags.splice(3, 0, '<a href="https://otro-sitio.example/oferta"><img width="420" height="640" style="display:block" src="/img/avisos/1/aviso.jpg"></a>');
      return html(pagina('Avisos Capítulo 1 | Sitio de prueba', menu + pags.join('\n')));
    }
    if (/^\/img\/avisos\/1\/\w+\.jpg$/.test(u)) return enviar('image/jpeg', JPG);
    m = u.match(/^\/ver\/900000([1-3])$/);
    if (m) return html(pagina('Lector', menu + imagenes('beta/' + m[1], false)));
    if (/^\/img\/alfa\/\d\/\d\.jpg$/.test(u) || u === '/tapa.jpg') return enviar('image/jpeg', JPG);
    if (/^\/img\/beta\/\d\/\d\.jpg$/.test(u)) {
      // Este servidor de imágenes solo entrega si el pedido viene del sitio
      const origen = `http://${req.headers.host}/`;
      if (!String(req.headers.referer || '').startsWith(origen)) { pedidos.sinReferer++; return enviar('text/plain', 'no', 403); }
      return enviar('image/jpeg', JPG);
    }
    enviar('text/plain', 'no', 404);
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${srv.address().port}`, pedidos,
    // (closeAllConnections: una conexión que el navegador dejó abierta sin usar haría esperar para siempre)
    cerrar: () => new Promise(r => { srv.close(r); srv.closeAllConnections(); }),
  })));
}

module.exports = { iniciar };
