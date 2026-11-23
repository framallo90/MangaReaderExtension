// Arma lo pedido con build() (de offscreen.js) y le pasa cada archivo al proceso principal
// para que lo escriba. msg: { urls, formats, title, meta, jobId, path }
// Devuelve { pages, failed: [n…], archivos: [{kind, sizeKB, rel} | {kind, error}], esperar }
// `esperar`: { status, retryAfter } si alguna página faltó porque el sitio pidió esperar (429 o
// 503); si no, null. Si no se pudo armar nada devuelve { error, esperar } en vez de tirar el
// error: al cruzar al proceso principal un Error pierde lo que lleve de más, y `esperar` hace falta allá.
window.armar = async (msg) => {
  let r;
  try { r = await build(msg); } catch (e) { return { error: String((e && e.message) || e), esperar: (e && e.esperar) || null }; }
  const out = { pages: r.pages, failed: r.failed || [], archivos: [], esperar: r.esperar || null };
  for (const f of r.files) {
    const rel = f.kind === 'img' ? `${msg.path}/${f.name}` : `${msg.path}.${f.kind}`;
    try {
      const bytes = new Uint8Array(await (await fetch(f.url)).arrayBuffer());
      const g = await window.mrArmador.guardar(msg.jobId, rel, bytes);
      out.archivos.push({ kind: f.kind, sizeKB: f.sizeKB, rel: g.rel });
    } catch (e) {
      out.archivos.push({ kind: f.kind, error: String(e && e.message || e) });
    } finally {
      URL.revokeObjectURL(f.url);
    }
  }
  return out;
};
