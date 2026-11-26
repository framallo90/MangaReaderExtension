// El programa de verdad, abierto desde una prueba (0.10.4): lo usan tests/proxy-abierto.js,
// tests/proxy-real.js y las pruebas de la galería (galeria-grande.js, galeria-larga.js). Se abre con
// una carpeta de datos aparte (MR_DATOS: no toca los datos de verdad, no choca con un programa abierto
// y no toca el menú Inicio) y con el puerto de depuración de Chromium, y su ventana se lee y se toca
// por ese protocolo, como lo haría una persona.
const path = require('path');
const { spawn } = require('child_process');
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const ELECTRON = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const APP = path.join(__dirname, '..');

// Abre el programa con su carpeta de datos y el puerto de depuración. Devuelve el proceso, la
// dirección del protocolo de depuración (la que imprime Chromium al arrancar), cuándo salió y lo
// que escribió en la consola. La ventana no se muestra (MR_OCULTA), para no ponérsela en la pantalla
// a quien esté usando la máquina: se lee y se toca igual. Con VENTANA=1 se muestra.
// `argumentos`: otros para el programa (con '--inspect=0' se puede mirar además su proceso principal:
// ver conectarPrincipal). Con EJECUTABLE=<Manga Reader.exe> se abre ese (el instalado, o el de
// dist/win-unpacked) en vez del de desarrollo.
function abrir(datos, entorno = {}, argumentos = []) {
  const env = { ...process.env, MR_DATOS: datos, ...(process.env.VENTANA ? {} : { MR_OCULTA: '1' }), ...entorno };
  delete env.ELECTRON_RUN_AS_NODE;
  const otro = process.env.EJECUTABLE || '';
  const p = spawn(otro || ELECTRON, [...(otro ? [] : [APP]), '--remote-debugging-port=0', ...argumentos], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = '';
  p.stdout.on('data', d => { salida += d; });
  p.stderr.on('data', d => { salida += d; });
  const ws = new Promise((res) => {
    const mirar = setInterval(() => { const m = salida.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearInterval(mirar); res(m[1]); } }, 100);
    p.on('exit', () => { clearInterval(mirar); res(''); });
  });
  const salio = new Promise(res => p.on('exit', (codigo) => res(codigo)));
  return { p, ws, salio, salida: () => salida };
}

// Un canal del protocolo de depuración: `enviar(método, parámetros, sesión)` devuelve el resultado.
// Si el programa se cierra, lo que estaba esperando una respuesta falla en vez de quedar colgado.
async function canal(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('No me pude conectar al programa'))); });
  let n = 0;
  const esperando = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); const p = esperando.get(m.id); if (p) { esperando.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  ws.addEventListener('close', () => { for (const p of esperando.values()) p.rej(new Error('El programa se cerró')); esperando.clear(); });
  const enviar = (method, params = {}, sessionId) => new Promise((res, rej) => {
    if (ws.readyState !== 1) return rej(new Error('El programa se cerró'));
    const id = ++n; esperando.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  return { ws, enviar };
}
// Evalúa una expresión por un canal y devuelve su valor (esperando la promesa, si es una)
const evaluar = async (enviar, expr, sesion, extra = {}) => {
  const r = await enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, ...extra }, sesion);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

// Se conecta a la ventana del programa (la que carga ui/index.html) y devuelve `en(expresión)`, que
// la evalúa en la ventana y devuelve el resultado (esperando la promesa, si es una)
async function conectar(wsUrl) {
  const { ws, enviar } = await canal(wsUrl);
  let sesion = null;
  for (let i = 0; i < 100 && !sesion; i++) {
    const { targetInfos } = await enviar('Target.getTargets');
    const t = targetInfos.find(x => x.type === 'page' && /ui\/index\.html$/.test(x.url.replace(/\\/g, '/')));
    if (t) sesion = (await enviar('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
    else await dormir(200);
  }
  if (!sesion) throw new Error('No encontré la ventana del programa');
  const en = (expr) => evaluar(enviar, expr, sesion);
  // Hasta que la ventana terminó de cargar y tiene el puente con el programa (mr). Si la pregunta
  // llega mientras la página todavía se está cargando, se pierde ("Execution context was destroyed"):
  // se vuelve a hacer.
  for (let i = 0, lista = false; !lista; i++) {
    lista = await en(`document.readyState === 'complete' && !!window.mr`).catch((e) => { if (i > 150 || /se cerró/.test(e.message)) throw e; return false; });
    if (!lista) await dormir(100);
  }
  // Una captura de la ventana (PNG en base64). Una ventana oculta no dibuja y el pedido no vuelve
  // nunca (pasó el 25-11-2026: colgó la corrida 8 minutos): se espera hasta 8 s. Para capturar, VENTANA=1.
  const captura = () => Promise.race([enviar('Page.captureScreenshot', { format: 'png' }, sesion).then(r => r.data),
    dormir(8000).then(() => { throw new Error('la ventana no dibuja (está oculta: con VENTANA=1 se muestra)'); })]);
  // La memoria que usa el JavaScript de la ventana, en bytes, después de juntar la basura (sin eso
  // el número depende de cuándo pasó el recolector por última vez)
  const memoria = async () => {
    await enviar('HeapProfiler.collectGarbage', {}, sesion);
    return (await enviar('Runtime.getHeapUsage', {}, sesion)).usedSize;
  };
  return { en, captura, memoria, cerrar: () => ws.close() };
}

// El proceso principal del programa (no la ventana), por el inspector de Node: hay que haberlo
// abierto con abrir(datos, entorno, ['--inspect=0']). Devuelve `en(expresión)`, que la evalúa ahí
// con `require` a mano (solo mientras se evalúa: una función que quede para después tiene que
// tomar antes lo que necesite). Sirve para mirar desde una prueba lo que el programa hace con el
// disco. Ojo: mientras este canal esté conectado, el programa no termina de salir cuando se cierra
// ("Waiting for the debugger to disconnect..."); los avisos de salida corren igual. Para esperar a
// que salga: `await cerrar()` ANTES de cerrarlo (desconectar cuando ya está saliendo es una carrera:
// a veces el proceso ya no atiende la desconexión y queda esperando).
async function conectarPrincipal(programa) {
  let url = '';
  for (let i = 0; i < 150 && !url; i++) {
    const m = programa.salida().match(/Debugger listening on (ws:\/\/\S+)/);
    if (m) url = m[1]; else await dormir(100);
  }
  if (!url) throw new Error('El programa no abrió el inspector de su proceso principal (¿se abrió con --inspect=0?)');
  const { ws, enviar } = await canal(url);
  // (cerrar() se cumple cuando el canal quedó desconectado de verdad, o a los 3 s)
  const cerrar = () => Promise.race([new Promise((res) => { if (ws.readyState === 3) return res(); ws.addEventListener('close', () => res()); ws.close(); }), dormir(3000)]);
  return { en: (expr) => evaluar(enviar, expr, undefined, { includeCommandLineAPI: true }), cerrar };
}

module.exports = { abrir, conectar, conectarPrincipal, dormir, ELECTRON, APP };
