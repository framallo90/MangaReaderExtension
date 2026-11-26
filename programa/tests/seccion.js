// La sección de la galería de tests/prueba.js, sola (0.11.2). La suite entera tarda más de diez
// minutos; esto corre la preparación, la apertura de la interfaz y esa sección: unos cuatro. Sirve
// para iterar sobre la galería y para probarla contra el programa empaquetado o instalado, que no
// trae las pruebas adentro (se le pasan con --pruebas=<carpeta>).
//
// Uso: node tests/seccion.js [--ejecutable="<…>\Manga Reader.exe"]
//   sin --ejecutable    contra el programa de desarrollo (arma generado/ antes, como npm run prueba)
//   con --ejecutable    contra ese: el instalado (%LOCALAPPDATA%\Programs\Manga Reader\Manga Reader.exe)
//                       o el de dist/win-unpacked
// Sale con el código del programa: 0 si todo dio, 1 si algo falló.
//
// Cómo lo hace: arma en una carpeta temporal una copia recortada de prueba.js (se corta por los
// títulos de sus partes; si alguno cambia, acá lo dice) con los require apuntando a esta carpeta.
// La sección tiene que bastarse sola: lo que necesite de otra parte de la suite lo prepara ella.
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');

const AQUI = __dirname.replace(/\\/g, '/');
const ejecutable = (process.argv.find(a => a.startsWith('--ejecutable=')) || '').slice('--ejecutable='.length);
if (ejecutable && !fs.existsSync(ejecutable)) { console.error('No encuentro ' + ejecutable); process.exit(1); }

const s = fs.readFileSync(path.join(__dirname, 'prueba.js'), 'utf8').replace(/\r\n/g, '\n');
const desde = (marca) => { const i = s.indexOf(marca); if (i < 0) throw new Error('prueba.js ya no tiene esta parte: ' + marca.trim()); return i; };
const entre = (a, b) => { const i = desde(a), j = s.indexOf(b, i + a.length); if (j < 0) throw new Error('prueba.js ya no tiene esta parte: ' + b.trim()); return s.slice(i, j); };
const linea = (re) => { const m = s.match(re); if (!m) throw new Error('prueba.js ya no tiene ' + re); return m[0]; };
// La cabecera (hasta la primera parte), con los require de las pruebas apuntando a esta carpeta
const cabeza = s.slice(0, desde("    console.log('\\n── El freno"))
  .replace(/require\('\.\/(\w+)'\)/g, (_, m) => `require(${JSON.stringify(AQUI + '/' + m)})`)
  .replace(/require\('\.\.\/\.\.\/tests\/navegador'\)/, `require(${JSON.stringify(path.posix.join(AQUI, '..', '..', 'tests', 'navegador'))})`);
const partes = [cabeza,
  linea(/^ *const soloPdf = .*$/m), linea(/^ *const esperarQue = .*$/m),             // (dos ayudantes que se definen en otras partes)
  entre("    console.log('\\n── Interfaz');", '    // Pegar la portada de un sitio: encuentra el link al catálogo y entra solo'),
  entre('    // ── (0.11.0) La galería del sitio ──', '    // Favoritos: filtros por tipo y por idioma'),
  s.slice(desde("    eq('sin errores en la consola de la interfaz'"))];

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-seccion-'));
fs.writeFileSync(path.join(carpeta, 'prueba.js'), partes.join('\n'));

let programa = ejecutable, argumentos = [];
if (!ejecutable) {
  require('../scripts/generar.js');
  programa = require('electron');                  // (desde Node, el paquete devuelve la ruta del ejecutable)
  argumentos = [path.join(__dirname, '..')];
}
console.log(`== La sección de la galería, sola · ${new Date().toLocaleString('es-AR', { hour12: false })} · contra ${ejecutable || 'el programa de desarrollo'}`);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const t0 = Date.now();
const hijo = spawn(programa, [...argumentos, '--prueba', '--pruebas=' + carpeta], { stdio: 'inherit', env });
const terminar = (codigo) => {
  try { fs.rmSync(carpeta, { recursive: true, force: true }); } catch {}
  console.log(`(tardó ${Math.floor((Date.now() - t0) / 60000)} min ${Math.round((Date.now() - t0) / 1000) % 60} s)`);
  process.exit(codigo ?? 1);
};
hijo.on('exit', terminar);
hijo.on('error', (e) => { console.error('No se pudo abrir el programa: ' + e.message); terminar(1); });
