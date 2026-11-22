/**
 * Manga Reader v2.6 - Content Script
 * Guarda el capítulo abierto como PDF, CBZ y/o imágenes sueltas con el nombre del tomo.
 * Detecta páginas que no son del capítulo (logos, banners, publicidad, créditos) y
 * muestra miniaturas para tildar/destildar a mano.
 */

(function () {
  if (window.__mangaReaderV4) return;
  window.__mangaReaderV4 = true;

  const MIN_SIDE = 250;          // menos que esto: íconos, logos chicos, banners

  // ── Background messaging ────────────────────────────

  function bg(msg, ms = 40000) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Timeout')), ms);
      chrome.runtime.sendMessage(msg, r => {
        clearTimeout(t);
        if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
        if (!r) return rej(new Error('Sin respuesta'));
        r.ok ? res(r) : rej(new Error(r.error || 'Error'));
      });
    });
  }

  // ── Image helpers ───────────────────────────────────

  // URL absoluta http(s) o '' (descarta placeholders data:/blob:, resuelve rutas relativas)
  function absUrl(u, base = document.baseURI) {
    if (!u || /^(data|blob):/i.test(u)) return '';
    try {
      const a = new URL(u, base).href;
      return /^https?:/i.test(a) ? a : '';
    } catch { return ''; }
  }

  // URL real de lazy loading (data-src y variantes), si la hay
  function lazyUrl(img) {
    return absUrl(img.dataset?.src || img.dataset?.lazySrc || img.dataset?.original || img.getAttribute('data-lazy-src'));
  }

  function imgUrl(img) {
    const lazy = lazyUrl(img);
    if (lazy && (img.naturalWidth || 0) < MIN_SIDE) return lazy;   // todavía muestra el placeholder
    return absUrl(img.src) || absUrl(img.currentSrc) || lazy;
  }

  // Tamaño real de una imagen (para páginas lazy que todavía muestran el placeholder)
  function probeSize(url, ms = 8000) {
    return new Promise((resolve) => {
      const im = new Image();
      const t = setTimeout(() => { im.src = ''; resolve(null); }, ms);
      im.onload = () => { clearTimeout(t); resolve({ w: im.naturalWidth, h: im.naturalHeight }); };
      im.onerror = () => { clearTimeout(t); resolve(null); };
      im.src = url;
    });
  }

  function urlDir(url) { return url.split(/[?#]/)[0].replace(/[^/]*$/, ''); }

  // ── Detección de páginas ────────────────────────────
  // Devuelve [{url, w, h, flag}] en orden de lectura (orden del DOM), sin duplicados.
  // flag = '' si es página del capítulo, o el motivo por el que se sospecha que no lo es.

  let lastFailed = 0;             // imágenes que no se pudieron cargar en la última búsqueda

  async function collectPages() {
    const seen = new Set();
    const entries = [];
    const failedUrls = [];
    for (const img of document.querySelectorAll('img')) {
      if (img.closest('#mr-save')) continue;
      const url = imgUrl(img);
      if (!url || seen.has(url)) continue;
      const link = img.closest('a[href]');
      let external = false;
      try { external = !!link && new URL(link.href, document.baseURI).origin !== location.origin; } catch {}
      const base = { url, external };

      // Lazy pendiente (data-src) o imagen que el navegador todavía no bajó (loading="lazy"):
      // se mide la imagen real, y de paso queda cargada
      const lazyPending = url === lazyUrl(img) && (img.naturalWidth || 0) < MIN_SIDE;
      if (lazyPending || !img.complete) {
        seen.add(url);
        entries.push({ ...base, probe: probeSize(url) });
        continue;
      }
      if (!img.naturalWidth) { seen.add(url); failedUrls.push(url); continue; }   // imagen rota
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w >= MIN_SIDE && h >= MIN_SIDE) {
        seen.add(url);
        entries.push({ ...base, w, h });
      }
    }

    const pages = [];
    for (const e of entries) {
      if (e.probe) {
        const s = await e.probe;
        if (!s) { failedUrls.push(e.url); continue; }          // no cargó (error o timeout)
        if (s.w < MIN_SIDE || s.h < MIN_SIDE) continue;
        e.w = s.w; e.h = s.h;
      }
      pages.push({ url: e.url, w: e.w, h: e.h, external: e.external, flag: '' });
    }
    const mainDir = flagNonPages(pages);
    // Solo cuentan como "faltantes" las que fallaron dentro de la carpeta del capítulo
    // (un banner o pixel roto del sitio no es una página perdida)
    lastFailed = mainDir ? failedUrls.filter(u => urlDir(u) === mainDir).length : 0;
    return pages;
  }

  // Marca lo que probablemente no es una página del capítulo
  function flagNonPages(pages) {
    if (pages.length < 3) return null;

    // 1) Carpeta del capítulo = la carpeta donde está la mayoría de las imágenes
    const count = new Map();
    for (const p of pages) count.set(urlDir(p.url), (count.get(urlDir(p.url)) || 0) + 1);
    const [mainDir, mainCount] = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    const hasMainDir = mainCount >= 3 && mainCount >= pages.length * 0.5;

    for (const p of pages) {
      if (p.external) p.flag = 'enlace a otro sitio';
      else if (hasMainDir && urlDir(p.url) !== mainDir) p.flag = 'fuera de la carpeta del capítulo';
      else if (/\.gif$/i.test(p.url.split(/[?#]/)[0])) p.flag = 'GIF animado';
    }

    // 2) Últimas páginas con formato distinto al del resto (créditos / publicidad del scan)
    const good = pages.filter(p => !p.flag);
    if (good.length < 5) return hasMainDir ? mainDir : null;
    const ratios = good.map(p => p.w / p.h).sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    const fits = (p) => {
      const q = (p.w / p.h) / median;
      return (q > 0.75 && q < 1.33)      // página normal
          || (q > 1.6 && q < 2.4)        // doble página
          || (q > 0.42 && q < 0.6);      // página simple cuando la mayoría son dobles
    };
    for (let i = good.length - 1; i >= Math.max(0, good.length - 3); i--) {
      if (fits(good[i])) break;          // solo la cola contigua
      good[i].flag = 'formato distinto al resto';
    }
    return hasMainDir ? mainDir : null;
  }

  // ── Extrae imágenes de un documento ajeno (capítulo obtenido por fetch) ──

  async function collectPagesFromDoc(doc, baseUrl) {
    const seen = new Set();
    const entries = [];
    const failedUrls = [];
    for (const img of doc.querySelectorAll('img')) {
      const url = imgUrlFromDoc(doc, img, baseUrl);
      if (!url || seen.has(url)) continue;
      const base = { url, external: false };
      const lazyPending = url === lazyUrlFromDoc(doc, img, baseUrl) && (img.naturalWidth || 0) < MIN_SIDE;
      if (lazyPending || !img.complete) {
        seen.add(url);
        entries.push({ ...base, probe: probeSize(url) });
        continue;
      }
      if (!img.naturalWidth) { seen.add(url); failedUrls.push(url); continue; }
      const w = img.naturalWidth, h = img.naturalHeight;
      if (w >= MIN_SIDE && h >= MIN_SIDE) {
        seen.add(url);
        entries.push({ ...base, w, h });
      }
    }
    const pages = [];
    for (const e of entries) {
      if (e.probe) {
        const s = await e.probe;
        if (!s) { failedUrls.push(e.url); continue; }
        if (s.w < MIN_SIDE || s.h < MIN_SIDE) continue;
        e.w = s.w; e.h = s.h;
      }
      pages.push({ url: e.url, w: e.w, h: e.h, external: false, flag: '' });
    }
    return pages;
  }

  function imgUrlFromDoc(doc, img, baseUrl) {
    const lazy = lazyUrlFromDoc(doc, img, baseUrl);
    if (lazy && (img.naturalWidth || 0) < MIN_SIDE) return lazy;
    return absUrl(img.src, baseUrl) || absUrl(img.currentSrc, baseUrl) || lazy;
  }

  function lazyUrlFromDoc(doc, img, baseUrl) {
    return absUrl(img.dataset?.src || img.dataset?.lazySrc || img.dataset?.original || img.getAttribute('data-lazy-src'), baseUrl);
  }

  // ── Nombres de archivo ──────────────────────────────

  function sanitizeSegment(s) {
    let out = s
      .replace(/[<>:"\\|?*\x00-\x1F]/g, ' ')   // caracteres prohibidos en Windows
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .replace(/[.\s]+$/, '')
      .substring(0, 100)
      .trim();
    if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(out)) out = '_' + out;
    return out;
  }

  function sanitizePath(name) {
    return String(name || '').split('/').map(sanitizeSegment).filter(Boolean).join('/') || 'Manga';
  }

  // ── Detección de serie / número / saga ──────────────
  // Sagas de One Piece por rango de capítulos (para ordenar en carpetas)
  const SAGAS = {
    'one piece': [
      [1, 100, 'East Blue'], [101, 216, 'Alabasta'], [217, 302, 'Skypiea'],
      [303, 441, 'Water 7'], [442, 489, 'Thriller Bark'], [490, 597, 'Guerra en la Cumbre'],
      [598, 653, 'Isla Gyojin'], [654, 801, 'Dressrosa'], [802, 908, 'Whole Cake Island'],
      [909, 1057, 'Wano'], [1058, 99999, 'Saga Final'],
    ],
  };

  // Número de capítulo en la dirección como parámetro: ?capitulo=12, ?ch=12, ?c=12…
  function chapterParam() {
    for (const [k, v] of new URLSearchParams(location.search)) {
      if (/^(cap|capitulo|chapter|ch|c|ep|episodio|episode)$/i.test(k) && /^\d{1,5}(\.\d+)?$/.test(v)) return v;
    }
    return null;
  }

  // Devuelve {serie, numero} leyendo el título de la página y la URL, o null.
  // numero puede tener decimales (capítulos extra como el 1134.5).
  function detectChapter() {
    const og = document.querySelector('meta[property="og:title"]')?.content || '';
    let base = (og || document.title || document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim();
    base = base.split(/\s+\|\s+/)[0];
    const parts = base.split(/\s+[-–—]\s+/);     // quitar " - Nombre del sitio"
    if (parts.length > 1 && /\d/.test(parts[0]) && !/\d/.test(parts[parts.length - 1])) base = parts.slice(0, -1).join(' - ');

    // La palabra clave (Capítulo, Ch., Cap., #) tiene que ir separada de la serie:
    // así "Bleach 686" no se corta en "Blea" + "ch 686".
    const m = base.match(/^(.*?)(?:[\s\-–—:,]+(?:manga|cap[ií]tulo|chapter|episodio|cap\.?|ch\.?)|\s*#)?[\s\-–—:,]*(\d{1,5}(?:\.\d+)?)\s*$/i);
    if (m && m[1].trim()) {
      const serie = m[1].replace(/[\s\-–—:,]*(manga|cap[ií]tulo|chapter)$/i, '').trim();
      if (serie) return { serie, numero: parseFloat(m[2]) };
    }
    const urlNum = location.pathname.match(/(\d{1,5}(?:\.\d+)?)\/?$/)?.[1] || chapterParam();
    if (urlNum && base) return { serie: base.replace(/\d+(\.\d+)?/g, '').replace(/\s+/g, ' ').trim() || base, numero: parseFloat(urlNum) };
    return null;
  }

  // 12 → "0012", 1134.5 → "1134.5" (4 dígitos para que ordene bien por nombre)
  function fmtNum(n) {
    const [int, dec] = String(n).split('.');
    return int.padStart(4, '0') + (dec ? '.' + dec : '');
  }

  // Nombre sugerido ya ordenado: "One Piece/11 Saga Final/One Piece 1134"
  function suggestName() {
    const c = detectChapter();
    if (!c) {
      const t = (document.title || 'Manga').split(/\s+\|\s+/)[0];
      return sanitizePath(t.replace(/\//g, '-'));
    }
    const serie = sanitizeSegment(c.serie.replace(/\//g, '-'));
    const num = fmtNum(c.numero);                          // 0001 → ordena bien por nombre
    const sagas = SAGAS[serie.toLowerCase()];
    const n = Math.floor(c.numero);                         // el 1057.5 va con el 1057
    const i = sagas ? sagas.findIndex(([a, b]) => n >= a && n <= b) : -1;
    const saga = i >= 0 ? `${String(i + 1).padStart(2, '0')} ${sagas[i][2]}/` : '';
    return sanitizePath(`${serie}/${saga}${serie} ${num}`);
  }

  // Dirección para reconocer un capítulo ya guardado. Incluye ?capitulo=12 y similares
  // (en esos sitios todos los capítulos comparten la misma ruta), pero no los parámetros
  // de seguimiento (utm_…, fbclid…), que cambian sin cambiar de capítulo.
  function pageKey() {
    const q = new URLSearchParams(location.search);
    for (const k of [...q.keys()]) if (/^(utm_|fbclid$|gclid$|ref$)/i.test(k)) q.delete(k);
    q.sort();
    const s = q.toString();
    return location.origin + location.pathname + (s ? '?' + s : '');
  }

  function ext(url) {
    try {
      const p = new URL(url).pathname.toLowerCase();
      const m = p.match(/\.(png|webp|gif|jpe?g|avif)(?![a-z])/);
      if (m) return m[1].replace('jpeg', 'jpg');
    } catch {}
    return 'jpg';
  }

  // ── Diálogo ─────────────────────────────────────────

  let saveEl = null;
  let saving = false;
  let pages = [];                 // [{url, w, h, flag, on}]
  let pagesLoaded = false;
  let progressLabel = '';
  let savedMap = {};              // capítulos ya guardados: { ruta: {ts, pages, url} }
  let reachedBottom = false;      // ¿se llegó al final de la página en algún momento?
  let reloadTimer = null;

  const sv = (sel) => saveEl?.querySelector(sel);
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const fmtSize = (kb) => kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';

  function setSaveStatus(text, type = '') {
    const el = sv('#mr-save-status');
    if (el) { el.textContent = text; el.className = 'mr-save-status' + (type ? ' ' + type : ''); }
  }

  async function openSaveDialog() {
    if (saveEl) { sv('#mr-save-name')?.focus(); return; }

    const st = await chrome.storage.local.get(['savePdf', 'saveCbz', 'saveImgs', 'saveFolders']);
    const folder = (st.saveFolders || {})[location.hostname] || '';
    let name = suggestName();
    if (folder && !name.includes('/')) name = `${folder}/${name}`;   // solo si no se pudo detectar la serie

    saveEl = document.createElement('div');
    saveEl.id = 'mr-save';
    saveEl.innerHTML = `
      <div class="mr-head">
        <span class="mr-title">💾 Guardar capítulo</span>
        <button class="mr-b mr-x" id="mr-save-close" title="Cerrar">✕</button>
      </div>
      <div class="mr-save-body">
        <label class="mr-save-label" for="mr-save-name">Nombre del tomo</label>
        <input id="mr-save-name" class="mr-save-name" type="text" spellcheck="false" autocomplete="off">
        <div class="mr-save-hint">Usá <b>/</b> para carpetas · ej: <i>One Piece/Tomo 110</i></div>
        <div class="mr-save-opts">
          <label><input type="checkbox" id="mr-save-pdf"> 📄 PDF</label>
          <label><input type="checkbox" id="mr-save-cbz"> 📚 CBZ</label>
          <label><input type="checkbox" id="mr-save-imgs"> 🖼 Imágenes</label>
        </div>
        <div class="mr-save-seen" id="mr-save-seen"></div>
        <div class="mr-save-dest" id="mr-save-dest"></div>
        <div class="mr-save-count" id="mr-save-count">Buscando páginas…</div>
        <div class="mr-save-warn" id="mr-save-warn"><span id="mr-save-warn-text"></span>
          <button id="mr-save-scan" type="button">Recorrer la página</button></div>
        <div class="mr-thumbs" id="mr-thumbs"></div>
        <button class="mr-save-go" id="mr-save-go">Guardar</button>
        <div class="mr-save-status" id="mr-save-status"></div>
      </div>`;
    document.body.appendChild(saveEl);
    makeDraggable(saveEl, saveEl.querySelector('.mr-head'));

    const input = sv('#mr-save-name');
    input.value = name;
    sv('#mr-save-pdf').checked = st.savePdf !== false;
    sv('#mr-save-cbz').checked = st.saveCbz === true;
    sv('#mr-save-imgs').checked = st.saveImgs === true;      // por defecto solo PDF

    input.addEventListener('input', refresh);
    sv('#mr-save-pdf').addEventListener('change', refresh);
    sv('#mr-save-cbz').addEventListener('change', refresh);
    sv('#mr-save-imgs').addEventListener('change', refresh);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') saveChapter();
      if (e.key === 'Escape') closeSaveDialog();
    });
    sv('#mr-save-close').onclick = closeSaveDialog;
    sv('#mr-save-go').onclick = saveChapter;
    sv('#mr-save-scan').onclick = scanPage;

    savedMap = (await chrome.storage.local.get(['savedChapters'])).savedChapters || {};
    reachedBottom = atBottom();
    window.addEventListener('scroll', onPageScroll, { passive: true });
    document.addEventListener('load', onImageLoad, true);      // 'load' de <img> no burbujea → captura

    refresh();
    input.focus();
    input.select();
    loadPages();
  }

  async function loadPages() {
    const prev = new Map(pages.map(p => [p.url, p.on]));
    const found = await collectPages();
    if (!saveEl) return;
    pages = found.map(p => ({ ...p, on: prev.has(p.url) ? prev.get(p.url) : !p.flag }));
    pagesLoaded = true;
    renderThumbs();
    refresh();
  }

  function renderThumbs() {
    const box = sv('#mr-thumbs');
    if (!box) return;
    box.innerHTML = pages.map((p, i) => `
      <button class="mr-thumb ${p.on ? 'on' : 'off'}" data-i="${i}"
              title="${esc(p.flag ? `Posible publicidad: ${p.flag}` : `Página ${i + 1}`)} · clic para ${p.on ? 'quitar' : 'incluir'}">
        <img src="${esc(p.url)}" loading="lazy" alt="">
        <span class="mr-thumb-n">${i + 1}</span>
        ${p.flag ? '<span class="mr-thumb-ad">AD</span>' : ''}
      </button>`).join('');
    box.querySelectorAll('.mr-thumb').forEach(b => {
      b.onclick = () => {
        if (saving) return;
        const p = pages[+b.dataset.i];
        p.on = !p.on;
        b.classList.toggle('on', p.on);
        b.classList.toggle('off', !p.on);
        refresh();
      };
    });
  }

  function refresh() {
    if (!saveEl) return;
    const path = sanitizePath(sv('#mr-save-name').value);
    const pdf = sv('#mr-save-pdf').checked, cbz = sv('#mr-save-cbz').checked, imgs = sv('#mr-save-imgs').checked;
    const lines = [];
    if (pdf) lines.push(`📄 Descargas/MangaReader/${path}.pdf`);
    if (cbz) lines.push(`📚 Descargas/MangaReader/${path}.cbz`);
    if (imgs) lines.push(`🖼 Descargas/MangaReader/${path}/`);
    sv('#mr-save-dest').textContent = lines.join('\n') || 'Elegí al menos un formato';

    const on = pages.filter(p => p.on).length;
    const ads = pages.filter(p => p.flag && !p.on).length;
    if (pages.length) {
      sv('#mr-save-count').textContent =
        `${on} de ${pages.length} páginas` + (ads ? ` · ${ads} descartada${ads === 1 ? '' : 's'} como publicidad` : '') +
        ' · clic en una miniatura para incluirla o quitarla';
    } else if (pagesLoaded) {
      sv('#mr-save-count').textContent = 'No encontré páginas · bajá hasta el final del capítulo';
    }
    sv('#mr-save-go').disabled = saving || (!pdf && !cbz && !imgs) || !on;

    // ¿Ya lo guardaste? (por nombre, o por la dirección de esta página)
    const here = pageKey();
    const hit = savedMap[path] ? [path, savedMap[path]] : Object.entries(savedMap).find(([, v]) => v.url === here);
    const seen = sv('#mr-save-seen');
    if (hit) {
      const d = new Date(hit[1].ts);
      const when = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      seen.textContent = `✔ Ya lo guardaste el ${when} (${hit[1].pages} páginas)` + (hit[0] !== path ? ` como "${hit[0]}"` : '');
    } else seen.textContent = '';

    // ¿Pueden faltar páginas?
    const warns = [];
    if (pagesLoaded && lastFailed) warns.push(lastFailed === 1 ? '1 página no cargó' : `${lastFailed} páginas no cargaron`);
    if (pagesLoaded && !reachedBottom) warns.push('no llegaste al final de la página, pueden faltar páginas');
    sv('#mr-save-warn-text').textContent = warns.length ? '⚠️ ' + warns.join(' · ') : '';
    sv('#mr-save-warn').style.display = warns.length ? '' : 'none';
    sv('#mr-save-scan').disabled = saving || scanning;
  }

  // ── Páginas sin cargar ──────────────────────────────

  let scanning = false;
  const atBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 300;

  function onPageScroll() {
    if (!reachedBottom && atBottom()) { reachedBottom = true; refresh(); }
  }

  // Cuando termina de cargar una imagen nueva de la página, se vuelve a contar
  function onImageLoad(e) {
    if (e.target?.tagName !== 'IMG' || e.target.closest('#mr-save') || saving || scanning) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => { if (saveEl && !saving && !scanning) loadPages(); }, 800);
  }

  // Baja sola hasta el final de ESTA página para que carguen todas las imágenes, y vuelve
  async function scanPage() {
    if (scanning || saving) return;
    scanning = true;
    refresh();
    const start = window.scrollY;
    const el = sv('#mr-save-count');
    for (let step = 0, y = 0; step < 400 && saveEl; step++) {
      window.scrollTo(0, y);
      if (el) el.textContent = 'Recorriendo la página…';
      await sleep(300);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (y >= max) break;                                    // la altura se relee: puede crecer
      y = Math.min(y + window.innerHeight * 0.9, max);
    }
    await sleep(600);
    reachedBottom = true;
    window.scrollTo(0, start);
    scanning = false;
    if (saveEl) await loadPages();
  }

  function closeSaveDialog() {
    if (saveEl) { saveEl.remove(); saveEl = null; }
    pages = []; pagesLoaded = false; lastFailed = 0;
    clearTimeout(reloadTimer);
    window.removeEventListener('scroll', onPageScroll);
    document.removeEventListener('load', onImageLoad, true);
  }

  async function saveChapter() {
    if (saving || !saveEl) return;
    const path = sanitizePath(sv('#mr-save-name').value);
    const wantPdf = sv('#mr-save-pdf').checked;
    const wantCbz = sv('#mr-save-cbz').checked;
    const wantImgs = sv('#mr-save-imgs').checked;
    if (!wantPdf && !wantCbz && !wantImgs) return setSaveStatus('Elegí al menos un formato', 'error');

    const urls = pages.filter(p => p.on).map(p => p.url);
    if (!urls.length) return setSaveStatus('No hay páginas seleccionadas', 'error');

    saving = true;
    sv('#mr-save-go').disabled = true;
    sv('#mr-save-name').value = path;

    // Recordar opciones y la carpeta de la serie para este sitio
    const st = await chrome.storage.local.get(['saveFolders']);
    const folders = st.saveFolders || {};
    folders[location.hostname] = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    chrome.storage.local.set({ savePdf: wantPdf, saveCbz: wantCbz, saveImgs: wantImgs, saveFolders: folders });

    const results = [];
    let anyError = false;
    let incomplete = false;         // algún formato quedó con páginas de menos

    // PDF y CBZ se arman igual: el documento offscreen baja las páginas y devuelve el archivo
    const chap = detectChapter();
    const arc = path.split('/').length >= 3 ? path.split('/').slice(-2, -1)[0].replace(/^\d+\s+/, '') : '';
    const kinds = [];
    if (wantPdf) kinds.push({ action: 'buildPdf', ext: 'pdf', icon: '📄', label: 'PDF' });
    if (wantCbz) kinds.push({ action: 'buildCbz', ext: 'cbz', icon: '📚', label: 'CBZ' });

    for (const k of kinds) {
      progressLabel = `${k.icon} Armando ${k.label}`;
      setSaveStatus(`${progressLabel}: 0/${urls.length} páginas…`, 'working');
      try {
        const r = await bg({
          action: k.action,
          urls,
          title: path.split('/').pop(),
          meta: { title: path.split('/').pop(), series: chap?.serie, number: chap?.numero, arc, web: pageKey() },
          filename: `MangaReader/${path}.${k.ext}`,
        }, 60000 + urls.length * 20000);
        if (r.failed) incomplete = true;
        results.push(`${k.icon} ${k.label} de ${r.pages} páginas (${fmtSize(r.sizeKB)})` + (r.failed ? ` · ${r.failed} no se pudieron leer` : ''));
        if (r.savedAs && r.savedAs !== `MangaReader/${path}.${k.ext}`) results.push(`   guardado como ${r.savedAs}`);
      } catch (e) {
        anyError = true;
        results.push(`⚠️ ${k.label}: ${e.message}`);
      }
    }

    if (wantImgs) {
      let ok = 0, failed = 0, lastErr = '';
      for (let i = 0; i < urls.length; i++) {
        setSaveStatus(`🖼 Imágenes: ${i + 1}/${urls.length}…`, 'working');
        try {
          const fname = `MangaReader/${path}/pagina_${String(i + 1).padStart(3, '0')}.${ext(urls[i])}`;
          await bg({ action: 'downloadImage', url: urls[i], filename: fname }, 45000);
          ok++;
        } catch (e) { failed++; lastErr = e.message; }
        await sleep(250);
      }
      if (!ok) anyError = true;
      if (failed) incomplete = true;
      results.push(ok ? `🖼 ${ok} imágenes` + (failed ? ` · ${failed} fallaron` : '') : `⚠️ Imágenes: ${lastErr}`);
    }

    // Se anota como guardado solo si entraron todas las páginas elegidas
    if (!anyError && !incomplete) {
      savedMap = (await chrome.storage.local.get(['savedChapters'])).savedChapters || {};
      savedMap[path] = { ts: Date.now(), pages: urls.length, url: pageKey() };
      await chrome.storage.local.set({ savedChapters: savedMap });
    } else if (!anyError) {
      results.push('⚠️ Faltaron páginas: no lo marqué como guardado. Probá guardarlo de nuevo.');
    }

    saving = false;
    refresh();
    const ok = !anyError && !incomplete;
    setSaveStatus(`${ok ? '✅ ' : ''}${results.join('\n')}`, ok ? 'success' : 'error');
  }

  // ── Descarga por lotes: rango de capítulos con URL tipo {n} ──────────────

  let chapterEl = null;
  let chapterDownloading = false;
  let chapterResults = [];

  function openChapterDialog() {
    if (chapterEl) return;
    chapterEl = document.createElement('div');
    chapterEl.id = 'mr-chapter';
    chapterEl.innerHTML = `
      <div class="mr-head">
        <span class="mr-title">📦 Descargar rango de capítulos</span>
        <button class="mr-b mr-x" id="mr-chapter-close" title="Cerrar">✕</button>
      </div>
      <div class="mr-save-body">
        <label class="mr-save-label" for="mr-chapter-url">Dirección del capítulo (usá {n} para el número)</label>
        <input id="mr-chapter-url" class="mr-save-name" type="text" spellcheck="false" autocomplete="off" placeholder="https://ejemplo.com/leer/{n}">
        <div class="mr-save-hint">Ejemplo: https://sitio.com/manga/{n} · el {n} se reemplaza por cada número del rango</div>

        <div style="display:flex; gap:10px; margin:10px 0;">
          <div style="flex:1;">
            <label class="mr-save-label" for="mr-chapter-from">Del capítulo</label>
            <input id="mr-chapter-from" type="number" min="1" value="1" style="width:100%; padding:6px;">
          </div>
          <div style="flex:1;">
            <label class="mr-save-label" for="mr-chapter-to">Al capítulo</label>
            <input id="mr-chapter-to" type="number" min="1" value="1" style="width:100%; padding:6px;">
          </div>
        </div>

        <label class="mr-save-label" for="mr-chapter-name">Carpeta de la serie</label>
        <input id="mr-chapter-name" class="mr-save-name" type="text" spellcheck="false" autocomplete="off" placeholder="One Piece">
        <div class="mr-save-hint">Usá <b>/</b> para carpetas · ej: <i>One Piece/Tomo 110</i></div>

        <div class="mr-save-opts">
          <label><input type="checkbox" id="mr-chapter-pdf" checked> 📄 PDF</label>
          <label><input type="checkbox" id="mr-chapter-cbz"> 📚 CBZ</label>
          <label><input type="checkbox" id="mr-chapter-imgs"> 🖼 Imágenes</label>
        </div>

        <div class="mr-chapter-status" id="mr-chapter-status"></div>
        <button class="mr-save-go" id="mr-chapter-go">Descargar rango</button>
      </div>`;
    document.body.appendChild(chapterEl);
    makeDraggable(chapterEl, chapterEl.querySelector('.mr-head'));

    svChapter('#mr-chapter-close').onclick = closeChapterDialog;
    svChapter('#mr-chapter-go').onclick = downloadChapterRange;
  }

  function svChapter(sel) { return chapterEl?.querySelector(sel); }

  async function closeChapterDialog() {
    if (chapterEl) { chapterEl.remove(); chapterEl = null; }
  }

  // Descarga cada capítulo del rango, uno tras otro. Para si uno no tiene páginas.
  async function downloadChapterRange() {
    if (chapterDownloading || !chapterEl) return;

    const urlTpl = svChapter('#mr-chapter-url').value.trim();
    if (!urlTpl) return setChapterStatus('Ingresá una dirección', 'error');
    if (!urlTpl.includes('{n}')) return setChapterStatus('La dirección debe incluir {n}', 'error');

    const from = parseInt(svChapter('#mr-chapter-from').value, 10) || 1;
    const to = parseInt(svChapter('#mr-chapter-to').value, 10) || 1;
    if (to < from) return setChapterStatus('El "al" debe ser mayor o igual al "del"', 'error');

    const wantPdf = svChapter('#mr-chapter-pdf').checked;
    const wantCbz = svChapter('#mr-chapter-cbz').checked;
    const wantImgs = svChapter('#mr-chapter-imgs').checked;
    if (!wantPdf && !wantCbz && !wantImgs) return setChapterStatus('Elegí al menos un formato', 'error');

    const folder = sanitizePath(svChapter('#mr-chapter-name').value || 'Manga');

    chapterDownloading = true;
    chapterResults = [];
    svChapter('#mr-chapter-go').disabled = true;
    svChapter('#mr-chapter-go').textContent = 'Descargando…';

    for (let n = from; n <= to; n++) {
      const chapterUrl = urlTpl.replace(/{n}/g, String(n));
      setChapterStatus(`(${n - from + 1}/${to - from + 1}) Capítulo ${n} — obteniendo páginas…`);

      let urls;
      try {
        urls = await fetchChapterPages(chapterUrl);
      } catch (e) {
        chapterResults.push(`⚠️ Cap. ${n}: ${e.message} — <a href="${chapterUrl}" target="_blank">abrir dirección</a>`);
        break;
      }

      if (!urls.length) {
        chapterResults.push(`⚠️ Cap. ${n}: sin páginas — <a href="${chapterUrl}" target="_blank">revisar dirección</a>`);
        break;
      }

      const numStr = String(n).padStart(4, '0');
      const serie = folder.split('/').pop() || 'Manga';
      const chapPath = `${folder}/${serie} ${numStr}`;
      const arc = '';

      const kinds = [];
      if (wantPdf) kinds.push({ action: 'buildPdf', ext: 'pdf', icon: '📄', label: 'PDF' });
      if (wantCbz) kinds.push({ action: 'buildCbz', ext: 'cbz', icon: '📚', label: 'CBZ' });

      for (const k of kinds) {
        setChapterStatus(`(${n - from + 1}/${to - from + 1}) Cap. ${n} — armando ${k.label}…`);
        try {
          const r = await bg({
            action: k.action,
            urls,
            title: `Capítulo ${numStr}`,
            meta: { title: `Capítulo ${numStr}`, series: serie, number: n, arc, web: chapterUrl },
            filename: `MangaReader/${chapPath}.${k.ext}`,
          }, 60000 + urls.length * 20000);
          chapterResults.push(`${k.icon} Cap. ${n} (${numStr}): ${r.pages} páginas`);
        } catch (e) {
          chapterResults.push(`⚠️ Cap. ${n}: ${e.message}`);
        }
      }

      if (wantImgs) {
        let ok = 0, failed = 0;
        for (let j = 0; j < urls.length; j++) {
          setChapterStatus(`(${n - from + 1}/${to - from + 1}) Cap. ${n} — imagen ${j + 1}/${urls.length}…`);
          try {
            const fname = `MangaReader/${chapPath}/pagina_${String(j + 1).padStart(3, '0')}.jpg`;
            await bg({ action: 'downloadImage', url: urls[j], filename: fname }, 45000);
            ok++;
          } catch { failed++; }
          await sleep(250);
        }
        chapterResults.push(`🖼 Cap. ${n}: ${ok} imágenes` + (failed ? ` · ${failed} fallaron` : ''));
      }
    }

    chapterDownloading = false;
    svChapter('#mr-chapter-go').disabled = false;
    svChapter('#mr-chapter-go').textContent = 'Descarga completa';
    setChapterStatus(chapterResults.map(r => `<div style="margin:4px 0;">${r}</div>`).join(''), 'done');
  }

  function setChapterStatus(html, type = '') {
    const el = svChapter('#mr-chapter-status');
    if (el) { el.innerHTML = html; el.className = 'mr-chapter-status' + (type ? ' ' + type : ''); }
  }

  // Obtiene las URLs de imagen de un capítulo remoto vía fetch
  async function fetchChapterPages(chapterUrl) {
    const resp = await fetch(chapterUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pages = await collectPagesFromDoc(doc, chapterUrl);
    return pages.map(p => p.url);
  }

  function makeDraggable(el, h) {
    let sx, sy, sl, st;
    h.style.cursor = 'grab';
    h.onmousedown = (e) => {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault(); sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect(); sl = r.left; st = r.top;
      h.style.cursor = 'grabbing';
      const mv = (ev) => { el.style.right = 'auto'; el.style.left = (sl + ev.clientX - sx) + 'px'; el.style.top = (st + ev.clientY - sy) + 'px'; };
      const up = () => { h.style.cursor = 'grab'; document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    };
  }

  // ── Burbuja flotante ────────────────────────────────
  // Aparece en páginas que parecen un capítulo. Clic = guardar; se arrastra a cualquier
  // lugar (recuerda la posición); la "i" muestra los controles rápidos.

  let fabEl = null;

  function looksLikeChapter() {
    const dirs = new Map();
    for (const img of document.querySelectorAll('img')) {
      if (img.closest('#mr-save')) continue;          // las miniaturas del diálogo no cuentan
      if (img.naturalWidth >= MIN_SIDE && img.naturalHeight >= 600) {
        const d = urlDir(imgUrl(img));
        dirs.set(d, (dirs.get(d) || 0) + 1);
      }
    }
    return Math.max(0, ...dirs.values()) >= 3;      // 3+ imágenes grandes en la misma carpeta
  }

  function placeFab(pos) {
    const r = Math.min(Math.max(8, pos.r), window.innerWidth - 60);
    const b = Math.min(Math.max(8, pos.b), window.innerHeight - 60);
    fabEl.style.right = r + 'px';
    fabEl.style.bottom = b + 'px';
    // El cartel de ayuda se abre hacia donde haya lugar
    const rect = fabEl.getBoundingClientRect();
    fabEl.classList.toggle('mr-fab-low', rect.top < 300);
    fabEl.classList.toggle('mr-fab-leftside', rect.left < 280);
    return { r, b };
  }

  async function showFab() {
    if (fabEl) return;
    const st = await chrome.storage.local.get(['fabEnabled', 'fabPos']);
    if (st.fabEnabled === false || fabEl) return;
    let pos = st.fabPos || { r: 24, b: 24 };

    fabEl = document.createElement('div');
    fabEl.id = 'mr-fab';
    fabEl.innerHTML = `
      <button class="mr-fab-main" type="button" title="Guardar capítulo (Alt+S) · arrastrá para mover">💾</button>
      <button class="mr-fab-i" type="button" title="Controles rápidos" aria-label="Controles rápidos">i</button>
      <div class="mr-fab-info" hidden>
        <div class="mr-fab-info-title">Controles rápidos</div>
        <ul>
          <li><b>Clic en la burbuja</b> — guardar capítulo</li>
          <li><b>Arrastrar la burbuja</b> — moverla de lugar</li>
          <li><kbd>Alt</kbd>+<kbd>S</kbd> — abrir "Guardar capítulo"</li>
          <li><kbd>Enter</kbd> — guardar · <kbd>Esc</kbd> — cerrar</li>
          <li><b>Clic en una miniatura</b> — incluir o quitar esa página</li>
          <li><b>/</b> en el nombre — crea carpetas</li>
        </ul>
        <button class="mr-fab-hide" type="button">Ocultar burbuja</button>
        <div class="mr-fab-note">Se reactiva desde el ícono de la extensión</div>
      </div>`;
    document.body.appendChild(fabEl);
    pos = placeFab(pos);

    const main = fabEl.querySelector('.mr-fab-main');
    const info = fabEl.querySelector('.mr-fab-info');
    let drag = null;

    main.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, r: pos.r, b: pos.b, moved: false };
      main.setPointerCapture(e.pointerId);
    });
    main.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;     // tolerancia: un clic no es arrastre
      drag.moved = true;
      fabEl.classList.add('mr-fab-dragging');
      info.hidden = true;
      pos = placeFab({ r: drag.r - dx, b: drag.b - dy });
    });
    const endDrag = (e) => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      fabEl.classList.remove('mr-fab-dragging');
      try { main.releasePointerCapture(e.pointerId); } catch {}
      if (moved) chrome.storage.local.set({ fabPos: pos });
      else if (e.type === 'pointerup') openSaveDialog();
    };
    main.addEventListener('pointerup', endDrag);
    main.addEventListener('pointercancel', endDrag);

    fabEl.querySelector('.mr-fab-i').onclick = () => { info.hidden = !info.hidden; placeFab(pos); };
    fabEl.querySelector('.mr-fab-hide').onclick = () => chrome.storage.local.set({ fabEnabled: false });
    document.addEventListener('pointerdown', (e) => { if (fabEl && !fabEl.contains(e.target)) info.hidden = true; });
    window.addEventListener('resize', () => { if (fabEl) pos = placeFab(pos); });
  }

  function hideFab() { if (fabEl) { fabEl.remove(); fabEl = null; } }

  let fabOff = false;             // la burbuja está oculta desde el popup o el cartel
  let fabCheckTimer = null;

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.fabEnabled) return;
    fabOff = ch.fabEnabled.newValue === false;
    if (fabOff) hideFab();
    else if (looksLikeChapter()) showFab();
  });

  // ¿Es un capítulo? Se revisa al rato de cargar y otra vez cada vez que termina de
  // cargar una imagen o bajás por la página, hasta que aparece la burbuja. En los sitios
  // que cargan las páginas a medida que bajás, al principio puede haber menos de 3.
  function checkFab() {
    if (fabEl || fabOff || fabCheckTimer) return;
    fabCheckTimer = setTimeout(() => {
      fabCheckTimer = null;
      if (!fabEl && !fabOff && looksLikeChapter()) showFab();
    }, 700);
  }
  chrome.storage.local.get(['fabEnabled']).then(s => { fabOff = s.fabEnabled === false; });
  document.addEventListener('load', (e) => { if (e.target?.tagName === 'IMG') checkFab(); }, true);
  window.addEventListener('scroll', checkFab, { passive: true });
  setTimeout(checkFab, 1500);
  setTimeout(checkFab, 5000);

  // ── Mensajes ────────────────────────────────────────

  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'save') openSaveDialog();
    if (msg.action === 'downloadChapters') openChapterDialog();
    if (msg.action === 'pdfProgress' && saving) {
      setSaveStatus(`${progressLabel}: ${msg.done}/${msg.total} páginas…`, 'working');
    }
  });
})();
