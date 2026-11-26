// Sitio de prueba del programa, servido en esta máquina. Tiene los tres niveles que
// recorre el explorador y los casos que complican:
//   /                 portada: algunas series, menú con "Directorio", archivo por mes y "Siguiente"
//   /?page=2, 3       las páginas siguientes de ese listado
//   /directorio/      el listado completo: carga más títulos a medida que se baja
//   /buscar?s=…       el buscador que la portada declara (schema.org)
//   /app/             un cuadro de búsqueda suelto: los resultados aparecen en la misma página
//   /serie/alfa/      capítulos separados en "Volumen 1" y "Volumen 2", con el número en la dirección
//   /serie/beta/      capítulos cuya dirección es un código: el número está solo en el texto del link
//   /capitulos-prueba/     renglones cuyo link es "#", con el link real adentro y el número en un
//                          atributo; una lista escondida, un capítulo subido tres veces y dos botones
//   /capitulos-raros/      un menú con "#", un renglón sin link real y un atributo que no es un número
//   /capitulos-envueltos/  la lista dentro de un bloque con data-number; el link es un ícono "#"
//   /capitulos-ranking/    data-number con la posición del renglón, que no es el número del capítulo
//   /mas-leidas/           un ranking de series con el puesto en data-number
//   /leer/alfa-N/     capítulo con carga diferida de imágenes
//   /leer/inestable-1/  capítulo con una página que responde 503 las primeras seis veces (para reintentar)
//   /leer/ocupado-N/    capítulos de un sitio que pide esperar: 503 en la página, con Retry-After y sin él,
//                       y en una imagen (ver más abajo qué hace cada uno)
//   /leer/vacio-1/      capítulo cuya página responde 429 sin cuerpo la primera vez
//   /leer/relacionado-1/  capítulo con la tapa de un "relacionado" (otra carpeta) que responde siempre 503
//   /leer/avisos-1/   capítulo con un aviso en el medio (para revisar las páginas a mano)
//   /ver/900000N      capítulo sin número en la dirección ni en el título; su servidor de
//                     imágenes exige el Referer del sitio
//   /fx/fondo.html    la misma página de prueba de la extensión (tests/fixtures): un lector que dibuja
//                     8 páginas de fondo, con 18 tapas de otras obras alrededor (?tapasDeFondo=1: las
//                     tapas también de fondo)
//   /fx/catalogo-fondo.html  un catálogo con 12 tapas juntas en una carpeta y un lector de fondo de 4
//                     páginas en la misma página: es un listado
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const FIXTURES = path.join(__dirname, '..', '..', 'tests', 'fixtures');
const JPG = fs.readFileSync(path.join(FIXTURES, 'pagina.jpg'));     // 420×640

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
// Capítulos en renglones que se abren ahí mismo: el link del renglón es "#" y los links para leer
// están adentro, escondidos. La dirección trae el código de la subida y no el número del capítulo,
// que está en data-chapter-number. Los dos botones de arriba llevan a direcciones que también
// están en su renglón, y el capítulo 50 está subido tres veces (una por grupo).
const subida = (n) => 40000 + n;
const filaCap = (n, otras = '') => `<li class="upload-link" data-chapter-number="${n}"><a href="#">Capítulo ${n}</a> <div class="chapter-detail" style="display:none"><a href="/view_uploads/${subida(n)}">Leer online</a>${otras}</div></li>`;
const filaDePrueba = (n) => filaCap(n, n === 50 ? ' <a href="/view_uploads/41050">Grupo B</a> <a href="/view_uploads/42050">Grupo C</a>' : '');
const capitulosPrueba = pagina('Capítulos de prueba hash y ocultos', `${menu}<h1>Capítulos de prueba</h1>
<a href="/view_uploads/${subida(1)}">Empezar a leer</a> <a href="/view_uploads/${subida(103)}">Último capítulo</a>
<ul id="visibles">${[...Array(10)].map((_, i) => filaDePrueba(i + 1)).join('')}</ul>
<ul id="ocultos" style="display:none">${[...Array(99)].map((_, i) => filaDePrueba(i + 11)).join('')}</ul>`);
// Lo que no es un renglón de capítulo o no se puede resolver: el botón href="#" de un menú
// desplegable (no le pone su nombre al primer link del menú), un renglón "#" sin ningún link real
// adentro (se descarta: no se queda con la dirección del de al lado) y uno cuyo
// data-chapter-number no es un número (vale el número de su dirección)
const capitulosRaros = pagina('Capítulos de prueba: menú desplegable, renglón sin link y número raro', `<nav><ul><li><a href="/">Inicio</a></li>
<li class="dropdown"><a href="#">Series</a><ul><li><a href="/serie/alfa/">Alfa</a></li><li><a href="/serie/beta/">Beta</a></li><li><a href="/serie/delta/">Delta</a></li></ul></li></ul></nav>
<ul><li class="upload-link" data-chapter-number="9"><a href="#">Capítulo 9</a> <div class="chapter-detail" style="display:none">Todavía sin subidas</div></li>
${[1, 2, 3].map(n => filaCap(n)).join('')}<li class="upload-link" data-chapter-number="extra"><a href="#">Especial</a> <div class="chapter-detail" style="display:none"><a href="/view_uploads/4">Leer online</a></div></li></ul>`);
// La lista entera envuelta en un bloque con data-number (cuántos muestra): no es el número de
// ningún capítulo. Los renglones no llevan atributo: el link es un ícono "#" con su nombre en
// aria-label, y el número está escrito al lado.
const capitulosEnvueltos = pagina('Capítulos de prueba: lista envuelta', `${menu}<h1>Envueltos</h1><div class="lista" data-number="6"><ul>${[1, 2, 3].map(n =>
  `<li><a href="#" aria-label="Capítulo ${n}: Parte ${n}"><i></i></a> <span>Capítulo ${n}</span> <div style="display:none"><a href="/ver-envuelto/900000${n}">Leer online</a></div></li>`).join('')}</ul></div>`);
