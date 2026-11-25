// Pruebas del programa. Corren dentro de Electron ("npm run prueba") contra el sitio de
// prueba de tests/sitio.js: exploran los tres niveles, bajan capítulos a una carpeta
// temporal y miran los archivos que quedaron. Si la variable CAPTURAS nombra una carpeta,
// guardan ahí una captura de la interfaz.
const fs = require('fs'), os = require('os'), path = require('path');
const { iniciar } = require('./sitio');
const { iniciarProxy } = require('./proxy');
const { probarFreno } = require('./freno');
const { pdfPages, zipNames } = require('../../tests/navegador');
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
// Un freno de un minuto, leído en ms o en segundos ("sigo en 58 s")
const minuto = (ms) => (ms >= 55000 && ms <= 60000 ? 'entre 55 y 60 s' : `${Math.round(ms / 1000)} s`);
const minutoN = (n) => (n >= 55 && n <= 60 ? 'entre 55 y 60 s' : `${n} s`);

module.exports = async function probar(api) {
  let fallas = 0;
  const eq = (etiqueta, obtenido, esperado) => {
    const g = typeof obtenido === 'string' ? obtenido : JSON.stringify(obtenido), w = typeof esperado === 'string' ? esperado : JSON.stringify(esperado);
    if (g !== w) fallas++;
    console.log((g === w ? 'OK   ' : 'FALLA') + ' ' + etiqueta + ' → ' + g + (g === w ? '' : '   (esperado: ' + w + ')'));
  };
  const sitio = await iniciar();
  const S = sitio.url;
  const tapas = await iniciar({ tapas: true });       // otro sitio, con la portada llena de tapas
  const T = tapas.url;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-programa-'));
  const temporales = [tmp];                           // carpetas a borrar al terminar
  const lista = (r, tipo) => r.listas.find(l => l.tipo === tipo);
  const ls = (rel) => { try { return fs.readdirSync(path.join(tmp, rel)).sort().join(' | '); } catch { return '(no existe)'; } };
  const estados = (cola) => cola.map(t => `${t.nombre || t.texto}: ${t.estado}${t.detalle ? ' (' + t.detalle + ')' : ''}`).join(' ; ');
  console.log(`== Programa · núcleo de ${api.nucleo.version}`);

  try {
    console.log('\n── El freno (la regla de la extensión, en Node)');
    probarFreno(eq);

    console.log('\n── Explorar: catálogo → serie → capítulo');
    const cat = await api.analizar(S + '/');
    eq('catálogo: no es un capítulo y no hay lista de capítulos', `${cat.capitulo} ${!!lista(cat, 'capitulos')}`, 'null false');
    eq('catálogo: la primera lista son los títulos', lista(cat, 'titulos').items.map(i => i.texto).join(', '), 'Alfa, Beta, Gama 3, Delta');
    eq('catálogo: ninguna lista trae el archivo por mes', cat.listas.some(l => l.items.some(i => /2021/.test(i.url))), false);
    eq('catálogo: página siguiente', cat.siguiente, S + '/?page=2');
    eq('portada: encuentra el link al listado completo', cat.catalogos.map(c => `${c.texto} → ${c.url.replace(S, '')}`).join(', '), 'Directorio → /directorio/');
    eq('portada: los links de paginación no entran como títulos', cat.listas.some(l => l.items.some(i => /page=/.test(i.url))), false);

    // Seguir la paginación: junta las páginas siguientes
    const mas = await api.seguir(cat.siguiente, 10, cat.listas.map(l => l.id));
    eq('seguir la paginación: junta las páginas que faltan', `${mas.listas.find(l => l.nombre === '/serie').items.map(i => i.texto).join(', ')} · ${mas.paginas} páginas · sigue: "${mas.siguiente}"`,
      'Épsilon, Zeta, Alfa, Eta · 2 páginas · sigue: ""');
    const una = await api.seguir(cat.siguiente, 1);
    eq('seguir de a una: dice desde dónde continuar', `${una.paginas} · ${una.siguiente.replace(S, '')}`, '1 · /?page=3');

    // Un listado que carga más títulos a medida que se baja
    const dir = await api.analizar(S + '/directorio/');
    eq('directorio que carga al bajar: trae los 15 títulos', `${lista(dir, 'titulos').items.length}: ${lista(dir, 'titulos').items.map(i => i.texto).join(', ')} · ${dir.sigueCreciendo}`,
      '15: Alfa, Beta, Delta, Épsilon, Zeta, Eta, Theta, Iota, Kappa, Lambda, Mu, Nu, Xi, Ómicron, Pi · false');

    const alfa = await api.analizar(lista(cat, 'titulos').items[0].url);
    const caps = lista(alfa, 'capitulos');
    eq('serie: capítulos en orden, con su número', caps.items.map(i => `${i.numero}=${i.texto}`).join(' '), '1=Capítulo 1 2=Capítulo 2 3=Capítulo 3 4=Capítulo 4');
    eq('serie: cada capítulo con el volumen que tenía arriba', caps.items.map(i => i.seccion).join(' | '), 'Volumen 1 | Volumen 1 | Volumen 2 | Volumen 2');
    eq('serie: las otras series quedan como títulos, sin sección', alfa.listas.find(l => l.tipo === 'titulos' && l.nombre === '/serie').items.map(i => i.texto + i.seccion).join(', '), 'Beta, Gama 3, Delta');

    const beta = await api.analizar(S + '/serie/beta/');
    eq('serie con códigos en la dirección: el número sale del texto del link', lista(beta, 'capitulos').items.map(i => `${i.numero}=${i.url.replace(S, '')}`).join(' '),
      '1=/ver/9000001 2=/ver/9000002 3=/ver/9000003');

    console.log('\n── Capítulos con href hash y listas ocultas');
    const cp = await api.analizar(S + '/capitulos-prueba/');
    const capitulosDe = (r) => lista(r, 'capitulos')?.items || [];
    const cps = capitulosDe(cp);
    const nums = cps.map(i => i.numero);
    const esperado = [...Array(109)].map((_, i) => i + 1).join(',');
    eq('hash + ocultos, con códigos en la dirección: una sola lista de capítulos, primera entre todas', cp.listas.map(l => l.tipo).join(' '), 'capitulos titulos');
    eq('  con los 109 capítulos, del 1 al 109 y sin repetidos', `${nums.length} ${nums.join(',')}`, `109 ${esperado}`);
    const uno = (n) => { const i = cps.find(x => x.numero === n); return i ? `${n}=${i.url.replace(S, '')} "${i.texto}" x${i.versiones || 1}` : `${n}: no está`; };
    eq('  los de los botones "Empezar a leer" y "Último capítulo" quedan con su número y su nombre, y el 50 (subido tres veces) una sola vez', [1, 103, 50].map(uno).join(' · '),
      '1=/view_uploads/40001 "Capítulo 1" x1 · 103=/view_uploads/40103 "Capítulo 103" x1 · 50=/view_uploads/40050 "Capítulo 50" x3');
    const raros = await api.analizar(S + '/capitulos-raros/');
    eq('  un renglón "#" sin link real se descarta, sin quedarse con la dirección del de al lado; y con un data-chapter-number que no es un número vale el de la dirección',
      capitulosDe(raros).map(i => `${i.numero}=${i.url.replace(S, '')}`).join(' '), '1=/view_uploads/40001 2=/view_uploads/40002 3=/view_uploads/40003 4=/view_uploads/4');
    eq('  el botón href="#" de un menú no le cambia el nombre al primer link', raros.listas.find(l => l.tipo === 'titulos' && l.nombre === '/serie')?.items.map(i => i.texto).join(', '), 'Alfa, Beta, Delta');
    const envueltos = await api.analizar(S + '/capitulos-envueltos/');
    eq('  un data-number en el bloque que envuelve la lista no numera los renglones', capitulosDe(envueltos).map(i => i.numero).join(','), '1,2,3');
    eq('  el link en un ícono "#" y el número escrito al lado: el renglón entra, con su nombre', capitulosDe(envueltos).map(i => i.texto).join(' | '), 'Capítulo 1: Parte 1 | Capítulo 2: Parte 2 | Capítulo 3: Parte 3');
    eq('  data-number con la posición del renglón: vale el número que dice el texto', capitulosDe(await api.analizar(S + '/capitulos-ranking/')).map(i => i.numero).join(','), '101,102,103');
    const leidas = await api.analizar(S + '/mas-leidas/');
    eq('  un ranking de series con el puesto en data-number: son títulos, no capítulos', `${capitulosDe(leidas).length} capítulos · ${leidas.listas.find(l => l.tipo === 'titulos' && l.nombre === '/serie')?.items.map(i => i.texto).join(', ')}`,
      '0 capítulos · Alfa, Beta, Delta, Zeta');

    const cap = await api.analizar(S + '/leer/alfa-2/');
    eq('capítulo: lo reconoce y propone el nombre', `${cap.capitulo.serie} ${cap.capitulo.numero} → ${cap.capitulo.nombre}`, 'Alfa 2 → Alfa/Alfa 0002');
    eq('página que no existe: lo dice', await api.analizar(S + '/leer/alfa-9/').then(() => 'sin error', e => e.message), 'La página respondió HTTP 404');
    eq('dirección que no es http: lo dice', await api.analizar('file:///c:/windows/win.ini').then(() => 'sin error', e => e.message),
      'La dirección tiene que empezar con http:// o https://');

    console.log('\n── Bajar capítulos');
    api.encolar(caps.items.slice(0, 2), { carpeta: tmp, formatos: { pdf: true, cbz: true, imgs: true } });
    eq('dos capítulos en PDF, CBZ e imágenes', estados(await api.colaVacia()), 'Alfa/Alfa 0001: listo (6 páginas) ; Alfa/Alfa 0002: listo (6 páginas)');
    eq('  archivos, con el nombre que sale del título de cada capítulo', ls('Alfa'), 'Alfa 0001 | Alfa 0001.cbz | Alfa 0001.pdf | Alfa 0002 | Alfa 0002.cbz | Alfa 0002.pdf');
    eq('  PDF con sus 6 páginas (con carga diferida)', pdfPages(path.join(tmp, 'Alfa', 'Alfa 0002.pdf')), '6 × 420x640');
    eq('  CBZ', zipNames(path.join(tmp, 'Alfa', 'Alfa 0001.cbz')).join(' '), '001.jpg 002.jpg 003.jpg 004.jpg 005.jpg 006.jpg ComicInfo.xml');
    eq('  imágenes sueltas', ls('Alfa/Alfa 0001'), 'pagina_001.jpg | pagina_002.jpg | pagina_003.jpg | pagina_004.jpg | pagina_005.jpg | pagina_006.jpg');
    api.limpiar();

    // La serie escrita y el número de la lista mandan cuando la página no dice nada.
    // Este servidor de imágenes exige el Referer del sitio.
    api.encolar(lista(beta, 'capitulos').items.slice(0, 2), { carpeta: tmp, serie: 'Beta', formatos: { pdf: true, cbz: false, imgs: false } });
    eq('capítulos sin número en la dirección ni en el título', estados(await api.colaVacia()), 'Beta/Beta 0001: listo (6 páginas) ; Beta/Beta 0002: listo (6 páginas)');
    eq('  las imágenes se pidieron con el Referer del sitio', `${sitio.pedidos.sinReferer} ${pdfPages(path.join(tmp, 'Beta', 'Beta 0002.pdf'))}`, '0 6 × 420x640');
    api.limpiar();

    const abiertos = sitio.pedidos.capitulos['/leer/alfa-1/'];
    api.encolar([caps.items[0], { url: S + '/leer/alfa-9/', texto: 'No existe', numero: 9 }, { url: S + '/', texto: 'Catálogo' }], { carpeta: tmp, formatos: { pdf: true, cbz: true, imgs: true } });
    eq('lo que ya está se saltea, y lo que falla dice por qué', estados(await api.colaVacia()),
      'Alfa/Alfa 0001: ya estaba (ya está en la carpeta) ; No existe: falló (La página respondió HTTP 404) ; Catálogo: falló (Sin páginas (encontré 1))');     // el 1 es la tapa de una serie
    eq('  sin repetir archivos', ls('Alfa'), 'Alfa 0001 | Alfa 0001.cbz | Alfa 0001.pdf | Alfa 0002 | Alfa 0002.cbz | Alfa 0002.pdf');
    eq('  (para saber que ya estaba hubo que abrir el capítulo una vez más)', sitio.pedidos.capitulos['/leer/alfa-1/'] - abiertos, 1);
    api.limpiar();

    api.encolar([caps.items[1]], { carpeta: tmp, saltear: false, formatos: { pdf: true, cbz: false, imgs: false } });
    eq('sin "saltear": no pisa el archivo, guarda otro', estados(await api.colaVacia()) + ' · ' + ls('Alfa').includes('Alfa 0002 (1).pdf'), 'Alfa/Alfa 0002: listo (6 páginas) · true');
    api.limpiar();
    eq('sin formato elegido: lo dice', (() => { try { api.encolar(caps.items, { carpeta: tmp, formatos: { pdf: false, cbz: false, imgs: false } }); return 'sin error'; } catch (e) { return e.message; } })(), 'Elegí al menos un formato');


    console.log('\n── Lo que ya está en la carpeta');
    // Una serie "Gama" bajada a medias y de varias maneras: en su carpeta, en otra que se llama
    // casi igual, con una plantilla (en la carpeta de su tomo) y como imágenes sueltas
    const poner = (rel) => { const f = path.join(tmp, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 'x'); };
    for (const rel of ['Gama/Gama 0001.pdf', 'Gama Manga/Gama Manga 0002.pdf', 'Gama/Tomo 2/Gama 0003 - Capítulo 3.cbz', 'Gama/Gama 0004/pagina_001.jpg', 'Gama Dos/Gama Dos 0005.pdf']) poner(rel);
    const soloPdf = { pdf: true, cbz: false, imgs: false };
    const enPdf = api.revisarDisco({ serie: 'Gama', numeros: [1, 2, 3, 4, 5, 6], carpeta: tmp, formatos: soloPdf });
    eq('lo que ya está de una serie: por número, con cualquier nombre de archivo y en carpetas que se llaman casi igual',
      `tengo ${enPdf.tengo} · faltan ${enPdf.faltan} (${enPdf.cuantosFaltan}) · ${enPdf.carpetas.join(', ')}`, 'tengo 1,2,3,4 · faltan 5–6 (2) · Gama, Gama Manga');
    eq('  otra serie que empieza igual no cuenta ("Gama Dos")', enPdf.tengo.includes(5), false);
    eq('  cuenta cualquier formato, y dice cuáles están en otro que el pedido (el 3 en CBZ, guardado con plantilla en la carpeta de su tomo; el 4 en imágenes)',
      enPdf.enOtro.map(o => `${o.numero} en ${o.formato}`).join(', ') + ' · pidiendo CBZ: ' + api.revisarDisco({ serie: 'gama', numeros: [1, 2, 3, 4], carpeta: tmp, formatos: { pdf: false, cbz: true, imgs: false } }).enOtro.map(o => o.numero), '3 en cbz, 4 en imgs · pidiendo CBZ: 1,2,4');
    eq('  sin saber la serie no se marca nada', api.revisarDisco({ serie: '', numeros: [1, 2], carpeta: tmp, formatos: soloPdf }).tengo.length, 0);
    api.encolar([{ url: S + '/leer/alfa-2/', texto: 'Capítulo 2', numero: 2 }], { carpeta: tmp, serie: 'Gama', formatos: soloPdf });
    eq('al bajar, lo que ya está con otro nombre se saltea en vez de duplicarse', estados(await api.colaVacia()) + ' · ' + ls('Gama'),
      'Gama/Gama 0002: ya estaba (ya está en la carpeta) · Gama 0001.pdf | Gama 0004 | Tomo 2');
    api.limpiar();

    console.log('\n── Plantilla de nombres y sagas propias');
    api.guardarConfig({ plantilla: '{serie}/{volumen}/{serie} {numero} - {titulo}' });
    api.encolar([{ url: S + '/leer/alfa-3/', texto: 'Capítulo 3', numero: 3, volumen: 'Volumen 2', titulo: 'Capítulo 3' }, { url: S + '/leer/alfa-4/', texto: 'x', numero: 4 }],
      { carpeta: tmp, serie: 'Con Plantilla', formatos: soloPdf });
    eq('con una plantilla propia, el tomo y el nombre del capítulo van al nombre; si no los hay, no queda el hueco', estados(await api.colaVacia()),
      'Con Plantilla/Volumen 2/Con Plantilla 0003 - Capítulo 3: listo (6 páginas) ; Con Plantilla/Con Plantilla 0004: listo (6 páginas)');
    eq('  el archivo queda en la carpeta de su tomo', ls('Con Plantilla/Volumen 2'), 'Con Plantilla 0003 - Capítulo 3.pdf');
    api.limpiar();
    const vista = api.vistaDePlantilla('{serie}/{capitulo}');
    eq('vista previa de una plantilla, con sus avisos', `${vista.lista} · ${vista.suelto} · choca ${vista.choca} · ${vista.raros}`, 'One Piece/{capitulo} · Naruto/{capitulo} · choca true · {capitulo}');
    api.guardarConfig({ plantilla: '', sagasTexto: 'Con Sagas\n1-2 El comienzo\n3- El final' });
    api.encolar([{ url: S + '/leer/alfa-3/', texto: 'x', numero: 3 }], { carpeta: tmp, serie: 'Con Sagas', formatos: soloPdf });
    eq('con sagas propias, cada capítulo va a la carpeta de su saga', estados(await api.colaVacia()), 'Con Sagas/02 El final/Con Sagas 0003: listo (6 páginas)');
    api.guardarConfig({ sagasTexto: '' });
    api.limpiar();

    console.log('\n── Reintentar lo que falló');
    // (primero el que no existe: después del 503 el sitio queda frenado un minuto y el otro esperaría)
    api.encolar([{ url: S + '/leer/alfa-9/', texto: 'No existe', numero: 9 }, { url: S + '/leer/inestable-1/', texto: 'Capítulo 1', numero: 1 }], { carpeta: tmp, serie: 'Inestable', formatos: soloPdf });
    eq('un capítulo que no existe y otro al que no le baja una página (responde 503): el armador corta y no guarda nada a medias', estados(await api.colaVacia()) + ' · ' + ls('Inestable'),
      'No existe: falló (La página respondió HTTP 404) ; Inestable/Inestable 0001: incompleto (no guardé nada, para no dejarlo a medias · el sitio pidió esperar (HTTP 503)) · (no existe)');
    // Que el capítulo quede incompleto no alcanza: hay que ver que el armador esperó de verdad.
    // Son 6 pedidos de esa imagen (el primero, 3 después de esperar 2, 4 y 8 s, y 2 reintentos
    // comunes a los 0,7 y 1,4 s): entre el primero y el último pasan más de 16 segundos.
    const horas = (u) => sitio.pedidos.horas[u] || [];
    const tramo = (h, a, b) => (h.length > Math.max(a, b) ? h[b] - h[a] : -1);
    const inestable = horas('/img/inestable/1/3.jpg');
    eq('  el armador la pidió 6 veces, con sus esperas en el medio (2 + 4 + 8 + 0,7 + 1,4 s)',
      `${inestable.length} pedidos · ${tramo(inestable, 0, 5) >= 16100 ? 'más de 16 s' : tramo(inestable, 0, 5) + ' ms'} entre el primero y el último · la primera espera, ${tramo(inestable, 0, 1) >= 2000 ? 'de 2 s o más' : tramo(inestable, 0, 1) + ' ms'}`,
      '6 pedidos · más de 16 s entre el primero y el último · la primera espera, de 2 s o más');
    eq('  y el sitio queda frenado un minuto (503 sin Retry-After, como en la extensión)', minuto(api.esperaDe(S)), 'entre 55 y 60 s');
    eq('  el aviso de fin de cola lo cuenta', api.ultimoAviso(), '2 con problemas');
    api.olvidarEsperas();            // (el minuto entero se comprueba en la interfaz, más abajo, sin esperarlo)
    eq('reintentar: vuelve a la cola todo lo que no terminó bien', api.reintentar(), 2);
    eq('  el incompleto sale entero y no queda un archivo repetido al lado', estados(await api.colaVacia()) + ' · ' + ls('Inestable') + ' · ' + pdfPages(path.join(tmp, 'Inestable', 'Inestable 0001.pdf')),
      'No existe: falló (La página respondió HTTP 404) ; Inestable/Inestable 0001: listo (6 páginas) · Inestable 0001.pdf · 6 × 420x640');
    eq('  al séptimo pedido el sitio la entrega', horas('/img/inestable/1/3.jpg').length, 7);
    eq('  y el aviso de fin de cola', api.ultimoAviso(), '1 guardado · 1 con problemas');
    api.limpiar();

    console.log('\n── El sitio pide esperar (503, con Retry-After y sin él)');
    const ocupado = (n) => ({ url: `${S}/leer/ocupado-${n}/`, texto: `Capítulo ${n}`, numero: n });
    const enOcupado = { carpeta: tmp, serie: 'Ocupado', formatos: soloPdf };
    const pedidosDe = (n) => horas(`/leer/ocupado-${n}/`);
    // La página de un capítulo responde 503 sin decir cuánto esperar: un minuto, como la extensión
    // (hasta la 0.10.2, el capítulo siguiente salía con la pausa de siempre, 1,5 s)
    api.encolar([ocupado(1)], enOcupado);
    eq('la página de un capítulo responde 503 sin Retry-After: falla con ese motivo', estados(await api.colaVacia()), 'Capítulo 1: falló (La página respondió HTTP 503: el sitio pidió esperar)');
    eq('  y el sitio queda frenado un minuto', minuto(api.esperaDe(S)), 'entre 55 y 60 s');
    // El capítulo siguiente de ese sitio no sale: queda en la cola y dice cuánto falta
    api.encolar([ocupado(3)], enOcupado);
    await dormir(2500);
    const enEspera = api.verCola().find(t => t.numero === 3) || {};
    const faltan = +((String(enEspera.detalle).match(/sigo en (\d+) s/) || [])[1] || 0);
    eq('  el capítulo que sigue, del mismo sitio, no sale: queda en la cola y dice cuánto falta',
      `${enEspera.estado} · ${String(enEspera.detalle).replace(/\d+ s$/, 'N s')} · ${minutoN(faltan)} · pedidos: ${pedidosDe(3).length}`, 'en cola · el sitio pidió esperar: sigo en N s · entre 55 y 60 s · pedidos: 0');
    api.cancelar();
    await api.colaVacia();
    await dormir(1200);
    eq('  al cancelarlo, no sale', `${api.verCola().find(t => t.numero === 3)?.estado} · pedidos: ${pedidosDe(3).length}`, 'cancelado · pedidos: 0');
    api.olvidarEsperas();
    eq('  con el sitio libre, Reintentar baja los dos (el que falló y el cancelado)', api.reintentar() + ' · ' + estados(await api.colaVacia()),
      '2 · Ocupado/Ocupado 0001: listo (6 páginas) ; Ocupado/Ocupado 0003: listo (6 páginas)');
    api.limpiar();
    let cuando;
    // Con Retry-After: 3 → el reintento del capítulo no sale antes de esos 3 segundos
    api.encolar([ocupado(2)], enOcupado);
    eq('la página responde 503 con Retry-After: 3', estados(await api.colaVacia()), 'Capítulo 2: falló (La página respondió HTTP 503: el sitio pidió esperar)');
    cuando = Date.now();
    api.reintentar();                                        // enseguida: el que tiene que esperar es el programa
    const trasReintentar = estados(await api.colaVacia());
    eq('  el reintento, pedido enseguida, espera lo que pidió el sitio: entre el fallo y el pedido nuevo pasan 3 s o más',
      `${trasReintentar} · ${tramo(pedidosDe(2), 0, 1) >= 3000 ? '3 s o más' : tramo(pedidosDe(2), 0, 1) + ' ms'} · ${Date.now() - cuando >= 2000 ? 'esperó' : 'no esperó'}`,
      'Ocupado/Ocupado 0002: listo (6 páginas) · 3 s o más · esperó');
    api.limpiar();
    // …y el capítulo siguiente de la cola tampoco. El que sigue tiene una imagen que también pide esperar 3 s.
    api.encolar([ocupado(5), ocupado(4)], enOcupado);
    eq('en una cola, el capítulo que sigue a uno con Retry-After: 3 también espera', estados(await api.colaVacia()),
      'Capítulo 5: falló (La página respondió HTTP 503: el sitio pidió esperar) ; Ocupado/Ocupado 0004: listo (6 páginas)');
    eq('  entre el 503 y el pedido del capítulo siguiente pasan 3 s o más', pedidosDe(4)[0] - pedidosDe(5)[0] >= 3000 ? '3 s o más' : `${pedidosDe(4)[0] - pedidosDe(5)[0]} ms`, '3 s o más');
    const imagen = horas('/img/ocupado/4/2.jpg');
    eq('  una imagen que responde 503 con Retry-After: 3 se vuelve a pedir recién a los 3 s (sin leerlo serían 2), y el capítulo sale entero',
      `${imagen.length} pedidos · ${tramo(imagen, 0, 1) >= 3000 ? '3 s o más' : tramo(imagen, 0, 1) + ' ms'} · ${pdfPages(path.join(tmp, 'Ocupado', 'Ocupado 0004.pdf'))}`, '2 pedidos · 3 s o más · 6 × 420x640');
    api.reintentar();
    eq('  con el sitio ya libre, Reintentar baja el que había fallado', estados(await api.colaVacia()).split(' ; ')[0], 'Ocupado/Ocupado 0005: listo (6 páginas)');
    api.limpiar();
    // (0.10.3) Un 429 sin cuerpo: Chromium muestra su propia página de error, pero el programa ve la respuesta y frena igual
    api.encolar([{ url: `${S}/leer/vacio-1/`, texto: 'Capítulo 1', numero: 1 }], { carpeta: tmp, serie: 'Vacio', formatos: soloPdf });
    eq('la página responde 429 sin cuerpo (Chromium muestra su página de error): falla con el motivo y el sitio queda frenado un minuto',
      `${estados(await api.colaVacia())} · ${minuto(api.esperaDe(S))}`, 'Capítulo 1: falló (La página respondió HTTP 429: el sitio pidió esperar) · entre 55 y 60 s');
    api.olvidarEsperas();
    eq('  y al reintentar, sale', api.reintentar() + ' · ' + estados(await api.colaVacia()), '1 · Vacio/Vacio 0001: listo (6 páginas)');
    api.limpiar();
    // (0.10.3) La tapa de un "relacionado" (otra carpeta, del mismo sitio) responde 503: no es una página del capítulo y no lo corta
    api.encolar([{ url: `${S}/leer/relacionado-1/`, texto: 'Capítulo 1', numero: 1 }], { carpeta: tmp, serie: 'Relacionado', formatos: soloPdf });
    eq('la tapa de un "relacionado" (otra carpeta) responde 503: el capítulo sale entero y el sitio no queda frenado',
      `${estados(await api.colaVacia())} · la tapa se pidió: ${(sitio.pedidos.horas['/img/relacionados/beta.jpg'] || []).length > 0} · freno ${api.esperaDe(S)}`,
      'Relacionado/Relacionado 0001: listo (6 páginas) · la tapa se pidió: true · freno 0');
    api.limpiar();
    // Estas series no quedan para las pruebas que siguen, que cuentan lo que hay en el registro y en la carpeta
    for (const s of ['ocupado', 'vacio', 'relacionado']) api.quitarDelRegistro(s);
    for (const d of ['Ocupado', 'Vacio', 'Relacionado']) fs.rmSync(path.join(tmp, d), { recursive: true, force: true });

    console.log('\n── Revisar las páginas de un capítulo');
    const rev = await api.paginasDe(S + '/leer/avisos-1/');
    eq('todas las imágenes del capítulo, con lo que el filtro toma por publicidad y por qué', rev.paginas.map(p => p.url.split('/').pop().replace('.jpg', '') + (p.motivo ? ` [${p.motivo}]` : '')).join(' '),
      '1 2 3 aviso [enlace a otro sitio] 4 5 6');
    eq('  y los datos para guardarlo', `${rev.capitulo.serie} ${rev.capitulo.numero} · ${rev.nombre}`, 'Avisos 1 · Avisos/Avisos 0001');
    const abiertas = sitio.pedidos.avisos;
    // A mano: se pone el "aviso" (como si fuera una página mal detectada) y se saca la página 2
    api.encolar([{ url: S + '/leer/avisos-1/', texto: rev.nombre, numero: 1, paginas: rev.paginas.filter(p => !/\/2\.jpg$/.test(p.url)).map(p => p.url),
      info: { capitulo: rev.capitulo, nombre: rev.nombre, clave: rev.clave, titulo: rev.titulo, faltantes: rev.faltantes } }], { carpeta: tmp, formatos: soloPdf });
    eq('bajar con las páginas elegidas a mano: van esas, sin abrir el capítulo otra vez', estados(await api.colaVacia()) + ' · ' + pdfPages(path.join(tmp, 'Avisos', 'Avisos 0001.pdf')) + ' · ' + (sitio.pedidos.avisos - abiertas),
      'Avisos/Avisos 0001: listo (6 páginas) · 6 × 420x640 · 0');
    api.encolar([{ url: S + '/leer/avisos-1/', texto: 'x' }], { carpeta: tmp, saltear: false, formatos: soloPdf });
    eq('sin revisar, el filtro saca el aviso y la cola dice cuántas descartó', estados(await api.colaVacia()).split(' ; ').pop(), 'Avisos/Avisos 0001: listo (6 páginas (1 descartada como publicidad))');
    api.limpiar();

    console.log('\n── Páginas dibujadas de fondo (la detección de la extensión 2.11.3)');
    // La misma página de prueba que la extensión: 8 páginas numeradas de fondo y 18 tapas de otras obras alrededor
    const numeradas = (r) => r.paginas.map(p => p.url.replace(S, '').replace('/fx/img/numerada/', '') + (p.motivo ? ` [${p.motivo}]` : '')).join(' ');
    const deFondo = await api.analizar(S + '/fx/fondo.html');
    eq('explorar la página de fondos: es un capítulo (las tapas de alrededor no la hacen un listado), con sus 8 páginas',
      `${deFondo.capitulo?.serie} ${deFondo.capitulo?.numero} · ${deFondo.capitulo?.imagenes} páginas`, 'Serie Fondo 3 · 8 páginas');
    eq('  sus páginas: las 8, en orden, y ninguna tapa', numeradas(await api.paginasDe(S + '/fx/fondo.html')), '1.png 2.png 3.png 4.png 5.png 6.png 7.png 8.png');
    eq('  y con las tapas también dibujadas de fondo, lo mismo', numeradas(await api.paginasDe(S + '/fx/fondo.html?tapasDeFondo=1')), '1.png 2.png 3.png 4.png 5.png 6.png 7.png 8.png');
    // (Con la extensión 2.11.4) Un catálogo de verdad con un lector de fondo en la misma página: sus 12
    // tapas están juntas en una carpeta y mandan ellas (el lector de fondo decide solo cuando no). Antes
    // se miraba primero el lector de fondo y el catálogo pasaba por un capítulo.
    const catalogo = await api.analizar(S + '/fx/catalogo-fondo.html');
    eq('un catálogo con sus 12 tapas juntas en una carpeta y un lector de fondo de 4 páginas en la misma página: es un listado, con sus títulos',
      `${catalogo.capitulo} · ${(lista(catalogo, 'titulos')?.items || []).map(i => i.texto).join(', ') || JSON.stringify(catalogo.listas.map(l => l.tipo + ' ' + l.items.length))}`,
      'null · ' + Array.from({ length: 12 }, (_, i) => `Obra ${i + 1}`).join(', '));
    // …y la página de fondos sigue siendo un capítulo aunque algunas tapas compartan carpeta (3 de 18,
    // como las subidas de un mes): las imágenes deciden solo si su carpeta junta la mitad, como en la extensión
    const conCarpetaComun = await api.analizar(S + '/fx/fondo.html?carpetaComun=3');
    eq('  la página de fondos con 3 de sus 18 tapas en una misma carpeta: sigue siendo un capítulo, con sus 8 páginas',
      `${conCarpetaComun.capitulo?.serie} ${conCarpetaComun.capitulo?.numero} · ${conCarpetaComun.capitulo?.imagenes} páginas`, 'Serie Fondo 3 · 8 páginas');
    api.encolar([{ url: S + '/fx/fondo.html', texto: 'Capítulo 3' }], { carpeta: tmp, formatos: soloPdf });
    eq('  bajarla: un PDF con las 8', estados(await api.colaVacia()) + ' · ' + pdfPages(path.join(tmp, 'Serie Fondo', 'Serie Fondo 0003.pdf')), 'Serie Fondo/Serie Fondo 0003: listo (8 páginas) · 8 × 420x640');
    api.limpiar();
    // (no queda para las pruebas que siguen, que cuentan lo que hay en el registro)
    api.quitarDelRegistro('seriefondo');
    fs.rmSync(path.join(tmp, 'Serie Fondo'), { recursive: true, force: true });

    console.log('\n── El registro de descargas y tu colección');
    eq('el registro anota lo que salió bien, por serie', api.verRegistro().map(s => `${s.serie} ${s.desde}-${s.hasta} (${s.cuantos})`).join(' | '),
      'Alfa 1-2 (2) | Avisos 1-1 (1) | Beta 1-2 (2) | Con Plantilla 3-4 (2) | Con Sagas 3-3 (1) | Inestable 1-1 (1)');
    fs.rmSync(path.join(tmp, 'Con Plantilla'), { recursive: true, force: true });
    const sinArchivos = api.revisarDisco({ serie: 'con plantilla', numeros: [3, 4, 5], carpeta: tmp, formatos: soloPdf });
    eq('lo que se bajó sigue anotado aunque ya no esté en la carpeta, con su fecha', `tengo ${sinArchivos.tengo.length} · ya bajados ${sinArchivos.bajados.map(b => b.numero)} · faltan ${sinArchivos.faltan} · ${sinArchivos.bajados[0]?.fecha === new Date().toISOString().slice(0, 10)}`,
      'tengo 0 · ya bajados 3,4 · faltan 5 · true');
    // Tu colección: otra carpeta, con su propia organización (como la de Google Drive)
    const coleccion = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-coleccion-'));
    const aColeccion = (c) => String(c).replace(path.basename(coleccion), 'colección');
    for (const rel of ['Mangas/Gama/Gama 0007.pdf', 'Mangas/Gama/Capítulo 8.pdf', 'Mangas/Gama/Gama Tomo 9.pdf', 'Comics/Zeta/notas.txt']) {
      const f = path.join(coleccion, ...rel.split('/'));
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, 'x');
    }
    temporales.push(coleccion);
    api.guardarConfig({ bibliotecas: [coleccion] });
    const conColeccion = api.revisarDisco({ serie: 'Gama', numeros: [1, 2, 7, 8, 9], carpeta: tmp, formatos: soloPdf });
    eq('tu colección: también se mira ahí, hasta dos carpetas adentro; un "Tomo 9" no es el capítulo 9', `tengo ${conColeccion.tengo} · faltan ${conColeccion.faltan} · ${conColeccion.carpetas.map(aColeccion).join(', ')}`,
      'tengo 1,2,7,8 · faltan 9 · Gama, Gama Manga, colección/Mangas/Gama');
    const tit = api.revisarTitulos({ nombres: ['Gama', 'Zeta Capítulo 5 hace 2 horas', 'Con Plantilla', 'Nada que ver'], carpeta: tmp });
    eq('en un catálogo: de qué títulos ya tenés algo, por el registro o por una carpeta de tu colección', tit.map(t => (t ? `${t.bajados} bajados${t.carpeta ? ' en ' + aColeccion(t.carpeta) : ''}` : '-')).join(' | '),
      '0 bajados en Gama | 0 bajados en colección/Comics/Zeta | 2 bajados | -');
    const cerca = api.revisarTitulos({ nombres: ['Gama Dos Color', 'Gam'], carpeta: tmp });
    eq('una carpeta de nombre parecido se avisa como pista, sin darla por tenida', cerca.map(t => (t ? `${t.bajados} bajados · parecida: ${t.parecida}` : '-')).join(' | '), '0 bajados · parecida: Gama Dos | -');
    const sinCarpeta = api.revisarDisco({ serie: 'Gama Dos Color', numeros: [5], carpeta: tmp, formatos: soloPdf });
    eq('  y en la lista de capítulos de esa serie no marca nada: solo deja la pista', `tengo ${sinCarpeta.tengo.length} · faltan ${sinCarpeta.faltan} · parecidas: ${sinCarpeta.parecidas.map(p => p.nombre)}`, 'tengo 0 · faltan 5 · parecidas: Gama Dos');
    api.encolar([{ url: S + '/leer/alfa-2/', texto: 'x', numero: 7 }], { carpeta: tmp, serie: 'Gama', formatos: soloPdf });
    eq('al bajar, lo que ya está en tu colección también se saltea', estados(await api.colaVacia()), 'Gama/Gama 0007: ya estaba (ya está en la carpeta)');
    api.limpiar();
    eq('quitar una serie del registro', api.quitarDelRegistro('conplantilla').some(s => s.serie === 'Con Plantilla') + ' · ' + api.revisarDisco({ serie: 'Con Plantilla', numeros: [3], carpeta: tmp, formatos: soloPdf }).bajados.length, 'false · 0');

    console.log('\n── Carpetas que no están, carpetas atadas a una serie y series seguidas');
    const noEsta = path.join(tmp, 'no-esta');
    api.guardarConfig({ bibliotecas: [coleccion, noEsta] });
    eq('una carpeta de la colección que no está a la vista se avisa', api.revisarDisco({ serie: 'Gama', numeros: [1], carpeta: tmp, formatos: soloPdf }).sinMirar.map(c => path.basename(c)).join(','), 'no-esta');
    eq('  y no se descarga a una carpeta que no está', (() => { try { api.encolar([{ url: S + '/leer/alfa-1/' }], { carpeta: path.join(noEsta, 'adentro'), formatos: soloPdf }); return 'sin error'; } catch (e) { return e.message.split(':')[0]; } })(),
      'La carpeta donde se guarda no está a la vista');
    api.guardarConfig({ bibliotecas: [coleccion] });
    // Una carpeta que se llama de otra forma, con los capítulos como carpetas de imágenes
    const otroNombre = path.join(tmp, 'Una Gama');
    for (const rel of ['Gama_Manga_0011_-_Sitio/pagina_001.jpg', 'Leido/Gama_Manga_0012_-_Sitio/pagina_001.jpg']) {
      const f = path.join(otroNombre, ...rel.split('/'));
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, 'x');
    }
    const antesDeAtar = api.revisarDisco({ serie: 'Gama', numeros: [11, 12], carpeta: tmp, formatos: soloPdf }).tengo.length;
    api.vincular('Gama', otroNombre);
    const atada = api.revisarDisco({ serie: 'Gama', numeros: [11, 12], carpeta: tmp, formatos: soloPdf });
    eq('atar a una serie una carpeta que se llama distinto: desde ahí cuentan sus capítulos', `antes ${antesDeAtar} · después ${atada.tengo} · ${atada.vinculadas} atada · ${atada.carpetas.filter(c => /Una Gama/.test(c)).length} en la lista`,
      'antes 0 · después 11,12 · 1 atada · 1 en la lista');
    api.desvincular('Gama');
    eq('  y el vínculo se puede quitar', api.revisarDisco({ serie: 'Gama', numeros: [11, 12], carpeta: tmp, formatos: soloPdf }).tengo.length, 0);

    api.guardarConfig({ carpeta: tmp });
    eq('seguir una serie pide su dirección y su nombre', (() => { try { api.seguirSerie({ url: S + '/serie/beta/', serie: '' }); return 'sin error'; } catch (e) { return e.message.slice(0, 26); } })(), 'Para seguir una serie hace');
    api.seguirSerie({ url: S + '/serie/alfa/', serie: 'Alfa' });
    api.seguirSerie({ url: S + '/serie/beta/', serie: 'Beta' });
    eq('  dos series seguidas, sin repetir', api.seguirSerie({ url: S + '/serie/beta/', serie: 'Beta' }).map(x => x.serie).join(', '), 'Alfa, Beta');
    const nov = await api.buscarNovedades();
    eq('buscar lo nuevo: de cada serie, lo que hay en su página y no tenés', nov.map(x => `${x.serie}: ${x.nuevos} (${x.rango}), tengo ${x.tengo} de ${x.cuantos}`).join(' | '),
      'Alfa: 2 (3–4), tengo 2 de 4 | Beta: 1 (3), tengo 2 de 3');
    eq('bajar lo nuevo de una serie: va a la cola con su nombre', api.bajarNovedades(S + '/serie/beta/').encolados + ' · ' + estados(await api.colaVacia()) + ' · ' + ls('Beta').includes('Beta 0003.pdf'),
      '1 · Beta/Beta 0003: listo (6 páginas) · true');
    api.limpiar();
    eq('  y después ya no figura como nuevo', (await api.buscarNovedades()).map(x => `${x.serie} ${x.nuevos}`).join(', '), 'Alfa 2, Beta 0');
    api.dejarDeSeguir(S + '/serie/alfa/');
    eq('dejar de seguir', api.dejarDeSeguir(S + '/serie/beta/').length, 0);
    // La portada de un sitio suele ser una grilla de tapas: imágenes grandes, como las páginas
    // de un capítulo, pero cada una lleva a otra página. No es un capítulo.
    console.log('\n── Portada con tapas');
    const pt = await api.analizar(T + '/');
    eq('portada llena de tapas: no la toma por un capítulo, y saca sus títulos', `${pt.capitulo} · ${lista(pt, 'titulos').items.map(i => i.texto).join(', ')}`,
      'null · Uno, Dos, Tres, Cuatro, Cinco, Seis, Siete, Ocho');
    eq('  encuentra el listado completo por el texto del link (con un ícono adelante) y por su dirección', pt.catalogos.map(c => `${c.texto} → ${c.url.replace(T, '')}`).join(' | '),
      '📚 Biblioteca → /biblioteca | Explorar todo → /directorio');
    const imgs = lista(pt, 'titulos').items.map(i => i.imagen.replace(T, ''));
    eq('  cada título trae su tapa, la envuelva el link o esté al lado en su tarjeta', imgs.join(' '),
      '/tapas/1.jpg /tapas/2.jpg /tapas/3.jpg /tapas/4.jpg /tapas/5.jpg /tapas/6.jpg /tapas/7.jpg /tapas/8.jpg');
    const mini = await api.tapa(T + imgs[0], T + '/');
    const original = fs.readFileSync(path.join(__dirname, '..', '..', 'tests', 'fixtures', 'pagina.jpg')).length;
    eq('  la miniatura de una tapa: una imagen chica, pedida con el Referer del sitio', `${mini.slice(0, 23)} · más chica que la original: ${Buffer.from(mini.slice(23), 'base64').length < original} · sin Referer: ${tapas.pedidos.sinReferer}`,
      'data:image/jpeg;base64, · más chica que la original: true · sin Referer: 0');
    eq('  pedir dos veces la misma no la baja de nuevo', await api.tapa(T + imgs[0], T + '/') === mini, true);
    eq('  lo que no es una imagen no pasa', await api.tapa(T + '/biblioteca', T + '/').then(() => 'pasó', e => e.message), 'No es una imagen');
    eq('  ni una dirección que no es de la web', await api.tapa('file:///c:/windows/win.ini', T + '/').then(() => 'pasó', e => e.message), 'La dirección de la imagen no es válida');
    eq('  los links de géneros van aparte, como filtros: no se mezclan con los títulos ni quedan primeros', pt.listas.map(l => `${l.tipo} ${l.items.length}`).join(' | '), 'titulos 8 | titulos 3 | filtros 10');
    const dos = await api.analizar(T + '/obra/2/dos');
    eq('una serie con el número en el renglón y no en el link, y más de un link por capítulo: igual arma su lista de capítulos',
      (lista(dos, 'capitulos')?.items || []).map(i => `${i.numero}=${i.texto}` + (i.versiones > 1 ? ` (${i.versiones})` : '')).join(' | '),
      '1=Capítulo 1 Leer | 2=Capítulo 2: El viaje Grupo A Grupo B (2) | 3=Capítulo 3: El final Grupo A');
    const nvd = await api.analizar(T + "/novedades");
    eq('tarjetas con tapa que dicen "Cap. N" (últimas actualizaciones) o con un código en la dirección: son títulos, no capítulos',
      nvd.listas.map(l => `${l.tipo} ${l.items.length}`).join(' | '), 'titulos 4 | titulos 4 | titulos 4');
    eq('  de cada tarjeta queda el nombre (lo escrito más grande) y, aparte, lo demás que decía', nvd.listas.slice(0, 2).map(l => `${l.items.map(i => i.texto).join(', ')} [${l.items[0].detalle}]`).join(' | '),
      'Uno, Dos, Tres, Cuatro [MANHWA · 9.00 · Cap. 12] | Cinco, Seis, Siete, Ocho [Finalizado · 204 caps]');
    const tres = await api.analizar(T + '/obra/3/tres'), seis = await api.analizar(T + '/obra/6/seis');
    const molde = (r) => { const l = lista(r, 'capitulos'); return !l ? 'sin capítulos' : `${l.items.map(i => i.numero).join(',')} · ${l.molde ? l.molde.pre.replace(T, '') + '#' + l.molde.post + ' · ' + l.molde.ancho : 'sin molde'}`; };
    eq('una obra que muestra solo el primer capítulo y el último: da el molde para pedir los del medio por número', molde(tres), '1,40 · /lector-tres/# · 0');
    eq('  con ceros adelante en la dirección, dice de cuántas cifras', molde(seis), '7,120 · /leer-seis/cap-#-es · 3');
    const cuatro = await api.analizar(T + '/obra/4/cuatro'), cinco = await api.analizar(T + '/obra/5/cinco');
    eq('una lista que aparece al tocar la pestaña "Capítulos" y sigue con "Mostrar más": la despliega entera', `${lista(cuatro, 'capitulos')?.items.length} capítulos`, '15 capítulos');
    eq('una lista en un panel con su propia barra, que carga más al bajar: lo baja hasta el final', `${lista(cinco, 'capitulos')?.items.length} capítulos`, '12 capítulos');

    console.log('\n── El buscador del sitio');
    const app = await api.analizar(S + '/app/');
    eq('lo encuentra en un formulario (con sus campos ocultos), en lo que declara el sitio y en un cuadro suelto; y si no hay, no inventa',
      [pt.buscador?.plantilla?.replace(T, ''), cat.buscador?.plantilla?.replace(S, ''), JSON.stringify(app.buscador).split(S).join(''), String(alfa.buscador)].join(' | '),
      '/buscar?tipo=todo&q={q} | /buscar?s={q} | {"enPagina":true,"pagina":"/app/"} | null');
    const b1 = await api.buscarEnSitio({ ...pt.buscador, texto: 'ci', conocidas: [pt.listas[0].id] });
    eq('buscar con el formulario del sitio: un resultado solo también arma lista, con su tapa', `${b1.listas[0].items.map(i => i.texto + (i.imagen ? ' (con tapa)' : '')).join(', ')} · ${tapas.pedidos.busquedas.join(' ')}`,
      'Cinco (con tapa) · tipo=todo&q=ci');
    await api.buscarEnSitio({ ...pt.buscador, texto: '  año   1 ' });
    eq('  lo buscado viaja bien escrito en la dirección', tapas.pedidos.busquedas[1], 'tipo=todo&q=a%C3%B1o%201');
    const b2 = await api.buscarEnSitio({ ...cat.buscador, texto: 'et' });
    eq('buscar con la dirección que declara el sitio', b2.listas.find(l => l.nombre === '/serie')?.items.map(i => i.texto).join(', '), 'Beta, Zeta, Eta, Theta');
    const b3 = await api.buscarEnSitio({ ...app.buscador, texto: 'pi' });
    eq('buscar escribiendo en un cuadro suelto: quedan solo los links que aparecieron (los resultados), no el menú', b3.listas.map(l => `${l.tipo}: ${l.items.map(i => i.texto).join(', ')}`).join(' | '), 'titulos: Pi');
    eq('  sin nada que buscar, lo dice', await api.buscarEnSitio({ ...pt.buscador, texto: '  ' }).then(() => 'pasó', e => e.message), 'Escribí qué querés buscar');
    eq('  y una plantilla que no es una dirección no se usa', await api.buscarEnSitio({ plantilla: 'file:///c:/x?{q}', texto: 'a' }).then(() => 'pasó', e => e.message), 'El buscador de este sitio no se puede usar desde acá');
    eq('  el error de una página llega con su mensaje limpio (es lo que muestra la interfaz) y la pila aparte',
      await api.buscarEnSitio({ pagina: S + '/serie/alfa/', texto: 'a' }).then(() => 'pasó', e => `${e.message} · pila de la página: ${/pagina\.js/.test(e.stack || '')}`), 'No encontré el buscador de esta página · pila de la página: true');

    console.log('\n── Portada con tapas (sigue)');
    const bib = await api.analizar(T + '/biblioteca');
    eq('el listado completo, con una tapa por obra, tampoco es un capítulo', `${bib.capitulo} · ${lista(bib, 'titulos').items.length} títulos`, 'null · 12 títulos');
    const l5 = await api.analizar(T + '/lector/5'), l7 = await api.analizar(T + '/lector/7');
    eq('un capítulo sigue siéndolo aunque sus páginas sean links al capítulo siguiente y tenga tapas de otras obras al final',
      `${l5.capitulo?.serie} ${l5.capitulo?.numero} · ${l5.capitulo?.imagenes} imágenes`, 'Obra Uno 5 · 6 imágenes');
    eq('y aunque cada página sea un link a su vista de a una', `${l7.capitulo?.serie} ${l7.capitulo?.numero}`, 'Obra Uno 7');

    console.log('\n── Favoritos (links guardados)');
    const nombres = (l) => l.map(s => s.nombre).join(', ');
    const pegada = api.guardarLinks({ texto: ['Manga en español:', `Sitio de prueba: ${S}/ — el catálogo de prueba`, `- [Alfa](${S}/serie/alfa/) la serie con volúmenes`,
      'otro-sitio.example/catalogo', `${S}/serie/alfa`, 'un renglón sin link'].join('\n') });
    eq('cargar una lista pegada: un link por renglón, con nombre, sin nombre o en Markdown', `${pegada.agregados} agregados, ${pegada.repetidos} repetido · ${nombres(pegada.lista)}`,
      '3 agregados, 1 repetido · Sitio de prueba, Alfa, otro-sitio.example');
    eq('  cada uno con su dirección completa y lo que tenía anotado', pegada.lista.map(s => `${s.url.replace(S, '')} [${s.descripcion}]`).join(' | '),
      '/ [el catálogo de prueba] | /serie/alfa/ [la serie con volúmenes] | https://otro-sitio.example/catalogo []');
    const otra = api.guardarLinks({ texto: `${S}/\nBeta ${S}/serie/beta/` });
    eq('cargar otra lista: los que ya estaban no se repiten', `${otra.agregados} agregado, ${otra.repetidos} repetido · ${otra.lista.length} en total`, '1 agregado, 1 repetido · 4 en total');
    eq('guardar una dirección suelta: el nombre sale de la dirección', nombres(api.guardarLinks({ sitio: { nombre: '', url: 'www.suelto.example/manga' } }).lista.slice(-1)), 'suelto.example');
    eq('  una que no es una página web: lo dice', (() => { try { api.guardarLinks({ sitio: { url: 'file:///c:/x' } }); return 'sin error'; } catch (e) { return e.message; } })(),
      'La dirección tiene que empezar con http:// o https://');
    eq('  un texto sin links: lo dice', (() => { try { api.guardarLinks({ texto: 'nada por acá' }); return 'sin error'; } catch (e) { return e.message; } })(), 'No encontré ningún link en lo que pegaste.');
    const exportado = JSON.stringify({ misSitios: [{ nombre: 'De la extensión', url: 'https://extension.example/', tipo: 'manga', idiomas: ['es'], descripcion: 'exportado' }, { nombre: 'Roto', url: 'javascript:x' }] });
    eq('cargar el archivo que exporta la extensión', nombres(api.guardarLinks({ texto: exportado }).lista.slice(-1)) + ' · ' + api.guardados().length, 'De la extensión · 6');
    eq('quitar uno (la misma dirección, con o sin barra final)', nombres(api.quitarLinks([`${S}/serie/alfa`])), 'Sitio de prueba, otro-sitio.example, Beta, suelto.example, De la extensión');
    api.quitarLinks(['https://otro-sitio.example/catalogo', 'https://www.suelto.example/manga', 'https://extension.example']);
    eq('quitar varios', nombres(api.guardados()), 'Sitio de prueba, Beta');

    console.log('\n── Interfaz');
    api.guardarConfig({ carpeta: tmp, formatos: { pdf: true, cbz: false, imgs: false } });
    const ui = await api.abrirUI(false);
    const consola = [];
    ui.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') consola.push(e.message); });
    const en = (js) => ui.webContents.executeJavaScript(js, true);
    const hasta = async (js, que, ms = 30000) => {
      for (const fin = Date.now() + ms; Date.now() < fin;) { const v = await en(js).catch(() => null); if (v) return v; await new Promise(r => setTimeout(r, 200)); }
      const como = await en(`JSON.stringify({ estado: document.readyState, mr: typeof window.mr, carpeta: document.querySelector('#carpeta')?.textContent, aviso: document.querySelector('#estado')?.textContent })`).catch(e => e.message);
      throw new Error(`No llegó: ${que} · ${como}` + (consola.length ? ' · consola: ' + consola.slice(0, 3).join(' | ') : ''));
    };
    // Con CAPTURAS=<carpeta> guarda una captura de la interfaz. La ventana está oculta y dibuja con
    // atraso: se saca dos veces, y vale la segunda.
    const capturar = async (nombre) => {
      if (!process.env.CAPTURAS) return;
      fs.mkdirSync(process.env.CAPTURAS, { recursive: true });
      await ui.webContents.capturePage();
      await new Promise(r => setTimeout(r, 500));
      fs.writeFileSync(path.join(process.env.CAPTURAS, nombre + '.png'), (await ui.webContents.capturePage()).toPNG());
    };
    await hasta(`document.readyState === 'complete' && !!document.querySelector('#url') && document.querySelector('#carpeta').textContent.length > 0`, 'la interfaz');
    const titulos = () => en(`[...document.querySelectorAll('#lista .fila .txt')].map(e => e.textContent).join(', ')`);
    const rutaEnPantalla = () => en(`[...document.querySelectorAll('#ruta button')].map(e => e.textContent).join(' › ')`);
    const avisoEnPantalla = () => en(`document.querySelector('#estado').textContent`);

    // Pegar la portada de un sitio: encuentra el link al catálogo y entra solo
    await en(`document.querySelector('#url').value = ${JSON.stringify(S + '/')}; document.querySelector('#analizar').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 15`, 'el catálogo completo');
    eq('pegar la portada de un sitio: entra sola a su catálogo completo', await titulos(), 'Alfa, Beta, Delta, Épsilon, Zeta, Eta, Theta, Iota, Kappa, Lambda, Mu, Nu, Xi, Ómicron, Pi');
    eq('  y lo dice', (await avisoEnPantalla()).split('.')[0] + ' · ' + await rutaEnPantalla(),
      'Entré al catálogo que encontré en la portada ("Directorio") · Sitio de prueba – Catálogo › Sitio de prueba – Directorio');

    await hasta(`document.querySelectorAll('#lista .fila .esta').length === 3`, 'las marcas de lo que ya tenés');
    eq('  en el catálogo quedan marcados los títulos de los que ya bajaste algo y los que están en tu colección', await en(`[...document.querySelectorAll('#lista .fila')].filter(f => f.querySelector('.esta')).map(f => f.querySelector('.txt').textContent + ' ' + f.querySelector('.esta').textContent).join(' | ')`),
      'Alfa ✔ 2 bajados | Beta ✔ 3 bajados | Zeta ✔ en tu colección');
    await hasta(`document.querySelectorAll('#recientes option').length === 1`, 'la dirección anotada como reciente');
    eq('  la dirección que se pegó queda entre las recientes (la portada, no el catálogo al que entró)', api.config().recientes.map(r => `${r.titulo} → ${r.url.replace(S, '')}`).join(' | '), 'Sitio de prueba – Catálogo → /');
    // Volver a la portada por la ruta: muestra lo que tiene, la pista del catálogo y deja traer más páginas
    await en(`document.querySelector('#ruta button').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 4 && !document.querySelector('#siguiente').hidden`, 'la portada');
    eq('la portada: sus títulos y la pista del listado completo', await titulos() + ' · ' + await en(`[...document.querySelectorAll('#pistasLinks button')].map(e => e.textContent).join(', ')`),
      'Alfa, Beta, Gama 3, Delta · Directorio ›');
    await en(`document.querySelector('#siguiente').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 7`, 'las páginas siguientes');
    eq('"Traer más páginas": suma las siguientes, sin repetir', await titulos() + ' · ' + await avisoEnPantalla() + ' · ' + await en(`document.querySelector('#siguiente').hidden`),
      'Alfa, Beta, Gama 3, Delta, Épsilon, Zeta, Eta · Sumé 3 renglones a esta lista, de 2 páginas. No hay más páginas. · true');

    // "Traer todas": se vuelve a la portada (pasando por el directorio) y se junta el listado entero de un toque
    await en(`document.querySelector('#pistasLinks button').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 15`, 'el directorio');
    await en(`document.querySelector('#ruta button').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 4 && !document.querySelector('#todasLasPaginas').hidden`, 'la portada otra vez');
    await en(`document.querySelector('#todasLasPaginas').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 7 && document.querySelector('#todasLasPaginas').hidden`, 'todas las páginas del listado');
    eq('"Traer todas": sigue sola hasta el final del listado', await titulos() + ' · ' + await avisoEnPantalla() + ' · ' + await en(`document.querySelector('#todasLasPaginas').textContent`),
      'Alfa, Beta, Gama 3, Delta, Épsilon, Zeta, Eta · Sumé 3 renglones a esta lista, de 2 páginas. No hay más páginas. · Traer todas');

    await en(`document.querySelector('#lista .fila .entrar').click()`);
    await hasta(`document.querySelectorAll('#lista .seccion').length === 2`, 'los capítulos de la serie');
    eq('entrar a un título muestra sus capítulos por volumen',
      await en(`[...document.querySelectorAll('#lista > *')].map(e => e.classList.contains('seccion') ? '[' + e.querySelector('.txt').textContent + ']' : e.querySelector('.num').textContent).join(' ')`),
      '[Volumen 1] 1 2 [Volumen 2] 3 4');
    eq('  la ruta recuerda por dónde se entró', await en(`[...document.querySelectorAll('#ruta button')].map(e => e.textContent).join(' › ')`), 'Sitio de prueba – Catálogo › Alfa – Todos los capítulos');
    // Al entrar a un título, su nombre queda como serie y la lista marca lo que ya está en la carpeta
    await hasta(`!document.querySelector('#enDisco').hidden`, 'lo que ya está en la carpeta');
    eq('  al entrar a un título, su nombre queda puesto como serie', await en(`document.querySelector('#serie').value + ' ' + document.querySelector('#serie').classList.contains('auto')`), 'Alfa true');
    eq('  y la lista marca los capítulos que ya están en la carpeta y dice cuáles faltan', await en(`document.querySelector('#enDiscoTexto').textContent + ' · ' + [...document.querySelectorAll('#lista .fila')].map(f => f.querySelector('.num').textContent + (f.querySelector('.esta') ? '✔' : '')).join(' ')`),
      'Ya tenés 2 de 4. Te faltan: 3–4. · 1✔ 2✔ 3 4');
    await en(`document.querySelector('#marcarFaltan').click()`);
    eq('  "Marcar los que faltan" tilda justo esos', await en(`[...document.querySelectorAll('#lista .fila')].map(f => f.querySelector('input').checked ? f.querySelector('.num').textContent : '').join('') + ' · ' + document.querySelector('#descargar').textContent`), '34 · Descargar 2 capítulos');
    await en(`document.querySelector('#ninguno').click()`);
    // Seguir la serie desde su lista, y buscar lo nuevo desde "Siguiendo"
    await en(`[...document.querySelectorAll('#enDiscoBotones button')].find(b => /Seguir esta serie/.test(b.textContent)).click()`);
    await hasta(`document.querySelector('#verSiguiendo').textContent === '📌 Siguiendo (1)'`, 'la serie seguida');
    await en(`document.querySelector('#verSiguiendo').click(); document.querySelector('#buscarNuevo').click()`);
    await hasta(`/nuevo/.test(document.querySelector('#siguiendoMsg').textContent)`, 'la búsqueda de lo nuevo', 60000);
    eq('  seguir la serie y "Buscar lo nuevo": dice qué capítulos hay que no tenés', await en(`document.querySelector('#siguiendoMsg').textContent + ' · ' + [...document.querySelectorAll('#siguiendoLista .guardado')].map(g => g.querySelector('.g-nombre').textContent + ': ' + g.querySelector('.g-datos').textContent + ' [' + (g.querySelector('.g-bajar')?.textContent || '') + ']').join(' | ')`),
      'Hay 2 capítulos nuevos. · Alfa: 2 nuevos: 3–4 [Bajar 2]');
    await en(`document.querySelector('#siguiendoLista .g-quitar').click()`);
    await hasta(`document.querySelector('#verSiguiendo').textContent === '📌 Siguiendo'`, 'la serie dejada de seguir');
    await en(`document.querySelector('#verSiguiendo').click()`);
    await en(`document.querySelectorAll('#lista .seccion input')[1].click()`);
    eq('  tildar un volumen marca sus capítulos', await en(`[...document.querySelectorAll('#lista .fila')].map(f => f.querySelector('input').checked ? f.querySelector('.num').textContent : '').join('') + ' · ' + document.querySelector('#descargar').textContent`), '34 · Descargar 2 capítulos');
    await en(`document.querySelector('#descargar').click()`);
    await api.colaVacia();
    eq('  descargar desde la interfaz', ls('Alfa').split(' | ').filter(n => /000[34]\.pdf$/.test(n)).join(' | '), 'Alfa 0003.pdf | Alfa 0004.pdf');
    await hasta(`document.querySelectorAll('#cola .tarea.listo').length === 2`, 'la cola en pantalla');
    eq('  la cola muestra el resultado', await en(`[...document.querySelectorAll('#cola .tarea')].map(t => t.querySelector('.t-nombre').textContent + ' ' + t.querySelector('.t-estado').textContent).join(' ; ')`),
      'Alfa/Alfa 0003 ✅ 6 páginas ; Alfa/Alfa 0004 ✅ 6 páginas');
    // El registro: si un capítulo que se bajó ya no está en la carpeta, igual queda marcado
    fs.rmSync(path.join(tmp, 'Alfa', 'Alfa 0003.pdf'));
    await en(`document.querySelector('#serie').dispatchEvent(new Event('input'))`);
    await hasta(`!!document.querySelector('#lista .fila .esta.antes')`, 'la marca del registro');
    eq('  lo que se bajó y ya no está en la carpeta queda marcado igual, por el registro', await en(`[...document.querySelectorAll('#lista .fila')].map(f => f.querySelector('.num').textContent + ' ' + (f.querySelector('.esta')?.textContent || '-')).join(' | ') + ' · ' + document.querySelector('#enDiscoTexto').textContent`),
      '1 ✔ ya está | 2 ✔ ya está | 3 ✔ ya lo bajaste | 4 ✔ ya está · Ya tenés 3 de 4 en la carpeta, y otro ya lo bajaste antes (no está ahí). No te falta ninguno.');
    // Si se tilda otro formato, lo que ya está sigue marcado, y dice en cuál está
    await en(`document.querySelector('#fCbz').click(); document.querySelector('#fPdf').click()`);
    await hasta(`/en PDF/.test(document.querySelector('#lista').textContent)`, 'la marca del otro formato');
    eq('  lo que está en otro formato que el tildado sigue contando como que ya está, y dice en cuál', await en(`[...document.querySelectorAll('#lista .fila')].map(f => f.querySelector('.num').textContent + ' ' + (f.querySelector('.esta')?.textContent || '-')).join(' | ')`),
      '1 ✔ ya está | 2 ✔ ya está | 3 ✔ ya lo bajaste | 4 ✔ ya está en PDF');
    await en(`document.querySelector('#fPdf').click(); document.querySelector('#fCbz').click()`);
    await hasta(`!/en PDF/.test(document.querySelector('#lista').textContent)`, 'las marcas con PDF tildado de nuevo');
    await capturar('programa');

    await en(`document.querySelector('#verPegar').click(); document.querySelector('#links').value = ${JSON.stringify(`Capítulos\n02: ${S}/leer/alfa-2/\n${S}/leer/alfa-1/`)}; document.querySelector('#usarLinks').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 2`, 'los links pegados');
    eq('pegar links: quedan numerados y marcados', await en(`[...document.querySelectorAll('#lista .fila')].map(f => f.querySelector('.num').textContent + (f.querySelector('input').checked ? '*' : '')).join(' ') + ' · ' + document.querySelector('#estado').textContent`),
      '1* 2* · Tomé 2 links: capítulos 1 a 2, con el número que trae cada link. Escribí el nombre de la serie a la derecha.');

    // Pegar la portada de un sitio que es una grilla de tapas: no la toma por un capítulo y entra a su listado
    await en(`document.querySelector('#url').value = ${JSON.stringify(T + '/')}; document.querySelector('#analizar').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 12`, 'el listado completo del sitio de tapas');
    eq('pegar una portada llena de tapas: entra a su listado completo, sin ofrecerla como capítulo', await titulos() + ' · ' + await en(`document.querySelector('#capitulo').hidden`) + ' · ' + (await avisoEnPantalla()).split('.')[0],
      'Uno, Dos, Tres, Cuatro, Cinco, Seis, Siete, Ocho, Nueve, Diez, Once, Doce · true · Entré al catálogo que encontré en la portada ("📚 Biblioteca")');

    // Las tapas: la lista se muestra como un mosaico, con la miniatura de cada título
    const conMiniatura = `[...document.querySelectorAll('#lista .fila img.tapa')].filter(i => i.src.startsWith('data:image/')).length`;
    const mosaico = () => en(`document.querySelector('#lista').classList.contains('tapas') + ' ' + getComputedStyle(document.querySelector('#lista')).display + ' ' + document.querySelectorAll('#lista .fila img.tapa').length + ' ' + ${conMiniatura} + ' ' + (document.querySelector('#verTapas').hidden ? 'sin botón' : document.querySelector('#verTapas').classList.contains('on') ? 'botón prendido' : 'botón apagado')`);
    await hasta(`${conMiniatura} === 12`, 'las tapas del listado');
    eq('  la lista se ve como un mosaico, con la tapa de cada título', await mosaico(), 'true grid 12 12 botón prendido');
    await capturar('programa-tapas');
    await en(`document.querySelector('#lista .fila img.tapa').click()`);
    await hasta(`document.querySelectorAll('#lista .fila .num').length === 2`, 'la obra de la tapa');
    eq('  tocar una tapa entra a ese título; ahí, sin tapas, vuelve la lista de siempre', await rutaEnPantalla() + ' · ' + await mosaico(),
      'Sitio de tapas — Leer online › Sitio de tapas — Biblioteca › Obra Uno — capítulos · false block 0 0 sin botón');
    await en(`document.querySelector('#ruta button').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 8`, 'la portada de tapas');
    eq('  la portada muestra sus títulos y las pistas del listado completo', await titulos() + ' · ' + await en(`[...document.querySelectorAll('#pistasLinks button')].map(e => e.textContent).join(', ') + ' · ' + document.querySelector('#capitulo').hidden`),
      'Uno, Dos, Tres, Cuatro, Cinco, Seis, Siete, Ocho · 📚 Biblioteca ›, Explorar todo › · true');
    eq('  una lista de títulos es para entrar: sin casillas ni "Todos", y los géneros van en su pestaña',
      await en(`document.querySelectorAll('#lista .fila input').length + ' ' + document.querySelector('#todos').hidden + ' · ' + [...document.querySelectorAll('#tabs button')].map(b => b.textContent).join(' | ')`),
      '0 true · Títulos y links (8) · /obra/ | Títulos y links (3) · / | Géneros y filtros (10) · /genero');
    const tildables = () => en(`document.querySelectorAll('#lista .fila input').length + ' ' + document.querySelector('#todos').hidden + ' ' + document.querySelector('#sonCapitulos').textContent`);
    await en(`document.querySelector('#sonCapitulos').click()`);
    const conCasillas = await tildables();
    await en(`document.querySelector('#sonCapitulos').click()`);
    eq('  "Son capítulos" deja tildar una lista de títulos (una serie que los nombra sin número), y se puede deshacer', conCasillas + ' · ' + await tildables(), '8 false No son capítulos · 0 true Son capítulos');
    await hasta(`${conMiniatura} === 8`, 'las tapas de la portada');
    await en(`document.querySelector('#verTapas').click()`);
    eq('  el botón "Tapas" las apaga: queda la lista de siempre, y se recuerda', await mosaico() + ' · ' + api.config().tapas, 'false block 0 0 botón apagado · false');
    await en(`document.querySelector('#verTapas').click()`);
    eq('  y las vuelve a prender, con las miniaturas que ya tenía', await mosaico() + ' · ' + api.config().tapas, 'true grid 8 8 botón prendido · true');
    eq('  las tapas se pidieron una sola vez cada una, con el Referer del sitio', `${tapas.pedidos.sinReferer} sin Referer`, '0 sin Referer');

    // El buscador del sitio, dentro del programa: al lado del catálogo
    eq('el buscador del sitio queda a mano, junto al catálogo', await en(`document.querySelector('#buscarSitio').hidden + ' ' + document.querySelector('#buscarTexto').placeholder`), 'false 🔎 Buscar en este sitio…');
    await en(`document.querySelector('#buscarTexto').value = 'tre'; document.querySelector('#buscarSitio').requestSubmit()`);
    await hasta(`/Búsqueda/.test(document.querySelector('#ruta').textContent) && document.querySelectorAll('#lista .fila').length === 1`, 'los resultados de la búsqueda');
    eq('  buscar muestra lo que trajo el sitio, como una lista de títulos para entrar', await titulos() + ' · ' + await rutaEnPantalla() + ' · ' + (await avisoEnPantalla()).split('.')[0],
      'Tres · Sitio de tapas — Leer online › Búsqueda: tre · Esto trajo el buscador del sitio para «tre»');
    await capturar('programa-busqueda');
    // Entrar al resultado: una obra que solo muestra el primer capítulo y el último
    await en(`document.querySelector('#lista .fila').click()`);
    await hasta(`!document.querySelector('#completar').hidden`, 'la obra con el primer capítulo y el último');
    eq('  entrar a un resultado: la serie queda con su nombre, y ofrece completar los capítulos del medio',
      await en(`document.querySelector('#serie').value + ' · ' + document.querySelectorAll('#lista .fila').length + ' · ' + document.querySelector('#completar').textContent`), 'Tres · 2 · Completar del 1 al 40');
    await en(`document.querySelector('#completar').click()`);
    eq('  "Completar" suma los del medio por número, cada uno con su dirección',
      await en(`document.querySelectorAll('#lista .fila').length + ' · ' + [...document.querySelectorAll('#lista .fila')][1].title.replace(${JSON.stringify(T)}, '') + ' · ' + document.querySelector('#completar').hidden`), '40 · /lector-tres/2 · true');
    await hasta(`!document.querySelector('#enDisco').hidden`, 'lo que ya está de la serie');
    eq('  entre los botones de la serie no queda texto suelto', await en(`[...document.querySelector('#enDiscoBotones').childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('|') + '.'`), '.');

    // Favoritos: quedaron dos de las pruebas de arriba
    const filasG = async () => (await en(`[...document.querySelectorAll('#guardadosLista .guardado')].map(g => g.querySelector('.g-nombre').textContent + ' (' + g.querySelector('.g-datos').textContent + ')').join(' | ')`)).split(S.replace('http://', '')).join('');
    const ultimaG = async () => (await en(`(() => { const g = [...document.querySelectorAll('#guardadosLista .guardado')].pop(); return g.querySelector('.g-nombre').textContent + ' (' + g.querySelector('.g-datos').textContent + ')'; })()`)).split(S.replace('http://', '')).join('');
    const avisoG = () => en(`document.querySelector('#guardadosMsg').textContent + ' · ' + document.querySelector('#verGuardados').textContent`);
    // Pegar en el cuadro, como con Ctrl+V: el texto entra al cuadro y salta el evento "paste"
    const pegarEnFavoritos = (texto) => en(`(() => { const c = document.querySelector('#listaLinks'); c.value = ${JSON.stringify(texto)}; c.dispatchEvent(new Event('paste')); })()`);
    eq('favoritos: el botón dice cuántos hay y el panel arranca cerrado', await en(`document.querySelector('#verGuardados').textContent + ' ' + document.querySelector('#guardados').hidden`), '⭐ Favoritos (2) true');
    await en(`document.querySelector('#verGuardados').click()`);
    eq('  al abrirlo aparece la lista y el cuadro para pegar, ya con el cursor', await filasG() + ' · ' +
      await en(`(() => { const c = document.querySelector('#listaLinks'); return (c.offsetHeight > 0) + ' ' + (document.activeElement === c) + ' ' + document.querySelector('#pegar').hidden; })()`),
      'Sitio de prueba ( · el catálogo de prueba) | Beta (/serie/beta) · true true true');
    await pegarEnFavoritos(`Mis series:\nAlfa: ${S}/serie/alfa/ — con volúmenes\n${S}/serie/beta/\n- [El directorio](${S}/directorio/)`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 4`, 'los links pegados en favoritos');
    eq('  pegar muchos links juntos los guarda solos: suma los nuevos, avisa los que ya estaban y vacía el cuadro', await avisoG() + ' · ' + await en(`JSON.stringify(document.querySelector('#listaLinks').value)`),
      'Guardé 2 links en favoritos. 1 ya estaba o venía repetido. · ⭐ Favoritos (4) · ""');
    eq('  quedan en la lista, cada uno con su nombre y su nota', await filasG(), 'Sitio de prueba ( · el catálogo de prueba) | Beta (/serie/beta) | Alfa (/serie/alfa · con volúmenes) | El directorio (/directorio)');
    await pegarEnFavoritos(`${S}/serie/alfa/`);
    await hasta(`/No guardé/.test(document.querySelector('#guardadosMsg').textContent)`, 'el aviso del repetido');
    eq('  pegar uno solo que ya estaba: lo dice', await avisoG(), 'No guardé ninguno. 1 ya estaba o venía repetido. · ⭐ Favoritos (4)');
    await en(`document.querySelector('#listaLinks').value = 'esto no es un link'; document.querySelector('#agregarLista').click()`);
    await hasta(`/No encontré/.test(document.querySelector('#guardadosMsg').textContent)`, 'el aviso de que no hay links');
    eq('  un texto sin links: lo dice y lo deja en el cuadro', await en(`document.querySelector('#guardadosMsg').textContent + ' · ' + document.querySelector('#listaLinks').value`),
      '⚠️ No encontré ningún link en lo que pegaste. · esto no es un link');
    await en(`document.querySelector('#listaLinks').value = 'otro.example/serie'; document.querySelector('#agregarLista').click()`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 5`, 'el link escrito');
    eq('  uno solo, escrito a mano y con el botón', await avisoG() + ' · ' + await ultimaG(), 'Guardé 1 link en favoritos. · ⭐ Favoritos (5) · otro.example (otro.example/serie)');
    await en(`(() => { const f = document.querySelector('#guardadosFiltro'); f.value = 'volúmenes'; f.dispatchEvent(new Event('input')); })()`);
    eq('  buscar en la lista', await filasG() + ' · ' + await en(`document.querySelector('#guardadosCuenta').textContent`), 'Alfa (/serie/alfa · con volúmenes) · 1 de 5');
    await capturar('programa-favoritos');
    await en(`document.querySelector('#guardadosLista .g-abrir').click()`);
    await hasta(`document.querySelectorAll('#lista .seccion').length === 2 && document.querySelector('#guardados').hidden`, 'la serie guardada');
    eq('  tocar un favorito lo analiza', await rutaEnPantalla() + ' · ' + (await en(`document.querySelector('#url').value`)).replace(S, ''), 'Alfa – Todos los capítulos · /serie/alfa/');
    await en(`document.querySelector('#verGuardados').click(); (() => { const f = document.querySelector('#guardadosFiltro'); f.value = ''; f.dispatchEvent(new Event('input')); })(); document.querySelector('#guardarActual').click()`);
    await hasta(`document.querySelector('#guardadosMsg').textContent.length > 0`, 'el aviso');
    eq('  "La dirección de arriba": si ya está, lo dice', await avisoG(), 'Esa dirección ya estaba en tus favoritos. · ⭐ Favoritos (5)');
    await en(`document.querySelector('#lista .fila .entrar').click()`);
    await hasta(`!document.querySelector('#capitulo').hidden`, 'un capítulo');
    await en(`document.querySelector('#guardarActual').click()`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 6`, 'la dirección guardada');
    eq('  y si no, la guarda con el título de la página', await avisoG() + ' · ' + await ultimaG(), 'Guardada en favoritos. · ⭐ Favoritos (6) · Alfa Capítulo 1 | Sitio de prueba (/leer/alfa-1)');
    await en(`[...document.querySelectorAll('#guardadosLista .g-quitar')].pop().click()`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 5`, 'el favorito quitado');
    eq('  quitar uno', await ultimaG() + ' · ' + await en(`document.querySelector('#verGuardados').textContent`), 'otro.example (otro.example/serie) · ⭐ Favoritos (5)');
    await en(`document.querySelector('#quitarTodos').click()`);
    eq('  "Quitar todos" pide confirmar con otro toque', await en(`document.querySelector('#quitarTodos').textContent + ' · ' + document.querySelectorAll('#guardadosLista .guardado').length`), '¿Quitar los 5? Tocá de nuevo · 5');
    await en(`document.querySelector('#quitarTodos').click()`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 0`, 'la lista vacía');
    eq('  y con el segundo la vacía: queda el cuadro para pegar', await avisoG() + ' · ' + await en(`document.querySelector('#guardadosLista').textContent + ' ' + document.querySelector('#guardadosBarra').hidden + ' ' + (document.querySelector('#listaLinks').offsetHeight > 0)`) + ' · ' + api.guardados().length,
      'Quité todos los favoritos. · ⭐ Favoritos · Todavía no tenés favoritos. Pegá un link o muchos en el cuadro de arriba y quedan guardados. true true · 0');

    // Revisar las páginas de un capítulo: todas a la vista, con lo que el filtro tomó por publicidad
    await en(`document.querySelector('#url').value = ${JSON.stringify(S + '/leer/avisos-1/')}; document.querySelector('#analizar').click()`);
    await hasta(`!document.querySelector('#capitulo').hidden && /Avisos/.test(document.querySelector('#capNombre').textContent)`, 'el capítulo con un aviso');
    eq('al abrir un capítulo directo, la serie de su título queda puesta sola (y la que había quedado de antes se fue)', await en(`document.querySelector('#serie').value + ' ' + document.querySelector('#serie').classList.contains('auto')`), 'Avisos true');
    await en(`document.querySelector('#capRevisar').click()`);
    await hasta(`document.querySelectorAll('#revLista .pag').length === 7`, 'las páginas para revisar');
    const paginasRev = () => en(`[...document.querySelectorAll('#revLista .pag')].map(p => p.querySelector('.pag-n').textContent + (p.querySelector('.pag-m') ? '[' + p.querySelector('.pag-m').textContent + ']' : '')).join(' ') + ' · ' + document.querySelector('#revCuenta').textContent + ' · ' + document.querySelector('#revBajar').textContent`);
    eq('revisar páginas: se ven todas, con el aviso apagado y dicho por qué', await paginasRev(),
      '1 2 3 ✕[enlace a otro sitio] 4 5 6 · 6 de 7 imágenes · 1 tomada por publicidad · Descargar 6 páginas');
    await hasta(`[...document.querySelectorAll('#revLista .pag img')].every(i => i.src.startsWith('data:image/'))`, 'las miniaturas de las páginas');
    eq('  cada una con su miniatura, y la lista de la página queda oculta mientras tanto', await en(`document.querySelectorAll('#revLista .pag img').length + ' ' + getComputedStyle(document.querySelector('#lista')).display`), '7 none');
    await capturar('programa-revisar');
    await en(`document.querySelectorAll('#revLista .pag')[3].click()`);
    eq('  tocar lo que tomó por publicidad lo pone (era una página)', await paginasRev(),
      '1 2 3 4[enlace a otro sitio] 5 6 7 · 7 de 7 imágenes · 1 tomada por publicidad · Descargar 7 páginas');
    await en(`document.querySelectorAll('#revLista .pag')[0].click(); document.querySelectorAll('#revLista .pag')[3].click()`);
    eq('  y tocar una página la saca (era un aviso que no detectó)', await paginasRev(),
      '✕ 1 2 ✕[enlace a otro sitio] 3 4 5 · 5 de 7 imágenes · 1 tomada por publicidad · Descargar 5 páginas');
    await en(`document.querySelector('#revTodas').click()`);
    const todasRev = (await paginasRev()).split(' · ')[1];
    await en(`document.querySelector('#revDetectadas').click()`);
    eq('  "Todas" y "Como las detectó"', todasRev + ' / ' + (await paginasRev()).split(' · ')[1], '7 de 7 imágenes / 6 de 7 imágenes');
    await en(`(() => { const s = document.querySelector('#serie'); s.value = 'Revisado'; s.dispatchEvent(new Event('input')); })(); document.querySelectorAll('#revLista .pag')[5].click(); document.querySelector('#revBajar').click()`);
    await hasta(`document.querySelector('#revision').hidden`, 'la revisión cerrada');
    await api.colaVacia();
    eq('  "Descargar" baja solo las elegidas', ls('Revisado') + ' · ' + pdfPages(path.join(tmp, 'Revisado', 'Revisado 0001.pdf')), 'Revisado 0001.pdf · 5 × 420x640');

    // Reintentar, desde la interfaz
    eq('reintentar: apagado mientras no haya nada que falló', await en(`document.querySelector('#reintentar').disabled + ' ' + document.querySelector('#reintentar').textContent`), 'true Reintentar lo que falló');
    api.encolar([{ url: S + '/leer/alfa-9/', texto: 'No existe' }], { carpeta: tmp, formatos: soloPdf });
    await api.colaVacia();
    await hasta(`!document.querySelector('#reintentar').disabled`, 'el botón de reintentar');
    const intentos = sitio.pedidos.capitulos['/leer/alfa-9/'];
    await en(`document.querySelector('#reintentar').click()`);
    await hasta(`document.querySelector('#reintentar').textContent === 'Reintentar 1 que falló' && !document.querySelector('#reintentar').disabled && document.querySelector('#cancelar').disabled`, 'el reintento terminado');
    await api.colaVacia();
    eq('  con algo que falló se prende, y al tocarlo lo intenta de nuevo', `${(sitio.pedidos.capitulos['/leer/alfa-9/']) - intentos >= 1}`, 'true');

    // ── El sitio pide esperar, a través del proxy de prueba (tests/proxy.js) ──
    // El proxy contesta 429 o 503 de verdad, con Retry-After o sin él, delante del sitio de prueba.
    // El programa lo usa como con MR_PROXY: le pregunta a qué sitio reenvía y le manda todo lo de ese sitio.
    console.log('\n── El sitio pide esperar, a través del proxy de prueba');
    api.limpiar();
    const proxy = await iniciarProxy({ sitio: S });
    try {
      const pr = await api.usarProxy(proxy.url);
      const enProxy = { carpeta: tmp, serie: 'Proxy', formatos: soloPdf, saltear: false };
      const cap = (n) => ({ url: `${S}/leer/alfa-${n}/`, texto: `Capítulo ${n}`, numero: n });
      const pagDe = (n) => proxy.pedidos.filter(p => p.ruta === `/leer/alfa-${n}/`).map(p => p.hora);
      const filaCola = `[...document.querySelectorAll('#cola .tarea .t-estado')].map(t => t.textContent).join(' | ')`;
      const hastaQue = async (fn, que, ms = 30000) => { for (const fin = Date.now() + ms; Date.now() < fin; await dormir(100)) if (fn()) return; throw new Error('No llegó: ' + que); };
      api.encolar([cap(1)], enProxy);
      eq('el programa con el proxy de prueba: le pregunta a qué sitio reenvía, y la página y sus imágenes pasan por él',
        `${pr.sitio === S} · ${estados(await api.colaVacia())} · página: ${pagDe(1).length} · imágenes: ${proxy.pedidos.filter(p => /^\/img\/alfa\/1\//.test(p.ruta)).length >= 6}`,
        'true · Proxy/Proxy 0001: listo (6 páginas) · página: 1 · imágenes: true');
      api.limpiar();

      // Sin Retry-After (503 o 429): al tocar Reintentar, la cuenta arranca cerca de 60 y el reintento
      // no sale antes. No se espera el minuto: en el mismo instante del clic en Cancelar se lee el número
      // de la cuenta y el estado de los botones, y se cancela.
      const unMinuto = async (codigo, n) => {
        proxy.fijarReglas([{ codigo, retryAfter: null, ruta: `/leer/alfa-${n}/`, solo: 'paginas', veces: 1 }]);
        const antes = pagDe(n).length;
        api.encolar([cap(n)], enProxy);
        await api.colaVacia();
        await hasta(`!document.querySelector('#reintentar').disabled`, 'el botón de reintentar');
        const fallo = await en(filaCola);
        await en(`document.querySelector('#reintentar').click()`);
        await hasta(`/sigo en \\d+ s/.test(document.querySelector('#cola').textContent)`, 'la cuenta regresiva', 10000);
        const r = await en(`(() => { const s = document.querySelector('#cola .t-estado').textContent, c = document.querySelector('#cancelar'), re = document.querySelector('#reintentar');
          const antes = { n: +((s.match(/sigo en (\\d+) s/) || [])[1] || 0), detalle: s.replace(/\\d+ s$/, 'N s'), cancelar: c.disabled ? 'apagado' : 'prendido', reintentar: re.disabled ? 'apagado' : 'prendido' };
          c.click(); return antes; })()`);
        const alCancelar = pagDe(n).length - antes;
        await api.colaVacia();
        await dormir(1500);                                 // si saliera el reintento, este es el momento
        await hasta(`/cancelado/.test(document.querySelector('#cola').textContent)`, 'la cola cancelada');
        const out = { ...r, fallo, pedidos: `${alCancelar} y ${pagDe(n).length - antes}`, final: await en(filaCola) };
        api.olvidarEsperas();
        api.limpiar();
        return out;
      };
      const s1 = await unMinuto(503, 2);
      eq('503 sin Retry-After: falla con ese motivo; al tocar Reintentar, el detalle dice "el sitio pidió esperar: sigo en N s"',
        `${s1.fallo} → ${s1.detalle}`, '⚠️ falló: La página respondió HTTP 503: el sitio pidió esperar → ⏸ en cola: el sitio pidió esperar: sigo en N s');
      eq(`  la cuenta arranca cerca de 60 (decía "sigo en ${s1.n} s")`, minutoN(s1.n), 'entre 55 y 60 s');
      eq('  en ese instante el reintento sigue esperando (Cancelar prendido, Reintentar apagado) y la página se pidió una sola vez; al cancelar, el reintento no sale',
        `Cancelar ${s1.cancelar} · Reintentar ${s1.reintentar} · pedidos de la página: ${s1.pedidos} · ${s1.final}`, 'Cancelar prendido · Reintentar apagado · pedidos de la página: 1 y 1 · ✖ cancelado');
      const s2 = await unMinuto(429, 2);
      eq(`429 sin Retry-After: lo mismo, la cuenta arranca cerca de 60 (decía "sigo en ${s2.n} s") y el reintento no sale antes`,
        `${s2.fallo} · ${minutoN(s2.n)} · pedidos de la página: ${s2.pedidos} · ${s2.final}`, '⚠️ falló: La página respondió HTTP 429: el sitio pidió esperar · entre 55 y 60 s · pedidos de la página: 1 y 1 · ✖ cancelado');

      // 503 con Retry-After: 5 → el reintento espera 5 s, lo dice, sale y completa
      proxy.fijarReglas([{ codigo: 503, retryAfter: '5', ruta: '/leer/alfa-3/', solo: 'paginas', veces: 1 }]);
      api.encolar([cap(3)], enProxy);
      await api.colaVacia();
      await hasta(`!document.querySelector('#reintentar').disabled`, 'el botón de reintentar');
      const fallo5 = await en(filaCola);
      await en(`document.querySelector('#reintentar').click()`);
      const cuenta5 = [];                                    // los números de la cuenta regresiva, mirando cada 150 ms
      for (const fin = Date.now() + 20000; Date.now() < fin; await dormir(150)) {
        const s = await en(filaCola), m = s.match(/sigo en (\d+) s/);
        if (m && cuenta5[cuenta5.length - 1] !== +m[1]) cuenta5.push(+m[1]);
        if (/✅/.test(s)) break;
      }
      const fin5 = estados(await api.colaVacia()), h5 = pagDe(3);
      eq('503 con Retry-After: 5: dice el motivo; al reintentar cuenta hasta 1 y sale a los 5 s o más del 503 (y bastante antes de un minuto); completa',
        `${fallo5} · cuenta ${cuenta5[0] <= 5 && cuenta5[0] >= 3 ? 'desde 5 o menos' : cuenta5.join(',')} hasta ${cuenta5[cuenta5.length - 1]} · ${h5.length === 2 && h5[1] - h5[0] >= 5000 && h5[1] - h5[0] < 15000 ? 'entre 5 y 15 s' : (h5[1] - h5[0]) + ' ms'} · ${fin5}`,
        '⚠️ falló: La página respondió HTTP 503: el sitio pidió esperar · cuenta desde 5 o menos hasta 1 · entre 5 y 15 s · Proxy/Proxy 0003: listo (6 páginas)');
      api.limpiar();

      // Corte a partir del 6.º pedido (página e imágenes): el capítulo queda incompleto, sin archivo a medias
      proxy.fijarReglas([{ codigo: 503, retryAfter: '1', desde: 6 }]);
      const antes6 = proxy.pedidos.length;
      api.encolar([{ url: `${S}/leer/ocupado-3/`, texto: 'Capítulo 3', numero: 3 }], { ...enProxy, serie: 'Corte' });
      const corte = estados(await api.colaVacia()), inyectados = proxy.pedidos.slice(antes6).filter(p => p.inyectado);
      eq('corte desde el 6.º pedido (503): el capítulo queda incompleto, con el motivo, y no queda ningún archivo a medias',
        `${corte} · ${ls('Corte')}`, 'Corte/Corte 0003: incompleto (no guardé nada, para no dejarlo a medias · el sitio pidió esperar (HTTP 503)) · (no existe)');
      eq('  el proxy contestó 503 desde el 6.º pedido del capítulo, y los 5 primeros pasaron', `${proxy.pedidos.slice(antes6).filter(p => !p.inyectado).length >= 5} · ${inyectados.length > 0} · ${inyectados.every(p => p.codigo === 503)}`, 'true · true · true');
      api.olvidarEsperas();
      api.limpiar();

      // El sitio contesta 503 a imágenes que carga la página misma (no el armador): una imagen rota no
      // dice por qué, pero el programa lo ve en la respuesta, y el capítulo no se guarda a medias.
      // (Lo encontró la corrida real a través del proxy el 24-11-2026: se guardaban 3 páginas de 17 como "listo".)
      proxy.fijarReglas([{ codigo: 503, retryAfter: '1', accept: 'avif', ruta: '/img/alfa/1/', desde: 3, veces: 2 }]);
      const antesImg = ls('Proxy');
      api.encolar([cap(1)], enProxy);
      const enPagina = estados(await api.colaVacia());
      eq('el sitio contesta 503 a dos imágenes que carga la página (no el armador): incompleto, con el motivo, sin archivo nuevo, y el sitio frenado lo que pidió',
        `${enPagina} · ${ls('Proxy') === antesImg} · freno ${api.esperaDe(S) > 0 && api.esperaDe(S) <= 1000 ? 'de 1 s o menos' : api.esperaDe(S) + ' ms'}`,
        'Proxy/Proxy 0001: incompleto (no guardé nada, para no dejarlo a medias · el sitio pidió esperar (HTTP 503)) · true · freno de 1 s o menos');
      await dormir(1100);
      api.reintentar();
      eq('  con el sitio libre, Reintentar lo baja entero', estados(await api.colaVacia()), 'Proxy/Proxy 0001: listo (6 páginas)');
      api.limpiar();

      // El reintento no se gasta: dos fallos seguidos del mismo capítulo, y el botón se sigue ofreciendo
      proxy.fijarReglas([{ codigo: 503, retryAfter: '2', ruta: '/leer/alfa-4/', solo: 'paginas', veces: 2 }]);
      api.encolar([cap(4)], enProxy);
      await api.colaVacia();
      await hasta(`!document.querySelector('#reintentar').disabled`, 'el botón, después del primer fallo');
      await en(`document.querySelector('#reintentar').click()`);
      await hastaQue(() => pagDe(4).length >= 2 && api.verCola()[0]?.estado === 'falló', 'el segundo fallo');
      await hasta(`!document.querySelector('#reintentar').disabled`, 'el botón, después del segundo fallo');
      const boton2 = await en(`(() => { const r = document.querySelector('#reintentar'); return (r.disabled ? 'apagado' : 'prendido') + ' · ' + r.textContent; })()`);
      await en(`document.querySelector('#reintentar').click()`);
      await hastaQue(() => pagDe(4).length >= 3, 'el tercer intento');
      const fin4 = estados(await api.colaVacia()), h4 = pagDe(4);
      eq('dos fallos seguidos del mismo capítulo (503 con Retry-After: 2): el botón se sigue ofreciendo, y el tercer intento sale y completa',
        `${boton2} · ${h4.length} pedidos · ${fin4}`, 'prendido · Reintentar 1 que falló · 3 pedidos · Proxy/Proxy 0004: listo (6 páginas)');
      eq('  cada reintento respetó el freno: salió a los 2 s o más del fallo anterior', `${h4[1] - h4[0] >= 2000} · ${h4[2] - h4[1] >= 2000}`, 'true · true');
      api.limpiar();

      // El aviso de fin de cola: un botón por cada cosa que deja hacer la ventana, y cada uno corre el
      // mismo manejador que su botón. Acá se dispara la acción de cada botón como la dispara Windows
      // (tests/avisos.js los aprieta de verdad).
      proxy.fijarReglas([{ codigo: 503, retryAfter: '3', ruta: '/leer/alfa-2/', solo: 'paginas', veces: 1 }]);
      const antesAv = pagDe(2).length;
      api.encolar([cap(2)], enProxy);
      await api.colaVacia();
      await hasta(`!document.querySelector('#reintentar').disabled`, 'el botón de reintentar');
      const av = api.armarAvisoDeFin();
      const ventana = await en(`['#reintentar', '#limpiar', '#abrirCarpeta'].map(s => document.querySelector(s).textContent).join(' | ')`);
      eq('el aviso de fin de cola trae un botón por cada cosa que deja hacer la ventana, con el mismo texto',
        `${av.titulo} · ${av.cuerpo} · ${av.botones.map(b => b.texto).join(' | ')} · ventana: ${ventana}`,
        'Manga Reader: terminó la cola · 1 con problemas · Reintentar 1 que falló | Limpiar terminados | Abrir carpeta · ventana: Reintentar 1 que falló | Limpiar terminados | Abrir carpeta');
      const t1 = av.accion({ actionIndex: 0 }), t2 = av.accion({ actionIndex: 0 });     // Windows avisa el toque dos veces
      const r1 = await t1;
      await hastaQue(() => pagDe(2).length >= antesAv + 2, 'el reintento desde el aviso');
      const finAv = estados(await api.colaVacia()), hA = pagDe(2).slice(antesAv);
      eq('  "Reintentar" desde el aviso: el mismo manejador que el botón (vuelve 1 a la cola, una sola vez aunque el toque llegue dos veces), respeta el freno (sale a los 3 s o más del 503) y completa',
        `${JSON.stringify(r1)} · ${t1 === t2} · ${hA.length === 2 && hA[1] - hA[0] >= 3000 ? '3 s o más' : hA.map(h => h - hA[0]).join(',')} · ${finAv}`, '{"ok":true,"valor":1} · true · 3 s o más · Proxy/Proxy 0002: listo (6 páginas)');
      const av2 = api.armarAvisoDeFin();
      eq('  sin nada que reintentar, el aviso no ofrece Reintentar (la ventana lo tiene apagado)', `${av2.botones.map(b => b.texto).join(' | ')} · ${await en(`document.querySelector('#reintentar').disabled`)}`, 'Limpiar terminados | Abrir carpeta · true');
      const abierta = await av2.accion({ actionIndex: 1 });
      eq('  "Abrir carpeta" desde el aviso: la carpeta de descargas, como el botón (en esta prueba se anota en vez de abrir el Explorador)', `${abierta.ok} · ${api.carpetasAbiertas[api.carpetasAbiertas.length - 1] === tmp}`, 'true · true');
      await api.armarAvisoDeFin().accion({ actionIndex: 0 });
      await hasta(`/Todavía no hay nada/.test(document.querySelector('#cola').textContent)`, 'la cola limpia');
      eq('  "Limpiar terminados" desde el aviso: la lista queda vacía en el programa y en la ventana', `${api.verCola().length} · ${await en(`document.querySelector('#cola').textContent`)}`, '0 · Todavía no hay nada en la cola.');

      // Un capítulo que ya está en la carpeta, y una de sus imágenes pide esperar al abrir la página:
      // sigue siendo "ya estaba" (no "incompleto"), y el sitio queda frenado lo que pidió
      proxy.fijarReglas([{ codigo: 503, retryAfter: '1', accept: 'avif', ruta: '/img/alfa/2/', desde: 3, veces: 1 }]);
      api.encolar([cap(2)], { ...enProxy, saltear: true });
      eq('un capítulo que ya está en la carpeta, con una de sus imágenes pidiendo esperar al abrir la página: "ya estaba", y el sitio frenado lo que pidió',
        `${estados(await api.colaVacia())} · freno ${api.esperaDe(S) > 0 && api.esperaDe(S) <= 1000 ? 'de 1 s o menos' : api.esperaDe(S) + ' ms'}`, 'Proxy/Proxy 0002: ya estaba (ya está en la carpeta) · freno de 1 s o menos');
      api.limpiar();
    } finally {
      await api.usarProxy(null);
      api.olvidarEsperas();
      await proxy.cerrar();
    }
    eq('sin el proxy, el camino de siempre: la página va directo al sitio', await (async () => { const antes = sitio.pedidos.capitulos['/leer/alfa-1/'] || 0; api.encolar([{ url: S + '/leer/alfa-1/', texto: 'x', numero: 1 }], { carpeta: tmp, serie: 'Directo', formatos: soloPdf }); const e = estados(await api.colaVacia()); api.limpiar(); return `${e} · ${(sitio.pedidos.capitulos['/leer/alfa-1/'] || 0) - antes}`; })(),
      'Directo/Directo 0001: listo (6 páginas) · 1');
    // (estas series no quedan para las pruebas que siguen, que cuentan lo que hay en el registro)
    for (const s of ['proxy', 'directo']) api.quitarDelRegistro(s);
    for (const d of ['Proxy', 'Directo', 'Corte']) fs.rmSync(path.join(tmp, d), { recursive: true, force: true });

    // Favoritos: filtros por tipo y por idioma (los dos se detectan al pegar la lista, por sus títulos de grupo)
    await pegarEnFavoritos(`Zeta: ${S}/serie/zeta/\nManga en español:\nGama: ${S}/serie/gama/\nCómics en inglés:\nDelta: ${S}/serie/delta/`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 3`, 'los favoritos con tipo e idioma');
    const filtrarG = (tipo, idioma) => en(`(() => { const t = document.querySelector('#guardadosTipo'), i = document.querySelector('#guardadosIdioma'); t.value = ${JSON.stringify(tipo)}; i.value = ${JSON.stringify(idioma)}; t.dispatchEvent(new Event('change'));
      return [...document.querySelectorAll('#guardadosLista .guardado')].map(g => g.querySelector('.g-nombre').textContent + ' [' + (g.querySelector('.g-tipo')?.textContent || '') + ']').join(' | ') + ' · ' + document.querySelector('#guardadosCuenta').textContent; })()`);
    eq('favoritos: cada uno muestra su tipo y su idioma', await filtrarG('', ''), 'Zeta [Manga y cómics] | Gama [Manga · Español] | Delta [Cómics · Inglés] · 3 favoritos');
    eq('  filtro por tipo (el que no dice cuál es vale para los dos)', await filtrarG('manga', '') + ' / ' + await filtrarG('comics', ''),
      'Zeta [Manga y cómics] | Gama [Manga · Español] · 2 de 3 / Zeta [Manga y cómics] | Delta [Cómics · Inglés] · 2 de 3');
    eq('  filtro por idioma, y los que no tienen idioma anotado', await filtrarG('', 'en') + ' / ' + await filtrarG('', 'otro'), 'Delta [Cómics · Inglés] · 1 de 3 / Zeta [Manga y cómics] · 1 de 3');
    eq('  los dos filtros juntos', await filtrarG('manga', 'es') + ' / ' + await filtrarG('comics', 'es'), 'Gama [Manga · Español] · 1 de 3 /  · 0 de 3');
    await filtrarG('', '');

    // Nombres y sagas
    const escribirEn = (id, texto) => en(`(() => { const c = document.querySelector('#${id}'); c.value = ${JSON.stringify(texto)}; c.dispatchEvent(new Event('input')); })()`);
    await en(`document.querySelector('#nombres').open = true`);
    await escribirEn('plantilla', '{serie}/{volumen}/{serie} {numero} - {titulo}');
    await hasta(`/Tomo 1/.test(document.querySelector('#plantillaVista').textContent)`, 'la vista previa de la plantilla');
    eq('plantilla de nombres: se guarda al escribirla y muestra cómo quedaría', api.config().plantilla + ' · ' + await en(`[...document.querySelectorAll('#plantillaVista div')].map(d => d.textContent).join(' | ')`),
      '{serie}/{volumen}/{serie} {numero} - {titulo} · De una lista: One Piece/Tomo 1/One Piece 0005 - Capítulo 5.pdf | Suelto: Naruto/Naruto 0300.pdf');
    await escribirEn('plantilla', '{serie}/{tomo}');
    await hasta(`/tomo/.test(document.querySelector('#plantillaAviso').textContent)`, 'los avisos de la plantilla');
    eq('  avisa si los nombres van a chocar o si un marcador no existe', await en(`document.querySelector('#plantillaAviso').textContent`),
      '⚠️ Sin {numero} ni {titulo}, todos los capítulos de una serie se llamarían igual.\n⚠️ No conozco {tomo}: va a quedar escrito tal cual en el nombre.');
    await en(`document.querySelector('#plantillas button').click()`);
    await hasta(`/East Blue/.test(document.querySelector('#plantillaVista').textContent)`, 'la plantilla de siempre');
    eq('  "De siempre" vuelve al nombre de siempre, sin plantilla guardada', JSON.stringify(api.config().plantilla) + ' · ' + await en(`document.querySelector('#plantilla').value`), '"" · {serie}/{saga}/{serie} {numero}');
    await en(`document.querySelector('#sagas').value = ${JSON.stringify('Mi Serie\n1-10 Primera\nesto no es una saga\n11- Segunda')}; document.querySelector('#guardarSagas').click()`);
    await hasta(`document.querySelector('#sagasMsg').textContent.length > 0`, 'las sagas guardadas');
    eq('sagas propias: se guardan, se usan y dice lo que no entendió', (await en(`document.querySelector('#sagasMsg').textContent`)).replace(/No entendí: .*/, 'No entendí: (…)') + ' · ' + api.nucleo.sagaDe('Mi Serie', 12) + ' · ' + api.nucleo.nameFor({ serie: 'Mi Serie', numero: 3 }),
      'Guardadas: 1 serie. No entendí: (…) · Segunda · Mi Serie/01 Primera/Mi Serie 0003');
    api.guardarConfig({ sagasTexto: '', plantilla: '' });
    eq('recientes: quedan las direcciones que se analizaron a mano, la última primero', api.config().recientes.map(r => r.url.replace(S, '').replace(T, 'T')).join(' | ') + ' · ' + await en(`document.querySelectorAll('#recientes option').length`),
      '/leer/avisos-1/ | T/ | / · 3');

    // Historial: el registro de lo que se bajó, por serie
    await en(`document.querySelector('#verHistorial').click()`);
    await hasta(`document.querySelectorAll('#historialLista .guardado').length === 6`, 'el historial');
    const historialEnPantalla = () => en(`document.querySelector('#verHistorial').textContent + ' · ' + document.querySelector('#historialCuenta').textContent + ' · ' + [...document.querySelectorAll('#historialLista .guardado')].map(g => g.querySelector('.g-nombre').textContent + ': ' + g.querySelector('.g-datos').textContent.replace(/ · el último, el .*/, '')).sort().join(' | ')`);
    eq('historial: lo que bajaste, por serie, con cuántos y de cuál a cuál', await historialEnPantalla(),
      '🗂 Historial (6) · 6 series · 11 capítulos · Alfa: 4 capítulos · del 1 al 4 | Avisos: 1 capítulo · el 1 | Beta: 3 capítulos · del 1 al 3 | Con Sagas: 1 capítulo · el 3 | Inestable: 1 capítulo · el 1 | Revisado: 1 capítulo · el 1');
    await en(`(() => { const f = document.querySelector('#historialFiltro'); f.value = 'alf'; f.dispatchEvent(new Event('input')); })()`);
    eq('  se busca por serie', (await historialEnPantalla()).split(' · ').slice(1).join(' · '), '1 de 6 series · Alfa: 4 capítulos · del 1 al 4');
    await en(`document.querySelector('#historialLista .g-quitar').click()`);
    await hasta(`document.querySelectorAll('#historialLista .guardado').length === 0`, 'la serie quitada del historial');
    eq('  y una serie se puede quitar del registro (sin borrar archivos)', api.verRegistro().map(s => s.serie).sort().join(', ') + ' · ' + fs.existsSync(path.join(tmp, 'Alfa', 'Alfa 0004.pdf')), 'Avisos, Beta, Con Sagas, Inestable, Revisado · true');

    // Tu colección: las carpetas donde también se mira lo que ya tenés
    eq('tu colección: las carpetas agregadas están a la vista', await en(`document.querySelectorAll('#bibliotecas .biblioteca').length`) + ' · ' + api.config().bibliotecas.length, '1 · 1');
    await en(`document.querySelector('#bibliotecas .g-quitar').click()`);
    await hasta(`document.querySelectorAll('#bibliotecas .biblioteca').length === 0`, 'la carpeta quitada de la colección');
    eq('  y se pueden quitar', api.config().bibliotecas.length, 0);

    // Si una carpeta de la colección no está a la vista (Google Drive cerrado), se avisa
    api.guardarConfig({ bibliotecas: [path.join(tmp, 'no-esta')] });
    await en(`window.dispatchEvent(new Event('focus'))`);
    await hasta(`!document.querySelector('#avisoCarpetas').hidden`, 'el aviso de la carpeta que no está');
    eq('una carpeta que no está a la vista: aviso arriba de todo', (await en(`document.querySelector('#avisoCarpetas').textContent`)).replace(/: .*no-esta. /, ': (…)no-esta. ').startsWith('⚠️ No puedo ver esta carpeta: (…)no-esta. Si están en Google Drive o en otro disco'), true);
    api.guardarConfig({ bibliotecas: [] });
    await en(`window.dispatchEvent(new Event('focus'))`);
    await hasta(`document.querySelector('#avisoCarpetas').hidden`, 'el aviso quitado');
    eq('sin errores en la consola de la interfaz', consola.join(' | '), '');
  } finally {
    await sitio.cerrar();
    await tapas.cerrar();
    for (const t of temporales) { try { fs.rmSync(t, { recursive: true, force: true }); } catch {} }
  }
  console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK');
  return fallas;
};
