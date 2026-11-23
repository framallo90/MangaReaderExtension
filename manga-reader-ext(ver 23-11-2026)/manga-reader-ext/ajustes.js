/**
 * Manga Reader v2.11.0 — ajustes que comparten la página de opciones, el script de las pestañas,
 * el armador de archivos y el service worker. Están acá para que todos validen con las mismas
 * reglas: lo que la página de opciones acepta es exactamente lo que después se usa.
 * Sin interfaz ni chrome.*: también lo cargan las pruebas en Node.
 * Envuelto en una función y dejado en globalThis: en una pestaña puede cargarse más de una vez.
 */
(function () {
  const numero = (v) => parseFloat(String(v ?? '').replace(',', '.'));
  const entre = (v, min, max, def) => { v = numero(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };

  // ── Ritmo de un lote ──────────────────────────────────
  //   pausa         segundos entre un capítulo y el siguiente (0 a 10)
  //   descansoCada  cada cuántos capítulos se hace un descanso más largo (0 = nunca)
  //   descansoSeg   cuánto dura ese descanso
  //   concurrencia  imágenes que se miden a la vez al buscar las páginas (2 a 8)
  //   espera429     segundos que para el lote cuando un capítulo entero responde "esperá" (429)
  const RITMO_DEFECTO = { pausa: 1.5, descansoCada: 0, descansoSeg: 30, concurrencia: 6, espera429: 60 };

  // Lo que venga (de opciones, de una copia importada, a medio escribir) → un ritmo válido
  function normalizarRitmo(r) {
    r = r && typeof r === 'object' ? r : {};
    return {
      pausa: Math.round(entre(r.pausa, 0, 10, RITMO_DEFECTO.pausa) * 10) / 10,
      descansoCada: Math.round(entre(r.descansoCada, 0, 500, RITMO_DEFECTO.descansoCada)),
      descansoSeg: Math.round(entre(r.descansoSeg, 1, 600, RITMO_DEFECTO.descansoSeg)),
      concurrencia: Math.round(entre(r.concurrencia, 2, 8, RITMO_DEFECTO.concurrencia)),
      espera429: entre(r.espera429, 0, 600, RITMO_DEFECTO.espera429),
    };
  }

  // Milisegundos a esperar antes del capítulo número `hechos` + 1 del lote (hechos = los que ya
  // se pidieron). El primero sale enseguida; después va la pausa y, cada tantos, el descanso.
  function pausaAntes(hechos, ritmo) {
    if (!hechos) return 0;
    const r = normalizarRitmo(ritmo);
    return Math.round(r.pausa * 1000) + (r.descansoCada && hechos % r.descansoCada === 0 ? r.descansoSeg * 1000 : 0);
  }

  // Milisegundos a esperar antes de reintentar una página que respondió 429 o 503. Vale lo que
  // diga el sitio en Retry-After (segundos, o una fecha), con tope de un minuto para no dejar
  // el capítulo colgado; si no dice nada, 2, 4 y 8 segundos.
  function esperaReintento(intento, retryAfter, ahora = Date.now()) {
    const t = String(retryAfter ?? '').trim();
    let ms = NaN;
    if (/^\d+(\.\d+)?$/.test(t)) ms = parseFloat(t) * 1000;
    else if (t) ms = Date.parse(t) - ahora;
    if (!Number.isFinite(ms) || ms < 0) ms = 2000 * 2 ** Math.max(0, intento);
    return Math.min(60000, Math.max(250, Math.round(ms)));
  }

  // ¿El motivo de una falla es que el sitio pidió esperar?
  const pidioEsperar = (texto) => /HTTP 429|pidió esperar/i.test(String(texto || ''));

  globalThis.MR_AJUSTES = { RITMO_DEFECTO, normalizarRitmo, pausaAntes, esperaReintento, pidioEsperar };
  if (typeof module !== 'undefined') module.exports = globalThis.MR_AJUSTES;
})();
