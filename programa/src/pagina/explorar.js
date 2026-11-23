  // ── Explorador ───────────────────────────────────────
  // Corre dentro de la página abierta, junto con las funciones de la extensión, y devuelve
  // en limpio lo que hay: si es un capítulo, y qué listas de links tiene (capítulos o títulos).
  // No sabe nada de ningún sitio en particular: agrupa los links por la forma de su dirección.

  const limpio = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  // El texto de un elemento, con un espacio entre sus partes. textContent pega lo que está en
  // bloques distintos ("<h4>El viaje</h4><span>Grupo A</span>" daría "El viajeGrupo A").
  function textoDe(el) {
    if (!el.firstElementChild) return limpio(el.textContent);
    const partes = [], hojas = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = hojas.nextNode());) { const t = n.nodeValue.trim(); if (t) partes.push(t); }
    return limpio(partes.join(' '));
  }
  const PAGINACION_RE = /(?:^|[/?&])(?:page|pagina|pag|p)[/=]$/i;
  const NUMERO_TEXTO_RE = /(?:cap[ií]tulo|chapter|episodio|episode|cap\.?|ch\.?|ep\.?|#)\s*(\d{1,5}(?:\.\d+)?)/i;
  const ARCHIVO_RE = /\.(?:x?html?|shtml|php\d?|aspx?|jsp|cgi)$/i;
  // Links que suelen llevar al listado completo de un sitio (la portada muestra solo una parte)
  const CATALOGO_RE = /^(?:cat[aá]logo|directorio|biblioteca|listado|library|directory|browse|explorar|explore|a\s*-\s*z|ver tod[oa]s?|(?:lista|listado|biblioteca) de (?:mangas?|series|c[oó]mics|t[ií]tulos)|(?:tod[oa]s )?l[oa]s (?:mangas?|series|c[oó]mics|t[ií]tulos)|all (?:manga|series|comics|titles)|manga list|series|mangas?|c[oó]mics|t[ií]tulos)$/i;
  // Lo mismo, cuando el texto del link no lo dice (un ícono, "Explorar") pero su dirección sí
  const CATALOGO_RUTA_RE = /^\/(?:[a-z]{2}\/)?(?:cat[aá]logo|directorio|biblioteca|listado|library|directory|browse|explorar|explore|lista|list|lista-de-(?:mangas?|series|comics)|series|mangas?|comics|titulos)\/?$/i;
  // Links que no llevan a un título sino a un filtro del listado: géneros, etiquetas, tipos, autores…
  // Se reconocen por una palabra de su dirección (/genero/accion, /tag/shonen, ?genres=3).
  const FILTRO_RUTA_RE = /^(?:g[eé]neros?|genres?|categor[ií]as?|categor(?:y|ies)|tags?|etiquetas?|tipos?|types?|demograf[ií]as?|demographics?|estados?|status|autor(?:es)?|authors?|artistas?|artists?|grupos?|groups?|scans?|scanlations?|idiomas?|languages?|filtros?|filters?)$/i;
  const FILTRO_CONSULTA_RE = /^(?:gen(?:d|r)ers?|genres?|g[eé]neros?|categor|tags?|types?|tipos?|demogra|status|estados?|order|orden|sort|filtro|filter)/i;
  const esFiltro = (u) => u.pathname.split('/').slice(0, -1).some(seg => FILTRO_RUTA_RE.test(decodeURIComponent(seg))) || [...u.searchParams.keys()].some(k => FILTRO_CONSULTA_RE.test(k));
  // El renglón de un link: el bloque más chico que lo contiene y nombra un capítulo ("Capítulo 5 · Leer").
  // Sirve cuando el número no está en el link (un botón, el nombre de un grupo) sino al lado.
  function filaDe(el) {
    for (let p = el.parentElement, k = 0; p && k < 6; p = p.parentElement, k++) {
      if (p.textContent.length > 400) break;
      const t = textoDe(p);
      if (t.length > 260) break;
      if (NUMERO_TEXTO_RE.test(t)) return t;
    }
    return '';
  }
  // El texto de un link sin lo que tenga pegado adelante o atrás que no sea letra (un ícono, "»")
  const sinAdornos = (s) => String(s || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const IMAGEN_RE = /\.(?:jpe?g|png|webp|gif|avif|bmp)$/i;
  const esPaginacion = (u) => [...u.searchParams].some(([k, v]) => /^(?:page|pagina|pag|p)$/i.test(k) && /^\d+$/.test(v));

  // Baja hasta el final para que aparezca lo que la página carga a medida que se baja (los
  // listados "infinitos") y vuelve arriba. Corta cuando la página deja de crecer. Devuelve
  // true si se quedó sin pasos y la página seguía creciendo.
  async function bajarTodo(maxPasos = 30) {
    let antes = '', quieta = 0, pasos = 0;
    for (; pasos < maxPasos && quieta < 2; pasos++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(350);
      const ahora = document.documentElement.scrollHeight + '/' + document.querySelectorAll('a[href]').length;
      quieta = ahora === antes ? quieta + 1 : 0;
      antes = ahora;
    }
    window.scrollTo(0, 0);
    return quieta < 2;
  }

  // "…/2021/01/serie-manga-07-es.html" → carpeta "…/#/#" · nombre "serie-manga-07-es" · forma "serie-manga-#-es.html"
  function partes(u) {
    const segs = u.pathname.split('/').filter(Boolean);
    let nombre = segs.pop() || '';
    try { nombre = decodeURIComponent(nombre); } catch {}
    const carpeta = u.origin + '/' + segs.map(s => /^\d+$/.test(s) ? '#' : s).join('/');
    const sinExt = nombre.replace(ARCHIVO_RE, '');
    return { carpeta, nombre: sinExt, forma: nombre.replace(/\d+(?:\.\d+)?/g, '#'),
             nums: sinExt.match(/(?<![\d.])\d{1,5}(?:\.\d+)?(?![\d.])/g) || [] };
  }

  // El link de una imagen: el que la envuelve o, si no, el de su tarjeta (el bloque más chico
  // que tiene un link y ninguna otra de las imágenes `candidatas`)
  function linkDeImagen(img, candidatas) {
    let a = img.closest('a[href]');
    for (let el = img.parentElement, k = 0; !a && el && k < 4; el = el.parentElement, k++) {
      if ([...el.querySelectorAll('img')].filter(i => candidatas.has(i)).length > 1) break;
      a = el.querySelector('a[href]');
    }
    return a;
  }

  // La imagen que acompaña a cada link (la tapa de un título, la miniatura de un capítulo):
  // dirección del link → dirección de la imagen. No cuentan los íconos (menos de 80 px).
  function imagenesDeLinks() {
    const imgs = [...document.querySelectorAll('img')].filter(img =>
      imgUrl(img) && !(img.complete && img.naturalWidth && (img.naturalWidth < 80 || img.naturalHeight < 80)));
    const candidatas = new Set(imgs), de = new Map();
    for (const img of imgs) {
      const a = linkDeImagen(img, candidatas);
      if (!a) continue;
      let u;
      try { u = new URL(a.getAttribute('href'), document.baseURI); } catch { continue; }
      const clave = noSlash(u.href.split('#')[0]);
      if (!de.has(clave)) de.set(clave, imgUrl(img));
    }
    return de;
  }

  // Links de la página, sin repetir, en el orden del documento. Cada uno recuerda el título
  // (h1…h6) que tenía arriba: de ahí salen los volúmenes y las sagas cuando la página los
  // separa. Y la imagen que lo acompaña, si tiene.
  function juntarLinks() {
    const aqui = noSlash(location.href.split('#')[0]);
    const porUrl = new Map();
    const imagenes = imagenesDeLinks();
    let seccion = '';
    reiniciarSeccion();
    for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, summary, a[href]')) {
      if (el.tagName !== 'A') {
        const t = limpio(el.textContent);
        if (t && t.length <= 80) seccion = capturarSeccion(t);
        continue;
      }
      let u;
      try { u = new URL(el.getAttribute('href'), document.baseURI); } catch { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;
      const url = u.href.split('#')[0];
      const clave = noSlash(url);
      if (clave === aqui) continue;
      const texto = textoDe(el) || limpio(el.getAttribute('aria-label')) || limpio(el.title) || limpio(el.querySelector('img')?.alt);
      const ya = porUrl.get(clave);
      if (ya) { if (!ya.texto && texto) ya.texto = texto; continue; }
      const s = splitChapterUrl(url);
      if (esPaginacion(u) || (s && (PAGINACION_RE.test(s.pre) || isDateArchive(s, texto)))) continue;   // paginación y archivo por fecha
      const p = partes(u);
      if (/^(?:19|20)\d{2}$/.test(p.nombre) && (!texto || texto.includes(p.nombre))) continue;   // archivo por año
      if (!p.nums.length && s && !u.pathname.endsWith(s.num)) p.nums = [s.num];        // ?capitulo=12
      porUrl.set(clave, { url, texto, seccion, imagen: imagenes.get(clave) || '', filtro: esFiltro(u),
                          fila: NUMERO_TEXTO_RE.test(texto) ? '' : filaDe(el), ...p });
    }
    return [...porUrl.values()];
  }

  // De un grupo de links con la misma forma, el número de capítulo de cada uno: el que
  // cambia de un link a otro. null si no hay un número distinto para cada uno.
  function numerar(items) {
    if (items.some(i => !i.nums.length)) return null;
    const distintos = (v) => new Set(v.map(parseFloat)).size === v.length;
    const k = items[0].nums.length;
    if (items.every(i => i.nums.length === k)) {
      for (let j = k - 1; j >= 0; j--) { const v = items.map(i => i.nums[j]); if (distintos(v)) return v.map(parseFloat); }
      return null;
    }
    const ult = items.map(i => i.nums[i.nums.length - 1]);
    return distintos(ult) ? ult.map(parseFloat) : null;
  }

  const nombreDe = (i) => i.texto || limpio(i.nombre.replace(/[-_+]+/g, ' ')) || i.url;

  // `conocidas`: ids de listas que ya se venían juntando de páginas anteriores. Esas valen
  // aunque acá tengan un solo link (la última página de un listado suele quedar corta).
  function listasDe(links, conocidas = []) {
    const listas = [], usados = new Set();

    // 1) Capítulos: links con la misma forma y un número que cambia ("…/serie-#", "…/#/#/serie-manga-#-es.html")
    const porForma = new Map();
    for (const l of links) {
      if (!l.nums.length) continue;
      const k = l.carpeta + '|' + l.forma;
      if (!porForma.has(k)) porForma.set(k, []);
      porForma.get(k).push(l);
    }
    for (const [k, grupo] of porForma) {
      if (grupo.length < 2 && !conocidas.includes('c:' + k)) continue;
      if (grupo.filter(l => l.filtro).length >= grupo.length * 0.6) continue;      // géneros, etiquetas…: van con los filtros
      const n = numerar(grupo);
      if (!n) continue;
      grupo.forEach(l => usados.add(l.url));
      const items = conSecciones(grupo).map((l, i) => ({ url: l.url, texto: nombreDe(l), numero: n[i], seccion: l.seccion, imagen: l.imagen }))
        .sort((a, b) => a.numero - b.numero);
      listas.push({ tipo: 'capitulos', id: 'c:' + k, nombre: k.split('|')[1], items });
    }

    // 2) Lo demás, por carpeta: títulos de un catálogo… o capítulos cuya dirección no dice el
    //    número (un código, un nombre): ahí se prueba con el número que diga el texto del link.
    const porCarpeta = new Map();
    for (const l of links) {
      if (usados.has(l.url)) continue;
      if (!porCarpeta.has(l.carpeta)) porCarpeta.set(l.carpeta, []);
      porCarpeta.get(l.carpeta).push(l);
    }
    for (const [k, grupo] of porCarpeta) {
      if (grupo.length < 3 && !conocidas.includes('g:' + k) && !conocidas.includes('t:' + k)) continue;
      // ¿Son capítulos? El número de cada uno puede estar en el texto del link, en su renglón
      // ("Capítulo 5 · Leer") o en el título que tiene encima. Vale si casi todos lo tienen y
      // los números van más o menos seguidos: en "últimas actualizaciones" también dice
      // "Capítulo 87", pero son de series distintas y salen salteados.
      const dato = (l) => [l.texto, l.fila, l.seccion].find(t => NUMERO_TEXTO_RE.test(t || '')) || '';
      const conNumero = grupo.filter(l => dato(l));
      const numeros = [...new Set(conNumero.map(l => parseFloat(dato(l).match(NUMERO_TEXTO_RE)[1])))];
      const seguidos = numeros.length <= 3 || numeros.length / (Math.max(...numeros) - Math.min(...numeros) + 1) >= 0.34;
      const base = conSecciones(grupo);
      if (numeros.length >= 2 && conNumero.length >= grupo.length * 0.8 && seguidos) {
        // Un capítulo puede tener varios links (subido por más de un grupo): queda el primero
        const porNumero = new Map();
        for (const l of base) {
          const d = dato(l);
          if (!d) continue;
          const numero = parseFloat(d.match(NUMERO_TEXTO_RE)[1]);
          const ya = porNumero.get(numero);
          if (ya) { ya.versiones++; continue; }
          porNumero.set(numero, { url: l.url, texto: NUMERO_TEXTO_RE.test(l.texto) ? nombreDe(l) : d.slice(0, 90), numero, seccion: NUMERO_TEXTO_RE.test(l.seccion || '') ? '' : l.seccion, imagen: l.imagen, versiones: 1 });
        }
        listas.push({ tipo: 'capitulos', id: 't:' + k, nombre: new URL(k).pathname || '/', items: [...porNumero.values()].sort((x, y) => x.numero - y.numero) });
      } else {
        // Títulos… o filtros del listado (géneros, etiquetas): esos no son series
        const filtros = grupo.filter(l => l.filtro).length >= grupo.length * 0.6;
        listas.push({ tipo: filtros ? 'filtros' : 'titulos', id: 'g:' + k, nombre: new URL(k).pathname || '/',
                      items: base.map(l => ({ url: l.url, texto: nombreDe(l), seccion: l.seccion, imagen: l.imagen })) });
      }
    }

    // 3) Lo que la extensión saca de un desplegable o de la dirección del capítulo abierto
    const ch = collectChapters();
    const mayor = Math.max(0, ...listas.filter(l => l.tipo === 'capitulos').map(l => l.items.length));
    if (ch.list.length >= 2 && ch.list.length > mayor && (ch.pat || ch.list.every(c => c.url))) {
      const items = ch.list.map(c => ({
        url: c.url || ch.pat.pre + (c.raw || numForms(c.numero, ch.width)[0]) + ch.pat.post,
        texto: c.title, numero: c.numero, seccion: '' }));
      // Tampoco acá valen los filtros: "/genero/12" tiene la forma de un capítulo y no lo es
      const deFiltro = (i) => { try { return esFiltro(new URL(i.url)); } catch { return false; } };
      if (items.filter(deFiltro).length < items.length * 0.6) listas.push({ tipo: 'capitulos', id: 'x:extension', nombre: 'por número', items });
    }

    // Primero los capítulos, después los títulos y al final los filtros. Entre listas de títulos
    // va antes la que tiene tapas (las series de un catálogo las tienen; un menú, no) y, a
    // igualdad, la más larga.
    const orden = { capitulos: 0, titulos: 1, filtros: 2 };
    const tapas = (l) => l.items.filter(i => i.imagen).length;
    return listas.sort((a, b) => orden[a.tipo] - orden[b.tipo] || (a.tipo === 'titulos' ? tapas(b) - tapas(a) : 0) || b.items.length - a.items.length);
  }

  function siguientePagina() {
    const rel = document.querySelector('link[rel~="next"], a[rel~="next"]');
    if (rel?.href && absUrl(rel.href)) return absUrl(rel.href);
    for (const a of document.querySelectorAll('a[href]')) {
      if (/^(?:siguiente|next|más|mas|older|›|»|>|→)\s*(?:página|page)?\s*[›»>→]?$/i.test(limpio(a.textContent))) {
        const u = absUrl(a.getAttribute('href'));
        if (u && noSlash(u) !== noSlash(location.href.split('#')[0])) return u;
      }
    }
    return '';
  }

  // ¿Las imágenes grandes de esta página son las tapas de un listado, y no las páginas de un
  // capítulo? Una tapa es una imagen que lleva a otra página del sitio (la de su serie): el
  // link la envuelve o está en su tarjeta. Las páginas de un capítulo no son links o, si lo
  // son, llevan a la imagen en grande, a una parte de esta misma página o todas al mismo
  // lado (el capítulo siguiente): ahí un mismo destino junta muchas imágenes distintas,
  // mientras que el de una tapa junta una sola, aunque la portada la repita en dos secciones.
  // Es un listado si hay tapas y, sacándolas, no queda nada con forma de capítulo (tres
  // imágenes grandes en una misma carpeta). Así un capítulo con tapas de "otras series" al
  // final sigue siendo un capítulo.
  function pareceListado() {
    const grandes = [...document.querySelectorAll('img')].filter(img =>
      imgUrl(img) && !(img.complete && img.naturalWidth && (img.naturalWidth < MIN_SIDE || img.naturalHeight < MIN_SIDE)));
    if (grandes.length < 3) return false;
    const esGrande = new Set(grandes);
    const aca = noSlash(location.href.split('#')[0]);
    const destinoDe = new Map(), imagenesDe = new Map();      // imagen → destino · destino → imágenes distintas que llevan ahí
    for (const img of grandes) {
      const a = linkDeImagen(img, esGrande);
      if (!a) continue;
      let u;
      try { u = new URL(a.getAttribute('href'), document.baseURI); } catch { continue; }
      const destino = noSlash(u.href.split('#')[0]);
      if (u.origin !== location.origin || IMAGEN_RE.test(u.pathname)) continue;                       // un aviso, o la imagen en grande
      if (destino === aca || u.pathname === location.pathname) continue;                             // esta misma página
      if (location.pathname.length > 1 && destino.startsWith(aca + '/')) continue;                    // una parte de esta página (…/capitulo-5/pagina/2)
      destinoDe.set(img, destino);
      if (!imagenesDe.has(destino)) imagenesDe.set(destino, new Set());
      imagenesDe.get(destino).add(imgUrl(img));
    }
    const esTapa = (img) => destinoDe.has(img) && imagenesDe.get(destinoDe.get(img)).size <= 2;
    if (grandes.filter(esTapa).length < 3) return false;
    const carpetas = new Map();
    for (const img of grandes) {
      if (esTapa(img)) continue;
      const d = urlDir(imgUrl(img));
      carpetas.set(d, (carpetas.get(d) || 0) + 1);
    }
    return Math.max(0, ...carpetas.values()) < 3;
  }

  // Links del mismo sitio que parecen llevar a su listado completo ("Directorio", "Biblioteca",
  // /library…): primero los que lo dicen en su texto, después los que lo dicen en su dirección.
  // Se miran todos los links de la página: el del listado suele traer la página o el orden
  // (/library?order=…&page=1), y por eso no entra en las listas de títulos.
  function catalogosDe() {
    const aca = noSlash(location.origin + location.pathname), vistos = new Map();
    for (const el of document.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(el.getAttribute('href'), document.baseURI); } catch { continue; }
      if (u.origin !== location.origin) continue;
      const texto = textoDe(el) || limpio(el.getAttribute('aria-label')) || limpio(el.title);
      let ruta = u.pathname;
      try { ruta = decodeURIComponent(ruta); } catch {}
      const porRuta = CATALOGO_RUTA_RE.test(ruta), porTexto = CATALOGO_RE.test(sinAdornos(texto));
      if (!porRuta && !porTexto) continue;
      // La dirección del listado: sin el número de página; y si la dirección sola ya lo nombra, sin el orden ni los filtros
      if (porRuta) u.search = '';
      else for (const k of [...u.searchParams.keys()]) if (/^(?:page|pagina|pag|p)$/i.test(k)) u.searchParams.delete(k);
      const destino = u.href.split('#')[0];
      if (noSlash(u.origin + u.pathname) === aca) continue;             // ya se está ahí
      const ya = vistos.get(noSlash(destino));
      if (!ya) vistos.set(noSlash(destino), { url: destino, texto: texto || ruta, porTexto });
      else if (porTexto && !ya.porTexto) Object.assign(ya, { texto, porTexto });
    }
    return [...vistos.values()].sort((a, b) => b.porTexto - a.porTexto).slice(0, 5).map(({ url, texto }) => ({ url, texto }));
  }

  const comandos = {
    // Imágenes que parecen páginas (cargadas o no) y links: para saber cuándo la página terminó de armarse
    contar: () => ({ imagenes: countCandidates(), links: document.querySelectorAll('a[href]').length, listo: document.readyState === 'complete' }),

    explorar: async ({ conocidas = [] } = {}) => {
      const sigue = await bajarTodo();                // primero, que aparezca lo que carga al bajar
      const c = detectChapter();
      // Muchas imágenes grandes no alcanzan: la portada de un sitio también las tiene (las tapas)
      const esCapitulo = (looksLikeChapter() || (countCandidates() >= 5 && !!c)) && !pareceListado();
      const links = juntarLinks();


      return {
        url: location.href.split('#')[0], titulo: limpio(document.title),
        // Cómo se llama la serie de esta página, si se puede saber: la del capítulo o el título grande
        serie: c?.serie || cleanSerie(limpio(document.querySelector('h1')?.textContent).slice(0, 80)),
        capitulo: esCapitulo ? { serie: c?.serie || '', numero: c?.numero ?? null, nombre: suggestName(), imagenes: countCandidates() } : null,
        listas: listasDe(links, conocidas),
        siguiente: siguientePagina(),
        // Links del mismo sitio que parecen llevar al listado completo ("Directorio", "Biblioteca"…):
        // primero los que lo dicen en su texto, después los que lo dicen en su dirección
        catalogos: catalogosDe(),
        sigueCreciendo: sigue,                        // la página seguía cargando más al bajar: puede faltar
      };
    },

    // Todas las imágenes del capítulo abierto, con lo que el filtro dejaría afuera y por qué
    // (`motivo`): para revisarlas a mano antes de bajarlo, como en el diálogo de la extensión
    revisar: async ({ recorrer = true }) => {
      if (recorrer) { await scrollThrough(); window.scrollTo(0, 0); }
      const r = await collectPages();
      const c = detectChapter();
      return {
        paginas: r.pages.map(p => ({ url: p.url, ancho: p.w, alto: p.h, motivo: p.flag || '' })),
        faltantes: r.failed, capitulo: c ? { serie: c.serie, numero: c.numero } : null,
        nombre: suggestName(), clave: pageKey(), titulo: limpio(document.title),
      };
    },

    // Las páginas del capítulo abierto, después de recorrerlo para que carguen todas
    paginas: async ({ recorrer = true }) => {
      if (recorrer) { await scrollThrough(); window.scrollTo(0, 0); }
      const r = await collectPages();
      const c = detectChapter();
      return {
        urls: r.pages.filter(p => !p.flag).map(p => p.url),
        descartadas: r.pages.filter(p => p.flag).length, faltantes: r.failed,
        capitulo: c ? { serie: c.serie, numero: c.numero } : null,
        nombre: suggestName(), clave: pageKey(), titulo: limpio(document.title),
      };
    },
  };
