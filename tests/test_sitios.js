// Lista de sitios de manga y cómics (sitios.js): que cada sitio incluido esté bien cargado,
// y las funciones de filtrar, juntar con los del usuario y validar.
// Uso: node tests/test_sitios.js "<carpeta de la versión>/manga-reader-ext"
const path = require('path');
const { probador } = require('./extraer');
const S = require(path.resolve(process.argv[2], 'sitios.js'));
const { eq, fin } = probador();

// ── Cada sitio incluido ──
// Desde la 2.8.2 solo plataformas para leer en el sitio: nada de tiendas ("pago") ni préstamos de biblioteca
const MODELOS = new Set(['gratis', 'gratis con anuncios', 'freemium', 'suscripción']);
const problemas = [];
const nombres = new Set(), urls = new Set();
for (const s of S.SITIOS) {
  const id = s.nombre || '(sin nombre)';
  const claves = Object.keys(s).sort().join(',');
  if (claves !== 'descripcion,guardar,idiomas,modelo,nombre,tipo,url') problemas.push(`${id}: campos ${claves}`);
  if (!/^https?:\/\/[^\s]+$/.test(s.url || '')) problemas.push(`${id}: dirección "${s.url}"`);     // http solo en los que no tienen https
  try { new URL(s.url); } catch { problemas.push(`${id}: dirección inválida`); }
  if (!S.TIPOS[s.tipo]) problemas.push(`${id}: tipo "${s.tipo}"`);
  if (!Array.isArray(s.idiomas) || !s.idiomas.length || s.idiomas.some(i => !S.IDIOMAS[i])) problemas.push(`${id}: idiomas ${JSON.stringify(s.idiomas)}`);
  if (!MODELOS.has(s.modelo)) problemas.push(`${id}: modelo "${s.modelo}"`);
  if (!S.GUARDAR[s.guardar] || s.guardar === 'propio') problemas.push(`${id}: guardar "${s.guardar}"`);
  if (typeof s.descripcion !== 'string' || s.descripcion.length < 20 || s.descripcion.length > 180) problemas.push(`${id}: descripción de ${s.descripcion?.length} caracteres`);
  if (/[a-z]\.$/.test(s.descripcion) === false && !/[.)!]$/.test(s.descripcion)) problemas.push(`${id}: la descripción no termina en punto`);
  if (nombres.has(s.nombre.toLowerCase())) problemas.push(`${id}: nombre repetido`);
  if (urls.has(S.claveUrl(s.url))) problemas.push(`${id}: dirección repetida`);
  nombres.add(s.nombre.toLowerCase());
  urls.add(S.claveUrl(s.url));
}
eq(`los ${S.SITIOS.length} sitios incluidos están bien cargados`, problemas.join(' | ') || 'ok', 'ok');
if (S.SITIOS.length) {                 // desde la 2.8.5 la extensión no trae sitios: la lista es la del usuario
  eq('hay sitios de manga', S.filtrarSitios(S.SITIOS, { tipo: 'manga' }).length >= 5, true);
  eq('hay sitios de cómics', S.filtrarSitios(S.SITIOS, { tipo: 'comics' }).length >= 5, true);
  eq('hay sitios en español', S.filtrarSitios(S.SITIOS, { soloEs: true }).length >= 5, true);
  eq('hay sitios donde se puede guardar', S.filtrarSitios(S.SITIOS, { soloGuardar: true }).length >= 3, true);
  eq('Pepper&Carrot figura como "se guarda con la extensión"', S.SITIOS.find(s => s.nombre === 'Pepper&Carrot')?.guardar, 'funciona');
}

