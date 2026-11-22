  // ── Explorador ───────────────────────────────────────
  // Corre dentro de la página abierta, junto con las funciones de la extensión, y devuelve
  // en limpio lo que hay: si es un capítulo, y qué listas de links tiene (capítulos o títulos).
  // No sabe nada de ningún sitio en particular: agrupa los links por la forma de su dirección.

  const limpio = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const SECCION_RE = /\b(vol(?:umen|ume|\.)?|tomo|saga|arco|arc|temporada|season|parte|part|libro|book)\b/i;
  const PAGINACION_RE = /(?:^|[/?&])(?:page|pagina|pag|p)[/=]$/i;
  const NUMERO_TEXTO_RE = /(?:cap[ií]tulo|chapter|episodio|episode|cap\.?|ch\.?|ep\.?|#)\s*(\d{1,5}(?:\.\d+)?)/i;
  const ARCHIVO_RE = /\.(?:x?html?|shtml|php\d?|aspx?|jsp|cgi)$/i;
  // Links que suelen llevar al listado completo de un sitio (la portada muestra solo una parte)
  const CATALOGO_RE = /^(?:cat[aá]logo|directorio|biblioteca|listado|library|directory|browse|a\s*-\s*z|(?:lista|listado) de (?:mangas?|series|c[oó]mics|t[ií]tulos)|(?:tod[oa]s )?l[oa]s (?:mangas?|series|c[oó]mics|t[ií]tulos)|all (?:manga|series|comics|titles)|series|mangas?|c[oó]mics|t[ií]tulos)$/i;
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

  // Links de la página, sin repetir, en el orden del documento. Cada uno recuerda el título
  // (h1…h6) que tenía arriba: de ahí salen los volúmenes y las sagas cuando la página los separa.
  function juntarLinks() {
    const aqui = noSlash(location.href.split('#')[0]);
    const porUrl = new Map();
    let seccion = '';
    for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, summary, a[href]')) {
      if (el.tagName !== 'A') {
        const t = limpio(el.textContent);
        if (t && t.length <= 80) seccion = t;
        continue;
      }
      let u;
      try { u = new URL(el.getAttribute('href'), document.baseURI); } catch { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;
      const url = u.href.split('#')[0];
      const clave = noSlash(url);
      if (clave === aqui) continue;
      const texto = limpio(el.textContent) || limpio(el.title) || limpio(el.querySelector('img')?.alt);
      const ya = porUrl.get(clave);
      if (ya) { if (!ya.texto && texto) ya.texto = texto; continue; }
      const s = splitChapterUrl(url);
      if (esPaginacion(u) || (s && (PAGINACION_RE.test(s.pre) || isDateArchive(s, texto)))) continue;   // paginación y archivo por fecha
      const p = partes(u);
      if (/^(?:19|20)\d{2}$/.test(p.nombre) && (!texto || texto.includes(p.nombre))) continue;   // archivo por año
      if (!p.nums.length && s && !u.pathname.endsWith(s.num)) p.nums = [s.num];        // ?capitulo=12
      porUrl.set(clave, { url, texto, seccion, ...p });
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
  // La sección solo se informa si de verdad separa (volumen, saga…) y hay más de una
  function conSecciones(items) {
    const usadas = new Set(items.map(i => i.seccion).filter(s => SECCION_RE.test(s)));
    return items.map(i => ({ ...i, seccion: usadas.size >= 2 && SECCION_RE.test(i.seccion) ? i.seccion : '' }));
  }

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
      const n = numerar(grupo);
      if (!n) continue;
      grupo.forEach(l => usados.add(l.url));
      const items = conSecciones(grupo).map((l, i) => ({ url: l.url, texto: nombreDe(l), numero: n[i], seccion: l.seccion }))
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
      const nums = grupo.map(l => l.texto.match(NUMERO_TEXTO_RE)?.[1]);
      const porTexto = nums.every(Boolean) && new Set(nums.map(parseFloat)).size === nums.length;
      const base = conSecciones(grupo);
      if (porTexto) {
        const items = base.map((l, i) => ({ url: l.url, texto: nombreDe(l), numero: parseFloat(nums[i]), seccion: l.seccion }))
          .sort((a, b) => a.numero - b.numero);
        listas.push({ tipo: 'capitulos', id: 't:' + k, nombre: new URL(k).pathname || '/', items });
      } else {
        listas.push({ tipo: 'titulos', id: 'g:' + k, nombre: new URL(k).pathname || '/',
                      items: base.map(l => ({ url: l.url, texto: nombreDe(l), seccion: l.seccion })) });
      }
    }

    // 3) Lo que la extensión saca de un desplegable o de la dirección del capítulo abierto
    const ch = collectChapters();
    const mayor = Math.max(0, ...listas.filter(l => l.tipo === 'capitulos').map(l => l.items.length));
    if (ch.list.length >= 2 && ch.list.length > mayor && (ch.pat || ch.list.every(c => c.url))) {
      listas.push({ tipo: 'capitulos', id: 'x:extension', nombre: 'por número', items: ch.list.map(c => ({
        url: c.url || ch.pat.pre + (c.raw || numForms(c.numero, ch.width)[0]) + ch.pat.post,
        texto: c.title, numero: c.numero, seccion: '' })) });
    }

    // Primero los capítulos y, dentro de cada tipo, la lista más larga
    return listas.sort((a, b) => (a.tipo === b.tipo ? b.items.length - a.items.length : a.tipo === 'capitulos' ? -1 : 1));
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

  const comandos = {
    // Imágenes que parecen páginas (cargadas o no) y links: para saber cuándo la página terminó de armarse
    contar: () => ({ imagenes: countCandidates(), links: document.querySelectorAll('a[href]').length, listo: document.readyState === 'complete' }),

    explorar: async ({ conocidas = [] } = {}) => {
      const sigue = await bajarTodo();                // primero, que aparezca lo que carga al bajar
      const c = detectChapter();
      const esCapitulo = looksLikeChapter() || (countCandidates() >= 5 && !!c);
      const links = juntarLinks();
      const aca = location.origin;
      return {
        url: location.href.split('#')[0], titulo: limpio(document.title),
        capitulo: esCapitulo ? { serie: c?.serie || '', numero: c?.numero ?? null, nombre: suggestName(), imagenes: countCandidates() } : null,
        listas: listasDe(links, conocidas),
        siguiente: siguientePagina(),
        // Links del mismo sitio que parecen llevar al listado completo ("Directorio", "Biblioteca"…)
        catalogos: links.filter(l => l.url.startsWith(aca + '/') && CATALOGO_RE.test(l.texto)).slice(0, 5).map(l => ({ url: l.url, texto: l.texto })),
        sigueCreciendo: sigue,                        // la página seguía cargando más al bajar: puede faltar
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
