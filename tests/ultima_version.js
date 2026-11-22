// Imprime la carpeta de la versión más nueva según el "version" de su manifest.json
// (no según el nombre de la carpeta, que depende de la fecha y de los sufijos -2, -3…).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const cmp = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};
const versiones = fs.readdirSync(root)
  .filter(d => d.startsWith('manga-reader-ext(ver'))
  .map(d => {
    try { return { d, v: JSON.parse(fs.readFileSync(path.join(root, d, 'manga-reader-ext', 'manifest.json'), 'utf8')).version }; }
    catch { return null; }
  })
  .filter(Boolean)
  .sort((a, b) => cmp(a.v, b.v) || a.d.localeCompare(b.d));
if (!versiones.length) { console.error('No encontré ninguna versión'); process.exit(1); }
console.log(versiones[versiones.length - 1].d);