// Renglones con data-number = su posición en la lista (1, 2, 3): el número del capítulo es el
// que dice el texto
const capitulosRanking = pagina('Capítulos de prueba: data-number con la posición', `${menu}<h1>Los últimos</h1><ul>${[101, 102, 103].map((n, i) =>
  `<li data-number="${i + 1}"><a href="/ver-ranking/9000${n}">Capítulo ${n}</a></li>`).join('')}</ul>`);
// Un ranking de series, sin tapas, con el puesto en data-number: son títulos para entrar
const masLeidas = pagina('Sitio de prueba – Más leídas', `${menu}<h1>Más leídas</h1><ol>${['Alfa', 'Beta', 'Delta', 'Zeta'].map((s, i) =>
  `<li data-number="${i + 1}">${serie(s)}</li>`).join('')}</ol>`);
const lectorTapas = (n) => pagina(`Obra Uno Capítulo ${n} | Sitio de tapas`, menuTapas +
  [1, 2, 3, 4, 5, 6].map(k => `<a href="${n === 5 ? '/lector/6' : `/lector/${n}/pagina/${k}`}"><img width="420" height="640" style="display:block" src="/tapas/paginas/${n}/${k}.jpg"></a>`).join('\n') +
  (n === 5 ? `<h3>También te puede gustar</h3>${grilla(OBRAS.slice(1, 4))}` : ''));

