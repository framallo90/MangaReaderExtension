// Arma lo pedido con build() (de offscreen.js) y le pasa cada archivo al proceso principal
// para que lo escriba. msg: { urls, formats, title, meta, jobId, path }
// Devuelve { pages, failed: [n…], archivos: [{kind, sizeKB, rel} | {kind, error}] }
window.armar = async (msg) => {
  const r = await build(msg);
  const out = { pages: r.pages, failed: r.failed || [], archivos: [] };
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
