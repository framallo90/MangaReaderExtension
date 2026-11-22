// Página "Guardados y opciones": sagas editables, lo que falta por serie y las copias.
// Uso: node tests/test_opciones.js "<carpeta de la versión>/manga-reader-ext"
const fs = require('fs'), vm = require('vm'), path = require('path');
const { probador } = require('./extraer');
const dir = process.argv[2];
const op = require(path.resolve(dir, 'opciones.js'));
const { eq, fin } = probador();

// Las sagas incluidas (sagas.js) tienen que sobrevivir a "pasar a texto → volver a leer"
const g = {};
vm.createContext(g);
vm.runInContext(fs.readFileSync(path.join(dir, 'sagas.js'), 'utf8'), g);
const text = op.sagasToText(g.MR_SAGAS);
eq('sagas incluidas: texto', text.split('\n').slice(0, 3).join(' / ') + ' … ' + text.split('\n').pop(), 'One Piece / 1-100 East Blue / 101-216 Alabasta … 1058- Saga Final');
eq('sagas incluidas: ida y vuelta', JSON.stringify(op.parseSagas(text).table), JSON.stringify(g.MR_SAGAS));

{
  const r = op.parseSagas('Naruto\n245-700 Shippuden\n1 - 244 Parte 1\n\n\nBleach\n1+ Todo\n');
  eq('varias series, ordenadas por capítulo', JSON.stringify(r.table), '{"naruto":[[1,244,"Parte 1"],[245,700,"Shippuden"]],"bleach":[[1,99999,"Todo"]]}');
  eq('sin errores', r.errors.length, 0);
  eq('la serie se guarda como queda en el nombre del archivo', Object.keys(op.parseSagas('Re:Zero / Extra\n1-10 Arco 1').table)[0], 're zero - extra');
}
{
  const r = op.parseSagas('Naruto\nParte 1 del 1 al 244\n300-200 Al revés\n\n1-5 Sin serie\n\nVacía');
  eq('errores que se explican', r.errors.join(' | '),
    'Naruto: no entiendo "Parte 1 del 1 al 244" (va "desde-hasta Nombre") | Naruto: en "300-200 Al revés" el final es menor que el principio | Naruto: no tiene ninguna saga | Falta el nombre de la serie antes de "1-5 Sin serie" | Vacía: no tiene ninguna saga');
  eq('con errores no queda nada a medias', JSON.stringify(r.table), '{}');
}

eq('faltantes', op.rangesText(op.missingRanges([1, 2, 5, 9, 9.5, 10])), '3–4, 6–8');
eq('sin faltantes', op.rangesText(op.missingRanges([7, 8, 9])), '');
eq('un solo capítulo', op.missingRanges([7]).length, 0);

