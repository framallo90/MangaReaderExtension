// Arma en programa/generado/ el código que el programa comparte con la extensión, sacándolo
// de la última versión de la extensión. Así la detección de páginas, los nombres, la lista
// de capítulos y el armado de PDF y CBZ son los mismos en los dos, sin copiarlos a mano.
//
// Uso: node scripts/generar.js      (corre solo antes de "npm start" y de "npm run prueba")
//
// Genera:
//   generado/pagina.js    preload de las ventanas ocultas donde se abren las páginas web:
//                         las funciones de content.js + src/pagina/explorar.js
//   generado/nucleo.js    las funciones que no necesitan una página (links pegados, nombres)
//   generado/offscreen.js el armado de PDF, CBZ e imágenes, tal cual
//   generado/sitios.js    la lectura de una lista de links pegada (para los favoritos), tal cual
//   generado/opciones.js  las sagas escritas como texto y los capítulos que faltan (parseSagas, missingRanges), tal cual
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.join(__dirname, '..', '..');
const { grab, line } = require(path.join(raiz, 'tests', 'extraer'));
const { ultimaVersion } = require(path.join(raiz, 'tests', 'navegador'));

const version = ultimaVersion();
const ext = path.join(raiz, version, 'manga-reader-ext');
const src = fs.readFileSync(path.join(ext, 'content.js'), 'utf8');
const sagas = fs.readFileSync(path.join(ext, 'sagas.js'), 'utf8');
const agrupar = fs.readFileSync(path.join(ext, 'agrupar.js'), 'utf8');       // tomos: lo usan collectChapters y explorar.js
const plantilla = fs.readFileSync(path.join(ext, 'plantilla.js'), 'utf8');   // plantilla de nombres: la usa nameFor
const salida = path.join(__dirname, '..', 'generado');
fs.mkdirSync(salida, { recursive: true });

const una = (re) => { if (!re.test(src)) throw new Error(`content.js de ${version} no tiene ${re}`); return line(src, re); };
const bloque = (nombre, asinc) => grab(src, new RegExp(`${asinc ? 'async ' : ''}function ${nombre}\\(`));
const ASINC = new Set(['collectPages', 'scrollThrough']);
const bloques = (nombres) => nombres.map(n => bloque(n, ASINC.has(n))).join('\n\n');

// ── Para una página abierta (necesitan document y location) ──
const LINEAS_PAGINA = [/const OURS = /, /const MIN_SIDE = /, /const PROBE_CONCURRENCY = /, /const sleep = /,
  /const SAGAS = /, /let userSagas = /, /let esquemaNombres = /, /const noSlash = /, /const MONTH_RE = /];
const FUNCIONES_PAGINA = ['absUrl', 'srcsetBest', 'lazyUrl', 'imgUrl', 'probeSize', 'urlDir', 'collectPages', 'flagNonPages',
  'countCandidates', 'sanitizeSegment', 'sanitizePath', 'chapterParam', 'cleanSerie', 'detectChapter', 'fmtNum', 'nameFor',
  'suggestName', 'pageKey', 'splitChapterUrl', 'numForms', 'isDateArchive', 'collectChapters', 'nextChapterUrl',
  'chaptersFromLinks', 'scrollThrough', 'looksLikeChapter', 'contextoPlantilla', 'nombrePorPlantilla'];

const aviso = `// GENERADO por scripts/generar.js a partir de ${version}. No editar: los cambios van en la extensión\n// o en src/pagina/explorar.js.\n`;
const pagina = `${aviso}(function () {
${sagas}

${agrupar}

${plantilla}

${LINEAS_PAGINA.map(una).join('\n')}

${bloques(FUNCIONES_PAGINA)}

${fs.readFileSync(path.join(__dirname, '..', 'src', 'pagina', 'explorar.js'), 'utf8')}

  // Pedidos del programa: llegan por mensaje y se contestan igual
  const { ipcRenderer } = require('electron');
  ipcRenderer.on('mr:cmd', async (_e, m) => {
    let r;
    try { r = { ok: true, valor: await comandos[m.cmd](m.args || {}) }; }
    // El mensaje va limpio, porque es lo que termina mostrando la interfaz, y la pila aparte
    catch (e) { r = { ok: false, error: String(e && e.message || e), pila: String(e && e.stack || '') }; }
    ipcRenderer.send('mr:res', { id: m.id, ...r });
  });
})();
`;

// ── Para el programa mismo (sin página) ──
const FUNCIONES_NUCLEO = ['sanitizeSegment', 'sanitizePath', 'fmtNum', 'nameFor', 'splitChapterUrl', 'numForms', 'chaptersFromLinks',
  'contextoPlantilla', 'nombrePorPlantilla'];
const nucleo = `${aviso}${sagas}

${plantilla}

${[/const SAGAS = /, /let userSagas = /, /let esquemaNombres = /, /const noSlash = /].map(una).join('\n')}

${bloques(FUNCIONES_NUCLEO)}

// Saga de un capítulo según las tablas (las del usuario mandan), o ''
function sagaDe(serie, numero) {
  const t = userSagas[String(serie).toLowerCase()] || SAGAS[String(serie).toLowerCase()];
  const s = t ? t.find(([a, b]) => Math.floor(numero) >= a && Math.floor(numero) <= b) : null;
  return s ? s[2] : '';
}

module.exports = { sanitizeSegment, sanitizePath, fmtNum, nameFor, splitChapterUrl, numForms, chaptersFromLinks, sagaDe,
  aplicarPlantilla, plantillaColisiona, marcadoresDesconocidos, PLANTILLA_DEFECTO,
  setSagas: (s) => { userSagas = s || {}; },
  // Plantilla de nombres propia. Vacía o igual a la predeterminada es "sin plantilla": el nombre de siempre
  setEsquema: (t) => { t = String(t || '').trim(); esquemaNombres = t && t !== PLANTILLA_DEFECTO ? t : null; },
  version: ${JSON.stringify(version)} };
`;

// Que lo generado al menos sea JavaScript válido, antes de escribirlo
for (const [nombre, codigo] of [['pagina.js', pagina], ['nucleo.js', nucleo]]) {
  try { new vm.Script(codigo, { filename: nombre }); }
  catch (e) { console.error(`Lo generado para ${nombre} no es válido: ${e.message}`); process.exit(1); }
}
fs.writeFileSync(path.join(salida, 'pagina.js'), pagina);
fs.writeFileSync(path.join(salida, 'nucleo.js'), nucleo);
fs.copyFileSync(path.join(ext, 'offscreen.js'), path.join(salida, 'offscreen.js'));
fs.copyFileSync(path.join(ext, 'sitios.js'), path.join(salida, 'sitios.js'));
fs.copyFileSync(path.join(ext, 'opciones.js'), path.join(salida, 'opciones.js'));
// ajustes.js: las esperas ante un 429 o un 503 (Retry-After). Lo cargan el armador, antes que
// offscreen.js, y el proceso principal, para la cola.
fs.copyFileSync(path.join(ext, 'ajustes.js'), path.join(salida, 'ajustes.js'));
console.log(`Generado a partir de ${version}: pagina.js (${FUNCIONES_PAGINA.length} funciones), nucleo.js, offscreen.js, sitios.js, opciones.js, ajustes.js`);
