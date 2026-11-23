// El pedido real a GitHub que hace el punto de "versión nueva" del popup, a mano y una sola vez.
// Las pruebas automáticas corren esa función con internet simulada (test_ajustes.js); esto sale
// de verdad a raw.githubusercontent.com con la misma función (versionRemota, de ajustes.js) y
// dice qué contestó. No es parte de ninguna suite: depende de la red y de lo que haya subido.
//
// Uso: node tests/probar_version.js [versión instalada]
//      sin argumento compara contra la versión de la última carpeta; con "2.10.0" se ve qué
//      haría el popup de alguien que tiene cargada esa.
//      node tests/probar_version.js --navegador ["<carpeta de otra versión>"]
//      además abre el popup de verdad en el Chromium de prueba, con la última versión cargada (o
//      la de esa carpeta) y sin nada anotado: el pedido lo hace el popup, por el camino que usa
//      la extensión (desde una página chrome-extension://, donde manda el CORS del servidor).
const fs = require('fs'), path = require('path');
const { root, ultimaVersion, lanzar, sleep } = require('./navegador');

const dir = path.join(root, ultimaVersion(), 'manga-reader-ext');
const A = require(path.join(dir, 'ajustes.js'));
const args = process.argv.slice(2);
// La carpeta de otra versión como argumento ("manga-reader-ext(ver 23-11-2026)"): esa es la que
// se carga en el navegador, para ver el punto prendido cuando en main ya hay una más nueva
const otra = args.find(a => fs.existsSync(path.join(root, a, 'manga-reader-ext', 'manifest.json')));
const cargada = otra ? path.join(root, otra, 'manga-reader-ext') : dir;
const local = JSON.parse(fs.readFileSync(path.join(cargada, 'manifest.json'), 'utf8')).version;
const instalada = args.find(a => /^\d+(\.\d+)+$/.test(a)) || local;

// El popup de la extensión, en un navegador, sin `versionVista` guardada: tiene que salir a
// GitHub él solo y dejar anotado lo que encontró
async function enNavegador() {
  const b = await lanzar(cargada);
  if (!b) return console.log('En el navegador: no hay un Chromium de prueba (ver tests/navegador.js)');
  try {
    await b.ext.eval(`chrome.storage.local.remove('versionVista')`);
    const p = await b.cdp.open(`chrome-extension://${b.extId}/popup.html`);
    let vista = null;
    for (const hasta = Date.now() + 20000; Date.now() < hasta && !vista; await sleep(250)) vista = await b.storage('versionVista');
    const aviso = await p.eval(`(() => { const a = document.getElementById('versionNueva'); return a.hidden ? 'sin punto' : 'con punto: ' + a.textContent.trim(); })()`);
    console.log(`En el navegador (${b.nombre}), popup de la ${local}: ` + (vista ? `anotó versionVista = ${JSON.stringify({ version: vista.version })} · ${aviso}` : 'no anotó nada en 20 s'));
  } finally {
    await b.cerrar();
  }
}

(async () => {
  const pedidos = [];
  const pedir = async (u, o) => {
    const t = Date.now();
    const r = await fetch(u, o);
    pedidos.push(`HTTP ${r.status} en ${Date.now() - t} ms · ${decodeURIComponent(u.replace(A.REPO_CRUDO, ''))}`);
    return r;
  };
  let remota = null, error = '';
  try { remota = await A.versionRemota(pedir); } catch (e) { error = e.message; }
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Se pidió a: ${A.REPO_CRUDO}`);
  for (const p of pedidos) console.log(`  ${p}`);
  if (error) console.log(`No se pudo pedir: ${error}`);
  else if (!remota) console.log('No se pudo saber la versión (sin respuesta válida: ¿el repositorio es privado, o el README no trae la tabla?)');
  else {
    console.log(`En main: ${remota.version} (${remota.carpeta})`);
    const nueva = A.compararVersiones(remota.version, instalada) > 0;
    console.log(`Instalada: ${instalada} → ${nueva ? 'hay una versión nueva: el popup mostraría el punto' : 'no hay nada más nuevo: el popup no mostraría el punto'}`);
  }
  if (args.includes('--navegador')) await enNavegador();
})();
