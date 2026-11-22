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

    console.log('\n── Links guardados');
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
    if (process.env.CAPTURAS) {
      fs.mkdirSync(process.env.CAPTURAS, { recursive: true });
      fs.writeFileSync(path.join(process.env.CAPTURAS, 'programa.png'), (await ui.webContents.capturePage()).toPNG());
    }

    await en(`document.querySelector('#verPegar').click(); document.querySelector('#links').value = ${JSON.stringify(`Capítulos\n02: ${S}/leer/alfa-2/\n${S}/leer/alfa-1/`)}; document.querySelector('#usarLinks').click()`);
    await hasta(`document.querySelectorAll('#lista .fila').length === 2`, 'los links pegados');
    eq('pegar links: quedan numerados y marcados', await en(`[...document.querySelectorAll('#lista .fila')].map(f => f.querySelector('.num').textContent + (f.querySelector('input').checked ? '*' : '')).join(' ') + ' · ' + document.querySelector('#estado').textContent`),
      '1* 2* · Tomé 2 links: capítulos 1 a 2, con el número que trae cada link. Escribí el nombre de la serie a la derecha.');

    // Links guardados: quedaron dos de las pruebas de arriba
    const filasG = async () => (await en(`[...document.querySelectorAll('#guardadosLista .guardado')].map(g => g.querySelector('.g-nombre').textContent + ' (' + g.querySelector('.g-datos').textContent + ')').join(' | ')`)).split(S.replace('http://', '')).join('');
    const avisoG = () => en(`document.querySelector('#guardadosMsg').textContent + ' · ' + document.querySelector('#verGuardados').textContent`);
    eq('links guardados: el botón dice cuántos hay y el panel arranca cerrado', await en(`document.querySelector('#verGuardados').textContent + ' ' + document.querySelector('#guardados').hidden`), '⭐ Guardados (2) true');
    await en(`document.querySelector('#verGuardados').click()`);
    eq('  al abrirlo muestra la lista, con la dirección y lo anotado; "Pegar links" se cierra', await filasG() + ' · ' + await en(`document.querySelector('#pegar').hidden`),
      'Sitio de prueba ( · el catálogo de prueba) | Beta (/serie/beta) · true');
    await en(`document.querySelector('#verCargar').click(); document.querySelector('#listaLinks').value = ${JSON.stringify(`Mis series:\nAlfa: ${S}/serie/alfa/ — con volúmenes\n${S}/serie/beta/`)}; document.querySelector('#agregarLista').click()`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 3`, 'la lista cargada');
    eq('  cargar una lista pegada: suma los nuevos y avisa los que ya estaban', await avisoG() + ' · ' + await en(`document.querySelector('#cargar').hidden + ' ' + JSON.stringify(document.querySelector('#listaLinks').value)`),
      'Agregué 1 link. 1 ya estaba o venía repetido. · ⭐ Guardados (3) · true ""');
    await en(`(() => { const f = document.querySelector('#guardadosFiltro'); f.value = 'volúmenes'; f.dispatchEvent(new Event('input')); })()`);
    eq('  buscar en la lista', await filasG() + ' · ' + await en(`document.querySelector('#guardadosCuenta').textContent`), 'Alfa (/serie/alfa · con volúmenes) · 1 de 3');
    if (process.env.CAPTURAS) fs.writeFileSync(path.join(process.env.CAPTURAS, 'programa-guardados.png'), (await ui.webContents.capturePage()).toPNG());
    await en(`document.querySelector('#guardadosLista .g-abrir').click()`);
    await hasta(`document.querySelectorAll('#lista .seccion').length === 2 && document.querySelector('#guardados').hidden`, 'la serie guardada');
    eq('  tocar un link guardado lo analiza', await rutaEnPantalla() + ' · ' + (await en(`document.querySelector('#url').value`)).replace(S, ''), 'Alfa – Todos los capítulos · /serie/alfa/');
    await en(`document.querySelector('#verGuardados').click(); document.querySelector('#guardadosFiltro').value = ''; document.querySelector('#guardarActual').click()`);
    await hasta(`document.querySelector('#guardadosMsg').textContent.length > 0`, 'el aviso');
    eq('  guardar la dirección que se está mirando: si ya está, lo dice', await avisoG(), 'Esa dirección ya estaba en tu lista. · ⭐ Guardados (3)');
    await en(`document.querySelector('#lista .fila .entrar').click()`);
    await hasta(`!document.querySelector('#capitulo').hidden`, 'un capítulo');
    await en(`document.querySelector('#guardarActual').click()`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 4`, 'la dirección guardada');
    eq('  y si no, la guarda con el título de la página', await avisoG() + ' · ' + (await filasG()).split(' | Alfa (/serie/alfa · con volúmenes) | ').pop(),
      'Guardada. · ⭐ Guardados (4) · Alfa Capítulo 1 | Sitio de prueba (/leer/alfa-1)');
    await en(`document.querySelectorAll('#guardadosLista .g-quitar')[3].click()`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 3`, 'el link quitado');
    eq('  quitar uno', await filasG(), 'Sitio de prueba ( · el catálogo de prueba) | Beta (/serie/beta) | Alfa (/serie/alfa · con volúmenes)');
    await en(`document.querySelector('#quitarTodos').click()`);
    eq('  "Quitar todos" pide confirmar con otro toque', await en(`document.querySelector('#quitarTodos').textContent + ' · ' + document.querySelectorAll('#guardadosLista .guardado').length`), '¿Quitar los 3? Tocá de nuevo · 3');
    await en(`document.querySelector('#quitarTodos').click()`);
    await hasta(`document.querySelectorAll('#guardadosLista .guardado').length === 0`, 'la lista vacía');
    eq('  y con el segundo la vacía: queda a la vista el cuadro para cargar otra', await avisoG() + ' · ' + await en(`document.querySelector('#guardadosLista').textContent + ' ' + document.querySelector('#cargar').hidden`) + ' · ' + api.guardados().length,
      'Quité todos los links. · ⭐ Guardados · Todavía no guardaste ningún link. Guardá la dirección que estés mirando o cargá una lista. false · 0');
    eq('sin errores en la consola de la interfaz', consola.join(' | '), '');
  } finally {
    await sitio.cerrar();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
  console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK');
  return fallas;
};
