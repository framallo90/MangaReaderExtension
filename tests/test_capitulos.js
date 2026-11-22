// Descarga de varios capítulos: de dónde salen los capítulos y cómo se arman sus direcciones.
// Uso: node tests/test_capitulos.js "<carpeta de la versión>/manga-reader-ext"
const { pagina, probador } = require('./extraer');
const dir = process.argv[2];
const { eq, fin } = probador();
const S = 'https://s.com';
const nums = (r) => r.list.map(c => c.numero).join(',');

// ── Partir una dirección en molde + número ──
{
  const p = pagina(dir);
  const sp = (u) => { const s = p.splitChapterUrl(u); return s ? `${s.pre}|${s.num}|${s.post}` : 'null'; };
  eq('número al final de la ruta', sp(S + '/manga/es/todos/1134'), S + '/manga/es/todos/|1134|');
  eq('con ceros adelante', sp(S + '/manga/es/todos/01'), S + '/manga/es/todos/|01|');
  eq('decimal', sp(S + '/manga/es/todos/1134.5'), S + '/manga/es/todos/|1134.5|');
  eq('barra final', sp(S + '/serie/capitulo-12/'), S + '/serie/capitulo-|12|/');
  eq('.html', sp(S + '/serie/cap-12.html'), S + '/serie/cap-|12|.html');
  eq('con parámetros', sp(S + '/leer/12?idioma=es'), S + '/leer/|12|?idioma=es');
  eq('número en ?capitulo=', sp(S + '/leer?serie=op&capitulo=12&x=1'), S + '/leer?serie=op&capitulo=|12|&x=1');
  eq('sin número', sp(S + '/manga/es/todos'), 'null');
  eq('un id largo no es un capítulo', sp('https://twitter.com/user/status/123456789'), 'null');
  eq('no http', sp('javascript:void(0)'), 'null');

  eq('formas de 5 (sitio sin ceros)', p.numForms(5).join(','), '5,05,005');
  eq('formas de 5 (sitio con 2 dígitos)', p.numForms(5, 2).join(','), '05,5,005');
  eq('formas de 50', p.numForms(50, 2).join(','), '50,050');
  eq('formas de 1134', p.numForms(1134, 2).join(','), '1134');
  eq('formas de 7.5', p.numForms(7.5, 2).join(','), '07.5,7.5,007.5');
}

// ── Sitio real: página de un capítulo, sin links y con el desplegable todavía cargando ──
{
  const p = pagina(dir, { title: 'One Piece Manga 1134  - One Piece Fans', url: S + '/manga/es/todos/1134',
    links: [['/', ''], ['/manga/es/todos', 'Manga'], ['https://x.com/alguien', 'X']],
    options: [['', 'Lista de capítulos', true], ['', 'Cargando...', true]] });
  const r = p.collectChapters();
  eq('capítulo: lista', nums(r), '1134');
  eq('capítulo: molde', r.pat.pre + '{n}' + r.pat.post, S + '/manga/es/todos/{n}');
  eq('capítulo: molde seguro', r.guessed, false);
  eq('capítulo: actual', r.current, 1134);
  eq('capítulo: el actual usa su propia dirección', r.list[0].url, S + '/manga/es/todos/1134');
  eq('capítulo: siguiente', p.nextChapterUrl(), S + '/manga/es/todos/1135');
}

// ── Sitio real: portada de la serie (muestra el capítulo 01 y la dirección no tiene número) ──
{
  const p = pagina(dir, { title: 'One Piece Manga 01  - One Piece Fans', url: S + '/manga/es/todos' });
  const r = p.collectChapters();
  eq('portada: molde supuesto', r.pat.pre + '{n}' + r.pat.post, S + '/manga/es/todos/{n}');
  eq('portada: avisa que es supuesto', r.guessed, true);
  eq('portada: ancho del número (01 → 2)', r.width, 2);
  eq('portada: lista', nums(r), '1');
  eq('portada: el actual usa esta misma dirección', r.list[0].url, S + '/manga/es/todos');
  eq('portada: siguiente con cero adelante', p.nextChapterUrl(), S + '/manga/es/todos/02');
}

