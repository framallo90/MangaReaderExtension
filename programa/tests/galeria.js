// La galería del sitio, en Node (sin Electron): las reglas del recorrido (src/galeria.js) contra
// un sitio de mentira, con las páginas ya "exploradas". Cubre lo que las pruebas del programa no
// pueden: que la galería se guarde en el disco y se vuelva a leer (en las pruebas el programa no
// escribe nada), y que un refresco que no llegó al final no marque nada como desaparecido.
// Uso: node tests/galeria.js        (también lo corre "npm run prueba", al principio)
const fs = require('fs'), os = require('os'), path = require('path');
const { crearGalerias, claveDe, padreDe, queEs, tipoDe, idiomaDe } = require('../src/galeria.js');

// Un sitio de mentira: `paginas` son las del listado, con los nombres de sus títulos. Devuelve lo
// que la galería necesita para abrir una página (lo mismo que le da main.js), contando los pedidos.
function sitioDeMentira(paginas, { colgarEn = 0, S = 'https://sitio.example' } = {}) {
  const pedidos = [];
  const colgada = new Promise(() => {});          // (una página que no contesta nunca: el programa "se cierra" esperándola)
  const dir = (n) => `${S}/lista/${n > 1 ? '?p=' + n : ''}`;
  const explorar = (url) => {
    const n = +(new URL(url).searchParams.get('p') || 1);
    if (!paginas[n - 1]) throw new Error('La página respondió HTTP 404');
    return { url, titulo: 'Listado', capitulo: null, catalogos: [], sigueCreciendo: false, siguiente: paginas[n] ? dir(n + 1) : '',
      listas: [{ tipo: 'titulos', id: 'g:' + S + '/lista', nombre: '/lista',
        items: paginas[n - 1].map(nombre => ({ url: `${S}/lista/${nombre.toLowerCase()}/`, texto: nombre, detalle: 'Manga · Español', imagen: `${S}/t/${nombre.toLowerCase()}.png`, seccion: '' })) }] };
  };
  return { S, dir, pedidos, deps: {
    abrirPagina: async (url) => {
      pedidos.push(url.replace(S, ''));
      if (colgarEn && +(new URL(url).searchParams.get('p') || 1) === colgarEn) await colgada;
      return { url, isDestroyed: () => false, destroy() {} };
    },
    // (`tarjetasDelListado`, las demás tarjetas de la grilla, lo contesta la página de verdad: acá no hay ninguna)
    pedir: async (win, pedido) => (pedido === 'explorar' ? explorar(win.url) : pedido === 'paginasNumeradas' ? { actual: 1, mayor: 1, mas: false } : null),
    espera: async () => {}, pausa: 0, falta: () => 0, frenar: () => {},
    revisarTitulos: ({ nombres }) => nombres.map(() => null), novedadesDe: async () => ({ nuevos: 0, rango: '', cuantos: 0, tengo: 0, items: [] }), encolar: () => 0, avisar: () => {} } };
}