// ── Filtros ──
const L = [
  { nombre: 'A manga', url: 'https://a.com/', tipo: 'manga', idiomas: ['es'], modelo: 'gratis', guardar: 'no_permite', descripcion: 'Manga en español.' },
  { nombre: 'B cómics', url: 'https://b.com/', tipo: 'comics', idiomas: ['en'], modelo: 'pago', guardar: 'descarga_oficial', descripcion: 'Cómics sin DRM.' },
  { nombre: 'C mixto', url: 'https://c.com/', tipo: 'mixto', idiomas: ['es', 'en'], modelo: 'freemium', guardar: 'sin_verificar', descripcion: 'De todo un poco.' },
  { nombre: 'D tiras', url: 'https://d.com/', tipo: 'tiras', idiomas: ['en'], modelo: 'gratis', guardar: 'permitido', descripcion: 'Tiras con licencia libre.' },
  { nombre: 'E manhwa', url: 'https://e.com/', tipo: 'manhwa', idiomas: ['en'], modelo: 'gratis', guardar: 'no_permite', descripcion: 'Manhwa coreano.' },
];
const n = (f) => S.filtrarSitios(L, f).map(s => s.nombre[0]).join('');
eq('filtro: todos', n({ tipo: 'todos' }), 'ABCDE');
eq('filtro: manga (incluye manhwa y mixto)', n({ tipo: 'manga' }), 'ACE');
eq('filtro: cómics (incluye tiras y mixto)', n({ tipo: 'comics' }), 'BCD');
eq('filtro: en español', n({ soloEs: true }), 'AC');
eq('filtro: se pueden guardar', n({ soloGuardar: true }), 'BD');
eq('filtro: manga en español', n({ tipo: 'manga', soloEs: true }), 'AC');
eq('filtro: texto en la descripción', n({ texto: 'licencia' }), 'D');
eq('filtro: texto en el tipo', n({ texto: 'manhwa' }), 'E');
eq('filtro: sin coincidencias', n({ texto: 'zzz' }), '');

// ── Sitios del usuario ──
eq('normalizar: completa https', S.normalizarSitio({ nombre: ' Mi  sitio ', url: 'misitio.com/manga' }).sitio.url, 'https://misitio.com/manga');
eq('normalizar: nombre limpio', S.normalizarSitio({ nombre: ' Mi  sitio ', url: 'misitio.com' }).sitio.nombre, 'Mi sitio');
eq('normalizar: tipo desconocido → mixto', S.normalizarSitio({ nombre: 'x', url: 'https://x.com', tipo: 'otro' }).sitio.tipo, 'mixto');
eq('normalizar: idiomas válidos', S.normalizarSitio({ nombre: 'x', url: 'https://x.com', idiomas: ['es', 'jp', 'en'] }).sitio.idiomas.join(','), 'es,en');
eq('normalizar: queda marcado como propio', `${S.normalizarSitio({ nombre: 'x', url: 'https://x.com' }).sitio.guardar} ${S.normalizarSitio({ nombre: 'x', url: 'https://x.com' }).sitio.mio}`, 'propio true');
eq('normalizar: sin nombre', S.normalizarSitio({ url: 'https://x.com' }).error, 'Falta el nombre');
eq('normalizar: javascript: no', S.normalizarSitio({ nombre: 'x', url: 'javascript:alert(1)' }).error, 'La dirección tiene que empezar con http:// o https://');
eq('normalizar: dirección rota', S.normalizarSitio({ nombre: 'x', url: 'https://' }).ok, false);
eq('normalizar: descripción recortada a 200', S.normalizarSitio({ nombre: 'x', url: 'https://x.com', descripcion: 'a'.repeat(300) }).sitio.descripcion.length, 200);

const juntos = S.juntarSitios(L, [
  { nombre: 'zeta mío', url: 'https://z.com' },
  { nombre: 'Mi versión de B', url: 'https://www.b.com', tipo: 'comics' },      // misma dirección que B
  { nombre: 'roto', url: 'ftp://r.com' },                                           // inválido: no entra
]);
eq('juntar: los propios primero, por nombre, y reemplazan al repetido', juntos.map(s => s.nombre).join(' | '), 'Mi versión de B | zeta mío | A manga | C mixto | D tiras | E manhwa');
eq('juntar: sin propios', S.juntarSitios(L, undefined).length, 5);
eq('juntar: no modifica la lista incluida', L.map(s => s.nombre[0]).join(''), 'ABCDE');

