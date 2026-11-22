// Agrupado por volúmenes/tomos: agrupar.js (SECCION_RE, conSecciones, tomosDe, rangoTomos) y el
// encabezado que collectChapters le anota a cada capítulo de la lista.
// Uso: node tests/test_tomos.js "<carpeta de la versión>/manga-reader-ext"
const fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2]);
const agrupar = require(path.join(dir, 'agrupar.js'));
const { pagina, probador } = require('./extraer');
const { eq, fin } = probador();

// Lista de ejemplo: dos tomos y dos capítulos sueltos (el 1 y el 6)
const lista = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'tomos.json'), 'utf8'));
const resumen = (grupos) => grupos.map(g => `${g.nombre} [${agrupar.rangoTomos(g)}] ${g.items.map(i => i.numero).join(',')}`).join(' | ');

// ── SECCION_RE ──
eq('reconoce "volumen"', agrupar.SECCION_RE.test('volumen 1'), true);
eq('reconoce "Vol. 3"', agrupar.SECCION_RE.test('Vol. 3'), true);
eq('reconoce "tomo"', agrupar.SECCION_RE.test('Tomo 1'), true);
eq('reconoce "saga"', agrupar.SECCION_RE.test('Saga Final'), true);
eq('reconoce "arco"', agrupar.SECCION_RE.test('Arco de Marineford'), true);
eq('reconoce "parte"', agrupar.SECCION_RE.test('Parte 2'), true);
eq('no reconoce un capítulo suelto', agrupar.SECCION_RE.test('Capítulo 5'), false);
eq('no reconoce "versión"', agrupar.SECCION_RE.test('Versión final'), false);
eq('no reconoce una palabra que solo empieza igual', agrupar.SECCION_RE.test('Participantes'), false);

// ── Encabezado vigente ──
agrupar.reiniciarSeccion();
eq('sin encabezados todavía', agrupar.seccionVigente(), '');
eq('un encabezado pasa a ser el vigente', agrupar.capturarSeccion('  Tomo   1 '), 'Tomo 1');
eq('uno vacío no lo cambia', agrupar.capturarSeccion('   '), 'Tomo 1');
eq('uno de más de 80 letras tampoco (es un párrafo, no un título)', agrupar.capturarSeccion('x'.repeat(81)), 'Tomo 1');
agrupar.reiniciarSeccion();
eq('reiniciar lo borra', agrupar.seccionVigente(), '');

// ── conSecciones ──
eq('una sección sola queda vacía', agrupar.conSecciones([{ numero: 1, seccion: 'Tomo 1' }])[0].seccion, '');
eq('dos secciones distintas se conservan', agrupar.conSecciones([
  { numero: 1, seccion: 'Tomo 1' }, { numero: 2, seccion: 'Tomo 2' }])[0].seccion, 'Tomo 1');
eq('una sección que no nombra un tomo queda vacía', agrupar.conSecciones([
  { numero: 1, seccion: 'Capítulo 5' }, { numero: 2, seccion: 'Tomo 1' }, { numero: 3, seccion: 'Tomo 2' }])[0].seccion, '');
{
  const items = [{ numero: 1, seccion: 'Comentarios' }];
  agrupar.conSecciones(items);
  eq('no cambia la lista que recibe', items[0].seccion, 'Comentarios');
}

// ── tomosDe ──
{
  const items = lista();
  const g = agrupar.tomosDe(items);
  eq('dos tomos y los sueltos, ordenados por su primer capítulo', resumen(g),
    'Sin volumen [1 a 6] 1,6 | Tomo 1: El comienzo [2 a 3] 2,3 | Tomo 2: La huida [4 a 7] 4,5,7');
  eq('los sueltos van sin sección', g[0].seccion, '');
  eq('cada tomo lleva su sección', g[2].seccion, 'Tomo 2: La huida');
  // Los grupos tienen que traer los mismos objetos de la lista, no copias: tildar un tomo
  // en el diálogo marca esos capítulos, y con copias el tilde no llegaba a la lista.
  eq('los capítulos de un grupo son los de la lista, no copias', g[1].items[0] === items[1] && g[2].items[2] === items[6], true);
  for (const c of g[2].items) c.on = true;
  eq('marcar los de un tomo los marca en la lista', items.filter(c => c.on).map(c => c.numero).join(','), '4,5,7');
  eq('y no toca la sección que traían', items[0].seccion + '|' + items[1].seccion, '|Tomo 1: El comienzo');
}
eq('sin capítulos: ningún grupo', agrupar.tomosDe([]).length, 0);
eq('un solo capítulo por sección: todo va a "Sin volumen"', resumen(agrupar.tomosDe([
  { numero: 1, seccion: 'Tomo 1' }, { numero: 2, seccion: 'Tomo 2' }])), 'Sin volumen [1 a 2] 1,2');
