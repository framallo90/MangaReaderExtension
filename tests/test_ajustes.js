// Ajustes compartidos (ajustes.js, desde la 2.11): el ritmo de un lote y la espera cuando el
// sitio responde 429, y la bajada de una página con esas esperas (offscreen.js).
// Uso: node tests/test_ajustes.js "<carpeta de la versión>/manga-reader-ext"
const path = require('path');
const { probador } = require('./extraer');
const dir = path.resolve(process.argv[2]);
const A = require(path.join(dir, 'ajustes.js'));
const { eq, fin } = probador();

(async () => {
  // ── Ritmo ──
  eq('ritmo: sin nada guardado, el de siempre', JSON.stringify(A.normalizarRitmo(undefined)), '{"pausa":1.5,"descansoCada":0,"descansoSeg":30,"concurrencia":6,"espera429":60}');
  eq('  lo que se pasa de los límites queda en el límite (pausa 0–10, concurrencia 2–8)',
    JSON.stringify(A.normalizarRitmo({ pausa: 99, descansoCada: -3, descansoSeg: 0, concurrencia: 40 })), '{"pausa":10,"descansoCada":0,"descansoSeg":1,"concurrencia":8,"espera429":60}');
  eq('  la pausa puede ser 0 y admite coma decimal; la concurrencia mínima es 2', JSON.stringify(A.normalizarRitmo({ pausa: '0', concurrencia: 1 })).slice(0, 12) + ' · ' + A.normalizarRitmo({ pausa: '2,5' }).pausa + ' · ' + A.normalizarRitmo({ concurrencia: 1 }).concurrencia, '{"pausa":0," · 2.5 · 2');
  eq('  lo que no es un número no rompe: vale el de siempre', JSON.stringify(A.normalizarRitmo({ pausa: 'mucho', concurrencia: null, descansoCada: 'x' })), JSON.stringify(A.RITMO_DEFECTO));
  const antes = (r) => [0, 1, 2, 3, 4, 5, 6].map(i => A.pausaAntes(i, r)).join(',');
  eq('pausa entre capítulos: el primero sale enseguida y después va la pausa', antes({ pausa: 1.5 }), '0,1500,1500,1500,1500,1500,1500');
  eq('  con descanso cada 3 capítulos de 20 s, se suma después del 3º y del 6º', antes({ pausa: 1, descansoCada: 3, descansoSeg: 20 }), '0,1000,1000,21000,1000,1000,21000');
  eq('  con pausa 0 y sin descanso no se espera nada', antes({ pausa: 0 }), '0,0,0,0,0,0,0');

  // ── Espera ante un 429 o un 503 ──
  eq('el sitio dice cuánto esperar (Retry-After en segundos): se espera eso', [A.esperaReintento(0, '1'), A.esperaReintento(2, '7')].join(','), '1000,7000');
  eq('  o hasta una fecha', A.esperaReintento(0, 'Mon, 23 Nov 2026 12:00:05 GMT', Date.parse('Mon, 23 Nov 2026 12:00:00 GMT')), 5000);
  eq('  si no dice nada: 2, 4 y 8 segundos', [0, 1, 2].map(i => A.esperaReintento(i, '')).join(','), '2000,4000,8000');
  eq('  y nunca más de un minuto, aunque pida una hora', A.esperaReintento(0, '3600'), 60000);
  eq('  un Retry-After que no se entiende vale como si no estuviera', A.esperaReintento(1, 'pronto'), 4000);
  eq('reconoce el motivo "el sitio pidió esperar"', [A.pidioEsperar('No se pudo leer ninguna página (HTTP 429)'), A.pidioEsperar('HTTP 429: el sitio pidió esperar'), A.pidioEsperar('Sin páginas (encontré 0)')].join(','), 'true,true,false');

  // ── Adaptadores por sitio ──
  if (A.normalizarAdaptador) {
    eq('adaptador: lo escrito queda limpio, y "ignorar" se parte por comas o renglones',
      JSON.stringify(A.normalizarAdaptador({ contenedor: '  #visor ', imagenes: 'img.pagina', ignorar: '.aviso, .recomendados img\n.aviso', patron: ' https://s.com/leer/{n} ' })),
      '{"contenedor":"#visor","imagenes":"img.pagina","ignorar":[".aviso",".recomendados img"],"patron":"https://s.com/leer/{n}"}');
    eq('  una dirección de capítulos sin {n}, o que no es una dirección, no se guarda', [A.normalizarAdaptador({ patron: 'https://s.com/leer/5' }).patron, A.normalizarAdaptador({ patron: 'leer/{n}' }).patron].join('|'), '|');
    eq('  lo que no es un adaptador da uno vacío, y uno vacío se reconoce', `${JSON.stringify(A.normalizarAdaptador(null))} · ${A.adaptadorVacio({ contenedor: ' ' })} · ${A.adaptadorVacio({ ignorar: ['.x'] })}`,
      '{"contenedor":"","imagenes":"","ignorar":[],"patron":""} · true · false');
    eq('el sitio se puede escribir como venga: una dirección, con mayúsculas o suelto', ['https://Sitio.com/manga/x?y=1', 'sitio.com', ' WWW.Sitio.com/leer ', '', 'no es un sitio !'].map(A.hostDe).join(' | '), 'sitio.com | sitio.com | www.sitio.com |  | ');
    // (quién sabe si un selector es válido es el navegador: acá se lo simula con una regla simple)
    const probar = (s) => { if (/>>|\[$|^\)/.test(s)) throw new Error('inválido'); };
    eq('selectores que el navegador no entiende: se dicen cuáles son', A.selectoresInvalidos({ contenedor: '#visor >>', imagenes: 'img', ignorar: ['.a', 'div['] }, probar).join(' · '), '#visor >> · div[');
    eq('  y si están todos bien, ninguno', A.selectoresInvalidos({ contenedor: '#visor', ignorar: '.a, .b' }, probar).length, 0);
  }

  // ── Carpeta base de las descargas ──
  if (A.aplicarCarpeta) {
    const DATOS = { sitio: '127.0.0.1', serie: 'Sitio de prueba', anio: 2026 };
    eq('carpeta base: "Manga/{sitio}/{serie}" se arma con el sitio y la serie', A.aplicarCarpeta('Manga/{sitio}/{serie}', DATOS), 'Manga/127.0.0.1/Sitio de prueba');
    eq('  con {anio}, y con barras invertidas como separador', A.aplicarCarpeta('Leídos {anio}\\{serie}', DATOS), 'Leídos 2026/Sitio de prueba');
    eq('  un dato vacío no deja carpeta, y los caracteres que Windows no acepta se sacan del dato', A.aplicarCarpeta('Manga/{sitio}/{serie}', { serie: 'Re:Zero / ¿Qué?' }), 'Manga/Re Zero ¿Qué');
    eq('  la de siempre sigue siendo MangaReader', `${A.CARPETA_DEFECTO} · ${A.aplicarCarpeta('MangaReader', DATOS)} · ${A.validarCarpeta('MangaReader') === ''}`, 'MangaReader · MangaReader · true');
    const malas = ['../x', 'Manga/../../x', '/home/yo', 'C:\\Manga', '\\\\servidor\\x', './x', '', 'Manga/{autor}', 'Manga?'];
    eq('lo que intenta salir de Descargas o no se entiende se rechaza, diciendo por qué', malas.map(c => (A.validarCarpeta(c) ? 'no' : 'SÍ')).join(','), 'no,no,no,no,no,no,no,no,no');
    eq('  y si igual llega (una copia importada), al guardar vale la de siempre', malas.map(c => A.aplicarCarpeta(c, DATOS)).join(','), Array(9).fill('MangaReader').join(','));
    eq('  el motivo nombra lo que está mal', [A.validarCarpeta('../x'), A.validarCarpeta('C:\\Manga'), A.validarCarpeta('Manga/{autor}')].map(m => m.split(':')[0].slice(0, 34)).join(' | '),
      'No puede llevar ".." ni "." | Tiene que ser una carpeta adentro  | No conozco {autor}');
  }

  // ── Cuánto va a ocupar un lote ──
  if (A.estimarLote) {
    const reg = {
      'Serie A/Serie A 0001': { ts: 1, pages: 20, url: 'https://s.com/a/1', kb: 10000 },
      'Serie A/Serie A 0002': { ts: 1, pages: 20, url: 'https://s.com/a/2', kb: 14000 },
      'Serie B/Serie B 0001': { ts: 1, pages: 20, url: 'https://s.com/b/1', kb: 30000 },
      'Vieja/Vieja 0001': { ts: 1, pages: 20, url: 'https://s.com/v/1' },                    // guardado antes de la 2.11: no dice cuánto pesó
      'Otra/Otra 0001': { ts: 1, pages: 20, url: 'https://otro.com/o/1', kb: 90000 },
    };
    const ver = (e) => (e ? `${A.tamanoLegible(e.kb)} según ${e.de}` : 'sin estimación');
    eq('estimación de un lote: el promedio de lo ya guardado de ese sitio, por la cantidad', ver(A.estimarLote(reg, { sitio: 's.com' }, 10)), '176 MB según 3');
    eq('  si de esa serie ya hay dos o más, vale el promedio de la serie', ver(A.estimarLote(reg, { sitio: 's.com', serie: 'serie a' }, 10)), '117 MB según 2');
    eq('  sin nada guardado de ese sitio (o sin capítulos que bajar) no se estima', [A.estimarLote(reg, { sitio: 'nuevo.com' }, 10), A.estimarLote({}, { sitio: 's.com' }, 10), A.estimarLote(reg, { sitio: 's.com' }, 0)].map(ver).join(' | '),
      'sin estimación | sin estimación | sin estimación');
    eq('  a partir de 200 MB se avisa', `${A.estimarLote(reg, { sitio: 's.com' }, 10).kb >= A.AVISO_TAMANO_KB} · ${A.estimarLote(reg, { sitio: 's.com' }, 12).kb >= A.AVISO_TAMANO_KB}`, 'false · true');
    eq('tamaños legibles', [300, 2048, 150000, 3000000].map(A.tamanoLegible).join(' · '), '300 KB · 2,0 MB · 146 MB · 2,9 GB');
  }

  // ── ¿Hay una versión nueva? ──
  if (A.versionRemota) {
    eq('versiones: se comparan los números, no las letras', [['2.9.1', '2.10.0'], ['2.11.0', '2.11.0'], ['2.11.1', '2.11.0'], ['3.0', '2.99.9'], ['', '2.11.0']].map(([a, b]) => A.compararVersiones(a, b)).join(','), '-1,0,1,1,-1');
    // El README de este mismo repositorio: si la tabla cambia de forma, esta prueba lo dice
    const fs = require('fs');
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    const fila = A.versionDelReadme(readme);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;
    eq('la versión de la extensión se lee de la tabla del README del repositorio, con su carpeta',
      `${/^\d+\.\d+\.\d+$/.test(fila?.version || '')} · ${fs.existsSync(path.join(__dirname, '..', fila?.carpeta || 'x', 'manifest.json'))}`, 'true · true');
    eq('  un README sin esa tabla no rompe', String(A.versionDelReadme('# Otra cosa\n\nNada que ver.')), 'null');
    // internet simulada: qué responde cada dirección
    const red = (respuestas) => { const pedidos = []; return Object.assign(async (u) => { pedidos.push(u.replace(A.REPO_CRUDO, ''));
      const r = Object.entries(respuestas).find(([k]) => u.endsWith(k))?.[1]; return r == null ? { ok: false, status: 404 } : { ok: true, text: async () => r, json: async () => JSON.parse(r) }; }, { pedidos }); };
    const LEE = '| 🧩 **La extensión** | Se usa desde Chrome | 2.11.0 | `manga-reader-ext(ver 23-11-2026)/manga-reader-ext` |';
    let r = red({ 'README.md': LEE, 'manifest.json': '{"version":"2.12.3"}' });
    eq('versión en main: primero el README (dice cuál es la carpeta) y después el manifest de esa carpeta, que es el que manda',
      `${(await A.versionRemota(r)).version} · ${r.pedidos.join(' → ')}`, '2.12.3 · README.md → manga-reader-ext(ver%2023-11-2026)/manga-reader-ext/manifest.json');
    r = red({ 'README.md': LEE });
    eq('  si el manifest no se puede leer, vale lo que dice el README', (await A.versionRemota(r)).version, '2.11.0');
    eq('  y si no se puede leer nada (sin conexión, repositorio privado), no se sabe', String(await A.versionRemota(red({}))), 'null');
    eq('  con el manifest de esta versión no hay nada nuevo que avisar', A.compararVersiones(manifest, manifest) > 0, false);
  }

  // ── La bajada de una página (offscreen.js), con el sitio y el reloj simulados ──
  // respuestas: lo que contesta el sitio en cada pedido de esa página, en orden
  const off = require(path.join(dir, 'offscreen.js'));
  if (typeof off.fetchRetry === 'function') {
    const real = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout };
    const bajar = async (respuestas) => {
      const esperas = []; let pedidos = 0;
      globalThis.setTimeout = (f, ms) => { if (ms < 30000) esperas.push(ms); return real.setTimeout(f, ms >= 30000 ? ms : 0); };   // (el de 30 s es el límite de cada pedido)
      globalThis.fetch = async () => {
        const r = respuestas[Math.min(pedidos++, respuestas.length - 1)];
        return typeof r === 'number'
          ? { ok: false, status: r, headers: { get: () => null } }
          : r.status ? { ok: false, status: r.status, headers: { get: (h) => (/retry-after/i.test(h) ? r.retryAfter : null) } }
                     : { ok: true, status: 200, headers: { get: () => null }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
      };
      let fin;
      try { fin = (await off.fetchRetry('https://s.com/p.jpg')).length + ' bytes'; } catch (e) { fin = e.message; }
      Object.assign(globalThis, real);
      return `${fin} · ${pedidos} pedidos · esperas: ${esperas.join(',') || 'ninguna'}`;
    };
    eq('una página que responde 429 con Retry-After: 1 → espera lo que dice y sale', await bajar([{ status: 429, retryAfter: '1' }, {}]), '3 bytes · 2 pedidos · esperas: 1000');
    eq('  429 sin Retry-After, tres veces → 2, 4 y 8 segundos, y a la cuarta sale', await bajar([429, 429, 429, {}]), '3 bytes · 4 pedidos · esperas: 2000,4000,8000');
    eq('  429 siempre → se reintenta 3 veces y queda en falla con su motivo', await bajar([429]), 'HTTP 429 · 4 pedidos · esperas: 2000,4000,8000');
    eq('  503 con Retry-After también se espera', await bajar([{ status: 503, retryAfter: '3' }, {}]), '3 bytes · 2 pedidos · esperas: 3000');
    eq('  un 404 no se reintenta', await bajar([404, {}]), 'HTTP 404 · 1 pedidos · esperas: ninguna');
  }
  fin();
})();
