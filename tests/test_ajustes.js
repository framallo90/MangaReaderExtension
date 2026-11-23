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
