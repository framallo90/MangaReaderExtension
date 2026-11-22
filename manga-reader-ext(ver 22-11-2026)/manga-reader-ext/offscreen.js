/**
 * Offscreen document — arma el PDF del capítulo.
 *
 * - Las páginas JPG se meten en el PDF tal cual (sin recomprimir, calidad original).
 * - WebP / PNG / GIF / AVIF se convierten a JPG de alta calidad (el formato PDF no admite WebP).
 * - Cada página del PDF tiene el tamaño exacto de la imagen.
 * - El PDF se marca como lectura derecha → izquierda (para vista de doble página).
 */

const PDF_MAX_SIDE = 14400;   // límite práctico de tamaño de página en visores PDF (200 pulgadas)
const FETCH_CONCURRENCY = 4;

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.target !== 'offscreen') return; // ignorar mensajes de los content scripts

    if (msg.action === 'buildPdf' || msg.action === 'buildCbz') {
      (msg.action === 'buildCbz' ? buildCbz(msg) : buildPdf(msg))
        .then(r => sendResponse({ ok: true, ...r }))
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }

    if (msg.action === 'revoke') {
      try { URL.revokeObjectURL(msg.url); } catch {}
    }
  });
}

// ── Pipeline ─────────────────────────────────────────

// Baja todas las páginas en paralelo (manteniendo el orden) y avisa el progreso
async function loadAll(urls, jobId, loader) {
  const pages = new Array(urls.length);
  let done = 0, failed = 0, next = 0;

  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      try {
        pages[i] = await loader(urls[i]);
      } catch (e) {
        failed++;
        console.warn('MangaReader: página omitida', urls[i], e);
      }
      done++;
      chrome.runtime.sendMessage({ target: 'background', action: 'pdfProgress', jobId, done, total: urls.length })
        .catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, urls.length) }, worker));

  const ok = pages.filter(Boolean);
  if (!ok.length) throw new Error('No se pudo leer ninguna página');
  return { ok, failed };
}

function blobResult(blob, pages, failed) {
  return { url: URL.createObjectURL(blob), pages, failed, sizeKB: Math.round(blob.size / 1024) };
}

async function buildPdf({ urls, title, jobId }) {
  const { ok, failed } = await loadAll(urls, jobId, loadPage);
  return blobResult(makePdf(ok, title), ok.length, failed);
}

// CBZ = ZIP con las imágenes originales (sin tocar) + ComicInfo.xml
async function buildCbz({ urls, meta, jobId }) {
  const { ok, failed } = await loadAll(urls, jobId, async (url) => {
    const data = await fetchBytes(url);
    return { data, ext: sniffExt(data) };
  });
  const width = Math.max(3, String(ok.length).length);
  const files = ok.map((p, i) => ({ name: `${String(i + 1).padStart(width, '0')}.${p.ext}`, data: p.data }));
  files.push({ name: 'ComicInfo.xml', data: new TextEncoder().encode(comicInfo(meta || {}, ok.length)) });
  return blobResult(makeZip(files), ok.length, failed);
}

async function fetchBytes(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'image/*' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return new Uint8Array(await r.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function loadPage(url) {
  const bytes = await fetchBytes(url);

  // JPG compatible → directo al PDF, sin pérdida
  const info = jpegInfo(bytes);
  if (info) return { data: bytes, width: info.width, height: info.height, gray: info.components === 1 };

  // Cualquier otro formato → JPG de alta calidad
  const bmp = await createImageBitmap(new Blob([bytes]));
  const w = bmp.width, h = bmp.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';               // fondo blanco para PNG/WebP con transparencia
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const jpg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  return { data: new Uint8Array(await jpg.arrayBuffer()), width: w, height: h, gray: false };
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

    offsets[im] = pos;
    push(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} ` +
         `/ColorSpace /${p.gray ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 ` +
         `/Filter /DCTDecode /Length ${p.data.length} >>\nstream\n`);
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
if (typeof module !== 'undefined') module.exports = { jpegInfo, makePdf, pdfText, makeZip, comicInfo, sniffExt, crc32 };
