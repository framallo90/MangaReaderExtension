// Sitio de prueba del programa, servido en esta máquina. Tiene los tres niveles que
// recorre el explorador y los casos que complican:
//   /                 portada: algunas series, menú con "Directorio", archivo por mes y "Siguiente"
//   /?page=2, 3       las páginas siguientes de ese listado
//   /directorio/      el listado completo: carga más títulos a medida que se baja
//   /serie/alfa/      capítulos separados en "Volumen 1" y "Volumen 2", con el número en la dirección
//   /serie/beta/      capítulos cuya dirección es un código: el número está solo en el texto del link
//   /leer/alfa-N/     capítulo con carga diferida de imágenes
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
const portada = (n) => pagina('Sitio de prueba – Catálogo' + (n > 1 ? ` (página ${n})` : ''), `${menu}<h1>Catálogo</h1>
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
//   /                portada: 8 tapas (su servidor exige el Referer del sitio)
//   /biblioteca      el listado completo: 12 obras (/directorio muestra lo mismo)
//   /obra/N/nombre   la página de una obra, con dos capítulos
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
<nav><a href="/biblioteca"><i></i>📚 Biblioteca</a> <a href="/directorio" aria-label="Explorar todo"><svg width="16" height="16"></svg></a> <a href="/grupos">Grupos</a> <a href="/ingresar">Ingresar</a></nav></header>`;
const portadaTapas = pagina('Sitio de tapas — Leer online', `${menuTapas}<h2>Populares</h2>${grilla(OBRAS.slice(0, 8))}`);
const bibliotecaTapas = pagina('Sitio de tapas — Biblioteca', `${menuTapas}<h1>Biblioteca</h1>${grilla(OBRAS)}`);
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
    if (u === '/serie/alfa/') return html(serieAlfa);
    if (u === '/serie/beta/') return html(serieBeta);
    let m = u.match(/^\/leer\/alfa-(\d+)\/$/);
    if (m) {
      pedidos.capitulos[u] = (pedidos.capitulos[u] || 0) + 1;
      return +m[1] >= 1 && +m[1] <= 4 ? html(pagina(`Alfa Capítulo ${m[1]} | Sitio de prueba`, menu + imagenes('alfa/' + m[1], true))) : enviar('text/plain', 'no', 404);
    }
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
    cerrar: () => new Promise(r => srv.close(r)),
  })));
}

module.exports = { iniciar };
