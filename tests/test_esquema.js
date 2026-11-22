// Plantilla de nombres: plantilla.js (aplicarPlantilla, sanitizarPlantilla, plantillaColisiona,
// marcadoresDesconocidos) y lo que content.js arma con ella (contextoPlantilla, nameFor).
// Uso: node tests/test_esquema.js "<carpeta de la versión>/manga-reader-ext"
const path = require('path');
const dir = path.resolve(process.argv[2]);
const pl = require(path.join(dir, 'plantilla.js'));
const { pagina, probador } = require('./extraer');
const { eq, fin } = probador();

const ctx = { serie: 'One Piece', saga: '11 Saga Final', volumen: 'Tomo 1: El comienzo', numero: '1134',
              titulo: 'La biblioteca del búho', anio: '2026', sitio: 'sitio.com' };
const sin = { ...ctx, saga: '', volumen: '', titulo: '' };       // un capítulo guardado de a uno, de una serie sin sagas
const ap = (tpl, c = ctx) => pl.aplicarPlantilla(tpl, c);

// ── Marcadores ──
eq('la predeterminada', ap(pl.PLANTILLA_DEFECTO), 'One Piece/11 Saga Final/One Piece 1134');
eq('todos los marcadores', ap('{sitio}/{anio}/{serie}/{saga}/{volumen}/{numero} {titulo}'),
  'sitio.com/2026/One Piece/11 Saga Final/Tomo 1- El comienzo/1134 La biblioteca del búho');
eq('en mayúsculas también', ap('{SERIE}/{Numero}'), 'One Piece/1134');
eq('un marcador que no existe queda escrito', ap('{serie}/{capitulo} {numero}'), 'One Piece/{capitulo} 1134');
eq('y se puede avisar cuál es', pl.marcadoresDesconocidos('{serie}/{capitulo} {numero} {tomo} {capitulo}').join(' '), '{capitulo} {tomo}');
eq('sin marcadores raros: nada que avisar', pl.marcadoresDesconocidos(pl.PLANTILLA_DEFECTO).length, 0);
eq('el valor no se vuelve a interpretar', ap('{titulo}/{numero}', { ...ctx, titulo: '{serie} $& $1' }), '{serie} $& $1/1134');
eq('una barra dentro de un valor no crea carpetas', ap('{serie}/{titulo}', { ...ctx, titulo: 'Ida/Vuelta\\Fin' }), 'One Piece/Ida-Vuelta-Fin');
eq('plantilla vacía', ap(''), 'Manga');

// ── Un marcador sin valor no deja rastro ──
eq('carpeta vacía: no queda "//"', ap('{serie}/{saga}/{volumen}/{numero}', sin), 'One Piece/1134');
eq('guion pegado', ap('{serie}-{saga}-{numero}', sin), 'One Piece-1134');
eq('guion con espacios', ap('{serie} - {volumen} - {numero}', sin), 'One Piece - 1134');
eq('dos vacíos seguidos', ap('{serie} - {saga} - {volumen} - {numero}', sin), 'One Piece - 1134');
eq('vacío al principio', ap('{saga} - {serie} {numero}', sin), 'One Piece 1134');
eq('vacío al final', ap('{serie} {numero} - {titulo}', sin), 'One Piece 1134');
eq('entre paréntesis', ap('{serie} {numero} ({volumen}) [{saga}]', sin), 'One Piece 1134');
eq('con guion bajo', ap('{serie}_{volumen}_{numero}', sin), 'One Piece_1134');
eq('solo espacios', ap('{serie} {saga} {numero}', sin), 'One Piece 1134');
eq('con valor, los separadores quedan como se escribieron', ap('{serie} - {volumen} ({saga})'), 'One Piece - Tomo 1- El comienzo (11 Saga Final)');
eq('un guion doble que es parte del nombre no se toca', ap('{serie}/{numero}', { ...ctx, serie: 'A--B' }), 'A--B/1134');
eq('todo vacío', ap('{saga}/{volumen}', sin), 'Manga');

