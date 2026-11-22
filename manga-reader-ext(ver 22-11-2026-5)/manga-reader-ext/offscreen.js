/**
 * Offscreen document v2.9.0 — baja las páginas del capítulo UNA sola vez y arma con eso
 * todo lo que se pidió: PDF, CBZ y/o imágenes sueltas.
 *
 * - Las páginas JPG se meten en el PDF tal cual (sin recomprimir, calidad original).
 * - Las PNG también van sin pérdida: se reusan sus datos comprimidos o, si tienen
 *   transparencia, se decodifican y se guardan con Flate.
 * - WebP / GIF / AVIF se convierten a JPG de alta calidad (el formato PDF no los admite).
 * - Cada página del PDF tiene el tamaño exacto de la imagen.
 * - El PDF se marca como lectura derecha → izquierda (para vista de doble página).
 */

const PDF_MAX_SIDE = 14400;   // límite práctico de tamaño de página en visores PDF (200 pulgadas)
const FETCH_CONCURRENCY = 4;
const FETCH_RETRIES = 2;      // reintentos por página, además del primer intento
const MIME = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' };

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.target !== 'offscreen') return; // ignorar mensajes de los content scripts

    if (msg.action === 'build') {
      build(msg)
        .then(r => sendResponse({ ok: true, ...r }))
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }

    if (msg.action === 'revoke') {
      for (const u of [].concat(msg.urls || [], msg.url || [])) { try { URL.revokeObjectURL(u); } catch {} }
    }
  });
}

// ── Pipeline ─────────────────────────────────────────

// Devuelve { pages, failed, files }: `failed` son los números (desde 1) de las páginas que
// no se pudieron bajar, y `files` lo que hay que descargar, cada uno con su blob: URL.
async function build({ urls, formats, title, meta, jobId }) {
  const f = formats || {};
  const { pages, failed } = await loadAll(urls, jobId, !!f.pdf);
  const ok = pages.filter(Boolean);
  const files = [];
  const blobFile = (kind, blob, extra) =>
    files.push({ kind, url: URL.createObjectURL(blob), sizeKB: Math.round(blob.size / 1024), ...extra });

  if (f.pdf) blobFile('pdf', makePdf(ok.map(p => p.pdf), title));
  if (f.cbz) {
    // CBZ = ZIP con las imágenes originales (sin tocar) + ComicInfo.xml
    const width = Math.max(3, String(ok.length).length);
    const entries = ok.map((p, i) => ({ name: `${String(i + 1).padStart(width, '0')}.${p.ext}`, data: p.data }));
    entries.push({ name: 'ComicInfo.xml', data: new TextEncoder().encode(comicInfo(meta || {}, ok.length)) });
    blobFile('cbz', makeZip(entries));
  }
  if (f.imgs) {
    // Imágenes sueltas: las originales, con la extensión real del archivo (la URL puede mentir)
    const width = Math.max(3, String(urls.length).length);
    for (const p of ok) {
      blobFile('img', new Blob([p.data], { type: MIME[p.ext] || 'application/octet-stream' }),
        { name: `pagina_${String(p.index + 1).padStart(width, '0')}.${p.ext}` });
    }
  }
  return { pages: ok.length, failed, files };
}

// Baja todas las páginas en paralelo (manteniendo el orden) y avisa el progreso
async function loadAll(urls, jobId, wantPdf) {
  const pages = new Array(urls.length);
  const failed = [];
  let done = 0, next = 0, lastError = '';

  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      try {
        const data = await fetchRetry(urls[i]);
        const ext = sniffExt(data);
        pages[i] = { index: i, data, ext, pdf: wantPdf ? await pdfImage(data, ext) : null };
      } catch (e) {
        failed.push(i + 1);
        lastError = e.message;
        console.warn('MangaReader: página omitida', urls[i], e);
      }
      done++;
      chrome.runtime.sendMessage({ target: 'background', action: 'progress', jobId, done, total: urls.length })
        .catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, urls.length) }, worker));

  if (!pages.some(Boolean)) throw new Error('No se pudo leer ninguna página' + (lastError ? ` (${lastError})` : ''));
  failed.sort((a, b) => a - b);
  return { pages, failed };
}

async function fetchBytes(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'image/*' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = new Uint8Array(await r.arrayBuffer());
    if (!data.length) throw new Error('respuesta vacía');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Un corte de red o un servidor ocupado se arreglan reintentando; un 403 o un 404, no
async function fetchRetry(url) {
  let err;
  for (let t = 0; t <= FETCH_RETRIES; t++) {
    if (t) await new Promise(r => setTimeout(r, 700 * t));
    try {
      return await fetchBytes(url);
    } catch (e) {
      err = e.name === 'AbortError' ? new Error('tardó demasiado') : e;
      const status = +(/^HTTP (\d+)/.exec(e.message)?.[1] || 0);
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) break;
    }
  }
  throw err;
}

