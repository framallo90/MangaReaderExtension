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
  // Un link que es una tarjeta trae varias cosas escritas: el nombre, el tipo, la nota, "204
  // caps"… De ahí se separa el nombre de lo demás:
  //   nombre   cómo se llama (lo que va a "Serie" al entrar)
  //   detalle  el resto, para mostrarlo al lado
  //   todo     el texto entero (ahí se busca el número de capítulo)
  // El nombre es el título que tenga adentro (h1…h6); si no, lo que coincide con el `title`
  // del link o el `alt` de su imagen; si no, lo escrito más grande (y, a igual tamaño, más
  // grueso y más largo). Lo que está en un mismo renglón y del mismo tamaño va junto.
  function leerLink(el) {
    if (!el.firstElementChild) { const t = limpio(el.textContent); return { nombre: t, detalle: '', todo: t }; }
    const partes = [], hojas = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = hojas.nextNode());) {
      const t = limpio(n.nodeValue);
      if (!t) continue;
      const estilo = getComputedStyle(n.parentElement);
      let bloque = n.parentElement;
      while (bloque !== el && getComputedStyle(bloque).display === 'inline') bloque = bloque.parentElement;
      const tam = parseFloat(estilo.fontSize) || 0, ult = partes[partes.length - 1];
      if (ult && ult.bloque === bloque && ult.tam === tam) { ult.t += ' ' + t; ult.peso = Math.max(ult.peso, parseInt(estilo.fontWeight) || 400); }
      else partes.push({ t, bloque, tam, peso: parseInt(estilo.fontWeight) || 400, de: n.parentElement });
    }
    const todo = partes.map(p => p.t).join(' ');
    if (partes.length < 2) return { nombre: todo, detalle: '', todo };
    const titulo = el.querySelector('h1, h2, h3, h4, h5, h6');
    let mias;
    if (titulo && limpio(titulo.textContent)) mias = partes.filter(p => titulo.contains(p.de));
    else {
      const pistas = [el.title, el.getAttribute('aria-label'), el.querySelector('img')?.alt].map(s => limpio(s).toLowerCase()).filter(Boolean);
      const conLetras = partes.filter(p => /\p{L}{2}/u.test(p.t));
      const puntos = (p) => p.tam * 1000 + p.peso + Math.min(p.t.length, 60) / 100;
      const mejor = conLetras.find(p => pistas.includes(p.t.toLowerCase())) || conLetras.sort((a, b) => puntos(b) - puntos(a))[0];
      mias = mejor ? [mejor] : [];
    }
    if (!mias.length) return { nombre: todo, detalle: '', todo };
    return { nombre: mias.map(p => p.t).join(' '), detalle: [...new Set(partes.filter(p => !mias.includes(p)).map(p => p.t))].join(' · ').slice(0, 140), todo };
  }
  const PAGINACION_RE = /(?:^|[/?&])(?:page|pagina|pag|p)[/=]$/i;
  // (sin letra adelante: en "Sep 12" o "March 5" no hay ningún capítulo)
  const NUMERO_TEXTO_RE = /(?<!\p{L})(?:cap[ií]tulo|chapter|episodio|episode|cap\.?|ch\.?|ep\.?|#)\s*(\d{1,5}(?:\.\d+)?)/iu;
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
  // Con `soloNuevos` (después de escribir en el buscador de la página) quedan afuera los
  // links que ya estaban antes de buscar: lo que queda son los resultados.
  let antesDeBuscar = null;
  function juntarLinks(soloNuevos = false) {
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
      if (soloNuevos && antesDeBuscar && antesDeBuscar.has(clave)) continue;     // ya estaba antes de buscar: no es un resultado
      const leido = leerLink(el);
      const texto = leido.nombre || limpio(el.getAttribute('aria-label')) || limpio(el.title) || limpio(el.querySelector('img')?.alt);
      const todo = leido.todo || texto;
      const ya = porUrl.get(clave);
      if (ya) { if (!ya.texto && texto) Object.assign(ya, { texto, todo, detalle: leido.detalle }); continue; }
      const s = splitChapterUrl(url);
      if (esPaginacion(u) || (s && (PAGINACION_RE.test(s.pre) || isDateArchive(s, texto)))) continue;   // paginación y archivo por fecha
      const p = partes(u);
      if (/^(?:19|20)\d{2}$/.test(p.nombre) && (!texto || texto.includes(p.nombre))) continue;   // archivo por año
      if (!p.nums.length && s && !u.pathname.endsWith(s.num)) p.nums = [s.num];        // ?capitulo=12
      porUrl.set(clave, { url, texto, todo, detalle: leido.detalle, seccion, imagen: imagenes.get(clave) || '', filtro: esFiltro(u),
                          fila: NUMERO_TEXTO_RE.test(todo) ? '' : filaDe(el), ...p });
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

  // Si las direcciones de una lista de capítulos solo cambian en el número (…/cap-7, …/cap-8),
  // el molde para armar la de cualquier otro: { pre, post, ancho } (ancho: cifras, cuando
  // llevan ceros adelante). Sirve cuando la página muestra solo algunos (el primero y el
  // último): los del medio se pueden pedir por número. null si no se puede.
  function moldeDe(items) {
    const enteros = items.filter(i => Number.isInteger(i.numero));
    if (enteros.length < 2 || new Set(enteros.map(i => i.numero)).size < 2) return null;
    const a = enteros[0].url, b = enteros.find(i => i.numero !== enteros[0].numero).url;
    let p = 0, s = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    while (p > 0 && /\d/.test(a[p - 1])) p--;                       // el número entero, no solo las cifras que cambian
    while (s > 0 && /\d/.test(a[a.length - s])) s--;
    const pre = a.slice(0, p), post = s ? a.slice(a.length - s) : '';
    const medio = (u) => u.startsWith(pre) && u.endsWith(post) && u.length > pre.length + post.length ? u.slice(pre.length, u.length - post.length) : '';
    if (!enteros.every(i => /^\d+$/.test(medio(i.url)) && +medio(i.url) === i.numero)) return null;
    const medios = enteros.map(i => medio(i.url));
    const ancho = medios.some(m => m.length > 1 && m[0] === '0') && medios.every(m => m.length === medios[0].length) ? medios[0].length : 0;
    return { pre, post, ancho };
  }

  const nombreDe = (i) => i.texto || limpio(i.nombre.replace(/[-_+]+/g, ' ')) || i.url;

  // `conocidas`: ids de listas que ya se venían juntando de páginas anteriores. Esas valen
  // aunque acá tengan un solo link (la última página de un listado suele quedar corta).
  // `minimo`: cuántos links hacen falta para armar una lista de títulos (3; 1 si son los
  // resultados de una búsqueda, que pueden ser uno solo).
  function listasDe(links, conocidas = [], minimo = 3) {
    const listas = [], usados = new Set();
    // Tarjetas con tapa: cada link trae su imagen. Así se ven los títulos de un catálogo o de
    // "últimas actualizaciones", no los capítulos de una serie.
    const conTapa = (g) => g.length >= 3 && g.filter(l => l.imagen).length >= g.length * 0.6;
    const item = (l) => ({ url: l.url, texto: nombreDe(l), detalle: l.detalle || '', seccion: l.seccion, imagen: l.imagen });

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
      // Títulos con un código en su dirección (/manga/1204): tienen tapa y su texto no nombra ningún capítulo
      if (conTapa(grupo) && grupo.filter(l => NUMERO_TEXTO_RE.test(l.todo)).length < grupo.length * 0.5) continue;
      const n = numerar(grupo);
      if (!n) continue;
      grupo.forEach(l => usados.add(l.url));
      const items = conSecciones(grupo).map((l, i) => ({ ...item(l), numero: n[i] })).sort((a, b) => a.numero - b.numero);
      listas.push({ tipo: 'capitulos', id: 'c:' + k, nombre: k.split('|')[1], items, molde: moldeDe(items) });
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
      if (grupo.length < minimo && !conocidas.includes('g:' + k) && !conocidas.includes('t:' + k)) continue;
      // ¿Son capítulos? El número de cada uno puede estar en el texto del link, en su renglón
      // ("Capítulo 5 · Leer") o en el título que tiene encima. Vale si casi todos lo tienen y
      // los números van más o menos seguidos: en "últimas actualizaciones" también dice
      // "Capítulo 87", pero son de series distintas y salen salteados.
      // Y si cada uno trae su tapa, son títulos con su último capítulo, no los de una serie.
      const dato = (l) => [l.todo, l.fila, l.seccion].find(t => NUMERO_TEXTO_RE.test(t || '')) || '';
      const conNumero = grupo.filter(l => dato(l));
      const numeros = [...new Set(conNumero.map(l => parseFloat(dato(l).match(NUMERO_TEXTO_RE)[1])))];
      const seguidos = numeros.length <= 3 || numeros.length / (Math.max(...numeros) - Math.min(...numeros) + 1) >= 0.34;
      const base = conSecciones(grupo);
      if (numeros.length >= 2 && conNumero.length >= grupo.length * 0.8 && seguidos && !conTapa(grupo)) {
        // Un capítulo puede tener varios links (subido por más de un grupo): queda el primero
        const porNumero = new Map();
        for (const l of base) {
          const d = dato(l);
          if (!d) continue;
          const numero = parseFloat(d.match(NUMERO_TEXTO_RE)[1]);
          const ya = porNumero.get(numero);
          if (ya) { ya.versiones++; continue; }
          porNumero.set(numero, { url: l.url, texto: NUMERO_TEXTO_RE.test(l.texto) ? nombreDe(l) : d.slice(0, 90), numero, seccion: NUMERO_TEXTO_RE.test(l.seccion || '') ? '' : l.seccion, imagen: l.imagen, versiones: 1,
                                  detalle: NUMERO_TEXTO_RE.test(l.texto) ? l.detalle || '' : '' });
        }
        listas.push({ tipo: 'capitulos', id: 't:' + k, nombre: new URL(k).pathname || '/', items: [...porNumero.values()].sort((x, y) => x.numero - y.numero) });
      } else {
        // Títulos… o filtros del listado (géneros, etiquetas): esos no son series
        const filtros = grupo.filter(l => l.filtro).length >= grupo.length * 0.6;
        listas.push({ tipo: filtros ? 'filtros' : 'titulos', id: 'g:' + k, nombre: new URL(k).pathname || '/',
                      items: base.map(item) });
      }
    }

    // 3) Lo que la extensión saca de un desplegable o de la dirección del capítulo abierto
    const ch = collectChapters();
    const mayor = Math.max(0, ...listas.filter(l => l.tipo === 'capitulos').map(l => l.items.length));
    if (ch.list.length >= 2 && ch.list.length > mayor && (ch.pat || ch.list.every(c => c.url))) {
      const items = ch.list.map(c => ({
        url: c.url || ch.pat.pre + (c.raw || numForms(c.numero, ch.width)[0]) + ch.pat.post,
        texto: c.title, numero: c.numero, seccion: '' }));
      // Tampoco acá valen los filtros ("/genero/12" tiene la forma de un capítulo y no lo es)
      // ni las tarjetas con tapa que el paso 1 ya dejó como títulos
      const deFiltro = (i) => { try { return esFiltro(new URL(i.url)); } catch { return false; } };
      const porUrl = new Map(links.map(l => [noSlash(l.url), l]));
      const suyos = items.map(i => porUrl.get(noSlash(i.url))).filter(Boolean);
      const sonTitulos = suyos.length >= items.length * 0.6 && conTapa(suyos) && suyos.filter(l => NUMERO_TEXTO_RE.test(l.todo)).length < suyos.length * 0.5;
      if (items.filter(deFiltro).length < items.length * 0.6 && !sonTitulos) listas.push({ tipo: 'capitulos', id: 'x:extension', nombre: 'por número', items });
    }

    // Primero los capítulos, después los títulos y al final los filtros. Entre listas de títulos
    // va antes la que es toda de tarjetas con tapa (las series de un catálogo o los resultados
    // de una búsqueda; un menú con el logo, no), después la que tiene más tapas y, a igualdad,
    // la más larga.
    const orden = { capitulos: 0, titulos: 1, filtros: 2 };
    const tapas = (l) => l.items.filter(i => i.imagen).length;
    const deTarjetas = (l) => (tapas(l) >= l.items.length * 0.6 ? 1 : 0);
    return listas.sort((a, b) => orden[a.tipo] - orden[b.tipo] || (a.tipo === 'titulos' ? deTarjetas(b) - deTarjetas(a) || tapas(b) - tapas(a) : 0) || b.items.length - a.items.length);
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

  // ── Lo que la página esconde hasta que se toca algo ──
  // Hay listas que no están a la vista al cargar: aparecen al tocar la pestaña "Capítulos",
  // o de a tandas con un botón "Ver más" / "Mostrar todos". Se tocan esos botones (nunca un
  // link que lleve a otra página) hasta que dejan de aparecer links nuevos.
  const PESTANA_RE = /^(?:(?:lista de )?cap[ií]tulos|chapters?(?: list)?|episodios|episodes)(?:\s*[(:·-]?\s*\d+\s*\)?)?$/i;
  const DESPLEGAR_RE = /^(?:(?:ver|mostrar|cargar|show|load|view|see)\s+(?:m[aá]s|tod[oa]s?|more|all)(?:\s+(?:l[oa]s\s+)?(?:cap[ií]tulos|chapters|episodios|episodes))?|(?:tod[oa]s\s+l[oa]s|all|m[aá]s|more)\s+(?:cap[ií]tulos|chapters|episodios|episodes)|expandir|expand|desplegar)$/i;
  async function desplegar() {
    const aca = location.href.split('#')[0];
    const cuenta = () => document.querySelectorAll('a[href]').length;
    const botones = (re) => [...document.querySelectorAll('button, [role="button"], [role="tab"], a:not([href]), a[href^="#"]')].filter(b =>
      !b.closest('form') && !b.disabled && b.getClientRects().length && re.test(sinAdornos(limpio(b.textContent).slice(0, 60))));
    let toques = 0;
    for (const b of botones(PESTANA_RE).slice(0, 2)) {
      if (b.getAttribute('aria-selected') === 'true') continue;
      b.click();
      toques++;
      await sleep(600);
    }
    const sinEfecto = new Set();
    for (let k = 0; k < 20 && location.href.split('#')[0] === aca; k++) {
      const b = botones(DESPLEGAR_RE).find(x => !sinEfecto.has(x));
      if (!b) break;
      const antes = cuenta();
      b.click();
      toques++;
      for (let e = 0; e < 4 && cuenta() <= antes; e++) await sleep(300);
      if (cuenta() <= antes) sinEfecto.add(b);
    }
    return toques;
  }
  // Y las listas que están en un panel con su propia barra de desplazamiento: se bajan hasta
  // el final, como la página, para que carguen lo que falta.
  async function bajarPaneles() {
    const paneles = [...document.querySelectorAll('div, ul, ol, section, aside, main, tbody')].filter(e =>
      e.clientHeight >= 80 && e.scrollHeight > e.clientHeight + 40 && /^(?:auto|scroll)$/.test(getComputedStyle(e).overflowY) && e.querySelector('a[href]')).slice(0, 4);
    for (const p of paneles) {
      let antes = '', quieta = 0;
      for (let k = 0; k < 30 && quieta < 2; k++) {
        p.scrollTop = p.scrollHeight;
        await sleep(350);
        const ahora = p.scrollHeight + '/' + p.querySelectorAll('a[href]').length;
        quieta = ahora === antes ? quieta + 1 : 0;
        antes = ahora;
      }
      p.scrollTop = 0;
    }
  }

  // ── El buscador del sitio ──
  // Para usarlo desde el programa. Se busca, en este orden: el que el sitio declara (schema.org
  // SearchAction), un formulario de búsqueda que arma la dirección (GET) y, si no, un cuadro
  // de búsqueda suelto, donde hay que escribir. Devuelve { plantilla } (una dirección con {q}
  // donde va lo buscado), { enPagina, pagina } o null.
  const BUSCAR_PISTA_RE = /busc|búsq|search/i;
  const BUSCAR_NOMBRE_RE = /^(?:q|s|k|query|search|buscar|busqueda|keywords?|term|searchword|search_query)$/i;
  const BUSCAR_NOMBRE_FLOJO_RE = /^(?:title|titulo|name|nombre|text|texto)$/i;
  function campoDeBusqueda() {
    const puntos = (i) => {
      const f = i.form, get = !!f && !/post/i.test(f.getAttribute('method') || '') && !f.querySelector('input[type="password"], input[type="email"], textarea');
      let accion = '';
      try { accion = new URL(f?.getAttribute('action') || location.href, document.baseURI).pathname; } catch {}
      return (i.type === 'search' ? 4 : 0) + (i.closest('[role="search"]') ? 4 : 0)
        + (BUSCAR_PISTA_RE.test([i.placeholder, i.getAttribute('aria-label'), i.id, i.title, i.name].join(' ')) ? 3 : 0)
        + (BUSCAR_NOMBRE_RE.test(i.name || '') ? 2 : 0)
        + (BUSCAR_NOMBRE_FLOJO_RE.test(i.name || '') && get ? 1 + (CATALOGO_RUTA_RE.test(accion) || BUSCAR_PISTA_RE.test(accion) ? 1 : 0) : 0);
    };
    const campos = [...document.querySelectorAll('input')].filter(i => /^(?:search|text)$/.test(i.type) && !i.disabled && !i.readOnly && !i.closest('form')?.querySelector('input[type="password"]'));
    return campos.map(i => [puntos(i), i]).filter(([p]) => p >= 2).sort((a, b) => b[0] - a[0])[0]?.[1] || null;
  }
  function buscadorDe() {
    const MARCA = 'MRQBUSCADOQRM';
    const mismoSitio = (u) => u.origin === location.origin;
    // 1) El que declara el sitio
    const accion = (o) => {
      if (!o || typeof o !== 'object') return '';
      if (Array.isArray(o)) { for (const x of o) { const r = accion(x); if (r) return r; } return ''; }
      for (const a of [].concat(o.potentialAction || [])) {
        const t = typeof a?.target === 'string' ? a.target : a?.target?.urlTemplate;
        if (typeof t === 'string' && /\{[^}]+\}/.test(t)) return t;
      }
      return accion(o['@graph']);
    };
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const t = accion(JSON.parse(s.textContent));
        const u = t && new URL(t.replace(/\{[^}]+\}/, MARCA), document.baseURI);
        if (u && mismoSitio(u)) return { plantilla: u.href.replace(MARCA, '{q}') };
      } catch {}
    }
    // 2) Un formulario que arma la dirección
    const campo = campoDeBusqueda();
    if (!campo) return null;
    const f = campo.form;
    if (f && campo.name && !/post/i.test(f.getAttribute('method') || '')) {
      try {
        const u = new URL(f.getAttribute('action') || location.href, document.baseURI);
        if (mismoSitio(u)) {
          u.search = '';
          u.hash = '';
          for (const [k, v] of new FormData(f)) if (typeof v === 'string' && v && k !== campo.name) u.searchParams.append(k, v);
          u.searchParams.append(campo.name, MARCA);
          return { plantilla: u.href.replace(MARCA, '{q}') };
        }
      } catch {}
    }
    // 3) Un cuadro suelto: hay que escribir en él
    return { enPagina: true, pagina: location.href.split('#')[0] };
  }

  const comandos = {
    // Escribe en el buscador de la página y da Enter, como lo haría una persona. Antes anota
    // los links que ya había: si la página no cambia de dirección y muestra los resultados
    // ahí mismo, son los que aparecen después.
    buscar: async ({ texto }) => {
      const campo = campoDeBusqueda();
      if (!campo) throw new Error('No encontré el buscador de esta página');
      antesDeBuscar = new Set([...document.querySelectorAll('a[href]')].map(a => noSlash(a.href.split('#')[0])));
      campo.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(campo, String(texto));
      campo.dispatchEvent(new InputEvent('input', { bubbles: true, data: String(texto), inputType: 'insertText' }));
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
      const tecla = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      const sigue = campo.dispatchEvent(new KeyboardEvent('keydown', tecla));
      campo.dispatchEvent(new KeyboardEvent('keypress', tecla));
      campo.dispatchEvent(new KeyboardEvent('keyup', tecla));
      if (sigue && campo.form) setTimeout(() => { try { campo.form.requestSubmit(); } catch { campo.form.submit(); } }, 50);
      return { ok: true };
    },

    // Imágenes que parecen páginas (cargadas o no) y links: para saber cuándo la página terminó de armarse
    contar: () => ({ imagenes: countCandidates(), links: document.querySelectorAll('a[href]').length, listo: document.readyState === 'complete' }),

    // `soloNuevos`: después de `buscar`, si la página no cambió de dirección, solo cuentan los
    // links que aparecieron (los resultados); y alcanza con uno para armar una lista.
    explorar: async ({ conocidas = [], soloNuevos = false } = {}) => {
      const sigue = await bajarTodo();                // primero, que aparezca lo que carga al bajar
      const c = detectChapter();
      // Muchas imágenes grandes no alcanzan: la portada de un sitio también las tiene (las tapas)
      const esCapitulo = (looksLikeChapter() || (countCandidates() >= 5 && !!c)) && !pareceListado();
      // Lo que la página esconde detrás de una pestaña, un "Ver más" o un panel con scroll propio
      // (en un capítulo abierto no hace falta: lo que importa ahí son las páginas)
      if (!esCapitulo && !soloNuevos) {
        if (await desplegar()) await bajarTodo(6);
        await bajarPaneles();
      }
      const resultados = soloNuevos && !!antesDeBuscar;
      const links = juntarLinks(resultados);

      return {
        url: location.href.split('#')[0], titulo: limpio(document.title),
        // Cómo se llama la serie de esta página, si se puede saber: la del capítulo o el título grande
        serie: c?.serie || cleanSerie(limpio(document.querySelector('h1')?.textContent).slice(0, 80)),
        capitulo: esCapitulo ? { serie: c?.serie || '', numero: c?.numero ?? null, nombre: suggestName(), imagenes: countCandidates() } : null,
        listas: listasDe(links, conocidas, resultados ? 1 : 3),
        buscador: buscadorDe(),                       // el buscador del sitio, para usarlo desde el programa
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
