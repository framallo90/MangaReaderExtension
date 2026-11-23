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
let verTapas = true;        // mostrar la lista como un mosaico de tapas, cuando la página las tiene
const miniaturas = new Map();   // dirección de una imagen → su miniatura (data:), '' si no se pudo, o el pedido en curso
let recientes = [];         // las últimas direcciones analizadas a mano: [{ url, titulo }]
let serieAuto = '';         // el nombre que el programa puso solo en "Serie" (si escribís otro, no lo toca)
let enDisco = null;         // de la lista de capítulos a la vista: { clave, tengo: Set(números), faltan, cuantosFaltan, carpetas }
let revision = null;        // el capítulo cuyas páginas se están revisando: { url, info, paginas, elegidas: Set(url) }

function estado(texto, clase = '') {
  $('estado').textContent = texto;
  $('estado').className = 'estado' + (clase ? ' ' + clase : '');
}

// ── Explorar ──
// Analiza una dirección y la muestra. `nivel` es la posición de la ruta que ocupa.
// Con `buscarCatalogo`, si la dirección es la portada de un sitio y tiene un link a su listado
// completo ("Directorio", "Biblioteca"…), entra ahí sola: la portada suele mostrar solo una parte.
// `nombre` es cómo se llama el título por el que se entró (para proponerlo como serie) y
// `aMano` dice que la dirección se escribió o pegó: esas quedan anotadas como recientes.
const esPortada = (url) => { try { return /^\/*$/.test(new URL(url).pathname); } catch { return false; } };
async function ir(url, nivel = ruta.length, buscarCatalogo = false, nombre = '', aMano = false) {
  if (ocupado) return;
  ocupado = true;
  $('analizar').disabled = true;
  cerrarRevision();
  estado('Analizando la página…', 'trabajando');
  try {
    let r = await mr.analizar(url), entre = '';
    if (aMano) mr.reciente({ url: r.url, titulo: r.titulo }).then(mostrarRecientes).catch(() => {});
    ruta = ruta.slice(0, nivel);
    ruta.push({ url: r.url, titulo: r.titulo || r.url });
    // (en la portada de un sitio, una página "con pinta de capítulo" pero sin número de capítulo
    // en el título ni en la dirección es más probablemente una portada con imágenes grandes)
    if (buscarCatalogo && !(r.capitulo && r.capitulo.numero !== null) && r.catalogos?.length && esPortada(r.url)) {
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
    // La serie: al entrar a un título desde una lista se propone su nombre, para que todos sus
    // capítulos se guarden con el mismo. En un capítulo queda la que venía; en un listado, ninguna.
    if (r.listas.some(l => l.tipo === 'capitulos')) { if (nombre) proponerSerie(nombre); }
    else if (!r.capitulo) proponerSerie('');
    mostrar(r);
    if (entre) estado(`Entré al catálogo que encontré en la portada ("${entre}"). ` + ayuda(r) + ' Para volver a la portada, usá la ruta de arriba.', 'bien');
  } catch (e) {
    estado('⚠️ ' + e.message, 'error');
  } finally {
    ocupado = false;
    $('analizar').disabled = false;
  }
}

// Pone en "Serie" el nombre del título elegido, salvo que ya hayas escrito otro a mano.
// De un renglón como "One Piece Capítulo 1134 hace 2 horas" queda "One Piece".
function proponerSerie(nombre) {
  const campo = $('serie');
  if (campo.value.trim() && campo.value !== serieAuto) return;
  serieAuto = String(nombre || '').replace(/\s*(?:[-–—|:·]\s*)?(?:cap[ií]tulo|chapter|cap\.|ch\.|ep\.|#)\s*\d.*$/i, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  campo.value = serieAuto;
  marcarSerie();
}
function marcarSerie() {
  const sola = !!serieAuto && $('serie').value === serieAuto;
  $('serie').classList.toggle('auto', sola);
  $('serie').title = sola ? 'La puso el programa, por el título que elegiste. Si no es, escribí la que va.' : '';
}

function mostrar(r, tildarTodo = false) {
  actual = r;
  listaId = r.listas[0]?.id || '';
  marcados = new Set(tildarTodo && r.listas[0] ? r.listas[0].items.map(i => i.url) : []);
  $('filtro').value = '';
  enDisco = null;
  if (!r.capitulo && !r.listas.length) estado('No encontré capítulos ni listas de links en esta página.', 'error');
  else if (!r.mensaje) estado(r.capitulo && !r.listas.length ? 'Esta página es un capítulo.' : ayuda(r));
  dibujar();
  mirarDisco();
}
// Qué se puede hacer con lo encontrado, y si puede faltar algo
function ayuda(r) {
  return 'La flecha › de cada renglón abre esa página.' +
    (r.siguiente ? ' El listado sigue en más páginas: tocá "Traer más páginas".' : '') +
    (r.sigueCreciendo ? ' La página seguía cargando más al bajar: puede faltar algo.' : '');
}

// Lee hasta `max` páginas siguientes del listado y suma lo que encuentre a lo que ya está.
// Devuelve cuántos renglones se sumaron a la lista que se está mirando y cuántas páginas leyó.
async function sumarPaginas(max) {
  const r = await mr.seguir(actual.siguiente, max, actual.listas.map(l => l.id));
  let nuevos = 0;
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
  return { nuevos, paginas: r.paginas };
}

// "Traer más páginas": las 10 siguientes
async function traerMas() {
  if (ocupado || !actual?.siguiente) return;
  ocupado = true;
  $('siguiente').disabled = $('todasLasPaginas').disabled = true;
  try {
    const r = await sumarPaginas(10);
    estado(`Sumé ${plural(r.nuevos, 'renglón', 'renglones')} a esta lista, de ${plural(r.paginas, 'página', 'páginas')}.` + (actual.siguiente ? ' Todavía hay más páginas.' : ' No hay más páginas.'), 'bien');
    mirarDisco();
  } catch (e) {
    estado('⚠️ ' + e.message, 'error');
  } finally {
    ocupado = false;
    $('siguiente').disabled = $('todasLasPaginas').disabled = false;
  }
}

// "Traer todas": sigue de a 10 hasta el final del listado. Para sola a las 50 páginas (se
// puede volver a tocar para seguir) o cuando el sitio deja de contestar bien; mientras lee,
// el mismo botón dice "Parar".
const TODAS_MAX = 50;
let trayendoTodas = false, pararDeTraer = false;
async function traerTodas() {
  if (trayendoTodas) { pararDeTraer = true; $('todasLasPaginas').textContent = 'Parando…'; return; }
  if (ocupado || !actual?.siguiente) return;
  ocupado = trayendoTodas = true;
  pararDeTraer = false;
  $('siguiente').disabled = true;
  $('todasLasPaginas').textContent = 'Parar';
  let nuevos = 0, paginas = 0, corte = '';
  try {
    while (actual.siguiente && !pararDeTraer && paginas < TODAS_MAX) {
      const r = await sumarPaginas(Math.min(10, TODAS_MAX - paginas));
      nuevos += r.nuevos;
      paginas += r.paginas;
      if (!r.paginas) break;
      estado(`Leyendo el listado: ${plural(paginas, 'página', 'páginas')}, ${plural(nuevos, 'renglón nuevo', 'renglones nuevos')}…`, 'trabajando');
    }
  } catch (e) {
    corte = e.message;                             // lo que se juntó hasta acá queda
  }
  ocupado = trayendoTodas = false;
  $('siguiente').disabled = false;
  $('todasLasPaginas').textContent = 'Traer todas';
  const resumen = `Sumé ${plural(nuevos, 'renglón', 'renglones')} a esta lista, de ${plural(paginas, 'página', 'páginas')}.`;
  if (corte) estado(`${resumen} Paré porque el sitio no contestó bien: ${corte}. Esperá un rato antes de seguir.`, 'error');
  else estado(resumen + (!actual.siguiente ? ' No hay más páginas.' : pararDeTraer ? ' Lo paraste: todavía hay más páginas.'
    : ` Leí ${TODAS_MAX} páginas de un saque y todavía hay más: tocá de nuevo para seguir.`), 'bien');
  mirarDisco();
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
  $('inicio').hidden = !!actual || !recientes.length;

  // Si la página es un capítulo
  const c = actual?.capitulo;
  $('capitulo').hidden = !c;
  if (c) {
    $('capNombre').textContent = c.nombre;
    $('capDatos').textContent = c.imagenes ? `unas ${c.imagenes} imágenes` : '';
  }

  // Links al listado completo del sitio, si la página los tiene (también cuando parece un
  // capítulo: si en realidad era una portada, por acá se sale)
  const pistas = actual?.catalogos || [];
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
    b.addEventListener('click', () => { listaId = l.id; marcados = new Set(); $('filtro').value = ''; enDisco = null; dibujar(); mirarDisco(); });
    return b;
  }) : []));
  $('herramientas').hidden = !listaActual();
  $('siguiente').hidden = $('todasLasPaginas').hidden = !actual?.siguiente;

  // Con tapas: si la página trae una imagen para buena parte de los renglones, la lista se
  // puede ver como un mosaico. El botón "Tapas" lo prende y lo apaga.
  const l = listaActual();
  const conImagen = l ? l.items.filter(i => i.imagen).length : 0;
  const hayTapas = conImagen >= 3 && conImagen >= l.items.length * 0.3;
  const mosaico = hayTapas && verTapas;
  $('verTapas').hidden = !hayTapas;
  $('verTapas').classList.toggle('on', mosaico);
  $('lista').classList.toggle('tapas', mosaico);

  // Lo que ya está en la carpeta, si es una lista de capítulos y se sabe de qué serie
  // (en la carpeta o en tu colección: "ya está"; o en el registro, aunque ya no esté: "ya lo bajaste")
  const tengo = enDisco && l && enDisco.clave === claveDisco() ? enDisco.tengo : null;
  const antes = tengo ? enDisco.bajados : new Map();
  $('enDisco').hidden = !tengo;
  if (tengo) {
    const total = l.items.filter(i => Number.isFinite(i.numero)).length;
    const otra = enDisco.carpetas.filter(n => n !== $('serie').value.trim());
    const falta = enDisco.cuantosFaltan ? ` Te faltan: ${enDisco.faltan}.` : '';
    $('enDiscoTexto').textContent = (!tengo.size && !antes.size ? `De ${$('serie').value.trim()} todavía no tenés ninguno de estos ${total}.`
      : !antes.size ? (enDisco.cuantosFaltan ? `Ya tenés ${tengo.size} de ${total}.${falta}` : `Ya tenés los ${total}.`)
      : `Ya tenés ${tengo.size} de ${total} en la carpeta, y ${antes.size === 1 ? 'otro ya lo bajaste antes (no está ahí)' : `otros ${antes.size} ya los bajaste antes (no están ahí)`}.${falta || ' No te falta ninguno.'}`) +
      (otra.length ? ` (Los encontré en «${otra.join('», «')}».)` : '');
    $('marcarFaltan').hidden = !enDisco.cuantosFaltan || (!tengo.size && !antes.size);
  }
  // En una lista de títulos: de cuáles ya tenés algo
  const tuyos = marcas && l && marcas.clave === claveTitulos() ? marcas.por : null;

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
    // Al entrar a un título, su nombre se propone como serie
    const abrir = (e) => { e.preventDefault(); ir(i.url, ruta.length, false, l.tipo === 'titulos' ? i.texto : ''); };
    entrar.addEventListener('click', abrir);
    let tapa = null;
    if (mosaico) {
      // La tapa. En una lista de títulos, tocarla entra a ese título (la casilla queda para tildar)
      tapa = el('img', { className: 'tapa', alt: '' });
      ponerMiniatura(tapa, i.imagen);
      if (l.tipo === 'titulos') tapa.addEventListener('click', abrir);
    }
    const ya = !!tengo && tengo.has(i.numero), fecha = antes.get(i.numero), tuyo = tuyos?.get(i.url);
    const marca = ya ? el('span', { className: 'esta', textContent: '✔ ya está', title: 'Ya está en la carpeta o en tu colección' })
      : fecha ? el('span', { className: 'esta antes', textContent: '✔ ya lo bajaste', title: `Lo bajaste el ${fecha}. Ya no está en la carpeta.` })
      : tuyo ? el('span', { className: 'esta', textContent: tuyo.bajados ? `✔ ${plural(tuyo.bajados, 'bajado', 'bajados')}` : '✔ en tu colección',
          title: [tuyo.bajados ? `Ya bajaste ${plural(tuyo.bajados, 'capítulo', 'capítulos')} de este título` : '', tuyo.carpeta ? `Está en «${tuyo.carpeta}»` : ''].filter(Boolean).join('. ') })
      : null;
    filas.push(el('label', { className: 'fila' + (ya || fecha || tuyo ? ' ya' : ''), title: mosaico ? i.texto : i.url }, caja, tapa,
      i.numero !== undefined && i.numero !== null ? el('span', { className: 'num', textContent: String(i.numero) }) : null,
      el('span', { className: 'txt', textContent: i.texto }), marca, entrar));
  }
  $('lista').replaceChildren(...filas);
  refrescar();
  pedirTapas($('lista'), actual?.url || '');
}

// ── Miniaturas ──
// Una imagen de la lista (una tapa, o una página al revisar un capítulo). Si ya se tiene la
// miniatura se pone; si no, queda anotada y se pide cuando quede a la vista (y un poco más
// allá): un catálogo puede tener cientos.
function ponerMiniatura(img, direccion) {
  const lista = miniaturas.get(direccion);
  if (typeof lista === 'string' && lista) img.src = lista;
  else if (direccion && lista !== '') img.dataset.tapa = direccion;
}
function pedirTapas(caja, pagina) {
  const marco = caja.getBoundingClientRect();
  for (const img of caja.querySelectorAll('img[data-tapa]')) {
    const r = img.getBoundingClientRect();
    if (r.bottom < marco.top - 400 || r.top > marco.bottom + 400) continue;
    const de = img.dataset.tapa;
    delete img.dataset.tapa;
    let pedido = miniaturas.get(de);
    if (pedido === undefined) miniaturas.set(de, pedido = mr.tapa(de, pagina).catch(() => '').then((d) => { miniaturas.set(de, d); return d; }));
    Promise.resolve(pedido).then((d) => { if (d) img.src = d; });
  }
}
let avisoTapas = 0;
function alMoverLista() {
  clearTimeout(avisoTapas);
  avisoTapas = setTimeout(() => {
    pedirTapas($('lista'), actual?.url || '');
    if (revision) pedirTapas($('revLista'), revision.url);
  }, 120);
}

function refrescar() {
  const l = listaActual();
  const n = l ? l.items.filter(i => marcados.has(i.url)).length : 0;
  $('cuenta').textContent = l ? `${plural(l.items.length, 'renglón', 'renglones')} · ${plural(n, 'marcado', 'marcados')}` : '';
  const hayFormato = $('fPdf').checked || $('fCbz').checked || $('fImgs').checked;
  $('descargar').disabled = !n || !hayFormato;
  $('descargar').textContent = n ? `Descargar ${plural(n, 'capítulo', 'capítulos')}` : 'Descargar';
  $('capBajar').disabled = !hayFormato;
  $('revBajar').disabled = !hayFormato || !revision || !revision.elegidas.size;
}

// ── Lo que ya está en la carpeta ──
// De la lista de capítulos a la vista, cuáles ya se bajaron. Hace falta saber la serie (la del
// cuadro "Serie"): se mira su carpeta, con cualquier nombre de archivo que tengan adentro.
const claveDisco = () => `${listaId}|${$('serie').value.trim().toLowerCase()}|${$('fPdf').checked}${$('fCbz').checked}${$('fImgs').checked}|${$('carpeta').textContent}`;
let avisoDisco = 0;
function mirarDisco(pausa = 0) {
  clearTimeout(avisoDisco);
  avisoDisco = setTimeout(async () => {
    const l = listaActual(), serie = $('serie').value.trim(), clave = claveDisco();
    const numeros = l && l.tipo === 'capitulos' ? l.items.map(i => i.numero).filter(Number.isFinite) : [];
    if (!serie || !numeros.length) { if (enDisco) { enDisco = null; dibujar(); } return; }
    try {
      const r = await mr.disco({ serie, numeros, formatos: opciones().formatos });
      if (clave !== claveDisco()) return;            // mientras tanto cambió la lista o la serie
      enDisco = { clave, tengo: new Set(r.tengo), bajados: new Map(r.bajados.map(b => [b.numero, b.fecha])), faltan: r.faltan, cuantosFaltan: r.cuantosFaltan, carpetas: r.carpetas };
      dibujar();
    } catch {}
  }, pausa);
  mirarTitulos();
}

// En una lista de títulos (un catálogo), de cuáles ya tenés algo: capítulos que bajaste con
// el programa (el registro) o una carpeta con ese nombre en tu colección.
let marcas = null;          // { clave, por: Map(dirección → { bajados, carpeta }) }
const claveTitulos = () => { const l = listaActual(); return `${listaId}|${l ? l.items.length : 0}|${$('carpeta').textContent}`; };
async function mirarTitulos(deNuevo = false) {
  const l = listaActual(), clave = claveTitulos();
  if (!l || l.tipo !== 'titulos' || (!deNuevo && marcas && marcas.clave === clave)) return;
  try {
    const r = await mr.titulos({ nombres: l.items.map(i => i.texto) });
    if (clave !== claveTitulos()) return;
    marcas = { clave, por: new Map(l.items.map((i, k) => [i.url, r[k]]).filter(([, m]) => m)) };
    if (marcas.por.size) dibujar();
  } catch {}
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

// ── Revisar las páginas de un capítulo ──
// Muestra todas las imágenes que encontró en el capítulo, con lo que el filtro dejaría afuera
// por publicidad ya destildado y dicho por qué. Un toque sobre una imagen la saca o la pone:
// así se rescata una página que tomó por aviso y se saca un aviso que no detectó.
async function revisarPaginas() {
  if (ocupado || !actual?.capitulo) return;
  ocupado = true;
  $('capRevisar').disabled = true;
  estado('Buscando las páginas del capítulo…', 'trabajando');
  try {
    const url = actual.url, r = await mr.paginas(url);
    if (!r.paginas.length) throw new Error('No encontré imágenes en esta página');
    revision = { url, info: r, paginas: r.paginas, elegidas: new Set(r.paginas.filter(p => !p.motivo).map(p => p.url)) };
    $('explorador').classList.add('revisando');
    dibujarRevision();
    estado('Estas son todas las imágenes del capítulo. Las apagadas no se guardan: tocá una para cambiarla.', 'bien');
  } catch (e) {
    estado('⚠️ ' + e.message, 'error');
  } finally {
    ocupado = false;
    $('capRevisar').disabled = false;
  }
}
function dibujarRevision() {
  $('revision').hidden = !revision;
  if (!revision) return;
  const { paginas, elegidas } = revision;
  const avisos = paginas.filter(p => p.motivo).length;
  $('revCuenta').textContent = `${elegidas.size} de ${plural(paginas.length, 'imagen', 'imágenes')}` + (avisos ? ` · ${plural(avisos, 'tomada por publicidad', 'tomadas por publicidad')}` : '');
  let pagina = 0;
  $('revLista').replaceChildren(...paginas.map((p) => {
    const va = elegidas.has(p.url);
    const img = el('img', { alt: '' });
    ponerMiniatura(img, p.url);
    const b = el('button', { type: 'button', className: 'pag' + (va ? ' va' : ''), title: (p.motivo ? `El filtro la tomó por publicidad: ${p.motivo}. ` : '') + (va ? 'Tocá para sacarla.' : 'Tocá para ponerla.') },
      img, el('span', { className: 'pag-n', textContent: va ? String(++pagina) : '✕' }),
      p.motivo ? el('span', { className: 'pag-m', textContent: p.motivo }) : null);
    b.addEventListener('click', () => { va ? elegidas.delete(p.url) : elegidas.add(p.url); dibujarRevision(); });
    return b;
  }));
  $('revBajar').textContent = `Descargar ${plural(elegidas.size, 'página', 'páginas')}`;
  refrescar();
  pedirTapas($('revLista'), revision.url);
}
function cerrarRevision() {
  revision = null;
  $('explorador').classList.remove('revisando');
  $('revision').hidden = true;
}
async function bajarRevision() {
  if (!revision || !revision.elegidas.size) return;
  const { url, info, paginas, elegidas } = revision;
  await encolar([{ url, texto: info.nombre, numero: info.capitulo?.numero ?? null, paginas: paginas.filter(p => elegidas.has(p.url)).map(p => p.url),
    info: { capitulo: info.capitulo, nombre: info.nombre, clave: info.clave, titulo: info.titulo, faltantes: info.faltantes } }]);
  cerrarRevision();
}

// ── Cola ──
const ACTIVOS = new Set(['abriendo', 'buscando páginas', 'bajando']);
const SIN_TERMINAR = new Set(['falló', 'incompleto', 'cancelado']);
const ICONO = { 'en cola': '⏸', abriendo: '⏳', 'buscando páginas': '⏳', bajando: '⏳', listo: '✅', 'ya estaba': '✔', incompleto: '⚠️', 'falló': '⚠️', cancelado: '✖' };
function dibujarCola() {
  const activas = tareas.filter(t => t.estado === 'en cola' || ACTIVOS.has(t.estado)).length;
  const aReintentar = tareas.filter(t => SIN_TERMINAR.has(t.estado)).length;
  $('colaCuenta').textContent = tareas.length ? `${tareas.length - activas} de ${tareas.length}` : '';
  $('cancelar').disabled = !activas;
  $('limpiar').disabled = tareas.length === activas;
  $('reintentar').disabled = !aReintentar;
  $('reintentar').textContent = aReintentar ? `Reintentar ${plural(aReintentar, 'que falló', 'que fallaron')}` : 'Reintentar lo que falló';
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
    cerrarRevision();
    proponerSerie('');                             // los links pueden ser de otra serie: la puesta sola se va
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

// ── Direcciones recientes ──
// Las últimas que se analizaron a mano: se ofrecen al escribir en el cuadro de arriba y, antes
// de analizar nada, en una lista para tocar.
function mostrarRecientes(lista) {
  recientes = Array.isArray(lista) ? lista : [];
  $('recientes').replaceChildren(...recientes.map(r => el('option', { value: r.url, label: r.titulo || '' })));
  $('inicioLista').replaceChildren(...recientes.map(r => {
    const b = el('button', { type: 'button', className: 'reciente', title: r.url },
      el('span', { className: 'g-nombre', textContent: r.titulo || sinProtocolo(r.url) }), el('span', { className: 'g-datos', textContent: sinProtocolo(r.url) }));
    b.addEventListener('click', () => { $('url').value = r.url; ir(r.url, 0, true, '', true); });
    return b;
  }));
  $('inicio').hidden = !!actual || !recientes.length;
}

// ── Favoritos ──
// Tu lista de direcciones (sitios, catálogos, series). Se cargan pegando un link o muchos en el
// cuadro del panel, y tocar uno lo analiza como si lo pegaras arriba.
let guardados = [];
let quitarTodosArmado = 0;        // "Quitar todos" pide un segundo toque: este es el temporizador que lo desarma
const sinProtocolo = (u) => String(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
function avisoGuardados(texto, clase = '') {
  $('guardadosMsg').textContent = texto;
  $('guardadosMsg').className = 'tenue' + (clase ? ' ' + clase : '');
}
function dibujarGuardados() {
  // Filtros: texto, tipo (manga o cómics) e idioma. Los tres se suman.
  const q = $('guardadosFiltro').value.trim().toLowerCase(), tipo = $('guardadosTipo').value, idioma = $('guardadosIdioma').value;
  const ver = guardados.filter(s => (!q || `${s.nombre} ${s.url} ${s.descripcion || ''} ${s.resumen || ''}`.toLowerCase().includes(q)) &&
    (!tipo || (tipo === 'manga' ? s.manga : s.comics)) &&
    (!idioma || (idioma === 'otro' ? !(s.idiomas || []).length : (s.idiomas || []).includes(idioma))));
  const filtrando = !!(q || tipo || idioma);
  $('verGuardados').textContent = guardados.length ? `⭐ Favoritos (${guardados.length})` : '⭐ Favoritos';
  $('guardadosCuenta').textContent = filtrando ? `${ver.length} de ${guardados.length}` : plural(guardados.length, 'favorito', 'favoritos');
  $('guardadosBarra').hidden = !guardados.length;
  $('guardadosLista').replaceChildren(...(ver.length ? ver.map(s => {
    const abrir = el('button', { type: 'button', className: 'g-abrir', title: `Analizar ${s.url}` },
      el('span', { className: 'g-nombre', textContent: s.nombre }),
      el('span', { className: 'g-datos', textContent: sinProtocolo(s.url) + (s.descripcion ? ' · ' + s.descripcion : '') }),
      s.resumen ? el('span', { className: 'g-tipo', textContent: s.resumen }) : null);
    abrir.addEventListener('click', () => { $('guardados').hidden = true; $('url').value = s.url; ir(s.url, 0, true); });
    const quitar = el('button', { type: 'button', className: 'g-quitar', textContent: '✕', title: 'Quitar de favoritos' });
    quitar.addEventListener('click', async () => { guardados = await mr.quitarLinks([s.url]); dibujarGuardados(); });
    return el('div', { className: 'guardado' }, abrir, quitar);
  }) : [el('div', { className: 'vacio', textContent: guardados.length ? 'Ninguno coincide con lo que buscás.'
    : 'Todavía no tenés favoritos. Pegá un link o muchos en el cuadro de arriba y quedan guardados.' })]));
}
// Guarda la dirección del cuadro de arriba, con el título de la página si ya se analizó
async function guardarActual() {
  let url = $('url').value.trim();
  if (!url) return avisoGuardados('Escribí o pegá una dirección en el cuadro de arriba.', 'error');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  const nombre = actual && actual.url === url ? (actual.titulo || '') : '';
  try {
    const r = await mr.guardarLinks({ sitio: { nombre, url } });
    guardados = r.lista;
    dibujarGuardados();
    avisoGuardados(r.agregados ? 'Guardada en favoritos.' : 'Esa dirección ya estaba en tus favoritos.', r.agregados ? 'bien' : '');
  } catch (e) {
    avisoGuardados('⚠️ ' + e.message, 'error');
  }
}
// Guarda en favoritos los links del cuadro: uno o muchos, escritos como vengan. Si se pudo
// guardar alguno (o ya estaban todos), el cuadro queda vacío para pegar otra tanda.
async function agregarLista() {
  if (!$('listaLinks').value.trim()) return avisoGuardados('Pegá un link o muchos en el cuadro.', 'error');
  try {
    const r = await mr.guardarLinks({ texto: $('listaLinks').value });
    guardados = r.lista;
    $('listaLinks').value = '';
    $('guardadosFiltro').value = $('guardadosTipo').value = $('guardadosIdioma').value = '';
    dibujarGuardados();
    avisoGuardados((r.agregados ? `Guardé ${plural(r.agregados, 'link', 'links')} en favoritos.` : 'No guardé ninguno.') +
      (r.repetidos ? ` ${plural(r.repetidos, 'ya estaba o venía repetido', 'ya estaban o venían repetidos')}.` : ''), r.agregados ? 'bien' : '');
  } catch (e) {
    avisoGuardados('⚠️ ' + e.message, 'error');           // el texto queda en el cuadro, para corregirlo
  }
}
function quitarTodos() {
  clearTimeout(quitarTodosArmado);
  if ($('quitarTodos').dataset.armado) {
    delete $('quitarTodos').dataset.armado;
    $('quitarTodos').textContent = 'Quitar todos';
    mr.quitarLinks('todos').then((l) => {
      guardados = l;
      $('guardadosFiltro').value = $('guardadosTipo').value = $('guardadosIdioma').value = '';
      dibujarGuardados();
      avisoGuardados('Quité todos los favoritos.');
    });
    return;
  }
  $('quitarTodos').dataset.armado = '1';
  $('quitarTodos').textContent = `¿Quitar los ${guardados.length}? Tocá de nuevo`;
  quitarTodosArmado = setTimeout(() => { delete $('quitarTodos').dataset.armado; $('quitarTodos').textContent = 'Quitar todos'; }, 4000);
}

// ── Historial ──
// El registro de lo que se bajó con el programa, por serie. Sigue ahí aunque muevas o borres
// los archivos: sirve para acordarse de qué ya se bajó cuando se lo vuelve a encontrar.
let historial = [];
function dibujarHistorial() {
  const q = $('historialFiltro').value.trim().toLowerCase();
  const ver = historial.filter(s => !q || s.serie.toLowerCase().includes(q));
  const total = historial.reduce((n, s) => n + s.cuantos, 0);
  $('verHistorial').textContent = historial.length ? `🗂 Historial (${historial.length})` : '🗂 Historial';
  $('historialCuenta').textContent = !historial.length ? '' : q ? `${ver.length} de ${plural(historial.length, 'serie', 'series')}`
    : `${plural(historial.length, 'serie', 'series')} · ${plural(total, 'capítulo', 'capítulos')}`;
  $('historialLista').replaceChildren(...(ver.length ? ver.map(s => {
    const datos = plural(s.cuantos, 'capítulo', 'capítulos') + (s.desde === null ? '' : s.desde === s.hasta ? ` · el ${s.desde}` : ` · del ${s.desde} al ${s.hasta}`) +
      (s.faltan ? ` · en el medio faltan: ${s.faltan}` : '') + ` · el último, el ${s.ultima}`;
    const quitar = el('button', { type: 'button', className: 'g-quitar', textContent: '✕', title: 'Quitar esta serie del registro (no borra ningún archivo)' });
    quitar.addEventListener('click', async () => { historial = await mr.quitarDelRegistro(s.clave); dibujarHistorial(); mirarDisco(); mirarTitulos(true); });
    return el('div', { className: 'guardado' },
      el('div', { className: 'g-abrir' }, el('span', { className: 'g-nombre', textContent: s.serie }), el('span', { className: 'g-datos', textContent: datos })), quitar);
  }) : [el('div', { className: 'vacio', textContent: historial.length ? 'Ninguna serie coincide con lo que buscás.'
    : 'Todavía no bajaste nada con el programa. Lo que bajes queda anotado acá.' })]));
}
async function cargarHistorial() {
  try { historial = await mr.registro(); } catch { historial = []; }
  dibujarHistorial();
}

// ── Tu colección ──
// Otras carpetas donde mirar lo que ya tenés, además de la de descargas: donde guardás tus
// mangas, cómics o libros (por ejemplo, la carpeta de Google Drive de tu máquina).
function dibujarBibliotecas(lista) {
  $('bibliotecas').replaceChildren(...(lista || []).map(c => {
    const quitar = el('button', { type: 'button', className: 'g-quitar', textContent: '✕', title: 'Dejar de mirar esta carpeta (no borra nada)' });
    quitar.addEventListener('click', async () => { dibujarBibliotecas(await mr.quitarBiblioteca(c)); mirarDisco(); mirarTitulos(true); });
    return el('div', { className: 'biblioteca' }, el('span', { textContent: c, title: c }), quitar);
  }));
}
// ── Nombres y sagas ──
// La plantilla se guarda al escribirla, y debajo se ve cómo quedaría un capítulo bajado desde
// una lista (con su tomo y su nombre) y uno suelto.
let avisoPlantilla = 0;
async function verPlantilla(guardar) {
  const texto = $('plantilla').value.trim();
  try {
    const v = await mr.vistaPlantilla(texto);
    if (guardar) await mr.guardarConfig({ plantilla: texto === v.predeterminada ? '' : texto });
    $('plantillaVista').replaceChildren(
      el('div', {}, el('span', { className: 'tenue', textContent: 'De una lista: ' }), v.lista + '.pdf'),
      el('div', {}, el('span', { className: 'tenue', textContent: 'Suelto: ' }), v.suelto + '.pdf'));
    $('plantillaAviso').textContent = [
      v.choca ? '⚠️ Sin {numero} ni {titulo}, todos los capítulos de una serie se llamarían igual.' : '',
      v.raros.length ? `⚠️ No conozco ${v.raros.join(', ')}: va a quedar escrito tal cual en el nombre.` : '',
    ].filter(Boolean).join('\n');
  } catch {}
}
async function guardarSagas() {
  const texto = $('sagas').value;
  try {
    const r = await mr.revisarSagas(texto);
    await mr.guardarConfig({ sagasTexto: texto });
    $('sagasMsg').textContent = (r.series ? `Guardadas: ${plural(r.series, 'serie', 'series')}.` : 'Sin sagas propias.') +
      (r.errores.length ? ` No entendí: ${r.errores.slice(0, 3).join(' · ')}` : '');
    $('sagasMsg').className = 'tenue ' + (r.errores.length ? 'error' : 'bien');
  } catch (e) {
    $('sagasMsg').textContent = '⚠️ ' + e.message;
    $('sagasMsg').className = 'tenue error';
  }
}

// ── Eventos ──
$('buscar').addEventListener('submit', (e) => {
  e.preventDefault();
  let url = $('url').value.trim();
  if (!url) return;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;          // "sitio.com/serie" → "https://sitio.com/serie"
  ir(url, 0, true, '', true);
});
$('verPegar').addEventListener('click', () => { $('pegar').hidden = !$('pegar').hidden; $('guardados').hidden = $('historial').hidden = true; if (!$('pegar').hidden) $('links').focus(); });
$('usarLinks').addEventListener('click', usarLinks);
$('verGuardados').addEventListener('click', () => {
  $('guardados').hidden = !$('guardados').hidden;
  $('pegar').hidden = $('historial').hidden = true;
  avisoGuardados('');
  if (!$('guardados').hidden) $('listaLinks').focus();          // listo para pegar con Ctrl+V
});
$('verHistorial').addEventListener('click', () => {
  $('historial').hidden = !$('historial').hidden;
  $('pegar').hidden = $('guardados').hidden = true;
  if (!$('historial').hidden) { cargarHistorial(); $('historialFiltro').focus(); }
});
$('historialFiltro').addEventListener('input', dibujarHistorial);
$('agregarBiblioteca').addEventListener('click', async () => { dibujarBibliotecas(await mr.agregarBiblioteca()); mirarDisco(); mirarTitulos(true); });
$('guardarActual').addEventListener('click', guardarActual);
$('agregarLista').addEventListener('click', agregarLista);
// Pegar en el cuadro guarda directamente (cuando el texto pegado ya está en el cuadro)
$('listaLinks').addEventListener('paste', () => setTimeout(agregarLista, 0));
$('listaLinks').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); agregarLista(); } });
$('guardadosFiltro').addEventListener('input', dibujarGuardados);
$('guardadosTipo').addEventListener('change', dibujarGuardados);
$('guardadosIdioma').addEventListener('change', dibujarGuardados);
$('quitarTodos').addEventListener('click', quitarTodos);
$('filtro').addEventListener('input', dibujar);
$('verTapas').addEventListener('click', () => { verTapas = !verTapas; mr.guardarConfig({ tapas: verTapas }); dibujar(); });
$('lista').addEventListener('scroll', alMoverLista);
$('revLista').addEventListener('scroll', alMoverLista);
addEventListener('resize', alMoverLista);
$('todos').addEventListener('click', () => { for (const i of visibles()) marcados.add(i.url); dibujar(); });
$('ninguno').addEventListener('click', () => { for (const i of visibles()) marcados.delete(i.url); dibujar(); });
$('marcarFaltan').addEventListener('click', () => {
  const l = listaActual();
  if (!l || !enDisco) return;
  marcados = new Set(l.items.filter(i => Number.isFinite(i.numero) && !enDisco.tengo.has(i.numero) && !enDisco.bajados.has(i.numero)).map(i => i.url));
  dibujar();
});
$('siguiente').addEventListener('click', traerMas);
$('todasLasPaginas').addEventListener('click', traerTodas);
$('descargar').addEventListener('click', () => {
  const l = listaActual();
  // El tomo y el nombre de cada capítulo en la lista van con él: los usa la plantilla de nombres
  if (l) encolar(l.items.filter(i => marcados.has(i.url)).map(i => ({ url: i.url, texto: i.texto, numero: i.numero,
    volumen: i.seccion || '', titulo: l.tipo === 'capitulos' ? i.texto : '' })));
});
$('capBajar').addEventListener('click', () => { if (actual?.capitulo) encolar([{ url: actual.url, texto: actual.capitulo.nombre }]); });
$('capRevisar').addEventListener('click', revisarPaginas);
$('revTodas').addEventListener('click', () => { if (revision) { revision.elegidas = new Set(revision.paginas.map(p => p.url)); dibujarRevision(); } });
$('revNinguna').addEventListener('click', () => { if (revision) { revision.elegidas = new Set(); dibujarRevision(); } });
$('revDetectadas').addEventListener('click', () => { if (revision) { revision.elegidas = new Set(revision.paginas.filter(p => !p.motivo).map(p => p.url)); dibujarRevision(); } });
$('revCerrar').addEventListener('click', () => { cerrarRevision(); estado('Esta página es un capítulo.'); });
$('revBajar').addEventListener('click', bajarRevision);
$('cancelar').addEventListener('click', () => mr.cancelar());
$('reintentar').addEventListener('click', () => mr.reintentar());
$('limpiar').addEventListener('click', () => mr.limpiar());
$('abrirCarpeta').addEventListener('click', () => mr.abrirCarpeta());
$('cambiarCarpeta').addEventListener('click', async () => { mostrarCarpeta(await mr.elegirCarpeta()); mirarDisco(); });
for (const id of ['fPdf', 'fCbz', 'fImgs', 'saltear']) {
  $(id).addEventListener('change', () => { refrescar(); mr.guardarConfig({ formatos: opciones().formatos, saltear: $('saltear').checked }); mirarDisco(); });
}
$('serie').addEventListener('input', () => { marcarSerie(); mirarDisco(400); });
$('plantilla').addEventListener('input', () => { clearTimeout(avisoPlantilla); avisoPlantilla = setTimeout(() => verPlantilla(true), 300); });
for (const b of $('plantillas').querySelectorAll('button')) {
  b.addEventListener('click', () => { $('plantilla').value = b.dataset.tpl; verPlantilla(true); });
}
$('guardarSagas').addEventListener('click', guardarSagas);

function mostrarCarpeta(c) { $('carpeta').textContent = c; $('carpeta').title = c; }
let terminadas = 0;
mr.alCambiarCola((cola) => {
  tareas = cola;
  dibujarCola();
  // Cuando termina un capítulo, se vuelve a mirar qué hay en la carpeta
  const n = cola.filter(t => t.estado === 'listo' || t.estado === 'incompleto').length;
  if (n !== terminadas) { terminadas = n; mirarDisco(300); mirarTitulos(true); cargarHistorial(); }
});
mr.alAvanzar((texto) => { if (ocupado && !trayendoTodas) estado(texto, 'trabajando'); });
mr.config().then((c) => {
  $('fPdf').checked = c.formatos.pdf; $('fCbz').checked = c.formatos.cbz; $('fImgs').checked = c.formatos.imgs;
  $('saltear').checked = c.saltear !== false;
  verTapas = c.tapas !== false;
  $('plantilla').value = c.plantilla || '';
  $('sagas').value = c.sagasTexto || '';
  mostrarCarpeta(c.carpeta);
  mostrarRecientes(c.recientes);
  dibujarBibliotecas(c.bibliotecas);
  verPlantilla(false);
  if (actual) dibujar(); else refrescar();
});
mr.guardados().then((l) => { guardados = l; dibujarGuardados(); });
cargarHistorial();
$('url').focus();
