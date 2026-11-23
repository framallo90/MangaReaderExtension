// Pruebas del programa. Corren dentro de Electron ("npm run prueba") contra el sitio de
// prueba de tests/sitio.js: exploran los tres niveles, bajan capítulos a una carpeta
// temporal y miran los archivos que quedaron. Si la variable CAPTURAS nombra una carpeta,
// guardan ahí una captura de la interfaz.
const fs = require('fs'), os = require('os'), path = require('path');
const { iniciar } = require('./sitio');
const { pdfPages, zipNames } = require('../../tests/navegador');

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
  const lista = (r, tipo) => r.listas.find(l => l.tipo === tipo);
  const ls = (rel) => { try { return fs.readdirSync(path.join(tmp, rel)).sort().join(' | '); } catch { return '(no existe)'; } };
  const estados = (cola) => cola.map(t => `${t.nombre || t.texto}: ${t.estado}${t.detalle ? ' (' + t.detalle + ')' : ''}`).join(' ; ');
  console.log(`== Programa · núcleo de ${api.nucleo.version}`);

  try {
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

    // Volver a la portada por la ruta: muestra lo que tiene, la pista del catálogo y deja traer más páginas
    await en(`document.querySelector('#ruta button').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 4 && !document.querySelector('#siguiente').hidden`, 'la portada');
    eq('la portada: sus títulos y la pista del listado completo', await titulos() + ' · ' + await en(`[...document.querySelectorAll('#pistas button')].map(e => e.textContent).join(', ')`),
      'Alfa, Beta, Gama 3, Delta · Directorio ›');
    await en(`document.querySelector('#siguiente').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 7`, 'las páginas siguientes');
    eq('"Traer más páginas": suma las siguientes, sin repetir', await titulos() + ' · ' + await avisoEnPantalla() + ' · ' + await en(`document.querySelector('#siguiente').hidden`),
      'Alfa, Beta, Gama 3, Delta, Épsilon, Zeta, Eta · Sumé 3 renglones a esta lista, de 2 páginas. No hay más páginas. · true');

    await en(`document.querySelector('#lista .fila .entrar').click()`);
    await hasta(`document.querySelectorAll('#lista .seccion').length === 2`, 'los capítulos de la serie');
    eq('entrar a un título muestra sus capítulos por volumen',
      await en(`[...document.querySelectorAll('#lista > *')].map(e => e.classList.contains('seccion') ? '[' + e.querySelector('.txt').textContent + ']' : e.querySelector('.num').textContent).join(' ')`),
      '[Volumen 1] 1 2 [Volumen 2] 3 4');
    eq('  la ruta recuerda por dónde se entró', await en(`[...document.querySelectorAll('#ruta button')].map(e => e.textContent).join(' › ')`), 'Sitio de prueba – Catálogo › Alfa – Todos los capítulos');
    await en(`document.querySelectorAll('#lista .seccion input')[1].click()`);
    eq('  tildar un volumen marca sus capítulos', await en(`[...document.querySelectorAll('#lista .fila')].map(f => f.querySelector('input').checked ? f.querySelector('.num').textContent : '').join('') + ' · ' + document.querySelector('#descargar').textContent`), '34 · Descargar 2 capítulos');
    await en(`document.querySelector('#descargar').click()`);
    await api.colaVacia();
    eq('  descargar desde la interfaz', ls('Alfa').split(' | ').filter(n => /000[34]\.pdf$/.test(n)).join(' | '), 'Alfa 0003.pdf | Alfa 0004.pdf');
    await hasta(`document.querySelectorAll('#cola .tarea.listo').length === 2`, 'la cola en pantalla');
    eq('  la cola muestra el resultado', await en(`[...document.querySelectorAll('#cola .tarea')].map(t => t.querySelector('.t-nombre').textContent + ' ' + t.querySelector('.t-estado').textContent).join(' ; ')`),
      'Alfa/Alfa 0003 ✅ 6 páginas ; Alfa/Alfa 0004 ✅ 6 páginas');
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
    eq('  la portada muestra sus títulos y las pistas del listado completo', await titulos() + ' · ' + await en(`[...document.querySelectorAll('#pistas button')].map(e => e.textContent).join(', ') + ' · ' + document.querySelector('#capitulo').hidden`),
      'Uno, Dos, Tres, Cuatro, Cinco, Seis, Siete, Ocho · 📚 Biblioteca ›, Explorar todo › · true');
    await hasta(`${conMiniatura} === 8`, 'las tapas de la portada');
    await en(`document.querySelector('#verTapas').click()`);
    eq('  el botón "Tapas" las apaga: queda la lista de siempre, y se recuerda', await mosaico() + ' · ' + api.config().tapas, 'false block 0 0 botón apagado · false');
    await en(`document.querySelector('#verTapas').click()`);
    eq('  y las vuelve a prender, con las miniaturas que ya tenía', await mosaico() + ' · ' + api.config().tapas, 'true grid 8 8 botón prendido · true');
    eq('  las tapas se pidieron una sola vez cada una, con el Referer del sitio', `${tapas.pedidos.sinReferer} sin Referer`, '0 sin Referer');

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
    eq('sin errores en la consola de la interfaz', consola.join(' | '), '');
  } finally {
    await sitio.cerrar();
    await tapas.cerrar();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
  console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK');
  return fallas;
};
