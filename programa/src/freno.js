// El freno de la cola: cuánto no pedirle nada a un sitio que contestó 429 o 503, en la página de
// un capítulo o en sus imágenes. Es la regla de la extensión, sin copiarla: esperaDelSitio de
// ajustes.js, que se arma sobre esperaPedida. Está escrita una sola vez, en la sección "El freno"
// de DOCUMENTACION.md; en resumen:
//   Retry-After en segundos o como fecha        → eso, con tope de un minuto
//   sin Retry-After, algo que no se entiende,
//   o una fecha ya vencida                       → un minuto
//   Retry-After: 0                               → no frena
// (La pausa de siempre entre capítulos corre aparte, haya freno o no.)
const ajustes = require('../generado/ajustes.js');

// `esperar`: { status, retryAfter } (lo que traen los errores de la página y del armador).
// Devuelve milisegundos; 0 = no frena.
function frenoDe(esperar, ahora = Date.now()) {
  if (!esperar) return 0;
  return ajustes.esperaDelSitio(esperar.retryAfter, undefined, ahora);
}

module.exports = { frenoDe };
