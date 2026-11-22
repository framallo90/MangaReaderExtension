// Nombre sugerido (serie, saga, número) y dirección de la página.
// Uso: node tests/test_nombres.js "<carpeta de la versión>/manga-reader-ext"
const { pagina, probador } = require('./extraer');
const dir = process.argv[2];
const { eq, fin } = probador();
const page = (title, url) => pagina(dir, { title, url });
const U = 'https://sitio.com/manga/es/todos/';
const SF = 'One Piece/11 Saga Final/One Piece 1134';

// ── Casos de la 2.5 ──
eq('Bleach 686', page('Bleach 686', U + '686').suggestName(), 'Bleach/Bleach 0686');
eq('Witch Watch 150', page('Witch Watch 150', U + '150').suggestName(), 'Witch Watch/Witch Watch 0150');
eq('One Piece Fans', page('One Piece Manga 1134 - One Piece Fans', U + '1134').suggestName(), SF);
eq('decimal 1134.5', page('One Piece Capítulo 1134.5', U + '1134.5').suggestName(), 'One Piece/11 Saga Final/One Piece 1134.5');
eq('decimal 1057.5 → Wano', page('One Piece Capítulo 1057.5', U + 'x').suggestName(), 'One Piece/10 Wano/One Piece 1057.5');
eq('1057 → Wano', page('One Piece 1057', U + 'x').suggestName(), 'One Piece/10 Wano/One Piece 1057');
eq('1058 → Saga Final', page('One Piece 1058', U + 'x').suggestName(), 'One Piece/11 Saga Final/One Piece 1058');
eq('Serie - Capítulo 12', page('Chainsaw Man - Capítulo 12', U + 'x').suggestName(), 'Chainsaw Man/Chainsaw Man 0012');
eq('Serie Chapter 12', page('Black Clover Chapter 370', U + 'x').suggestName(), 'Black Clover/Black Clover 0370');
eq('Serie Ch. 5', page('Dandadan Ch. 5', U + 'x').suggestName(), 'Dandadan/Dandadan 0005');
eq('Serie Cap. 5', page('Dandadan Cap. 5', U + 'x').suggestName(), 'Dandadan/Dandadan 0005');
eq('Serie #12', page('Sakamoto Days #12', U + 'x').suggestName(), 'Sakamoto Days/Sakamoto Days 0012');
eq('Serie Manga Capítulo 12', page('One Piece Manga Capítulo 1', U + 'x').suggestName(), 'One Piece/01 East Blue/One Piece 0001');
eq('Kaiju No. 8', page('Kaiju No. 8 Capítulo 100', U + 'x').suggestName(), 'Kaiju No. 8/Kaiju No. 8 0100');
eq('Serie | Sitio', page('Berserk 375 | MangaSitio', U + 'x').suggestName(), 'Berserk/Berserk 0375');
eq('número en ?capitulo=', page('Lector de Berserk', 'https://s.com/leer?capitulo=12').suggestName(), 'Lector de Berserk/Lector de Berserk 0012');
eq('pageKey sin query', page('x', 'https://s.com/manga/1134').pageKey(), 'https://s.com/manga/1134');
eq('pageKey con ?capitulo', page('x', 'https://s.com/leer?serie=op&capitulo=12').pageKey(), 'https://s.com/leer?capitulo=12&serie=op');
eq('pageKey sin utm', page('x', 'https://s.com/leer?capitulo=12&utm_source=fb&fbclid=abc').pageKey(), 'https://s.com/leer?capitulo=12');
eq('caps distintos ≠', String(page('x', 'https://s.com/leer?c=12').pageKey() !== page('x', 'https://s.com/leer?c=13').pageKey()), 'true');