// ── El desplegable ya cargó: valores numéricos ──
{
  const options = [['', 'Lista de capítulos', true], ['01', 'Capítulo 01'], ['02', 'Capítulo 02'], ['1134', 'Capítulo 1134'], ['1135', 'Capítulo 1135']];
  const p = pagina(dir, { title: 'One Piece Manga 1134  - One Piece Fans', url: S + '/manga/es/todos/1134', options });
  const r = p.collectChapters();
  eq('desplegable: lista', nums(r), '1,2,1134,1135');
  eq('desplegable: conserva cómo estaba escrito', r.list[0].raw, '01');
  eq('desplegable: ancho', r.width, 2);
  eq('desplegable: título', r.list[1].title, 'Capítulo 02');
  eq('desplegable: siguiente', p.nextChapterUrl(), S + '/manga/es/todos/1135');
}

// ── Desplegable con direcciones, y con el número solo en el texto ──
{
  const p = pagina(dir, { title: 'Serie 3', url: S + '/leer/serie/3',
    options: [['/leer/serie/1', 'Cap 1'], ['/leer/serie/2', 'Cap 2'], ['/leer/serie/3', 'Cap 3'], ['/leer/serie/4', 'Cap 4']] });
  eq('opciones con dirección', p.collectChapters().list.map(c => c.url).join(' '), `${S}/leer/serie/1 ${S}/leer/serie/2 ${S}/leer/serie/3 ${S}/leer/serie/4`);
  const q = pagina(dir, { title: 'Serie 3', url: S + '/leer/serie/3', options: [['abc', 'Capítulo 7'], ['def', 'Capítulo 8.5']] });
  eq('opciones con el número en el texto', nums(q.collectChapters()), '3,7,8.5');
}

// ── Sitio clásico: listado con links, mezclado con paginación, noticias y otro idioma ──
{
  const links = [['/leer/x/1', 'Capítulo 1'], ['/leer/x/2', 'Capítulo 2'], ['/leer/x/3', 'Capítulo 3'], ['/leer/x/3', 'repetido'],
    ['/leer/x/3.5', 'Extra'], ['/leer/x/4#comentarios', 'Capítulo 4'], ['/en/leer/x/3', 'Chapter 3'], ['/page/2', 'Siguiente'],
    ['/lista?page=3', '3'], ['/noticias/2026', 'Noticias'], ['https://twitter.com/user/status/123456789', 'Tweet'], ['https://otro.com/leer/x/9', 'Otro sitio']];
  const p = pagina(dir, { title: 'Serie X - Todos los capítulos', url: S + '/serie/x/', links });
  const r = p.collectChapters();
  eq('listado: solo los capítulos de la serie', nums(r), '1,2,3,3.5,4');
  eq('listado: molde', r.pat.pre + '{n}' + r.pat.post, S + '/leer/x/{n}');
  eq('listado: molde seguro', r.guessed, false);
  eq('listado: sin #', r.list[4].url, S + '/leer/x/4');
  eq('listado: el primer link gana', r.list[2].title, 'Capítulo 3');
}

// ── 2.8.1: MANGA Plus: la dirección lleva un código del sitio, no el número del capítulo ──
{
  const MP = 'https://mangaplus.shueisha.co.jp';
  const p = pagina(dir, { title: '[#104] Dragon Ball Super | MANGA Plus', url: MP + '/viewer/2010289',
    links: [['/viewer/2010288', 'Anterior'], ['/titles/100012', 'Dragon Ball Super'], ['/updates', 'Reciente']] });
  const r = p.collectChapters();
  eq('código: no hay molde', r.pat, null);
  eq('código: no se supone "+/número"', r.guessed, false);
  eq('código: avisa cuál es', r.code, '2010289');
  eq('código: el actual sale del título', r.current, 104);
  eq('código: la lista es el capítulo abierto, con su dirección', r.list.map(c => c.numero + ' ' + c.url).join(' | '), '104 ' + MP + '/viewer/2010289');
  eq('código: sin siguiente inventado', p.nextChapterUrl(), '');
  // Hasta la 2.8.3, si el título decía otro número se descartaba la dirección. Eso rompía
  // sitios comunes (títulos que terminan en un año, o que quedan viejos al cambiar de
  // capítulo sin recargar), así que con un número de hasta 5 cifras se confía en la dirección.
  const q = pagina(dir, { title: '[#104] Dragon Ball Super', url: MP + '/viewer/12345' });
  const rq = q.collectChapters();
  eq('número corto en la dirección: se confía en ella', `${rq.code}|${rq.pat.pre}{n}${rq.pat.post}`, `|${MP}/viewer/{n}`);
  const s = pagina(dir, { title: 'Dragon Ball Super | MANGA Plus', url: MP + '/viewer/2010289' });
  const rs = s.collectChapters();
  eq('código sin número en el título', `${rs.code} ${rs.current} ${rs.list.length}`, '2010289 null 0');
  const o = pagina(dir, { title: 'One Piece Manga 1134  - One Piece Fans', url: S + '/manga/es/todos/1134' });
  eq('el sitio de siempre no cambia', `${o.collectChapters().code}|${o.collectChapters().pat.pre}`, `|${S}/manga/es/todos/`);
}

