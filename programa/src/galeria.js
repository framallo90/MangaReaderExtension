// La galería de un sitio (0.11.0): todos los títulos de su listado, con la tapa de cada uno,
// juntados recorriendo las páginas del listado. No explora nada por su cuenta: cada página se
// analiza con lo mismo que usa Analizar (el pedido `explorar` del explorador), y de una página a
// la otra se pasa por la paginación que esa exploración ya lee (`siguiente`). Acá solo está el
// recorrido: por dónde empezar, cuándo parar, qué se guarda y qué se dice.
//
// main.js le pasa lo que necesita (abrir una página, la pausa, el freno, lo que ya tenés, la cola):
// así se lee y se prueba aparte, y la exploración queda como estaba.
const fs = require('fs');

const TOPE_DEFECTO = 60;          // páginas del listado por corrida, si no se dice otra cosa
const TOPE_MAX = 5000;        // hasta dónde se puede subir (un catálogo grande son miles de páginas)
// Cuántas páginas se abren, como mucho, buscando el listado. Con 5 no alcanzaba en un sitio real
// (25-11-2026, one-piece-fans2.com): del capítulo a la portada son 5 (/manga/es/todos/1104 → … → /),
// y el link al listado ("Biblioteca") recién está en la portada.
const PASOS_PARA_SUBIR = 8;
const SIN_NUEVOS_PARA_CORTAR = 2; // páginas seguidas sin ningún título nuevo: se terminó (o da vueltas)
const GUARDAR_CADA = 5;           // cada cuántas páginas se guarda en el disco lo juntado (un catálogo grande son horas)
const GUARDAR_TRAS = 1500;        // (0.11.2) las marcas se guardan juntas: una sola escritura, pasado este rato desde la última marca

