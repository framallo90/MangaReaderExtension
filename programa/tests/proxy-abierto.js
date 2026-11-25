// MR_PROXY con el programa ya abierto (0.10.4), con dos programas de verdad: se abre sin el proxy,
// se abre otra vez con MR_PROXY, y la ventana que estaba abierta lo tiene que decir, con el botón
// para cerrar y abrir de nuevo con el proxy. Se toca ese botón y el programa que se vuelve a abrir
// tiene que pasar por el proxy.
//
// Los programas se abren con tests/ventana.js: carpeta de datos aparte (MR_DATOS) y la ventana leída y
// tocada por el protocolo de depuración de Chromium, como lo haría una persona. Muestra la ventana del
// programa en la pantalla mientras corre.
// Uso: npm run proxy-abierto
const fs = require('fs'), os = require('os'), path = require('path');
require('../scripts/generar.js');                 // (como scripts/abrir.js: generado/ con la última versión de la extensión)
const { iniciar } = require('./sitio');
const { iniciarProxy } = require('./proxy');
const { abrir, conectar, dormir } = require('./ventana');
const hora = () => new Date().toLocaleTimeString('es-AR', { hour12: false });

(async () => {
  let fallas = 0;
  const eq = (etiqueta, obtenido, esperado) => {
    if (obtenido !== esperado) fallas++;
    console.log((obtenido === esperado ? 'OK   ' : 'FALLA') + ` [${hora()}] ${etiqueta} → ${obtenido}` + (obtenido === esperado ? '' : '   (esperado: ' + esperado + ')'));
  };
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-proxy-abierto-'));
  const sitio = await iniciar();
  const proxy = await iniciarProxy({ sitio: sitio.url });
  console.log(`== MR_PROXY con el programa ya abierto · ${new Date().toLocaleString('es-AR', { hour12: false })} · Electron ${require('../node_modules/electron/package.json').version}`);
  const abiertos = [];
  try {
    // 1) Se abre sin el proxy
    const a = abrir(datos);
    abiertos.push(a);
    const va = await conectar(await a.ws);
    eq('se abre sin MR_PROXY: la ventana no dice nada del proxy', await va.en(`document.querySelector('#avisoProxy').hidden ? 'sin aviso' : 'con aviso'`), 'sin aviso');

    // 2) Se abre otra vez, con MR_PROXY: ese segundo programa se cierra solo (ya había uno abierto)
    const b = abrir(datos, { MR_PROXY: proxy.url });
    const codigoB = await Promise.race([b.salio, dormir(20000).then(() => 'sigue abierto')]);
    eq('se abre otra vez con MR_PROXY: el segundo se cierra enseguida (ya había uno abierto) y lo dice en la consola',
      `${codigoB === 'sigue abierto' ? 'sigue abierto' : 'se cerró'} · ${/ya está abierto/.test(b.salida()) ? 'lo dice' : 'no lo dice: ' + b.salida().trim().slice(0, 120)}`, 'se cerró · lo dice');

    // 3) La ventana que estaba abierta lo dice, con el botón
    let aviso = null;
    for (let i = 0; i < 50 && !aviso; i++) {
      aviso = await va.en(`(() => { const a = document.querySelector('#avisoProxy'); return a.hidden ? null : { texto: document.querySelector('#avisoProxyTexto').textContent, boton: document.querySelector('#reabrirProxy').textContent }; })()`);
      if (!aviso) await dormir(200);
    }
    eq('la ventana que estaba abierta lo dice: se pidió el proxy y ella no pasa por él, con el botón para cerrar y abrir de nuevo',
      aviso ? `${aviso.texto.includes(new URL(proxy.url).origin) ? 'nombra el proxy' : 'no nombra el proxy'} · ${/no pasa por ese proxy/.test(aviso.texto) ? 'dice que no pasa por él' : aviso.texto} · botón: ${aviso.boton}` : 'no apareció',
      'nombra el proxy · dice que no pasa por él · botón: Cerrar y abrir de nuevo con el proxy');

    // 4) El botón: el programa se cierra y se abre de nuevo, ahora con el proxy
    const puerto = path.join(datos, 'DevToolsActivePort');
    try { fs.rmSync(puerto, { force: true }); } catch {}
    await va.en(`document.querySelector('#reabrirProxy').click(), true`);
    const codigoA = await Promise.race([a.salio, dormir(15000).then(() => 'sigue abierto')]);
    let wsC = '';
    for (let i = 0; i < 100 && !wsC; i++) {
      try { const [p, ruta] = fs.readFileSync(puerto, 'utf8').trim().split(/\r?\n/); if (p && ruta) wsC = `ws://127.0.0.1:${p}${ruta}`; } catch {}
      if (!wsC) await dormir(200);
    }
    const antes = proxy.pedidos.length;
    let porElProxy = 'no se volvió a abrir';
    if (wsC) {
      const vc = await conectar(wsC);
      const r = await vc.en(`mr.analizar(${JSON.stringify(sitio.url + '/serie/alfa/')}).then(r => r.listas.length, e => 'error: ' + e.message)`);
      porElProxy = `${typeof r === 'number' ? 'analizó la página' : r} · pedidos que pasaron por el proxy: ${proxy.pedidos.length - antes > 0 ? 'sí' : 'ninguno'}`;
      await vc.en(`window.close(), true`).catch(() => {});
      vc.cerrar();
    }
    eq('al tocar el botón, el programa se cierra y se vuelve a abrir, y el nuevo pasa por el proxy',
      `${codigoA === 'sigue abierto' ? 'no se cerró' : 'se cerró'} · ${porElProxy}`, 'se cerró · analizó la página · pedidos que pasaron por el proxy: sí');
    va.cerrar();
  } catch (e) {
    fallas++;
    console.log('FALLA la prueba se cortó: ' + (e.stack || e));
  } finally {
    for (const x of abiertos) { try { x.p.kill(); } catch {} }
    await dormir(1500);
    await proxy.cerrar();
    await sitio.cerrar();
    try { fs.rmSync(datos, { recursive: true, force: true }); } catch {}
  }
  console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();
