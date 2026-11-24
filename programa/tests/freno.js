// El freno de la cola, en Node (sin Electron): la regla de ajustes.js de la extensión
// (esperaPedida y esperaDelSitio) y lo que hace el programa con ella (frenoDe, en src/freno.js).
// Uso: node tests/freno.js        (también lo corre "npm run prueba", al principio)
// Necesita generado/ (lo arma scripts/generar.js; "npm run prueba" y "npm start" lo hacen solos).
const fs = require('fs'), path = require('path');

function probarFreno(eq) {
  const ajustes = require('../generado/ajustes.js');
  const { frenoDe } = require('../src/freno.js');
  const ahora = Date.parse('2026-11-24T03:00:00Z');
  const vencida = new Date(ahora - 90000).toUTCString(), futura = new Date(ahora + 5000).toUTCString();
  const casos = [['0', '"0"'], ['3', '"3"'], [vencida, 'fecha vencida'], ['300', '"300"'], ['', 'vacío'], ['pronto', '"pronto"'], [futura, 'fecha en 5 s']];
  const como = (ms) => (ms == null ? 'null' : ms === 0 ? '0' : `${ms / 1000} s`);
  eq('esperaPedida (la regla de la extensión): "0", "3", fecha vencida, "300", vacío, basura y una fecha en 5 s',
    casos.map(([v, n]) => `${n} → ${como(ajustes.esperaPedida(v, ahora))}`).join(' · '),
    '"0" → 0 · "3" → 3 s · fecha vencida → null · "300" → 60 s · vacío → null · "pronto" → null · fecha en 5 s → 5 s');
  eq('  el freno del programa con lo mismo: sin cabecera, basura o fecha vencida, un minuto; "0", nada; lo demás, lo pedido con tope de un minuto',
    casos.map(([v, n]) => `${n} → ${como(frenoDe({ status: 503, retryAfter: v }, ahora))}`).join(' · '),
    '"0" → 0 · "3" → 3 s · fecha vencida → 60 s · "300" → 60 s · vacío → 60 s · "pronto" → 60 s · fecha en 5 s → 5 s');
  eq('  es el mismo que el de la extensión (esperaDelSitio) en todos los casos, y sin un pedido de espera no frena',
    casos.every(([v]) => frenoDe({ status: 429, retryAfter: v }, ahora) === ajustes.esperaDelSitio(v, undefined, ahora)) + ' · ' + frenoDe(null), 'true · 0');
  // El criterio sale de un solo lugar: el programa no tiene su propia cuenta
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const freno = fs.readFileSync(path.join(__dirname, '..', 'src', 'freno.js'), 'utf8');
  eq('  el programa frena con frenoDe, y frenoDe usa esperaDelSitio de la extensión (que se arma sobre esperaPedida)',
    `${/frenoDe\(esperar\)/.test(main) && !/esperaPedida\(/.test(main)} · ${/ajustes\.esperaDelSitio\(/.test(freno)} · ${/esperaPedida\(retryAfter, ahora\) \?\?/.test(String(ajustes.esperaDelSitio))}`, 'true · true · true');
}

module.exports = { probarFreno };

if (require.main === module) {
  if (!fs.existsSync(path.join(__dirname, '..', 'generado', 'ajustes.js'))) require('../scripts/generar.js');
  let fallas = 0;
  const eq = (etiqueta, obtenido, esperado) => {
    if (obtenido !== esperado) fallas++;
    console.log((obtenido === esperado ? 'OK   ' : 'FALLA') + ' ' + etiqueta + ' → ' + obtenido + (obtenido === esperado ? '' : '   (esperado: ' + esperado + ')'));
  };
  probarFreno(eq);
  console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK');
  process.exitCode = fallas ? 1 : 0;
}
