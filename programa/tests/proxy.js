// Proxy de prueba: se pone entre el programa (o una prueba) y un sitio, y cuando uno quiere
// contesta 429 o 503 de verdad, con Retry-After o sin él, sin que el pedido llegue al sitio.
// Todo lo demás lo reenvía al sitio tal cual y anota cada pedido: a qué hora llegó, qué pidió
// y qué se le contestó. En lo que es texto (páginas, estilos, scripts, JSON) y en las cabeceras
// (Location y las demás) cambia la dirección del sitio por la del proxy, para que el navegador
// siga pasando por acá.
//
// Uso: node programa/tests/proxy.js --sitio <origen> [--puerto N] [--codigo 503] [--retry-after 5]
//                                   [--desde 1] [--veces 1] [--ruta <regex>] [--solo paginas|imagenes]
//   node programa/tests/proxy.js --sitio https://one-piece-fans2.com
//        → solo reenvía y cuenta (sin --codigo no corta nada)
//   node programa/tests/proxy.js --sitio http://127.0.0.1:5555 --codigo 503 --retry-after 5 --desde 2 --veces 1
//        → el 2.º pedido contesta 503 con Retry-After: 5; los demás pasan
//   node programa/tests/proxy.js --sitio https://one-piece-fans2.com --codigo 429 --solo imagenes --desde 3
//        → de la 3.ª imagen en adelante, todas 429 sin Retry-After
//   --desde N         desde qué pedido corta, contando solo los que coinciden con --ruta y --solo
//   --veces N         cuántos seguidos corta (sin esto, todos desde ahí)
//   --ruta <regex>    solo los pedidos cuya ruta (con la consulta) coincide
//   --solo imagenes   solo los que piden una imagen: Accept que empieza con image/, o ruta .jpg, .png…
//   --solo paginas    solo los que piden HTML: Accept con text/html
// Escribe una línea por pedido ("#3 20:31:05.123 503 GET /img/1.jpg ← inyectado"). Ctrl+C lo cierra.
// Hay que entrar por la dirección que dice al arrancar (127.0.0.1, no localhost).
//
// El programa lo usa con MR_PROXY=<dirección del proxy> (o --proxy=<dirección>): pregunta en
// /__proxy a qué sitio reenvía y le manda por acá todo lo de ese sitio. /__proxy no se reenvía ni
// cuenta como pedido: contesta { sitio, pedidos, inyectados }.
//
// Desde una prueba:
//   const { iniciarProxy } = require('./proxy');
//   const proxy = await iniciarProxy({ sitio: sitio.url, reglas: [{ codigo: 503, retryAfter: '3', desde: 2, veces: 1 }] });
//   … abrir proxy.url + '/leer/alfa-1/' …
//   proxy.pedidos            → [{ n, hora, metodo, ruta, accept, codigo, inyectado, regla, ms }]
//   proxy.fijarReglas([…])   cambia las reglas y pone sus cuentas en cero
//   await proxy.cerrar()
// Una regla: { codigo, retryAfter (texto, o null: sin cabecera), desde (1), veces (Infinity),
//   ruta y accept (RegExp, o un texto que tiene que estar adentro), solo ('imagenes' | 'paginas') }.
// Cada regla cuenta los pedidos que pasan sus filtros, aunque los corte otra; contesta la primera
// que esté en su tramo.
const http = require('http'), https = require('https'), zlib = require('zlib');

const USO = 'Uso: node programa/tests/proxy.js --sitio <origen> [--puerto N] [--codigo 503] [--retry-after 5] [--desde 1] [--veces 1] [--ruta <regex>] [--solo paginas|imagenes]';