// ── Limpieza para Windows ──
eq('prohibidos → "-" (varios seguidos, uno solo)', pl.sanitizarPlantilla('a/b\\c:*?"<>|d'), 'a/b-c-d');
eq('la barra crea carpetas', pl.sanitizarPlantilla('Serie/Tomo 1/Cap 1'), 'Serie/Tomo 1/Cap 1');
eq('espacios repetidos', pl.sanitizarPlantilla('Serie   Tomo   1'), 'Serie Tomo 1');
eq('puntos y espacios al final', pl.sanitizarPlantilla('Serie... /Cap 1. '), 'Serie/Cap 1');
eq('puntos al principio (no se sube de carpeta)', pl.sanitizarPlantilla('../../Serie/.oculto'), 'Serie/oculto');
eq('nombre reservado', pl.sanitizarPlantilla('Serie/CON/nul'), 'Serie/_CON/_nul');
eq('cada tramo, 100 letras como mucho', pl.sanitizarPlantilla('x'.repeat(150) + '/y').length, 102);

// ── Choque de nombres ──
eq('sin número ni título: choca', pl.plantillaColisiona('{serie}/{saga}'), true);
eq('con número no', pl.plantillaColisiona('{serie}/{numero}'), false);
eq('con título no', pl.plantillaColisiona('{serie}/{titulo}'), false);

// ── En la extensión: contextoPlantilla y nameFor ──
const p = pagina(dir, { title: 'One Piece Capítulo 1134', url: 'https://sitio.com/manga/1134' });
const c = { serie: 'One Piece', numero: 1134, volumen: 'Tomo 110', titulo: 'La biblioteca del búho', anio: 2026 };
eq('contexto de un capítulo', Object.values(p.contextoPlantilla(c)).join(' | '),
  'One Piece | 11 Saga Final | Tomo 110 | 1134 | La biblioteca del búho | 2026 | sitio.com');
eq('número con 4 cifras y decimal; el 1057.5 va con la saga del 1057', Object.values(p.contextoPlantilla({ serie: 'One Piece', numero: 1057.5, anio: 2026 })).join(' | '),
  'One Piece | 10 Wano |  | 1057.5 |  | 2026 | sitio.com');
eq('serie sin sagas, capítulo suelto', Object.values(p.contextoPlantilla({ serie: 'Naruto', numero: 5, anio: 2026, sitio: 'x.com' })).join(' | '),
  'Naruto |  |  | 0005 |  | 2026 | x.com');
eq('el año, si no se da, es el de hoy', p.contextoPlantilla({ serie: 'Naruto', numero: 5 }).anio, String(new Date().getFullYear()));
eq('la saga se busca por la serie ya limpia', p.contextoPlantilla({ serie: 'One Piece.', numero: 5 }).saga, '01 East Blue');

// Sin plantilla (o con la predeterminada escrita) el nombre es el de siempre
const casos = [{ serie: 'One Piece', numero: 1134 }, { serie: 'One Piece', numero: 1057.5 }, { serie: 'Naruto', numero: 5 },
  { serie: 'Re:Zero', numero: 3 }, { serie: 'Ida/Vuelta', numero: 1 }, { serie: 'Serie.', numero: 2 }, { serie: 'A - B', numero: 12 }];
const deSiempre = casos.map(x => p.nameFor(x));
eq('sin plantilla: el nombre de siempre', deSiempre.join(' | '),
  'One Piece/11 Saga Final/One Piece 1134 | One Piece/10 Wano/One Piece 1057.5 | Naruto/Naruto 0005 | Re Zero/Re Zero 0003 | Ida-Vuelta/Ida-Vuelta 0001 | Serie/Serie 0002 | A - B/A - B 0012');
p.setEsquema(pl.PLANTILLA_DEFECTO);
eq('la predeterminada da exactamente lo mismo', casos.map(x => p.nameFor(x)).join(' | '), deSiempre.join(' | '));
p.setEsquema('{serie}/{volumen}/{serie} {numero} - {titulo}');
eq('plantilla propia, capítulo de un lote', p.nameFor(c), 'One Piece/Tomo 110/One Piece 1134 - La biblioteca del búho');
eq('la misma, guardando de a uno (sin tomo ni título)', p.nameFor({ serie: 'One Piece', numero: 1134 }), 'One Piece/One Piece 1134');
p.setEsquema('{sitio}/{anio}/{serie} {numero}');
eq('por sitio y año', p.nameFor({ serie: 'Naruto', numero: 300, anio: 2026 }), 'sitio.com/2026/Naruto 0300');
p.setEsquema(null);
eq('al quitarla vuelve el nombre de siempre', p.nameFor(casos[0]), deSiempre[0]);

fin();
