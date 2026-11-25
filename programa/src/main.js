/**
 * Manga Reader — programa de escritorio
 * Explora una página (títulos → capítulos → páginas) y guarda capítulos como PDF, CBZ o
 * imágenes en la carpeta que se elija. Todo corre en esta máquina: no hay servidor.
 *
 * - Las páginas web se abren en ventanas ocultas y aisladas (sin acceso a Node). Ahí corre
 *   generado/pagina.js: las funciones de la extensión más el explorador.
 * - Los archivos los arma una ventana oculta propia ("armador") con el mismo código que
 *   usa la extensión (generado/offscreen.js), y este proceso los escribe en el disco.
 */
const { app, BrowserWindow, ipcMain, dialog, session, shell, Menu, nativeImage, Notification } = require('electron');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const nucleo = require('../generado/nucleo.js');
const sitios = require('../generado/sitios.js');     // leer una lista de links pegada, igual que la extensión
const { parseSagas, missingRanges, rangesText } = require('../generado/opciones.js');   // sagas escritas como texto, y lo que falta
const { frenoDe } = require('./freno.js');           // cuánto no pedirle nada a un sitio que pidió esperar: la regla de la extensión

const PARTICION = 'persist:paginas';          // sesión de las páginas web: cookies aparte de las del programa
const PRUEBA = process.argv.includes('--prueba');
// "--prueba --avisos": en vez de las pruebas de siempre, la del aviso de Windows con sus botones,
// apretados de verdad (tests/avisos.js). Muestra avisos en la pantalla.
const AVISOS = PRUEBA && process.argv.includes('--avisos');
// "--humo": arranque de prueba, sobre todo para el programa ya empaquetado. Abre la interfaz y el
// armador sin mostrarlos, dice si anduvo y sale. No toca la configuración ni los favoritos.
const HUMO = process.argv.includes('--humo');
const espera = (ms) => new Promise(r => setTimeout(r, ms));
// "--pruebas=<carpeta>" (0.10.4): con --prueba, toma las pruebas de esa carpeta y no de las que vienen
// con el programa. Sirve para correr "npm run avisos" sobre el programa instalado, que no trae tests/.
const DIR_PRUEBAS = PRUEBA ? (process.argv.find(a => a.startsWith('--pruebas=')) || '').slice('--pruebas='.length) : '';
// Los datos (configuración y favoritos) van siempre a la misma carpeta, se abra el programa
// con "npm start" o instalado: si no, al instalarlo arrancaría sin los favoritos. MR_DATOS (solo
// para pruebas, 0.10.4) usa otra: así se pueden abrir dos veces sin tocar los datos de verdad.
app.setPath('userData', process.env.MR_DATOS || path.join(app.getPath('appData'), 'manga-reader-programa'));
const AUMID = 'ar.mangareader.programa';
app.setAppUserModelId(AUMID);     // para que Windows muestre los avisos con el nombre del programa

// ── Configuración ────────────────────────────────────
// plantilla: la plantilla de nombres ('' = la de siempre) · sagasTexto: las sagas propias, como
// se escriben · recientes: las últimas direcciones analizadas a mano · tapas: lista en mosaico ·
// bibliotecas: las carpetas de tu colección, donde también se mira lo que ya tenés
let config = { carpeta: '', formatos: { pdf: true, cbz: false, imgs: false }, saltear: true, tapas: true,
               plantilla: '', sagasTexto: '', recientes: [], bibliotecas: [],
               // vinculos: carpetas que el usuario ató a una serie ({ clave de la serie: [carpetas] }), para
               // cuando se llaman distinto · seguidas: las series que sigue ([{ url, serie }])
               vinculos: {}, seguidas: [] };
const archivoConfig = () => path.join(app.getPath('userData'), 'config.json');
function leerConfig() {
  if (!PRUEBA) { try { config = { ...config, ...JSON.parse(fs.readFileSync(archivoConfig(), 'utf8')) }; } catch {} }      // las pruebas arrancan con todo de fábrica
  if (!config.carpeta) config.carpeta = path.join(app.getPath('downloads'), 'MangaReader');
  if (!Array.isArray(config.recientes)) config.recientes = [];
  if (!Array.isArray(config.bibliotecas)) config.bibliotecas = [];
  if (!config.vinculos || typeof config.vinculos !== 'object' || Array.isArray(config.vinculos)) config.vinculos = {};
  if (!Array.isArray(config.seguidas)) config.seguidas = [];
  aplicarNombres();
}
// Pasa al núcleo (el que arma los nombres) la plantilla y las sagas guardadas
function aplicarNombres() {
  nucleo.setEsquema(config.plantilla);
  nucleo.setSagas(parseSagas(String(config.sagasTexto || '')).table);
}
function guardarConfig(c) {
  config = { ...config, ...c, formatos: { ...config.formatos, ...(c.formatos || {}) } };
  if ('plantilla' in c || 'sagasTexto' in c) aplicarNombres();
  if ('bibliotecas' in c) indices.clear();          // cambió dónde mirar: lo recordado ya no vale
  if (!PRUEBA) { try { fs.writeFileSync(archivoConfig(), JSON.stringify(config, null, 2)); } catch {} }
  return config;
}

// ── Favoritos (los links guardados) ──────────────────
// La lista de direcciones del usuario (sitios, catálogos, series), para no tener que pegarlas
// cada vez. Se carga como "Mis sitios" en la extensión: de a una, o pegando una lista entera.
let guardados = [];          // [{nombre, url, descripcion, tipo, idiomas}]
const archivoGuardados = () => path.join(app.getPath('userData'), 'links.json');
function leerGuardados() {
  try {
    const l = JSON.parse(fs.readFileSync(archivoGuardados(), 'utf8'));
    if (Array.isArray(l)) guardados = l.filter(s => s && typeof s.url === 'string' && typeof s.nombre === 'string');
  } catch {}
}
function escribirGuardados() {
  if (!PRUEBA) { try { fs.writeFileSync(archivoGuardados(), JSON.stringify(guardados, null, 2)); } catch {} }
}
// Para saber si dos direcciones son la misma: sin "www.", sin barra final y sin el #. A
// diferencia de la de la extensión, cuenta el puerto (dos sitios en la misma máquina son dos).
const claveDe = (u) => {
  try { const x = new URL(u); return (x.host.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase(); }
  catch { return String(u || '').toLowerCase(); }
};
const nombreDeUrl = (url) => { try { return new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : 'https://' + url).hostname.replace(/^www\./, ''); } catch { return ''; } };

// Suma links a la lista. `sitio` es uno solo ({nombre, url}); `texto`, una lista pegada como
// venga (la lee leerLista, de la extensión) o el archivo que exporta la extensión (.json).
// Los que ya estaban no se repiten. Devuelve { lista, agregados, repetidos }.
function guardarLinks({ texto, sitio } = {}) {
  let leidos = [], repetidos = 0;
  if (sitio) {
    const r = sitios.normalizarSitio({ ...sitio, nombre: String(sitio.nombre || '').trim() || nombreDeUrl(sitio.url) });
    if (!r.ok) throw new Error(r.error);
    leidos = [r.sitio];
  } else {
    let json = null;
    try { json = JSON.parse(texto); } catch {}
    const exportados = Array.isArray(json) ? json : Array.isArray(json?.misSitios) ? json.misSitios : null;
    if (exportados) leidos = exportados.map(s => sitios.normalizarSitio(s)).filter(r => r.ok).map(r => r.sitio);
    else ({ sitios: leidos, repetidos } = sitios.leerLista(texto));
    if (!leidos.length) throw new Error('No encontré ningún link en lo que pegaste.');
  }
  const tengo = new Set(guardados.map(s => claveDe(s.url)));
  let agregados = 0;
  for (const s of leidos) {
    const clave = claveDe(s.url);
    if (tengo.has(clave)) { repetidos++; continue; }
    tengo.add(clave);
    guardados.push({ nombre: s.nombre, url: s.url, descripcion: s.descripcion || '', tipo: s.tipo || 'mixto', idiomas: s.idiomas || [] });
    agregados++;
  }
  if (agregados) escribirGuardados();
  return { lista: guardados, agregados, repetidos };
}
// Quita de la lista las direcciones que se pasen, o todas con 'todos'
function quitarLinks(urls) {
  const fuera = urls === 'todos' ? null : new Set((Array.isArray(urls) ? urls : [urls]).map(u => claveDe(u)));
  guardados = fuera ? guardados.filter(s => !fuera.has(claveDe(s.url))) : [];
  escribirGuardados();
  return guardados;
}

// ── Sesión de las páginas web ────────────────────────
let armador = null, refererActual = '';
function prepararSesion() {
  const ses = session.fromPartition(PARTICION);
  ses.setPermissionRequestHandler((_wc, _permiso, cb) => cb(false));       // ni cámara, ni avisos, ni ubicación
  ses.on('will-download', (e) => e.preventDefault());                       // una página no puede bajar nada por su cuenta
  // Al bajar las imágenes se manda el Referer que mandaría el navegador desde el capítulo:
  // hay servidores de imágenes que sin eso contestan 403.
  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    if (armador && !armador.isDestroyed() && d.webContentsId === armador.webContents.id && refererActual && /^https?:/i.test(d.url)) {
      try {
        const pagina = new URL(refererActual);
        d.requestHeaders.Referer = new URL(d.url).origin === pagina.origin ? pagina.href : pagina.origin + '/';
      } catch {}
    }
    // Con el proxy de prueba en uso, lo de ese sitio se pide sin caché (0.10.4): si no, el armador
    // toma de la caché las imágenes que la página ya bajó, y el proxy no las puede cortar. Sin el
    // proxy no se toca nada: las imágenes se pueden cachear como siempre.
    if (proxyActual && d.url.startsWith(proxyActual.proxy + '/')) {
      d.requestHeaders['Cache-Control'] = 'no-cache';
      d.requestHeaders.Pragma = 'no-cache';
    }
    cb({ requestHeaders: d.requestHeaders });
  });
  // Cuando una página contesta "esperá" (429) o "ahora no" (503), se anota cuánto pide esperar
  // (Retry-After): de la navegación solo llega el código (y si la respuesta vino sin cuerpo, ni eso:
  // Chromium muestra su página de error), y la cola lo necesita para no volver a pedirle antes de
  // tiempo. Lo mismo con las imágenes que carga la página: una imagen rota no dice por qué, y sin
  // esto un capítulo con la mitad de las páginas en 503 se guardaba con las que cargaron, como si
  // estuviera entero. Cuáles de esas cuentan lo decide bajar (imagenQuePidioEsperar).
  ses.webRequest.onHeadersReceived((d, cb) => {
    if (d.statusCode === 429 || d.statusCode === 503) {
      const k = Object.keys(d.responseHeaders || {}).find(h => h.toLowerCase() === 'retry-after');
      const retryAfter = k ? String([].concat(d.responseHeaders[k])[0] || '') : '';
      if (d.resourceType === 'mainFrame') pedidoDeEspera.set(d.webContentsId, { status: d.statusCode, retryAfter });
      else if (d.resourceType === 'image' && d.webContentsId && !(armador && !armador.isDestroyed() && d.webContentsId === armador.webContents.id)) {
        (imagenesEnEspera.get(d.webContentsId) || imagenesEnEspera.set(d.webContentsId, []).get(d.webContentsId)).push({ url: d.url, status: d.statusCode, retryAfter });
      }
    }
    cb({});
  });
}
const pedidoDeEspera = new Map();        // id de la página → { status, retryAfter } de su navegación, si fue 429 o 503
let ultimaDeteccion = null;              // la última vez que una página pidió esperar: { status, via } (para las pruebas)
const ventanasDePaginas = new Set();     // las ventanas ocultas de páginas abiertas ahora (para las pruebas)
let demoraDeGuardado = 0;                // solo en las pruebas: una espera antes de escribir cada archivo del armador
const imagenesEnEspera = new Map();      // id de la página → [{ url, status, retryAfter }] de las imágenes que contestaron 429 o 503

