const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

// Abre un diálogo en la pestaña activa. El service worker le inyecta el script si la
// pestaña se abrió antes de instalar o actualizar la extensión: no hace falta F5.
async function openInTab(command) {
  try {
    const tab = await activeTab();
    const r = await chrome.runtime.sendMessage({ action: 'tab', tabId: tab.id, command });
    if (!r?.ok) throw new Error(r?.error || '');
    window.close();
  } catch {
    $('status').textContent = '⚠️ En esta página no se puede usar (probá en la del manga)';
  }
}
$('btnSave').addEventListener('click', () => openInTab('save'));
$('btnSeries').addEventListener('click', () => openInTab('batch'));
$('btnOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

// Burbuja flotante: en todos lados, y en el sitio de la pestaña activa
let tabInfo = null;               // { url, title } de la pestaña activa, si es una página web
(async () => {
  const st = await store.get(['fabEnabled', 'fabBlockedHosts', 'autoScan']);
  $('fabEnabled').checked = st.fabEnabled !== false;
  $('autoScan').checked = st.autoScan !== false;
  $('fabEnabled').addEventListener('change', () => store.set({ fabEnabled: $('fabEnabled').checked }));
  $('autoScan').addEventListener('change', () => store.set({ autoScan: $('autoScan').checked }));

  let host = '';
  try {
    const tab = await activeTab();
    const u = new URL(tab.url);
    if (/^https?:$/.test(u.protocol)) { host = u.hostname; tabInfo = { url: tab.url, title: tab.title || u.hostname }; }
  } catch {}
  if (!host) return;
  $('siteRow').hidden = false;
  $('siteLabel').textContent = `Mostrarla en ${host}`;
  $('fabSite').checked = !(st.fabBlockedHosts || []).includes(host);
  $('fabSite').addEventListener('change', async () => {
    const hosts = new Set((await store.get(['fabBlockedHosts'])).fabBlockedHosts || []);
    if ($('fabSite').checked) hosts.delete(host); else hosts.add(host);
    store.set({ fabBlockedHosts: [...hosts] });
  });
})();

// ── ¿Hay una versión nueva? ───────────────────────────
// La extensión se carga descomprimida y no se actualiza sola. Una vez por día se mira qué versión
// hay en la rama main del repositorio (ajustes.js sabe cómo); si es más nueva que esta, aparece
// un punto con el aviso. Si no se pudo mirar (sin conexión), se prueba de nuevo al otro día.
const UN_DIA = 24 * 60 * 60 * 1000;
(async () => {
  const A = globalThis.MR_AJUSTES, mia = chrome.runtime.getManifest().version;
  let vista = (await store.get(['versionVista'])).versionVista;
  if (!vista || typeof vista.ts !== 'number' || Date.now() - vista.ts > UN_DIA) {
    const remota = await A.versionRemota((u, o) => fetch(u, o)).catch(() => null);
    vista = { ts: Date.now(), version: remota ? remota.version : (vista?.version || '') };
    store.set({ versionVista: vista });
  }
  if (vista.version && A.compararVersiones(vista.version, mia) > 0) {
    $('versionTexto').textContent = `Hay una versión nueva: ${vista.version} (tenés la ${mia})`;
    $('versionNueva').hidden = false;
  }
})();

// ── Sitios de manga y cómics ──────────────────────────
// Lista de accesos directos dividida en dos: los descargables y los que son para leer en el
// sitio. El nombre abre el sitio en una pestaña nueva y la "i" muestra qué tiene, en qué
// idioma, si es gratis y si se puede guardar. Filtros por tipo y por idioma.

const S = globalThis.MR_SITIOS;
let filtro = { tipo: 'todos', idioma: 'todos', plegadas: [], texto: '' };
let todos = [];
const SECCIONES = [
  { clave: 'descargables', titulo: '📥 Descargables', sub: 'El sitio da el archivo o la extensión lo guarda' },
  { clave: 'leer', titulo: '👁 Para leer en el sitio', sub: 'No ofrecen descarga: los capítulos se leen ahí' },
];
const abiertos = new Set();       // sitios con la "i" abierta (para que no se cierren al filtrar)
const ETIQUETA = { manga: 'MANGA', manhwa: 'MANHWA', webtoon: 'WEBTOON', comics: 'CÓMICS', tiras: 'TIRAS', historieta: 'HISTORIETA', mixto: 'MIXTO' };
const MANGUERO = new Set(['manga', 'manhwa', 'webtoon', 'mixto']);

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter(k => k !== null && k !== undefined));
  return e;
}

