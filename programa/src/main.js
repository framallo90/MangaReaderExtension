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

const PARTICION = 'persist:paginas';          // sesión de las páginas web: cookies aparte de las del programa
const PRUEBA = process.argv.includes('--prueba');
// "--humo": arranque de prueba, sobre todo para el programa ya empaquetado. Abre la interfaz y el
// armador sin mostrarlos, dice si anduvo y sale. No toca la configuración ni los favoritos.
const HUMO = process.argv.includes('--humo');
const espera = (ms) => new Promise(r => setTimeout(r, ms));
// Los datos (configuración y favoritos) van siempre a la misma carpeta, se abra el programa
// con "npm start" o instalado: si no, al instalarlo arrancaría sin los favoritos.
app.setPath('userData', path.join(app.getPath('appData'), 'manga-reader-programa'));
app.setAppUserModelId('ar.mangareader.programa');     // para que Windows muestre los avisos con el nombre del programa

// ── Configuración ────────────────────────────────────
// plantilla: la plantilla de nombres ('' = la de siempre) · sagasTexto: las sagas propias, como
// se escriben · recientes: las últimas direcciones analizadas a mano · tapas: lista en mosaico
let config = { carpeta: '', formatos: { pdf: true, cbz: false, imgs: false }, saltear: true, tapas: true,
               plantilla: '', sagasTexto: '', recientes: [] };
const archivoConfig = () => path.join(app.getPath('userData'), 'config.json');
function leerConfig() {
  if (!PRUEBA) { try { config = { ...config, ...JSON.parse(fs.readFileSync(archivoConfig(), 'utf8')) }; } catch {} }      // las pruebas arrancan con todo de fábrica
  if (!config.carpeta) config.carpeta = path.join(app.getPath('downloads'), 'MangaReader');
  if (!Array.isArray(config.recientes)) config.recientes = [];
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
    cb({ requestHeaders: d.requestHeaders });
  });
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
  m.ok ? p.res(m.valor) : p.rej(new Error(m.error || 'Error en la página'));
});

function pedir(win, cmd, args = {}, ms = 60000) {
  return new Promise((res, rej) => {
    if (win.isDestroyed()) return rej(new Error('La página se cerró'));
    const id = ++seq;
    const t = setTimeout(() => { pendientes.delete(id); rej(new Error('La página no respondió')); }, ms);
    pendientes.set(id, { res, rej, t });
    win.webContents.send('mr:cmd', { id, cmd, args });
  });
}

