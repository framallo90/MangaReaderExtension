// La galería con un catálogo grande (0.11.1): cuánto tarda cada cosa con decenas de miles de títulos.
// Arma una carpeta de datos aparte con una galería ya guardada (33.000 títulos si no se dice otra
// cosa: lo que tiene la Biblioteca de un sitio grande), una colección de mentira (1.500 carpetas de
// series; 300 son de títulos de la galería y 20 se llaman parecido), el registro de lo bajado, y abre
// el programa de verdad sin mostrar la ventana. No le pide nada a internet: las tapas las sirve el
// sitio de prueba. Mide lo que haría una persona: abrir la galería, escribir en el buscador, filtrar,
// marcar una serie, marcar las que se ven, mostrar más tandas, y lo que pasa cada vez que termina
// una bajada (se ponen al día las marcas de lo que ya tenés).
//
// Uso: node tests/galeria-grande.js [títulos] [carpetas de la colección]
// Sale con 1 si algo de lo que se hace a mano (escribir, filtrar, marcar) tarda más de TOPE_MS.
// No es parte de `npm run prueba`: mide tiempos, y con la máquina cargada cambian.
const fs = require('fs'), os = require('os'), path = require('path');
require('../scripts/generar.js');                 // (como scripts/abrir.js: generado/ con la última versión de la extensión)
const { iniciar } = require('./sitio');
const { abrir, conectar, dormir } = require('./ventana');

const TOPE_MS = 1000;
const N = Math.max(100, Math.floor(+process.argv[2]) || 33000);
const CARPETAS = Math.max(0, Math.floor(+process.argv[3] || 1500));
const TIPOS = ['Manga', 'Manhwa', 'Manhua', 'Novela', 'Doujinshi'];
const A = ['Luna', 'Sombra', 'Reino', 'Espada', 'Torre', 'Dragón', 'Sendero', 'Jardín', 'Invierno', 'Cazador', 'Maestro', 'Princesa', 'Academia', 'Crónica', 'Leyenda', 'Guardián', 'Bosque', 'Ciudad', 'Héroe', 'Villana'];
const B = ['Roja', 'del Norte', 'Eterno', 'de Hierro', 'Perdida', 'Carmesí', 'sin Nombre', 'de Cristal', 'Final', 'del Alba', 'Oscuro', 'Dorada', 'de los Mil Años', 'Errante', 'Silencioso', 'del Abismo', 'Blanca'];
const nombre = (i) => `${A[i % A.length]} ${B[Math.floor(i / A.length) % B.length]} ${i + 1}`;
const slug = (i) => `titulo-${i + 1}`;
// (la clave de una serie, como la arma el programa: sin acentos, sin mayúsculas y sin signos)
const clave = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const hora = () => new Date().toLocaleTimeString('es-AR', { hour12: false });

