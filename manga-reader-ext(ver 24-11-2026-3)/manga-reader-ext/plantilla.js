/**
 * Plantilla de nombres: arma "carpeta/carpeta/archivo" a partir de un texto con marcadores
 * ({serie}, {numero}…). La usan content.js (el nombre con el que se guarda) y opciones.js
 * (la vista previa): así lo que se ve en opciones es exactamente lo que después se guarda.
 *
 * Va envuelto en una función por lo mismo que agrupar.js: en una pestaña se puede cargar
 * más de una vez.
 */
(function () {
  const PLANTILLA_DEFECTO = '{serie}/{saga}/{serie} {numero}';
  const MARCADORES = ['serie', 'saga', 'volumen', 'numero', 'titulo', 'anio', 'sitio'];
  const VACIO = '\u0001';              // lugar donde había un marcador sin valor

  // Limpia una ruta ya armada para que Windows la acepte. Una "/" separa carpetas; los
  // demás caracteres prohibidos (\ : * ? " < > |) se cambian por "-". Donde había un marcador
  // sin valor no queda nada: ni la carpeta vacía, ni el guion que lo separaba del resto, ni
  // los paréntesis que lo encerraban.
  function sanitizarPlantilla(s) {
    return String(s || '').split('/').map(seg => {
      seg = seg
        .replace(new RegExp(`[(\\[]\\s*${VACIO}\\s*[)\\]]`, 'g'), VACIO)
        .replace(new RegExp(`\\s*[-_,·]\\s*${VACIO}`, 'g'), '')        // el separador de antes se va con él…
        .replace(new RegExp(`${VACIO}\\s*[-_,·]\\s*`, 'g'), '')        // …o el de después, si iba primero
        .replace(new RegExp(VACIO, 'g'), ' ')
        .replace(/[\\:*?"<>|\x00-\x1F]+/g, '-')
        .replace(/\s+/g, ' ').trim()
        .replace(/^\.+/, '').replace(/[.\s]+$/, '')                    // Windows no acepta puntos ni espacios al final
        .slice(0, 100).trim();
      return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(seg) ? '_' + seg : seg;      // nombres reservados
    }).filter(Boolean).join('/') || 'Manga';
  }

  // Reemplaza los marcadores de `tpl` por los valores de `ctx` ({serie, saga, volumen,
  // numero, titulo, anio, sitio}, ya como texto) y devuelve la ruta limpia. Una "/" dentro
  // de un valor (un título como "Ida/Vuelta") no crea carpetas: solo las de la plantilla.
  // Un marcador que no existe queda escrito tal cual.
  function aplicarPlantilla(tpl, ctx = {}) {
    return sanitizarPlantilla(String(tpl || '').replace(/\{([a-z]+)\}/gi, (todo, nombre) => {
      const k = nombre.toLowerCase();
      if (!MARCADORES.includes(k)) return todo;
      return String(ctx[k] ?? '').replace(/[\\/]/g, '-').replace(/\s+/g, ' ').trim() || VACIO;
    }));
  }

  // Sin {numero} ni {titulo}, todos los capítulos de una serie se llamarían igual
  function plantillaColisiona(tpl) {
    return !/\{(numero|titulo)\}/i.test(String(tpl || ''));
  }

  // Marcadores escritos en la plantilla que no existen ({capitulo}, {tomo}…), sin repetir
  function marcadoresDesconocidos(tpl) {
    const todos = String(tpl || '').match(/\{[^{}/]*\}/g) || [];
    return [...new Set(todos.filter(m => !MARCADORES.includes(m.slice(1, -1).toLowerCase())))];
  }

  const api = { PLANTILLA_DEFECTO, MARCADORES, sanitizarPlantilla, aplicarPlantilla, plantillaColisiona, marcadoresDesconocidos };
  Object.assign(globalThis, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
