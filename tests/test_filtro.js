// Filtro de publicidad (flagNonPages).
// Uso: node tests/test_filtro.js "<carpeta de la versión>/manga-reader-ext"
const { pagina, probador } = require('./extraer');
const dir = process.argv[2];
const { eq, fin } = probador();
const c = pagina(dir);
const pg = (name, w, h, extra = {}) => ({ url: 'https://cdn.x/cap/1134/' + name, w, h, external: false, flag: '', ...extra });
const many = (n, w, h, extra) => Array.from({ length: n }, (_, i) => pg(String(i).padStart(2, '0') + '.jpg', w, h, extra));
const flags = (pages) => pages.filter(p => p.flag).map(p => p.url.split('/').pop() + ': ' + p.flag).join(' | ');

{ // Capítulo normal con logo, aviso con link, GIF y créditos al final
  const pages = [
    { url: 'https://sitio.com/images/logo.png', w: 800, h: 300, external: false, flag: '' },
    ...many(12, 800, 1200),
    pg('doble.jpg', 1600, 1200),
    pg('creditos.jpg', 800, 400),
    pg('aviso.jpg', 800, 1200, { external: true }),
    pg('anim.gif', 800, 1200),
  ];
  const mainDir = c.flagNonPages(pages);
  eq('carpeta del capítulo', mainDir, 'https://cdn.x/cap/1134/');
  eq('marca logo, créditos, aviso y GIF (y no la doble página)',
    flags(pages), 'logo.png: fuera de la carpeta del capítulo | creditos.jpg: formato distinto al resto | aviso.jpg: enlace a otro sitio | anim.gif: GIF animado');
}
{ // La doble página al final no es publicidad
  const pages = [...many(10, 800, 1200), pg('final-doble.jpg', 1600, 1200)];
  c.flagNonPages(pages);
  eq('doble página al final', flags(pages), '');
}
{ // Webtoon: tiras de alto variable, la última más corta
  const pages = [...many(8, 800, 9000), pg('f1.jpg', 800, 12000), pg('f2.jpg', 800, 2500)];
  c.flagNonPages(pages);
  eq('webtoon: no marca las últimas tiras', flags(pages), '');
}
{ // Páginas de tamaños muy mezclados: no hay un formato que comparar
  const pages = [pg('a.jpg', 800, 1200), pg('b.jpg', 1200, 800), pg('c.jpg', 800, 800), pg('d.jpg', 800, 1500), pg('e.jpg', 1500, 700), pg('f.jpg', 700, 1500), pg('g.jpg', 900, 500)];
  c.flagNonPages(pages);
  eq('formatos mezclados: no marca nada', flags(pages), '');
}
{ // Lector que envuelve cada página en un link a su CDN
  const pages = many(12, 800, 1200, { external: true });
  c.flagNonPages(pages);
  eq('todas con link a otro dominio: no es publicidad', flags(pages), '');
}
{ // Dos avisos con link entre 12 páginas: esos sí
  const pages = [...many(12, 800, 1200), pg('ad1.jpg', 800, 1200, { external: true }), pg('ad2.jpg', 800, 1200, { external: true })];
  c.flagNonPages(pages);
  eq('pocos con link a otro dominio: sí', flags(pages), 'ad1.jpg: enlace a otro sitio | ad2.jpg: enlace a otro sitio');
}
{ // Menos de 3 imágenes: no se filtra nada
  const pages = [pg('a.jpg', 800, 1200), { url: 'https://sitio.com/logo.png', w: 800, h: 300, external: false, flag: '' }];
  eq('menos de 3 imágenes: sin carpeta', c.flagNonPages(pages), null);
  eq('menos de 3 imágenes: sin marcas', flags(pages), '');
}
fin();