async function probarGaleria(eq) {
  eq('la dirección de un título, para no repetirlo: sin la barra final ni el #, con su consulta',
    [claveDe('https://a.example/serie/uno/'), claveDe('https://a.example/serie/uno#cap'), claveDe('https://a.example/ver?id=7')].join(' · '),
    'https://a.example/serie/uno · https://a.example/serie/uno · https://a.example/ver?id=7');
  eq('subir por la dirección: capítulo → serie → listado → portada (y primero, la misma sin la consulta)',
    (() => { const pasos = []; for (let u = 'https://a.example/manga/serie/cap-5?pagina=2'; u; u = padreDe(u)) pasos.push(u.replace('https://a.example', '')); return pasos.join(' → '); })(),
    '/manga/serie/cap-5?pagina=2 → /manga/serie/cap-5 → /manga/serie/ → /manga/ → /');
  eq('qué es una página: un capítulo, una serie (su primera lista es de capítulos), un listado (tiene títulos) o nada',
    [{ capitulo: { numero: 5 }, listas: [{ tipo: 'titulos' }] }, { capitulo: null, listas: [{ tipo: 'capitulos' }, { tipo: 'titulos' }] }, { capitulo: null, listas: [{ tipo: 'titulos' }, { tipo: 'filtros' }] },
     { capitulo: null, listas: [{ tipo: 'filtros' }] }, { capitulo: null, listas: [] }].map(r => queEs(r) || 'nada').join(' · '), 'capitulo · serie · listado · nada · nada');
  eq('el tipo y el idioma salen de lo que dice la tarjeta, con todas las letras: una sigla suelta no cuenta ("EN EMISIÓN" no es inglés)',
    ['Manhwa · Español', 'EN EMISIÓN · 120 caps', 'Novela ligera en inglés', 'Cómic', 'ES', ''].map(d => `${tipoDe(d) || '-'}/${idiomaDe(d) || '-'}`).join(' · '),
    'Manhwa/Español · -/- · Novela/Inglés · Cómic/- · -/- · -/-');

  // Se guarda en el disco y se vuelve a leer (acá sí se escribe: PRUEBA en false, con un archivo temporal)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-galeria-'));
  const archivo = path.join(tmp, 'galerias.json');
  try {
    const paginas = [['Ana', 'Bea'], ['Cora', 'Dana'], ['Eva']];
    const s = sitioDeMentira(paginas);
    const a = crearGalerias({ ...s.deps, PRUEBA: false, archivo: () => archivo });
    const r1 = await a.recorrer({ url: s.dir(1) });
    const marcadas = a.marcar({ sitio: s.S, urls: [`${s.S}/lista/bea`, `${s.S}/lista/no-esta/`], marcada: true });        // (sin la barra final: es la misma dirección)
    eq('marcar devuelve las direcciones de las series que quedaron marcadas (como están en la galería), no la galería entera', marcadas.join(', ').split(s.S).join(''), '/lista/bea/');
    a.alSalir();                                    // (se cierra el programa: desde la 0.11.2 las marcas se escriben un rato después, o al salir)
    const b = crearGalerias({ ...s.deps, PRUEBA: false, archivo: () => archivo });
    b.leer();
    const leida = b.de(s.S + '/cualquier/pagina');
    eq('la galería queda guardada en el disco, por sitio y con su fecha, y otra vez que se abre el programa se lee sin recorrer nada',
      `${r1.galeria.estado} · ${fs.existsSync(archivo) ? 'archivo escrito' : 'sin archivo'} · leída: ${leida.titulos.map(t => t.nombre + (t.marcada ? '*' : '')).join(', ')} · ${leida.paginas} páginas · fecha ${leida.fecha === r1.galeria.fecha ? 'igual' : 'distinta'} · pedidos: ${s.pedidos.length}`,
      'completa · archivo escrito · leída: Ana, Bea*, Cora, Dana, Eva · 3 páginas · fecha igual · pedidos: 3');
    eq('  cada título guarda su dirección, su tapa y la página del listado donde se vio (de ahí se pide la tapa)',
      (({ url, imagen, pagina, tipo, idioma }) => [url, imagen, pagina, tipo, idioma].join(' · ').split(s.S).join(''))(leida.titulos[2]), '/lista/cora/ · /t/cora.png · /lista/?p=2 · Manga · Español');

    // Un refresco: el sitio ya no muestra a Bea y sumó a Fina. Cortado por el tope, no dice que Bea desapareció
    paginas[0] = ['Ana'];
    paginas[2] = ['Eva', 'Fina'];
    const cortado = await b.recorrer({ url: s.dir(1), modo: 'refrescar', tope: 1 });
    eq('un refresco que se corta por el tope no marca nada como desaparecido: todavía no se sabe',
      `${cortado.galeria.estado} (${cortado.galeria.motivo}) · desaparecidas: ${cortado.galeria.titulos.filter(t => t.desaparecida).length} · se puede seguir: ${cortado.galeria.sePuedeSeguir}`,
      'incompleta (llegué al tope de 1 página por corrida y el listado sigue) · desaparecidas: 0 · se puede seguir: true');
    const entero = await b.recorrer({ url: s.dir(1), modo: 'seguir' });
    eq('  al seguir hasta el final, sí: lo que no apareció queda marcado y no se borra (ni pierde su marca), y lo nuevo se suma',
      `${entero.galeria.estado} · ${entero.galeria.titulos.map(t => t.nombre + (t.marcada ? '*' : '') + (t.desaparecida ? ' (desaparecida)' : '')).join(', ')} · ${entero.galeria.paginas} páginas`,
      'completa · Ana, Bea* (desaparecida), Cora, Dana, Eva, Fina · 3 páginas');
    paginas[0] = ['Ana', 'Bea'];
    const vuelve = await b.recorrer({ url: s.dir(1), modo: 'refrescar' });
    eq('  y si vuelve a aparecer en otro refresco, deja de estar desaparecida', vuelve.galeria.titulos.filter(t => t.desaparecida).length + ' · ' + vuelve.galeria.titulos.length, '0 · 6');
    eq('  un mismo título con la dirección escrita de dos formas (con y sin barra final) es uno solo',
      await (async () => { paginas[1] = ['Cora', 'Dana', 'Ana']; const r = await b.recorrer({ url: s.dir(1), modo: 'refrescar' }); return r.galeria.titulos.filter(t => t.nombre === 'Ana').length + ' · ' + r.galeria.titulos.length; })(), '1 · 6');
    b.olvidar(s.S);
    eq('  "Olvidar" la saca también del disco', `${b.de(s.S) ? 'sigue' : 'ya no está'} · ${fs.readFileSync(archivo, 'utf8')}`, 'ya no está · {}');

    // Una grilla que mezcla carpetas (el tipo va en la dirección): la exploración da una lista por
    // carpeta, y la página dice además qué otras tarjetas hay en la grilla (`tarjetasDelListado`)
    const M = 'https://mezcla.example', pasadas = [];
    const tarjeta = (carpeta, n) => ({ url: `${M}/lib/${carpeta}/${n}/`, texto: n, detalle: carpeta.toUpperCase(), imagen: `${M}/t/${n}.png`, seccion: '' });
    const suelta = (carpeta, n, id) => ({ url: `${M}/lib/${carpeta}/${n}/`, extra: true, texto: n, detalle: carpeta.toUpperCase(), imagen: `${M}/t/${n}.png`, id });
    const mezcla = crearGalerias({ ...s.deps, PRUEBA: true, archivo: () => archivo,
      abrirPagina: async (url) => ({ url, isDestroyed: () => false, destroy() {} }),
      pedir: async (win, pedido, args) => {
        const pagina = +(new URL(win.url).searchParams.get('p') || 1);
        if (pedido === 'explorar') {
          pasadas.push(args.conocidas.join(' '));
          return pagina === 1
            ? { url: win.url, capitulo: null, catalogos: [], siguiente: `${M}/lib/?p=2`, listas: [{ tipo: 'titulos', id: 'g:manhwa', items: [tarjeta('manhwa', 'a1'), tarjeta('manhwa', 'a2'), tarjeta('manhwa', 'a3')] },
                { tipo: 'capitulos', id: 'c:ver', items: [{ url: `${M}/lib/ver/9/`, texto: 'Capítulo 9' }] }] }
            : { url: win.url, capitulo: null, catalogos: [], siguiente: '', listas: [{ tipo: 'titulos', id: 'g:manga', items: [tarjeta('manga', 'b2'), tarjeta('manga', 'b3')] }] };
        }
        if (pedido !== 'tarjetasDelListado') return { mas: false };
        return pagina === 1
          ? [{ url: `${M}/lib/manhwa/a1/` }, suelta('manga', 'b1', 'g:manga'), { url: `${M}/lib/manhwa/a2/` }, suelta('ver', '9', 'g:ver'), { url: `${M}/lib/manhwa/a3/` }]
          : [{ url: `${M}/lib/manga/b2/` }, suelta('novela', 'n1', 'g:novela'), { url: `${M}/lib/manga/b3/` }];
      } });
    const mezclada = await mezcla.recorrer({ url: `${M}/lib/` });
    eq('una grilla que mezcla carpetas: a los títulos de la exploración se les suman las otras tarjetas, en el orden de la página (menos lo que la exploración tomó por capítulos), y las listas que se van conociendo se le pasan a la página siguiente',
      `${mezclada.galeria.titulos.map(t => `${t.nombre}:${t.tipo}`).join(' ')} · a la página 2 se le pasó: ${pasadas[1]}`,
      'a1:Manhwa b1:Manga a2:Manhwa a3:Manhwa b2:Manga n1:Novela b3:Manga · a la página 2 se le pasó: g:manhwa g:manga');

    // Un recorrido largo se va guardando: si el programa se cierra en el medio, queda lo juntado y se sigue desde ahí
    const largas = Array.from({ length: 9 }, (_, n) => [`N${n + 1}a`, `N${n + 1}b`]);        // 9 páginas de 2
    const esperar = async (que) => { for (let i = 0; i < 400 && !que(); i++) await new Promise(r => setTimeout(r, 5)); };
    const cuelga = sitioDeMentira(largas, { colgarEn: 8 });
    const c = crearGalerias({ ...cuelga.deps, PRUEBA: false, archivo: () => archivo });
    c.recorrer({ url: cuelga.dir(1) });                     // (no termina: la página 8 no contesta nunca)
    await esperar(() => cuelga.pedidos.length >= 8);
    const sano = sitioDeMentira(largas);
    const d1 = crearGalerias({ ...sano.deps, PRUEBA: false, archivo: () => archivo });
    d1.leer();
    const cortada = d1.de(sano.S);
    eq('un recorrido largo se va guardando cada 5 páginas: si el programa se cierra de golpe en la página 8, al abrirlo queda lo de las 5 primeras, como incompleta, y se puede seguir',
      `${cortada.estado} (${cortada.motivo}) · ${cortada.titulos.length} títulos · ${cortada.paginas} páginas · se puede seguir: ${cortada.sePuedeSeguir}`,
      'incompleta (el programa se cerró en medio del recorrido) · 10 títulos · 5 páginas · se puede seguir: true');
    const seguida = await d1.recorrer({ url: sano.dir(1), modo: 'seguir' });
    eq('  "Seguir desde donde quedó" retoma en la página 6 y llega al final, sin repetir títulos', `${seguida.galeria.estado} · ${seguida.galeria.titulos.length} títulos · ${seguida.galeria.paginas} páginas · pidió: ${sano.pedidos.join(' ')}`,
      'completa · 18 títulos · 9 páginas · pidió: /lista/?p=6 /lista/?p=7 /lista/?p=8 /lista/?p=9');
    // …y si el programa sale ordenado (se cierra la ventana), se guarda lo juntado hasta ese momento
    d1.olvidar(sano.S);
    const cuelga2 = sitioDeMentira(largas, { colgarEn: 8 });
    const e = crearGalerias({ ...cuelga2.deps, PRUEBA: false, archivo: () => archivo });
    e.recorrer({ url: cuelga2.dir(1) });
    await esperar(() => cuelga2.pedidos.length >= 8);
    e.alSalir();
    const f = crearGalerias({ ...sano.deps, PRUEBA: false, archivo: () => archivo });
    f.leer();
    eq('  si se cierra la ventana en medio del recorrido, se guarda lo juntado hasta ahí (las 7 páginas leídas)',
      (({ estado, motivo, titulos, paginas, sePuedeSeguir }) => `${estado} (${motivo}) · ${titulos.length} títulos · ${paginas} páginas · se puede seguir: ${sePuedeSeguir}`)(f.de(sano.S)),
      'incompleta (el programa se cerró en medio del recorrido) · 14 títulos · 7 páginas · se puede seguir: true');

    // (0.11.2) Las marcas se guardan juntas: una sola escritura, un rato después de la última. Se
    // cuentan las veces que se escribe el archivo de las galerías (no su tamaño): mientras dura esta
    // parte, cada fs.writeFileSync sobre ese archivo queda anotado.
    const escrituras = [], escribirDeVerdad = fs.writeFileSync;
    fs.writeFileSync = function (ruta, ...resto) { if (ruta === archivo) escrituras.push(Date.now()); return escribirDeVerdad.call(this, ruta, ...resto); };
    try {
      const pausa = (ms) => new Promise(r => setTimeout(r, ms));
      const M = 'https://marcas.example';
      const veinte = sitioDeMentira([Array.from({ length: 24 }, (_, k) => `S${k + 1}`)], { S: M });
      const deS = (k) => `${M}/lista/s${k}/`;
      const enElDisco = (sitio = M) => { try { return JSON.parse(fs.readFileSync(archivo, 'utf8'))[sitio].titulos.filter(t => t.marcada).map(t => t.nombre).join(',') || 'ninguna'; } catch { return 'sin archivo'; } };
      const m = crearGalerias({ ...veinte.deps, PRUEBA: false, archivo: () => archivo });
      await m.recorrer({ url: veinte.dir(1) });
      escrituras.length = 0;
      let ultima = 0;
      for (let k = 1; k <= 10; k++) { m.marcar({ sitio: M, urls: [deS(k)], marcada: true }); ultima = Date.now(); await pausa(40); }
      const mientras = `${escrituras.length} (en el disco: ${enElDisco()})`;
      for (const fin = Date.now() + 6000; Date.now() < fin && !escrituras.length;) await pausa(20);
      const tardo = escrituras[0] - ultima;
      await pausa(400);                                 // (por si viniera otra)
      eq('marcar diez series seguidas, de a una: mientras se marca no se escribe nada, y queda una sola escritura en el disco, un segundo y medio después de la última marca',
        `mientras se marcaba: ${mientras} · después: ${escrituras.length} · ${tardo >= 1400 && tardo < 3500 ? 'a 1,5 s de la última marca' : 'a los ' + tardo + ' ms'} · en el disco: ${enElDisco()}`,
        'mientras se marcaba: 0 (en el disco: ninguna) · después: 1 · a 1,5 s de la última marca · en el disco: S1,S2,S3,S4,S5,S6,S7,S8,S9,S10');
      // Cerrar el programa enseguida después de marcar: se escribe en ese momento, y no otra vez después
      escrituras.length = 0;
      for (let k = 11; k <= 20; k++) m.marcar({ sitio: M, urls: [deS(k)], marcada: true });
      const antesDeSalir = escrituras.length;
      m.alSalir();
      const alSalir = `${escrituras.length} (en el disco: ${enElDisco().split(',').length} marcadas)`;
      await pausa(1900);
      const otraVez = crearGalerias({ ...veinte.deps, PRUEBA: false, archivo: () => archivo });
      otraVez.leer();
      eq('  al cerrar el programa enseguida después de marcar otras diez, se escriben en ese momento (una escritura, y ninguna más después): al abrirlo de nuevo están las veinte',
        `antes de salir: ${antesDeSalir} · al salir: ${alSalir} · 1,9 s después: ${escrituras.length} · al abrir de nuevo: ${otraVez.de(M).titulos.filter(t => t.marcada).length} marcadas de ${otraVez.de(M).titulos.length}`,
        'antes de salir: 0 · al salir: 1 (en el disco: 20 marcadas) · 1,9 s después: 1 · al abrir de nuevo: 20 marcadas de 24');

      // Al empezar un recorrido: lo que esperaba se escribe antes de pedir la primera página
      // (guardarTras: 5 s, para que acá no se escriba solo; el refresco queda colgado en su primera página)
      let colgar = false;
      const n = crearGalerias({ ...veinte.deps, PRUEBA: false, archivo: () => archivo, guardarTras: 5000,
        abrirPagina: async (url) => { if (colgar) await new Promise(() => {}); return veinte.deps.abrirPagina(url); } });
      await n.recorrer({ url: veinte.dir(1) });
      escrituras.length = 0;
      n.marcar({ sitio: M, urls: [deS(3)], marcada: true });
      const antesDeRecorrer = `${escrituras.length} (en el disco: ${enElDisco()})`;
      colgar = true;
      const pedidosAntes = veinte.pedidos.length;
      n.recorrer({ url: veinte.dir(1), modo: 'refrescar' });             // (no termina)
      eq('  al empezar un recorrido se escribe lo que esperaba, antes de pedirle nada al sitio',
        `antes: ${antesDeRecorrer} · al empezar: ${escrituras.length} (en el disco: ${enElDisco()}) · páginas pedidas: ${veinte.pedidos.length - pedidosAntes}`,
        'antes: 0 (en el disco: ninguna) · al empezar: 1 (en el disco: S3) · páginas pedidas: 0');
      n.alSalir();

      // Al pasar a otro sitio: abrir la galería de otro, o marcar en otro, escribe lo que esperaba del anterior
      const A = sitioDeMentira([['Ana', 'Bea', 'Cora']], { S: 'https://uno.example' }), B = sitioDeMentira([['Dana', 'Eva', 'Fina']], { S: 'https://dos.example' });
      const deCual = (url) => (url.startsWith(A.S) ? A : B).deps;
      const p = crearGalerias({ ...A.deps, PRUEBA: false, archivo: () => archivo, guardarTras: 5000,
        abrirPagina: (url) => deCual(url).abrirPagina(url), pedir: (win, ...resto) => deCual(win.url).pedir(win, ...resto) });
      await p.recorrer({ url: A.dir(1) });
      await p.recorrer({ url: B.dir(1) });
      escrituras.length = 0;
      p.marcar({ sitio: A.S, urls: [`${A.S}/lista/bea/`], marcada: true });
      const pasos = [`marcar en uno: ${escrituras.length}`];
      p.de(A.S + '/lista/');
      pasos.push(`volver a abrir su galería: ${escrituras.length}`);
      p.de(B.S + '/lista/');
      pasos.push(`abrir la del otro sitio: ${escrituras.length} (en el disco: ${enElDisco(A.S)})`);
      p.marcar({ sitio: B.S, urls: [`${B.S}/lista/eva/`], marcada: true });
      pasos.push(`marcar en el otro: ${escrituras.length}`);
      p.marcar({ sitio: A.S, urls: [`${A.S}/lista/cora/`], marcada: true });
      pasos.push(`marcar de nuevo en el primero: ${escrituras.length} (en el disco: ${enElDisco(B.S)})`);
      p.alSalir();
      pasos.push(`al salir: ${escrituras.length} (en el disco: ${enElDisco(A.S)} y ${enElDisco(B.S)})`);
      eq('  al pasar a otro sitio (abrir su galería, o marcar en él) se escribe lo que esperaba del anterior', pasos.join(' · '),
        'marcar en uno: 0 · volver a abrir su galería: 0 · abrir la del otro sitio: 1 (en el disco: Bea) · marcar en el otro: 1 · marcar de nuevo en el primero: 2 (en el disco: Eva) · al salir: 3 (en el disco: Bea,Cora y Eva)');
    } finally {
      fs.writeFileSync = escribirDeVerdad;
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { probarGaleria };

if (require.main === module) {
  let fallas = 0;
  const eq = (etiqueta, obtenido, esperado) => {
    if (obtenido !== esperado) fallas++;
    console.log((obtenido === esperado ? 'OK   ' : 'FALLA') + ' ' + etiqueta + ' → ' + obtenido + (obtenido === esperado ? '' : '   (esperado: ' + esperado + ')'));
  };
  probarGaleria(eq).then(() => {
    console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK');
    process.exitCode = fallas ? 1 : 0;
  });
}