function abrir(url) {
  if (!/^https?:\/\//i.test(url)) return;
  chrome.tabs.create({ url });
  window.close();
}

function filaSitio(s) {
  const clave = S.claveUrl(s.url);
  const g = S.GUARDAR[s.guardar] || S.GUARDAR.sin_verificar;
  const host = (() => { try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return s.url; } })();

  const open = el('button', { className: 'site-open', title: `Abrir ${host}` },
    el('span', { className: 'site-ico', textContent: g.icono, title: g.texto }),
    el('span', { className: 'site-name', textContent: s.nombre }),
    ...(s.mio ? [el('span', { className: 'tag mio', textContent: 'TUYO' })] : []),
    el('span', { className: 'tag tipo-' + (MANGUERO.has(s.tipo) ? (s.tipo === 'mixto' ? 'mixto' : 'manga') : 'comics'), textContent: ETIQUETA[s.tipo] || 'MIXTO' }),
    ...s.idiomas.map(i => el('span', { className: 'tag', textContent: i.toUpperCase() })));
  open.addEventListener('click', () => abrir(s.url));

  const guardar = s.mio ? `${g.icono} ${g.texto} · ${s.descargable ? 'lo marcaste como descargable' : 'lo marcaste para leer'}` : `${g.icono} ${g.texto}`;
  const info = el('div', { className: 'site-info', hidden: !abiertos.has(clave) },
    el('div', { className: 'site-kind', textContent: S.resumenSitio(s) }),
    el('div', { className: 'site-save ' + (S.esDescargable(s) ? 'si' : s.guardar === 'no_permite' ? 'no' : ''), textContent: guardar }),
    s.descripcion ? el('div', { className: 'site-desc', textContent: s.descripcion }) : null,
    el('div', { className: 'site-url', textContent: host }));

  const i = el('button', { className: 'site-i', textContent: 'i', title: 'Qué tiene este sitio' });
  i.setAttribute('aria-label', `Información de ${s.nombre}`);
  i.setAttribute('aria-expanded', String(!info.hidden));
  i.addEventListener('click', () => {
    info.hidden = !info.hidden;
    i.setAttribute('aria-expanded', String(!info.hidden));
    if (info.hidden) abiertos.delete(clave); else abiertos.add(clave);
  });

  return el('div', { className: 'site' }, el('div', { className: 'site-row' }, open, i), info);
}

// Una sección: título con la cantidad (se pliega al tocarlo), qué significa y sus sitios
function seccion({ clave, titulo, sub }, sitios) {
  const plegada = filtro.plegadas.includes(clave);
  const head = el('button', { className: 'sec ' + clave, title: plegada ? 'Mostrar' : 'Plegar' },
    el('span', { className: 'sec-t', textContent: titulo }),
    el('span', { className: 'sec-n', textContent: String(sitios.length) }),
    el('span', { className: 'sec-flecha', textContent: '▾' }));
  head.dataset.sec = clave;
  head.setAttribute('aria-expanded', String(!plegada));
  head.addEventListener('click', () => {
    filtro.plegadas = plegada ? filtro.plegadas.filter(c => c !== clave) : [...filtro.plegadas, clave];
    guardarFiltro();
    dibujarSitios();
  });
  if (plegada) return [head];
  const body = el('div', { className: 'sec-body' }, ...(sitios.length ? sitios.map(filaSitio)
    : [el('div', { className: 'vacio', textContent: 'Ninguno con este filtro.' })]));
  body.dataset.sec = clave;
  return [head, el('div', { className: 'sec-sub', textContent: sub }), body];
}

// Abre opciones en "Mis sitios", donde se pega la lista
function abrirMisSitios() {
  chrome.tabs.create({ url: chrome.runtime.getURL('opciones.html#mis-sitios') });
  window.close();
}
$('editarLista').addEventListener('click', abrirMisSitios);

