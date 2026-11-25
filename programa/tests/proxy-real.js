// Un capítulo de un sitio real a través del proxy de prueba, con el programa de verdad (0.10.4).
// Arranca tests/proxy.js con la regla que se le pase y abre el programa con MR_PROXY, como lo abriría
// una persona (así limpia la caché al arrancar y pide sin caché lo de ese sitio), con una carpeta de
// datos aparte. Baja el capítulo, dice cómo quedó y qué hay en la carpeta, toca "Reintentar lo que
// falló" si hace falta y lo dice otra vez. Al final muestra cada pedido que pasó por el proxy.
// No deja archivos: la carpeta de descargas y la de datos son temporales y se borran al terminar.
//
// Uso: node tests/proxy-real.js <dirección del capítulo> [argumentos de tests/proxy.js]
//   node tests/proxy-real.js https://one-piece-fans2.com/manga/es/todos/01 --codigo 503 --solo imagenes --desde 3 --veces 2
// El número del capítulo sale del final de la dirección. Muestra la ventana del programa mientras
// corre (no hay que tocarla: se maneja por el protocolo de depuración, con tests/ventana.js).
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
require('../scripts/generar.js');                 // (como scripts/abrir.js: generado/ con la última versión de la extensión)
const { abrir, conectar, dormir } = require('./ventana');

const fecha = () => new Date().toLocaleString('es-AR', { hour12: false });
const hora = () => new Date().toLocaleTimeString('es-AR', { hour12: false });
const TERMINADOS = ['listo', 'ya estaba', 'falló', 'incompleto', 'cancelado'];

(async () => {
  const [url, ...reglaArgs] = process.argv.slice(2);
  if (!url || !/^https?:\/\//.test(url)) { console.log('Uso: node tests/proxy-real.js <dirección del capítulo> [argumentos de tests/proxy.js]'); process.exit(1); }
  const sitio = new URL(url).origin;
  const numero = Number((new URL(url).pathname.match(/(\d+(?:\.\d+)?)\/?$/) || [])[1]);
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-real-datos-'));
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-real-'));
  // El proxy, como se lo correría a mano: escribe una línea por pedido
  const px = spawn(process.execPath, [path.join(__dirname, 'proxy.js'), '--sitio', sitio, ...reglaArgs], { stdio: ['ignore', 'pipe', 'pipe'] });
  let lineas = '';
  px.stdout.on('data', d => { lineas += d; });
  px.stderr.on('data', d => { lineas += d; });
  let proxy = '';
  for (let i = 0; i < 100 && !proxy; i++) { const m = lineas.match(/Proxy de prueba en (http:\/\/\S+)/); if (m) proxy = m[1]; else await dormir(100); }
  if (!proxy) { console.log('El proxy no arrancó:\n' + lineas); process.exit(1); }
  console.log(`== Un capítulo real a través del proxy · ${fecha()}`);
  console.log(`  capítulo: ${url} (número ${numero})`);
  console.log('  ' + lineas.split(/\r?\n/).filter(l => /^Proxy de prueba|^Regla|^Sin regla/.test(l)).join('\n  '));
  let programa = null, fallo = false;
  try {
    programa = abrir(datos, { MR_PROXY: proxy });
    const v = await conectar(await programa.ws);
    const delPrograma = programa.salida().split(/\r?\n/).filter(l => /proxy/i.test(l));
    console.log(`  programa: ${delPrograma.length ? delPrograma.join(' · ') : '(no dijo nada del proxy)'}`);
    // La cola, como la ve la ventana (null hasta el primer cambio después de pedir algo)
    await v.en(`window.__cola = null; mr.alCambiarCola(c => { window.__cola = c; }); true`);
    const esperarFin = async (ms) => {
      for (const fin = Date.now() + ms; Date.now() < fin; await dormir(500)) {
        const c = await v.en(`window.__cola`);
        if (c && c.length && c.every(t => TERMINADOS.includes(t.estado))) return c;
      }
      throw new Error('La cola no terminó a tiempo');
    };
    const contar = (c) => c.map(t => `${t.nombre || t.texto}: ${t.estado}${t.detalle ? ' (' + t.detalle + ')' : ''}`).join(' ; ');
    const archivos = () => {
      const l = [];
      const rec = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) rec(path.join(d, e.name), r); else l.push(`${r} (${fs.statSync(path.join(d, e.name)).size} bytes)`); } };
      rec(carpeta, '');
      return l.length ? l.join(' | ') : 'ningún archivo';
    };

    await v.en(`mr.descargar([{ url: ${JSON.stringify(url)}, texto: ${JSON.stringify('Capítulo ' + numero)}, numero: ${Number.isFinite(numero) ? numero : 'null'} }], { carpeta: ${JSON.stringify(carpeta)}, serie: 'Prueba', formatos: { pdf: true, cbz: false, imgs: false }, saltear: false })`);
    const r1 = await esperarFin(240000);
    console.log(`[${hora()}] 1.er intento: ${contar(r1)}`);
    console.log(`           en la carpeta: ${archivos()}`);
    if (r1.some(t => t.estado === 'falló' || t.estado === 'incompleto')) {
      await v.en(`window.__cola = null; mr.reintentar()`);
      const r2 = await esperarFin(300000);
      console.log(`[${hora()}] al reintentar: ${contar(r2)}`);
      console.log(`           en la carpeta: ${archivos()}`);
    }
    v.cerrar();
  } catch (e) {
    fallo = true;
    console.log('FALLA: ' + (e.stack || e));
  } finally {
    try { programa?.p.kill(); } catch {}
    await dormir(1000);
    try { px.kill(); } catch {}
    const pedidos = lineas.split(/\r?\n/).filter(l => /^#\d+ /.test(l));
    console.log(`\nPedidos que pasaron por el proxy (${pedidos.length}, ${pedidos.filter(l => /inyectado/.test(l)).length} inyectados):`);
    for (const l of pedidos) console.log('  ' + l);
    for (const d of [datos, carpeta]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
  }
  process.exit(fallo ? 1 : 0);
})();
