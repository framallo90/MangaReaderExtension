/**
 * Agrupar por volumen / tomo / saga.
 * Criterio compartido por la extensión (content.js) y por el programa de escritorio
 * (programa/src/pagina/explorar.js). Vive en un solo archivo para que no queden dos
 * copias que se separen con el tiempo.
 *
 * Va envuelto en una función porque en una misma pestaña se puede cargar más de una vez
 * (al actualizar la extensión se inyecta de nuevo): un `const` suelto daría error la segunda.
 */
(function () {
  // Encabezado que separa volúmenes, tomos, sagas, arcos, partes…
  const SECCION_RE = /\b(vol(?:umen|ume|\.)?|tomo|saga|arco|arc|temporada|season|parte|part|libro|book)\b/i;

  const limpio = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  // Encabezado vigente mientras se recorren los elementos de una página en orden: cada
  // título (que no sea un párrafo largo) reemplaza al anterior.
  let seccionActual = '';
  function capturarSeccion(texto) {
    const t = limpio(texto);
    if (t && t.length <= 80) seccionActual = t;
    return seccionActual;
  }
  function seccionVigente() { return seccionActual; }
  function reiniciarSeccion() { seccionActual = ''; }

  // La sección de un item solo vale si de verdad separa (nombra un tomo, una saga…) y en la
  // lista hay al menos dos distintas. Así un título suelto arriba de todo no inventa un tomo.
  function validador(items) {
    const usadas = new Set(items.map(i => i.seccion).filter(s => SECCION_RE.test(s)));
    return (i) => (usadas.size >= 2 && SECCION_RE.test(i.seccion) ? i.seccion : '');
  }

  // Copia de la lista con la sección de cada item ya revisada ('' si no vale)
  function conSecciones(items) {
    const valida = validador(items);
    return items.map(i => ({ ...i, seccion: valida(i) }));
  }

  // Agrupa capítulos por sección. Devuelve
  //   [{seccion, nombre, desde, hasta, items}]   ordenados por su primer capítulo
  // Un grupo necesita al menos 2 capítulos; los que no tienen sección (o cuya sección
  // quedó sola) van juntos en "Sin volumen", con seccion ''. Los `items` son los mismos
  // objetos de la lista que se recibe, no copias: quien marca los de un grupo marca los
  // de la lista.
  function tomosDe(items) {
    const valida = validador(items);
    const porSeccion = new Map(), sueltos = [];
    for (const it of items) {
      const s = valida(it);
      if (!s) sueltos.push(it);
      else if (porSeccion.has(s)) porSeccion.get(s).push(it);
      else porSeccion.set(s, [it]);
    }
    const grupos = [];
    for (const [seccion, its] of porSeccion) {
      if (its.length < 2) sueltos.push(...its);
      else grupos.push({ seccion, nombre: seccion, items: its });
    }
    if (sueltos.length) grupos.push({ seccion: '', nombre: 'Sin volumen', items: sueltos });
    for (const g of grupos) {
      g.items.sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
      const ns = g.items.map(i => i.numero).filter(n => n != null && !isNaN(n));
      g.desde = ns.length ? ns[0] : null;
      g.hasta = ns.length ? ns[ns.length - 1] : null;
    }
    return grupos.sort((a, b) => (a.desde ?? Infinity) - (b.desde ?? Infinity));
  }

  // Rango legible de un grupo: "3 a 7", "5" o vacío
  function rangoTomos(g) {
    if (g.desde == null && g.hasta == null) return '';
    if (g.desde == null || g.desde === g.hasta) return String(g.hasta ?? g.desde);
    return `${g.desde} a ${g.hasta}`;
  }

  // Sin módulos: en la pestaña y en el programa queda en globalThis, que es de donde lo
  // toman content.js y explorar.js. En Node se exporta para las pruebas.
  const api = { SECCION_RE, capturarSeccion, seccionVigente, reiniciarSeccion, conSecciones, tomosDe, rangoTomos };
  Object.assign(globalThis, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
