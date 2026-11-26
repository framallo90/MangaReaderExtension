// Una corrida larga de la galería (0.11.2): un catálogo de prueba de 300 páginas con 12 títulos cada
// una (3.600), recorrido de punta a punta por el programa de verdad, sin mostrar la ventana y con el
// tope por encima de lo que hay (no se llega). Todo local: el catálogo lo sirve el sitio de prueba
// (tests/sitio.js, /catalogo/). Es un recorte de una corrida de horas contra un sitio real: mismas
// pausas del programa, mismas páginas abiertas y cerradas de a una, sin internet de por medio.
//
// Comprueba (sale con 1 si algo no da):
//   · termina, y completa (no por el tope, ni por un corte);
//   · no repite ni pierde ningún título: los de la galería son los del catálogo, en su orden;
//   · cada página del listado se pidió una sola vez, en orden;
//   · la memoria de la ventana (la de su proceso) al final no es más del doble que al principio;
//   · no queda ninguna página abierta, y lo guardado en el disco al cerrar el programa es eso mismo;
//   · al final la ventana no usa más de 1,25 veces lo que usa con esa misma galería recién abierta
//     desde el disco (si el recorrido fuera dejando algo de más, acá se ve).
// Y dice cuánto tardó, cuántas páginas por minuto, y la memoria a lo largo del recorrido (la del
// JavaScript de la ventana, medida después de juntar la basura, y la de cada proceso).
//
// Uso: node tests/galeria-larga.js [páginas] [títulos por página]
// No es parte de `npm run prueba`: con 300 páginas tarda unos veinte minutos.
const fs = require('fs'), os = require('os'), path = require('path');
if (!process.env.EJECUTABLE) require('../scripts/generar.js');   // (como scripts/abrir.js: generado/ con la última versión de la extensión)
const { iniciar, titulosDeCatalogo } = require('./sitio');
const { abrir, conectar, conectarPrincipal, dormir } = require('./ventana');

const PAGINAS = Math.max(3, Math.floor(+process.argv[2]) || 300);
const POR_PAGINA = Math.max(3, Math.floor(+process.argv[3]) || 12);
const TOPE = Math.min(5000, PAGINAS + 100);           // por encima de lo que hay: el recorrido no se corta por el tope
const SIN_AVANCE_MS = 180000;                         // si en tres minutos no sumó ninguna página, se colgó
const hora = () => new Date().toLocaleTimeString('es-AR', { hour12: false });
const mb = (bytes) => (bytes / 1048576).toFixed(1) + ' MB';
const duracion = (ms) => `${Math.floor(ms / 60000)} min ${Math.round(ms / 1000) % 60} s`;

