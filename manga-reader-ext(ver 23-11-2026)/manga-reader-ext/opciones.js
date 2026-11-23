/**
 * Manga Reader v2.11.0 — página "Guardados y opciones"
 * - Registro de capítulos guardados: por serie, con lo que falta, exportar e importar
 * - Tabla de sagas editable
 * - Sitios donde la burbuja no aparece
 */

// ── Funciones sin interfaz (también las usan las pruebas en Node) ──

const OPEN_END = 99999;         // "hasta" de la última saga

const titleCase = (s) => s.replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

// La serie se compara como queda en el nombre del archivo: sin los caracteres que Windows no acepta
const serieKey = (s) => s.replace(/\//g, '-').replace(/[<>:"\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// { 'one piece': [[1, 100, 'East Blue'], …] } → texto para editar
function sagasToText(table) {
  return Object.entries(table || {}).map(([serie, rows]) =>
    [titleCase(serie), ...rows.map(([a, b, name]) => `${a}-${b >= OPEN_END ? '' : b} ${name}`)].join('\n')
  ).join('\n\n');
}

// Texto → { table, errors }. Un bloque por serie; cada saga, "desde-hasta Nombre"
function parseSagas(text) {
  const table = {}, errors = [];
  for (const block of String(text || '').replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const serie = lines[0];
    if (/^\d+\s*[-–+]/.test(serie)) { errors.push(`Falta el nombre de la serie antes de "${serie}"`); continue; }
    const rows = [];
    for (const line of lines.slice(1)) {
      const m = line.match(/^(\d+)\s*(?:[-–]\s*(\d+)?|\+)\s+(.+)$/);
      if (!m) { errors.push(`${serie}: no entiendo "${line}" (va "desde-hasta Nombre")`); continue; }
      const a = +m[1], b = m[2] ? +m[2] : OPEN_END;
      if (b < a) { errors.push(`${serie}: en "${line}" el final es menor que el principio`); continue; }
      rows.push([a, b, m[3].trim()]);
    }
    if (!rows.length) { errors.push(`${serie}: no tiene ninguna saga`); continue; }
    rows.sort((x, y) => x[0] - y[0]);
    table[serieKey(serie)] = rows;
  }
  return { table, errors };
}

// Números enteros que faltan entre el primero y el último: [1,2,5,9] → [[3,4],[6,8]]
function missingRanges(nums) {
  const have = new Set(nums.map(Math.floor));
  if (have.size < 2) return [];
  let min = Infinity, max = -Infinity;
  for (const n of have) { if (n < min) min = n; if (n > max) max = n; }
  const out = [];
  for (let n = min; n <= max; n++) {
    if (have.has(n)) continue;
    const last = out[out.length - 1];
    if (last && last[1] === n - 1) last[1] = n; else out.push([n, n]);
  }
  return out;
}

const rangesText = (ranges) => ranges.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');

// Registro de guardados → [{ serie, items: [{path, name, numero, ts, pages, url}], missing }]
function groupSaved(saved) {
  const series = new Map();
  for (const [path, v] of Object.entries(saved || {})) {
    const parts = path.split('/');
    const name = parts[parts.length - 1];
    const m = name.match(/(\d+(?:\.\d+)?)$/);
    // Lo guardado con una plantilla de nombres propia trae anotados la serie y el número:
    // ahí la primera carpeta puede ser el sitio o el año, y el nombre terminar en el título
    const serie = typeof v.serie === 'string' && v.serie ? v.serie : parts[0];
    const numero = typeof v.numero === 'number' ? v.numero : (m ? parseFloat(m[1]) : null);
    if (!series.has(serie)) series.set(serie, { serie, items: [] });
    series.get(serie).items.push({ path, name, numero, ts: v.ts, pages: v.pages, url: v.url });
  }
  for (const g of series.values()) {
    g.items.sort((a, b) => (a.numero ?? Infinity) - (b.numero ?? Infinity) || a.name.localeCompare(b.name));
    g.missing = missingRanges(g.items.map(i => i.numero).filter(n => n != null));
  }
  return [...series.values()].sort((a, b) => a.serie.localeCompare(b.serie));
}

// Suma una copia exportada a lo que hay. Los guardados se mezclan (gana el más nuevo);
// del resto solo se trae lo que acá todavía no está configurado.
function mergeBackup(local, data) {
  const saved = { ...(local.savedChapters || {}) };
  let added = 0;
  for (const [k, v] of Object.entries(data.savedChapters || {})) {
    if (!v || typeof v !== 'object' || typeof v.ts !== 'number') continue;
    if (!saved[k]) added++;
    if (!saved[k] || saved[k].ts < v.ts) {
      saved[k] = { ts: v.ts, pages: v.pages, url: v.url,
                   ...(typeof v.serie === 'string' && typeof v.numero === 'number' ? { serie: v.serie, numero: v.numero } : {}) };
    }
  }
  const out = { savedChapters: saved };
  for (const key of ['sagas', 'sagasText', 'saveFolders', 'batchPad', 'esquemaNombres', 'ritmo']) {
    const tipo = key === 'sagasText' || key === 'esquemaNombres' ? 'string' : 'object';
    if (local[key] == null && data[key] != null && typeof data[key] === tipo) out[key] = data[key];
  }
  if (Array.isArray(data.fabBlockedHosts)) {
    out.fabBlockedHosts = [...new Set([...(local.fabBlockedHosts || []), ...data.fabBlockedHosts.filter(h => typeof h === 'string')])];
  }
  // Mis sitios: se suman los que no estén (misma dirección = mismo sitio)
  if (Array.isArray(data.misSitios)) {
    const key = (s) => String(s?.url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
    const mios = [...(local.misSitios || [])];
    const have = new Set(mios.map(key));
    for (const s of data.misSitios) {
      if (s && typeof s.nombre === 'string' && typeof s.url === 'string' && /^https?:\/\//i.test(s.url) && !have.has(key(s))) {
        mios.push(s);
        have.add(key(s));
      }
    }
    out.misSitios = mios;
  }
  return { out, added };
}

if (typeof module !== 'undefined') {
  module.exports = { sagasToText, parseSagas, missingRanges, rangesText, groupSaved, mergeBackup, serieKey };
}

// ── Interfaz ─────────────────────────────────────────

if (typeof document !== 'undefined') {
  const $ = (id) => document.getElementById(id);
  const store = chrome.storage.local;
  const KEYS = ['savedChapters', 'sagas', 'sagasText', 'saveFolders', 'fabBlockedHosts', 'batchPad', 'misSitios', 'esquemaNombres', 'ritmo'];
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  const say = (id, text, ok) => { $(id).textContent = text; $(id).className = 'msg ' + (ok ? 'ok' : 'err'); };
  const fecha = (ts) => {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  let saved = {};
  const openSeries = new Set();           // series desplegadas (para que no se cierren al redibujar)

  // ── Guardados ──

  async function removePaths(paths) {
    saved = (await store.get(['savedChapters'])).savedChapters || {};
    for (const p of paths) delete saved[p];
    await store.set({ savedChapters: saved });
    renderSaved();
  }

  function renderSaved() {
    const box = $('series');
    const q = $('filtro').value.trim().toLowerCase();
    const groups = groupSaved(saved)
      .map(g => (q && !g.serie.toLowerCase().includes(q) ? { ...g, items: g.items.filter(i => i.path.toLowerCase().includes(q)) } : g))
      .filter(g => g.items.length);
    box.replaceChildren();
    if (!groups.length) {
      box.append(el('p', { className: 'vacio', textContent: q ? 'Nada coincide con la búsqueda.' : 'Todavía no guardaste ningún capítulo.' }));
      return;
    }
    for (const g of groups) {
      const nums = g.items.map(i => i.numero).filter(n => n != null);
      const datos = `${g.items.length} capítulo${g.items.length === 1 ? '' : 's'}` +
        (nums.length ? ` · del ${nums[0]} al ${nums[nums.length - 1]}` : '');
      const summary = el('summary', {},
        el('span', { className: 'serie-nombre', textContent: g.serie }),
        el('span', { className: 'serie-datos', textContent: datos }));
      if (!q && g.missing.length) {
        summary.append(el('span', { className: 'serie-faltan', textContent: `Te faltan: ${rangesText(g.missing)}` }));
      }
      const rows = g.items.map(i => {
        const quitar = el('button', { className: 'link', textContent: 'quitar', title: 'Quitar del registro (no borra el archivo)' });
        quitar.onclick = () => removePaths([i.path]);
        const nombre = el('td', {}, el('div', { textContent: i.name }), el('div', { className: 'ruta', textContent: i.path }));
        const link = /^https?:\/\//i.test(i.url || '') ? el('a', { href: i.url, target: '_blank', rel: 'noopener', textContent: 'abrir' }) : '';
        return el('tr', {}, nombre,
          el('td', { className: 'num', textContent: fecha(i.ts) }),
          el('td', { className: 'num', textContent: `${i.pages ?? '?'} págs` }),
          el('td', { className: 'num' }, link),
          el('td', { className: 'num' }, quitar));
      });
      const todo = el('button', { className: 'danger', textContent: `Quitar toda la serie del registro (${g.items.length})` });
      todo.onclick = () => { if (confirm(`¿Quitar del registro los ${g.items.length} capítulos de "${g.serie}"? Los archivos no se borran.`)) removePaths(g.items.map(i => i.path)); };
      const det = el('details', { className: 'serie', open: openSeries.has(g.serie) || !!q }, summary,
        el('table', {}, el('tbody', {}, ...rows)), el('div', { style: 'margin-top: 8px;' }, todo));
      det.addEventListener('toggle', () => { if (det.open) openSeries.add(g.serie); else openSeries.delete(g.serie); });
      box.append(det);
    }
  }

  $('filtro').addEventListener('input', renderSaved);

  $('exportar').onclick = async () => {
    const data = await store.get(KEYS);
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const blob = new Blob([JSON.stringify({ app: 'manga-reader', format: 1, exported: d.toISOString(), data }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `manga-reader-copia-${stamp}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say('guardadosMsg', `Copia exportada: ${Object.keys(data.savedChapters || {}).length} capítulos.`, true);
  };

  $('importar').onclick = () => $('archivo').click();
  $('archivo').addEventListener('change', async () => {
    const file = $('archivo').files[0];
    $('archivo').value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const data = json?.app === 'manga-reader' ? json.data : json;
      if (!data || typeof data.savedChapters !== 'object') throw new Error('no es una copia de Manga Reader');
      const { out, added } = mergeBackup(await store.get(KEYS), data);
      await store.set(out);
      await load();
      say('guardadosMsg', `Copia importada: ${added} capítulo${added === 1 ? '' : 's'} nuevo${added === 1 ? '' : 's'}.`, true);
    } catch (e) {
      say('guardadosMsg', `No se pudo importar: ${e.message}`, false);
    }
  });

  // ── Sagas ──

  const includedText = () => sagasToText(globalThis.MR_SAGAS || {});

  $('sagasSave').onclick = async () => {
    const { table, errors } = parseSagas($('sagasText').value);
    if (errors.length) return say('sagasMsg', errors.join('\n'), false);
    await store.set({ sagas: table, sagasText: $('sagasText').value });
    const n = Object.keys(table).length;
    say('sagasMsg', `Guardado: ${n} serie${n === 1 ? '' : 's'} con sagas. Vale desde el próximo guardado.`, true);
  };

  $('sagasReset').onclick = async () => {
    await store.remove(['sagas', 'sagasText']);
    $('sagasText').value = includedText();
    say('sagasMsg', 'Quedaron solo las sagas que vienen incluidas.', true);
  };

  // ── Burbuja ──

  function renderHosts(hosts) {
    const ul = $('hosts');
    ul.replaceChildren();
    if (!hosts.length) return ul.append(el('li', { className: 'vacio', textContent: 'Ninguno: la burbuja aparece en todos los sitios.' }));
    for (const h of hosts) {
      const b = el('button', { textContent: 'Volver a mostrarla' });
      b.onclick = async () => {
        const left = ((await store.get(['fabBlockedHosts'])).fabBlockedHosts || []).filter(x => x !== h);
        await store.set({ fabBlockedHosts: left });
        renderHosts(left);
      };
      ul.append(el('li', {}, el('span', { textContent: h }), b));
    }
  }

  // ── Mis sitios de manga y cómics ──

  const S = globalThis.MR_SITIOS;
  let editando = -1;                      // índice del sitio que se está editando, o -1

  function limpiarForm() {
    editando = -1;
    for (const id of ['sitioNombre', 'sitioUrl', 'sitioDesc']) $(id).value = '';
    $('sitioTipo').value = 'mixto';
    $('sitioEs').checked = $('sitioEn').checked = $('sitioDescarga').checked = false;
    $('sitioGuardar').textContent = 'Agregar sitio';
    $('sitioCancelar').hidden = true;
  }

  let misLista = [];                      // la lista guardada, tal como está en el almacenamiento

  function renderMisSitios(mios) {
    if (mios) misLista = mios;
    mios = misLista;
    const ul = $('misSitios');
    ul.replaceChildren();
    const descargables = mios.filter(s => s.descargable === true).length;
    $('sitiosCuenta').textContent = mios.length
      ? `Tu lista: ${mios.length} sitio${mios.length === 1 ? '' : 's'} (${descargables} descargable${descargables === 1 ? '' : 's'} y ${mios.length - descargables} para leer)`
      : 'Tu lista';
    $('sitiosFiltro').hidden = $('sitiosQuitarTodos').hidden = !mios.length;
    if (!mios.length) return ul.append(el('li', { className: 'vacio', textContent: 'Todavía no agregaste ninguno. Pegá tu lista arriba.' }));
    const q = $('sitiosFiltro').value.trim().toLowerCase();
    let visibles = 0;
    mios.forEach((s, i) => {
      if (q && !`${s.nombre} ${s.url} ${s.descripcion || ''}`.toLowerCase().includes(q)) return;
      visibles++;
      const editar = el('button', { textContent: 'Editar' });
      editar.onclick = () => {
        editando = i;
        $('sitioNombre').value = s.nombre || '';
        $('sitioUrl').value = s.url || '';
        $('sitioTipo').value = S.TIPOS[s.tipo] ? s.tipo : 'mixto';
        $('sitioEs').checked = (s.idiomas || []).includes('es');
        $('sitioEn').checked = (s.idiomas || []).includes('en');
        $('sitioDescarga').checked = s.descargable === true;
        $('sitioDesc').value = s.descripcion || '';
        $('sitioGuardar').textContent = 'Guardar cambios';
        $('sitioCancelar').hidden = false;
        $('sitioNombre').focus();
      };
      const quitar = el('button', { className: 'danger', textContent: 'Quitar' });
      quitar.onclick = async () => {
        const list = (await store.get(['misSitios'])).misSitios || [];
        list.splice(i, 1);
        await store.set({ misSitios: list });
        limpiarForm();
      };
      const r = S.normalizarSitio(s);
      ul.append(el('li', {},
        el('span', { className: 's-nombre', textContent: s.nombre }),
        el('span', { className: 's-datos', textContent: r.ok ? `${r.sitio.descargable ? '📥 Descargable' : '👁 Para leer'} · ${S.resumenSitio(r.sitio)} · ${r.sitio.url}` : s.url }),
        el('span', { className: 's-acc' }, editar, quitar),
        ...(s.descripcion ? [el('span', { className: 's-desc', textContent: s.descripcion })] : [])));
    });
    if (!visibles) ul.append(el('li', { className: 'vacio', textContent: 'Ninguno coincide con la búsqueda.' }));
  }
  $('sitiosFiltro').addEventListener('input', () => renderMisSitios());
  $('sitiosQuitarTodos').onclick = async () => {
    const n = misLista.length;
    if (!n || !confirm(`¿Quitar los ${n} sitios de tu lista? No se puede deshacer (salvo que tengas una copia exportada).`)) return;
    await store.set({ misSitios: [] });
    limpiarForm();
    say('sitiosMsg', `Se quitaron los ${n} sitios.`, true);
  };

  // ── Pegar una lista: se muestra lo que se detectó antes de agregarlo ──
  let leidos = { sitios: [], repetidos: 0 };

  function verLista() {
    leidos = S.leerLista($('listaTexto').value);
    const ya = new Set(misLista.map(s => S.claveUrl(s.url)));
    const nuevos = leidos.sitios.filter(s => !ya.has(S.claveUrl(s.url)));
    $('listaAgregar').disabled = !nuevos.length;
    $('listaAgregar').textContent = nuevos.length ? `Agregar ${nuevos.length} sitio${nuevos.length === 1 ? '' : 's'}` : 'Agregar lista';
    const vista = $('listaVista');
    vista.replaceChildren();
    if (!$('listaTexto').value.trim()) return;
    if (!leidos.sitios.length) { vista.textContent = 'No encontré ninguna dirección en lo que pegaste.'; return; }
    const estaban = leidos.sitios.length - nuevos.length;
    vista.append(`Encontré ${leidos.sitios.length} sitio${leidos.sitios.length === 1 ? '' : 's'}` +
      (estaban ? ` · ${estaban} ya ${estaban === 1 ? 'está' : 'están'} en tu lista` : '') +
      (leidos.repetidos ? ` · ${leidos.repetidos} repetido${leidos.repetidos === 1 ? '' : 's'} en lo pegado` : '') + ':');
    const ol = el('ol');
    for (const s of leidos.sitios) {
      const host = new URL(s.url).hostname.replace(/^www\./, '');
      const dato = [host, S.TIPOS[s.tipo], s.idiomas.map(i => S.IDIOMAS[i]).join(' e '), ya.has(S.claveUrl(s.url)) ? 'ya está' : ''].filter(Boolean).join(' · ');
      ol.append(el('li', {}, el('b', { textContent: s.nombre }), ' ', el('span', { className: 'v-dato', textContent: dato }), s.descripcion ? ' — ' + s.descripcion : ''));
    }
    vista.append(ol);
  }
  $('listaTexto').addEventListener('input', verLista);

  $('listaAgregar').onclick = async () => {
    const descargable = $('listaDescarga').checked;
    const list = (await store.get(['misSitios'])).misSitios || [];
    const ya = new Set(list.map(s => S.claveUrl(s.url)));
    let nuevos = 0;
    for (const s of leidos.sitios) {
      const clave = S.claveUrl(s.url);
      if (ya.has(clave)) continue;
      ya.add(clave);
      list.push({ ...s, descargable });
      nuevos++;
    }
    const estaban = leidos.sitios.length - nuevos;
    await store.set({ misSitios: list });
    $('listaTexto').value = '';
    verLista();
    say('listaMsg', `Agregados ${nuevos} sitio${nuevos === 1 ? '' : 's'} como ${descargable ? 'descargables' : 'para leer'}` +
      (estaban ? ` · ${estaban} ya ${estaban === 1 ? 'estaba' : 'estaban'}` : '') + '. Ya aparecen en el ícono de la extensión.', true);
  };

  $('sitioGuardar').onclick = async () => {
    const idiomas = [...($('sitioEs').checked ? ['es'] : []), ...($('sitioEn').checked ? ['en'] : [])];
    const r = S.normalizarSitio({ nombre: $('sitioNombre').value, url: $('sitioUrl').value, tipo: $('sitioTipo').value, idiomas,
                                  descripcion: $('sitioDesc').value, descargable: $('sitioDescarga').checked });
    if (!r.ok) return say('sitiosMsg', r.error, false);
    const { nombre, url, tipo, descripcion, descargable } = r.sitio;
    const list = (await store.get(['misSitios'])).misSitios || [];
    const repetido = list.findIndex((s, i) => i !== editando && S.claveUrl(s.url) === S.claveUrl(url));
    if (repetido >= 0) return say('sitiosMsg', `Ya está en tu lista como "${list[repetido].nombre}"`, false);
    const sitio = { nombre, url, tipo, idiomas: r.sitio.idiomas, descripcion, descargable };
    if (editando >= 0 && editando < list.length) list[editando] = sitio; else list.push(sitio);
    await store.set({ misSitios: list });
    say('sitiosMsg', editando >= 0 ? `Guardado "${nombre}".` : `Agregado "${nombre}". Ya aparece en el ícono de la extensión.`, true);
    limpiarForm();
  };
  $('sitioCancelar').onclick = limpiarForm;

  // ── Plantilla de nombres ─────────────────────────────
  // La vista previa usa aplicarPlantilla (plantilla.js), lo mismo que arma el nombre al guardar
  const TPLS = {
    tplDefault: PLANTILLA_DEFECTO,
    tplPlana: '{serie}/{serie} {numero}',
    tplVolumen: '{serie}/{volumen}/{serie} {numero}',
    tplAnio: '{serie}/{anio}/{serie} {numero}',
  };
  // Dos capítulos de muestra: uno bajado en un lote (con tomo y nombre) y uno guardado suelto
  const TPL_MUESTRAS = [
    ['En un lote', { serie: 'One Piece', saga: '01 East Blue', volumen: 'Tomo 1', numero: '0005', titulo: 'Capítulo 5', sitio: 'sitio.com' }],
    ['De a uno', { serie: 'Naruto', saga: '', volumen: '', numero: '0300', titulo: '', sitio: 'sitio.com' }],
  ];

  const refrescarVista = () => {
    const tpl = $('tplNombre').value.trim() || PLANTILLA_DEFECTO;
    const anio = String(new Date().getFullYear());
    $('tplVista').replaceChildren(...TPL_MUESTRAS.flatMap(([cual, datos], i) => [
      ...(i ? ['\n'] : []), el('span', { textContent: cual + ': ' }), `Descargas/MangaReader/${aplicarPlantilla(tpl, { ...datos, anio })}.pdf`]));
    const raros = marcadoresDesconocidos(tpl);
    $('tplAviso').textContent = [
      plantillaColisiona(tpl) ? '⚠️ Sin {numero} ni {titulo}, todos los capítulos de una serie se llamarían igual.' : '',
      raros.length ? `⚠️ No conozco ${raros.join(', ')}: va a quedar escrito tal cual en el nombre.` : '',
    ].filter(Boolean).join('\n');
  };

  $('tplNombre').addEventListener('input', () => { $('tplMsg').textContent = ''; refrescarVista(); });
  for (const [id, tpl] of Object.entries(TPLS)) {
    $(id).onclick = () => { $('tplNombre').value = tpl; $('tplMsg').textContent = ''; refrescarVista(); };
  }
  $('tplGuardar').onclick = async () => {
    const tpl = $('tplNombre').value.trim();
    const propia = tpl && tpl !== PLANTILLA_DEFECTO;         // la predeterminada no se guarda: es el nombre de siempre
    if (propia) await store.set({ esquemaNombres: tpl }); else await store.remove('esquemaNombres');
    if (!tpl) { $('tplNombre').value = PLANTILLA_DEFECTO; refrescarVista(); }
    say('tplMsg', propia ? 'Plantilla guardada. Vale desde el próximo capítulo que guardes.' : 'Quedó la predeterminada.', true);
  };

  // ── Ritmo de las descargas ───────────────────────────
  // Lo que se escribe pasa por normalizarRitmo (ajustes.js), lo mismo que usa el lote: lo que
  // queda en los campos después de guardar es lo que se va a usar.
  const A = globalThis.MR_AJUSTES;
  const verRitmo = (r) => { $('ritmoPausa').value = r.pausa; $('ritmoCada').value = r.descansoCada; $('ritmoSeg').value = r.descansoSeg; $('ritmoConc').value = r.concurrencia; };
  $('ritmoGuardar').onclick = async () => {
    const antes = (await store.get(['ritmo'])).ritmo || {};
    const r = A.normalizarRitmo({ ...antes, pausa: $('ritmoPausa').value, descansoCada: $('ritmoCada').value, descansoSeg: $('ritmoSeg').value, concurrencia: $('ritmoConc').value });
    await store.set({ ritmo: r });
    verRitmo(r);
    say('ritmoMsg', `Guardado: ${r.pausa} s entre capítulos` + (r.descansoCada ? `, descanso de ${r.descansoSeg} s cada ${r.descansoCada}` : ', sin descanso') +
      ` y ${r.concurrencia} imágenes a la vez. Vale desde el próximo lote.`, true);
  };
  $('ritmoDefecto').onclick = async () => {
    await store.remove('ritmo');
    verRitmo(A.normalizarRitmo(null));
    say('ritmoMsg', 'Quedó el ritmo de siempre.', true);
  };

  async function load() {
    const st = await store.get(KEYS);
    verRitmo(A.normalizarRitmo(st.ritmo));
    saved = st.savedChapters || {};
    renderSaved();
    $('sagasText').value = typeof st.sagasText === 'string' && st.sagasText.trim() ? st.sagasText : includedText();
    renderHosts(st.fabBlockedHosts || []);
    renderMisSitios(st.misSitios || []);
    $('tplNombre').value = typeof st.esquemaNombres === 'string' && st.esquemaNombres.trim() ? st.esquemaNombres : PLANTILLA_DEFECTO;
    refrescarVista();
    // El popup abre esta página en "Mis sitios" cuando la lista está vacía
    if (location.hash === '#mis-sitios') { $('mis-sitios').scrollIntoView(); $('listaTexto').focus(); }
  }

  // Si se guarda un capítulo mientras esta página está abierta, la lista se actualiza sola
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.savedChapters) { saved = ch.savedChapters.newValue || {}; renderSaved(); }
    if (ch.fabBlockedHosts) renderHosts(ch.fabBlockedHosts.newValue || []);
    if (ch.misSitios) { renderMisSitios(ch.misSitios.newValue || []); verLista(); }
  });

  load();
}
