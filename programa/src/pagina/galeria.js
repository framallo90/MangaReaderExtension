  // ── Para la galería del sitio (0.11.0) ───────────────
  // Corre en la página, junto con el explorador, y no le cambia nada: suma dos pedidos aparte.

  // Las tarjetas del listado, todas y en el orden de la página. La exploración agrupa los links por
  // la forma de su dirección: en un catálogo que mezcla /library/manga/… con /library/manhwa/… arma
  // una lista por tipo, y un tipo con uno o dos títulos en la página ni siquiera arma lista. Con una
  // sola de esas listas la galería traía una parte chica del catálogo (25-11-2026, zonatmo.org: 22 de
  // los 24 de la primera página y 17 de los 24 de la segunda, todos manhwas).
  // Se le pasan las direcciones de los títulos que la exploración ya dio (`urls`) y devuelve, en el
  // orden del documento, esos mismos y además los otros links con tapa del mismo bloque de la página
  // (el más de adentro que contiene a más de la mitad de ellos: la grilla). Cada link se lee con la
  // lectura de siempre (juntarLinks): el nombre, el detalle y la imagen son los que daría la
  // exploración. No entran los filtros (géneros, etiquetas), lo de otro sitio, lo que la exploración
  // ya descarta (la paginación) ni lo que no tiene tapa.
  // Devuelve [{ url }] para los que ya se tenían y [{ url, extra, texto, detalle, imagen, id }] para
  // los que suma (`id`: el de la lista donde la exploración los pondría); o null si los títulos no
  // están juntos en un bloque propio (repartidos por toda la página): ahí no se suma nada.
  comandos.tarjetasDelListado = ({ urls = [] } = {}) => {
    const clave = (u) => noSlash(String(u).split('#')[0]);
    const base = new Set(urls.map(clave));
    const porClave = new Map(juntarLinks().map(l => [clave(l.url), l]));
    const anclas = [];
    for (const a of document.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.getAttribute('href'), document.baseURI); } catch { continue; }
      anclas.push({ a, url: u.href.split('#')[0], k: clave(u.href), origen: u.origin });
    }
    // El bloque de la grilla, a partir de los títulos que ya se tienen (uno por dirección): el más de
    // adentro que contiene a más de la mitad. Es uno solo (dos bloques con más de la mitad cada uno
    // comparten algún título, así que uno está dentro del otro), y queda ajustado a la grilla aunque
    // la lista tenga además algunos títulos en otro lado (unos destacados, un costado).
    const suyas = [], yaTomada = new Set();
    for (const x of anclas) if (base.has(x.k) && !yaTomada.has(x.k)) { yaTomada.add(x.k); suyas.push(x.a); }
    if (suyas.length < 2) return null;
    const cuantos = new Map();
    for (const a of suyas) for (let e = a.parentElement; e && e !== document.documentElement; e = e.parentElement) cuantos.set(e, (cuantos.get(e) || 0) + 1);
    let caja = null;
    for (const [e, n] of cuantos) if (n > suyas.length / 2 && (!caja || caja.contains(e))) caja = e;
    if (!caja || caja === document.body) return null;
    const vistos = new Set(), salida = [];
    for (const { a, url, k, origen } of anclas) {
      if (vistos.has(k)) continue;
      if (base.has(k)) { vistos.add(k); salida.push({ url }); continue; }
      const l = porClave.get(k);
      if (!l || !l.imagen || l.filtro || origen !== location.origin || !caja.contains(a)) continue;
      vistos.add(k);
      salida.push({ url, extra: true, texto: nombreDe(l), detalle: l.detalle || '', imagen: l.imagen, id: 'g:' + l.carpeta });
    }
    return salida;
  };

  // ¿La página tiene links a otras páginas de este mismo listado, con un número más alto que la que
  // se está viendo? La galería avanza por el enlace a la página siguiente que la exploración ya lee
  // (siguientePagina). Si el listado se pagina con números sueltos y nada marca cuál es la siguiente,
  // no los sigue: no se agrega una regla de paginación. Pero tiene que poder decirlo, en vez de dar
  // el listado por terminado. Un link de paginación se reconoce como ya lo reconoce la exploración
  // para sacarlo de las listas: el parámetro page / pagina / pag / p, o /page/N en la dirección.
  comandos.paginasNumeradas = () => {
    const PARAM = /^(?:page|pagina|pag|p)$/i, TRAMO = /\/(?:page|pagina|pag|p)\/(\d+)\/?$/i;
    const numeroDe = (u) => {
      for (const [k, v] of u.searchParams) if (PARAM.test(k) && /^\d+$/.test(v)) return +v;
      const m = u.pathname.match(TRAMO);
      return m ? +m[1] : null;
    };
    const baseDe = (u) => u.origin + u.pathname.replace(TRAMO, '').replace(/\/+$/, '');
    const aca = new URL(location.href), actual = numeroDe(aca) ?? 1;
    let mayor = actual;
    for (const a of document.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.getAttribute('href'), document.baseURI); } catch { continue; }
      const n = numeroDe(u);
      if (n === null || baseDe(u) !== baseDe(aca)) continue;       // de este mismo listado
      if (n > mayor) mayor = n;
    }
    return { actual, mayor, mas: mayor > actual };
  };