(async () => {
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-galeria-grande-'));
  const sitio = await iniciar({ galeria: true });
  const S = sitio.url;
  let programa = null, fallo = false;
  const lentas = [];
  try {
    // ── Los datos: la galería guardada, la colección y el registro
    const ahora = new Date().toISOString();
    const titulos = Array.from({ length: N }, (_, i) => ({ url: `${S}/largo/${slug(i)}/`, nombre: nombre(i), detalle: TIPOS[i % TIPOS.length], imagen: `${S}/t/${slug(i)}.png`,
      pagina: `${S}/largo/?p=${Math.floor(i / 24) + 1}`, tipo: TIPOS[i % TIPOS.length], idioma: i % 3 ? 'Español' : '', alta: ahora, vista: ahora, desaparecida: i % 700 === 699 ? ahora : '', marcada: false }));
    const galeria = { sitio: S, inicio: `${S}/largo/`, listaIds: ['g:/largo/'], conTapas: true, fecha: ahora, refresco: ahora, paginas: Math.ceil(N / 24), estado: 'completa', motivo: '', siguiente: '', titulos };
    const archivo = path.join(datos, 'galerias.json');
    fs.writeFileSync(archivo, JSON.stringify({ [S]: galeria }));
    const coleccion = path.join(datos, 'coleccion'), descargas = path.join(datos, 'descargas');
    const paso = Math.max(1, Math.floor(N / 300));
    let hechas = 0;
    const carpeta = (...p) => { fs.mkdirSync(path.join(...p), { recursive: true }); hechas++; };
    for (let k = 0; k < Math.min(300, CARPETAS); k++) carpeta(coleccion, 'Manga', nombre(k * paso));                 // las tenés
    for (let k = 0; k < Math.min(20, CARPETAS); k++) carpeta(coleccion, 'Manga', nombre(k * paso + 1) + ' Color');   // se llaman parecido
    for (let k = hechas; k < CARPETAS; k++) carpeta(coleccion, k % 2 ? 'Comics' : 'Libros', `Otra Serie ${k} de la Biblioteca`);
    for (let k = 0; k < 40; k++) carpeta(descargas, `Bajada Suelta ${k}`);
    const registro = [];
    for (let k = 0; k < 40; k++) for (let n = 1; n <= 3; n++) registro.push({ clave: clave(nombre(k * paso + 7)), serie: nombre(k * paso + 7), numero: n, ruta: '', formatos: ['pdf'], paginas: 6, fecha: ahora, url: '' });
    fs.writeFileSync(path.join(datos, 'descargas.json'), JSON.stringify(registro));
    fs.writeFileSync(path.join(datos, 'config.json'), JSON.stringify({ carpeta: descargas, bibliotecas: [coleccion] }));
    console.log(`== La galería con un catálogo grande · ${new Date().toLocaleString('es-AR', { hour12: false })}`);
    console.log(`  ${N} títulos en ${galeria.paginas} páginas (galerias.json: ${(fs.statSync(archivo).size / 1048576).toFixed(1)} MB) · colección: ${hechas} carpetas · registro: ${registro.length} capítulos de 40 series`);

    programa = abrir(datos);
    const v = await conectar(await programa.ws);
    // Evalúa una acción en la ventana y mide cuánto tarda, con el dibujo incluido. `aMano`: es algo
    // que se hace con el mouse o el teclado, y tiene que contestar enseguida.
    const medir = async (que, expr, aMano = false) => {
      const r = await v.en(`(async () => { const t0 = performance.now(); const r = await (${expr}); document.querySelector('#galLista').offsetHeight; return { ms: Math.round(performance.now() - t0), r }; })()`);
      const lenta = aMano && r.ms > TOPE_MS;
      if (lenta) lentas.push(`${que}: ${r.ms} ms`);
      console.log(`[${hora()}] ${String(r.ms).padStart(6)} ms  ${lenta ? 'LENTO ' : ''}${que}${r.r !== undefined && r.r !== null ? ' → ' + r.r : ''}`);
      return r;
    };
    const cuenta = `(document.querySelectorAll('#galLista .gal-tarjeta').length + ' tarjetas' + (document.querySelector('#galCuenta').textContent ? ' · ' + document.querySelector('#galCuenta').textContent : ''))`;
    const escribir = (q) => `(() => { const b = document.querySelector('#galBuscar'); b.value = ${JSON.stringify(q)}; b.dispatchEvent(new Event('input')); return ${cuenta}; })()`;
    const elegir = (id, valor) => `(() => { const e = document.querySelector('#${id}'); if (e.type === 'checkbox') e.checked = ${JSON.stringify(valor)}; else e.value = ${JSON.stringify(valor)}; e.dispatchEvent(new Event('change')); return ${cuenta}; })()`;

    await medir('pedirle al programa la galería guardada (con lo que ya tenés de cada título)', `mr.galeria.de(${JSON.stringify(S)}).then(g => g.titulos.length + ' títulos · ' + g.titulos.filter(t => t.tengo && !t.tengo.parecida).length + ' que ya tenés · ' + g.titulos.filter(t => t.tengo && t.tengo.parecida).length + ' parecidos')`);
    await medir('"Ver todo el sitio": abrir la galería guardada', `(async () => { document.querySelector('#url').value = ${JSON.stringify(S + '/largo/')}; await verTodoElSitio(); return ${cuenta} + ' · ' + document.querySelector('#galDatos').textContent; })()`, true);
    // Las tapas: se piden solo las de las tarjetas que quedan a la vista, no las de todo el catálogo
    let conTapa = 0;
    for (const fin = Date.now() + 20000; Date.now() < fin; await dormir(500)) {
      const n = await v.en(`document.querySelectorAll('#galLista .gal-tapa img[src]').length`);
      if (n && n === conTapa) break;
      conTapa = n;
    }
    console.log(`           tapas: ${conTapa} a la vista con la suya · pedidas al sitio: ${Object.keys(sitio.pedidos.referers || {}).length} de ${N} · rechazadas por el Referer: ${sitio.pedidos.sinReferer}`);

    await medir('escribir "luna" en el buscador', escribir('luna'), true);
    await medir('escribir "luna roja 12"', escribir('luna roja 12'), true);
    await medir('borrar lo escrito', escribir(''), true);
    await medir('filtro "Lo que ya tengo"', elegir('galTengo', 'tengo'), true);
    await medir('filtro "Lo que me falta"', elegir('galTengo', 'falta'), true);
    await medir('  más el tipo "Manhwa"', elegir('galTipo', 'Manhwa'), true);
    await medir('  más "sin tapa"', elegir('galTapa', 'sin'), true);
    await medir('sacar esos filtros', `(() => { ${elegir('galTengo', '')}; ${elegir('galTapa', '')}; return ${elegir('galTipo', '')}; })()`, true);
    await medir('solo las desaparecidas', elegir('galDesaparecidas', true), true);
    await medir('sacar ese filtro', elegir('galDesaparecidas', false), true);

    await medir('marcar una serie (la casilla de su tapa)', `marcarEnGaleria([gal.titulos[3].url], true).then(() => document.querySelector('#galMarcadasCuenta').textContent)`, true);
    await v.en(escribir('sombra del norte'));
    await medir('"Marcar las que se ven" con "sombra del norte" escrito', `marcarEnGaleria(galVisibles().map(t => t.url), true).then(() => document.querySelector('#galMarcadasCuenta').textContent)`, true);
    await v.en(escribir(''));
    await medir('"Desmarcar todas"', `marcarEnGaleria(gal.titulos.filter(t => t.marcada).map(t => t.url), false).then(() => document.querySelector('#galMarcadasCuenta').textContent)`, true);
    console.log(`           galerias.json después de marcar: ${(fs.statSync(archivo).size / 1048576).toFixed(1)} MB`);

    for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const r = await medir(`"Mostrar 600 más" (${k})`, `(() => { const m = document.querySelector('#galLista .gal-mas'); if (!m) return 'sin botón'; m.click(); return ${cuenta}; })()`, true);
      if (r.r === 'sin botón') break;
    }
    await medir('escribir "torre" con 6.000 tarjetas a la vista', escribir('torre'), true);
    await medir('borrar lo escrito', escribir(''), true);
    await medir('ponerse al día cuando termina una bajada (las marcas de lo que ya tenés)', `refrescarGaleria().then(() => document.querySelectorAll('#galLista .gal-marca.tengo').length + ' marcas a la vista')`);
    await medir('"Volver a la galería" (después de entrar a un título)', `volverALaGaleria().then(() => ${cuenta})`, true);
    const mb = await v.en(`performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null`);
    console.log(`           memoria de la ventana: ${mb === null ? 'no se pudo leer' : mb + ' MB'}`);
    v.cerrar();
    if (lentas.length) { fallo = true; console.log(`\nTardó más de ${TOPE_MS} ms algo que se hace a mano:\n  ` + lentas.join('\n  ')); }
    else console.log(`\nTodo lo que se hace a mano contestó en menos de ${TOPE_MS} ms.`);
  } catch (e) {
    fallo = true;
    console.log('FALLA: ' + (e.stack || e));
  } finally {
    try { programa?.p.kill(); } catch {}
    await sitio.cerrar();
    await dormir(1500);
    try { fs.rmSync(datos, { recursive: true, force: true }); } catch {}
  }
  process.exit(fallo ? 1 : 0);
})();