// ── Otro sitio: listados para la galería (0.11.0) ──
// Con iniciar({ galeria: true }). La galería se guarda por sitio, así que cada prueba levanta el
// suyo (otro puerto). Cada listado vive en su carpeta, con sus títulos adentro y dos capítulos por
// título, como en un sitio con las direcciones en escalera:
//   /sig/            listado · /sig/?p=2  su página 2 · /sig/abeja/  la serie · /sig/abeja/1/  un capítulo
// Los listados (cada tarjeta es un link con la tapa, el nombre y, algunas, el tipo y el idioma):
//   /sig/       3 páginas con un link "Siguiente"
//   /num/       3 páginas con una barra de números; el número de la página que sigue lleva rel="next"
//   /solo/      3 páginas con una barra de solo números: nada dice cuál es la siguiente
//   /mas/       una página que muestra 4 y un botón "Cargar más" que suma de a 4, hasta 12
//   /una/       una sola página, con 5 (la tapa de uno no existe: /t/rota.jpg responde 404)
//   /dest/      3 páginas, y en todas los mismos 3 destacados arriba
//   /largo/     12 páginas de 3, con "Siguiente"
//   /ocupado/   3 páginas; la 2.ª responde 503 con Retry-After: 2 la primera vez que se la pide
//   /repite/    4 páginas que muestran siempre los mismos 4 títulos
//   /sintapas/  una página con 5 títulos sin ninguna imagen
//   /grandes/   una página con 5 títulos cuyas tapas tienen el tamaño de una página (420×640): como
//               además cuelgan de la dirección del listado, la exploración la toma por un capítulo
//   /mixto/     2 páginas de un catálogo que mezcla carpetas en una misma grilla, como los que ponen el
//               tipo en la dirección (/mixto/manhwa/alba/, /mixto/manga/fiordo/, /mixto/novela/kiosco/):
//               la exploración arma una lista por carpeta (y con uno o dos títulos, ninguna). Arriba,
//               dos destacados en un bloque aparte (se repiten en las dos páginas); al costado, un
//               bloque de "grupos" con su imagen, que no son títulos del listado
//   /           la portada: no tiene ningún listado
//   /suelta/    una serie que no cuelga de ningún listado (/suelta/1/ es un capítulo)
//   /t/<x>.png  las tapas, del tamaño de una miniatura (200×300): su servidor exige el Referer del sitio
// `ocultos` (lo que devuelve iniciar): los títulos que el sitio deja de mostrar, para probar un refresco.
const RIOS = ['Río', 'Monte', 'Valle', 'Lago', 'Cabo', 'Golfo', 'Bahía', 'Cerro', 'Sierra', 'Pampa', 'Selva', 'Costa'];
const LISTADOS = {
  sig: { paso: 'siguiente', paginas: [['Abeja', 'Barco', 'Cometa', 'Dragón'], ['Espada', 'Faro', 'Gato', 'Halcón'], ['Isla', 'Jardín']] },
  num: { paso: 'numeros con rel', paginas: [['Koala', 'Lince', 'Mono', 'Nutria'], ['Oso', 'Pato', 'Quetzal', 'Rana'], ['Sapo', 'Tigre']] },
  solo: { paso: 'numeros', paginas: [['Uva', 'Vino', 'Yerba'], ['Zapallo', 'Acelga', 'Batata'], ['Cebolla', 'Durazno']] },
  mas: { paso: 'cargar', paginas: [['Ancla', 'Brújula', 'Canoa', 'Dique', 'Estela', 'Fragata', 'Goleta', 'Hélice', 'Islote', 'Jarcia', 'Kayak', 'Lancha']] },
  una: { paso: '', paginas: [['Mate', 'Nogal', 'Olmo', 'Pino', 'Roble']] },
  dest: { paso: 'siguiente', destacados: ['Sol', 'Luna', 'Marte'], paginas: [['Ámbar', 'Bronce', 'Cobre', 'Diamante'], ['Esmeralda', 'Fósforo', 'Granito', 'Hierro'], ['Iridio', 'Jade', 'Kriptón', 'Litio']] },
  largo: { paso: 'siguiente', paginas: RIOS.map(r => ['Azul', 'Blanco', 'Claro'].map(c => `${r} ${c}`)) },
  ocupado: { paso: 'siguiente', paginas: [['Nube', 'Lluvia', 'Viento'], ['Trueno', 'Rayo', 'Niebla'], ['Granizo', 'Helada']] },
  repite: { paso: 'siguiente', paginas: [1, 2, 3, 4].map(() => ['Eco', 'Espejo', 'Reflejo', 'Sombra']) },
  sintapas: { paso: '', sinTapas: true, paginas: [['Lápiz', 'Tinta', 'Papel', 'Pluma', 'Goma']] },
  grandes: { paso: '', tapasGrandes: true, paginas: [['Torre', 'Muralla', 'Puente', 'Fuerte', 'Castillo']] },
};
// Una tapa como las de un catálogo: una miniatura (PNG gris de 200×300), no una imagen del tamaño de una página
function pngGris(w, h, tono) {
  const trozo = (tipo, datos) => {
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(cuerpo));
    return Buffer.concat([largo, cuerpo, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8;
  const filas = Buffer.alloc((w + 1) * h, tono);
  for (let y = 0; y < h; y++) filas[y * (w + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(filas)), trozo('IEND', Buffer.alloc(0))]);
}
const TAPA_CHICA = pngGris(200, 300, 170);
const slugDe = (nombre) => nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, '-');
const menuGaleria = '<nav><a href="/">Inicio</a> <a href="/acerca/">Acerca</a></nav>';
// La tarjeta de un título. De cada tres, una dice "Manga · Español", otra "Manhwa · Inglés" y la otra nada
const tarjetaG = (listado, nombre, k, sinTapas) => {
  const dir = `/${listado}/${slugDe(nombre)}/`;
  if (sinTapas) return `<li><a href="${dir}">${nombre}</a></li>`;
  const datos = k % 3 === 0 ? '<span>Manga</span> <span>Español</span>' : k % 3 === 1 ? '<span>Manhwa</span> <span>Inglés</span>' : '';
  const tapa = LISTADOS[listado].tapasGrandes ? `/t/grande-${slugDe(nombre)}.jpg` : `/t/${listado === 'una' && nombre === 'Roble' ? 'rota' : slugDe(nombre)}.png`;
  return `<a href="${dir}" style="display:inline-block;width:130px;margin:4px;vertical-align:top"><img src="${tapa}" width="120" height="180" alt=""><h3 style="margin:2px 0">${nombre}</h3>${datos}</a>`;
};
function listadoG(listado, n, ocultos) {
  const L = LISTADOS[listado], total = L.paginas.length, dir = (p) => `/${listado}/${p > 1 ? '?p=' + p : ''}`;
  // (el tipo de cada tarjeta sale de su lugar en el listado entero: que un título se oculte no les cambia nada a los demás)
  const tarjetas = (lista, desde = 0) => lista.map((x, k) => (ocultos.has(x) ? '' : tarjetaG(listado, x, desde + k, L.sinTapas))).join('');
  let paso = '';
  if (L.paso === 'siguiente') paso = (n > 1 ? `<a href="${dir(n - 1)}">Anterior</a> ` : '') + (n < total ? `<a href="${dir(n + 1)}">Siguiente</a>` : '');
  else if (L.paso.startsWith('numeros')) paso = L.paginas.map((_, k) => (k + 1 === n ? `<b>${n}</b>` : `<a href="${dir(k + 1)}"${L.paso.endsWith('rel') && k === n ? ' rel="next"' : ''}>${k + 1}</a>`)).join(' ');
  const destacados = L.destacados ? `<h2>Destacados</h2><div>${tarjetas(L.destacados)}</div><h2>Todos</h2>` : '';
  if (L.paso === 'cargar') {
    // Muestra 4 y suma de a 4 con cada toque del botón, que se va cuando no quedan más
    const todas = L.paginas[0].map((x, k) => (ocultos.has(x) ? '' : tarjetaG(listado, x, k, false))).filter(Boolean);
    return pagina('Sitio de galería – Cargar más', `${menuGaleria}<h1>Cargar más</h1><div id="lista">${todas.slice(0, 4).join('')}</div><button id="mas" type="button">Cargar más</button>
<script>
const faltan = ${JSON.stringify(todas.slice(4))};
document.getElementById('mas').addEventListener('click', () => {
  document.getElementById('lista').insertAdjacentHTML('beforeend', faltan.splice(0, 4).join(''));
  if (!faltan.length) document.getElementById('mas').remove();
});
</script>`);
  }
  return pagina(`Sitio de galería – ${listado}` + (n > 1 ? ` (página ${n})` : ''), `${menuGaleria}<h1>Listado</h1>${destacados}<${L.sinTapas ? 'ul' : 'div'}>${tarjetas(L.paginas[n - 1], 3)}</${L.sinTapas ? 'ul' : 'div'}><p>${paso}</p>`);
}
// El catálogo que mezcla carpetas: [carpeta, nombre] de cada tarjeta, en el orden en que se ven
const MIXTO = [[['manhwa', 'Alba'], ['manga', 'Fiordo'], ['manhwa', 'Brisa'], ['novela', 'Kiosco'], ['manhwa', 'Cima'], ['manga', 'Glaciar'], ['manhwa', 'Duna']],
  [['manga', 'Hoz'], ['manhwa', 'Eclipse'], ['manga', 'Istmo'], ['novela', 'Lumbre'], ['manga', 'Jungla']]];