// ── Imagen → objeto de imagen del PDF ────────────────
// Devuelve {data, width, height, cs, bpc, filter, parms?}

async function pdfImage(bytes, ext) {
  // JPG compatible → directo al PDF, sin pérdida
  const info = jpegInfo(bytes);
  if (info) {
    return { data: bytes, width: info.width, height: info.height,
             cs: info.components === 1 ? '/DeviceGray' : '/DeviceRGB', bpc: 8, filter: '/DCTDecode' };
  }
  // PNG sin transparencia → sus mismos datos comprimidos, sin recodificar
  if (ext === 'png') {
    const direct = pngDirect(bytes);
    if (direct) return direct;
  }

  const bmp = await createImageBitmap(new Blob([bytes]));
  const w = bmp.width, h = bmp.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: ext === 'png' });
  ctx.fillStyle = '#fff';               // fondo blanco para PNG/WebP con transparencia
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();

  // PNG con transparencia o entrelazado → sin pérdida igual, con los píxeles ya decodificados
  if (ext === 'png') return flateImage(ctx.getImageData(0, 0, w, h).data, w, h);

  // Cualquier otro formato → JPG de alta calidad
  const jpg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  return { data: new Uint8Array(await jpg.arrayBuffer()), width: w, height: h, cs: '/DeviceRGB', bpc: 8, filter: '/DCTDecode' };
}

// Píxeles RGBA → imagen PDF sin pérdida (en gris si todos los píxeles son grises: pesa un tercio)
async function flateImage(rgba, w, h) {
  let gray = true;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] !== rgba[i + 1] || rgba[i] !== rgba[i + 2]) { gray = false; break; }
  }
  const raw = new Uint8Array(w * h * (gray ? 1 : 3));
  for (let s = 0, d = 0; s < rgba.length; s += 4) {
    raw[d++] = rgba[s];
    if (!gray) { raw[d++] = rgba[s + 1]; raw[d++] = rgba[s + 2]; }
  }
  const packed = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
  const data = new Uint8Array(await new Response(packed).arrayBuffer());
  return { data, width: w, height: h, cs: gray ? '/DeviceGray' : '/DeviceRGB', bpc: 8, filter: '/FlateDecode' };
}

// ── PNG directo ──────────────────────────────────────
// Los datos IDAT de un PNG ya son "Flate + predictor PNG", que es justo lo que entiende
// /FlateDecode con /Predictor 15: se copian tal cual. Sirve para PNG sin entrelazado ni
// transparencia (gris, RGB de 8 bits o paleta). Si no se puede, devuelve null.

function pngDirect(b) {
  if (b.length < 45) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(0) !== 0x89504E47 || dv.getUint32(4) !== 0x0D0A1A0A) return null;

  let pos = 8, ihdr = null, plte = null;
  const idat = [];
  while (pos + 12 <= b.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]);
    const start = pos + 8, end = start + len;
    if (end + 4 > b.length) return null;                     // archivo cortado
    if (type === 'IHDR') {
      ihdr = { w: dv.getUint32(start), h: dv.getUint32(start + 4), depth: b[start + 8], color: b[start + 9], interlace: b[start + 12] };
    } else if (type === 'PLTE') plte = b.subarray(start, end);
    else if (type === 'tRNS') return null;                   // transparencia → se decodifica sobre blanco
    else if (type === 'IDAT') idat.push(b.subarray(start, end));
    else if (type === 'IEND') break;
    pos = end + 4;
  }
  if (!ihdr || !idat.length || !ihdr.w || !ihdr.h || ihdr.interlace) return null;

  let cs, colors;
  if (ihdr.color === 0 && ihdr.depth <= 8) { cs = '/DeviceGray'; colors = 1; }
  else if (ihdr.color === 2 && ihdr.depth === 8) { cs = '/DeviceRGB'; colors = 3; }
  else if (ihdr.color === 3 && plte && plte.length >= 3) {
    const n = Math.min(256, Math.floor(plte.length / 3));
    let hex = '';
    for (let i = 0; i < n * 3; i++) hex += plte[i].toString(16).padStart(2, '0');
    cs = `[/Indexed /DeviceRGB ${n - 1} <${hex}>]`;
    colors = 1;
  } else return null;                                        // con canal alfa o de 16 bits

  const data = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of idat) { data.set(c, o); o += c.length; }
  return { data, width: ihdr.w, height: ihdr.h, cs, bpc: ihdr.depth, filter: '/FlateDecode',
           parms: `<< /Predictor 15 /Colors ${colors} /BitsPerComponent ${ihdr.depth} /Columns ${ihdr.w} >>` };
}

// ── JPEG header parser ───────────────────────────────
// Devuelve {width, height, components} si el JPG se puede incrustar directo
// (baseline/progresivo, 8 bits, gris o RGB). Si no, null → se reconvierte.