// ── 2.7: títulos con el nombre del capítulo, palabras de más o el número adelante ──
eq('título del capítulo después del número', page('One Piece Capítulo 1134: La biblioteca del búho', U + '1134').suggestName(), SF);
eq('Serie - Capítulo N - título', page('Chainsaw Man - Capítulo 150 - El título del capítulo', U + '150').suggestName(), 'Chainsaw Man/Chainsaw Man 0150');
eq('Capítulo N - Serie', page('Capítulo 1134 - One Piece', U + '1134').suggestName(), SF);
eq('Serie N Español', page('One Piece 1134 Español', U + '1134').suggestName(), SF);
eq('Leer Serie N Online', page('Leer One Piece 1134 Online', U + '1134').suggestName(), SF);
eq('Serie N (Español) - Sitio', page('One Piece 1134 (Español) - Sitio', U + '1134').suggestName(), SF);
eq('Serie Vol. 3 Cap. 20', page('Dandadan Vol. 3 Cap. 20', U + '20').suggestName(), 'Dandadan/Dandadan 0020');
eq('Serie Capítulo 12 - 2', page('Solo Leveling Capítulo 12 - 2', U + '12').suggestName(), 'Solo Leveling/Solo Leveling 0012');
eq('Serie #12: título', page('Sakamoto Days #12: El título', U + '12').suggestName(), 'Sakamoto Days/Sakamoto Days 0012');
eq('Capitán Tsubasa (empieza con "Cap")', page('Capitán Tsubasa 12', U + '12').suggestName(), 'Capitán Tsubasa/Capitán Tsubasa 0012');
eq('Chapter adentro de una palabra no cuenta', page('Witch Watch 150 - Sitio', U + '150').suggestName(), 'Witch Watch/Witch Watch 0150');
eq('sitio real, capítulo', page('One Piece Manga 1134  - One Piece Fans', 'https://s.com/manga/es/todos/1134').suggestName(), SF);
eq('sitio real, portada (capítulo 01)', page('One Piece Manga 01  - One Piece Fans', 'https://s.com/manga/es/todos').suggestName(), 'One Piece/01 East Blue/One Piece 0001');
eq('raw conserva los ceros', page('One Piece Manga 01  - One Piece Fans', 'https://s.com/manga/es/todos').detectChapter().raw, '01');

// ── 2.8.1: MANGA Plus: "[#104] Serie" y un código de 7 cifras en la dirección ──
const MP = 'https://mangaplus.shueisha.co.jp/viewer/2010289';
eq('[#104] Serie | Sitio', page('[#104] Dragon Ball Super | MANGA Plus', MP).suggestName(), 'Dragon Ball Super/Dragon Ball Super 0104');
eq('#12 Serie', page('#12 Sakamoto Days', U + 'x').suggestName(), 'Sakamoto Days/Sakamoto Days 0012');
eq('del código 2010289 no sale el capítulo 10289', page('Dragon Ball Super | MANGA Plus', MP).detectChapter(), null);
eq('número entero al final de la dirección sigue andando', page('Lector', 'https://s.com/leer/serie/12').detectChapter()?.numero, 12);

// ── 2.8.4: el número de la dirección manda cuando aparece en el título ──
eq('título que termina en un año', page('Leer Serie Fan Manga 7 Español Online - 2026', 'https://s.com/manga/serie-fan-manga-7/').suggestName(), 'Serie Fan/Serie Fan 0007');
eq('título que termina en "parte 2"', page('Serie Fan 12 - Parte 2', U + '12').suggestName(), 'Serie Fan/Serie Fan 0012');
eq('"#1" al principio no es el capítulo', page('#1 Lector de manga: Serie Fan 1134', U + '1134').detectChapter().numero, 1134);
eq('serie que termina en número', page('Kaiju No. 8 8', U + '8').suggestName(), 'Kaiju No. 8/Kaiju No. 8 0008');
eq('[#12] con serie que termina en número', page('[#12] Kaiju No. 8 | MANGA Plus', MP).suggestName(), 'Kaiju No. 8/Kaiju No. 8 0012');
eq('ceros adelante en la dirección y en el título', page('One Piece Manga 01  - One Piece Fans', U + '01').detectChapter().raw, '01');
eq('título sin el número de la dirección: vale el del final', page('Serie Fan 12', U + 'lector').suggestName(), 'Serie Fan/Serie Fan 0012');

// ── 2.7: sagas cargadas por el usuario ──
{
  const p = page('Naruto 300', U + '300');
  eq('sin sagas propias', p.suggestName(), 'Naruto/Naruto 0300');
  p.setSagas({ naruto: [[1, 244, 'Parte 1'], [245, 700, 'Shippuden']] });
  eq('con sagas propias', p.suggestName(), 'Naruto/02 Shippuden/Naruto 0300');
  const op = page('One Piece 50', U + '50');
  op.setSagas({ 'one piece': [[1, 60, 'Mi saga']] });
  eq('las propias reemplazan a las incluidas', op.suggestName(), 'One Piece/01 Mi saga/One Piece 0050');
}

// ── 2.7: la misma dirección con y sin barra final ──
{
  const p = page('x', 'https://s.com/manga/1134/');
  eq('pageKey de otra dirección', p.pageKey(new URL('https://s.com/leer?utm_source=x&c=7')), 'https://s.com/leer?c=7');
  eq('barra final no distingue', String(p.noSlashFn('https://s.com/manga/1134/') === p.noSlashFn('https://s.com/manga/1134')), 'true');
  eq('barra final antes de ?', p.noSlashFn('https://s.com/leer/?c=7'), 'https://s.com/leer?c=7');
}
fin();
