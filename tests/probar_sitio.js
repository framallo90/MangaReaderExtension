// Prueba la extensión contra un sitio real: abre la página, dice qué detecta y, si se le
// pasa un rango, baja esos capítulos como PDF con "Descargar varios capítulos".
// Todo va a una carpeta temporal que se borra al terminar: no deja nada en Descargas.
//
// Uso: node tests/probar_sitio.js "<dirección>" [desde] [hasta]
//   node tests/probar_sitio.js "https://sitio.com/manga/serie/12"          → solo informa
//   node tests/probar_sitio.js "https://sitio.com/manga/serie/12" 12 13    → además baja el 12 y el 13
//   node tests/probar_sitio.js "https://sitio.com/manga/serie/12" guardar  → baja el capítulo abierto
//                                                                            con el diálogo de guardar
// Variables:
//   CON_VENTANA=1    ventana minimizada en vez de sin interfaz (pestañas en segundo plano como en
//                    el Chrome de todos los días)
//   PAUSA=0 CONCURRENCIA=8   ritmo del lote (segundos entre capítulos, imágenes medidas a la vez)
//   ESPERA=20        segundos que espera a que el sitio arme la página antes de mirar (6 si no se dice)
//   ADAPTADOR='{"sitio":"sitio.com","contenedor":"#comic"}'   un adaptador para ese sitio, como
//                    si se hubiera guardado en opciones (contenedor, imagenes, ignorar, patron)
// El lector puede estar en un iframe: se dice qué marcos hay, cuántas páginas cuenta la extensión
// en cada uno y en cuál se abrió el diálogo de guardar.
// Qué navegador hace falta: ver tests/navegador.js.
const fs = require('fs'), path = require('path');
const { lanzar, lote, pdfPages, sleep, root, ultimaVersion } = require('./navegador');

const [url, desde, hasta] = process.argv.slice(2);
if (!/^https?:\/\//.test(url || '')) { console.log('Uso: node tests/probar_sitio.js "<dirección>" [desde] [hasta | guardar]'); process.exit(1); }
const EXT = path.join(root, ultimaVersion(), 'manga-reader-ext');
const GUARDAR = desde === 'guardar';

function walk(dir, base = dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, base, out); else out.push(path.relative(base, p));
  }
  return out;
}

// Lo que devuelve `cuerpo` (el texto de una función) en cada marco de la pestaña: la página
// primero y después sus iframes, aunque sean de otro sitio. Corre en el mundo de la extensión.
const enMarcos = (b, dir, cuerpo) => b.ext.eval(`(async () => {
  const tab = (await chrome.tabs.query({})).find(t => t.url === ${JSON.stringify(dir)});
  if (!tab) return [];
  const r = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: ${cuerpo} });
  return r.sort((x, y) => x.frameId - y.frameId).map(x => ({ id: x.frameId, ...(x.result || {}) })); })()`);
const UI = `(document.querySelector('#mr-host')?.shadowRoot || document)`;
// Qué hay en un marco: su dirección, imágenes grandes, lo que cuenta la extensión y su diálogo de guardar
const MARCO = `() => { const ui = ${UI}, n = ui.querySelector('#mr-save-next');
  return { url: location.href, grandes: [...document.images].filter(i => i.naturalWidth >= 250 && i.naturalHeight >= 250).length,
    cuenta: typeof window.__mangaReaderCuenta === 'function' ? window.__mangaReaderCuenta() : -1,
    iframes: document.querySelectorAll('iframe').length,
    dialogo: !!ui.querySelector('#mr-save-name'), nombre: ui.querySelector('#mr-save-name')?.value || '',
    conteo: ui.querySelector('#mr-save-count')?.textContent || '', siguiente: n ? !n.hidden : false,
    estado: ui.querySelector('#mr-save-status')?.textContent || '', clase: ui.querySelector('#mr-save-status')?.className || '' }; }`;
const cual = (m) => (m.id ? `el iframe ${m.url}` : 'la página');

function archivos(b) {
  const base = path.join(b.dl, 'MangaReader');
  const files = fs.existsSync(base) ? walk(base) : [];
  console.log('\nArchivos (en la carpeta temporal, ya se borran):');
  for (const f of files) {
    const full = path.join(base, f);
    console.log(`  MangaReader/${f.replace(/\\/g, '/')} · ${Math.round(fs.statSync(full).size / 1024)} KB` + (f.endsWith('.pdf') ? ` · ${pdfPages(full)}` : ''));
  }
  if (!files.length) console.log('  ninguno');
  return files.length;
}