// ── 2.8.4: el título no manda sobre la dirección ──
{
  // Sitio que cambia de capítulo sin recargar: la dirección ya es la del 1134 y el título quedó en el 1133
  const viejo = pagina(dir, { title: 'One Piece Manga 1133  - One Piece Fans', url: S + '/manga/es/todos/1134' });
  const rv = viejo.collectChapters();
  eq('título viejo: el molde sale de la dirección', `${rv.code}|${rv.pat.pre}{n}${rv.pat.post}|${rv.current}`, `|${S}/manga/es/todos/{n}|1134`);
  eq('título viejo: hay siguiente', viejo.nextChapterUrl(), S + '/manga/es/todos/1135');

  // Dirección con el número en el nombre de la página, barra final y un título que termina en un año
  const fan = pagina(dir, { title: 'Leer Serie Fan Manga 7 Español Online - 2026', url: S + '/manga/serie-fan-manga-7/',
    links: [['/manga/serie-fan-manga-8/', 'Siguiente'], ['/manga/serie-fan-manga-6/', 'Anterior'], ['/', 'Inicio']] });
  const rf = fan.collectChapters();
  eq('título con un año al final: molde', `${rf.code}|${rf.pat.pre}{n}${rf.pat.post}`, `|${S}/manga/serie-fan-manga-{n}/`);
  eq('título con un año al final: lista y actual', `${nums(rf)} · ${rf.current}`, '6,7,8 · 7');
  eq('título con un año al final: siguiente', fan.nextChapterUrl(), S + '/manga/serie-fan-manga-8/');

  // Listado de la serie con un código largo en su dirección: los links de los capítulos mandan
  const lista = pagina(dir, { title: 'Serie Fan - Todos los capítulos', url: S + '/serie/1234567-serie-fan',
    links: [['/leer/serie-fan-3.html', 'Capítulo 3'], ['/leer/serie-fan-2.html', 'Capítulo 2'], ['/leer/serie-fan-1.html', 'Capítulo 1']] });
  const rl = lista.collectChapters();
  eq('listado con código en la dirección: usa los links', `${rl.code}|${nums(rl)}|${rl.pat.pre}{n}${rl.pat.post}`, `|1,2,3|${S}/leer/serie-fan-{n}.html`);
  // …y si no hay links, no inventa nada
  const sola = pagina(dir, { title: 'Serie Fan', url: S + '/serie/1234567-serie-fan' });
  eq('listado con código y sin links: sin molde', `${sola.collectChapters().code}|${sola.collectChapters().pat}`, '1234567|null');
}