function dibujarSitios() {
  // La extensión no trae sitios: hasta que cargues los tuyos, se explica cómo
  if (!todos.length) {
    const pegar = el('button', { className: 'btn', id: 'pegarLista', textContent: '📋 Pegar mi lista de sitios' });
    pegar.addEventListener('click', abrirMisSitios);
    $('lista').replaceChildren(el('div', { className: 'vacio' },
      el('div', { textContent: 'Todavía no cargaste sitios.' }),
      el('div', { className: 'vacio-sub', textContent: 'Pegá tu lista entera de una vez: el nombre, el tipo y el idioma se detectan solos.' }),
      pegar));
    $('count').textContent = '';
    return;
  }
  const lista = S.filtrarSitios(todos, filtro);
  const partes = S.dividirSitios(lista);
  $('lista').replaceChildren(...SECCIONES.flatMap(sec => seccion(sec, partes[sec.clave])));
  const n = lista.length;
  $('count').textContent = `${n} sitio${n === 1 ? '' : 's'}` + (n !== todos.length ? ` de ${todos.length}` : '') +
    `: ${partes.descargables.length} descargable${partes.descargables.length === 1 ? '' : 's'} y ${partes.leer.length} para leer`;
  for (const b of $('seg').children) b.classList.toggle('on', b.dataset.tipo === filtro.tipo);
  for (const b of $('segIdioma').children) b.classList.toggle('on', b.dataset.idioma === filtro.idioma);
}

// Botones de idioma: "Todos" y uno por cada idioma que aparece en la lista
function botonesIdioma() {
  const idiomas = S.idiomasDe(todos);
  if (filtro.idioma !== 'todos' && !idiomas.includes(filtro.idioma)) filtro.idioma = 'todos';
  $('segIdioma').replaceChildren(
    ...[['todos', 'Todos'], ...idiomas.map(i => [i, S.IDIOMAS[i]])].map(([v, t]) => {
      const b = el('button', { textContent: t });
      b.dataset.idioma = v;
      return b;
    }));
}

async function cargarSitios() {
  const st = await store.get(['misSitios', 'sitiosFiltro']);
  todos = S.juntarSitios(S.SITIOS, st.misSitios);
  const f = st.sitiosFiltro && typeof st.sitiosFiltro === 'object' ? st.sitiosFiltro : {};
  filtro = {
    tipo: ['todos', 'manga', 'comics'].includes(f.tipo) ? f.tipo : 'todos',
    idioma: typeof f.idioma === 'string' ? f.idioma : f.soloEs ? 'es' : 'todos',     // la 2.8 tenía "En español"
    plegadas: Array.isArray(f.plegadas) ? f.plegadas.filter(c => SECCIONES.some(s => s.clave === c)) : [],
    texto: $('buscar').value,
  };
  botonesIdioma();
  // "Agregar esta página": solo si la pestaña activa es una página web que no está en la lista
  $('addTab').hidden = !tabInfo || todos.some(s => S.claveUrl(s.url) === S.claveUrl(new URL(tabInfo.url).origin + '/'));
  dibujarSitios();
}

function guardarFiltro() {
  const { texto, ...resto } = filtro;
  store.set({ sitiosFiltro: resto });
}

function mostrarSitios(si) {
  $('main').hidden = si;
  $('sites').hidden = !si;
  if (si) { cargarSitios(); $('buscar').focus(); }
}

$('btnSites').addEventListener('click', () => mostrarSitios(true));
$('back').addEventListener('click', () => mostrarSitios(false));
$('seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tipo]');
  if (!b) return;
  filtro.tipo = b.dataset.tipo;
  guardarFiltro();
  dibujarSitios();
});
$('segIdioma').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-idioma]');
  if (!b) return;
  filtro.idioma = b.dataset.idioma;
  guardarFiltro();
  dibujarSitios();
});
$('buscar').addEventListener('input', () => { filtro.texto = $('buscar').value; dibujarSitios(); });

// Agrega la página abierta a "mis sitios", con el nombre del sitio y su portada
$('addTab').addEventListener('click', async () => {
  if (!tabInfo) return;
  const u = new URL(tabInfo.url);
  const nombre = (tabInfo.title.split(/\s+[|·–—-]\s+/).pop() || u.hostname).trim() || u.hostname;
  const r = S.normalizarSitio({ nombre, url: u.origin + '/', tipo: 'mixto' });
  if (!r.ok) { $('sitesStatus').textContent = '⚠️ ' + r.error; return; }
  const mios = (await store.get(['misSitios'])).misSitios || [];
  if (!mios.some(s => S.claveUrl(s.url) === S.claveUrl(r.sitio.url))) {
    mios.push({ nombre: r.sitio.nombre, url: r.sitio.url, tipo: r.sitio.tipo, idiomas: [], descripcion: '', descargable: false });
    await store.set({ misSitios: mios });
  }
  $('sitesStatus').style.color = '#2ecc71';
  $('sitesStatus').textContent = `✔ Agregado "${r.sitio.nombre}". Podés editarlo en opciones.`;
  cargarSitios();
});