{
  const saved = {
    'One Piece/11 Saga Final/One Piece 1134': { ts: 3, pages: 15, url: 'https://s.com/1134' },
    'One Piece/11 Saga Final/One Piece 1130': { ts: 1, pages: 17, url: 'https://s.com/1130' },
    'One Piece/11 Saga Final/One Piece 1131.5': { ts: 2, pages: 5, url: 'https://s.com/1131.5' },
    'Berserk/Berserk 0375': { ts: 4, pages: 20, url: 'https://b.com/375' },
    'Suelto sin número': { ts: 5, pages: 3, url: 'https://x.com/a' },
  };
  const groups = op.groupSaved(saved);
  eq('series en orden', groups.map(x => `${x.serie} (${x.items.length})`).join(', '), 'Berserk (1), One Piece (3), Suelto sin número (1)');
  eq('capítulos en orden', groups[1].items.map(i => i.numero).join(','), '1130,1131.5,1134');
  eq('lo que falta de la serie', op.rangesText(groups[1].missing), '1132–1133');
  eq('nombre sin número', groups[2].items[0].numero, null);

  const local = { savedChapters: saved, sagasText: 'Mía\n1-2 A', fabBlockedHosts: ['a.com'] };
  const backup = {
    savedChapters: {
      'Berserk/Berserk 0375': { ts: 1, pages: 19, url: 'https://b.com/375' },                       // más viejo: no pisa
      'One Piece/11 Saga Final/One Piece 1134': { ts: 9, pages: 16, url: 'https://s.com/1134' },      // más nuevo: pisa
      'Berserk/Berserk 0376': { ts: 6, pages: 21, url: 'https://b.com/376' },                       // nuevo
      'Roto': 'no es un objeto',
    },
    sagasText: 'Otra\n1-2 B', sagas: { otra: [[1, 2, 'B']] }, fabBlockedHosts: ['b.com', 'a.com', 5],
  };
  const { out, added } = op.mergeBackup(local, backup);
  eq('importar: capítulos nuevos', added, 1);
  eq('importar: total', Object.keys(out.savedChapters).length, 6);
  eq('importar: gana el más nuevo', `${out.savedChapters['Berserk/Berserk 0375'].pages} ${out.savedChapters['One Piece/11 Saga Final/One Piece 1134'].pages}`, '20 16');
  eq('importar: no pisa lo ya configurado', out.sagasText, undefined);
  eq('importar: trae lo que acá no estaba', JSON.stringify(out.sagas), '{"otra":[[1,2,"B"]]}');
  eq('importar: sitios sin burbuja sumados', out.fabBlockedHosts.join(','), 'a.com,b.com');

  // Mis sitios (2.8): se suman los que no estén, la misma dirección con www o barra final cuenta como repetida
  const conSitios = op.mergeBackup(
    { savedChapters: {}, misSitios: [{ nombre: 'Uno', url: 'https://uno.com/' }] },
    { savedChapters: {}, misSitios: [{ nombre: 'Uno otra vez', url: 'https://www.uno.com' }, { nombre: 'Dos', url: 'https://dos.com/' }, { nombre: 'Malo', url: 'javascript:x' }, 'roto'] });
  if (conSitios.out.misSitios) {
    eq('importar: mis sitios sumados sin repetir', conSitios.out.misSitios.map(s => s.nombre).join(', '), 'Uno, Dos');
  } else {
    eq('importar: mis sitios (versión sin esta función)', 'no aplica', 'no aplica');
  }

  // Plantilla de nombres (2.10): lo guardado con una plantilla propia trae anotados la serie y el
  // número, porque ahí la primera carpeta puede ser el sitio y el nombre terminar en el título
  if (fs.existsSync(path.join(dir, 'plantilla.js'))) {
    const conPlantilla = op.groupSaved({
      'sitio.com/2026/Naruto 0300 - El final': { ts: 1, pages: 9, url: 'https://s.com/300', serie: 'Naruto', numero: 300 },
      'sitio.com/2026/Naruto 0302 - Otro': { ts: 2, pages: 9, url: 'https://s.com/302', serie: 'Naruto', numero: 302 },
      'Naruto/Naruto 0299': { ts: 3, pages: 9, url: 'https://s.com/299' },
    });
    eq('guardado con plantilla propia: se agrupa por la serie anotada, junto a lo de antes',
      conPlantilla.map(x => `${x.serie} (${x.items.map(i => i.numero).join(',')})`).join(' | '), 'Naruto (299,300,302)');
    eq('  y dice lo que falta', op.rangesText(conPlantilla[0].missing), '301');
    const r = op.mergeBackup({ savedChapters: {} }, { esquemaNombres: '{serie}/{numero}', savedChapters: { 'a/b': { ts: 1, pages: 2, url: 'u', serie: 'A', numero: 7 } } });
    eq('importar: trae la plantilla y lo anotado en cada capítulo', r.out.esquemaNombres + ' · ' + JSON.stringify(r.out.savedChapters['a/b']),
      '{serie}/{numero} · {"ts":1,"pages":2,"url":"u","serie":"A","numero":7}');
    eq('importar: no pisa la plantilla que ya había',
      op.mergeBackup({ savedChapters: {}, esquemaNombres: '{serie}' }, { savedChapters: {}, esquemaNombres: '{numero}' }).out.esquemaNombres, undefined);
  }
}
fin();