function jpegInfo(b) {
  if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xFF) return null;               // estructura inesperada
    const m = b[i + 1];
    if (m === 0xFF) { i++; continue; }            // bytes de relleno
    if (m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    if (m === 0xDA || m === 0xD9) return null;    // llegó a los datos sin encontrar SOF
    const len = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xC0 || m === 0xC1 || m === 0xC2) { // SOF baseline / extendido / progresivo
      const precision = b[i + 4];
      const height = (b[i + 5] << 8) | b[i + 6];
      const width = (b[i + 7] << 8) | b[i + 8];
      const components = b[i + 9];
      if (precision !== 8 || !width || !height) return null;
      if (components !== 1 && components !== 3) return null; // CMYK → reconvertir
      return { width, height, components };
    }
    if (m >= 0xC3 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return null; // lossless/aritmético
    i += 2 + len;
  }
  return null;
}

// ── PDF writer ───────────────────────────────────────
// Objetos: 1 catálogo · 2 árbol de páginas · 3 metadatos · luego 3 por página
// (página, imagen, contenido).

function makePdf(pages, title) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let pos = 0;

  const push = (x) => {
    const u = typeof x === 'string' ? enc.encode(x) : x;
    chunks.push(u);
    pos += u.length;
  };
  const obj = (num, body) => {
    offsets[num] = pos;
    push(`${num} 0 obj\n${body}\nendobj\n`);
  };
  const pageObj = (i) => 4 + i * 3;

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A])); // marca binaria

  obj(1, '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /Direction /R2L >> >>');
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  obj(3, `<< /Title ${pdfText(title || 'Manga')} /Producer (Manga Reader) /CreationDate (D:${pdfDate()}) >>`);

  pages.forEach((p, i) => {
    const scale = Math.min(1, PDF_MAX_SIDE / Math.max(p.width, p.height));
    const w = round2(p.width * scale);
    const h = round2(p.height * scale);
    const pn = pageObj(i), im = pn + 1, ct = pn + 2;

    obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
            `/Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);

    // `gray` es la forma vieja de indicar el espacio de color (solo JPG)
    const cs = p.cs || (p.gray ? '/DeviceGray' : '/DeviceRGB');
    offsets[im] = pos;
    push(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} ` +
         `/ColorSpace ${cs} /BitsPerComponent ${p.bpc || 8} /Filter ${p.filter || '/DCTDecode'}` +
         (p.parms ? ` /DecodeParms ${p.parms}` : '') + ` /Length ${p.data.length} >>\nstream\n`);
    push(p.data);
    push('\nendstream\nendobj\n');

    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(ct, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  });

  const size = 4 + pages.length * 3;
  const xrefPos = pos;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let k = 1; k < size; k++) xref += String(offsets[k]).padStart(10, '0') + ' 00000 n \n';
  push(xref);
  push(`trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}

// Texto PDF en UTF-16BE (soporta acentos, ñ, japonés, etc.)
function pdfText(s) {
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex.toUpperCase()}>`;
}

function pdfDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function round2(n) { return Math.round(n * 100) / 100; }

// ── CBZ ──────────────────────────────────────────────

// Tipo real del archivo según sus primeros bytes (la URL puede mentir)
function sniffExt(b) {
  if (b[0] === 0xFF && b[1] === 0xD8) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'avif';
  return 'jpg';
}

// Metadatos que leen los lectores de cómics (serie, número, sentido de lectura)
function comicInfo(meta, pageCount) {
  const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tag = (name, v) => (v === undefined || v === null || v === '' ? '' : `  <${name}>${x(v)}</${name}>\n`);
  return '<?xml version="1.0" encoding="utf-8"?>\n<ComicInfo>\n' +
    tag('Title', meta.title) + tag('Series', meta.series) + tag('Number', meta.number) +
    tag('StoryArc', meta.arc) + tag('PageCount', pageCount) + tag('Web', meta.web) +
    '  <Manga>YesAndRightToLeft</Manga>\n</ComicInfo>\n';
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ZIP sin compresión (las imágenes ya vienen comprimidas), nombres en UTF-8
function makeZip(files) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let pos = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint16(10, time, true); local.setUint16(12, date, true);
    local.setUint32(14, crc, true); local.setUint32(18, f.data.length, true); local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true); local.setUint16(28, 0, true);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true); cen.setUint16(12, time, true); cen.setUint16(14, date, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, f.data.length, true); cen.setUint32(24, f.data.length, true);
    cen.setUint16(28, name.length, true); cen.setUint32(42, pos, true);
    central.push(new Uint8Array(cen.buffer), name);

    chunks.push(new Uint8Array(local.buffer), name, f.data);
    pos += 30 + name.length + f.data.length;
  }

  const cenSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, pos, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.comicbook+zip' });
}

// Para tests en Node (no afecta a la extensión)
if (typeof module !== 'undefined') {
  module.exports = { jpegInfo, pngDirect, flateImage, makePdf, pdfText, makeZip, comicInfo, sniffExt, crc32 };
}