// ── 2.8.6: los links del archivo por fecha de un blog no son capítulos ──
{
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const archivo = [...MESES.map((m, i) => [`/2021/${String(i + 1).padStart(2, '0')}/`, `${m} 2021`]),
    ['/2022/01/', 'enero 2022'], ['/2022/02/', 'febrero 2022'], ['/2021/01/15/', '15'], ['/2021/01/16/', '16']];

  // Listado de la serie: más links de archivo (16) que de capítulos (3), y aun así valen los capítulos
  const lista = pagina(dir, { title: 'Serie Fan - Todos los capítulos', url: S + '/serie-fan/',
    links: [...archivo, ['/leer/serie-fan-3/', 'Capítulo 3'], ['/leer/serie-fan-2/', 'Capítulo 2'], ['/leer/serie-fan-1/', 'Capítulo 1']] });
  const rl = lista.collectChapters();
  eq('archivo por mes: la lista son los capítulos, no los meses', `${nums(rl)} · ${rl.list.map(c => c.title).join(',')}`, '1,2,3 · Capítulo 1,Capítulo 2,Capítulo 3');
  eq('archivo por mes: molde de los capítulos', rl.pat.pre + '{n}' + rl.pat.post, S + '/leer/serie-fan-{n}/');

  // Capítulo cuya dirección no termina en número, con la tira de meses al costado: no se toma como lista
  const cap = pagina(dir, { title: 'Ver Serie Fan Manga 104 Español Completo', url: S + '/serie-fan-manga-104-espanol/', links: [...archivo, ['/', 'Inicio']] });
  const rc = cap.collectChapters();
  eq('archivo por mes en un capítulo: no entra ningún mes', `${nums(rc)}|${rc.guessed}`, '|true');
  eq('archivo por mes en un capítulo: "siguiente" no es febrero', cap.nextChapterUrl(), '');

  // La página del archivo de un mes no es un capítulo, pero sirve de listado si tiene links a capítulos
  const mes = pagina(dir, { title: 'enero 2021 - Sitio', url: S + '/2021/01/', links: [...archivo, ['/leer/serie-fan-31/', 'Serie Fan 31'], ['/leer/serie-fan-32/', 'Serie Fan 32']] });
  const rm = mes.collectChapters();
  eq('página del archivo de un mes: toma los capítulos que lista', `${nums(rm)} · ${rm.pat.pre}{n}${rm.pat.post}`, `31,32 · ${S}/leer/serie-fan-{n}/`);

  // El archivo también viene como desplegable ("Elegir el mes"), con la dirección en el valor
  const desp = pagina(dir, { title: 'Serie Fan - Todos los capítulos', url: S + '/serie-fan/',
    links: [['/leer/serie-fan-2/', 'Capítulo 2'], ['/leer/serie-fan-1/', 'Capítulo 1']],
    options: [['', 'Elegir el mes'], [S + '/2021/01/', ' enero 2021 (2)'], [S + '/2021/02/', ' febrero 2021 (4)'], [S + '/2021/03/', ' marzo 2021 (1)']] });
  eq('archivo por mes en un desplegable: tampoco entra', nums(desp.collectChapters()), '1,2');

  // Lo que no es archivo sigue entrando
  const otros = pagina(dir, { title: 'Serie 2001', url: S + '/serie/', links: [['/2021/05/', 'Capítulo 5'], ['/2021/06/', 'Capítulo 6'], ['/2021/13/', 'trece'], ['/2021/14/', 'catorce']] });
  eq('si el texto dice "Capítulo", o el número no es un mes, no es archivo', nums(otros.collectChapters()), '5,6,13,14');
  // Serie cuyo código en el sitio parece un año: sin un mes ni el año en el texto, son capítulos
  const codigo = pagina(dir, { title: 'Serie Fan', url: S + '/serie/fan/', links: [['/leer/2015/1', '1'], ['/leer/2015/2', '2'], ['/leer/2015/3', 'Final']] });
  eq('serie con código 2015: sus capítulos 1 a 3 no son meses', nums(codigo.collectChapters()), '1,2,3');
  const capCodigo = pagina(dir, { title: 'Serie Fan 3 - Sitio', url: S + '/leer/2015/3' });
  eq('  y desde uno de sus capítulos el molde sale de la dirección', capCodigo.collectChapters().pat.pre + '{n}', S + '/leer/2015/{n}');
  const real = pagina(dir, { title: 'One Piece Manga 05  - One Piece Fans', url: S + '/manga/es/todos/05' });
  eq('una dirección de capítulo común no se confunde con una fecha', `${real.collectChapters().current} ${real.collectChapters().pat.pre}`, `5 ${S}/manga/es/todos/`);
}