const MIXTO_DESTACADOS = [['manhwa', 'Zafiro'], ['manhwa', 'Yunque']];
const tarjetaMixta = ([tipo, nombre]) => `<a href="/mixto/${tipo}/${slugDe(nombre)}/" style="display:inline-block;width:130px;margin:4px;vertical-align:top"><img src="/t/${slugDe(nombre)}.png" width="120" height="180" alt=""><h3 style="margin:2px 0">${nombre}</h3><span>${tipo.toUpperCase()}</span></a>`;
const mixtoG = (n) => pagina('Sitio de galería – Mixto' + (n > 1 ? ` (página ${n})` : ''), `${menuGaleria}<h1>Biblioteca</h1>
<div class="destacados"><h2>Destacados</h2>${MIXTO_DESTACADOS.map(tarjetaMixta).join('')}</div>
<div class="grilla">${MIXTO[n - 1].map(tarjetaMixta).join('')}</div>
<aside><h3>Grupos</h3>${['Norte', 'Sur', 'Este'].map(x => `<a href="/grupo/${slugDe(x)}/" style="display:inline-block;margin:4px"><img src="/t/grupo-${slugDe(x)}.png" width="90" height="135" alt=""><b>Grupo ${x}</b></a>`).join('')}</aside>
<p>${n < MIXTO.length ? `<a href="/mixto/?p=${n + 1}">Siguiente</a>` : `<a href="/mixto/?p=${n - 1}">Anterior</a>`}</p>`);
const nombresG = (listado) => [...(LISTADOS[listado].destacados || []), ...LISTADOS[listado].paginas.flat()];
const serieG = (base, nombre) => pagina(`${nombre} – capítulos | Sitio de galería`, `${menuGaleria}<h1>${nombre}</h1><a href="${base}1/">Capítulo 1</a> <a href="${base}2/">Capítulo 2</a>`);
const capituloG = (nombre, n) => pagina(`${nombre} Capítulo ${n} | Sitio de galería`, menuGaleria + imagenes(`g/${slugDe(nombre)}/${n}`, false));