// De las imágenes que la página pidió y el sitio contestó con 429 o 503, la que cuenta: una de la
// carpeta de las páginas del capítulo que no quedó entre ellas. Si después cargó, no faltó; si es
// de otra carpeta (un aviso, la tapa de un "relacionado", aunque sea del mismo sitio), no es del
// capítulo. Sin ninguna página, cualquiera. null si no hay.
function imagenQuePidioEsperar(id, urls) {
  const fallas = imagenesEnEspera.get(id) || [];
  if (!fallas.length) return null;
  const tengo = new Set(urls || []);
  const carpeta = (u) => String(u).split(/[?#]/)[0].replace(/[^/]*$/, '');
  const cuenta = new Map();
  for (const u of urls || []) cuenta.set(carpeta(u), (cuenta.get(carpeta(u)) || 0) + 1);
  const principal = [...cuenta].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return fallas.find(x => !tengo.has(x.url) && (!principal || carpeta(x.url) === principal)) || null;
}

// ── Tapas ────────────────────────────────────────────
// La miniatura de la imagen que acompaña a un título, para mostrarla en la lista. Se pide
// con la sesión de las páginas (sus cookies y su caché: la página ya la bajó al abrirse) y
// con el Referer que mandaría el navegador. Vuelve como una dirección data: chica, que es
// lo único que la interfaz puede mostrar: no carga nada de internet por su cuenta.
const TAPA_ANCHO = 240, TAPA_MAX = 6 * 1024 * 1024, TAPAS_A_LA_VEZ = 4, TAPAS_EN_MEMORIA = 3000;
const tapas = new Map();          // dirección de la imagen → promesa de su miniatura
let tapasEnCurso = 0;
const tapasEnEspera = [];
async function bajarTapa(url, pagina) {
  let referer = '';
  try { const p = new URL(pagina); referer = new URL(url).origin === p.origin ? p.href : p.origin + '/'; } catch {}
  const r = await session.fromPartition(PARTICION).fetch(url, { headers: referer ? { Referer: referer } : {}, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`La imagen respondió HTTP ${r.status}`);
  const tipo = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!/^image\/(?:jpeg|png|webp|gif|avif|bmp)$/.test(tipo)) throw new Error('No es una imagen');
  const datos = Buffer.from(await r.arrayBuffer());
  if (datos.length > TAPA_MAX) throw new Error('La imagen es demasiado grande');
  const img = nativeImage.createFromBuffer(datos);          // sabe leer JPG y PNG
  if (!img.isEmpty()) {
    const chica = img.getSize().width > TAPA_ANCHO ? img.resize({ width: TAPA_ANCHO, quality: 'good' }) : img;
    return 'data:image/jpeg;base64,' + chica.toJPEG(82).toString('base64');
  }
  if (datos.length > 1024 * 1024) throw new Error('La imagen es demasiado grande');
  return `data:${tipo};base64,` + datos.toString('base64');   // WebP y demás: van como vienen
}
function tapa(url, pagina) {
  if (!/^https?:\/\//i.test(url || '')) return Promise.reject(new Error('La dirección de la imagen no es válida'));
  if (tapas.has(url)) return tapas.get(url);
  // De a pocas por vez, para no cargar al sitio
  const p = new Promise((res, rej) => {
    const correr = () => {
      tapasEnCurso++;
      bajarTapa(url, pagina).then(res, rej).finally(() => { tapasEnCurso--; tapasEnEspera.shift()?.(); });
    };
    tapasEnCurso < TAPAS_A_LA_VEZ ? correr() : tapasEnEspera.push(correr);
  });
  p.catch(() => tapas.delete(url));                           // la que falló se puede volver a pedir
  if (tapas.size >= TAPAS_EN_MEMORIA) tapas.delete(tapas.keys().next().value);
  tapas.set(url, p);
  return p;
}

// ── Páginas en ventanas ocultas ──────────────────────
const pendientes = new Map();
let seq = 0;
ipcMain.on('mr:res', (_e, m) => {
  const p = pendientes.get(m?.id);
  if (!p) return;
  pendientes.delete(m.id);
  clearTimeout(p.t);
  p.limpiar();
  if (m.ok) return p.res(m.valor);
  // La pila es la de la página, no la de esta línea: con la de acá, un error de allá parece de main.js
  const error = new Error(m.error || 'Error en la página');
  if (m.pila) error.stack = m.pila;
  p.rej(error);
});

function pedir(win, cmd, args = {}, ms = 60000) {
  return new Promise((res, rej) => {
    if (win.isDestroyed()) return rej(new Error('La página se cerró'));
    const id = ++seq, wc = win.webContents;
    // Si la ventana se cierra antes de contestar (porque se canceló o se reintentó el capítulo), el
    // pedido falla en el acto, en vez de esperar el tiempo máximo (0.10.4)
    const alCerrar = () => { const p = pendientes.get(id); if (p) { pendientes.delete(id); clearTimeout(p.t); rej(new Error('La página se cerró')); } };
    wc.once('destroyed', alCerrar);
    const limpiar = () => { if (!wc.isDestroyed()) wc.removeListener('destroyed', alCerrar); };
    const t = setTimeout(() => { pendientes.delete(id); limpiar(); rej(new Error('La página no respondió')); }, ms);
    pendientes.set(id, { res, rej, t, limpiar });
    wc.send('mr:cmd', { id, cmd, args });
  });
}

// Abre la dirección en una ventana oculta y espera a que termine de armarse (los sitios que
// dibujan la página con JavaScript tardan un poco más que la carga). `alCrear` recibe la ventana
// apenas se crea: así un capítulo que se cancela o se reintenta la puede cerrar aunque todavía
// esté cargando (0.10.4).
async function abrirPagina(url, alCrear) {
  if (!/^https?:\/\//i.test(url || '')) throw new Error('La dirección tiene que empezar con http:// o https://');
  const win = new BrowserWindow({
    show: false, width: 1280, height: 900,
    webPreferences: {
      offscreen: true,                           // dibuja sin mostrarse: la carga diferida de imágenes funciona
      sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
      partition: PARTICION, preload: path.join(__dirname, '..', 'generado', 'pagina.js'),
    },
  });
  if (alCrear) alCrear(win);
  ventanasDePaginas.add(win.id);
  const idVentana = win.id;
  win.once('closed', () => ventanasDePaginas.delete(idVentana));
  try {
    const wc = win.webContents, id = wc.id;
    wc.once('destroyed', () => { pedidoDeEspera.delete(id); imagenesEnEspera.delete(id); });
    wc.setAudioMuted(true);
    wc.setFrameRate(10);
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    let codigo = 0;
    wc.on('did-navigate', (_e, _u, c) => { codigo = c; });

    let vencio = false;
    const limite = setTimeout(() => { vencio = true; if (!wc.isDestroyed()) wc.stop(); }, 45000);
    // Un 429 o un 503 no es una página rota: el sitio pidió esperar. El error lleva cuánto
    // (`esperar`), que es lo que mira la cola antes de pedirle otra cosa a ese sitio.
    // `via`: por dónde se supo (para las pruebas): la navegación con su código, o una carga que falló
    const pidioEsperar = (status, via) => {
      ultimaDeteccion = { status, via };
      return Object.assign(new Error(`La página respondió HTTP ${status}: el sitio pidió esperar`), { esperar: { status, retryAfter: pedidoDeEspera.get(id)?.retryAfter || '' } });
    };
    try {
      await win.loadURL(url).catch((e) => {
        if (/ERR_ABORTED/.test(e.message)) return;
        // Preventivo (0.10.4): si la carga falla pero la respuesta que se vio fue un 429 o un 503,
        // es que el sitio pidió esperar. En Electron 45.4.1 no pasa: un 429 o un 503 sin cuerpo
        // (también con Content-Length: 0) llega como una navegación con su código, y lo ve el
        // control de abajo. Queda por si otra versión de Chromium vuelve a darlo como carga fallida.
        if (pedidoDeEspera.has(id)) throw pidioEsperar(pedidoDeEspera.get(id).status, 'carga fallida');
        throw new Error(mensajeDeCarga(e));
      });
    } finally { clearTimeout(limite); }
    if (win.isDestroyed()) throw new Error('La página se cerró');          // se canceló o se reintentó mientras cargaba
    if (codigo === 429 || codigo === 503) throw pidioEsperar(codigo, 'navegación');
    if (codigo >= 400) throw new Error(`La página respondió HTTP ${codigo}`);

    if (vencio && !(await armada(win))) throw new Error('La página tardó demasiado en cargar');
    else if (!vencio) await armada(win);
    if (win.isDestroyed()) throw new Error('La página se cerró');
    return win;
  } catch (e) {
    if (!win.isDestroyed()) win.destroy();
    throw e;
  }
}
// Espera a que la página termine de armarse: la misma cantidad de imágenes y de links en
// tres consultas seguidas. Devuelve lo último que contó ('' si la página nunca contestó).
async function armada(win) {
  let antes = '', iguales = 0;
  for (let i = 0; i < 24 && iguales < 3; i++) {
    await espera(500);
    if (win.isDestroyed()) return '';                       // se cerró (cancelado o reintentado): no hay nada que esperar
    const c = await pedir(win, 'contar', {}, 8000).catch(() => null);
    const ahora = c ? `${c.imagenes}/${c.links}/${c.listo}` : '';
    iguales = c && c.listo && ahora === antes ? iguales + 1 : 0;
    antes = ahora;
  }
  return antes;
}

function mensajeDeCarga(e) {
  const m = String(e.message || e);
  if (/ERR_NAME_NOT_RESOLVED/.test(m)) return 'No encontré ese sitio (revisá la dirección)';
  if (/ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/.test(m)) return 'No hay conexión';
  if (/ERR_CONNECTION_|ERR_TIMED_OUT|ERR_ADDRESS_UNREACHABLE/.test(m)) return 'El sitio no respondió';
  if (/ERR_CERT_/.test(m)) return 'El certificado del sitio no es válido';
  return 'No se pudo abrir la página (' + (m.match(/ERR_[A-Z_]+/)?.[0] || m) + ')';
}

// Qué hay en una página: si es un capítulo y qué listas de links tiene
async function analizar(url, conocidas = []) {
  const win = await abrirPagina(url);
  try { return await pedir(win, 'explorar', { conocidas }, 90000); }
  finally { win.destroy(); }
}

// Busca `texto` con el buscador del propio sitio y devuelve lo mismo que `analizar`, con los
// resultados como listas. Hay dos formas, según lo que el explorador encontró en la página:
//   plantilla  una dirección con {q} donde va lo buscado (un formulario, o la que declara el sitio)
//   pagina     la página que tiene un cuadro de búsqueda suelto: se abre, se escribe ahí y se da
//              Enter. Si los resultados aparecen sin cambiar de página, son los links nuevos.
// `conocidas`: ids de las listas de títulos ya vistas en el sitio; con eso un resultado solo
// también arma lista.
async function buscarEnSitio({ plantilla, pagina, texto, conocidas } = {}) {
  texto = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!texto) throw new Error('Escribí qué querés buscar');
  conocidas = Array.isArray(conocidas) ? conocidas.map(String).slice(0, 200) : [];
  if (plantilla) {
    plantilla = String(plantilla);
    if (!/^https?:\/\//i.test(plantilla) || !plantilla.includes('{q}')) throw new Error('El buscador de este sitio no se puede usar desde acá');
    return analizar(plantilla.split('{q}').join(encodeURIComponent(texto)), conocidas);
  }
  const win = await abrirPagina(String(pagina || ''));
  try {
    // (si al dar Enter la página cambia, puede que la respuesta no llegue: no importa)
    await pedir(win, 'buscar', { texto }, 8000).catch((e) => { if (/No encontré/.test(e.message)) throw e; });
    await espera(1200);
    await armada(win);
    return await pedir(win, 'explorar', { conocidas, soloNuevos: true }, 90000);
  } finally { win.destroy(); }
}

// Sigue la paginación de un listado desde `url`: lee hasta `max` páginas, de a una y con una
// pausa entre ellas, y junta sus listas (las que tienen la misma forma se suman, sin repetir).
// Devuelve { listas, siguiente, paginas }: `siguiente` queda con la dirección para seguir
// más tarde, o vacío si se llegó al final.
async function seguir(url, max = 10, conocidas = []) {
  const juntas = new Map(), leidas = new Set(), ids = new Set(conocidas);
  let siguiente = String(url || ''), paginas = 0;
  while (siguiente && paginas < max && !leidas.has(siguiente)) {
    leidas.add(siguiente);
    if (paginas) await espera(PRUEBA ? 50 : 1000);
    avance(`Leyendo la página ${paginas + 1} de hasta ${max}…`);
    const r = await analizar(siguiente, [...ids]);
    paginas++;
    let nuevos = 0;
    for (const l of r.listas) {
      ids.add(l.id);
      if (!juntas.has(l.id)) juntas.set(l.id, { ...l, items: [], vistos: new Set() });
      const j = juntas.get(l.id);
      for (const i of l.items) if (!j.vistos.has(i.url)) { j.vistos.add(i.url); j.items.push(i); nuevos++; }
    }
    siguiente = r.siguiente;
    if (!nuevos) { siguiente = ''; break; }           // una página sin nada nuevo: se terminó (o da vueltas)
  }
  return { listas: [...juntas.values()].map(({ vistos, ...l }) => l), siguiente: leidas.has(siguiente) ? '' : siguiente, paginas };
}
function avance(texto) { if (ui && !ui.isDestroyed()) ui.webContents.send('avance', texto); }

// ── Armado de archivos ───────────────────────────────
const trabajos = new Map();          // jobId → { carpeta, progreso }

async function prepararArmador() {
  if (armador && !armador.isDestroyed()) return armador;
  armador = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
      partition: PARTICION,                       // las mismas cookies que las páginas
      webSecurity: false,                         // carga solo armador.html (local) y tiene que leer imágenes de cualquier sitio
      preload: path.join(__dirname, 'armador', 'preload_armador.js'),
    },
  });
  await armador.loadFile(path.join(__dirname, 'armador', 'armador.html'));
  return armador;
}

ipcMain.on('armador:progreso', (_e, m) => trabajos.get(m?.jobId)?.progreso(m.done, m.total));
ipcMain.handle('armador:guardar', async (e, { jobId, rel, bytes }) => {
  const t = trabajos.get(jobId);
  if (!t || !armador || e.sender !== armador.webContents) throw new Error('Trabajo desconocido');
  // (cada escritura en curso queda anotada: si el trabajo se corta, armar espera a que terminen
  // y se borren antes de devolver el control)
  const escribiendo = guardarDelArmador(t, jobId, rel, bytes);
  t.enCurso.add(escribiendo);
  try { return await escribiendo; } finally { t.enCurso.delete(escribiendo); }
});
async function guardarDelArmador(t, jobId, rel, bytes) {
  const base = path.resolve(t.carpeta);
  let destino = path.resolve(base, ...String(rel).split('/'));
  if (!destino.startsWith(base + path.sep)) throw new Error('Nombre de archivo no válido');
  await fs.promises.mkdir(path.dirname(destino), { recursive: true });
  if (PRUEBA && demoraDeGuardado) {
    await espera(demoraDeGuardado);
    if (!trabajos.has(jobId)) {
      if (esPaginaSuelta(destino)) { try { fs.rmdirSync(path.dirname(destino)); } catch {} }      // (la carpeta recién creada, si quedó vacía)
      throw new Error('El trabajo se cortó');
    }
  }
  // Si ya existe, no se pisa: "nombre (1).pdf", como hace el navegador
  const { dir, name, ext } = path.parse(destino);
  for (let n = 1; fs.existsSync(destino); n++) destino = path.join(dir, `${name} (${n})${ext}`);
  await fs.promises.writeFile(destino, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  const escrito = path.relative(base, destino).split(path.sep).join('/');
  // (si mientras se escribía se cortó el trabajo, lo escrito sobra: se borra)
  if (!trabajos.has(jobId)) { borrarEscritos(base, [escrito]); throw new Error('El trabajo se cortó'); }
  t.escritos.push(escrito);
  return { rel: escrito };
}

// Baja las páginas una vez y escribe lo pedido en carpeta/ruta.pdf, .cbz y/o carpeta/ruta/pagina_NNN.ext.
// `intento` (el de un capítulo de la cola): ahí queda cómo cortar este trabajo (0.10.4).
async function armar({ urls, formatos, ruta, meta, carpeta, referer }, progreso, intento) {
  const win = await prepararArmador();
  const jobId = crypto.randomUUID();
  const trabajo = { carpeta, progreso: progreso || (() => {}), escritos: [], enCurso: new Set() };
  trabajos.set(jobId, trabajo);
  refererActual = referer || '';
  let alCortar = null;
  const cortado = new Promise((_, rej) => { alCortar = rej; });
  cortado.catch(() => {});
  if (intento) intento.trabajo = { jobId, cortar: () => alCortar(new Error('Se cortó')) };
  try {
    // soloEntero: si una página queda afuera porque el sitio pidió esperar (429 o 503), el armador
    // corta ahí y no arma nada (como en los lotes de la extensión): nada queda a medias
    const msg = { urls, formats: formatos, title: ruta.split('/').pop(), meta, jobId, path: ruta, soloEntero: true };
    const corriendo = win.webContents.executeJavaScript(`armar(${JSON.stringify(msg)})`, true);
    corriendo.catch(() => {});                       // (si se cortó, lo que conteste después no importa)
    const r = await Promise.race([corriendo, cortado]);
    // Si no se pudo armar nada llega { error, esperar } en vez de un Error (que al cruzar de la
    // ventana a este proceso pierde lo que lleve de más): acá vuelve a ser uno, con su `esperar`
    if (r && r.error) throw Object.assign(new Error(r.error), { esperar: r.esperar || null });
    return r;
  } finally {
    // Si se cortó con un archivo a medio escribir, se espera a que esa escritura termine y se borre
    // (lo hace armador:guardar): el intento que sigue recién sale con la carpeta limpia. Sin corte no
    // queda ninguna en curso: el armador espera cada una antes de terminar.
    await Promise.allSettled([...trabajo.enCurso]);
    trabajos.delete(jobId);
    refererActual = '';
    if (intento && intento.trabajo?.jobId === jobId) intento.trabajo = null;
  }
}

// Borra lo que un intento escribió (rutas relativas a `carpeta`). Si eran las imágenes sueltas de un
// capítulo y su carpeta quedó vacía, también esa carpeta: un capítulo cortado no deja nada suyo.
const esPaginaSuelta = (p) => /^pagina_\d+\./.test(path.basename(p));
function borrarEscritos(carpeta, rels) {
  const carpetas = new Set();
  for (const rel of rels || []) {
    const p = path.join(carpeta, ...String(rel).split('/'));
    try { fs.rmSync(p, { force: true }); } catch {}
    if (esPaginaSuelta(p)) carpetas.add(path.dirname(p));
  }
  for (const d of carpetas) { try { fs.rmdirSync(d); } catch {} }      // (rmdir solo saca una carpeta vacía)
}

// Corta en el acto el intento en curso de un capítulo de la cola, al cancelarlo o al reintentarlo
// (0.10.4): cierra su ventana, corta lo que esté armando el armador (que se vuelve a crear para el
// que sigue) y borra lo que ese intento alcanzó a escribir. Hasta la 0.10.3 el intento viejo dejaba
// de escribir pero seguía hasta terminar el paso en el que estaba, con su ventana abierta.
function cortarIntento(t) {
  const i = t.intento;
  if (!i || i.cortado) return;
  i.cortado = true;
  if (i.win && !i.win.isDestroyed()) i.win.destroy();
  const trabajo = i.trabajo && trabajos.get(i.trabajo.jobId);
  if (trabajo) {
    trabajos.delete(i.trabajo.jobId);              // lo que el armador mande después ya no se escribe
    borrarEscritos(trabajo.carpeta, trabajo.escritos);
    if (armador && !armador.isDestroyed()) armador.destroy();
    armador = null;
    i.trabajo.cortar();
  }
}

// ── Lo que ya tenés: el disco, tu colección y el registro ──
// Para marcar en las listas lo que ya se bajó y no repetirlo. Se mira en tres lados:
//   · la carpeta de descargas;
//   · las carpetas de "tu colección" (config.bibliotecas): donde guardás lo tuyo, por ejemplo
//     la de Google Drive. Ahí puede estar con otra organización (Mangas/One Piece/…);
//   · el registro de descargas (más abajo): lo que este programa bajó, aunque después lo
//     hayas movido o borrado.
// No se comparan series por parecido: "Dragon Ball" y "Dragon Ball Super" son dos, y tomar
// una por la otra haría saltear capítulos que faltan.
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// De un renglón como "One Piece Capítulo 1134 hace 2 horas", el nombre de la serie
const soloSerie = (texto) => String(texto || '').replace(/\s*(?:[-–—|:·]\s*)?(?:cap[ií]tulo|chapter|cap\.|ch\.|ep\.|#)\s*\d.*$/i, '').replace(/\s+/g, ' ').trim();
// El nombre de una serie sin lo que cambia de un sitio a otro: mayúsculas, acentos, signos y
// palabras de relleno ("manga", "leer", "online", "español")
const claveSerie = (nombre) => sinAcentos(nombre)
  .replace(/\b(?:manga|manhwa|manhua|comics?|leer|read|online|espanol|castellano|spanish|english|ingles|gratis|free)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, '');

// Las carpetas donde se mira: la de descargas primero, después las de la colección
const raices = (carpeta) => [...new Set([carpeta, ...(config.bibliotecas || [])].filter(Boolean).map(p => path.resolve(p)))];
// Las carpetas de una raíz, hasta dos niveles (Mangas/One Piece), por la clave de su nombre.
// Las de la colección se recuerdan un minuto: pueden estar en un disco lento o en la nube.
const indices = new Map();           // raíz → { cuando, porClave }
function carpetasDe(raiz, recordar) {
  const ya = indices.get(raiz);
  if (recordar && ya && Date.now() - ya.cuando < 60000) return ya.porClave;
  const porClave = new Map();
  const anotar = (dir, nombre) => { const k = claveSerie(nombre); if (k) (porClave.get(k) || porClave.set(k, []).get(k)).push(dir); };
  const subcarpetas = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch { return []; } };
  for (const a of subcarpetas(raiz)) {
    anotar(path.join(raiz, a), a);
    for (const b of subcarpetas(path.join(raiz, a))) anotar(path.join(raiz, a, b), b);
  }
  indices.set(raiz, { cuando: Date.now(), porClave });
  return porClave;
}
// Las carpetas de una serie, en todas las raíces: [{ dir, nombre }] (`nombre` es para mostrar:
// el de la carpeta si está en descargas, o su ruta desde la colección: "Mi unidad/Mangas/One Piece")
// (`mapas` es lo que devuelve mapasDe: se pasa cuando se consultan muchas series seguidas, para
// no volver a listar las carpetas por cada una)
function mapasDe(carpeta) {
  const base = path.resolve(carpeta);
  return raices(carpeta).map(raiz => ({ raiz, propia: raiz === base, porClave: carpetasDe(raiz, raiz !== base) }));
}
function carpetasDeSerie(carpeta, clave, mapas = mapasDe(carpeta)) {
  const lista = [];
  for (const { raiz, propia, porClave } of mapas) {
    for (const dir of porClave.get(clave) || []) {
      const rel = path.relative(raiz, dir).split(path.sep).join('/');
      lista.push({ dir, nombre: propia && !rel.includes('/') ? rel : `${path.basename(raiz) || raiz}/${rel}` });
    }
  }
  // Las que ataste a esta serie a mano, aunque se llamen de otra forma ("Una Pieza" es One Piece)
  for (const dir of config.vinculos[clave] || []) {
    if (!lista.some(c => c.dir === dir) && existe(dir)) lista.push({ dir, nombre: `${path.basename(path.dirname(dir))}/${path.basename(dir)}` });
  }
  return lista;
}
// Carpetas donde se tendría que mirar y hoy no están (un disco sin conectar, Google Drive
// cerrado): con eso a medias, lo que ya tenés no aparece marcado y se puede bajar dos veces.
function sinMirar(carpeta) {
  const faltan = (config.bibliotecas || []).filter(c => !existe(c));
  if (carpeta && !existe(carpeta) && !existe(path.dirname(path.resolve(carpeta)))) faltan.unshift(carpeta);
  return faltan;
}
function vincular(serie, carpeta) {
  const clave = claveSerie(serie);
  if (!clave || !carpeta || !existe(carpeta)) throw new Error('Hace falta el nombre de la serie y una carpeta que exista');
  const v = { ...config.vinculos, [clave]: [...new Set([...(config.vinculos[clave] || []), path.resolve(carpeta)])] };
  return guardarConfig({ vinculos: v }).vinculos[clave];
}
function desvincular(serie) {
  const v = { ...config.vinculos };
  delete v[claveSerie(serie)];
  guardarConfig({ vinculos: v });
  return [];
}
// Carpetas de nombre parecido al de una serie: uno empieza con el otro ("Dragon Ball Super" y
// "Dragon Ball Super Manga Color"). No quiere decir que ya la tengas: es una pista para mirar.
// Nunca se usa para saltear nada.
function parecidas(carpeta, clave, mapas = mapasDe(carpeta)) {
  if (clave.length < 5) return [];
  const nombres = new Map();
  for (const { porClave } of mapas) {
    for (const [k, dirs] of porClave) {
      if (k !== clave && k.length >= 5 && (k.startsWith(clave) || clave.startsWith(k)) && !nombres.has(path.basename(dirs[0]))) nombres.set(path.basename(dirs[0]), dirs[0]);
    }
  }
  const atadas = new Set(config.vinculos[clave] || []);          // las que ya ataste no son "parecidas": son de la serie
  return [...nombres].filter(([, dir]) => !atadas.has(dir)).slice(0, 3).map(([nombre, dir]) => ({ nombre, dir }));
}

// Capítulos de una serie que ya están en el disco: número → qué hay ('pdf', 'cbz', 'imgs').
// Devuelve { porNumero, carpetas }, con las carpetas de la serie que se encontraron.
function enDisco(carpeta, serie) {
  const clave = claveSerie(serie), porNumero = new Map();
  if (!clave) return { porNumero, carpetas: [] };
  const anotar = (nombre, tipo) => {
    // El número: el que sigue a "capítulo" o a "#" o, si no, el primero de 3 a 5 cifras ("0012" como
    // los guarda este programa, "012" como vienen muchos cómics), sin contar los que traiga el
    // nombre de la serie ("2001 Nights 0005"), un año entre paréntesis ("(2018)") ni el de un
    // tomo: "Tomo 012" no es el capítulo 12.
    let n = nombre.replace(/\.(?:pdf|cbz|cbr|zip|epub)$/i, '').replace(/ \(\d+\)$/, '');
    if (sinAcentos(n).startsWith(sinAcentos(serie))) n = n.slice(String(serie).length);
    const m = n.match(/(?<![a-záéíóúñ])(?:cap[ií]tulo|chapter|cap\.?|ch\.?|#)\s*(\d{1,5}(?:\.\d+)?)/i) ||
      n.match(/(?<![\d.(])(?<!(?:tomo|vol\.?|volumen|volume|libro|book)\s*)(?<!\b[vt])(\d{3,5}(?:\.\d+)?)(?![\d)])/i);
    if (!m) return;
    const numero = parseFloat(m[1]);
    if (!porNumero.has(numero)) porNumero.set(numero, new Set());
    porNumero.get(numero).add(tipo);
  };
  const mirar = (dir, nivel) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const ruta = path.join(dir, e.name);
      if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (ext === '.pdf') anotar(e.name, 'pdf');
        else if (ext === '.cbz' || ext === '.cbr' || ext === '.zip') anotar(e.name, 'cbz');
      } else if (e.isDirectory()) {
        let suyas = false;                           // ¿es la carpeta de imágenes de un capítulo?
        try { suyas = fs.readdirSync(ruta).some(n => /^pagina_\d+\./.test(n)); } catch {}
        if (suyas) anotar(e.name, 'imgs');
        else if (nivel < 3) mirar(ruta, nivel + 1);  // una carpeta de saga, de tomo o de año
      }
    }
  };
  const carpetas = carpetasDeSerie(carpeta, clave);
  for (const c of carpetas) mirar(c.dir, 0);
  return { porNumero, carpetas: carpetas.map(c => c.nombre) };
}
const tieneTodo = (tipos, f) => !!tipos && (!f.pdf || tipos.has('pdf')) && (!f.cbz || tipos.has('cbz')) && (!f.imgs || tipos.has('imgs'));
// "1–3, 7, 9–12": una lista de números como rangos (los seguidos van juntos)
function enRangos(numeros) {
  const n = [...new Set(numeros)].sort((a, b) => a - b), rangos = [];
  for (const x of n) {
    const ult = rangos[rangos.length - 1];
    if (ult && x - ult[1] <= 1) ult[1] = x; else rangos.push([x, x]);
  }
  return rangesText(rangos);
}

// ── Registro de descargas ──
// Lo que este programa bajó: una entrada por capítulo. Sirve para saber que algo ya se bajó
// aunque ya no esté en la carpeta (lo moviste, lo subiste a otro lado, lo borraste) o aunque
// lo encuentres de nuevo en otro sitio. Vive en descargas.json, al lado de la configuración.
let registro = [];          // [{ clave, serie, numero, ruta, formatos, paginas, fecha, url }]
const archivoRegistro = () => path.join(app.getPath('userData'), 'descargas.json');
function leerRegistro() {
  try {
    const l = JSON.parse(fs.readFileSync(archivoRegistro(), 'utf8'));
    if (Array.isArray(l)) registro = l.filter(r => r && typeof r.clave === 'string' && typeof r.serie === 'string');
  } catch {}
}
function escribirRegistro() {
  if (!PRUEBA) { try { fs.writeFileSync(archivoRegistro(), JSON.stringify(registro)); } catch {} }
}
// Anota un capítulo que se terminó de bajar. Si ya estaba (misma serie y número), se actualiza.
function anotarDescarga({ serie, numero, ruta, formatos, paginas, url }) {
  const clave = claveSerie(serie);
  if (!clave) return;
  const i = registro.findIndex(r => r.clave === clave && (numero != null ? r.numero === numero : r.ruta === ruta));
  const tipos = Object.keys(formatos).filter(k => formatos[k]);
  const nueva = { clave, serie, numero, ruta, formatos: [...new Set([...(i >= 0 ? registro[i].formatos || [] : []), ...tipos])], paginas, fecha: new Date().toISOString(), url };
  if (i >= 0) registro[i] = nueva; else registro.push(nueva);
  escribirRegistro();
}
// El registro, por serie: cuántos capítulos, de cuál a cuál, cuáles faltan en el medio y cuándo fue el último
function verRegistro() {
  const series = new Map();
  for (const r of registro) {
    if (!series.has(r.clave)) series.set(r.clave, { clave: r.clave, serie: r.serie, numeros: [], sueltos: 0, ultima: '' });
    const s = series.get(r.clave);
    if (r.numero != null) s.numeros.push(r.numero); else s.sueltos++;
    if (r.fecha > s.ultima) { s.ultima = r.fecha; s.serie = r.serie; }
  }
  return [...series.values()].map(s => {
    const n = s.numeros.sort((a, b) => a - b);
    return { clave: s.clave, serie: s.serie, cuantos: n.length + s.sueltos, desde: n.length ? n[0] : null, hasta: n.length ? n[n.length - 1] : null,
             faltan: rangesText(missingRanges(n)), ultima: s.ultima.slice(0, 10) };
  }).sort((a, b) => b.ultima.localeCompare(a.ultima) || a.serie.localeCompare(b.serie));
}
function quitarDelRegistro(clave) {
  registro = registro.filter(r => r.clave !== clave);
  escribirRegistro();
  return verRegistro();
}

// Para la lista de capítulos de una serie: cuáles ya están (en el disco o en tu colección),
// cuáles se bajaron alguna vez aunque ya no estén, y cuáles faltan.
// Un capítulo "ya está" si está en cualquier formato: quien lo tiene en CBZ no lo quiere ver
// como faltante por tener tildado PDF. `enOtro` dice, de los que están, cuáles están solo en
// un formato distinto del pedido, y en cuál ("cbz"), para avisarlo en la lista. (Al descargar,
// en cambio, "saltear" sí mira el formato pedido: si tildás uno a propósito, se baja.)
function revisarDisco({ serie, numeros, carpeta, formatos } = {}) {
  const f = { ...config.formatos, ...(formatos || {}) };
  const lista = (Array.isArray(numeros) ? numeros : []).filter(Number.isFinite);
  const { porNumero, carpetas } = enDisco(carpeta || config.carpeta, String(serie || ''));
  const clave = claveSerie(serie);
  const anotados = new Map(registro.filter(r => clave && r.clave === clave && r.numero != null).map(r => [r.numero, r.fecha.slice(0, 10)]));
  const tengo = lista.filter(n => porNumero.has(n));
  const enOtro = tengo.filter(n => !tieneTodo(porNumero.get(n), f)).map(n => ({ numero: n, formato: [...porNumero.get(n)].join('+') }));
  const bajados = lista.filter(n => !porNumero.has(n) && anotados.has(n)).map(n => ({ numero: n, fecha: anotados.get(n) }));
  const faltan = lista.filter(n => !porNumero.has(n) && !anotados.has(n));
  // Si no hay una carpeta de esta serie, las de nombre parecido (por si es la misma con otro nombre)
  const cerca = carpetas.length || !clave ? [] : parecidas(carpeta || config.carpeta, clave);
  return { tengo, enOtro, bajados, faltan: enRangos(faltan), cuantosFaltan: faltan.length, carpetas, parecidas: cerca,
           vinculadas: (config.vinculos[clave] || []).length, sinMirar: sinMirar(carpeta || config.carpeta) };
}
// Para una lista de títulos (un catálogo): de cuáles ya tenés algo. Devuelve, en el mismo
// orden, null o { bajados: capítulos en el registro, carpeta: dónde está en tu colección }
function revisarTitulos({ nombres, carpeta } = {}) {
  const cuantos = new Map();
  for (const r of registro) cuantos.set(r.clave, (cuantos.get(r.clave) || 0) + 1);
  const donde = carpeta || config.carpeta, mapas = mapasDe(donde);        // las carpetas se listan una sola vez para toda la lista
  return (Array.isArray(nombres) ? nombres : []).map((nombre) => {
    const clave = claveSerie(soloSerie(nombre));
    if (!clave) return null;
    const bajados = cuantos.get(clave) || 0, dirs = carpetasDeSerie(donde, clave, mapas);
    if (bajados || dirs.length) return { bajados, carpeta: dirs.length ? dirs[0].nombre : '' };
    const cerca = parecidas(donde, clave, mapas);                           // nada con ese nombre: ¿algo parecido?
    return cerca.length ? { bajados: 0, carpeta: '', parecida: cerca[0].nombre } : null;
  });
}

// ── Cola de descargas ────────────────────────────────
// { id, url, texto, numero, volumen, titulo, elegidas, info, opciones, estado, detalle, nombre, archivos }
const cola = [];
let trabajando = false, ui = null, ultimoAviso = '';
const ACTIVOS = new Set(['abriendo', 'buscando páginas', 'bajando']);
const SIN_TERMINAR = new Set(['falló', 'incompleto', 'cancelado']);        // lo que "Reintentar" vuelve a poner en la cola
const pendiente = (t) => t.estado === 'en cola' || ACTIVOS.has(t.estado);
const publico = (t) => ({ id: t.id, url: t.url, texto: t.texto, numero: t.numero, estado: t.estado, detalle: t.detalle, nombre: t.nombre });
function avisar() {
  if (!ui || ui.isDestroyed()) return;
  ui.webContents.send('cola', cola.map(publico));
  // El avance también se ve en el ícono de la barra de tareas
  const faltan = cola.filter(pendiente).length;
  ui.setProgressBar(faltan ? Math.max(0.03, (cola.length - faltan) / cola.length) : -1);
}
function paso(t, estado, detalle = '') { t.estado = estado; t.detalle = detalle; avisar(); }

const esWeb = (u) => /^https?:\/\//i.test(u || '');
function encolar(items, opciones) {
  const o = { serie: String(opciones?.serie || '').trim(), carpeta: opciones?.carpeta || config.carpeta,
              formatos: { ...config.formatos, ...(opciones?.formatos || {}) }, saltear: opciones?.saltear ?? config.saltear };
  if (!o.formatos.pdf && !o.formatos.cbz && !o.formatos.imgs) throw new Error('Elegí al menos un formato');
  if (!existe(o.carpeta) && !existe(path.dirname(path.resolve(o.carpeta)))) {
    throw new Error(`La carpeta donde se guarda no está a la vista: ${o.carpeta}. Si está en Google Drive o en otro disco, abrilo o conectalo y probá de nuevo.`);
  }
  for (const i of items || []) {
    if (!esWeb(i?.url)) continue;
    // `paginas` (con `info`): el capítulo ya se revisó a mano y estas son las páginas elegidas
    const elegidas = Array.isArray(i.paginas) ? i.paginas.filter(esWeb) : null;
    cola.push({ id: crypto.randomUUID(), url: i.url, texto: String(i.texto || ''), numero: Number.isFinite(i.numero) ? i.numero : null,
                volumen: String(i.volumen || ''), titulo: String(i.titulo || ''),
                elegidas: elegidas && i.info ? elegidas : null, info: elegidas && i.info ? i.info : null,
                opciones: o, estado: 'en cola', detalle: '', nombre: '', archivos: [] });
  }
  avisar();
  procesar();
  return cola.length;
}

// Cuando un sitio pide esperar —un 429 o un 503, en la página del capítulo o en sus imágenes—, no
// se le vuelve a pedir nada antes de que pase el freno: ni el capítulo siguiente ni un reintento
// (tampoco el del aviso de Windows). El freno es el de la extensión (frenoDe, en freno.js): lo que
// pidió en Retry-After con tope de un minuto; sin Retry-After, con algo que no se entiende o con
// una fecha vencida, un minuto; con Retry-After: 0, nada.
const PAUSA = PRUEBA ? 100 : 1500;      // respiro entre capítulos, para no cargar al sitio
const noAntesDe = new Map();            // sitio → hasta cuándo no pedirle (Date.now())
const sitioDe = (u) => { try { return new URL(u).host; } catch { return ''; } };
function anotarEspera(t, esperar) {
  const ms = frenoDe(esperar);
  if (ms > 0) { const k = sitioDe(t.url); noAntesDe.set(k, Math.max(noAntesDe.get(k) || 0, Date.now() + ms)); }
}
const faltaEsperar = (t) => (noAntesDe.get(sitioDe(t.url)) || 0) - Date.now();

async function procesar() {
  if (trabajando) return;
  trabajando = true;
  for (;;) {
    const enCola = cola.filter(x => x.estado === 'en cola');
    if (!enCola.length) break;
    const t = enCola.find(x => faltaEsperar(x) <= 0);
    // (la cuenta regresiva de los que ya no esperan se borra: si no, queda "sigo en 1 s" hasta que les toque)
    for (const x of enCola) if (faltaEsperar(x) <= 0 && /pidió esperar: sigo en/.test(x.detalle)) x.detalle = '';
    if (!t) {
      // Todo lo que queda es de sitios que pidieron esperar. Se espera de a poco, y se vuelve
      // a mirar la cola: mientras tanto se puede haber cancelado o sumado algo.
      const falta = Math.min(...enCola.map(faltaEsperar));
      for (const x of enCola) x.detalle = `el sitio pidió esperar: sigo en ${Math.ceil(faltaEsperar(x) / 1000)} s`;
      avisar();
      await espera(Math.min(falta, 1000));
      continue;
    }
    await bajar(t);
    if (cola.some(x => x.estado === 'en cola')) await espera(PAUSA);
  }
  trabajando = false;
  avisar();
  finDeCola();
}

// Al vaciarse la cola: si el programa no está a la vista, un aviso de Windows y el ícono titilando
function finDeCola() {
  const n = (...estados) => cola.filter(t => estados.includes(t.estado)).length;
  const listos = n('listo'), estaban = n('ya estaba'), mal = n('falló', 'incompleto');
  if (!listos && !estaban && !mal) return;                          // se canceló todo: nada que contar
  ultimoAviso = [listos ? `${listos} guardado${listos === 1 ? '' : 's'}` : '', estaban ? `${estaban} ya estaba${estaban === 1 ? '' : 'n'}` : '',
                 mal ? `${mal} con problemas` : ''].filter(Boolean).join(' · ');
  if ((PRUEBA && !AVISOS) || !ui || ui.isDestroyed() || ui.isFocused()) return;
  ui.flashFrame(true);
  ui.once('focus', () => ui.flashFrame(false));
  if (Notification.isSupported()) mostrarAvisoDeFin();
}

// El aviso de fin de cola tiene un botón por cada cosa que la ventana deja hacer con la cola
// terminada (Cancelar no: ya no queda nada en curso), con el mismo texto que su botón. Al tocarlo
// corre el mismo manejador que el botón de la ventana, por el mismo camino (correr, más abajo):
// "Reintentar" vuelve a poner en la cola lo que no terminó bien, y la cola respeta el freno del sitio.
// Devuelve { titulo, cuerpo, botones: [{ canal, texto }], accion }: `accion` es lo que hace el
// aviso cuando Windows dice que se tocó un botón (las pruebas la llaman igual).
function armarAvisoDeFin() {
  const aReintentar = cola.filter(t => SIN_TERMINAR.has(t.estado)).length;
  const botones = [
    ...(aReintentar ? [{ canal: 'reintentar', texto: `Reintentar ${aReintentar} ${aReintentar === 1 ? 'que falló' : 'que fallaron'}` }] : []),
    { canal: 'limpiar', texto: 'Limpiar terminados' },
    { canal: 'abrir-carpeta', texto: 'Abrir carpeta' },
  ];
  // Windows avisa cada toque dos veces (con 3 o 4 ms de diferencia): vale el primero
  let tocado = null;
  const accion = (detalles, indice) => {
    const i = detalles && typeof detalles.actionIndex === 'number' ? detalles.actionIndex : indice;
    if (tocado || !botones[i]) return tocado;
    return (tocado = correr(botones[i].canal));
  };
  return { titulo: 'Manga Reader: terminó la cola', cuerpo: ultimoAviso, botones, accion };
}
// Los últimos avisos: un aviso que nadie referencia se libera y sus botones dejan de llegar (el del
// centro de notificaciones de una cola anterior, o uno que Windows mostró tarde)
let avisoDeFin = null;
const avisosVivos = [];
function mostrarAvisoDeFin() {
  const a = armarAvisoDeFin();
  const aviso = new Notification({ title: a.titulo, body: a.cuerpo, actions: a.botones.map(b => ({ type: 'button', text: b.texto })) });
  aviso.on('click', () => { if (ui && !ui.isDestroyed()) { if (ui.isMinimized()) ui.restore(); ui.focus(); } });
  aviso.on('action', (detalles, indice) => {
    // (en la prueba de los avisos se anota lo que llega de Windows, para ver qué botón se tocó)
    if (AVISOS) console.log(`[aviso] action · actionIndex ${detalles && detalles.actionIndex} · índice ${indice} · botones: ${a.botones.map(b => b.canal).join(', ')}`);
    a.accion(detalles, indice);
  });
  avisoDeFin = { aviso, ...a };
  avisosVivos.push(avisoDeFin);
  if (avisosVivos.length > 10) avisosVivos.shift();
  // (recién preparados los avisos, se muestra cuando Windows ya tiene el acceso directo: ver
  // prepararAvisos. Si mientras tanto terminó otra cola, sale solo el último)
  avisosListos.then(() => { if (avisoDeFin && avisoDeFin.aviso === aviso) aviso.show(); });
  return avisoDeFin;
}

const existe = (p) => { try { return fs.statSync(p); } catch { return null; } };
// ¿Ya está en el disco todo lo que se pidió, con este nombre exacto?
function yaEsta(carpeta, ruta, f) {
  const base = path.join(carpeta, ...ruta.split('/'));
  const imgs = () => { try { return fs.readdirSync(base).some(n => /^pagina_\d+\./.test(n)); } catch { return false; } };
  return (!f.pdf || !!existe(base + '.pdf')) && (!f.cbz || !!existe(base + '.cbz')) && (!f.imgs || imgs());
}

async function bajar(t) {
  let win = null;
  // Si mientras tanto se cancela, o se cancela y se reintenta, este intento ya no escribe nada:
  // reintentar le cambia la vuelta (`vez`), y el intento nuevo es otro
  const vez = t.vez;
  const vigente = () => t.vez === vez && t.estado !== 'cancelado';
  // Lo que hace falta para cortar este intento en el acto (cortarIntento): su ventana y su trabajo en el armador
  const intento = { vez, win: null, trabajo: null, cortado: false };
  t.intento = intento;
  try {
    let r = t.info;                                  // revisado a mano: ya se sabe qué páginas van
    let cortado = '';
    if (!r) {
      paso(t, 'abriendo');
      win = await abrirPagina(t.url, (w) => { intento.win = w; });
      if (!vigente()) return;
      paso(t, 'buscando páginas');
      r = await pedir(win, 'paginas', { recorrer: true }, 240000);
      if (!vigente()) return;
      // Si el sitio contestó 429 o 503 a una de las páginas mientras la página las cargaba, pidió
      // esperar: el sitio queda frenado, y el capítulo no se arma con las que cargaron (como cuando
      // lo dice el armador). Si ya estaba en la carpeta, sigue siendo "ya estaba".
      const deImagen = imagenQuePidioEsperar(win.webContents.id, r.urls);
      if (deImagen) {
        anotarEspera(t, deImagen);
        cortado = `no guardé nada, para no dejarlo a medias · el sitio pidió esperar (HTTP ${deImagen.status})`;
      }
    }
    const urls = t.elegidas || r.urls;
    if (urls.length < (t.elegidas ? 1 : 3)) {
      if (cortado) return paso(t, 'incompleto', cortado);
      throw new Error(`Sin páginas (encontré ${urls.length})`);
    }

    // Nombre: la serie escrita (o la del título) y el número de la lista (o el del título).
    // El tomo y el nombre del capítulo en la lista solo los usa una plantilla de nombres propia.
    const o = t.opciones;
    const numero = t.numero ?? r.capitulo?.numero ?? null;
    let ruta, serie = '';
    if (numero != null && !isNaN(numero)) {
      const delTitulo = String(r.titulo || '').split(/\s+\|\s+/)[0].replace(/\d+(\.\d+)?/g, ' ').replace(/\s+/g, ' ').trim();
      serie = nucleo.sanitizeSegment((o.serie || r.capitulo?.serie || delTitulo || 'Manga').replace(/\//g, '-'));
      let sitio = 'sitio';
      try { sitio = new URL(t.url).hostname.replace(/^www\./, '') || 'sitio'; } catch {}
      ruta = nucleo.nameFor({ serie, numero, volumen: t.volumen, titulo: t.titulo, sitio });
    } else {
      ruta = nucleo.sanitizePath(r.nombre);
    }
    t.nombre = ruta;
    // Saltear lo que ya está: con este nombre o, si se sabe la serie y el número, con cualquier otro
    if (o.saltear && (yaEsta(o.carpeta, ruta, o.formatos) || (serie && tieneTodo(enDisco(o.carpeta, serie).porNumero.get(numero), o.formatos)))) {
      return paso(t, 'ya estaba', 'ya está en la carpeta');
    }
    if (cortado) return paso(t, 'incompleto', cortado);

    paso(t, 'bajando', `0/${urls.length}`);
    const meta = { title: ruta.split('/').pop(), series: serie || undefined, number: numero ?? undefined,
                   arc: serie ? nucleo.sagaDe(serie, numero) : '', web: r.clave };
    let res;
    try {
      res = await armar({ urls, formatos: o.formatos, ruta, meta, carpeta: o.carpeta, referer: t.url },
        (hechas, total) => { if (vigente() && t.estado === 'bajando') paso(t, 'bajando', `${hechas}/${total}`); }, intento);
    } catch (e) {
      // El sitio pidió esperar con una página y el armador cortó: el capítulo queda incompleto, sin
      // ningún archivo, y el sitio frenado
      if (!e.esperar) throw e;
      anotarEspera(t, e.esperar);
      if (vigente()) { t.archivos = []; paso(t, 'incompleto', `no guardé nada, para no dejarlo a medias · el sitio pidió esperar (HTTP ${e.esperar.status})`); }
      return;
    }
    const escritos = res.archivos.filter(a => a.rel).map(a => a.rel);
    // (si mientras bajaba se reintentó, lo de este intento sobra: el nuevo lo vuelve a escribir entero)
    if (t.vez !== vez) { borrarEscritos(o.carpeta, escritos); return; }
    t.archivos = escritos;
    if (t.estado === 'cancelado') return;

    const errores = res.archivos.filter(a => a.error);
    const problemas = [];
    if (res.failed.length) problemas.push(res.failed.length === 1 ? `no bajó la página ${res.failed[0]}` : `no bajaron ${res.failed.length} páginas`);
    // Si faltaron porque el sitio pidió esperar (429 o 503), se dice y se anota cuánto pidió
    if (res.failed.length && res.esperar) { problemas.push(`el sitio pidió esperar (HTTP ${res.esperar.status})`); anotarEspera(t, res.esperar); }
    if (r.faltantes) problemas.push(r.faltantes === 1 ? '1 página no cargó' : `${r.faltantes} páginas no cargaron`);
    if (errores.length) problemas.push('no se pudo escribir: ' + errores[0].error);
    const fuera = t.elegidas ? 0 : (r.descartadas || 0);          // lo que el filtro dejó afuera como publicidad
    // Lo que salió entero queda en el registro de descargas
    if (!problemas.length) {
      anotarDescarga({ serie: serie || ruta.split('/')[0], numero: numero != null && !isNaN(numero) ? numero : null, ruta,
                       formatos: o.formatos, paginas: res.pages, url: r.clave || t.url });
    }
    paso(t, problemas.length ? 'incompleto' : 'listo', `${res.pages} páginas` + (fuera ? ` (${fuera} descartada${fuera === 1 ? '' : 's'} como publicidad)` : '') +
      (problemas.length ? ' · ' + problemas.join(' · ') : ''));
  } catch (e) {
    if (e.esperar && !intento.cortado) anotarEspera(t, e.esperar);      // el capítulo entero falló porque el sitio pidió esperar
    if (vigente()) paso(t, 'falló', String(e.message || e));
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    if (t.intento === intento) t.intento = null;
  }
}

// Cancela lo que falta. El capítulo en curso se corta en el acto (desde la 0.10.4: antes seguía
// hasta terminar el paso en el que estaba), y lo que alcanzó a escribir se borra.
function cancelar() {
  for (const t of cola) if (pendiente(t)) { cortarIntento(t); t.estado = 'cancelado'; t.detalle = ''; }
  avisar();
}
function limpiar() {
  for (let i = cola.length - 1; i >= 0; i--) if (!pendiente(cola[i])) cola.splice(i, 1);
  avisar();
}
// Vuelve a poner en la cola todo lo que falló, quedó incompleto o se canceló. Antes se corta el
// intento que siga en curso y se borran los archivos que esa misma tarea había escrito, para
// bajarlo entero de nuevo (si no, quedaría "nombre (1).pdf" al lado del que salió mal). Desde la
// 0.10.4 también los de un capítulo cancelado que alcanzó a escribir.
function reintentar() {
  let n = 0;
  for (const t of cola) {
    if (!SIN_TERMINAR.has(t.estado)) continue;
    cortarIntento(t);
    borrarEscritos(t.opciones.carpeta, t.archivos);
    t.archivos = [];
    t.estado = 'en cola';
    t.detalle = '';
    t.vez = (t.vez || 0) + 1;            // un intento que siga en curso ya no es este
    n++;
  }
  avisar();
  procesar();
  return n;
}
// Para las pruebas: espera a que no quede nada en cola ni en curso
async function colaVacia(ms = 180000) {
  const hasta = Date.now() + ms;
  while (trabajando || cola.some(pendiente)) {
    if (Date.now() > hasta) throw new Error('La cola no terminó a tiempo');
    await espera(200);
  }
  return cola.map(publico);
}

// ── Series que seguís ────────────────────────────────
// Cada una es la dirección de la página con sus capítulos y el nombre de la serie. "Buscar lo
// nuevo" abre esas páginas (de a una, con una pausa) y dice qué capítulos hay que no tenés.
// Siempre arranca con un toque tuyo: el programa no revisa nada por su cuenta.
const novedades = new Map();        // dirección → lo que encontró la última búsqueda
const verSeguidas = () => config.seguidas.map(x => ({ ...x, ...(novedades.get(x.url) || {}), items: undefined }));
function seguirSerie({ url, serie } = {}) {
  serie = String(serie || '').trim();
  if (!esWeb(url) || !serie) throw new Error('Para seguir una serie hace falta su dirección y su nombre (el cuadro "Serie")');
  const clave = claveDe(url);
  guardarConfig({ seguidas: [...config.seguidas.filter(x => claveDe(x.url) !== clave), { url: String(url), serie }] });
  return verSeguidas();
}
function dejarDeSeguir(url) {
  novedades.delete(url);
  guardarConfig({ seguidas: config.seguidas.filter(x => x.url !== url) });
  return verSeguidas();
}
// Qué hay de nuevo en una serie seguida: los capítulos de su página que no están en el disco,
// en tu colección ni en el registro. "nuevos" son los posteriores al último que tenés;
// "huecos", los que faltan más atrás.
async function novedadesDe(x) {
  const r = await analizar(x.url);
  const lista = r.listas.filter(l => l.tipo === 'capitulos').sort((a, b) => b.items.length - a.items.length)[0];
  if (!lista) throw new Error('No encontré la lista de capítulos en esa página');
  const items = lista.items.filter(i => Number.isFinite(i.numero));
  const d = revisarDisco({ serie: x.serie, numeros: items.map(i => i.numero) });
  const mios = new Set([...d.tengo, ...d.bajados.map(b => b.numero)]);
  const ultimo = mios.size ? Math.max(...mios) : -Infinity;
  const faltan = items.filter(i => !mios.has(i.numero));
  const nuevos = faltan.filter(i => i.numero > ultimo);
  return { cuantos: items.length, tengo: mios.size, nuevos: nuevos.length, rango: enRangos(nuevos.map(i => i.numero)),
           huecos: enRangos(faltan.filter(i => i.numero < ultimo).map(i => i.numero)), sinMirar: d.sinMirar.length,
           items: nuevos.map(i => ({ url: i.url, texto: i.texto, numero: i.numero, volumen: i.seccion || '', titulo: i.texto })) };
}
async function buscarNovedades() {
  for (const [k, x] of config.seguidas.entries()) {
    if (k) await espera(PRUEBA ? 50 : 1500);
    avance(`Buscando lo nuevo de ${x.serie} (${k + 1} de ${config.seguidas.length})…`);
    try { novedades.set(x.url, { ...(await novedadesDe(x)), error: '', revisada: new Date().toISOString() }); }
    catch (e) { novedades.set(x.url, { error: String(e.message || e), nuevos: 0, items: [], revisada: new Date().toISOString() }); }
  }
  return verSeguidas();
}
// Pone en la cola lo nuevo de una serie seguida (o de todas, sin dirección)
function bajarNovedades(url) {
  let n = 0;
  for (const x of config.seguidas) {
    const nov = novedades.get(x.url);
    if ((url && x.url !== url) || !nov || !nov.items.length) continue;
    encolar(nov.items, { serie: x.serie });
    n += nov.items.length;
    novedades.set(x.url, { ...nov, nuevos: 0, rango: '', items: [], enCola: nov.items.length });
  }
  return { encolados: n, seguidas: verSeguidas() };
}

// Las páginas de un capítulo, todas, con lo que el filtro marcó como publicidad: para
// revisarlas a mano antes de bajarlo
async function paginasDe(url) {
  const win = await abrirPagina(url);
  try { return await pedir(win, 'revisar', { recorrer: true }, 240000); }
  finally { win.destroy(); }
}

// ── Ventana del programa ─────────────────────────────
async function abrirUI(visible = true) {
  ui = new BrowserWindow({
    width: 1120, height: 820, minWidth: 760, minHeight: 560, show: false, backgroundColor: '#1a1a2e',
    title: 'Manga Reader',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload_ui.js') },
  });
  ui.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  ui.webContents.on('will-navigate', (e) => e.preventDefault());            // la interfaz no navega a ningún lado
  await ui.loadFile(path.join(__dirname, 'ui', 'index.html'));
  if (visible) ui.show();
  return ui;
}

// Pedidos de la interfaz. Los errores vuelven como texto, para mostrarlos tal cual.
// Cada canal tiene un manejador; `correr` es el camino por el que pasan los pedidos de la ventana
// y los botones del aviso de Windows: el mismo manejador, con el mismo manejo de errores.
const manejadores = new Map();
async function correr(canal, arg) {
  try { return { ok: true, valor: await manejadores.get(canal)(arg) }; }
  catch (err) { return { ok: false, error: String(err.message || err) }; }
}
function atender(canal, fn) {
  manejadores.set(canal, fn);
  ipcMain.handle(canal, async (e, arg) => {
    if (!ui || e.sender !== ui.webContents) return { ok: false, error: 'Pedido de una ventana desconocida' };
    return correr(canal, arg);
  });
}
// Un favorito como lo muestra la interfaz: con su resumen ("Manga · Español") y a qué filtro de tipo entra
const favorito = (s) => ({ ...s, resumen: sitios.resumenSitio(s),
  manga: sitios.filtrarSitios([s], { tipo: 'manga' }).length > 0, comics: sitios.filtrarSitios([s], { tipo: 'comics' }).length > 0 });

// Cómo quedaría guardado un capítulo con una plantilla de nombres: uno bajado desde una lista
// (con tomo y nombre) y uno suelto. Y los avisos: nombres que chocan, marcadores que no existen.
function vistaDePlantilla(texto) {
  const tpl = String(texto || '').trim() || nucleo.PLANTILLA_DEFECTO, anio = String(new Date().getFullYear());
  const muestra = (datos) => nucleo.aplicarPlantilla(tpl, { ...datos, anio, sitio: 'sitio.com' });
  return {
    lista: muestra({ serie: 'One Piece', saga: '01 East Blue', volumen: 'Tomo 1', numero: '0005', titulo: 'Capítulo 5' }),
    suelto: muestra({ serie: 'Naruto', saga: '', volumen: '', numero: '0300', titulo: '' }),
    choca: nucleo.plantillaColisiona(tpl), raros: nucleo.marcadoresDesconocidos(tpl), predeterminada: nucleo.PLANTILLA_DEFECTO,
  };
}

// Las últimas direcciones que se analizaron a mano (las más nuevas primero, sin repetir)
function agregarReciente({ url, titulo } = {}) {
  if (!esWeb(url)) return config.recientes;
  const clave = claveDe(url);
  const lista = [{ url: String(url), titulo: String(titulo || '').slice(0, 120) }, ...config.recientes.filter(r => r && claveDe(r.url) !== clave)].slice(0, 15);
  return guardarConfig({ recientes: lista }).recientes;
}

atender('analizar', (url) => analizar(String(url || '').trim()));
atender('seguir', ({ url, max, conocidas }) => seguir(url, Math.min(Math.max(1, +max || 10), 50), Array.isArray(conocidas) ? conocidas.map(String) : []));
atender('buscar-en-sitio', (dato) => buscarEnSitio(dato || {}));
atender('links', ({ texto, modo, desde }) => nucleo.chaptersFromLinks(texto, modo, desde));
atender('descargar', ({ items, opciones }) => encolar(items, opciones));
atender('cancelar', () => cancelar());
atender('limpiar', () => limpiar());
atender('config:leer', () => ({ ...config, nucleo: nucleo.version }));
atender('config:guardar', (c) => guardarConfig(c || {}));
atender('saga', ({ serie, numero }) => nucleo.sagaDe(serie, numero));
atender('guardados:leer', () => guardados.map(favorito));
atender('guardados:agregar', (dato) => { const r = guardarLinks(dato || {}); return { ...r, lista: r.lista.map(favorito) }; });
atender('guardados:quitar', (urls) => quitarLinks(urls).map(favorito));
atender('reintentar', () => reintentar());
atender('paginas', (url) => paginasDe(String(url || '').trim()));
atender('disco', (pedido) => revisarDisco(pedido || {}));
atender('plantilla:vista', (texto) => vistaDePlantilla(texto));
atender('sagas:revisar', (texto) => { const r = parseSagas(String(texto || '')); return { series: Object.keys(r.table).length, errores: r.errors }; });
atender('reciente', (dato) => agregarReciente(dato || {}));
atender('titulos', (pedido) => revisarTitulos(pedido || {}));
atender('registro:leer', () => verRegistro());
atender('registro:quitar', (clave) => quitarDelRegistro(String(clave || '')));
// Tu colección: carpetas donde también se mira lo que ya tenés (por ejemplo, la de Google Drive)
atender('biblioteca:agregar', async () => {
  const r = await dialog.showOpenDialog(ui, { title: 'Una carpeta de tu colección', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return config.bibliotecas;
  return guardarConfig({ bibliotecas: [...new Set([...config.bibliotecas, r.filePaths[0]])] }).bibliotecas;
});
atender('carpetas', () => ({ sinMirar: sinMirar(config.carpeta) }));
atender('vincular', async ({ serie, carpeta } = {}) => {
  if (!carpeta) {                    // sin carpeta: se elige con el diálogo
    const r = await dialog.showOpenDialog(ui, { title: `La carpeta donde tenés ${serie}`, properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return config.vinculos[claveSerie(serie)] || [];
    carpeta = r.filePaths[0];
  }
  return vincular(serie, carpeta);
});
atender('desvincular', (serie) => desvincular(String(serie || '')));
atender('seguidas:leer', () => verSeguidas());
atender('seguidas:seguir', (dato) => seguirSerie(dato || {}));
atender('seguidas:dejar', (url) => dejarDeSeguir(String(url || '')));
atender('seguidas:buscar', () => buscarNovedades());
atender('seguidas:bajar', (url) => bajarNovedades(url ? String(url) : ''));
atender('biblioteca:quitar', (carpeta) => guardarConfig({ bibliotecas: config.bibliotecas.filter(c => c !== carpeta) }).bibliotecas);
atender('tapa', ({ url, pagina }) => tapa(String(url || ''), String(pagina || '')));
atender('carpeta', async () => {
  const r = await dialog.showOpenDialog(ui, { title: 'Carpeta donde guardar', defaultPath: config.carpeta, properties: ['openDirectory', 'createDirectory'] });
  return r.canceled || !r.filePaths[0] ? config.carpeta : guardarConfig({ carpeta: r.filePaths[0] }).carpeta;
});
// (en las pruebas de siempre no se abre el Explorador: se anota qué carpeta se habría abierto)
const carpetasAbiertas = [];
atender('abrir-carpeta', async () => {
  await fs.promises.mkdir(config.carpeta, { recursive: true });
  if (PRUEBA && !AVISOS) { carpetasAbiertas.push(config.carpeta); return ''; }
  return shell.openPath(config.carpeta);
});

// ── Proxy de prueba (tests/proxy.js) ─────────────────
// Con MR_PROXY=<dirección del proxy> o --proxy=<dirección>, todo lo que se le pide al sitio que
// está detrás del proxy pasa por él: así se puede provocar un 429 o un 503 de verdad contra un
// sitio real. El proxy dice a qué sitio reenvía (en /__proxy). Sin eso no se registra nada y
// todo va directo, como siempre.
let proxyActual = null;
async function usarProxy(proxy, sitio) {
  const ses = session.fromPartition(PARTICION);
  if (!proxy) { ses.webRequest.onBeforeRequest(null); proxyActual = null; return null; }
  proxy = new URL(proxy).origin;
  if (!sitio) {
    const r = await fetch(proxy + '/__proxy', { signal: AbortSignal.timeout(5000) });
    sitio = (await r.json()).sitio;
  }
  sitio = new URL(sitio).origin;
  // (lo que ya estaba en la caché no pasaría por el proxy: se borra al empezar a usarlo)
  await ses.clearCache();
  ses.webRequest.onBeforeRequest((d, cb) => cb(d.url.startsWith(sitio + '/') ? { redirectURL: proxy + d.url.slice(sitio.length) } : {}));
  proxyActual = { proxy, sitio };
  return proxyActual;
}
const proxyPedido = () => process.env.MR_PROXY || (process.argv.find(a => a.startsWith('--proxy=')) || '').slice('--proxy='.length);

// ── El primer aviso de Windows ───────────────────────
// Windows muestra en pantalla los avisos de una aplicación que tiene un acceso directo en el menú
// Inicio con su identificador (AUMID). Si no lo hay, Electron lo crea la primera vez que muestra un
// aviso, y ese primero va directo al centro de notificaciones, sin salir en pantalla: el primer lote
// que terminaba no avisaba. Desde la 0.10.4, al arrancar, si ese acceso directo todavía no está, se
// muestra un aviso mudo que se cierra enseguida: Electron crea el acceso directo y el primer aviso de
// verdad ya sale en pantalla. Con el programa instalado, el acceso directo lo crea el instalador.
// Windows tarda en tomar el acceso directo nuevo: un aviso que llega en el primer segundo se pierde,
// y arrastra a los que vienen unos segundos detrás (medido el 25-11-2026: a 0,5 y 1 s se perdieron,
// y con ellos uno a los 9 s; a 2 y 5 s salieron, 4 de 4). Por eso, si la cola termina en ese rato,
// su aviso espera hasta AVISO_TRAS_ACCESO después de que aparece el acceso directo.
const AVISO_TRAS_ACCESO = 5000;
let avisosListos = Promise.resolve();     // se cumple cuando un aviso ya puede salir en pantalla
let estadoAvisos = '';                    // qué se hizo al arrancar (para las pruebas)
function accesoDelPrograma() {
  const raices = [path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
                  path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs')];
  // Primero los que están sueltos en el menú Inicio (ahí lo deja Electron, y también el instalador) y
  // después los de las carpetas: leer cada uno cuesta, y así el de todos los días aparece enseguida
  // (medido el 25-11-2026 con 191 accesos directos: de 140 a 280 ms leerlos todos)
  const sueltos = [], enCarpetas = [];
  const recorrer = (d, nivel) => {
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (nivel < 3) recorrer(p, nivel + 1); }
      else if (/\.lnk$/i.test(e.name)) (nivel ? enCarpetas : sueltos).push(p);
    }
  };
  raices.forEach(r => recorrer(r, 0));
  const esDelPrograma = (p) => { try { return shell.readShortcutLink(p).appUserModelId === AUMID; } catch { return false; } };
  return sueltos.find(esDelPrograma) || enCarpetas.find(esDelPrograma) || '';
}
function prepararAvisos() {
  if (process.platform !== 'win32' || !Notification.isSupported()) { estadoAvisos = 'sin avisos de Windows'; return; }
  const ya = accesoDelPrograma();
  if (ya) { estadoAvisos = 'el acceso directo ya estaba: ' + path.basename(ya); return; }
  const mudo = new Notification({ title: 'Manga Reader', body: 'Listo para avisarte cuando termine la cola.', silent: true });
  mudo.show();
  setTimeout(() => { try { mudo.close(); } catch {} }, 2000);
  estadoAvisos = 'aviso mudo al arrancar: esperando el acceso directo';
  avisosListos = (async () => {
    let creado = '';
    for (let i = 0; i < 25 && !(creado = accesoDelPrograma()); i++) await espera(200);
    estadoAvisos = creado ? 'acceso directo creado al arrancar: ' + path.basename(creado) : 'aviso mudo al arrancar, pero el acceso directo no apareció en 5 s';
    await espera(AVISO_TRAS_ACCESO);
  })();
}

// ── Arranque ─────────────────────────────────────────
if (!PRUEBA && !HUMO && !app.requestSingleInstanceLock({ proxy: proxyPedido() })) {
  if (proxyPedido()) console.log('El programa ya está abierto: MR_PROXY o --proxy= no se aplican a esa ventana. La que está abierta lo avisa, con un botón para cerrarla y abrirla de nuevo con el proxy.');
  app.quit();
}
// Se abrió otra vez. Si fue con el proxy de prueba y esta ventana no lo usa (o usa otro), la ventana
// lo dice, con un botón para cerrar y abrir de nuevo con él (0.10.4: hasta la 0.10.3 solo lo decía la consola)
let proxyEnEspera = '';
app.on('second-instance', (_e, argv, _dir, datos) => {
  if (ui && !ui.isDestroyed()) { if (ui.isMinimized()) ui.restore(); ui.focus(); }
  const pedido = (datos && datos.proxy) || (argv.find(a => a.startsWith('--proxy=')) || '').slice('--proxy='.length);
  let origen = '';
  try { origen = pedido ? new URL(pedido).origin : ''; } catch {}
  if (!origen || origen === proxyActual?.proxy) return;
  proxyEnEspera = origen;
  if (ui && !ui.isDestroyed()) ui.webContents.send('aviso-proxy', { proxy: origen, actual: proxyActual?.proxy || '' });
  console.log(`[aviso-proxy] se pidió el proxy ${origen} con el programa ya abierto ${proxyActual ? 'con otro' : 'sin él'}`);
});
// El botón del aviso: cierra y abre de nuevo, con el proxy pedido
atender('reabrir-con-proxy', () => {
  if (!proxyEnEspera) throw new Error('No hay ningún proxy pedido');
  app.relaunch({ args: process.argv.slice(1).filter(a => !a.startsWith('--proxy=')).concat('--proxy=' + proxyEnEspera) });
  setTimeout(() => app.exit(0), 300);
  return true;
});
app.on('window-all-closed', () => { if (!PRUEBA) app.quit(); });

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  // (con MR_DATOS, que es de las pruebas, no se toca el menú Inicio)
  if ((!PRUEBA || AVISOS) && !HUMO && !process.env.MR_DATOS) prepararAvisos();
  leerConfig();
  if (!PRUEBA) { leerGuardados(); leerRegistro(); }      // las pruebas arrancan con todo vacío y no lo escriben
  prepararSesion();
  if (HUMO) {
    try {
      await abrirUI(false);
      const interfaz = await ui.webContents.executeJavaScript('typeof mr + " · " + document.querySelectorAll("button").length + " botones"');
      await prepararArmador();
      const arma = await armador.webContents.executeJavaScript('typeof armar');
      console.log(`HUMO OK · interfaz: ${interfaz} · armador: ${arma} · núcleo: ${nucleo.version} · datos: ${app.getPath('userData')} · colección: ${config.bibliotecas.length} carpeta(s), ${config.bibliotecas.filter(c => fs.existsSync(c)).length} a la vista`);
      app.exit(0);
    } catch (e) {
      console.log('HUMO FALLA · ' + (e.stack || e));
      app.exit(1);
    }
    return;
  }
  if (PRUEBA) {
    // "electron . --prueba": corre las pruebas del programa contra un sitio de prueba local
    // (con --avisos, la del aviso de Windows y sus botones apretados de verdad)
    const archivoDePrueba = AVISOS ? 'avisos.js' : 'prueba.js';
    const fallas = await require(DIR_PRUEBAS ? path.resolve(DIR_PRUEBAS, archivoDePrueba) : '../tests/' + archivoDePrueba)({ analizar, seguir, buscarEnSitio, encolar, colaVacia, cancelar, limpiar, guardarConfig, abrirUI, nucleo,
      guardarLinks, quitarLinks, guardados: () => guardados, tapa, reintentar, paginasDe, revisarDisco, vistaDePlantilla, agregarReciente,
      revisarTitulos, verRegistro, quitarDelRegistro, vincular, desvincular, sinMirar, seguirSerie, dejarDeSeguir, buscarNovedades, bajarNovedades, ultimoAviso: () => ultimoAviso, config: () => config,
      // el freno, el proxy y el aviso de fin de cola
      verCola: () => cola.map(publico), usarProxy, esperaDe: (url) => Math.max(0, (noAntesDe.get(sitioDe(url)) || 0) - Date.now()), olvidarEsperas: () => noAntesDe.clear(),
      armarAvisoDeFin, mostrarAvisoDeFin, avisoDeFin: () => avisoDeFin, carpetasAbiertas,
      // (0.10.4) por dónde se supo que la página pidió esperar, las ventanas de páginas abiertas y
      // una demora antes de escribir cada archivo del armador (para cortar un intento en el medio)
      ultimaDeteccion: () => ultimaDeteccion, ventanasDePaginas: () => [...ventanasDePaginas], demorarGuardado: (ms) => { demoraDeGuardado = +ms || 0; },
      estadoAvisos: () => estadoAvisos, empaquetado: app.isPackaged, ejecutable: process.execPath })
      .catch((e) => { console.log('FALLA la prueba se cortó: ' + (e.stack || e)); return 1; });
    app.exit(fallas ? 1 : 0);
    return;
  }
  // Con el proxy de prueba pedido (MR_PROXY o --proxy=), lo del sitio de atrás pasa por él
  if (proxyPedido()) {
    await usarProxy(proxyPedido()).then(
      (p) => console.log(`Proxy de prueba: lo de ${p.sitio} pasa por ${p.proxy}`),
      (e) => console.log(`No pude usar el proxy de prueba (${proxyPedido()}): ${e.message}. Sigo sin él.`));
  }
  await abrirUI();
  if (proxyActual) ui.setTitle(`Manga Reader · por el proxy de prueba (${proxyActual.proxy})`);
});
