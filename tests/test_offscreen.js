// Armado de PDF y CBZ (offscreen.js): cabeceras JPG, PNG sin recomprimir, estructura del
// PDF y del ZIP. Uso: node tests/test_offscreen.js "<carpeta de la versión>/manga-reader-ext"
const path = require('path'), zlib = require('zlib');
const { probador } = require('./extraer');
const off = require(path.resolve(process.argv[2], 'offscreen.js'));
const { eq, fin } = probador();

// ── Armado de imágenes de prueba ──
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([len, body, crc]);
}
// rows: una fila de bytes por línea, sin el byte de filtro. Las impares van con filtro "Up".
function png({ w, h, color, depth = 8, interlace = 0, rows, plte, trns, idats = 1 }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = depth; ihdr[9] = color; ihdr[12] = interlace;
  const raw = Buffer.concat(rows.map((r, y) => {
    if (y % 2 === 0) return Buffer.concat([Buffer.from([0]), Buffer.from(r)]);
    return Buffer.concat([Buffer.from([2]), Buffer.from(r.map((v, x) => (v - rows[y - 1][x]) & 0xFF))]);
  }));
  const z = zlib.deflateSync(raw);
  const parts = [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr)];
  if (plte) parts.push(chunk('PLTE', Buffer.from(plte)));
  if (trns) parts.push(chunk('tRNS', Buffer.from(trns)));
  const step = Math.ceil(z.length / idats);
  for (let i = 0; i < z.length; i += step) parts.push(chunk('IDAT', z.subarray(i, i + step)));
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return new Uint8Array(Buffer.concat(parts));
}
// Lo que hace un visor de PDF con /FlateDecode + /Predictor 15: descomprimir y deshacer los filtros
function unpredict(data, bytesPerRow) {
  const raw = zlib.inflateSync(Buffer.from(data));
  const out = [];
  for (let o = 0, y = 0; o < raw.length; o += bytesPerRow + 1, y++) {
    const f = raw[o], row = [...raw.subarray(o + 1, o + 1 + bytesPerRow)];
    if (f === 2) for (let x = 0; x < row.length; x++) row[x] = (row[x] + out[y - 1][x]) & 0xFF;
    else if (f !== 0) throw new Error('filtro ' + f);
    out.push(row);
  }
  return out;
}
function jpegHeader({ sof = 0xC0, w = 800, h = 1200, comps = 3, precision = 8 } = {}) {
  const app0 = [0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const len = 8 + comps * 3;
  const frame = [0xFF, sof, len >> 8, len & 255, precision, h >> 8, h & 255, w >> 8, w & 255, comps];
  for (let i = 0; i < comps; i++) frame.push(i + 1, 0x11, 0);
  return new Uint8Array([0xFF, 0xD8, ...app0, ...frame, 0xFF, 0xDA, 0, 2, 0, 0, 0xFF, 0xD9]);
}

(async () => {
  // ── Cabecera JPG ──
  eq('JPG baseline RGB', JSON.stringify(off.jpegInfo(jpegHeader())), '{"width":800,"height":1200,"components":3}');
  eq('JPG progresivo gris', JSON.stringify(off.jpegInfo(jpegHeader({ sof: 0xC2, comps: 1 }))), '{"width":800,"height":1200,"components":1}');
  eq('JPG CMYK → se reconvierte', off.jpegInfo(jpegHeader({ comps: 4 })), null);
  eq('JPG sin pérdida → se reconvierte', off.jpegInfo(jpegHeader({ sof: 0xC3 })), null);
  eq('JPG de 12 bits → se reconvierte', off.jpegInfo(jpegHeader({ precision: 12 })), null);
  eq('no es JPG', off.jpegInfo(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])), null);

  // ── PNG sin recomprimir ──
  const rgbRows = [[255, 0, 0, 0, 255, 0, 0, 0, 255, 9, 9, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [200, 100, 50, 0, 0, 0, 255, 255, 255, 30, 60, 90]];
  const rgb = off.pngDirect(png({ w: 4, h: 3, color: 2, rows: rgbRows, idats: 3 }));
  eq('PNG RGB: datos de la imagen', `${rgb.width}x${rgb.height} ${rgb.cs} ${rgb.bpc} ${rgb.filter} ${rgb.parms}`, '4x3 /DeviceRGB 8 /FlateDecode << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns 4 >>');
  eq('PNG RGB: los píxeles vuelven idénticos (3 IDAT unidos)', JSON.stringify(unpredict(rgb.data, 12)), JSON.stringify(rgbRows));

  const grayRows = [[0, 64, 128, 255, 10], [255, 128, 64, 0, 20]];
  const gray = off.pngDirect(png({ w: 5, h: 2, color: 0, rows: grayRows }));
  eq('PNG gris: datos', `${gray.cs} ${gray.parms}`, '/DeviceGray << /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns 5 >>');
  eq('PNG gris: píxeles idénticos', JSON.stringify(unpredict(gray.data, 5)), JSON.stringify(grayRows));

  const pal = off.pngDirect(png({ w: 4, h: 2, color: 3, rows: [[0, 1, 2, 1], [2, 2, 0, 1]], plte: [0, 0, 0, 255, 255, 255, 200, 30, 30] }));
  eq('PNG con paleta', `${pal.cs} ${pal.parms}`, '[/Indexed /DeviceRGB 2 <000000ffffffc81e1e>] << /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns 4 >>');
  const bw = off.pngDirect(png({ w: 16, h: 2, color: 0, depth: 1, rows: [[0xAA, 0x55], [0xFF, 0x00]] }));
  eq('PNG blanco y negro de 1 bit', `${bw.cs} ${bw.bpc} ${bw.parms}`, '/DeviceGray 1 << /Predictor 15 /Colors 1 /BitsPerComponent 1 /Columns 16 >>');

  const rgbaRow = [[1, 2, 3, 255, 4, 5, 6, 255]];
  eq('PNG con canal alfa → se decodifica', off.pngDirect(png({ w: 2, h: 1, color: 6, rows: rgbaRow })), null);
  eq('PNG con transparencia (tRNS) → se decodifica', off.pngDirect(png({ w: 4, h: 2, color: 3, rows: [[0, 1, 2, 1], [2, 2, 0, 1]], plte: [0, 0, 0, 255, 255, 255, 9, 9, 9], trns: [0] })), null);
  eq('PNG entrelazado → se decodifica', off.pngDirect(png({ w: 4, h: 3, color: 2, rows: rgbRows, interlace: 1 })), null);
  eq('PNG de 16 bits → se decodifica', off.pngDirect(png({ w: 1, h: 1, color: 2, depth: 16, rows: [[0, 1, 0, 2, 0, 3]] })), null);
  eq('PNG cortado', off.pngDirect(png({ w: 4, h: 3, color: 2, rows: rgbRows }).subarray(0, 60)), null);
  eq('no es PNG', off.pngDirect(jpegHeader()), null);

  // ── Píxeles decodificados → sin pérdida ──
  const g = await off.flateImage(new Uint8Array([10, 10, 10, 255, 200, 200, 200, 255]), 2, 1);
  eq('píxeles grises → DeviceGray', `${g.cs} ${[...zlib.inflateSync(Buffer.from(g.data))]}`, '/DeviceGray 10,200');
  const col = await off.flateImage(new Uint8Array([10, 20, 30, 255, 200, 200, 200, 255]), 2, 1);
  eq('píxeles de color → DeviceRGB', `${col.cs} ${[...zlib.inflateSync(Buffer.from(col.data))]}`, '/DeviceRGB 10,20,30,200,200,200');

  // ── PDF ──
  const jpgPage = { data: jpegHeader(), width: 800, height: 1200, cs: '/DeviceRGB', bpc: 8, filter: '/DCTDecode' };
  const oldPage = { data: jpegHeader({ comps: 1 }), width: 800, height: 20000, gray: true };       // forma vieja + tira larga
  const pdf = Buffer.from(await off.makePdf([jpgPage, rgb, oldPage], 'Capítulo 12 ñ').arrayBuffer());
  const txt = pdf.toString('latin1');
  eq('PDF: cabecera', txt.slice(0, 8), '%PDF-1.4');
  const xrefAt = +txt.match(/startxref\n(\d+)\n%%EOF\n$/)[1];
  eq('PDF: startxref apunta a la tabla', txt.substr(xrefAt, 4), 'xref');
  const entries = txt.slice(xrefAt).match(/^\d{10} \d{5} n $/gm);
  eq('PDF: 3 objetos fijos + 3 por página', entries.length, 12);
  eq('PDF: cada objeto está donde dice la tabla', entries.every((e, i) => txt.substr(+e.slice(0, 10), `${i + 1} 0 obj`.length) === `${i + 1} 0 obj`), true);
  eq('PDF: cantidad de páginas', /\/Count 3 /.test(txt), true);
  eq('PDF: derecha → izquierda', txt.includes('/Direction /R2L'), true);
  eq('PDF: título con acentos (UTF-16)', txt.includes('/Title <FEFF00430061007000ED00740075006C006F002000310032002000F1>'), true);
  eq('PDF: página del tamaño de la imagen', txt.includes('/MediaBox [0 0 800 1200]'), true);
  eq('PDF: tira larga achicada a 14400', txt.includes('/MediaBox [0 0 576 14400]'), true);
  eq('PDF: PNG incrustado con su predictor', txt.includes(`/Width 4 /Height 3 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns 4 >> /Length ${rgb.data.length} >>`), true);
  eq('PDF: forma vieja {gray} sigue andando', txt.includes('/Width 800 /Height 20000 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length'), true);
  eq('PDF: los bytes de la imagen van sin tocar', pdf.includes(Buffer.from(rgb.data)), true);

  // ── CBZ ──
  const files = [{ name: '001.jpg', data: jpegHeader() }, { name: 'ComicInfo.xml', data: new TextEncoder().encode(off.comicInfo({ title: 'A & B <1>', series: 'Señor', number: 12.5, arc: '', web: 'https://s.com/?a=1&b=2' }, 1)) }];
  const zip = Buffer.from(await off.makeZip(files).arrayBuffer());
  const eocd = zip.length - 22;
  eq('ZIP: firma de cierre y cantidad', `${zip.readUInt32LE(eocd).toString(16)} ${zip.readUInt16LE(eocd + 10)}`, '6054b50 2');
  const cenAt = zip.readUInt32LE(eocd + 16);
  eq('ZIP: directorio central donde dice', zip.readUInt32LE(cenAt).toString(16), '2014b50');
  eq('ZIP: CRC del primer archivo', zip.readUInt32LE(14), zlib.crc32(Buffer.from(files[0].data)));
  eq('ZIP: datos sin comprimir ni tocar', zip.subarray(30 + 7, 30 + 7 + files[0].data.length).equals(Buffer.from(files[0].data)), true);
  eq('crc32 propio = el de zlib', off.crc32(files[1].data), zlib.crc32(Buffer.from(files[1].data)));
  const xml = Buffer.from(files[1].data).toString();
  eq('ComicInfo: escapa & < >', xml.includes('<Title>A &amp; B &lt;1&gt;</Title>') && xml.includes('<Web>https://s.com/?a=1&amp;b=2</Web>'), true);
  eq('ComicInfo: sin saga no hay etiqueta', xml.includes('StoryArc'), false);
  eq('ComicInfo: número decimal y sentido de lectura', xml.includes('<Number>12.5</Number>') && xml.includes('<Manga>YesAndRightToLeft</Manga>'), true);

  // ── Tipo real del archivo ──
  eq('tipo real: PNG', off.sniffExt(png({ w: 1, h: 1, color: 0, rows: [[0]] })), 'png');
  eq('tipo real: JPG', off.sniffExt(jpegHeader()), 'jpg');
  eq('tipo real: WebP', off.sniffExt(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), 'webp');
  eq('tipo real: GIF', off.sniffExt(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), 'gif');

  // ── Páginas SVG (las de un lector que las dibuja de fondo, como Issuu; desde la 2.11.3) ──
  if (typeof off.desdeSvg === 'function') {
    const jpg = require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'pagina.jpg'));
    const enc = (s) => new TextEncoder().encode(s);
    const envuelta = enc(`<?xml version="1.0"?>\n<svg height="100%" viewBox="0 0 420 640" width="100%" xmlns="http://www.w3.org/2000/svg"><style>a{cursor:pointer}</style>` +
      `<image aria-hidden="true" width="420" height="640" href="data:image/jpeg;charset=utf-8;base64,${jpg.toString('base64')}"/><a href="https://s.com"><rect fill="transparent" width="10" height="10"/></a></svg>`);
    eq('tipo real: SVG (con o sin <?xml adelante)', `${off.sniffExt(envuelta)} · ${off.sniffExt(enc('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))}`, 'svg · svg');
    const r = await off.desdeSvg(envuelta);
    eq('una página SVG que envuelve un escaneo JPG: se usa ese JPG, idéntico, sin recodificar', `${r.ext} · ${Buffer.from(r.data).equals(jpg)}`, 'jpg · true');
    const dos = enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="data:image/png;base64,AAAA"/><image href="data:image/png;base64,BBBB"/></svg>`);
    let e = 'no falló';
    try { await off.desdeSvg(dos); } catch (x) { e = x.message; }
    eq('  si no es un solo escaneo hay que dibujarla, y sin un documento (acá, en Node) no se puede: lo dice', e, 'página SVG que no se puede convertir');
    // El base64 cortado en renglones escritos como entidades (&#10;) también se lee
    const b64 = jpg.toString('base64').replace(/(.{76})/g, '$1&#10;');
    const r2 = await off.desdeSvg(enc(`<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/jpeg;base64,${b64}"/></svg>`));
    eq('  con el base64 cortado con entidades (&#10;): el mismo JPG', `${r2.ext} · ${Buffer.from(r2.data).equals(jpg)}`, 'jpg · true');

    // Por loadAll, como en un capítulo de verdad: la página es un SVG y en el PDF entra el escaneo.
    // Una con el escaneo por dirección (relativa al SVG) lo baja; una con dos imágenes de afuera
    // no se puede dibujar (saldría en blanco): queda entre las que faltaron, con el motivo.
    if (typeof off.loadAll === 'function') {
      const real = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout };
      const avisar = console.warn;
      const pedidos = [];
      console.warn = () => {};
      globalThis.chrome = { runtime: { sendMessage: async () => {} } };
      globalThis.setTimeout = (f, ms) => real.setTimeout(f, ms >= 30000 ? ms : 0);
      const sitio = {
        'https://s.com/p/1.svg': envuelta,
        'https://s.com/p/2.svg': enc(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="640"><image width="420" height="640" xlink:href="../esc/2.jpg"/></svg>`),
        'https://s.com/esc/2.jpg': new Uint8Array(jpg),
        'https://s.com/p/3.svg': enc(`<svg xmlns="http://www.w3.org/2000/svg"><image href="https://s.com/a.jpg"/><image href="https://s.com/b.jpg"/></svg>`),
      };
      globalThis.fetch = async (u) => { pedidos.push(u.replace('https://s.com', '')); const d = sitio[u];
        return d ? { ok: true, status: 200, headers: { get: () => null }, arrayBuffer: async () => d.slice().buffer } : { ok: false, status: 404, headers: { get: () => null } }; };
      let fin;
      try {
        const r = await off.loadAll(['https://s.com/p/1.svg', 'https://s.com/p/2.svg', 'https://s.com/p/3.svg'], 'j', true);
        fin = `${Array.from(r.pages).map(p => (p ? `${p.ext}${Buffer.from(p.data).equals(jpg) ? ' (el escaneo)' : ''}${p.pdf ? ' + PDF' : ''}` : 'falta')).join(' | ')} · faltó: ${r.failed.join(',')}`;
      } catch (x) { fin = 'error: ' + x.message; }
      Object.assign(globalThis, real);
      delete globalThis.chrome;
      console.warn = avisar;
      eq('  por loadAll: un SVG con el escaneo adentro y otro con el escaneo por dirección entran como JPG (y al PDF); uno con dos imágenes de afuera queda entre las que faltaron',
        `${fin} · pidió ${pedidos.sort().join(' ')}`, 'jpg (el escaneo) + PDF | jpg (el escaneo) + PDF | falta · faltó: 3 · pidió /esc/2.jpg /p/1.svg /p/2.svg /p/3.svg');
    }
  }
  fin();
})();
