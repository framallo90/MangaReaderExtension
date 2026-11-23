// Ayuda para las pruebas: content.js es una sola función envolvente, así que las funciones
// que se quieren probar se sacan por nombre y se cargan sobre una página simulada.
const fs = require('fs'), vm = require('vm'), path = require('path');

// Bloque con llaves balanceadas que empieza donde coincide `re` (una función o un objeto)
function grab(src, re) {
  const i = src.search(re);
  if (i < 0) throw new Error('no encontré ' + re);
  let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
  return src.slice(i, j + 1) + (src[j + 1] === ';' ? ';' : '');
}

// Una sola línea (constantes y funciones flecha de un renglón)
function line(src, re) {
  const i = src.search(re);
  if (i < 0) throw new Error('no encontré ' + re);
  return src.slice(i, src.indexOf('\n', i));
}

const BLOQUES = [
  /function absUrl\(/, /function urlDir\(/, /function flagNonPages\(/,
  /function sanitizeSegment\(/, /function sanitizePath\(/,
  /function chapterParam\(/, /function cleanSerie\(/, /function detectChapter\(/,
  /function fmtNum\(/, /function nameFor\(/, /function suggestName\(/, /function pageKey\(/,
  /function splitChapterUrl\(/, /function numForms\(/, /function collectChapters\(/, /function nextChapterUrl\(/,
];
// Funciones que no están en todas las versiones: se cargan si existen
const BLOQUES_NUEVOS = [/function isDateArchive\(/,         // 2.8.6
  /function chaptersFromLinks\(/,                           // 2.9
  /function contextoPlantilla\(/, /function nombrePorPlantilla\(/];   // 2.10
const LINEAS = [/const OURS = /, /const MIN_SIDE = /, /const SAGAS = /, /let userSagas = /, /const noSlash = /];
const LINEAS_NUEVAS = [/const MONTH_RE = /,                 // 2.8.6
  /let esquemaNombres = /];                                 // 2.10
// Archivos compartidos que van antes que content.js, si la versión los trae (2.10; estilos.js, 2.11)
const COMPARTIDOS = ['agrupar.js', 'plantilla.js', 'estilos.js'];

// Carga esas funciones como si corrieran en una página con ese título, dirección, links
// ([href, texto, encabezado]) y opciones de <select> ([value, texto, disabled, grupo]).
// `encabezado` es el título (<h3>) que la página tiene justo antes de ese link, y `grupo`
// el <optgroup> de esa opción: los dos son opcionales.
function pagina(dir, { title = '', url = 'https://sitio.com/', og = '', links = [], options = [], relNext = '' } = {}) {
  const src = fs.readFileSync(path.join(dir, 'content.js'), 'utf8');
  const u = new URL(url);
  const a = ([href, text]) => ({ tagName: 'A', href: new URL(href, url).href, textContent: text || '', closest: () => null });
  const document = {
    title, baseURI: url,
    querySelector: (sel) => {
      if (sel.includes('og:title')) return og ? { content: og } : null;
      if (sel.includes('rel~="next"')) return relNext ? { href: new URL(relNext, url).href } : null;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === 'a[href]') return links.map(a);
      if (sel === 'select option') return options.map(([value, text, disabled, grupo]) => ({ value, textContent: text || '', disabled: !!disabled,
        parentElement: grupo ? { tagName: 'OPTGROUP', label: grupo } : null }));
      // Encabezados y links juntos, en el orden de la página
      if (/\bh3\b/.test(sel) && sel.includes('a[href]')) return links.flatMap(l =>
        [...(l[2] != null ? [{ tagName: 'H3', textContent: l[2], closest: () => null }] : []), a(l)]);
      return [];
    },
  };
  const ctx = { URL, URLSearchParams, console, document,
    location: { href: url, origin: u.origin, pathname: u.pathname, search: u.search, hostname: u.hostname } };
  vm.createContext(ctx);
  for (const f of COMPARTIDOS) if (fs.existsSync(path.join(dir, f))) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, 'sagas.js'), 'utf8'), ctx);
  vm.runInContext([...LINEAS.map(re => line(src, re)), ...LINEAS_NUEVAS.filter(re => re.test(src)).map(re => line(src, re)),
    ...BLOQUES.map(re => grab(src, re)),
    ...BLOQUES_NUEVOS.filter(re => re.test(src)).map(re => grab(src, re))].join('\n') +
    '\n;globalThis.setSagas = (s) => { userSagas = s; }; globalThis.noSlashFn = noSlash;' +
    (/let esquemaNombres = /.test(src) ? '\nglobalThis.setEsquema = (t) => { esquemaNombres = t || null; };' : ''), ctx);
  return ctx;
}

// Contador de pruebas compartido
function probador() {
  let fails = 0;
  const eq = (label, got, want) => {
    const g = typeof got === 'string' ? got : JSON.stringify(got), w = typeof want === 'string' ? want : JSON.stringify(want);
    const ok = g === w;
    if (!ok) fails++;
    console.log((ok ? 'OK   ' : 'FALLA') + ' ' + label + ' → ' + g + (ok ? '' : '   (esperado: ' + w + ')'));
  };
  const fin = () => { console.log(fails ? `\n${fails} FALLAS` : '\nTODO OK'); process.exit(fails ? 1 : 0); };
  return { eq, fin };
}

module.exports = { grab, line, pagina, probador };
