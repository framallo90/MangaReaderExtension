/**
 * Manga Reader v2.11.2 — ajustes que comparten la página de opciones, el script de las pestañas,
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
  //   espera429     segundos que frena el lote cuando un capítulo (su página o sus imágenes)
  //                 responde "esperá" (429 o 503) sin decir cuánto en Retry-After
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

  // Lo que el sitio pidió esperar en Retry-After (segundos, o una fecha), en milisegundos y con
  // tope de un minuto para no dejar nada colgado. null si no vino o no se entiende: quien
  // pregunta decide entonces cuánto esperar (el programa usa su pausa de siempre).
  function esperaPedida(retryAfter, ahora = Date.now()) {
    const t = String(retryAfter ?? '').trim();
    let ms = NaN;
    if (/^\d+(\.\d+)?$/.test(t)) ms = parseFloat(t) * 1000;
    else if (t) ms = Date.parse(t) - ahora;
    return Number.isFinite(ms) && ms >= 0 ? Math.min(60000, Math.round(ms)) : null;
  }

  // Cuánto frena un lote cuando el sitio pide esperar con un capítulo (su página o sus imágenes
  // responden 429 o 503), en milisegundos: lo que dijo en Retry-After, con el tope de un minuto.
  // Un sitio que no dice cuánto —o que manda algo que no se entiende, o una fecha ya vencida—
  // pidió un minuto (ritmo.espera429): no se baja a los 2, 4 y 8 segundos de una imagen suelta.
  function esperaDelSitio(retryAfter, ritmo, ahora = Date.now()) {
    return esperaPedida(retryAfter, ahora) ?? Math.round(normalizarRitmo(ritmo).espera429 * 1000);
  }

  // Milisegundos a esperar antes de reintentar una página que respondió 429 o 503: lo que pidió
  // el sitio o, si no dijo nada, 2, 4 y 8 segundos.
  function esperaReintento(intento, retryAfter, ahora = Date.now()) {
    const pedida = esperaPedida(retryAfter, ahora);
    return Math.min(60000, Math.max(250, pedida ?? 2000 * 2 ** Math.max(0, intento)));
  }

  // ¿El motivo de una falla es que el sitio pidió esperar? Un 503 cuenta igual que un 429: los
  // dos dicen "ahora no", y seguir pidiendo solo alarga el castigo.
  const pidioEsperar = (texto) => /HTTP (?:429|503)|pidió esperar/i.test(String(texto || ''));

  // ── Adaptadores por sitio ─────────────────────────────
  // Para los sitios donde la detección automática no acierta, se le dice dónde están las páginas
  // con selectores CSS. Uno por sitio (por su host):
  //   contenedor  el bloque que tiene las páginas ("#visor")
  //   imagenes    cuáles son las páginas, dentro del contenedor o de toda la página ("img.pagina")
  //   ignorar     lo que hay que dejar afuera aunque coincida (varios selectores)
  //   patron      la dirección de los capítulos con {n} donde va el número, para los lotes
  const texto = (v) => String(v ?? '').trim();

  function normalizarAdaptador(a) {
    a = a && typeof a === 'object' ? a : {};
    // ignorar llega como lista o como texto con comas o renglones (así se escribe en opciones)
    const ignorar = (Array.isArray(a.ignorar) ? a.ignorar : String(a.ignorar ?? '').split(/[\n,]/)).map(texto).filter(Boolean);
    const patron = texto(a.patron);
    return { contenedor: texto(a.contenedor), imagenes: texto(a.imagenes), ignorar: [...new Set(ignorar)],
             patron: /^https?:\/\/\S+$/i.test(patron) && patron.includes('{n}') ? patron : '' };
  }

  // Un adaptador que no dice nada no se guarda
  function adaptadorVacio(a) {
    const n = normalizarAdaptador(a);
    return !n.contenedor && !n.imagenes && !n.ignorar.length && !n.patron;
  }

  // El host de lo que se haya escrito: "https://sitio.com/manga/x" o "Sitio.com" → "sitio.com"; '' si no es uno
  function hostDe(escrito) {
    const t = texto(escrito).toLowerCase();
    if (!t) return '';
    try { return new URL(/^[a-z]+:\/\//.test(t) ? t : 'https://' + t).hostname; } catch { return ''; }
  }

  // Los selectores del adaptador que el navegador no entiende. `probar` es quien lo sabe: tiene
  // que tirar un error con un selector inválido (en una página, s => document.querySelector(s)).
  function selectoresInvalidos(a, probar) {
    const n = normalizarAdaptador(a);
    return [n.contenedor, n.imagenes, ...n.ignorar].filter(Boolean).filter(s => { try { probar(s); return false; } catch { return true; } });
  }

  // ── Carpeta base de las descargas ─────────────────────
  // Todo se guarda adentro de una carpeta de Descargas: "MangaReader" si no se dice otra. Puede
  // llevar {sitio}, {serie} y {anio}, y "/" para subcarpetas. Chrome solo deja escribir adentro
  // de Descargas: una ruta que intenta salir ("..", "C:\…", "/home") hace fallar la descarga,
  // así que acá no pasa.
  const CARPETA_DEFECTO = 'MangaReader';
  const CARPETA_MARCAS = ['sitio', 'serie', 'anio'];

  // Por qué esa carpeta no sirve, o '' si está bien
  function validarCarpeta(tpl) {
    const t = texto(tpl);
    if (!t) return 'Escribí una carpeta (o dejá la de siempre: MangaReader).';
    if (/^[\\/]/.test(t) || /^[a-z]:/i.test(t)) return 'Tiene que ser una carpeta adentro de Descargas, no una ruta completa (sin "/" adelante ni "C:").';
    const partes = t.split(/[\\/]/).map(texto);
    if (partes.includes('..') || partes.includes('.')) return 'No puede llevar ".." ni ".": la carpeta va siempre adentro de Descargas.';
    const raras = [...new Set((t.match(/\{[^{}]*\}/g) || []).filter(m => !CARPETA_MARCAS.includes(m.slice(1, -1))))];
    if (raras.length) return `No conozco ${raras.join(', ')}: acá valen {sitio}, {serie} y {anio}.`;
    if (/[<>:"|?*]/.test(t.replace(/\{[^{}]*\}/g, ''))) return 'Tiene caracteres que Windows no acepta en una carpeta (< > : " | ? *).';
    return '';
  }

  // La carpeta ya armada para un capítulo: { sitio, serie, anio }. Si la plantilla no sirve, la de
  // siempre (que una opción mal escrita no impida guardar). Un dato vacío no deja carpeta.
  function aplicarCarpeta(tpl, datos = {}) {
    if (validarCarpeta(tpl)) return CARPETA_DEFECTO;
    const limpio = (s) => String(s ?? '').replace(/[<>:"\\/|?*\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').replace(/[.\s]+$/, '');
    const partes = texto(tpl).split(/[\\/]/)
      .map(p => limpio(p.replace(/\{(\w+)\}/g, (m, k) => limpio(datos[k]))))
      .filter(Boolean);
    return partes.join('/') || CARPETA_DEFECTO;
  }

  // ── Cuánto va a ocupar un lote ────────────────────────
  // No se puede saber sin bajarlo, pero sí estimarlo: desde la 2.11 cada capítulo guardado anota
  // cuánto pesó ("kb"), y el promedio de los de ese sitio (o de esa serie, si hay) por la
  // cantidad que se va a bajar da una idea. Devuelve { kb, de } (de = sobre cuántos capítulos se
  // promedió) o null si todavía no hay de dónde sacarlo.
  const AVISO_TAMANO_KB = 200 * 1024;        // a partir de 200 MB se avisa antes de empezar

  function estimarLote(guardado, { sitio = '', serie = '' } = {}, cuantos = 0) {
    const de = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
    const conPeso = Object.entries(guardado || {}).filter(([, v]) => v && typeof v.kb === 'number' && v.kb > 0);
    const delSitio = conPeso.filter(([, v]) => sitio && de(v.url) === sitio);
    const s = texto(serie).toLowerCase();
    const deLaSerie = s ? delSitio.filter(([ruta, v]) => (typeof v.serie === 'string' ? v.serie : ruta.split('/')[0]).toLowerCase() === s) : [];
    const base = deLaSerie.length >= 2 ? deLaSerie : delSitio;
    if (!base.length || !(cuantos > 0)) return null;
    const promedio = base.reduce((a, [, v]) => a + v.kb, 0) / base.length;
    return { kb: Math.round(promedio * cuantos), de: base.length };
  }

  // "512 KB", "34,5 MB", "1,2 GB"
  function tamanoLegible(kb) {
    if (kb < 1024) return `${Math.round(kb)} KB`;
    const mb = kb / 1024;
    return mb < 1024 ? `${mb.toFixed(mb < 100 ? 1 : 0).replace('.', ',')} MB` : `${(mb / 1024).toFixed(1).replace('.', ',')} GB`;
  }

  // ── ¿Hay una versión nueva? ───────────────────────────
  // La extensión no se actualiza sola (se carga descomprimida): una vez por día se mira qué
  // versión hay en la rama main del repositorio. Cada versión vive en su propia carpeta, así que
  // primero se lee en el README cuál es la última y después el manifest de esa carpeta.
  const REPO_CRUDO = 'https://raw.githubusercontent.com/framallo90/MangaReaderExtension/main/';

  // -1, 0 o 1: "2.9.1" < "2.10.0" (se comparan los números, no las letras)
  function compararVersiones(a, b) {
    const x = String(a || '').split('.').map(n => parseInt(n, 10) || 0), y = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
    return 0;
  }

  // La fila de la extensión en la tabla del README del repositorio → { version, carpeta }, o null
  function versionDelReadme(readme) {
    const m = String(readme || '').match(/\|[^|\n]*extensi[oó]n[^|\n]*\|[^|\n]*\|\s*(\d+\.\d+\.\d+)\s*\|\s*`([^`\n]+)`/i);
    return m ? { version: m[1], carpeta: m[2] } : null;
  }

  // La versión que hay en main, o null si no se pudo saber (sin conexión, repositorio privado…).
  // `pedir` es fetch: se pasa para poder probarlo sin salir a internet.
  async function versionRemota(pedir) {
    const r = await pedir(REPO_CRUDO + 'README.md', { cache: 'no-store' });
    if (!r.ok) return null;
    const dato = versionDelReadme(await r.text());
    if (!dato) return null;
    try {
      // El manifest de esa carpeta es el que manda; si no se puede leer, vale lo que dice el README
      const m = await pedir(REPO_CRUDO + dato.carpeta.split('/').map(encodeURIComponent).join('/') + '/manifest.json', { cache: 'no-store' });
      const v = m.ok ? (await m.json()).version : '';
      if (/^\d+(\.\d+)+$/.test(v || '')) return { version: v, carpeta: dato.carpeta };
    } catch {}
    return dato;
  }

  globalThis.MR_AJUSTES = { RITMO_DEFECTO, normalizarRitmo, pausaAntes, esperaPedida, esperaDelSitio, esperaReintento, pidioEsperar,
    normalizarAdaptador, adaptadorVacio, hostDe, selectoresInvalidos,
    CARPETA_DEFECTO, validarCarpeta, aplicarCarpeta,
    AVISO_TAMANO_KB, estimarLote, tamanoLegible,
    REPO_CRUDO, compararVersiones, versionDelReadme, versionRemota };
  if (typeof module !== 'undefined') module.exports = globalThis.MR_AJUSTES;
})();
