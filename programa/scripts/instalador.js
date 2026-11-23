// Arma el instalador de Windows: programa/dist/Manga-Reader-Instalador-<versión>.exe
//
// Uso: node scripts/instalador.js        ("npm run instalador" hace esto)
//
// Primero arma generado/ con el código de la última versión de la extensión (el instalado no
// tiene la extensión al lado: lleva esa copia adentro) y después llama a electron-builder con
// lo que dice "build" en package.json. La primera vez baja lo que necesita para empaquetar.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');

require('./generar.js');

const raiz = path.join(__dirname, '..');
const cli = path.join(raiz, 'node_modules', 'electron-builder', 'cli.js');
if (!fs.existsSync(cli)) { console.error('Falta instalar las dependencias: corré "npm install" en la carpeta programa.'); process.exit(1); }

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
// Sin certificado de firma: que no busque uno (el instalador sale sin firmar)
env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
const r = spawnSync(process.execPath, [cli, '--win', 'nsis', '--x64'], { cwd: raiz, stdio: 'inherit', env });
if (r.status !== 0) { console.error('No se pudo armar el instalador.'); process.exit(r.status || 1); }

const salida = path.join(raiz, 'dist');
const exe = fs.readdirSync(salida).filter(n => /^Manga-Reader-Instalador-.*\.exe$/.test(n)).map(n => path.join(salida, n))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
if (exe) console.log(`\nInstalador listo: ${exe} (${Math.round(fs.statSync(exe).size / 1048576)} MB)`);
