// Abre el programa: primero arma generado/ con el código de la última versión de la
// extensión y después lanza Electron.
//
// Uso: node scripts/abrir.js [--prueba]      ("npm start" y "npm run prueba" hacen esto)
//
// Se lanza desde acá y no con "electron ." porque algunos entornos (por ejemplo, una terminal
// abierta desde un editor hecho con Electron) dejan puesta la variable ELECTRON_RUN_AS_NODE,
// y con ella Electron se comporta como Node a secas y no abre ninguna ventana.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');

require('./generar.js');

// En las versiones nuevas de Electron, "npm install" no baja el ejecutable: lo baja este
// paso la primera vez (unos 130 MB).
const paquete = path.join(__dirname, '..', 'node_modules', 'electron');
if (!fs.existsSync(paquete)) { console.error('Falta instalar las dependencias: corré "npm install" en la carpeta programa.'); process.exit(1); }
if (!fs.existsSync(path.join(paquete, 'path.txt'))) {
  console.log('Bajando Electron (solo la primera vez)…');
  const r = spawnSync(process.execPath, [path.join(paquete, 'install.js')], { stdio: 'inherit' });
  if (r.status !== 0 || !fs.existsSync(path.join(paquete, 'path.txt'))) { console.error('No se pudo bajar Electron. Revisá la conexión y probá de nuevo.'); process.exit(1); }
}

const electron = require('electron');            // desde Node, el paquete devuelve la ruta del ejecutable
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const hijo = spawn(electron, [path.join(__dirname, '..'), ...process.argv.slice(2)], { stdio: 'inherit', env, windowsHide: false });
hijo.on('exit', (codigo) => process.exit(codigo ?? 1));
hijo.on('error', (e) => { console.error('No se pudo abrir Electron: ' + e.message); process.exit(1); });