// La dirección de un título, para no repetirlo: sin la barra final y sin el #
function claveDe(url) {
  try { const u = new URL(url); return u.origin + u.pathname.replace(/\/+$/, '') + u.search; } catch { return String(url || ''); }
}
const sitioDeUrl = (url) => { try { return new URL(url).origin; } catch { return ''; } };
const esPortada = (url) => { try { return /^\/*$/.test(new URL(url).pathname); } catch { return false; } };
// La página de arriba en la dirección: /manga/serie/cap-5 → /manga/serie/ → /manga/ → /
function padreDe(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.search) { u.search = ''; return u.href; }                 // primero, la misma sin la consulta
    const segs = u.pathname.split('/').filter(Boolean);
    if (!segs.length) return '';
    segs.pop();
    u.pathname = '/' + segs.join('/') + (segs.length ? '/' : '');
    return u.href;
  } catch { return ''; }
}

// El tipo y el idioma de un título, si su tarjeta los dice con todas las letras ("Manhwa · Español").
// No se deducen de otra cosa: si la tarjeta no lo dice quedan vacíos, y si ninguna lo dice el filtro
// no se ofrece. Las siglas sueltas ("ES", "EN") no cuentan: "EN EMISIÓN" no es inglés.
const TIPOS = [['Manhwa', /\bmanhwas?\b/i], ['Manhua', /\bmanhuas?\b/i], ['Manga', /\bmangas?\b/i], ['Novela', /\b(?:novelas?|novels?)\b/i],
  ['Cómic', /\bc[oó]mics?\b/i], ['Doujinshi', /\bdoujin(?:shi)?s?\b/i], ['One shot', /\bone[\s-]?shots?\b/i], ['Webtoon', /\bwebtoons?\b/i]];
const IDIOMAS = [['Español', /\b(?:espa[ñn]ol|castellano|spanish)\b/i], ['Inglés', /\b(?:ingl[eé]s|english)\b/i], ['Japonés', /\b(?:japon[eé]s|japanese)\b/i],
  ['Portugués', /\b(?:portugu[eé]s|portuguese)\b/i], ['Francés', /\b(?:franc[eé]s|french)\b/i], ['Italiano', /\b(?:italiano|italian)\b/i],
  ['Coreano', /\b(?:coreano|korean)\b/i], ['Chino', /\b(?:chino|chinese)\b/i]];
const primeroQue = (tabla, texto) => (tabla.find(([, re]) => re.test(texto)) || [''])[0];
const tipoDe = (detalle) => primeroQue(TIPOS, String(detalle || ''));
const idiomaDe = (detalle) => primeroQue(IDIOMAS, String(detalle || ''));

// Qué es una página, para la galería, según lo que devolvió la exploración:
//   'capitulo'  un capítulo abierto
//   'serie'     la página de una serie (su primera lista es de capítulos)
//   'listado'   un listado de títulos (tiene una lista de títulos y ninguna de capítulos adelante)
//   ''          ninguna de las tres
// La lista de títulos de una página es la primera que la exploración da como tal: la misma que la
// interfaz toma por la principal de cada página.
const principalDe = (r) => ((r && r.listas) || []).find(l => l.tipo === 'titulos') || null;
function queEs(r) {
  if (!r) return '';
  if (r.capitulo) return 'capitulo';
  if (r.listas && r.listas[0] && r.listas[0].tipo === 'capitulos') return 'serie';
  return principalDe(r) ? 'listado' : '';
}

// d: lo que pone main.js
//   archivo()                 dónde se guardan las galerías · PRUEBA: en las pruebas no se lee ni se escribe
//   guardarTras               (solo para probar) cuánto se espera para guardar las marcas, si no es GUARDAR_TRAS
//   abrirPagina(url, alCrear), pedir(win, pedido, args, ms)   las páginas, como las abre Analizar
//   espera(ms), pausa         la pausa entre una página y la siguiente (la de la cola)
//   falta(url) → ms           cuánto le falta al freno de ese sitio · frenar(url, esperar): anotarlo
//   revisarTitulos, novedadesDe, encolar   lo que ya tenés, lo nuevo de una serie y la cola de siempre
//   avisar(evento)            el avance, para la interfaz
function crearGalerias(d) {
  let galerias = {};              // sitio (origen) → galería
  let corrida = null;             // la que está en curso: { sitio, cancelada, win, avance }
  let buscando = false;           // se está buscando lo nuevo de las marcadas
  const novedades = new Map();    // clave del título → lo nuevo que se le encontró (no se guarda en el disco)

  function leer() {
    if (d.PRUEBA) return;
    try { const g = JSON.parse(fs.readFileSync(d.archivo(), 'utf8')); if (g && typeof g === 'object' && !Array.isArray(g)) galerias = g; } catch {}
    // Una que quedó "recorriendo" es de una vez que el programa se cerró en el medio: tiene lo que se
    // había guardado hasta ahí, y se puede seguir desde esa página
    for (const g of Object.values(galerias)) if (g.estado === 'recorriendo') { g.estado = 'incompleta'; g.motivo = 'el programa se cerró en medio del recorrido'; }
  }
  let porGuardar = null;          // { sitio, reloj }: hay marcas de ese sitio que todavía no se escribieron en el disco
  // Escribe el archivo entero (todas las galerías): con eso queda guardado también lo que estuviera esperando
  function escribir() {
    if (porGuardar) { clearTimeout(porGuardar.reloj); porGuardar = null; }
    if (d.PRUEBA) return;
    try { fs.writeFileSync(d.archivo(), JSON.stringify(galerias)); } catch {}
  }
  // Las marcas no se escriben de a una (0.11.2): el archivo es la galería entera de cada sitio (10,8 MB
  // con 33.000 títulos), y marcar cinco series de a una eran 54 MB de escritura. Se escribe una sola
  // vez, pasado GUARDAR_TRAS desde la última marca. Y antes, cuando esperar puede perder algo: al
  // cerrar el programa (alSalir), al empezar un recorrido y al pasar a otro sitio (guardarLoPendiente).
  function escribirLuego(sitio) {
    if (d.PRUEBA) return;
    if (porGuardar) clearTimeout(porGuardar.reloj);
    porGuardar = { sitio, reloj: setTimeout(escribir, d.guardarTras ?? GUARDAR_TRAS) };
  }
  // Escribe ya lo que esté esperando. Con `salvoDe`, solo si es de otro sitio (se cambió de sitio)
  function guardarLoPendiente(salvoDe = '') { if (porGuardar && porGuardar.sitio !== salvoDe) escribir(); }
  const deSitio = (url) => galerias[sitioDeUrl(url)] || null;
  const guardada = (sitio) => { const g = galerias[sitio]; if (!g) throw new Error('No hay una galería guardada de ese sitio'); return g; };

  // La galería como la ve la interfaz: con lo que ya tenés de cada título y lo nuevo que se le encontró
  function publicos(titulos) {
    const mios = d.revisarTitulos({ nombres: titulos.map(t => t.nombre) });
    return titulos.map((t, k) => ({ ...t, tengo: mios[k] || null, nuevo: novedades.get(claveDe(t.url)) || null }));
  }
  function publica(g) {
    if (!g) return null;
    return { sitio: g.sitio, inicio: g.inicio, fecha: g.fecha, paginas: g.paginas, estado: g.estado, motivo: g.motivo || '', sePuedeSeguir: !!g.siguiente,
      recorriendo: !!corrida && corrida.sitio === g.sitio, titulos: publicos(g.titulos) };
  }
  // Solo lo que ya tenés de cada título (para ponerlo al día cuando termina de bajar un capítulo, sin
  // mandar la galería entera): [[dirección, marca]] de los que tienen alguna
  function marcas(sitio) {
    guardarLoPendiente(sitio);
    const g = guardada(sitio);
    const mios = d.revisarTitulos({ nombres: g.titulos.map(t => t.nombre) });
    return g.titulos.map((t, k) => [t.url, mios[k] || null]).filter(([, m]) => m);
  }

  const cancelada = () => Object.assign(new Error('Cancelada'), { cancelada: true });
  // ¿Son tarjetas con tapa? Como las ve la exploración: tres o más, y la mayoría con su imagen
  const deTarjetas = (items) => items.length >= 3 && items.filter(i => i.imagen).length >= items.length * 0.6;
  // Los títulos que la exploración da en una página: los de las listas de títulos que ya se venían
  // juntando (`ids`) o, si en esta página no hay ninguna de esas (la primera, o una donde todo va a
  // otra carpeta), los de su lista de títulos principal. Sin repetir.
  function deLaExploracion(r, ids, conTapas) {
    const titulos = ((r && r.listas) || []).filter(l => l.tipo === 'titulos');
    let listas = ids.length ? titulos.filter(l => ids.includes(l.id)) : [];
    if (!listas.length) {
      const p = principalDe(r);
      // (en una página que no es la primera, la principal vale solo en un listado de tarjetas con tapa y
      // si también lo es: una página que quedó sin títulos no puede sumar los links del menú)
      if (p && (!ids.length || (conTapas && deTarjetas(p.items)))) listas = [p];
    }
    const vistos = new Set(), items = [];
    for (const l of listas) for (const i of l.items) { const k = claveDe(i.url); if (!vistos.has(k)) { vistos.add(k); items.push(i); } }
    return { items, ids: listas.map(l => l.id) };
  }
  // Abre una página y la analiza con la exploración de siempre. Antes espera el freno del sitio; si la
  // página pide esperar (429 o 503), el sitio queda frenado y el error lo lleva (`esperar`).
  // `familia`: lo que ya se sabe del listado ({ ids: las listas que se vienen juntando, conTapas }).
  // A lo que devuelve la exploración se le suma, para la galería: `base` (sus títulos), `tarjetas`
  // (todas las de la grilla, también las que van a otra carpeta) y `numeradas`.
  async function analizar(url, c, familia = { ids: [], conTapas: null }) {
    for (let falta; !c.cancelada && (falta = d.falta(url)) > 0;) {
      c.avance({ detalle: `el sitio pidió esperar: sigo en ${Math.ceil(falta / 1000)} s` });
      await d.espera(Math.min(falta, 1000));
    }
    if (c.cancelada) throw cancelada();
    let win = null;
    try {
      win = await d.abrirPagina(url, (w) => { c.win = w; });
      const r = await d.pedir(win, 'explorar', { conocidas: familia.ids }, 90000);
      // (para no dar por terminado un listado que sigue en páginas numeradas que la exploración no sigue)
      r.numeradas = await d.pedir(win, 'paginasNumeradas', {}, 8000).catch(() => null);
      const base = deLaExploracion(r, familia.ids, familia.conTapas);
      r.base = base.items;
      r.baseIds = base.ids;
      r.conTapas = familia.conTapas ?? deTarjetas(base.items);
      // Un catálogo que mezcla carpetas (/library/manga/… y /library/manhwa/…): la exploración arma una
      // lista por carpeta, y la galería quiere todas las tarjetas de la grilla (ver tarjetasDelListado)
      r.tarjetas = r.conTapas && base.items.length >= 2 ? await d.pedir(win, 'tarjetasDelListado', { urls: base.items.map(i => i.url) }, 15000).catch(() => null) : null;
      return r;
    } catch (e) {
      if (c.cancelada) throw cancelada();
      if (e.esperar) d.frenar(url, e.esperar);
      throw e;
    } finally {
      c.win = null;
      if (win && !win.isDestroyed()) win.destroy();
    }
  }

  // Desde la dirección pegada hasta el listado del sitio. Si es un listado, es esa; salvo la portada
  // de un sitio que tiene un link a su listado completo: ahí se entra, como hace Analizar. Si es un
  // capítulo o una serie, se sube: por el link al listado completo, si la página lo trae, y si no
  // por la dirección (capítulo → serie → listado). Devuelve { r, primera, pasos }: `r` es la primera
  // página del listado ya analizada (null si no se encontró ninguno) y `primera`, la que se pegó.
  async function resolver(url, c) {
    const vistas = new Set();
    let primera = null, pasos = 0;
    const abrir = async (u) => {
      vistas.add(claveDe(u));
      if (pasos) await d.espera(d.pausa);
      pasos++;
      c.avance({ detalle: 'buscando el listado del sitio…' });
      const r = await analizar(u, c);
      vistas.add(claveDe(r.url));
      if (!primera) primera = r;
      return r;
    };
    // (una página del medio que no abre —un 404 al subir— no corta la subida; cancelar o el freno, sí)
    const probar = (u) => abrir(u).catch((e) => { if (e.cancelada || e.esperar) throw e; return null; });
    let r = await abrir(url);
    for (;;) {
      if (queEs(r) === 'listado') {
        const completo = esPortada(r.url) && pasos < PASOS_PARA_SUBIR && (r.catalogos || []).find(k => !vistas.has(claveDe(k.url)));
        const r2 = completo ? await probar(completo.url) : null;
        return { r: queEs(r2) === 'listado' ? r2 : r, primera, pasos };
      }
      if (pasos >= PASOS_PARA_SUBIR) break;
      const catalogo = (r.catalogos || []).find(k => !vistas.has(claveDe(k.url)));
      let arriba = catalogo ? catalogo.url : padreDe(r.url);
      while (arriba && vistas.has(claveDe(arriba))) arriba = padreDe(arriba);
      if (!arriba) break;
      r = (await probar(arriba)) || { url: arriba, listas: [], catalogos: [] };
    }
    return { r: null, primera, pasos };
  }

  // Suma a la galería los títulos de una página, en el orden en que están: los que da la exploración
  // (`r.base`) y las demás tarjetas de la misma grilla (`r.tarjetas`), menos lo que la exploración
  // tomó por capítulos. Devuelve { nuevos, creados }: cuántos se vieron por primera vez en este
  // recorrido (un título que ya salió antes —un destacado que se repite en todas las páginas— no se
  // duplica ni cuenta) y los que no estaban en la galería.
  function sumar(g, r, porClave) {
    const base = r.base || [];
    if (g.conTapas === null || g.conTapas === undefined) g.conTapas = !!r.conTapas;        // lo decide la primera página
    const deLaBase = new Map(base.map(i => [claveDe(i.url), i]));
    const capitulos = new Set((r.listas || []).filter(l => l.tipo === 'capitulos').flatMap(l => l.items.map(i => claveDe(i.url))));
    const ids = new Set([...(g.listaIds || []), ...(r.baseIds || [])]);
    let items = base;
    if (Array.isArray(r.tarjetas)) {
      const puestos = new Set();
      items = [];
      for (const x of r.tarjetas) {
        const k = claveDe(x.url);
        if (puestos.has(k)) continue;
        if (deLaBase.has(k)) items.push(deLaBase.get(k));
        else if (x.extra && !capitulos.has(k)) { items.push({ url: x.url, texto: x.texto, detalle: x.detalle, imagen: x.imagen }); if (x.id) ids.add(x.id); }
        else continue;
        puestos.add(k);
      }
      for (const i of base) if (!puestos.has(claveDe(i.url))) items.push(i);          // (por si alguno de la lista no estaba entre los links)
    }
    // Las listas que se vienen juntando: con sus ids, la exploración las arma en la página que sigue aunque tengan un solo título
    g.listaIds = [...ids];
    let nuevos = 0;
    const creados = [];
    for (const i of items) {
      const k = claveDe(i.url);
      let t = porClave.get(k);
      if (!t) {
        t = { url: i.url, nombre: i.texto || i.url, detalle: '', imagen: '', pagina: r.url, tipo: '', idioma: '', alta: g.refresco, vista: '', desaparecida: '', marcada: false };
        g.titulos.push(t);
        porClave.set(k, t);
        creados.push(t);
      }
      if (t.vista === g.refresco) continue;          // ya salió en este recorrido
      nuevos++;
      t.vista = g.refresco;
      t.desaparecida = '';                            // si había desaparecido, volvió
      // Lo que la página dice ahora es lo que vale: el nombre, el detalle, la tapa y de qué página pedirla
      t.nombre = i.texto || t.nombre;
      t.detalle = i.detalle || '';
      t.tipo = tipoDe(t.detalle);
      t.idioma = idiomaDe(t.detalle);
      if (i.imagen) { t.imagen = i.imagen; t.pagina = r.url; }
    }
    return { nuevos, creados };
  }

  // El recorrido. `modo`: 'nueva' (desde la dirección pegada), 'refrescar' (de nuevo desde el
  // principio del listado guardado) o 'seguir' (desde donde quedó la corrida anterior).
  // Devuelve { galeria } o, si desde la dirección pegada no se llegó a ningún listado,
  // { galeria: null, sinListado, primera, paginasAbiertas } (o { cancelada }).
  async function recorrer({ url, tope, modo = 'nueva' } = {}) {
    if (corrida || buscando) throw new Error('Ya hay un recorrido o una búsqueda en curso');
    if (!/^https?:\/\//i.test(url || '')) throw new Error('La dirección tiene que empezar con http:// o https://');
    guardarLoPendiente();                           // (las marcas que estuvieran esperando: un recorrido puede durar horas)
    tope = Math.min(Math.max(1, Math.floor(+tope) || TOPE_DEFECTO), TOPE_MAX);
    const c = corrida = { sitio: sitioDeUrl(url), cancelada: false, win: null, avance: () => {} };
    let g = modo === 'nueva' ? null : deSitio(url);
    let deEstaCorrida = 0;                          // páginas del listado leídas en esta corrida (las que cuenta el tope)
    const avisar = (extra = {}) => d.avisar({ sitio: c.sitio, recorriendo: true, paginas: g ? g.paginas : 0, titulos: g ? g.titulos.length : 0, detalle: '', ...extra });
    c.avance = avisar;
    try {
      let r = null, siguiente = '';
      if (modo === 'nueva') {
        const res = await resolver(url, c);
        if (!res.r) return { galeria: null, sinListado: true, primera: res.primera, paginasAbiertas: res.pasos };
        r = res.r;
        c.sitio = sitioDeUrl(r.url);
        // (la dirección pegada llevó a un sitio del que ya hay una galería: no se pisa)
        if (galerias[c.sitio]) return { galeria: publica(galerias[c.sitio]), yaEstaba: true };
        const ahora = new Date().toISOString();
        // listaIds: las listas de la exploración que se vienen juntando · conTapas: si el listado es de tarjetas con tapa (lo dice su primera página)
        g = galerias[c.sitio] = { sitio: c.sitio, inicio: r.url, listaIds: [], conTapas: null, fecha: ahora, refresco: ahora, paginas: 0, estado: 'recorriendo', motivo: '', siguiente: '', titulos: [] };
      } else {
        if (!g) throw new Error('No hay una galería guardada de ese sitio');
        if (modo === 'refrescar' || !g.siguiente) {
          g.refresco = new Date().toISOString();
          g.paginas = 0;
          siguiente = g.inicio;
        } else siguiente = g.siguiente;
        g.estado = 'recorriendo';
        g.motivo = '';
      }
      const porClave = new Map(g.titulos.map(t => [claveDe(t.url), t]));
      const leidas = new Set();
      let sinNuevos = 0;
      const cerrar = (estado, motivo, sigue = '') => { g.estado = estado; g.motivo = motivo; g.siguiente = sigue; };
      for (;;) {
        if (!r) {
          if (deEstaCorrida >= tope) { cerrar('incompleta', `llegué al tope de ${tope} ${tope === 1 ? 'página' : 'páginas'} por corrida y el listado sigue`, siguiente); break; }
          if (deEstaCorrida) await d.espera(d.pausa);
          if (c.cancelada) { cerrar('incompleta', 'la cancelaste', siguiente); break; }
          avisar({ detalle: `leyendo la página ${g.paginas + 1} del listado…` });
          try { r = await analizar(siguiente, c, { ids: g.listaIds || [], conTapas: g.conTapas ?? null }); }
          catch (e) {
            if (e.cancelada) cerrar('incompleta', 'la cancelaste', siguiente);
            else if (e.esperar) cerrar('incompleta', `el sitio pidió esperar (HTTP ${e.esperar.status}) en la página ${g.paginas + 1} del listado`, siguiente);
            else cerrar('incompleta', `la página ${g.paginas + 1} del listado no abrió (${String(e.message || e)})`, siguiente);
            break;
          }
        }
        leidas.add(claveDe(r.url));
        if (siguiente) leidas.add(claveDe(siguiente));
        g.paginas++;
        deEstaCorrida++;
        const { nuevos, creados } = sumar(g, r, porClave);
        sinNuevos = nuevos ? 0 : sinNuevos + 1;
        // (a la ventana le van solo los títulos que sumó esta página: la galería entera puede tener miles)
        avisar({ inicio: g.inicio, nuevos: publicos(creados) });
        const sigue = r.siguiente && !leidas.has(claveDe(r.siguiente)) ? r.siguiente : '';
        const crecia = !!r.sigueCreciendo, numeradas = r.numeradas && r.numeradas.mas ? r.numeradas : null;
        r = null;
        if (c.cancelada) { cerrar('incompleta', 'la cancelaste', sigue); break; }
        if (sinNuevos >= SIN_NUEVOS_PARA_CORTAR) { cerrar('completa', 'paré porque dos páginas seguidas no traían ningún título nuevo'); break; }
        if (!sigue) {
          if (numeradas) cerrar('incompleta', `el listado sigue en páginas numeradas (por lo menos hasta la ${numeradas.mayor}), pero no tiene un enlace a la página siguiente que la exploración sepa seguir`);
          else if (crecia) cerrar('incompleta', 'la página seguía cargando más títulos al bajar cuando dejé de bajar: puede faltar el final');
          else cerrar('completa', '');
          break;
        }
        siguiente = sigue;
        // Un recorrido largo se va guardando, con la página por la que va: si el programa se cierra en el
        // medio, queda lo juntado y se puede seguir desde ahí
        g.siguiente = sigue;
        if (deEstaCorrida % GUARDAR_CADA === 0) escribir();
      }
      // Solo un recorrido que llegó al final sabe qué ya no está: lo que no apareció queda marcado, no se borra
      if (g.estado === 'completa') for (const t of g.titulos) if (t.vista !== g.refresco && !t.desaparecida) t.desaparecida = g.refresco;
      g.fecha = new Date().toISOString();
      escribir();
      return { galeria: publica(g) };
    } catch (e) {
      if (!g) { if (e.cancelada) return { galeria: null, cancelada: true }; throw e; }
      g.estado = 'incompleta';
      g.motivo = e.cancelada ? 'la cancelaste' : String(e.message || e);
      g.fecha = new Date().toISOString();
      escribir();
      return { galeria: publica(g) };
    } finally {
      corrida = null;
      d.avisar({ sitio: c.sitio, recorriendo: false });
    }
  }

  // Al cerrarse el programa: con un recorrido en curso, queda guardado lo juntado, como incompleta; y
  // sin recorrido, las marcas que todavía no se habían escrito
  function alSalir() {
    const g = corrida && galerias[corrida.sitio];
    if (!g || g.estado !== 'recorriendo') return guardarLoPendiente();
    g.estado = 'incompleta';
    g.motivo = 'el programa se cerró en medio del recorrido';
    g.fecha = new Date().toISOString();
    escribir();                                     // (el archivo entero: también las marcas que faltaban)
  }

  // Cancela el recorrido en curso: cierra la página que esté abierta y deja lo juntado
  function cancelar() {
    if (!corrida) return false;
    corrida.cancelada = true;
    if (corrida.win && !corrida.win.isDestroyed()) corrida.win.destroy();
    return true;
  }

  // Marca o desmarca series. Devuelve las direcciones de las que quedaron así, y la interfaz las cambia
  // en la galería que ya tiene: devolverla entera (con lo que ya tenés de cada título vuelto a mirar)
  // hacía tardar cada casilla 0,7 s en una galería de 33.000 títulos. Al disco no va enseguida: las
  // marcas se guardan juntas (escribirLuego)
  function marcar({ sitio, urls, marcada } = {}) {
    guardarLoPendiente(sitio);
    const g = guardada(sitio);
    const claves = new Set((Array.isArray(urls) ? urls : []).map(claveDe));
    const hechas = [];
    for (const t of g.titulos) if (claves.has(claveDe(t.url))) { t.marcada = !!marcada; hechas.push(t.url); }
    if (hechas.length) escribirLuego(g.sitio);
    return hechas;
  }

  // "Buscar lo nuevo" de las series marcadas: abre la página de cada una, de a una, con la pausa y el
  // freno de siempre, y anota qué capítulos hay que no tenés (los posteriores al último que tenés).
  async function buscarNuevo(sitio) {
    guardarLoPendiente(sitio);
    const g = guardada(sitio);
    if (buscando || corrida) throw new Error('Ya hay un recorrido o una búsqueda en curso');
    const marcadas = g.titulos.filter(t => t.marcada);
    if (!marcadas.length) throw new Error('Marcá primero las series de las que querés buscar lo nuevo');
    buscando = true;
    let corte = '';
    try {
      for (const [k, t] of marcadas.entries()) {
        for (let falta; (falta = d.falta(t.url)) > 0;) {
          d.avisar({ sitio, buscando: true, detalle: `el sitio pidió esperar: sigo en ${Math.ceil(falta / 1000)} s` });
          await d.espera(Math.min(falta, 1000));
        }
        if (k) await d.espera(d.pausa);
        d.avisar({ sitio, buscando: true, detalle: `buscando lo nuevo de ${t.nombre} (${k + 1} de ${marcadas.length})…` });
        const revisada = new Date().toISOString();
        try {
          const n = await d.novedadesDe({ url: t.url, serie: t.nombre });
          novedades.set(claveDe(t.url), { nuevos: n.nuevos, rango: n.rango, cuantos: n.cuantos, tengo: n.tengo, items: n.items, error: '', enCola: 0, revisada });
        } catch (e) {
          novedades.set(claveDe(t.url), { nuevos: 0, rango: '', cuantos: 0, tengo: 0, items: [], error: String(e.message || e), enCola: 0, revisada });
          if (e.esperar) { d.frenar(t.url, e.esperar); corte = `el sitio pidió esperar (HTTP ${e.esperar.status})`; break; }
        }
      }
    } finally {
      buscando = false;
      d.avisar({ sitio, buscando: false });
    }
    return { galeria: publica(g), corte };
  }
  // Pone en la cola lo nuevo de todas las marcadas, cada una con su serie: la cola y el freno de siempre
  function encolarNuevo(sitio) {
    guardarLoPendiente(sitio);
    const g = guardada(sitio);
    let encolados = 0, series = 0;
    for (const t of g.titulos) {
      const n = t.marcada ? novedades.get(claveDe(t.url)) : null;
      if (!n || !n.items.length) continue;
      d.encolar(n.items, { serie: t.nombre });
      encolados += n.items.length;
      series++;
      novedades.set(claveDe(t.url), { ...n, nuevos: 0, rango: '', items: [], enCola: n.items.length });
    }
    return { encolados, series, galeria: publica(g) };
  }

  function olvidar(sitio) {
    if (corrida && corrida.sitio === sitio) throw new Error('Esa galería se está recorriendo: cancelá primero');
    const g = galerias[sitio];
    if (g) for (const t of g.titulos) novedades.delete(claveDe(t.url));
    delete galerias[sitio];
    escribir();
    return true;
  }

  // La galería guardada del sitio de una dirección (al pedir la de otro sitio, se guarda lo que esperaba del anterior)
  function de(url) {
    guardarLoPendiente(sitioDeUrl(url));
    return publica(deSitio(url));
  }

  return { leer, alSalir, de, marcas, recorrer, cancelar, marcar, buscarNuevo, encolarNuevo, olvidar,
    enCurso: () => (corrida ? corrida.sitio : ''),
    // Las galerías guardadas, sin sus títulos (para decir cuáles hay)
    lista: () => Object.values(galerias).map(g => ({ sitio: g.sitio, inicio: g.inicio, fecha: g.fecha, titulos: g.titulos.length, estado: g.estado })) };
}

module.exports = { crearGalerias, claveDe, padreDe, queEs, tipoDe, idiomaDe, TOPE_DEFECTO, TOPE_MAX };
