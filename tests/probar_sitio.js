// Prueba la extensión contra un sitio real: abre la página, dice qué detecta y, si se le
// pasa un rango, baja esos capítulos como PDF con "Descargar varios capítulos".
// Todo va a una carpeta temporal que se borra al terminar: no deja nada en Descargas.
//
// Uso: node tests/probar_sitio.js "<dirección>" [desde] [hasta]
//   node tests/probar_sitio.js "https://sitio.com/manga/serie/12"          → solo informa
//   node tests/probar_sitio.js "https://sitio.com/manga/serie/12" 12 13    → además baja el 12 y el 13
// Qué navegador hace falta: ver tests/navegador.js.
const fs = require('fs'), path = require('path');
const { lanzar, lote, pdfPages, sleep, root, ultimaVersion } = require('./navegador');

const [url, desde, hasta] = process.argv.slice(2);
if (!/^https?:\/\//.test(url || '')) { console.log('Uso: node tests/probar_sitio.js "<dirección>" [desde] [hasta]'); process.exit(1); }
const EXT = path.join(root, ultimaVersion(), 'manga-reader-ext');

function walk(dir, base = dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, base, out); else out.push(path.relative(base, p));
  }
  return out;
}

(async () => {
  const b = await lanzar(EXT);
  if (!b) { console.log('No encontré un Chromium que acepte --load-extension (ver tests/navegador.js).'); return; }
  let code = 0;
  try {
    const pg = await b.cdp.open(url);
    await pg.waitFor(`document.readyState === 'complete'`, 'la página', 45000);
    await sleep(6000);                                    // tiempo para que el sitio arme la página
    const here = await pg.eval('location.href');
    console.log('Página:   ' + here);
    console.log('Título:   ' + await pg.eval('document.title'));
    console.log('Burbuja:  ' + (await pg.eval(`!!document.querySelector('#mr-fab')`) ? 'aparece (la página parece un capítulo)' : 'no aparece'));
    console.log('Imágenes: ' + await pg.eval(`(() => { const d = {}; for (const i of document.images) { if (i.naturalWidth >= 250 && i.naturalHeight >= 250) { const k = new URL(i.currentSrc || i.src, location.href).pathname.replace(/[^/]*$/, ''); d[k] = (d[k] || 0) + 1; } } return Object.entries(d).map(([k, n]) => n + ' en ' + k).join(' · ') || 'ninguna grande'; })()`));
    console.log('Links a otras páginas del sitio que terminan en número: ' + await pg.eval(`[...document.querySelectorAll('a[href]')].filter(a => a.origin === location.origin && /\\d\\/?$/.test(a.pathname)).length`));
    console.log('Desplegables: ' + await pg.eval(`[...document.querySelectorAll('select')].map(s => s.options.length + ' opciones (valores como: ' + [...s.options].filter(o => o.value).slice(0, 3).map(o => JSON.stringify(o.value)).join(', ') + ')').join(' · ') || 'ninguno'`));

    await b.command(here, 'save');
    await pg.waitFor(`!!document.querySelector('#mr-save-name')`, 'el diálogo de guardar');
    const conteo = await pg.waitFor(`(() => { const t = document.querySelector('#mr-save-count')?.textContent || ''; return t && !/Recorriendo/.test(t) ? t : ''; })()`, 'las páginas', 60000).catch(() => '(no terminó de buscar)');
    console.log('\nDiálogo "Guardar capítulo":');
    console.log('  Nombre: ' + await pg.eval(`document.querySelector('#mr-save-name').value`));
    console.log('  ' + conteo);
    console.log('  Guardar y siguiente: ' + (await pg.eval(`document.querySelector('#mr-save-next').hidden`) ? 'no' : await pg.eval(`'sí'`)));

    await b.command(here, 'batch');
    await pg.waitFor(`!!document.querySelector('#mr-chapter-go')`, 'el diálogo de varios capítulos');
    console.log('\nDiálogo "Descargar varios capítulos":');
    console.log('  Dirección de los capítulos: ' + await pg.eval(`document.querySelector('#mr-chapter-tpl').value`) +
      (await pg.eval(`document.querySelector('#mr-chapter-more').open`) ? '   (supuesta: conviene revisarla)' : ''));
    console.log('  ' + await pg.eval(`document.querySelector('#mr-chapter-count').textContent`));
    const why = await pg.eval(`(() => { const w = document.querySelector('#mr-chapter-why'); return w && !w.hidden ? w.textContent : ''; })()`);
    if (why) console.log('  ' + why);
    console.log('  Rango sugerido: del ' + await pg.eval(`document.querySelector('#mr-chapter-from').value`) + ' al ' + await pg.eval(`document.querySelector('#mr-chapter-to').value`));

    if (desde) {
      await pg.eval(`document.querySelector('#mr-chapter-none').click()`);
      await lote.rango(pg, desde, hasta || desde);
      console.log('\n' + await pg.eval(`document.querySelector('#mr-chapter-go').textContent`) + '…');
      const t0 = Date.now();
      await pg.eval(`document.querySelector('#mr-chapter-go').click()`);
      const fin = await lote.fin(pg, 600000);
      console.log(fin.split('\n').map(l => '  ' + l).join('\n'));
      console.log('  Filas: ' + (await lote.filas(pg)).split(' | ').filter(f => /\[/.test(f)).join(' | '));
      console.log(`  Tardó ${Math.round((Date.now() - t0) / 1000)} s`);
      const base = path.join(b.dl, 'MangaReader');
      const files = fs.existsSync(base) ? walk(base) : [];
      console.log('\nArchivos (en la carpeta temporal, ya se borran):');
      for (const f of files) {
        const full = path.join(base, f);
        console.log(`  MangaReader/${f.replace(/\\/g, '/')} · ${Math.round(fs.statSync(full).size / 1024)} KB` + (f.endsWith('.pdf') ? ` · ${pdfPages(full)}` : ''));
      }
      if (!files.length) { console.log('  ninguno'); code = 1; }
      if (!/^✅/.test(fin)) code = 1;
    }
  } catch (e) {
    console.log('Se cortó: ' + e.message);
    code = 1;
  }
  await b.cerrar();
  process.exit(code);
})();