// Abre la dirección en una ventana oculta y espera a que termine de armarse (los sitios que
// dibujan la página con JavaScript tardan un poco más que la carga).
async function abrirPagina(url) {
  if (!/^https?:\/\//i.test(url || '')) throw new Error('La dirección tiene que empezar con http:// o https://');
  const win = new BrowserWindow({
    show: false, width: 1280, height: 900,
    webPreferences: {
      offscreen: true,                           // dibuja sin mostrarse: la carga diferida de imágenes funciona
      sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
      partition: PARTICION, preload: path.join(__dirname, '..', 'generado', 'pagina.js'),
    },
  });
  try {
    const wc = win.webContents;
    wc.setAudioMuted(true);
    wc.setFrameRate(10);
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    let codigo = 0;
    wc.on('did-navigate', (_e, _u, c) => { codigo = c; });

    let vencio = false;
    const limite = setTimeout(() => { vencio = true; wc.stop(); }, 45000);
    await win.loadURL(url).catch((e) => { if (!/ERR_ABORTED/.test(e.message)) throw new Error(mensajeDeCarga(e)); });
    clearTimeout(limite);
    if (codigo >= 400) throw new Error(`La página respondió HTTP ${codigo}`);

    // Armada = la misma cantidad de imágenes y de links en tres consultas seguidas
    let antes = '', iguales = 0;
    for (let i = 0; i < 24 && iguales < 3; i++) {
      await espera(500);
      const c = await pedir(win, 'contar', {}, 8000).catch(() => null);
      const ahora = c ? `${c.imagenes}/${c.links}/${c.listo}` : '';
      iguales = c && c.listo && ahora === antes ? iguales + 1 : 0;
      antes = ahora;
    }
    if (vencio && !antes) throw new Error('La página tardó demasiado en cargar');
    return win;
  } catch (e) {
    win.destroy();
    throw e;
  }
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
  const base = path.resolve(t.carpeta);
  let destino = path.resolve(base, ...String(rel).split('/'));
  if (!destino.startsWith(base + path.sep)) throw new Error('Nombre de archivo no válido');
  await fs.promises.mkdir(path.dirname(destino), { recursive: true });
  // Si ya existe, no se pisa: "nombre (1).pdf", como hace el navegador
  const { dir, name, ext } = path.parse(destino);
  for (let n = 1; fs.existsSync(destino); n++) destino = path.join(dir, `${name} (${n})${ext}`);
  await fs.promises.writeFile(destino, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  return { rel: path.relative(base, destino).split(path.sep).join('/') };
});

// Baja las páginas una vez y escribe lo pedido en carpeta/ruta.pdf, .cbz y/o carpeta/ruta/pagina_NNN.ext
async function armar({ urls, formatos, ruta, meta, carpeta, referer }, progreso) {
  const win = await prepararArmador();
  const jobId = crypto.randomUUID();
  trabajos.set(jobId, { carpeta, progreso: progreso || (() => {}) });
  refererActual = referer || '';
  try {
    const msg = { urls, formats: formatos, title: ruta.split('/').pop(), meta, jobId, path: ruta };
    return await win.webContents.executeJavaScript(`armar(${JSON.stringify(msg)})`, true);
  } finally {
    trabajos.delete(jobId);
    refererActual = '';
  }
}

// ── Lo que ya está en el disco ───────────────────────
// Sirve para marcar en la lista lo que ya se bajó y para no repetirlo, aunque haya quedado
// con otro nombre de archivo o en una carpeta que se llama casi igual ("One Piece" y
// "One Piece Manga"). No se comparan series por parecido: "Dragon Ball" y "Dragon Ball
// Super" son dos, y tomar una por la otra haría saltear capítulos que faltan.
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// El nombre de una serie sin lo que cambia de un sitio a otro: mayúsculas, acentos, signos y
// palabras de relleno ("manga", "leer", "online", "español")
const claveSerie = (nombre) => sinAcentos(nombre)
  .replace(/\b(?:manga|manhwa|manhua|comics?|leer|read|online|espanol|castellano|spanish|english|ingles|gratis|free)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, '');

// Capítulos de una serie que ya están en `carpeta`: número → qué hay ('pdf', 'cbz', 'imgs').
// Devuelve { porNumero, carpetas }, con las carpetas de la serie que se encontraron.
function enDisco(carpeta, serie) {
  const clave = claveSerie(serie), porNumero = new Map();
  let carpetas = [];
  if (!clave) return { porNumero, carpetas };
  try {
    carpetas = fs.readdirSync(carpeta, { withFileTypes: true }).filter(d => d.isDirectory() && claveSerie(d.name) === clave).map(d => d.name);
  } catch {}
  const anotar = (nombre, tipo) => {
    // El número es el primero de 4 o 5 cifras del nombre, sin contar los que traiga la serie ("2001 Nights 0005")
    let n = nombre.replace(/\.(?:pdf|cbz)$/i, '').replace(/ \(\d+\)$/, '');
    if (sinAcentos(n).startsWith(sinAcentos(serie))) n = n.slice(String(serie).length);
    const m = n.match(/(?<![\d.])(\d{4,5}(?:\.\d+)?)(?!\d)/);
    if (!m) return false;
    const numero = parseFloat(m[1]);
    if (!porNumero.has(numero)) porNumero.set(numero, new Set());
    porNumero.get(numero).add(tipo);
    return true;
  };
  const mirar = (dir, nivel) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const ruta = path.join(dir, e.name);
      if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (ext === '.pdf' || ext === '.cbz') anotar(e.name, ext.slice(1));
      } else if (e.isDirectory()) {
        let suyas = false;                           // ¿es la carpeta de imágenes de un capítulo?
        try { suyas = fs.readdirSync(ruta).some(n => /^pagina_\d+\./.test(n)); } catch {}
        if (suyas) anotar(e.name, 'imgs');
        else if (nivel < 3) mirar(ruta, nivel + 1);  // una carpeta de saga, de tomo o de año
      }
    }
  };
  for (const c of carpetas) mirar(path.join(carpeta, c), 0);
  return { porNumero, carpetas };
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
// Para la lista de capítulos de una serie: cuáles ya están en la carpeta y cuáles faltan
function revisarDisco({ serie, numeros, carpeta, formatos } = {}) {
  const f = { ...config.formatos, ...(formatos || {}) };
  const lista = (Array.isArray(numeros) ? numeros : []).filter(Number.isFinite);
  const { porNumero, carpetas } = enDisco(carpeta || config.carpeta, String(serie || ''));
  const tengo = lista.filter(n => tieneTodo(porNumero.get(n), f));
  const faltan = lista.filter(n => !tieneTodo(porNumero.get(n), f));
  return { tengo, faltan: enRangos(faltan), cuantosFaltan: faltan.length, carpetas };
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

async function procesar() {
  if (trabajando) return;
  trabajando = true;
  for (let t; (t = cola.find(x => x.estado === 'en cola'));) {
    await bajar(t);
    if (cola.some(x => x.estado === 'en cola')) await espera(PRUEBA ? 100 : 1500);      // respiro entre capítulos, para no cargar al sitio
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
  if (PRUEBA || !ui || ui.isDestroyed() || ui.isFocused()) return;
  ui.flashFrame(true);
  ui.once('focus', () => ui.flashFrame(false));
  if (Notification.isSupported()) {
    const aviso = new Notification({ title: 'Manga Reader: terminó la cola', body: ultimoAviso });
    aviso.on('click', () => { if (ui && !ui.isDestroyed()) { if (ui.isMinimized()) ui.restore(); ui.focus(); } });
    aviso.show();
  }
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
  try {
    let r = t.info;                                  // revisado a mano: ya se sabe qué páginas van
    if (!r) {
      paso(t, 'abriendo');
      win = await abrirPagina(t.url);
      if (t.estado === 'cancelado') return;
      paso(t, 'buscando páginas');
      r = await pedir(win, 'paginas', { recorrer: true }, 240000);
      if (t.estado === 'cancelado') return;
    }
    const urls = t.elegidas || r.urls;
    if (urls.length < (t.elegidas ? 1 : 3)) throw new Error(`Sin páginas (encontré ${urls.length})`);

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

    paso(t, 'bajando', `0/${urls.length}`);
    const meta = { title: ruta.split('/').pop(), series: serie || undefined, number: numero ?? undefined,
                   arc: serie ? nucleo.sagaDe(serie, numero) : '', web: r.clave };
    const res = await armar({ urls, formatos: o.formatos, ruta, meta, carpeta: o.carpeta, referer: t.url },
      (hechas, total) => { if (t.estado === 'bajando') paso(t, 'bajando', `${hechas}/${total}`); });
    t.archivos = res.archivos.filter(a => a.rel).map(a => a.rel);
    if (t.estado === 'cancelado') return;

    const errores = res.archivos.filter(a => a.error);
    const problemas = [];
    if (res.failed.length) problemas.push(res.failed.length === 1 ? `no bajó la página ${res.failed[0]}` : `no bajaron ${res.failed.length} páginas`);
    if (r.faltantes) problemas.push(r.faltantes === 1 ? '1 página no cargó' : `${r.faltantes} páginas no cargaron`);
    if (errores.length) problemas.push('no se pudo escribir: ' + errores[0].error);
    const fuera = t.elegidas ? 0 : (r.descartadas || 0);          // lo que el filtro dejó afuera como publicidad
    paso(t, problemas.length ? 'incompleto' : 'listo', `${res.pages} páginas` + (fuera ? ` (${fuera} descartada${fuera === 1 ? '' : 's'} como publicidad)` : '') +
      (problemas.length ? ' · ' + problemas.join(' · ') : ''));
  } catch (e) {
    if (t.estado !== 'cancelado') paso(t, 'falló', String(e.message || e));
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}

// Cancela lo que falta. El capítulo en curso se corta al terminar el paso en el que está.
function cancelar() {
  for (const t of cola) if (pendiente(t)) { t.estado = 'cancelado'; t.detalle = ''; }
  avisar();
}
function limpiar() {
  for (let i = cola.length - 1; i >= 0; i--) if (!pendiente(cola[i])) cola.splice(i, 1);
  avisar();
}
// Vuelve a poner en la cola todo lo que falló, quedó incompleto o se canceló. De lo incompleto
// se borran antes los archivos que esa misma tarea había escrito, para bajarlo entero de nuevo
// (si no, quedaría "nombre (1).pdf" al lado del que salió mal).
function reintentar() {
  let n = 0;
  for (const t of cola) {
    if (!SIN_TERMINAR.has(t.estado)) continue;
    if (t.estado === 'incompleto') {
      for (const rel of t.archivos) { try { fs.rmSync(path.join(t.opciones.carpeta, ...rel.split('/')), { force: true }); } catch {} }
    }
    t.archivos = [];
    t.estado = 'en cola';
    t.detalle = '';
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
function atender(canal, fn) {
  ipcMain.handle(canal, async (e, arg) => {
    if (!ui || e.sender !== ui.webContents) return { ok: false, error: 'Pedido de una ventana desconocida' };
    try { return { ok: true, valor: await fn(arg) }; }
    catch (err) { return { ok: false, error: String(err.message || err) }; }
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
atender('tapa', ({ url, pagina }) => tapa(String(url || ''), String(pagina || '')));
atender('carpeta', async () => {
  const r = await dialog.showOpenDialog(ui, { title: 'Carpeta donde guardar', defaultPath: config.carpeta, properties: ['openDirectory', 'createDirectory'] });
  return r.canceled || !r.filePaths[0] ? config.carpeta : guardarConfig({ carpeta: r.filePaths[0] }).carpeta;
});
atender('abrir-carpeta', async () => {
  await fs.promises.mkdir(config.carpeta, { recursive: true });
  return shell.openPath(config.carpeta);
});

// ── Arranque ─────────────────────────────────────────
if (!PRUEBA && !HUMO && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (ui && !ui.isDestroyed()) { if (ui.isMinimized()) ui.restore(); ui.focus(); } });
app.on('window-all-closed', () => { if (!PRUEBA) app.quit(); });

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  leerConfig();
  if (!PRUEBA) leerGuardados();               // las pruebas arrancan con la lista vacía y no la escriben
  prepararSesion();
  if (HUMO) {
    try {
      await abrirUI(false);
      const interfaz = await ui.webContents.executeJavaScript('typeof mr + " · " + document.querySelectorAll("button").length + " botones"');
      await prepararArmador();
      const arma = await armador.webContents.executeJavaScript('typeof armar');
      console.log(`HUMO OK · interfaz: ${interfaz} · armador: ${arma} · núcleo: ${nucleo.version} · datos: ${app.getPath('userData')}`);
      app.exit(0);
    } catch (e) {
      console.log('HUMO FALLA · ' + (e.stack || e));
      app.exit(1);
    }
    return;
  }
  if (PRUEBA) {
    // "electron . --prueba": corre las pruebas del programa contra un sitio de prueba local
    const fallas = await require('../tests/prueba.js')({ analizar, seguir, encolar, colaVacia, cancelar, limpiar, guardarConfig, abrirUI, nucleo,
      guardarLinks, quitarLinks, guardados: () => guardados, tapa, reintentar, paginasDe, revisarDisco, vistaDePlantilla, agregarReciente,
      ultimoAviso: () => ultimoAviso, config: () => config })
      .catch((e) => { console.log('FALLA la prueba se cortó: ' + (e.stack || e)); return 1; });
    app.exit(fallas ? 1 : 0);
    return;
  }
  await abrirUI();
});