// ── 2.8.7: si la dirección termina en un archivo, no se supone "dirección + /número" ──
if (/file = last/.test(require('fs').readFileSync(require('path').join(dir, 'content.js'), 'utf8'))) {
  // Capítulo con el número en el medio del nombre del archivo y sin links a otros capítulos
  const p = pagina(dir, { title: 'Ver Serie Fan Manga 104 Español Completo Online', url: S + '/2025/02/serie-fan-manga-104-espanol.html',
    links: [['/', 'Inicio'], ['/2025/02/', 'febrero 2025'], ['/p/contacto.html', 'Contacto']] });
  const r = p.collectChapters();
  eq('archivo .html sin número al final: no hay molde ni se supone uno', `${r.pat}|${r.guessed}|${r.file}`, 'null|false|serie-fan-manga-104-espanol.html');
  eq('archivo .html: la lista no trae nada inventado', nums(r), '');
  eq('archivo .html: sin siguiente inventado', p.nextChapterUrl(), '');
  // Si el título dice el número, el capítulo abierto entra con su propia dirección
  const t = pagina(dir, { title: 'Serie Fan Capítulo 104 - Sitio', url: S + '/leer/serie-fan-104-final.html' });
  const rt = t.collectChapters();
  eq('archivo .html con el número en el título: entra el capítulo abierto', `${rt.list.map(c => c.numero + ' ' + c.url).join()}|${rt.pat}`, `104 ${S}/leer/serie-fan-104-final.html|null`);
  // Otras terminaciones de archivo, con parámetros
  const php = pagina(dir, { title: 'Lector', url: S + '/lector.php?serie=fan' });
  eq('archivo .php con parámetros: tampoco se supone', `${php.collectChapters().pat}|${php.collectChapters().file}`, 'null|lector.php');
  // Con links a capítulos, valen los links aunque la página sea un archivo
  const l = pagina(dir, { title: 'Serie Fan - Lista', url: S + '/lista.html', links: [['/leer/serie-fan-1.html', 'Capítulo 1'], ['/leer/serie-fan-2.html', 'Capítulo 2']] });
  const rl = l.collectChapters();
  eq('archivo .html con links a capítulos: usa los links', `${nums(rl)}|${rl.file}|${rl.pat.pre}{n}${rl.pat.post}`, `1,2||${S}/leer/serie-fan-{n}.html`);
  // Un capítulo cuya dirección termina en número antes del .html sigue igual
  const c = pagina(dir, { title: 'Serie Fan 12', url: S + '/leer/serie-fan-12.html' });
  eq('archivo con el número al final: el molde sale de la dirección', `${c.collectChapters().file}|${c.collectChapters().pat.pre}{n}${c.collectChapters().pat.post}`, `|${S}/leer/serie-fan-{n}.html`);
  // Y una portada sin archivo (el sitio de siempre) se sigue suponiendo
  const o = pagina(dir, { title: 'One Piece Manga 01  - One Piece Fans', url: S + '/manga/es/todos' });
  eq('portada sin archivo: se sigue suponiendo "+ /número"', `${o.collectChapters().guessed}|${o.collectChapters().file}|${o.collectChapters().pat.pre}`, `true||${S}/manga/es/todos/`);
}

