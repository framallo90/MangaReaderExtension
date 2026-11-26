// La galería de un sitio real, con el programa de verdad (0.11.0): abre el programa con una carpeta
// de datos aparte, pega la dirección, toca "Ver todo el sitio" y cuenta lo que pasa: el avance, cómo
// quedó (completa, o incompleta y por qué), cuántos títulos y páginas, y qué pasó con las tapas (se
// piden las de los primeros títulos, como las pediría la galería al mostrarlos).
// No deja nada: la galería se guarda en la carpeta de datos temporal, que se borra al terminar.
//
// Uso: node tests/galeria-real.js <dirección> [tope de páginas] [cuántas tapas pedir]
//   node tests/galeria-real.js https://one-piece-fans2.com/manga/es/todos/1104 3
// La ventana del programa no se muestra (con VENTANA=1, sí): se maneja por el protocolo de
// depuración, con tests/ventana.js. Con CAPTURA=<archivo.png> guarda una captura de la galería.
const fs = require('fs'), os = require('os'), path = require('path');
require('../scripts/generar.js');                 // (como scripts/abrir.js: generado/ con la última versión de la extensión)
const { abrir, conectar, dormir } = require('./ventana');

const fecha = () => new Date().toLocaleString('es-AR', { hour12: false });
const hora = () => new Date().toLocaleTimeString('es-AR', { hour12: false });

(async () => {
  let [url, tope = '3', tapas = '24'] = process.argv.slice(2);
  if (!url) { console.log('Uso: node tests/galeria-real.js <dirección> [tope de páginas] [cuántas tapas pedir]'); process.exit(1); }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-galeria-real-'));
  console.log(`== La galería de un sitio real · ${fecha()}`);
  console.log(`  dirección: ${url} · tope: ${tope} páginas`);
  let programa = null, fallo = false;
  try {
    programa = abrir(datos);
    const v = await conectar(await programa.ws);
    const t0 = Date.now();
    await v.en(`(() => { const t = document.querySelector('#galTope'); t.value = ${JSON.stringify(String(tope))}; t.dispatchEvent(new Event('change')); document.querySelector('#url').value = ${JSON.stringify(url)}; document.querySelector('#verTodo').click(); })()`);
    // El avance, cada vez que cambia lo que dice la ventana
    let antes = '', fin = null;
    for (const limite = Date.now() + 15 * 60000; Date.now() < limite && !fin; await dormir(500)) {
      const e = await v.en(`(() => { const g = !document.querySelector('#galeria').hidden; return { galeria: g, recorriendo: g && !document.querySelector('#galCancelar').hidden,
        texto: document.querySelector(g ? '#galEstado' : '#estado').textContent, libre: !document.querySelector('#verTodo').disabled }; })()`);
      if (e.texto !== antes) { console.log(`[${hora()}] ${e.texto}`); antes = e.texto; }
      if (e.libre && !e.recorriendo && !/^(Buscando|Recorriendo|Cancelando)/.test(e.texto)) fin = e;
    }
    if (!fin) throw new Error('El recorrido no terminó en 15 minutos');
    console.log(`  tardó ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (!fin.galeria) {
      console.log('  no se armó ninguna galería. Lo que quedó a la vista, con la exploración de siempre: ' + await v.en(`[document.querySelector('#capitulo').hidden ? '' : 'un capítulo (' + document.querySelector('#capNombre').textContent + ')',
        [...document.querySelectorAll('#tabs button')].map(b => b.textContent).join(' | ') || (document.querySelectorAll('#lista .fila').length ? document.querySelectorAll('#lista .fila').length + ' renglones' : '')].filter(Boolean).join(' · ') || 'nada'`));
    } else {
      const g = await v.en(`mr.galeria.de(${JSON.stringify(url)}).then(g => g || mr.galeria.de(document.querySelector('#galTitulo').title.replace(/^.* desde /, '')))`);
      const conTapa = g.titulos.filter(t => t.imagen), tipos = [...new Set(g.titulos.map(t => t.tipo).filter(Boolean))], idiomas = [...new Set(g.titulos.map(t => t.idioma).filter(Boolean))];
      console.log(`  ${await v.en(`document.querySelector('#galTitulo').textContent + ' · ' + document.querySelector('#galDatos').textContent`)}`);
      console.log(`  empieza en: ${g.inicio}`);
      console.log(`  estado: ${g.estado}${g.motivo ? ' (' + g.motivo + ')' : ''} · se puede seguir: ${g.sePuedeSeguir ? 'sí' : 'no'}`);
      console.log(`  títulos: ${g.titulos.length} en ${g.paginas} ${g.paginas === 1 ? 'página' : 'páginas'} · con tapa: ${conTapa.length} · sin tapa: ${g.titulos.length - conTapa.length} · tipo: ${tipos.join(', ') || 'el sitio no lo dice'} · idioma: ${idiomas.join(', ') || 'el sitio no lo dice'}`);
      console.log(`  los primeros: ${g.titulos.slice(0, 12).map(t => t.nombre).join(' | ')}`);
      console.log(`  los últimos: ${g.titulos.slice(-4).map(t => t.nombre).join(' | ')}`);
      // Las tapas: las de los primeros títulos, pedidas como las pide la galería (con el Referer de la página donde se vieron)
      const pedir = conTapa.slice(0, +tapas || 24);
      if (pedir.length) {
        const r = await v.en(`Promise.all(${JSON.stringify(pedir.map(t => [t.imagen, t.pagina]))}.map(([i, p]) => mr.tapa(i, p).then(d => ({ ok: true, kb: Math.round(d.length * 3 / 4 / 1024) }), e => ({ ok: false, error: e.message }))))`);
        const mal = r.filter(x => !x.ok);
        console.log(`  tapas pedidas: ${r.length} · cargaron: ${r.length - mal.length}` + (mal.length ? ` · no cargaron: ${mal.length} (${[...new Set(mal.map(x => x.error))].join('; ')})` : '') +
          ` · de dónde salen: ${[...new Set(pedir.map(t => { try { return new URL(t.imagen).host; } catch { return '?'; } }))].join(', ')}`);
        await dormir(1500);
        console.log(`  en la ventana: ${await v.en(`document.querySelectorAll('#galLista .gal-tarjeta').length + ' tarjetas · ' + document.querySelectorAll('#galLista .gal-tapa img[src]').length + ' con su tapa a la vista'`)}`);
      } else console.log('  tapas: el listado no trae ninguna (cada tarjeta muestra la inicial)');
    }
    if (process.env.CAPTURA) {
      // (una captura de la ventana, por el protocolo de depuración)
      try { const png = await v.captura(); if (png) { fs.writeFileSync(process.env.CAPTURA, Buffer.from(png, 'base64')); console.log('  captura: ' + process.env.CAPTURA); } } catch (e) { console.log('  sin captura: ' + e.message); }
    }
    v.cerrar();
  } catch (e) {
    fallo = true;
    console.log('FALLA: ' + (e.stack || e));
  } finally {
    try { programa?.p.kill(); } catch {}
    await dormir(1500);
    try { fs.rmSync(datos, { recursive: true, force: true }); } catch {}
  }
  process.exit(fallo ? 1 : 0);
})();
