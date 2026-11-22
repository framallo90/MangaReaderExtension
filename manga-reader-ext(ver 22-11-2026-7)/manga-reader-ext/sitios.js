/**
 * Manga Reader v2.10.0 — Sitios de manga y cómics
 * Lista de accesos directos que muestra el ícono de la extensión, más las funciones para
 * filtrarla, para validar los sitios que agrega el usuario y para leer una lista pegada
 * (leerLista). La usan popup.js y opciones.js.
 *
 * Desde la 2.8.5 la extensión no trae sitios incluidos: la lista es la del usuario.
 *
 * Campos de un sitio incluido (los del usuario llevan nombre, url, tipo, idiomas,
 * descripcion y descargable):
 *   tipo     manga | manhwa | webtoon | comics | tiras | historieta | mixto
 *   idiomas  ['es', 'en']
 *   modelo   gratis | gratis con anuncios | freemium | suscripción
 *   guardar  funciona       la extensión guarda los capítulos (probado)
 *            permitido      dominio público o licencia libre
 *            descarga_oficial  el sitio da o vende el archivo (PDF, CBZ, EPUB) sin DRM
 *            no_permite     solo para leer: sus términos no dejan copiar o el contenido está protegido
 *            sin_verificar  condiciones no confirmadas
 */
(function () {
  // Vacía desde la 2.8.5: la lista es la que carga el usuario ("Mis sitios"). Si alguna vez se
  // incluyen sitios, van acá, uno por renglón, con los campos de arriba.
  const SITIOS = [  ];

  const TIPOS = {
    manga: 'Manga', manhwa: 'Manhwa', webtoon: 'Webtoon', comics: 'Cómics',
    tiras: 'Tiras', historieta: 'Historieta', mixto: 'Manga y cómics',
  };
  const ES_MANGA = new Set(['manga', 'manhwa', 'webtoon', 'mixto']);
  const ES_COMICS = new Set(['comics', 'tiras', 'historieta', 'mixto']);

  const GUARDAR = {
    funciona: { icono: '✅', texto: 'Se guarda con la extensión' },
    permitido: { icono: '🟢', texto: 'Permite copias: dominio público o licencia libre' },
    descarga_oficial: { icono: '📥', texto: 'El sitio da su propia descarga (PDF, CBZ o EPUB)' },
    no_permite: { icono: '👁', texto: 'Solo para leer: no permite guardar' },
    sin_verificar: { icono: '❔', texto: 'Condiciones sin verificar' },
    propio: { icono: '⭐', texto: 'Agregado por vos' },
  };
  const SE_GUARDA = new Set(['funciona', 'permitido', 'descarga_oficial']);
  const IDIOMAS = { es: 'Español', en: 'Inglés' };

  // Dirección para comparar dos sitios: sin "www.", sin barra final y sin el #
  function claveUrl(u) {
    try {
      const x = new URL(u);
      return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase();
    } catch { return String(u || '').toLowerCase(); }
  }

  // Valida un sitio que agrega el usuario. Devuelve { ok, sitio } o { ok: false, error }
  function normalizarSitio(s) {
    const nombre = String(s?.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    let url = String(s?.url || '').trim();
    if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;      // "sitio.com" → "https://sitio.com"
    let u;
    try { u = new URL(url); } catch { return { ok: false, error: 'La dirección no es válida' }; }
    if (!/^https?:$/.test(u.protocol)) return { ok: false, error: 'La dirección tiene que empezar con http:// o https://' };
    if (!nombre) return { ok: false, error: 'Falta el nombre' };
    const tipo = TIPOS[s?.tipo] ? s.tipo : 'mixto';
    const idiomas = Array.isArray(s?.idiomas) ? s.idiomas.filter(i => IDIOMAS[i]) : [];
    const descripcion = String(s?.descripcion || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const descargable = s?.descargable === true;           // lo marca el usuario: decide en qué sección va
    return { ok: true, sitio: { nombre, url: u.href, tipo, idiomas, descripcion, descargable, guardar: 'propio', mio: true } };
  }

  // Descargable: el sitio da el archivo, la licencia permite copiarlo o la extensión lo guarda.
  // En los del usuario, lo que haya marcado él.
  function esDescargable(s) {
    return SE_GUARDA.has(s?.guardar) || (s?.guardar === 'propio' && s.descargable === true);
  }

  // La división de la lista: { descargables, leer } (cada parte conserva el orden recibido)
  function dividirSitios(lista) {
    return { descargables: lista.filter(esDescargable), leer: lista.filter(s => !esDescargable(s)) };
  }

  // Idiomas que aparecen en la lista, en el orden de IDIOMAS: para armar el filtro
  function idiomasDe(lista) {
    const hay = new Set(lista.flatMap(s => s.idiomas || []));
    return Object.keys(IDIOMAS).filter(i => hay.has(i));
  }

  // ── Leer una lista pegada ──
  // Arma los sitios a partir de un texto con una dirección por renglón, escrito como venga:
  //   Nombre: https://sitio.com/ — descripción
  //   - [Nombre](https://sitio.com/) descripción
  //   https://sitio.com/          (el nombre sale de la dirección)
  //   sitio.com/manga             (sin https://)
  //   https://a.com https://b.com (varias direcciones solas en un renglón: un sitio cada una)
  // Un renglón sin dirección es un título de grupo ("Manga en español:"): el tipo y el
  // idioma que nombre valen para los renglones que siguen. En cada renglón, el tipo y el
  // idioma salen de su propio texto, después de la dirección y por último del título.
  // Devuelve { sitios: [{nombre, url, tipo, idiomas, descripcion}], repetidos }.
  const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function tipoEn(texto) {
    const t = sinAcentos(texto);
    const manga = /mang[au]|manhua/.test(t), comics = /comic|historieta|tebeo/.test(t);
    if (/manhwa/.test(t)) return 'manhwa';
    if (/webtoon/.test(t)) return 'webtoon';
    if (manga && comics) return 'mixto';
    if (manga) return 'manga';
    if (comics) return 'comics';
    return '';
  }

  function idiomasEn(texto) {
    const t = sinAcentos(texto);
    return [...(/espanol|castellano|latino|spanish/.test(t) ? ['es'] : []), ...(/ingles|english/.test(t) ? ['en'] : [])];
  }

  function leerLista(texto) {
    const URL_RE = /https?:\/\/[^\s<>"'\]]+/gi;
    const SUELTA_RE = /(?:^|[\s(])((?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,10}(?:\/[^\s]*)?)(?=$|[\s),;])/i;   // "sitio.com/manga"
    const limpiarUrl = (u) => {
      u = u.replace(/[.,;:!?»”'"]+$/, '');
      while (u.endsWith(')') && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) u = u.slice(0, -1);
      return u;
    };
    const sitios = [], vistas = new Set();
    let repetidos = 0, grupo = { tipo: '', idiomas: [] };

    const sumar = (nombre, url, descripcion) => {
      let host = '', ruta = '';
      try { const u = new URL(/^https?:/i.test(url) ? url : 'https://' + url); host = u.hostname.replace(/^www\./, ''); ruta = u.pathname; } catch { return; }
      nombre = nombre.replace(/^\s*(?:[-*•·–—]+|\d{1,3}[.)])\s+/, '').replace(/[\s:：\-–—|·(\[]+$/, '').replace(/^[\s*_`]+|[\s*_`]+$/g, '').trim();
      // Lo que quedó pegado a la dirección ("…/a)." ) no es descripción
      descripcion = descripcion.replace(/^[\s\-–—:|·,;.)\]]+/, '').replace(/\s+/g, ' ').trim().replace(/^\((.*)\)$/, '$1');
      const propio = `${nombre} ${descripcion}`;
      const r = normalizarSitio({
        nombre: nombre || host, url, descripcion,
        tipo: tipoEn(propio) || tipoEn(host + ruta) || grupo.tipo || 'mixto',
        idiomas: idiomasEn(propio).length ? idiomasEn(propio) : grupo.idiomas,
      });
      if (!r.ok) return;
      const clave = claveUrl(r.sitio.url);
      if (vistas.has(clave)) { repetidos++; return; }
      vistas.add(clave);
      const { nombre: n, url: u, tipo, idiomas, descripcion: d } = r.sitio;
      sitios.push({ nombre: n, url: u, tipo, idiomas, descripcion: d });
    };

    for (const crudo of String(texto || '').split(/\r?\n/)) {
      const linea = crudo.trim();
      if (!linea) continue;
      // [Nombre](https://sitio.com/) descripción
      const md = linea.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(.*)$/);
      if (md) { sumar(md[1], md[2], md[3]); continue; }

      const urls = [...linea.matchAll(URL_RE)].map(m => ({ i: m.index, crudo: m[0], url: limpiarUrl(m[0]) }));
      if (!urls.length) {
        const s = linea.match(SUELTA_RE);
        if (s) {
          const i = linea.indexOf(s[1]);
          sumar(linea.slice(0, i), s[1].replace(/[.,;:]+$/, ''), linea.slice(i + s[1].length));
        } else {
          grupo = { tipo: tipoEn(linea), idiomas: idiomasEn(linea) };      // título de grupo
        }
        continue;
      }
      // ¿Solo direcciones en el renglón? Entonces cada una es un sitio
      const resto = urls.reduce((t, u) => t.replace(u.crudo, ' '), linea).replace(/[\s,;|·\-–—*•]+|\by\b|\band\b/gi, '');
      if (urls.length > 1 && !resto) { for (const u of urls) sumar('', u.url, ''); continue; }
      const p = urls[0];
      sumar(linea.slice(0, p.i), p.url, linea.slice(p.i + p.url.length));
    }
    return { sitios, repetidos };
  }

  // Lista completa: los del usuario primero (si repiten uno incluido, gana el del usuario) y
  // después los incluidos, cada grupo por nombre
  function juntarSitios(base, mios) {
    const propios = (mios || []).map(normalizarSitio).filter(r => r.ok).map(r => r.sitio);
    const usadas = new Set(propios.map(s => claveUrl(s.url)));
    const orden = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    return [...propios.sort(orden), ...base.filter(s => !usadas.has(claveUrl(s.url))).slice().sort(orden)];
  }

  // filtro: { tipo: 'todos' | 'manga' | 'comics', idioma: 'todos' | 'es' | 'en' | …, soloEs, soloGuardar, texto }
  // (soloEs y soloGuardar son los filtros de la 2.8: siguen andando)
  function filtrarSitios(lista, f = {}) {
    const q = String(f.texto || '').trim().toLowerCase();
    const idioma = f.idioma && f.idioma !== 'todos' ? f.idioma : f.soloEs ? 'es' : '';
    return lista.filter(s =>
      (f.tipo === 'manga' ? ES_MANGA.has(s.tipo) : f.tipo === 'comics' ? ES_COMICS.has(s.tipo) : true) &&
      (!idioma || (s.idiomas || []).includes(idioma)) &&
      (!f.soloGuardar || esDescargable(s)) &&
      (!q || `${s.nombre} ${s.descripcion} ${TIPOS[s.tipo] || ''} ${s.url}`.toLowerCase().includes(q)));
  }

  // "Manga · Gratis · Español e inglés"
  function resumenSitio(s) {
    const idiomas = (s.idiomas || []).map(i => IDIOMAS[i]).filter(Boolean);
    const lang = idiomas.length > 1 ? idiomas.slice(0, -1).join(', ') + ' e ' + idiomas[idiomas.length - 1].toLowerCase() : idiomas[0] || '';
    const modelo = s.modelo ? s.modelo[0].toUpperCase() + s.modelo.slice(1) : '';
    return [TIPOS[s.tipo] || 'Sitio', modelo, lang].filter(Boolean).join(' · ');
  }

  const api = { SITIOS, TIPOS, GUARDAR, IDIOMAS, SE_GUARDA, claveUrl, normalizarSitio, juntarSitios, filtrarSitios, resumenSitio,
                esDescargable, dividirSitios, idiomasDe, leerLista };
  globalThis.MR_SITIOS = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
