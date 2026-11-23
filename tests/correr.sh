#!/usr/bin/env bash
# Corre las pruebas contra una versión. Uso: bash tests/correr.sh "manga-reader-ext(ver 21-11-2026-2)"
# Sin argumento usa la más nueva según el "version" de cada manifest.json (no según el
# nombre de la carpeta). Las pruebas son para la 2.7 en adelante.
# La prueba en navegador va aparte: node tests/e2e.js
set -e
cd "$(dirname "$0")/.."
V="${1:-$(node tests/ultima_version.js)}"
DIR="$V/manga-reader-ext"
echo "== Versión: $V"
for f in content.js background.js offscreen.js popup.js opciones.js sagas.js sitios.js agrupar.js plantilla.js estilos.js; do
  if [ -f "$DIR/$f" ]; then node --check "$DIR/$f"; fi
done && echo "Sintaxis OK"
echo "== Nombres y dirección";              node tests/test_nombres.js   "$DIR"
echo "== Capítulos (descarga de varios)";   node tests/test_capitulos.js "$DIR"
echo "== Filtro de publicidad";             node tests/test_filtro.js    "$DIR"
echo "== Descargas y pestañas";             node tests/test_descargas.js "$DIR"
echo "== PDF, CBZ e imágenes";              node tests/test_offscreen.js "$DIR"
echo "== Guardados y sagas";                node tests/test_opciones.js  "$DIR"
if [ -f "$DIR/agrupar.js" ]; then            # desde la 2.10
echo "== Tomos (agrupado por volumen)";     node tests/test_tomos.js     "$DIR"
echo "== Plantilla de nombres";             node tests/test_esquema.js   "$DIR"
fi
if [ -f "$DIR/sitios.js" ]; then
echo "== Sitios de manga y cómics";         node tests/test_sitios.js    "$DIR"
fi