eq('un tomo de un solo capítulo va con los sueltos', resumen(agrupar.tomosDe([
  { numero: 1, seccion: 'Tomo 1' }, { numero: 2, seccion: 'Tomo 1' }, { numero: 3, seccion: 'Tomo 2' }, { numero: 4, seccion: 'Tomo 3' }, { numero: 5, seccion: 'Tomo 3' }])),
  'Tomo 1 [1 a 2] 1,2 | Sin volumen [3] 3 | Tomo 3 [4 a 5] 4,5');
eq('una sola sección en toda la lista no arma tomos', resumen(agrupar.tomosDe([
  { numero: 1, seccion: 'Tomo 1' }, { numero: 2, seccion: 'Tomo 1' }, { numero: 3, seccion: '' }])), 'Sin volumen [1 a 3] 1,2,3');
eq('los capítulos de un tomo quedan en orden aunque vengan del último al primero', resumen(agrupar.tomosDe([
  { numero: 4, seccion: 'Tomo 2' }, { numero: 3, seccion: 'Tomo 2' }, { numero: 2, seccion: 'Tomo 1' }, { numero: 1, seccion: 'Tomo 1' }])),
  'Tomo 1 [1 a 2] 1,2 | Tomo 2 [3 a 4] 3,4');
eq('rango de un solo capítulo', agrupar.rangoTomos({ desde: 5, hasta: 5 }), '5');
eq('rango sin números', agrupar.rangoTomos({ desde: null, hasta: null }), '');

// ── El encabezado de cada capítulo, sacado de la página (collectChapters) ──
const secciones = (p) => p.collectChapters().list.map(c => c.numero + ':' + (c.seccion || '')).join(' | ');
{
  // La página de una serie: un bloque "Últimos capítulos" y después los tomos, cada uno con su título
  const p = pagina(dir, { title: 'Serie Tomos - Todos los capítulos', url: 'https://sitio.com/serie/', links: [
    ['/serie/cap/5', 'Capítulo 5', 'Últimos capítulos'],
    ['/serie/cap/1', 'Capítulo 1', 'Tomo 1: El comienzo'], ['/serie/cap/2', 'Capítulo 2'],
    ['/serie/cap/3', 'Capítulo 3', 'Tomo 2: La huida'], ['/serie/cap/4', 'Capítulo 4'], ['/serie/cap/5', 'Capítulo 5'],
    ['/serie/cap/6', 'Capítulo 6', 'Comentarios'],
  ] });
  eq('cada capítulo queda con el tomo que tiene encima', secciones(p),
    '1:Tomo 1: El comienzo | 2:Tomo 1: El comienzo | 3:Tomo 2: La huida | 4:Tomo 2: La huida | 5:Tomo 2: La huida | 6:');
  eq('y con eso se arman los tomos', resumen(p.tomosDe(p.collectChapters().list)),
    'Tomo 1: El comienzo [1 a 2] 1,2 | Tomo 2: La huida [3 a 5] 3,4,5 | Sin volumen [6] 6');
}
{
  const p = pagina(dir, { title: 'Clásico - Todos los capítulos', url: 'https://sitio.com/clasico/', links: [
    ['/clasico/leer/1', 'Capítulo 1', 'Clásico'], ['/clasico/leer/2', 'Capítulo 2'], ['/clasico/leer/3', 'Capítulo 3']] });
  eq('un título que no nombra un tomo no se anota', JSON.stringify(p.collectChapters().list[0]),
    '{"numero":1,"title":"Capítulo 1","url":"https://sitio.com/clasico/leer/1","raw":"1"}');
}
{
  // Desplegable de capítulos separado en grupos (<optgroup>)
  const p = pagina(dir, { title: 'Serie Capítulo 3', url: 'https://sitio.com/leer/3', options: [
    ['1', 'Capítulo 1', false, 'Volumen 1'], ['2', 'Capítulo 2', false, 'Volumen 1'],
    ['3', 'Capítulo 3', false, 'Volumen 2'], ['4', 'Capítulo 4', false, 'Volumen 2'], ['5', 'Capítulo 5']] });
  eq('desplegable con grupos: el grupo es el tomo (también el del capítulo abierto)', secciones(p),
    '1:Volumen 1 | 2:Volumen 1 | 3:Volumen 2 | 4:Volumen 2 | 5:');
}

fin();