(async () => {
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-galeria-larga-'));
  const catalogo = { paginas: PAGINAS, porPagina: POR_PAGINA };
  const sitio = await iniciar({ galeria: true, catalogo });
  const S = sitio.url, esperados = titulosDeCatalogo(catalogo);
  let programa = null;
  const fallas = [];
  const comprobar = (que, da, detalle = '') => { if (!da) fallas.push(que + (detalle ? ` (${detalle})` : '')); console.log(`${da ? 'OK   ' : 'FALLA'} ${que}${detalle ? ' → ' + detalle : ''}`); };
  try {
    fs.mkdirSync(path.join(datos, 'descargas'));
    fs.writeFileSync(path.join(datos, 'config.json'), JSON.stringify({ carpeta: path.join(datos, 'descargas') }));
    console.log(`== Una corrida larga de la galería · ${new Date().toLocaleString('es-AR', { hour12: false })}`);
    console.log(`  catálogo de prueba: ${PAGINAS} páginas de ${POR_PAGINA} títulos (${esperados.length}) · tope puesto en ${TOPE} páginas · ${process.env.EJECUTABLE ? 'contra ' + process.env.EJECUTABLE : 'programa de desarrollo'}, ${process.env.VENTANA ? 'con la ventana a la vista' : 'sin ventana'}`);

    // Abre el programa y deja a mano la ventana (v), su proceso principal y `medir()`. Lo que se mira
    // en el proceso principal: cuántas veces escribe galerias.json, cuántas ventanas tiene abiertas y la
    // memoria de cada proceso del programa (la del proceso de la ventana incluye su dibujo)
    const abrirPrograma = async () => {
      programa = abrir(datos, {}, ['--inspect=0']);
      const v = await conectar(await programa.ws);
      const principal = await conectarPrincipal(programa);
      await principal.en(`(() => { const fs = require('fs'), { app, BrowserWindow } = require('electron'), escribir = fs.writeFileSync; globalThis.__escrituras = 0;
        fs.writeFileSync = function (ruta, ...resto) { if (/galerias\\.json$/.test(String(ruta))) globalThis.__escrituras++; return escribir.call(this, ruta, ...resto); };
        globalThis.__estado = () => { const ui = BrowserWindow.getAllWindows().find(w => /index\\.html$/.test(w.webContents.getURL())), pid = ui.webContents.getOSProcessId(), m = app.getAppMetrics();
          const kb = (p) => (p && p.memory ? (p.memory.privateBytes || p.memory.workingSetSize) * 1024 : 0);
          return { ventanas: BrowserWindow.getAllWindows().length, escrituras: globalThis.__escrituras, ventana: kb(m.find(p => p.pid === pid)), principal: kb(m.find(p => p.type === 'Browser')), todo: m.reduce((n, p) => n + kb(p), 0) }; };
        return true; })()`);
      return { v, principal, medir: async () => ({ js: await v.memoria(), ...(await principal.en(`globalThis.__estado()`)) }) };
    };
    // Cierra el programa como con la X de la ventana (con el inspector conectado, el proceso espera a
    // que se desconecte para terminar de salir: se desconecta antes). Devuelve cuánto tardó, o -1 si no salió
    const cerrarPrograma = async ({ v, principal }) => {
      await principal.cerrar();
      const t = Date.now();
      await v.en(`window.close()`).catch(() => {});
      const salio = await Promise.race([programa.salio.then(() => true), dormir(15000).then(() => false)]);
      v.cerrar();
      return salio ? Date.now() - t : -1;
    };
    const decir = (m) => `ventana: ${mb(m.js)} de JavaScript, ${mb(m.ventana)} su proceso · programa entero: ${mb(m.todo)} · ventanas abiertas: ${m.ventanas}`;
    const p1 = await abrirPrograma(), { v, medir } = p1;

    await dormir(1500);                               // (que la ventana termine de acomodarse antes de medir)
    const alPrincipio = await medir();
    console.log(`[${hora()}] antes de empezar · ${decir(alPrincipio)}`);
    const t0 = Date.now();
    await v.en(`(() => { const t = document.querySelector('#galTope'); t.value = '${TOPE}'; t.dispatchEvent(new Event('change'));
      document.querySelector('#url').value = ${JSON.stringify(S + '/catalogo/')}; document.querySelector('#verTodo').click(); return true; })()`);

    // Mientras recorre: el avance cada 25 páginas, con la memoria
    const mira = `(() => ({ paginas: gal ? gal.paginas : 0, titulos: gal ? gal.titulos.length : 0, recorriendo: galRecorriendo, estado: document.querySelector('#galEstado').textContent, aviso: document.querySelector('#estado').textContent }))()`;
    let visto = { paginas: 0 }, ultimoAvance = Date.now(), dicha = 0, primera = null;
    const marcas = [];
    for (;;) {
      await dormir(1000);
      const a = await v.en(mira);
      if (a.paginas !== visto.paginas) ultimoAvance = Date.now();
      visto = a;
      if (a.paginas >= 1 && !primera) { primera = await medir(); console.log(`[${hora()}] página 1 · ${decir(primera)}`); }
      if (a.paginas >= dicha + 25 && a.recorriendo) {
        dicha = a.paginas - (a.paginas % 25);
        const m = await medir();
        marcas.push({ paginas: a.paginas, ...m });
        console.log(`[${hora()}] ${String(a.paginas).padStart(4)} páginas · ${String(a.titulos).padStart(5)} títulos · ${(a.paginas / ((Date.now() - t0) / 60000)).toFixed(1)} páginas por minuto · ${decir(m)}`);
      }
      if (!a.recorriendo && Date.now() - t0 > 3000) break;
      if (Date.now() - ultimoAvance > SIN_AVANCE_MS) throw new Error(`el recorrido no avanza desde hace ${SIN_AVANCE_MS / 1000} s (iba por la página ${a.paginas}: ${a.estado})`);
    }
    const tardo = Date.now() - t0;
    await dormir(1500);
    const alFinal = await medir();
    const g = await v.en(`gal ? { estado: gal.estado, motivo: gal.motivo, paginas: gal.paginas, sePuedeSeguir: gal.sePuedeSeguir, nombres: gal.titulos.map(t => t.nombre), urls: gal.titulos.map(t => t.url), aLaVista: document.querySelectorAll('#galLista .gal-tarjeta').length,
      conTapa: document.querySelectorAll('#galLista .gal-tapa img[src]').length, dice: document.querySelector('#galEstado').textContent } : null`);
    console.log(`[${hora()}] terminó · ${decir(alFinal)}`);
    console.log(`\n  tardó ${duracion(tardo)}: ${(PAGINAS / (tardo / 60000)).toFixed(1)} páginas por minuto (${(tardo / PAGINAS / 1000).toFixed(2)} s por página) · ${visto.estado || visto.aviso}`);

    if (!g) throw new Error('no quedó ninguna galería: ' + visto.aviso);
    comprobar('termina, y completa (sin llegar al tope y sin cortes)', g.estado === 'completa' && !g.motivo && g.paginas === PAGINAS && !g.sePuedeSeguir,
      `${g.estado}${g.motivo ? ' (' + g.motivo + ')' : ''} · ${g.paginas} páginas de ${PAGINAS} · tope ${TOPE}`);
    const iguales = g.nombres.length === esperados.length && g.nombres.every((n, i) => n === esperados[i]);
    comprobar('no repite ni pierde ningún título: son los del catálogo, en su orden', iguales && new Set(g.urls).size === esperados.length,
      `${g.nombres.length} títulos · ${new Set(g.urls).size} direcciones distintas · ${new Set(g.nombres).size} nombres distintos · esperados: ${esperados.length}` + (iguales ? '' : ` · el primero distinto: n.º ${g.nombres.findIndex((n, i) => n !== esperados[i]) + 1}`));
    const pedidas = sitio.pedidos.listados || [];
    comprobar('cada página del listado se pidió una sola vez, en orden', pedidas.length === PAGINAS && pedidas.every((p, i) => p === `catalogo ${i + 1}`),
      `${pedidas.length} pedidos de páginas del listado · ${new Set(pedidas).size} distintas`);
    // La memoria de la ventana es la de su proceso (lo que muestra el administrador de tareas): ahí
    // están su dibujo y su JavaScript. "Al principio" es antes de tocar "Ver todo el sitio", con la
    // ventana vacía. El JavaScript solo, medido después de juntar la basura, se dice aparte: arranca
    // en menos de 1 MB y lo que suma es el catálogo mismo (los títulos), así que con un catálogo de
    // miles pasa del doble sin que sobre nada; eso se mira más abajo, contra la misma galería recién abierta.
    const veces = (a, b) => (b ? (a / b).toFixed(2) : '?') + ' veces';
    comprobar('la memoria de la ventana (su proceso) al final no es más del doble que al principio', alFinal.ventana <= 2 * alPrincipio.ventana,
      `${mb(alPrincipio.ventana)} → ${mb(alFinal.ventana)} (${veces(alFinal.ventana, alPrincipio.ventana)})`);
    console.log(`           (de eso, el JavaScript de la ventana: ${mb(alPrincipio.js)} → ${mb(alFinal.js)}, ${veces(alFinal.js, alPrincipio.js)}: ${Math.round((alFinal.js - alPrincipio.js) / esperados.length)} bytes por título)`);
    console.log(`           (el programa entero: ${mb(alPrincipio.todo)} → ${mb(alFinal.todo)} · el proceso principal: ${mb(alPrincipio.principal)} → ${mb(alFinal.principal)} · tarjetas a la vista: ${g.aLaVista}, con su tapa ${g.conTapa})`);
    comprobar('no queda ninguna página abierta (solo la ventana del programa)', alFinal.ventanas === alPrincipio.ventanas, `ventanas: ${alPrincipio.ventanas} al principio, ${alFinal.ventanas} al final`);
    console.log(`           (galerias.json se escribió ${alFinal.escrituras} veces: cada 5 páginas y al terminar)`);

    // Cerrar el programa: lo guardado es eso mismo
    const msCierre = await cerrarPrograma(p1);
    let guardada = null;
    try { guardada = JSON.parse(fs.readFileSync(path.join(datos, 'galerias.json'), 'utf8'))[S]; } catch {}
    const distinto = guardada ? guardada.titulos.findIndex((t, i) => t.nombre !== esperados[i]) : -1;
    comprobar('al cerrar el programa, lo guardado en el disco es eso mismo', msCierre >= 0 && !!guardada && guardada.estado === 'completa' && guardada.titulos.length === esperados.length && distinto < 0,
      (msCierre >= 0 ? `el programa salió a los ${msCierre} ms` : 'el programa no salió en 15 s') + ' · ' + (guardada ? `${guardada.estado} · ${guardada.titulos.length} títulos · ${guardada.paginas} páginas · galerias.json: ${(fs.statSync(path.join(datos, 'galerias.json')).size / 1024).toFixed(0)} KB` +
        (distinto < 0 ? '' : ` · el primero distinto: n.º ${distinto + 1}`) : 'no hay galería guardada'));

    // ¿Lo que usa la ventana al final es por los títulos que tiene, o se fue juntando algo en el camino?
    // Se abre el programa de nuevo y se muestra esa misma galería, ya guardada, sin recorrer nada: lo
    // que usa así es lo que cuesta tenerla. Si el recorrido hubiera dejado algo de más, al final usaría
    // bastante más que esto.
    if (msCierre >= 0 && guardada) {
      const p2 = await abrirPrograma();
      await dormir(1500);
      await p2.v.en(`(async () => { document.querySelector('#url').value = ${JSON.stringify(S + '/catalogo/')}; await verTodoElSitio(); return true; })()`);
      for (const fin = Date.now() + 20000; Date.now() < fin; await dormir(300)) if (await p2.v.en(`!!gal && gal.titulos.length === ${esperados.length} && document.querySelectorAll('#galLista .gal-tarjeta').length > 0`)) break;
      await dormir(2500);                             // (las tapas de las tarjetas que quedan a la vista)
      const abierta = await p2.medir();
      console.log(`[${hora()}] la misma galería, abierta de nuevo desde el disco · ${decir(abierta)}`);
      comprobar('al final del recorrido la ventana no usa más de 1,25 veces lo que usa con esa misma galería recién abierta (no se fue juntando nada en el camino)', alFinal.js <= 1.25 * abierta.js && alFinal.ventana <= 1.25 * abierta.ventana,
        `JavaScript: ${mb(alFinal.js)} al final del recorrido, ${mb(abierta.js)} recién abierta (${veces(alFinal.js, abierta.js)}) · su proceso: ${mb(alFinal.ventana)} y ${mb(abierta.ventana)} (${veces(alFinal.ventana, abierta.ventana)})`);
      await cerrarPrograma(p2);
    }
    console.log(fallas.length ? `\n${fallas.length} FALLAS:\n  ${fallas.join('\n  ')}` : '\nTODO OK');
  } catch (e) {
    fallas.push('se cortó');
    console.log('FALLA: ' + (e.stack || e));
  } finally {
    try { programa?.p.kill(); } catch {}
    await sitio.cerrar();
    await dormir(1500);
    try { fs.rmSync(datos, { recursive: true, force: true }); } catch {}
  }
  process.exit(fallas.length ? 1 : 0);
})();