// ── 2.9: capítulos a partir de links pegados ──
{
  const p = pagina(dir, { title: 'Cualquier página', url: S + '/' });
  if (p.chaptersFromLinks) {
    const B = 'https://blog.example';
    const ver = (r) => `${r.how}: ` + r.items.map(c => `${c.numero}=${c.url.replace(B, '')}`).join(' ');
    const L = (t, mode, start) => p.chaptersFromLinks(t, mode, start);

    // El número en el medio del nombre de la página, y la carpeta de la fecha que cambia de un link a otro
    const blog = [1, 2, 33, 104].map((n, i) => `${B}/20${21 + i}/0${i + 1}/serie-fan-manga-${String(n).padStart(2, '0')}-espanol-color.html`);
    eq('links: el número sale del nombre de la página, no de la fecha', ver(L(blog.join('\n'))),
      'link: 1=/2021/01/serie-fan-manga-01-espanol-color.html 2=/2022/02/serie-fan-manga-02-espanol-color.html 33=/2023/03/serie-fan-manga-33-espanol-color.html 104=/2024/04/serie-fan-manga-104-espanol-color.html');
    eq('links: pegados en cualquier orden quedan por número', L([blog[3], blog[0], blog[2], blog[1]].join('\n')).items.map(c => c.numero).join(','), '1,2,33,104');
    eq('links: título legible de cada uno', L(blog[0]).items[0].title, 'serie fan manga 01 espanol color');

    // Con texto alrededor: títulos sin link, "01:" adelante, viñetas, varios en un renglón
    const sucio = `Capítulos 01–09\n\n01: ${blog[0]}\n02: ${blog[1]}\nCapítulos 30–39\n\n - ${blog[2]}, ${blog[3]}.\nfin`;
    eq('links: los títulos y lo que no es link se ignoran', L(sucio).items.map(c => c.numero).join(','), '1,2,33,104');
    eq('links: repetidos (con # o barra final) no entran dos veces', `${L(`${blog[0]}\n${blog[0]}#comentarios\n${B}/a/cap-5/\n${B}/a/cap-5`).items.length} ${L(`${blog[0]}\n${blog[0]}#comentarios\n${B}/a/cap-5/\n${B}/a/cap-5`).dup}`, '2 2');

    // Varios números en el nombre: vale el que cambia de un link a otro
    eq('links: "serie-2-…-104-2025" → el que cambia', ver(L(`${B}/serie-2-cap-7-2025\n${B}/serie-2-cap-8-2025\n${B}/serie-2-cap-9-2025`)),
      'link: 7=/serie-2-cap-7-2025 8=/serie-2-cap-8-2025 9=/serie-2-cap-9-2025');
    eq('links: número al final, decimales y ceros adelante', L(`${B}/leer/cap-007/\n${B}/leer/cap-7.5/\n${B}/leer/cap-8/`).items.map(c => c.numero).join(','), '7,7.5,8');
    eq('links: número en ?capitulo=', L(`${B}/leer?serie=x&capitulo=3\n${B}/leer?serie=x&capitulo=4`).items.map(c => c.numero).join(','), '3,4');

    // El número escrito adelante manda sobre el del link
    eq('links: "12: link" usa el número escrito adelante', ver(L(`12: ${B}/p/aaa.html\n13 - ${B}/p/bbb.html\nCapítulo 14) ${B}/p/ccc.html`)),
      'label: 12=/p/aaa.html 13=/p/bbb.html 14=/p/ccc.html');
    eq('links: si a alguno le falta el número adelante, se mira el link', L(`1: ${B}/cap-5\n${B}/cap-6`).how, 'link');

    // Sin número en los links: en el orden pegado
    const sueltos = `${B}/p/la-llegada.html\n${B}/p/el-torneo.html\n${B}/p/el-final.html`;
    eq('links sin número: en el orden pegado, desde 1', ver(L(sueltos)), 'order: 1=/p/la-llegada.html 2=/p/el-torneo.html 3=/p/el-final.html');
    eq('links sin número: desde el que se pida', L(sueltos, 'auto', 50).items.map(c => c.numero).join(','), '50,51,52');
    eq('links: "al revés" (pegados del último al primero)', ver(L(sueltos, 'reverse', 10)), 'reverse: 10=/p/el-final.html 11=/p/el-torneo.html 12=/p/la-llegada.html');
    eq('links: "en el orden pegado" no mira el número del link', ver(L(`${B}/cap-9\n${B}/cap-3`, 'order', 1)), 'order: 1=/cap-9 2=/cap-3');
    eq('links: números repetidos en los links → en el orden pegado', L(`${B}/a/cap-1\n${B}/b/cap-1\n${B}/c/cap-1`).how, 'order');
    eq('links: un código largo no es un número de capítulo', ver(L(`${B}/viewer/2010289\n${B}/viewer/2010290`)), 'order: 1=/viewer/2010289 2=/viewer/2010290');

    eq('links: de otros sitios también valen', L('https://uno.example/cap-1\nhttps://dos.example/cap-2').items.length, 2);
    eq('links: nada que no sea http(s)', L('javascript:alert(1)\nftp://x.example/cap-1\nsin links acá').items.length, 0);
    eq('links: texto vacío', JSON.stringify(L('')), '{"items":[],"how":"","dup":0}');
  }
}

// ── Capítulo con links al anterior y al siguiente ──
{
  const p = pagina(dir, { title: 'Serie 12', url: S + '/leer/x/12', links: [['/leer/x/11', 'Anterior'], ['/leer/x/12.5', 'Siguiente'], ['/leer/x/13', '13']] });
  eq('siguiente: el próximo que existe (12.5)', p.nextChapterUrl(), S + '/leer/x/12.5');
  const q = pagina(dir, { title: 'Sin número', url: S + '/acerca' });
  eq('siguiente: página que no es un capítulo', q.nextChapterUrl(), '');
}
fin();
