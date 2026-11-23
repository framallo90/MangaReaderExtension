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
const { app, BrowserWindow, ipcMain, dialog, session, shell, Menu, nativeImage } = require('electron');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const nucleo = require('../generado/nucleo.js');
const sitios = require('../generado/sitios.js');     // leer una lista de links pegada, igual que la extensión

const PARTICION = 'persist:paginas';          // sesión de las páginas web: cookies aparte de las del programa
const PRUEBA = process.argv.includes('--prueba');
const espera = (ms) => new Promise(r => setTimeout(r, ms));

// ── Configuración ────────────────────────────────────
let config = { carpeta: '', formatos: { pdf: true, cbz: false, imgs: false }, saltear: true };
const archivoConfig = () => path.join(app.getPath('userData'), 'config.json');
function leerConfig() {
  try { config = { ...config, ...JSON.parse(fs.readFileSync(archivoConfig(), 'utf8')) }; } catch {}
  if (!config.carpeta) config.carpeta = path.join(app.getPath('downloads'), 'MangaReader');
}
function guardarConfig(c) {
  config = { ...config, ...c, formatos: { ...config.formatos, ...(c.formatos || {}) } };
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
  const tengo = new Set(guardados.map(s => sitios.claveUrl(s.url)));
  let agregados = 0;
  for (const s of leidos) {
    const clave = sitios.claveUrl(s.url);
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
  const fuera = urls === 'todos' ? null : new Set((Array.isArray(urls) ? urls : [urls]).map(u => sitios.claveUrl(u)));
  guardados = fuera ? guardados.filter(s => !fuera.has(sitios.claveUrl(s.url))) : [];
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

// ── Cola de descargas ────────────────────────────────
const cola = [];                     // { id, url, texto, numero, opciones, estado, detalle, nombre }
let trabajando = false, ui = null;
const ACTIVOS = new Set(['abriendo', 'buscando páginas', 'bajando']);
const publico = (t) => ({ id: t.id, url: t.url, texto: t.texto, numero: t.numero, estado: t.estado, detalle: t.detalle, nombre: t.nombre });
function avisar() { if (ui && !ui.isDestroyed()) ui.webContents.send('cola', cola.map(publico)); }
function paso(t, estado, detalle = '') { t.estado = estado; t.detalle = detalle; avisar(); }

function encolar(items, opciones) {
  const o = { serie: String(opciones?.serie || '').trim(), carpeta: opciones?.carpeta || config.carpeta,
              formatos: { ...config.formatos, ...(opciones?.formatos || {}) }, saltear: opciones?.saltear ?? config.saltear };
  if (!o.formatos.pdf && !o.formatos.cbz && !o.formatos.imgs) throw new Error('Elegí al menos un formato');
  for (const i of items || []) {
    if (!/^https?:\/\//i.test(i?.url || '')) continue;
    cola.push({ id: crypto.randomUUID(), url: i.url, texto: String(i.texto || ''), numero: Number.isFinite(i.numero) ? i.numero : null,
                opciones: o, estado: 'en cola', detalle: '', nombre: '' });
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
}

const existe = (p) => { try { return fs.statSync(p); } catch { return null; } };
// ¿Ya está en el disco todo lo que se pidió?
function yaEsta(carpeta, ruta, f) {
  const base = path.join(carpeta, ...ruta.split('/'));
  const imgs = () => { try { return fs.readdirSync(base).some(n => /^pagina_\d+\./.test(n)); } catch { return false; } };
  return (!f.pdf || !!existe(base + '.pdf')) && (!f.cbz || !!existe(base + '.cbz')) && (!f.imgs || imgs());
}

async function bajar(t) {
  let win = null;
  try {
    paso(t, 'abriendo');
    win = await abrirPagina(t.url);
    if (t.estado === 'cancelado') return;
    paso(t, 'buscando páginas');
    const r = await pedir(win, 'paginas', { recorrer: true }, 240000);
    if (t.estado === 'cancelado') return;
    if (r.urls.length < 3) throw new Error(`Sin páginas (encontré ${r.urls.length})`);

    // Nombre: la serie escrita (o la del título) y el número de la lista (o el del título)
    const o = t.opciones;
    const numero = t.numero ?? r.capitulo?.numero ?? null;
    let ruta, serie = '';
    if (numero != null && !isNaN(numero)) {
      const delTitulo = r.titulo.split(/\s+\|\s+/)[0].replace(/\d+(\.\d+)?/g, ' ').replace(/\s+/g, ' ').trim();
      serie = nucleo.sanitizeSegment((o.serie || r.capitulo?.serie || delTitulo || 'Manga').replace(/\//g, '-'));
      ruta = nucleo.nameFor({ serie, numero });
    } else {
      ruta = nucleo.sanitizePath(r.nombre);
    }
    t.nombre = ruta;
    if (o.saltear && yaEsta(o.carpeta, ruta, o.formatos)) return paso(t, 'ya estaba', 'ya está en la carpeta');

    paso(t, 'bajando', `0/${r.urls.length}`);
    const partes = ruta.split('/');
    const meta = { title: partes[partes.length - 1], series: serie || undefined, number: numero ?? undefined,
                   arc: partes.length >= 3 ? partes[partes.length - 2].replace(/^\d+\s+/, '') : '', web: r.clave };
    const res = await armar({ urls: r.urls, formatos: o.formatos, ruta, meta, carpeta: o.carpeta, referer: t.url },
      (hechas, total) => { if (t.estado === 'bajando') paso(t, 'bajando', `${hechas}/${total}`); });
    if (t.estado === 'cancelado') return;

    const errores = res.archivos.filter(a => a.error);
    const problemas = [];
    if (res.failed.length) problemas.push(res.failed.length === 1 ? `no bajó la página ${res.failed[0]}` : `no bajaron ${res.failed.length} páginas`);
    if (r.faltantes) problemas.push(r.faltantes === 1 ? '1 página no cargó' : `${r.faltantes} páginas no cargaron`);
    if (errores.length) problemas.push('no se pudo escribir: ' + errores[0].error);
    paso(t, problemas.length ? 'incompleto' : 'listo', `${res.pages} páginas` + (problemas.length ? ' · ' + problemas.join(' · ') : ''));
  } catch (e) {
    if (t.estado !== 'cancelado') paso(t, 'falló', String(e.message || e));
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}

// Cancela lo que falta. El capítulo en curso se corta al terminar el paso en el que está.
function cancelar() {
  for (const t of cola) if (t.estado === 'en cola' || ACTIVOS.has(t.estado)) { t.estado = 'cancelado'; t.detalle = ''; }
  avisar();
}
function limpiar() {
  for (let i = cola.length - 1; i >= 0; i--) if (cola[i].estado !== 'en cola' && !ACTIVOS.has(cola[i].estado)) cola.splice(i, 1);
  avisar();
}
// Para las pruebas: espera a que no quede nada en cola ni en curso
async function colaVacia(ms = 180000) {
  const hasta = Date.now() + ms;
  while (trabajando || cola.some(t => t.estado === 'en cola' || ACTIVOS.has(t.estado))) {
    if (Date.now() > hasta) throw new Error('La cola no terminó a tiempo');
    await espera(200);
  }
  return cola.map(publico);
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
atender('analizar', (url) => analizar(String(url || '').trim()));
atender('seguir', ({ url, max, conocidas }) => seguir(url, Math.min(Math.max(1, +max || 10), 50), Array.isArray(conocidas) ? conocidas.map(String) : []));
atender('links', ({ texto, modo, desde }) => nucleo.chaptersFromLinks(texto, modo, desde));
atender('descargar', ({ items, opciones }) => encolar(items, opciones));
atender('cancelar', () => cancelar());
atender('limpiar', () => limpiar());
atender('config:leer', () => ({ ...config, nucleo: nucleo.version }));
atender('config:guardar', (c) => guardarConfig(c || {}));
atender('saga', ({ serie, numero }) => nucleo.sagaDe(serie, numero));
atender('guardados:leer', () => guardados);
atender('guardados:agregar', (dato) => guardarLinks(dato || {}));
atender('guardados:quitar', (urls) => quitarLinks(urls));
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
if (!PRUEBA && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (ui && !ui.isDestroyed()) { if (ui.isMinimized()) ui.restore(); ui.focus(); } });
app.on('window-all-closed', () => { if (!PRUEBA) app.quit(); });

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  leerConfig();
  if (!PRUEBA) leerGuardados();               // las pruebas arrancan con la lista vacía y no la escriben
  prepararSesion();
  if (PRUEBA) {
    // "electron . --prueba": corre las pruebas del programa contra un sitio de prueba local
    const fallas = await require('../tests/prueba.js')({ analizar, seguir, encolar, colaVacia, cancelar, limpiar, guardarConfig, abrirUI, nucleo,
      guardarLinks, quitarLinks, guardados: () => guardados, tapa, config: () => config })
      .catch((e) => { console.log('FALLA la prueba se cortó: ' + (e.stack || e)); return 1; });
    app.exit(fallas ? 1 : 0);
    return;
  }
  await abrirUI();
});