// ── 2.8.3: división descargables / para leer, y filtro por idioma ──
if (S.dividirSitios) {
  eq('idioma: inglés', n({ idioma: 'en' }), 'BCDE');
  eq('idioma: español', n({ idioma: 'es' }), 'AC');
  eq('idioma: todos', n({ idioma: 'todos' }), 'ABCDE');
  eq('idioma: el "En español" de la 2.8 sigue andando', n({ soloEs: true }), 'AC');
  eq('idioma + tipo: manga en inglés', n({ tipo: 'manga', idioma: 'en' }), 'CE');
  const d = S.dividirSitios(L);
  eq('división: descargables (descarga oficial y licencia libre)', d.descargables.map(s => s.nombre[0]).join(''), 'BD');
  eq('división: para leer (no permite y sin verificar)', d.leer.map(s => s.nombre[0]).join(''), 'ACE');
  eq('división: un sitio tuyo va donde lo marcaste',
    S.dividirSitios(S.juntarSitios(L, [{ nombre: 'Mío descargable', url: 'https://m.com', descargable: true }, { nombre: 'Mío para leer', url: 'https://n.com' }]))
      .descargables.map(s => s.nombre).join(' | '), 'Mío descargable | B cómics | D tiras');
  eq('división: "descargable" tiene que ser true, no un texto', S.esDescargable(S.normalizarSitio({ nombre: 'x', url: 'https://x.com', descargable: 'sí' }).sitio), false);
  eq('división: "se pueden guardar" cuenta los tuyos descargables', S.filtrarSitios([S.normalizarSitio({ nombre: 'x', url: 'https://x.com', descargable: true }).sitio], { soloGuardar: true }).length, 1);
  eq('idiomas de la lista, en orden', S.idiomasDe(L).join(','), 'es,en');
  eq('idiomas de una lista solo en inglés', S.idiomasDe([L[1]]).join(','), 'en');
  const inc = S.dividirSitios(S.SITIOS);
  if (S.SITIOS.length) eq('incluidos: hay descargables y todos lo son de verdad', inc.descargables.length >= 3 && inc.descargables.every(s => S.SE_GUARDA.has(s.guardar)), true);
  eq('incluidos: ninguno queda afuera de la división', inc.descargables.length + inc.leer.length, S.SITIOS.length);
}