// Cabeceras de un solo tramo (cliente → proxy o proxy → sitio): cada lado pone las suyas.
// Las que nombra Connection también son de ese tramo.
const DE_TRAMO = new Set(['connection', 'keep-alive', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const nombradasEn = (connection) => new Set(String(connection || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean));
const deTramo = (k, nombradas) => DE_TRAMO.has(k) || k.startsWith('proxy-') || nombradas.has(k);

// Lo que se lee entero para cambiar direcciones; lo demás pasa byte a byte. text/event-stream no
// está a propósito: es un flujo que no termina y no se puede juntar entero.
const TEXTO_RE = /^\s*(?:text\/(?:html|css|javascript|xml)|application\/(?:x-)?javascript|application\/(?:[\w.-]+\+)?(?:json|xml)|image\/svg\+xml)\s*(?:;|$)/i;
const IMAGEN_RE = /\.(?:jpe?g|png|gif|webp|avif|bmp|svg|ico|jxl|tiff?|heic)$/i;

const sinTildes = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const html = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Los filtros se suman (tienen que dar todos): así una regla apunta, por ejemplo, solo a las
// imágenes de una carpeta
function coincide(regla, { ruta = '/', accept = '' } = {}) {
  const da = (filtro, texto) => filtro == null ? true
    // (lastIndex: una RegExp con /g recuerda dónde quedó y la vez siguiente daría otra cosa)
    : filtro instanceof RegExp ? (filtro.lastIndex = 0, filtro.test(texto))
    : texto.includes(String(filtro));
  if (!da(regla.ruta, ruta) || !da(regla.accept, accept)) return false;
  const solo = regla.solo == null ? null : sinTildes(regla.solo);
  // (la navegación también acepta image/avif, pero no empieza con image/)
  if (solo === 'imagenes') return /^\s*image\//i.test(accept) || IMAGEN_RE.test(ruta.split('?')[0]);
  if (solo === 'paginas') return /text\/html/i.test(accept);
  return true;
}

// Del `desde` en adelante, `veces` seguidos (contando solo los pedidos que miró la regla): alcanza
// para "el 2.º falla una vez" y para "del 3.º en adelante, todos"
function corta(regla, n) {
  const desde = Number(regla.desde ?? 1), veces = regla.veces == null ? Infinity : Number(regla.veces);
  return n >= desde && n < desde + veces;
}

// Una regla mal escrita se avisa al fijarla: en medio de un pedido tumbaría la respuesta
function revisarRegla(r, i) {
  if (!r || typeof r !== 'object') throw new Error(`reglas[${i}] no es un objeto`);
  const codigo = Number(r.codigo);
  if (!Number.isInteger(codigo) || codigo < 100 || codigo > 599) throw new Error(`reglas[${i}]: codigo tiene que ser un estado HTTP como 429 o 503 (vino ${r.codigo})`);
  if (r.desde != null && !Number.isFinite(Number(r.desde))) throw new Error(`reglas[${i}]: desde tiene que ser un número (vino ${r.desde})`);
  if (r.veces != null && !(Number(r.veces) >= 0)) throw new Error(`reglas[${i}]: veces tiene que ser un número desde 0 (vino ${r.veces})`);
  const solo = r.solo == null ? null : sinTildes(r.solo);
  if (solo !== null && solo !== 'imagenes' && solo !== 'paginas') throw new Error(`reglas[${i}]: solo es 'imagenes' o 'paginas' (vino ${r.solo})`);
  const retryAfter = r.retryAfter == null ? null : String(r.retryAfter);
  try { if (retryAfter !== null) http.validateHeaderValue('retry-after', retryAfter); } catch { throw new Error(`reglas[${i}]: retryAfter tiene caracteres que no van en una cabecera`); }
  return { ...r, codigo, retryAfter, solo };
}

// Cambia las direcciones del sitio por la del proxy: https://sitio, http://sitio, //sitio y también
// escritas como en un JSON (https:\/\/sitio). No toca otro puerto, un nombre que solo empieza igual
// (sitio.com.ar) ni ws://sitio: no pasan por acá.
function reescritor(sitio, proxy) {
  const u = new URL(sitio);
  const puertoDeSiempre = u.port ? '' : '(?::(?:80|443))?';
  const re = new RegExp(String.raw`(?:\b(?:https?):|(?<![\w+.:-]))(\\?\/\\?\/)` + escRe(u.host) + puertoDeSiempre + String.raw`(?![\w-]|\.[\w-]|:\d)`, 'gi');
  const escapada = proxy.replace(/\//g, '\\/');
  return (texto) => texto.replace(re, (_, barras) => (barras.includes('\\') ? escapada : proxy));
}

// Para Referer y Origin, al revés: el sitio tiene que ver su propia dirección, no la del proxy
function haciaSitio(v, proxy, sitio) {
  if (!v.startsWith(proxy)) return v;
  const resto = v.slice(proxy.length);
  return resto === '' || /^[/?#]/.test(resto) ? sitio + resto : v;
}

// El navegador no guarda para http://127.0.0.1 una cookie con el Domain del sitio o con Secure (y
// SameSite=None sin Secure la rechaza): sin eso, un sitio que necesita su cookie no anda por acá
const cookieLocal = (c) => String(c).replace(/;\s*domain=[^;]*/gi, '').replace(/;\s*secure\s*(?=;|$)/gi, '').replace(/;\s*samesite=none\s*(?=;|$)/gi, '; SameSite=Lax');

// Por si el sitio comprime aunque se le pidió identity: comprimido no se pueden cambiar las direcciones
const ABRIR = new Map([['gzip', zlib.gunzip], ['x-gzip', zlib.gunzip], ['deflate', zlib.unzip], ['br', zlib.brotliDecompress]]);
function abrir(buf, codificacion) {
  const c = String(codificacion || 'identity').trim().toLowerCase();
  if (c === 'identity') return Promise.resolve(buf);
  const f = ABRIR.get(c);
  return new Promise((listo) => (f ? f(buf, (e, r) => listo(e ? null : r)) : listo(null)));
}

// Si alguien usa el proxy como proxy común ("GET http://otro/x"), igual va al sitio: nunca a otro lado
function rutaDe(u) {
  if (u.startsWith('/') || u === '*') return u;
  try { const x = new URL(u); return x.pathname + x.search; } catch { return '/'; }
}

// La falla la contesta el proxy, sin preguntarle al sitio. CORS abierto y Retry-After expuesto,
// para que también la lea un fetch desde otro origen (sin eso vería un error de red, no el 503)
function contestarFalla(res, regla, i, cuenta) {
  const cuerpo = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${regla.codigo} · falla inyectada</title></head>` +
    `<body><h1>HTTP ${regla.codigo}</h1><p>Falla inyectada por el proxy de prueba (reglas[${i}], pedido ${cuenta} de los que coinciden con ella): el pedido no llegó al sitio.</p>` +
    (regla.retryAfter !== null ? `<p>Retry-After: ${html(regla.retryAfter)}</p>` : '') + '</body></html>';
  const cab = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(cuerpo),
    'access-control-allow-origin': '*', 'access-control-expose-headers': 'Retry-After' };
  if (regla.retryAfter !== null) cab['retry-after'] = regla.retryAfter;
  res.writeHead(regla.codigo, cab);
  res.end(cuerpo);
}

async function iniciarProxy({ sitio, puerto = 0, reglas = [], tiempoLimite = 30000, alTerminar = null } = {}) {
  let base;
  try { base = new URL(sitio); } catch { throw new Error(`sitio tiene que ser una dirección como https://sitio.com (vino ${sitio})`); }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') throw new Error(`sitio tiene que ser http:// o https:// (vino ${sitio})`);
  const origen = base.origin, cliente = base.protocol === 'https:' ? https : http;
  let activas = [], cuentas = [];
  const fijarReglas = (nuevas) => {
    const lista = (nuevas == null ? [] : [].concat(nuevas)).map(revisarRegla);   // si una está mal, quedan las de antes
    activas = lista;
    cuentas = lista.map(() => 0);
  };
  fijarReglas(reglas);
  // Agente propio: así cerrar() también corta las conexiones con el sitio
  const agente = new cliente.Agent({ keepAlive: true });
  const pedidos = [];
  let total = 0, proxy = '', aProxy = (t) => t;

  // Si el sitio no contesta (caído, un nombre que no existe, se colgó): 502 con el motivo, para que
  // una prueba no lo confunda con una falla inyectada
  function fallaDelSitio(res, e, registro) {
    if (res.writableEnded || res.destroyed) return;
    if (res.headersSent) return res.destroy();          // ya se estaba mandando: cortar es lo que vería el cliente
    const { code, message = 'sin detalle' } = e || {};
    const motivo = code && !String(message).includes(code) ? `${code}: ${message}` : String(message);
    registro.error = motivo;
    const cuerpo = `502: el proxy de prueba no pudo hablar con ${origen} (${motivo})\n`;
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(cuerpo), 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
    res.end(cuerpo);
  }

  function cabecera(res, r, cab, registro) {
    if (res.destroyed) return false;
    try { res.writeHead(r.statusCode, r.statusMessage || http.STATUS_CODES[r.statusCode] || '', cab); return true; }
    catch (e) { fallaDelSitio(res, e, registro); return false; }
  }

  function responder(req, res, r, registro) {
    const nombradas = nombradasEn(r.headers.connection), cab = {};
    for (const [k, v] of Object.entries(r.headers)) {
      if (deTramo(k, nombradas)) continue;
      cab[k] = k === 'set-cookie' ? [].concat(v).map(cookieLocal) : Array.isArray(v) ? v.map(aProxy) : aProxy(v);
    }
    cab['access-control-allow-origin'] = '*';
    r.on('error', (e) => fallaDelSitio(res, e, registro));
    r.on('close', () => { if (!r.complete) fallaDelSitio(res, new Error('el sitio cortó la respuesta a la mitad'), registro); });
    // (sin cuerpo no hay nada que cambiar; un 206 es un pedazo y cambiarle el largo rompe su Content-Range)
    const talCual = req.method === 'HEAD' || [204, 206, 304].includes(r.statusCode) || r.statusCode < 200;
    if (talCual || !TEXTO_RE.test(cab['content-type'] || '')) {
      if (cabecera(res, r, cab, registro)) r.pipe(res); else r.resume();
      return;
    }
    const partes = [];
    r.on('data', (c) => partes.push(c));
    r.on('end', async () => {
      const crudo = Buffer.concat(partes), abierto = await abrir(crudo, cab['content-encoding']);
      if (!abierto) { if (cabecera(res, r, cab, registro)) res.end(crudo); return; }   // no se pudo abrir: va como vino
      // latin1 lee cada byte como un carácter: todo lo que no es una dirección queda igual, sea UTF-8 o no
      const cuerpo = Buffer.from(aProxy(abierto.toString('latin1')), 'latin1');
      delete cab['content-encoding'];
      cab['content-length'] = String(cuerpo.length);
      if (cabecera(res, r, cab, registro)) res.end(cuerpo);
    });
  }

  function reenviar(req, res, ruta, registro) {
    const nombradas = nombradasEn(req.headers.connection), cab = {};
    for (const [k, v] of Object.entries(req.headers)) if (!deTramo(k, nombradas)) cab[k] = v;
    cab.host = base.host;
    cab['accept-encoding'] = 'identity';              // sin comprimir, para poder cambiar las direcciones
    for (const k of ['referer', 'origin']) if (typeof cab[k] === 'string') cab[k] = haciaSitio(cab[k], proxy, origen);
    let sub;
    try {
      sub = cliente.request({ hostname: base.hostname.replace(/^\[|\]$/g, ''), port: base.port || undefined, method: req.method, path: ruta, headers: cab, agent: agente, timeout: tiempoLimite });
    } catch (e) { req.resume(); return fallaDelSitio(res, e, registro); }
    sub.on('timeout', () => sub.destroy(Object.assign(new Error(`el sitio no contestó en ${tiempoLimite / 1000} s`), { code: 'ETIMEDOUT' })));
    sub.on('error', (e) => fallaDelSitio(res, e, registro));
    sub.on('response', (r) => responder(req, res, r, registro));
    res.on('close', () => { if (!res.writableFinished) sub.destroy(); });   // el cliente se fue: no seguir bajando
    req.pipe(sub);
  }

  const srv = http.createServer((req, res) => {
    if (req.method === 'GET' && rutaDe(req.url) === '/__proxy') {
      const cuerpo = JSON.stringify({ sitio: origen, pedidos: pedidos.length, inyectados: pedidos.filter(p => p.inyectado).length });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(cuerpo) });
      return res.end(cuerpo);
    }
    const hora = Date.now(), n = ++total, ruta = rutaDe(req.url), accept = String(req.headers.accept || '');
    let regla = null;
    activas.forEach((r, i) => {
      if (!coincide(r, { ruta, accept })) return;
      cuentas[i]++;
      if (regla === null && corta(r, cuentas[i])) regla = i;
    });
    const registro = { n, hora, metodo: req.method, ruta, accept, codigo: 0, inyectado: regla !== null, regla, ms: 0 };
    let anotado = false;
    const anotar = () => {
      if (anotado) return;
      anotado = true;
      registro.codigo = res.headersSent ? res.statusCode : 0;     // 0: el cliente cortó antes de recibir algo
      registro.ms = Date.now() - hora;
      pedidos.push(registro);
      if (alTerminar) try { alTerminar(registro); } catch { /* lo que haga quien mira no tumba el proxy */ }
    };
    res.on('finish', anotar);
    res.on('close', anotar);
    if (regla !== null) {
      req.resume();          // el cuerpo no va a ningún lado, pero hay que leerlo para que la conexión siga sirviendo
      return contestarFalla(res, activas[regla], regla, cuentas[regla]);
    }
    reenviar(req, res, ruta, registro);
  });

  try {
    await new Promise((listo, fallo) => { srv.once('error', fallo); srv.listen(puerto, '127.0.0.1', () => { srv.off('error', fallo); listo(); }); });
  } catch (e) { agente.destroy(); throw e; }
  proxy = `http://127.0.0.1:${srv.address().port}`;
  aProxy = reescritor(origen, proxy);
  let cierre = null;
  return {
    url: proxy, sitio: origen, pedidos, fijarReglas,
    // (closeAllConnections: una conexión que el navegador dejó abierta sin usar haría esperar para siempre)
    cerrar: () => cierre || (cierre = new Promise((listo) => { srv.close(() => listo()); srv.closeAllConnections(); agente.destroy(); })),
  };
}

module.exports = { iniciarProxy, corta, coincide, reescritor };

// ── Línea de comandos ──

function leerArgs(args) {
  const op = {}, CONOCIDAS = ['sitio', 'puerto', 'codigo', 'retry-after', 'desde', 'veces', 'ruta', 'solo'];
  for (let i = 0; i < args.length; i++) {
    const m = /^--([\w-]+)(?:=([\s\S]*))?$/.exec(args[i]);
    if (!m) throw new Error(`No entiendo "${args[i]}".`);
    if (m[1] === 'ayuda' || m[1] === 'help') { op.ayuda = true; continue; }
    if (!CONOCIDAS.includes(m[1])) throw new Error(`No conozco la opción --${m[1]}.`);
    const v = m[2] ?? args[++i];
    if (v === undefined) throw new Error(`A --${m[1]} le falta el valor.`);
    op[m[1]] = v;
  }
  return op;
}

function reglaDeArgs(op) {
  if (op.codigo == null) return null;
  const entero = (k, min, max = Infinity) => {
    const n = Number(op[k]);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`--${k} tiene que ser un número entero ${max < Infinity ? `de ${min} a ${max}` : `desde ${min}`} (vino ${op[k]}).`);
    return n;
  };
  const regla = { codigo: entero('codigo', 100, 599), retryAfter: op['retry-after'] ?? null };
  if (op.desde != null) regla.desde = entero('desde', 1);
  if (op.veces != null) regla.veces = entero('veces', 0);
  if (op.ruta != null) { try { regla.ruta = new RegExp(op.ruta); } catch (e) { throw new Error(`--ruta no es una expresión regular: ${e.message}`); } }
  if (op.solo != null) {
    regla.solo = sinTildes(op.solo);
    if (regla.solo !== 'imagenes' && regla.solo !== 'paginas') throw new Error(`--solo es imagenes o paginas (vino ${op.solo}).`);
  }
  return revisarRegla(regla, 0);
}

function describir(r) {
  const desde = r.desde ?? 1, veces = r.veces ?? Infinity;
  const partes = [`${r.codigo} ${r.retryAfter !== null ? `con Retry-After: ${r.retryAfter}` : 'sin Retry-After'}`,
    veces === Infinity ? `desde el pedido ${desde} en adelante` : `${veces} ${veces === 1 ? 'vez' : 'veces'} desde el pedido ${desde}`];
  if (r.solo) partes.push(r.solo === 'imagenes' ? 'solo imágenes' : 'solo páginas');
  if (r.ruta != null) partes.push(`ruta ${r.ruta}`);
  return partes.join(' · ') + (r.solo || r.ruta != null ? ' (cuenta solo los pedidos que coinciden)' : '');
}

const reloj = (t) => {
  const d = new Date(t), p = (x, n = 2) => String(x).padStart(n, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};
const linea = (p) => `#${p.n} ${reloj(p.hora)} ${p.codigo || '---'} ${p.metodo} ${p.ruta}` +
  (p.inyectado ? ' ← inyectado' : p.error ? ` ← sin respuesta del sitio: ${p.error}` : p.codigo ? '' : ' ← el cliente cortó');

// (con exitCode y no process.exit: si la salida va a otro programa, exit puede cortar lo que falta escribir)
function principal() {
  let op, regla, puerto;
  try {
    op = leerArgs(process.argv.slice(2));
    if (op.ayuda) return console.log(USO);
    if (!op.sitio) throw new Error('Falta --sitio.');
    regla = reglaDeArgs(op);
    puerto = op.puerto == null ? 0 : Number(op.puerto);
    if (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535) throw new Error(`--puerto tiene que ser un número de 0 a 65535 (vino ${op.puerto}).`);
  } catch (e) {
    console.log(`${e.message}\n${USO}`);
    process.exitCode = 1;
    return;
  }
  iniciarProxy({ sitio: op.sitio, puerto, reglas: regla ? [regla] : [], alTerminar: (p) => console.log(linea(p)) }).then((proxy) => {
    console.log(`Proxy de prueba en ${proxy.url} → ${proxy.sitio}`);
    console.log(regla ? `Regla: ${describir(regla)}` : 'Sin regla: solo reenvía y cuenta (para cortar: --codigo 503 o --codigo 429).');
    const sueltas = ['retry-after', 'desde', 'veces', 'ruta', 'solo'].filter(k => op[k] != null);
    if (!regla && sueltas.length) console.log(`(sin --codigo, ${sueltas.map(k => '--' + k).join(', ')} ${sueltas.length === 1 ? 'no hace' : 'no hacen'} nada)`);
    const pedido = new URL(op.sitio);
    if (pedido.pathname + pedido.search !== '/') console.log(`Abrí: ${proxy.url}${pedido.pathname}${pedido.search}`);
    console.log(`Para el programa: MR_PROXY=${proxy.url} npm start (lo de ${proxy.sitio} pasa por acá)`);
    let saliendo = false;
    const salir = () => {
      if (saliendo) process.exit(1);                    // el segundo Ctrl+C no espera
      saliendo = true;
      proxy.cerrar().then(() => {
        const inyectados = proxy.pedidos.filter(p => p.inyectado).length;
        process.stdout.write(`\n${proxy.pedidos.length} pedidos, ${inyectados} inyectados.\n`, () => process.exit(0));
      });
    };
    process.on('SIGINT', salir);
    process.on('SIGTERM', salir);
  }).catch((e) => {
    console.log(`No arrancó: ${e.message}`);
    process.exitCode = 1;
  });
}

if (require.main === module) principal();