function iniciar({ tapas = false, galeria = false } = {}) {
  const pedidos = { sinReferer: 0, capitulos: {}, portada: 0, horas: {} };
  const ocultos = new Set();          // (galería) los títulos que el sitio deja de mostrar
  // (0.10.4) Lo que una prueba puede retener: mientras `lento.pagina` es true, la página de
  // /leer/lento-1/ no contesta; mientras `lento.armador` es true, las imágenes de /leer/lento-2/ no
  // contestan desde el segundo pedido de cada una (el primero es el de la página; el segundo, el del
  // armador). `cabeceras[dirección]`: las cabeceras del último pedido de cada imagen de /img/cache/.
  const lento = { pagina: false, armador: false };
  const retener = (cuando, seguir) => { const fin = Date.now() + 30000; const mirar = () => (cuando() && Date.now() < fin ? setTimeout(mirar, 50) : seguir()); mirar(); };
  const srv = http.createServer((req, res) => {
    const [u, consulta = ''] = req.url.split('?');
    const enviar = (tipo, cuerpo, estado = 200, cabeceras = {}) => { res.writeHead(estado, { 'Content-Type': tipo, 'Cache-Control': 'no-store', ...cabeceras }); res.end(cuerpo); };
    // (0.10.4) Un capítulo lento, para cancelarlo y reintentarlo en el medio, y uno con las imágenes que se pueden cachear
    let ml = u.match(/^\/leer\/(lento|cache)-(\d)\/$/);
    if (ml) {
      (pedidos.horas[u] = pedidos.horas[u] || []).push(Date.now());
      const responder = () => enviar('text/html; charset=utf-8', pagina(`${ml[1] === 'lento' ? 'Lento' : 'Cache'} Capítulo ${ml[2]} | Sitio de prueba`, menu + imagenes(ml[1] + '/' + ml[2], false)));
      return u === '/leer/lento-1/' ? retener(() => lento.pagina, responder) : responder();
    }
    ml = u.match(/^\/img\/(lento|cache)\/(\d)\/\d\.jpg$/);
    if (ml) {
      (pedidos.horas[u] = pedidos.horas[u] || []).push(Date.now());
      if (ml[1] === 'cache') {
        pedidos.cabeceras = pedidos.cabeceras || {};
        pedidos.cabeceras[u] = { 'cache-control': req.headers['cache-control'] || '', pragma: req.headers.pragma || '' };
        return enviar('image/jpeg', JPG, 200, { 'Cache-Control': 'max-age=3600' });      // se puede guardar en la caché
      }
      const segundo = pedidos.horas[u].length >= 2;
      return ml[2] === '2' && segundo ? retener(() => lento.armador, () => enviar('image/jpeg', JPG)) : enviar('image/jpeg', JPG);
    }
    // A qué hora llegó cada pedido de las páginas que piden esperar: las pruebas miden con eso cuánto se esperó
    const anotarHora = () => (pedidos.horas[u] = pedidos.horas[u] || []).push(Date.now());
    const html = (cuerpo) => enviar('text/html; charset=utf-8', cuerpo);
    if (galeria) {
      // (pedidos.listados: cada página de listado que se pidió, en orden · pedidos.referers: de dónde se pidió cada tapa)
      const no = () => enviar('text/plain', 'no', 404);
      if (u === '/') return html(pagina('Sitio de galería', `${menuGaleria}<h1>Inicio</h1><p>La portada de este sitio no tiene ningún listado.</p>`));
      if (u === '/acerca/') return html(pagina('Sitio de galería – Acerca', `${menuGaleria}<p>Un sitio de prueba.</p>`));
      let g = u.match(/^\/t\/([\w-]+)\.(png|jpg)$/);
      if (g) {
        pedidos.referers = pedidos.referers || {};
        (pedidos.referers[u] = pedidos.referers[u] || []).push(req.headers.referer || '');
        if (!String(req.headers.referer || '').startsWith(`http://${req.headers.host}/`)) { pedidos.sinReferer++; return enviar('text/plain', 'no', 403); }
        return g[1] === 'rota' ? no() : g[2] === 'jpg' ? enviar('image/jpeg', JPG) : enviar('image/png', TAPA_CHICA);
      }
      if (/^\/img\/g\/[\w-]+\/\d\/\d\.jpg$/.test(u)) return enviar('image/jpeg', JPG);
      // El catálogo que mezcla carpetas, sus series y sus capítulos
      if (u === '/mixto/') {
        const n = +(new URLSearchParams(consulta).get('p') || 1);
        if (!MIXTO[n - 1]) return no();
        (pedidos.listados = pedidos.listados || []).push(`mixto ${n}`);
        return html(mixtoG(n));
      }
      g = u.match(/^\/mixto\/(\w+)\/([\w-]+)\/(?:([12])\/)?$/);
      if (g) {
        const suyo = [...MIXTO_DESTACADOS, ...MIXTO.flat()].find(([tipo, x]) => tipo === g[1] && slugDe(x) === g[2]);
        if (!suyo) return no();
        return g[3] ? html(capituloG(suyo[1], g[3])) : html(serieG(u, suyo[1]));
      }
      if (u === '/suelta/') return html(serieG('/suelta/', 'Suelta'));
      g = u.match(/^\/suelta\/([12])\/$/);
      if (g) return html(capituloG('Suelta', g[1]));
      g = u.match(/^\/(\w+)\/$/);
      if (g && LISTADOS[g[1]]) {
        const n = +(new URLSearchParams(consulta).get('p') || 1);
        if (!(n >= 1 && n <= LISTADOS[g[1]].paginas.length)) return no();
        const clave = `${g[1]} ${n}`;
        (pedidos.listados = pedidos.listados || []).push(clave);
        (pedidos.horas[clave] = pedidos.horas[clave] || []).push(Date.now());
        if (clave === 'ocupado 2' && pedidos.horas[clave].length === 1) return enviar('text/plain', 'ocupado', 503, { 'Retry-After': '2' });
        return html(listadoG(g[1], n, ocultos));
      }
      g = u.match(/^\/(\w+)\/([\w-]+)\/(?:([12])\/)?$/);
      const nombre = g && LISTADOS[g[1]] && nombresG(g[1]).find(x => slugDe(x) === g[2]);
      if (!nombre) return no();
      if (g[3]) { pedidos.capitulos[u] = (pedidos.capitulos[u] || 0) + 1; return html(capituloG(nombre, g[3])); }
      (pedidos.series = pedidos.series || []).push(u);
      return html(serieG(u, nombre));
    }
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
    if (u === '/capitulos-envueltos/') return html(capitulosEnvueltos);
    if (u === '/capitulos-ranking/') return html(capitulosRanking);
    if (u === '/mas-leidas/') return html(masLeidas);
    let m = u.match(/^\/leer\/alfa-(\d+)\/$/);
    if (m) {
      pedidos.capitulos[u] = (pedidos.capitulos[u] || 0) + 1;
      return +m[1] >= 1 && +m[1] <= 4 ? html(pagina(`Alfa Capítulo ${m[1]} | Sitio de prueba`, menu + imagenes('alfa/' + m[1], true))) : enviar('text/plain', 'no', 404);
    }
    // Un capítulo con una página que responde 503 las seis primeras veces que se la pide: la
    // primera bajada queda incompleta y al reintentar sale entera.
    // Son seis porque el armador (el mismo de la extensión) a un 503 lo espera y lo reintenta:
    // 3 esperas (WAIT_RETRIES: 2, 4 y 8 s) más el primer intento y 2 reintentos comunes
    // (FETCH_RETRIES: 0,7 y 1,4 s). Con menos, el capítulo saldría entero de entrada.
    if (u === '/leer/inestable-1/') return html(pagina('Inestable Capítulo 1 | Sitio de prueba', menu + imagenes('inestable/1', false)));
    if (/^\/img\/inestable\/1\/\d\.jpg$/.test(u)) {
      // (solo cuenta cuando la pide el armador, que manda "Accept: image/*"; a la página se la entrega siempre)
      if (u.endsWith('/3.jpg') && req.headers.accept === 'image/*') {
        anotarHora();
        if ((pedidos.inestable = (pedidos.inestable || 0) + 1) <= 6) return enviar('text/plain', 'ocupado', 503);
      }
      return enviar('image/jpeg', JPG);
    }
    // Capítulos de un sitio que pide esperar. La primera vez que se pide:
    //   ocupado-1      la página responde 503 sin decir cuánto esperar
    //   ocupado-2 y 5  la página responde 503 con Retry-After: 3
    //   ocupado-4      la página sale bien, pero su 2ª imagen responde 503 con Retry-After: 3
    // Después (y los demás, siempre) salen bien.
    m = u.match(/^\/leer\/ocupado-(\d)\/$/);
    if (m) {
      anotarHora();
      const n = +m[1], primera = pedidos.horas[u].length === 1;
      const espera = '<!doctype html><meta charset="UTF-8"><title>Sitio ocupado</title><p>Probá en un rato.</p>';
      if (primera && n === 1) return enviar('text/html; charset=utf-8', espera, 503);
      if (primera && (n === 2 || n === 5)) return enviar('text/html; charset=utf-8', espera, 503, { 'Retry-After': '3' });
      return html(pagina(`Ocupado Capítulo ${n} | Sitio de prueba`, menu + imagenes('ocupado/' + n, false)));
    }
    if (/^\/img\/ocupado\/\d\/\d\.jpg$/.test(u)) {
      if (u === '/img/ocupado/4/2.jpg' && req.headers.accept === 'image/*') {
        anotarHora();
        if (pedidos.horas[u].length === 1) return enviar('text/plain', 'ocupado', 503, { 'Retry-After': '3' });
      }
      return enviar('image/jpeg', JPG);
    }
    // (0.10.3) Un capítulo cuya página responde 429 sin cuerpo la primera vez (con Content-Length: 0;
    // en Electron 45 llega igual como una navegación con su código), y uno con la tapa de un
    // "relacionado" que responde siempre 503
    m = u.match(/^\/leer\/(vacio|relacionado)-1\/$/);
    if (m) {
      anotarHora();
      if (m[1] === 'vacio' && pedidos.horas[u].length === 1) { res.writeHead(429, { 'Content-Length': '0', 'Cache-Control': 'no-store' }); return res.end(); }
      return html(pagina(`${m[1] === 'vacio' ? 'Vacio' : 'Relacionado'} Capítulo 1 | Sitio de prueba`, menu + imagenes(m[1] + '/1', false) +
        (m[1] === 'relacionado' ? '<h3>Relacionados</h3><a href="/serie/beta/"><img width="300" height="450" src="/img/relacionados/beta.jpg"></a>' : '')));
    }
    if (/^\/img\/(vacio|relacionado)\/1\/\d\.jpg$/.test(u)) return enviar('image/jpeg', JPG);
    if (u === '/img/relacionados/beta.jpg') { anotarHora(); return enviar('text/plain', 'ocupado', 503); }
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
    // La página de prueba de fondos de la extensión, y sus imágenes (las páginas numeradas, las tapas, el logo).
    // Y un catálogo de verdad con un lector de fondo en la misma página (2.11.4)
    m = u.match(/^\/fx\/(fondo|catalogo-fondo)\.html$/);
    if (m) return html(fs.readFileSync(path.join(FIXTURES, m[1] + '.html'), 'utf8'));
    if (/^\/fx\/img\/[\w-]+\/[\w.-]+$/.test(u)) return enviar('image/jpeg', JPG);
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
    url: `http://127.0.0.1:${srv.address().port}`, pedidos, lento, ocultos,
    // (closeAllConnections: una conexión que el navegador dejó abierta sin usar haría esperar para siempre)
    cerrar: () => new Promise(r => { srv.close(r); srv.closeAllConnections(); }),
  })));
}

module.exports = { iniciar };