// ── 2.8.5: leer una lista pegada ──
if (S.leerLista) {
  const ver = (s) => `${s.nombre} | ${s.url} | ${s.tipo} | ${s.idiomas.join(',')} | ${s.descripcion}`;
  const uno = (t) => { const r = S.leerLista(t); return r.sitios.length === 1 ? ver(r.sitios[0]) : `(${r.sitios.length} sitios)`; };
  eq('lista: Nombre: dirección — descripción', uno('Lector Uno: https://uno.example/manga/ — series completas, se actualiza cada semana'),
    'Lector Uno | https://uno.example/manga/ | manga |  | series completas, se actualiza cada semana');
  eq('lista: dirección sola (el nombre sale de la dirección)', uno('https://www.dos.example/'), 'dos.example | https://www.dos.example/ | mixto |  | ');
  eq('lista: sin https://', uno('tres.example/comics'), 'tres.example | https://tres.example/comics | comics |  | ');
  eq('lista: sin https://, con nombre y descripción', uno('Tres: www.tres.example (tiras del día)'), 'Tres | https://www.tres.example/ | mixto |  | tiras del día');
  eq('lista: viñeta, link de Markdown y descripción', uno('- [Cuatro Cómics](https://cuatro.example/) en inglés, sagas completas'),
    'Cuatro Cómics | https://cuatro.example/ | comics | en | en inglés, sagas completas');
  eq('lista: numerada', uno('12. Cinco https://cinco.example/leer'), 'Cinco | https://cinco.example/leer | mixto |  | ');
  eq('lista: nombre que empieza con número', uno('2000 Tiras: https://tiras.example'), '2000 Tiras | https://tiras.example/ | mixto |  | ');
  eq('lista: punto y paréntesis pegados a la dirección', uno('Seis (https://seis.example/a).'), 'Seis | https://seis.example/a | mixto |  | ');
  eq('lista: dirección con paréntesis propios', uno('Siete: https://siete.example/serie_(2026)'), 'Siete | https://siete.example/serie_(2026) | mixto |  | ');
  eq('lista: la segunda dirección del renglón queda en la descripción', uno('Ocho: https://ocho.example/ — ejemplo: https://ocho.example/serie-1/ (completa)'),
    'Ocho | https://ocho.example/ | mixto |  | ejemplo: https://ocho.example/serie-1/ (completa)');
  eq('lista: el tipo sale de la dirección si el texto no lo dice', uno('Nueve: https://mangas-nueve.example/'), 'Nueve | https://mangas-nueve.example/ | manga |  | ');
  eq('lista: manhwa y webtoon', S.leerLista('A: https://a.example manhwa coreano\nB: https://b.example webtoons').sitios.map(s => s.tipo).join(','), 'manhwa,webtoon');
  eq('lista: manga y cómics juntos → mixto', uno('Diez: https://diez.example — manga y cómics en español'), 'Diez | https://diez.example/ | mixto | es | manga y cómics en español');
  eq('lista: varias direcciones solas en un renglón', S.leerLista('https://a.example, https://b.example y https://c.example').sitios.map(s => s.nombre).join(' '), 'a.example b.example c.example');
  eq('lista: descripción recortada a 200', S.leerLista('X: https://x.example ' + 'a'.repeat(300)).sitios[0].descripcion.length, 200);
  eq('lista: javascript: y renglones sin dirección no entran', S.leerLista('javascript:alert(1)\nhola qué tal\nv2.8.3 pesa 1.51 GB').sitios.length, 0);

  const pegado = S.leerLista(`
Manga en español (por serie):

Lector Uno: https://uno.example/manga/ — series completas
Dos: https://dos.example/ — por Mega

Cómics en inglés:
  * Tres https://tres.example/
  * Tres otra vez: https://www.tres.example
  * Cuatro (en español): https://cuatro.example/

Otros
Cinco: https://cinco.example/`);
  eq('lista con títulos de grupo: el tipo y el idioma valen para lo que sigue', pegado.sitios.map(s => `${s.nombre}=${s.tipo}/${s.idiomas.join('+')}`).join(' '),
    'Lector Uno=manga/es Dos=manga/es Tres=comics/en Cuatro (en español)=comics/es Cinco=mixto/');
  eq('lista: los repetidos se cuentan y no entran dos veces', `${pegado.sitios.length} ${pegado.repetidos}`, '5 1');
  eq('lista vacía', JSON.stringify(S.leerLista('')), '{"sitios":[],"repetidos":0}');
  eq('lista: lo leído pasa la validación de un sitio propio', pegado.sitios.every(s => S.normalizarSitio(s).ok), true);
}

eq('resumen: varios idiomas', S.resumenSitio(L[2]), 'Manga y cómics · Freemium · Español e inglés');
eq('resumen: un idioma', S.resumenSitio(L[0]), 'Manga · Gratis · Español');
eq('resumen: sitio propio sin datos', S.resumenSitio({ tipo: 'comics', idiomas: [] }), 'Cómics');
eq('claveUrl: ignora www y barra final', S.claveUrl('https://www.x.com/a/') === S.claveUrl('http://x.com/a'), true);
fin();