(async () => {
  const b = await lanzar(EXT);
  if (!b) { console.log('No encontré un Chromium que acepte --load-extension (ver tests/navegador.js).'); return; }
  let code = 0;
  try {
    console.log(`Fecha: ${new Date().toISOString()} · extensión ${path.basename(path.dirname(EXT))}`);
    if (process.env.ADAPTADOR) {
      const { sitio, ...a } = JSON.parse(process.env.ADAPTADOR);
      await b.setStorage({ adaptadores: { [sitio]: { contenedor: '', imagenes: '', ignorar: [], patron: '', ...a } } });
      console.log(`Adaptador: ${sitio} → ${JSON.stringify(a)}`);
    }
    const pg = await b.cdp.open(url);
    await pg.waitFor(`document.readyState === 'complete'`, 'la página', 45000);
    await sleep((+process.env.ESPERA || 6) * 1000);       // tiempo para que el sitio arme la página (ESPERA=20: 20 s)
    const here = await pg.eval('location.href');
    console.log('Página:   ' + here);
    console.log('Título:   ' + await pg.eval('document.title'));
    console.log('Burbuja:  ' + (await pg.eval(`!!document.querySelector('#mr-fab')`) ? 'aparece en la página' : 'no aparece en la página'));
    console.log('Imágenes: ' + await pg.eval(`(() => { const d = {}; for (const i of document.images) { if (i.naturalWidth >= 250 && i.naturalHeight >= 250) { const k = new URL(i.currentSrc || i.src, location.href).pathname.replace(/[^/]*$/, ''); d[k] = (d[k] || 0) + 1; } } return Object.entries(d).map(([k, n]) => n + ' en ' + k).join(' · ') || 'ninguna grande'; })()`));
    console.log('Links a otras páginas del sitio que terminan en número: ' + await pg.eval(`[...document.querySelectorAll('a[href]')].filter(a => a.origin === location.origin && /\\d\\/?$/.test(a.pathname)).length`));
    console.log('Desplegables: ' + await pg.eval(`[...document.querySelectorAll('select')].map(s => s.options.length + ' opciones (valores como: ' + [...s.options].filter(o => o.value).slice(0, 3).map(o => JSON.stringify(o.value)).join(', ') + ')').join(' · ') || 'ninguno'`));
    const marcos = await enMarcos(b, here, MARCO);
    console.log(`Marcos:   ${marcos.length} (` + marcos.map(m => `${m.id ? 'iframe ' + m.url : 'página'}: ${m.grandes} imágenes grandes, la extensión cuenta ${m.cuenta}`).join(' · ') + ')');

    await b.command(here, 'save');
    let dlg = null;
    for (const fin = Date.now() + 60000; Date.now() < fin; await sleep(500)) {
      dlg = (await enMarcos(b, here, MARCO)).find(m => m.dialogo) || null;
      if (dlg && dlg.conteo && !/Recorriendo|Buscando/.test(dlg.conteo)) break;
    }
    if (!dlg) throw new Error('el diálogo de guardar no se abrió en ningún marco');
    console.log(`\nDiálogo "Guardar capítulo" (se abrió en ${cual(dlg)}):`);
    console.log('  Nombre: ' + dlg.nombre);
    console.log('  ' + (dlg.conteo || '(no terminó de buscar)'));
    console.log('  Guardar y siguiente: ' + (dlg.siguiente ? 'sí' : 'no'));

    if (GUARDAR) {
      const t0 = Date.now();
      const clics = await enMarcos(b, here, `() => { const g = ${UI}.querySelector('#mr-save-go'); if (g && !g.disabled) { g.click(); return { clic: true }; } return { clic: false, apagado: !!g }; }`);
      if (!clics.some(c => c.clic)) {
        // Sin nada tildado el botón está apagado: no hay qué guardar (y eso también es un resultado)
        console.log(`\nGuardar: ${clics.some(c => c.apagado) ? 'el botón está apagado (no hay páginas tildadas): no se guarda nada' : 'no encontré el botón'}`);
        archivos(b);
      } else {
        let fin = null;
        for (const tope = Date.now() + 600000; Date.now() < tope && !fin; await sleep(500)) {
          fin = (await enMarcos(b, here, MARCO)).find(m => m.dialogo && /success|error/.test(m.clase)) || null;
        }
        console.log(`\nGuardar (${Math.round((Date.now() - t0) / 1000)} s):`);
        console.log(fin ? fin.estado.split('\n').map(l => '  ' + l).join('\n') : '  (no terminó en 10 minutos)');
        await sleep(1500);
        if (!archivos(b) || !fin || !/success/.test(fin.clase)) code = 1;
      }
    }

    await b.command(here, 'batch');
    await pg.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo de varios capítulos');
    console.log('\nDiálogo "Descargar varios capítulos":');
    console.log('  Dirección de los capítulos: ' + await pg.eval(`document.querySelector('#mr-chapter-tpl').value`) +
      (await pg.eval(`document.querySelector('#mr-chapter-more').open`) ? '   (supuesta: conviene revisarla)' : ''));
    console.log('  ' + await pg.eval(`document.querySelector('#mr-chapter-count').textContent`));
    const why = await pg.eval(`(() => { const w = document.querySelector('#mr-chapter-why'); return w && !w.hidden ? w.textContent : ''; })()`);
    if (why) console.log('  ' + why);
    console.log('  Rango sugerido: del ' + await pg.eval(`document.querySelector('#mr-chapter-from').value`) + ' al ' + await pg.eval(`document.querySelector('#mr-chapter-to').value`));

    if (desde && !GUARDAR) {
      const ritmo = {};
      if (process.env.PAUSA) ritmo.pausa = +process.env.PAUSA;
      if (process.env.CONCURRENCIA) ritmo.concurrencia = +process.env.CONCURRENCIA;
      if (Object.keys(ritmo).length) { await b.setStorage({ ritmo }); console.log(`  Ritmo: ${JSON.stringify(ritmo)}`); }
      await pg.eval(`document.querySelector('#mr-chapter-none').click()`);
      await lote.rango(pg, desde, hasta || desde);
      console.log('\n' + await pg.eval(`document.querySelector('#mr-chapter-go').textContent`) + '…');
      const t0 = Date.now();
      await pg.eval(`document.querySelector('#mr-chapter-go').click()`);
      // Mientras corre se anota cada vez que el sitio pidió esperar (la cuenta regresiva del lote)
      const pausas = [];
      let fin = '';
      for (const tope = Date.now() + 1800000; Date.now() < tope && !fin; await sleep(400)) {
        const t = await pg.eval(`document.querySelector('#mr-chapter-status')?.textContent || ''`).catch(() => '');
        const m = t.match(/^(\(\d+\/\d+\) Capítulo [\d.]+): el sitio pidió esperar, sigo en (\d+) s/);
        if (m) {
          const ultima = pausas[pausas.length - 1];
          // una cuenta nueva: otro capítulo, o el número volvió a subir
          if (!ultima || ultima.cap !== m[1] || +m[2] > ultima.n) pausas.push({ cap: m[1], desde: +m[2], n: +m[2], en: Math.round((Date.now() - t0) / 1000) });
          else ultima.n = +m[2];
        }
        if (/^(✅ )?(Listo|Cancelado|Parado)/.test(t)) fin = t;
      }
      console.log(fin ? fin.split('\n').map(l => '  ' + l).join('\n') : '  (no terminó en 30 minutos)');
      console.log('  Filas: ' + (await lote.filas(pg)).split(' | ').filter(f => /\[/.test(f)).join(' | '));
      console.log(`  Tardó ${Math.round((Date.now() - t0) / 1000)} s`);
      console.log('  El sitio pidió esperar: ' + (pausas.length ? pausas.map(p => `${p.cap}, cuenta desde ${p.desde} s, a los ${p.en} s del arranque`).join(' · ') : 'nunca'));
      const espera = await b.storage('esperaSitio');
      if (espera) console.log('  Frenos anotados (esperaSitio): ' + Object.entries(espera).map(([s, t]) => `${s} hasta ${new Date(t).toISOString()}`).join(' · '));
      if (!archivos(b)) code = 1;
      if (!/^✅/.test(fin)) code = 1;
    }
  } catch (e) {
    console.log('Se cortó: ' + e.message);
    code = 1;
  }
  await b.cerrar();
  process.exit(code);
})();
