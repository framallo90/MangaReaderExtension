// Interfaz del programa. Todo lo que viene de una página web se escribe con textContent:
// nunca se interpreta como HTML.
// `mr` es el puente con el programa: lo define preload_ui.js y ya es una variable global acá.
const $ = (id) => document.getElementById(id);
function el(tag, props = {}, ...hijos) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...hijos.filter(h => h !== null && h !== undefined));
  return e;
}
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

let ruta = [];              // por dónde se entró: [{ url, titulo }]
let actual = null;          // lo que devolvió el último análisis
let listaId = '';           // la lista que se está mirando
let marcados = new Set();   // direcciones tildadas
let ocupado = false;
let tareas = [];

function estado(texto, clase = '') {
  $('estado').textContent = texto;
  $('estado').className = 'estado' + (clase ? ' ' + clase : '');
}

// ── Explorar ──
// Analiza una dirección y la muestra. `nivel` es la posición de la ruta que ocupa.
// Con `buscarCatalogo`, si la dirección es la portada de un sitio y tiene un link a su listado
// completo ("Directorio", "Biblioteca"…), entra ahí sola: la portada suele mostrar solo una parte.
const esPortada = (url) => { try { return /^\/*$/.test(new URL(url).pathname); } catch { return false; } };
async function ir(url, nivel = ruta.length, buscarCatalogo = false) {
  if (ocupado) return;
  ocupado = true;
  $('analizar').disabled = true;
  estado('Analizando la página…', 'trabajando');
  try {
    let r = await mr.analizar(url), entre = '';
    ruta = ruta.slice(0, nivel);
    ruta.push({ url: r.url, titulo: r.titulo || r.url });
    if (buscarCatalogo && !r.capitulo && r.catalogos?.length && esPortada(r.url)) {
      const c = r.catalogos[0];
      estado(`Encontré el catálogo ("${c.texto}"). Abriéndolo…`, 'trabajando');
      try {
        const r2 = await mr.analizar(c.url);
        ruta.push({ url: r2.url, titulo: r2.titulo || c.texto });
        r = r2;
        entre = c.texto;
      } catch {}                                   // si no abre, queda la portada
    }
    $('url').value = r.url;
    mostrar(r);
    if (entre) estado(`Entré al catálogo que encontré en la portada ("${entre}"). ` + ayuda(r) + ' Para volver a la portada, usá la ruta de arriba.', 'bien');
  } catch (e) {
    estado('⚠️ ' + e.message, 'error');
  } finally {
    ocupado = false;
    $('analizar').disabled = false;
  }
}

function mostrar(r, tildarTodo = false) {
  actual = r;
  listaId = r.listas[0]?.id || '';
  marcados = new Set(tildarTodo && r.listas[0] ? r.listas[0].items.map(i => i.url) : []);
  $('filtro').value = '';
  if (!r.capitulo && !r.listas.length) estado('No encontré capítulos ni listas de links en esta página.', 'error');
  else if (!r.mensaje) estado(r.capitulo && !r.listas.length ? 'Esta página es un capítulo.' : ayuda(r));
  dibujar();
}
// Qué se puede hacer con lo encontrado, y si puede faltar algo
function ayuda(r) {
  return 'La flecha › de cada renglón abre esa página.' +
    (r.siguiente ? ' El listado sigue en más páginas: tocá "Traer más páginas".' : '') +
    (r.sigueCreciendo ? ' La página seguía cargando más al bajar: puede faltar algo.' : '');
}

// Lee las páginas siguientes del listado (10 por vez) y suma lo que encuentre a lo que ya está
async function traerMas() {
  if (ocupado || !actual?.siguiente) return;
  ocupado = true;
  $('siguiente').disabled = true;
  try {
    const r = await mr.seguir(actual.siguiente, 10, actual.listas.map(l => l.id));
    let nuevos = 0;                                // los que se suman a la lista que se está mirando
    for (const l of r.listas) {
      const mia = actual.listas.find(x => x.id === l.id);
      if (!mia) { actual.listas.push(l); continue; }
      const tengo = new Set(mia.items.map(i => i.url));
      for (const i of l.items) if (!tengo.has(i.url)) { mia.items.push(i); if (mia.id === listaId) nuevos++; }
      if (mia.tipo === 'capitulos') mia.items.sort((a, b) => a.numero - b.numero);
    }
    actual.siguiente = r.siguiente;
    if (!listaActual()) listaId = actual.listas[0]?.id || '';
    dibujar();
    estado(`Sumé ${plural(nuevos, 'renglón', 'renglones')} a esta lista, de ${plural(r.paginas, 'página', 'páginas')}.` + (r.siguiente ? ' Todavía hay más páginas.' : ' No hay más páginas.'), 'bien');
  } catch (e) {
    estado('⚠️ ' + e.message, 'error');
  } finally {
    ocupado = false;
    $('siguiente').disabled = false;
  }
}

const listaActual = () => actual?.listas.find(l => l.id === listaId) || null;
const visibles = () => {
  const l = listaActual(), q = $('filtro').value.trim().toLowerCase();
  return !l ? [] : l.items.filter(i => !q || `${i.numero ?? ''} ${i.texto} ${i.seccion || ''}`.toLowerCase().includes(q));
};

function dibujar() {
  // Ruta
  $('ruta').replaceChildren(...ruta.flatMap((p, i) => {
    const b = el('button', { type: 'button', textContent: p.titulo, title: p.url });
    b.addEventListener('click', () => { if (p.url && i < ruta.length - 1) ir(p.url, i); });
    return i ? [el('span', { className: 'sep', textContent: '›' }), b] : [b];
  }));

  // Si la página es un capítulo
  const c = actual?.capitulo;
  $('capitulo').hidden = !c;
  if (c) {
    $('capNombre').textContent = c.nombre;
    $('capDatos').textContent = c.imagenes ? `unas ${c.imagenes} imágenes` : '';
  }

  // Links al listado completo del sitio, si la página los tiene
  const pistas = actual && !actual.capitulo ? (actual.catalogos || []) : [];
  $('pistas').hidden = !pistas.length;
  $('pistas').replaceChildren(el('span', { className: 'tenue', textContent: '¿Buscás el listado completo? Probá:' }), ...pistas.map(c => {
    const b = el('button', { type: 'button', textContent: c.texto + ' ›', title: c.url });
    b.addEventListener('click', () => ir(c.url));
    return b;
  }));

  // Listas encontradas
  const listas = actual?.listas || [];
  const variasDeCapitulos = listas.filter(l => l.tipo === 'capitulos').length > 1;      // solo ahí hace falta distinguirlas
  $('tabs').replaceChildren(...(listas.length > 1 ? listas.map(l => {
    const b = el('button', { type: 'button', className: l.id === listaId ? 'on' : '', title: l.nombre,
      textContent: l.tipo === 'capitulos' ? `Capítulos (${l.items.length})` + (variasDeCapitulos ? ` · ${l.nombre}` : '')
                                          : `Títulos y links (${l.items.length}) · ${l.nombre}` });
    b.addEventListener('click', () => { listaId = l.id; marcados = new Set(); $('filtro').value = ''; dibujar(); });
    return b;
  }) : []));
  $('herramientas').hidden = !listaActual();
  $('siguiente').hidden = !actual?.siguiente;

  // Renglones, con un encabezado por volumen o saga cuando la página los separa
  const items = visibles(), filas = [];
  let seccion = null;
  for (const i of items) {
    if ((i.seccion || '') !== (seccion ?? '') && i.seccion) {
      const deLaSeccion = items.filter(x => x.seccion === i.seccion);
      const caja = el('input', { type: 'checkbox', checked: deLaSeccion.every(x => marcados.has(x.url)) });
      caja.addEventListener('change', () => { for (const x of deLaSeccion) caja.checked ? marcados.add(x.url) : marcados.delete(x.url); dibujar(); });
      filas.push(el('label', { className: 'seccion' }, caja, el('span', { className: 'txt', textContent: i.seccion }),
        el('span', { className: 'n', textContent: String(deLaSeccion.length) })));
    }
    seccion = i.seccion || '';
    const caja = el('input', { type: 'checkbox', checked: marcados.has(i.url) });
    caja.addEventListener('change', () => { caja.checked ? marcados.add(i.url) : marcados.delete(i.url); refrescar(); });
    const entrar = el('button', { type: 'button', className: 'entrar', textContent: '›', title: 'Abrir esta página' });
    entrar.addEventListener('click', (e) => { e.preventDefault(); ir(i.url); });
    filas.push(el('label', { className: 'fila', title: i.url }, caja,
      i.numero !== undefined && i.numero !== null ? el('span', { className: 'num', textContent: String(i.numero) }) : null,
      el('span', { className: 'txt', textContent: i.texto }), entrar));
  }
  $('lista').replaceChildren(...filas);
  refrescar();
}

function refrescar() {
  const l = listaActual();
  const n = l ? l.items.filter(i => marcados.has(i.url)).length : 0;
  $('cuenta').textContent = l ? `${plural(l.items.length, 'renglón', 'renglones')} · ${plural(n, 'marcado', 'marcados')}` : '';
  const hayFormato = $('fPdf').checked || $('fCbz').checked || $('fImgs').checked;
  $('descargar').disabled = !n || !hayFormato;
  $('descargar').textContent = n ? `Descargar ${plural(n, 'capítulo', 'capítulos')}` : 'Descargar';
  $('capBajar').disabled = !hayFormato;
}

// ── Guardar ──
const opciones = () => ({
  serie: $('serie').value.trim(),
  formatos: { pdf: $('fPdf').checked, cbz: $('fCbz').checked, imgs: $('fImgs').checked },
  saltear: $('saltear').checked,
});

async function encolar(items) {
  try {
    await mr.descargar(items, opciones());
    estado(`${plural(items.length, 'capítulo agregado', 'capítulos agregados')} a la cola.`, 'bien');
  } catch (e) {
    estado('⚠️ ' + e.message, 'error');
  }
}

// ── Cola ──
const ACTIVOS = new Set(['abriendo', 'buscando páginas', 'bajando']);
const ICONO = { 'en cola': '⏸', abriendo: '⏳', 'buscando páginas': '⏳', bajando: '⏳', listo: '✅', 'ya estaba': '✔', incompleto: '⚠️', 'falló': '⚠️', cancelado: '✖' };
function dibujarCola() {
  const activas = tareas.filter(t => t.estado === 'en cola' || ACTIVOS.has(t.estado)).length;
  $('colaCuenta').textContent = tareas.length ? `${tareas.length - activas} de ${tareas.length}` : '';
  $('cancelar').disabled = !activas;
  $('limpiar').disabled = tareas.length === activas;
  if (!tareas.length) return $('cola').replaceChildren(el('div', { className: 'vacio', textContent: 'Todavía no hay nada en la cola.' }));
  $('cola').replaceChildren(...tareas.map(t => {
    const clase = ACTIVOS.has(t.estado) ? 'activa' : t.estado === 'listo' || t.estado === 'ya estaba' ? 'listo' : t.estado === 'en cola' ? '' : 'mal';
    const detalle = t.estado === 'listo' ? t.detalle : t.estado === 'ya estaba' ? 'ya estaba' : t.detalle ? `${t.estado}: ${t.detalle}` : t.estado;
    const nombre = t.nombre || (t.numero !== null ? `${t.numero} · ` : '') + (t.texto || t.url);
    return el('div', { className: 'tarea ' + clase, title: t.url },
      el('div', { className: 't-nombre', textContent: nombre }),
      el('div', { className: 't-estado', textContent: `${ICONO[t.estado] || ''} ${detalle}` }));
  }));
  const enCurso = $('cola').querySelector('.tarea.activa');
  if (enCurso) enCurso.scrollIntoView({ block: 'nearest' });
}

// ── Pegar links ──
async function usarLinks() {
  try {
    const desde = parseFloat($('linksDesde').value);
    const r = await mr.links($('links').value, $('linksModo').value, isNaN(desde) ? 1 : desde);
    if (!r.items.length) return estado('No encontré ningún link en lo que pegaste.', 'error');
    const items = r.items.map(i => ({ url: i.url, texto: i.title || i.url, numero: i.numero, seccion: '' }));
    const a = items[0].numero, b = items[items.length - 1].numero, n = items.length;
    const como = { label: 'con el número escrito adelante de cada link', link: 'con el número que trae cada link',
                   order: `numerados en el orden en que los pegaste, desde ${a}`, reverse: `numerados del último al primero, desde ${a}` }[r.how];
    const tengo = new Set(items.map(i => i.numero)), faltan = [];
    if (r.how === 'label' || r.how === 'link') for (let k = Math.ceil(a); k <= b && faltan.length <= 12; k++) if (!tengo.has(k)) faltan.push(k);
    ruta = [{ url: '', titulo: 'Links pegados' }];
    mostrar({ url: '', titulo: 'Links pegados', capitulo: null, siguiente: '', mensaje: true,
              listas: [{ tipo: 'capitulos', id: 'pegados', nombre: 'pegados', items }] }, true);
    estado(`Tomé ${plural(n, 'link', 'links')}: ${n === 1 ? `capítulo ${a}` : `capítulos ${a} a ${b}`}, ${como}.` +
      (faltan.length && faltan.length <= 12 ? ` En el medio falta${faltan.length === 1 ? '' : 'n'}: ${faltan.join(', ')}.` : '') +
      (r.dup ? ` ${plural(r.dup, 'repetido no entró', 'repetidos no entraron')}.` : '') +
      ($('serie').value.trim() ? '' : ' Escribí el nombre de la serie a la derecha.'), 'bien');
    $('pegar').hidden = true;
    if (!$('serie').value.trim()) $('serie').focus();
  } catch (e) {
    estado('⚠️ ' + e.message, 'error');
  }
}

// ── Links guardados ──
// Tu lista de direcciones (sitios, catálogos, series). Tocar una la analiza como si la pegaras arriba.
let guardados = [];
let quitarTodosArmado = 0;        // "Quitar todos" pide un segundo toque: este es el temporizador que lo desarma
const sinProtocolo = (u) => String(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
function avisoGuardados(texto, clase = '') {
  $('guardadosMsg').textContent = texto;
  $('guardadosMsg').className = 'tenue' + (clase ? ' ' + clase : '');
}
function dibujarGuardados() {
  const q = $('guardadosFiltro').value.trim().toLowerCase();
  const ver = guardados.filter(s => !q || `${s.nombre} ${s.url} ${s.descripcion || ''}`.toLowerCase().includes(q));
  $('verGuardados').textContent = guardados.length ? `⭐ Guardados (${guardados.length})` : '⭐ Guardados';
  $('guardadosCuenta').textContent = !guardados.length ? '' : q ? `${ver.length} de ${guardados.length}` : plural(guardados.length, 'link', 'links');
  $('guardadosFiltro').hidden = $('quitarTodos').hidden = !guardados.length;
  if (!guardados.length) $('cargar').hidden = false;                 // sin nada guardado, el cuadro para cargar queda a la vista
  $('guardadosLista').replaceChildren(...(ver.length ? ver.map(s => {
    const abrir = el('button', { type: 'button', className: 'g-abrir', title: `Analizar ${s.url}` },
      el('span', { className: 'g-nombre', textContent: s.nombre }),
      el('span', { className: 'g-datos', textContent: sinProtocolo(s.url) + (s.descripcion ? ' · ' + s.descripcion : '') }));
    abrir.addEventListener('click', () => { $('guardados').hidden = true; $('url').value = s.url; ir(s.url, 0, true); });
    const quitar = el('button', { type: 'button', className: 'g-quitar', textContent: '✕', title: 'Quitar de la lista' });
    quitar.addEventListener('click', async () => { guardados = await mr.quitarLinks([s.url]); dibujarGuardados(); });
    return el('div', { className: 'guardado' }, abrir, quitar);
  }) : [el('div', { className: 'vacio', textContent: guardados.length ? 'Nada coincide con la búsqueda.'
    : 'Todavía no guardaste ningún link. Guardá la dirección que estés mirando o cargá una lista.' })]));
}
// Guarda la dirección de arriba, con el título de la página si ya se analizó
async function guardarActual() {
  let url = $('url').value.trim();
  if (!url) return avisoGuardados('Escribí o pegá una dirección arriba.', 'error');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  const nombre = actual && actual.url === url ? (actual.titulo || '') : '';
  try {
    const r = await mr.guardarLinks({ sitio: { nombre, url } });
    guardados = r.lista;
    dibujarGuardados();
    avisoGuardados(r.agregados ? 'Guardada.' : 'Esa dirección ya estaba en tu lista.', r.agregados ? 'bien' : '');
  } catch (e) {
    avisoGuardados('⚠️ ' + e.message, 'error');
  }
}
// Suma a la lista los links de un texto pegado
async function agregarLista() {
  try {
    const r = await mr.guardarLinks({ texto: $('listaLinks').value });
    guardados = r.lista;
    if (r.agregados) { $('listaLinks').value = ''; $('cargar').hidden = true; }
    dibujarGuardados();
    avisoGuardados((r.agregados ? `Agregué ${plural(r.agregados, 'link', 'links')}.` : 'No agregué ninguno.') +
      (r.repetidos ? ` ${plural(r.repetidos, 'ya estaba o venía repetido', 'ya estaban o venían repetidos')}.` : ''), r.agregados ? 'bien' : '');
  } catch (e) {
    avisoGuardados('⚠️ ' + e.message, 'error');
  }
}
function quitarTodos() {
  clearTimeout(quitarTodosArmado);
  if ($('quitarTodos').dataset.armado) {
    delete $('quitarTodos').dataset.armado;
    $('quitarTodos').textContent = 'Quitar todos';
    mr.quitarLinks('todos').then((l) => { guardados = l; dibujarGuardados(); avisoGuardados('Quité todos los links.'); });
    return;
  }
  $('quitarTodos').dataset.armado = '1';
  $('quitarTodos').textContent = `¿Quitar los ${guardados.length}? Tocá de nuevo`;
  quitarTodosArmado = setTimeout(() => { delete $('quitarTodos').dataset.armado; $('quitarTodos').textContent = 'Quitar todos'; }, 4000);
}

// ── Eventos ──
$('buscar').addEventListener('submit', (e) => {
  e.preventDefault();
  let url = $('url').value.trim();
  if (!url) return;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;          // "sitio.com/serie" → "https://sitio.com/serie"
  ir(url, 0, true);
});
$('verPegar').addEventListener('click', () => { $('pegar').hidden = !$('pegar').hidden; $('guardados').hidden = true; if (!$('pegar').hidden) $('links').focus(); });
$('usarLinks').addEventListener('click', usarLinks);
$('verGuardados').addEventListener('click', () => {
  $('guardados').hidden = !$('guardados').hidden;
  $('pegar').hidden = true;
  avisoGuardados('');
  if (!$('guardados').hidden) (guardados.length ? $('guardadosFiltro') : $('listaLinks')).focus();
});
$('guardarActual').addEventListener('click', guardarActual);
$('verCargar').addEventListener('click', () => { $('cargar').hidden = !$('cargar').hidden; if (!$('cargar').hidden) $('listaLinks').focus(); });
$('agregarLista').addEventListener('click', agregarLista);
$('guardadosFiltro').addEventListener('input', dibujarGuardados);
$('quitarTodos').addEventListener('click', quitarTodos);
$('filtro').addEventListener('input', dibujar);
$('todos').addEventListener('click', () => { for (const i of visibles()) marcados.add(i.url); dibujar(); });
$('ninguno').addEventListener('click', () => { for (const i of visibles()) marcados.delete(i.url); dibujar(); });
$('siguiente').addEventListener('click', traerMas);
$('descargar').addEventListener('click', () => {
  const l = listaActual();
  if (l) encolar(l.items.filter(i => marcados.has(i.url)).map(i => ({ url: i.url, texto: i.texto, numero: i.numero })));
});
$('capBajar').addEventListener('click', () => { if (actual?.capitulo) encolar([{ url: actual.url, texto: actual.capitulo.nombre }]); });
$('cancelar').addEventListener('click', () => mr.cancelar());
$('limpiar').addEventListener('click', () => mr.limpiar());
$('abrirCarpeta').addEventListener('click', () => mr.abrirCarpeta());
$('cambiarCarpeta').addEventListener('click', async () => mostrarCarpeta(await mr.elegirCarpeta()));
for (const id of ['fPdf', 'fCbz', 'fImgs', 'saltear']) {
  $(id).addEventListener('change', () => { refrescar(); mr.guardarConfig({ formatos: opciones().formatos, saltear: $('saltear').checked }); });
}

function mostrarCarpeta(c) { $('carpeta').textContent = c; $('carpeta').title = c; }
mr.alCambiarCola((cola) => { tareas = cola; dibujarCola(); });
mr.alAvanzar((texto) => { if (ocupado) estado(texto, 'trabajando'); });
mr.config().then((c) => {
  $('fPdf').checked = c.formatos.pdf; $('fCbz').checked = c.formatos.cbz; $('fImgs').checked = c.formatos.imgs;
  $('saltear').checked = c.saltear !== false;
  mostrarCarpeta(c.carpeta);
  refrescar();
});
mr.guardados().then((l) => { guardados = l; dibujarGuardados(); });
$('url').focus();
