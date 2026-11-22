// Arnés para probar la extensión en un navegador real, sin dependencias: lanza un Chromium
// sin interfaz con la extensión cargada y lo maneja por su protocolo de depuración.
// Lo usan tests/e2e.js (sitio de prueba local) y tests/probar_sitio.js (un sitio real).
//
// Necesita un Chromium que acepte --load-extension: sirve el que instala Playwright
// (%LOCALAPPDATA%\ms-playwright\chromium-*) o el indicado en la variable CHROMIUM.
// El Chrome común ya no acepta esa opción.
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn, execFileSync } = require('child_process');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const root = path.join(__dirname, '..');
const ultimaVersion = () => execFileSync('node', [path.join(__dirname, 'ultima_version.js')]).toString().trim();

function findChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  try {
    const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]);
    for (const d of dirs) {
      const exe = path.join(base, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(exe)) return exe;
    }
  } catch {}
  return '';
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.n = 0; this.pending = new Map(); this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (!m.id) { for (const f of this.listeners) f(m); return; }      // aviso del navegador, no una respuesta
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.n;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  // Abre una pestaña y devuelve cómo manejarla
  async open(url) {
    const { targetId } = await this.send('Target.createTarget', { url });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const cdp = this;
    // Mundos de JavaScript de la pestaña: el de la página y, aparte, el de cada extensión
    let contexts = [], watching = false;
    this.listeners.push((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.executionContextCreated') contexts.push(m.params.context);
      if (m.method === 'Runtime.executionContextsCleared') contexts = [];
      if (m.method === 'Runtime.executionContextDestroyed') contexts = contexts.filter(c => c.id !== m.params.executionContextId);
    });
    return {
      targetId,
      // Evalúa dentro del mundo del content script de la extensión (no el de la página)
      async evalInExtension(extId, expr) {
        if (!watching) { watching = true; await cdp.send('Runtime.enable', {}, sessionId); await sleep(300); }
        const ctx = [...contexts].reverse().find(c => String(c.origin).includes(extId));
        if (!ctx) throw new Error('La pestaña no tiene el script de la extensión');
        const r = await cdp.send('Runtime.evaluate', { expression: expr, contextId: ctx.id, awaitPromise: true, returnByValue: true }, sessionId);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      async eval(expr) {
        const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      async waitFor(expr, label, ms = 20000) {
        const end = Date.now() + ms;
        for (;;) {
          let v; try { v = await this.eval(expr); } catch {}
          if (v) return v;
          if (Date.now() > end) throw new Error('No llegó: ' + label);
          await sleep(200);
        }
      },
      async screenshot(file) {
        const r = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      },
      close: () => cdp.send('Target.closeTarget', { targetId }).catch(() => {}),
    };
  }
}

// Lanza el navegador con la extensión de la carpeta `ext`. Las descargas van a una carpeta
// temporal (no a la carpeta Descargas real), que se borra al cerrar.
async function lanzar(ext) {
  const chromium = findChromium();
  if (!chromium) return null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-e2e-'));
  const dl = path.join(tmp, 'descargas');
  fs.mkdirSync(path.join(tmp, 'perfil', 'Default'), { recursive: true });
  fs.mkdirSync(dl);
  fs.writeFileSync(path.join(tmp, 'perfil', 'Default', 'Preferences'),
    JSON.stringify({ download: { default_directory: dl, prompt_for_download: false, directory_upgrade: true } }));

  // CON_VENTANA=1: navegador con ventana (minimizada) en vez de sin interfaz. Ahí las pestañas
  // en segundo plano se comportan como en el Chrome de todos los días: no dibujan y sus
  // temporizadores van lentos.
  const modo = process.env.CON_VENTANA ? '--start-minimized' : '--headless=new';
  const proc = spawn(chromium, [modo, '--remote-debugging-port=0', `--user-data-dir=${path.join(tmp, 'perfil')}`,
    `--load-extension=${ext}`, `--disable-extensions-except=${ext}`, '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', 'about:blank']);
  let cerrado = false;
  const cerrar = async () => {
    if (cerrado) return; cerrado = true;
    try { proc.kill(); } catch {}
    await sleep(800);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  };

  try {
    const wsUrl = await new Promise((res, rej) => {
      let err = '';
      proc.stderr.on('data', (d) => { err += d; const m = err.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
      proc.on('exit', () => rej(new Error('Chromium se cerró: ' + err.slice(-300))));
      setTimeout(() => rej(new Error('Chromium no arrancó')), 30000);
    });
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('No pude conectarme a Chromium'))); });
    const cdp = new Cdp(ws);
    // No se usa Browser.setDownloadBehavior: con eso Chromium renombra cada descarga con un
    // código y no se podría ver si la extensión arma bien nombres y carpetas.

    // Chromium trae extensiones propias; la nuestra es la que puede abrir opciones.html.
    // Esa página hace después de "popup": desde ahí se mandan los mismos mensajes.
    const b = { cdp, dl, tmp, cerrar, extId: '', ext: null, nombre: path.basename(path.dirname(path.dirname(chromium))) };
    b.abrirOpciones = async () => {
      b.ext = await cdp.open(`chrome-extension://${b.extId}/opciones.html`);
      await b.ext.waitFor(`document.readyState === 'complete' && location.protocol === 'chrome-extension:' && !!chrome.tabs`, 'la página de opciones');
    };
    for (let i = 0; i < 40 && !b.ext; i++) {
      const { targetInfos } = await cdp.send('Target.getTargets');
      const ids = [...new Set(targetInfos.filter(t => t.url.startsWith('chrome-extension://')).map(t => t.url.split('/')[2]))];
      for (const id of ids) {
        const pg = await cdp.open(`chrome-extension://${id}/opciones.html`);
        const ok = await pg.waitFor(`document.readyState === 'complete' && location.protocol !== 'about:' && (location.protocol === 'chrome-extension:' && !!chrome.tabs ? 'si' : 'no')`, 'una página', 8000).catch(() => 'no');
        if (ok === 'si') { b.ext = pg; b.extId = id; break; }
        await pg.close();
      }
      if (!b.ext) await sleep(300);
    }
    if (!b.ext) throw new Error('La extensión no cargó (¿este Chromium acepta --load-extension?)');

    // Lo mismo que hace el popup: pedirle al service worker que abra un diálogo en la pestaña
    b.command = (url, cmd) => b.ext.eval(`(async () => {
      const [tab] = await chrome.tabs.query({ url: ${JSON.stringify(url)} });
      return (await chrome.runtime.sendMessage({ action: 'tab', tabId: tab.id, command: ${JSON.stringify(cmd)} })).ok; })()`);
    b.storage = (key) => b.ext.eval(`chrome.storage.local.get([${JSON.stringify(key)}]).then(s => s[${JSON.stringify(key)}])`);
    b.setStorage = (obj) => b.ext.eval(`chrome.storage.local.set(${JSON.stringify(obj)})`);
    b.tabCount = () => b.ext.eval('chrome.tabs.query({}).then(t => t.length)');
    b.existe = (rel) => fs.existsSync(path.join(dl, 'MangaReader', rel));
    b.ls = (rel) => { try { return fs.readdirSync(path.join(dl, 'MangaReader', rel)).sort().join(' '); } catch { return '(no existe)'; } };
    return b;
  } catch (e) {
    await cerrar();
    throw e;
  }
}

// ── Ayudas para el diálogo de varios capítulos ──
const lote = {
  fin: (pg, ms = 180000) => pg.waitFor(`(() => { const s = document.querySelector('#mr-chapter-status'); return s && /^(✅ )?(Listo|Cancelado|Parado)/.test(s.textContent) ? s.textContent : '' })()`, 'fin del lote', ms),
  filas: (pg) => pg.eval(`[...document.querySelectorAll('#mr-chapter .mr-chapter-item')].map(r => r.querySelector('.mr-chapter-n').textContent + (r.querySelector('input').checked ? '*' : '') + (r.querySelector('.mr-chapter-s').textContent ? ' [' + r.querySelector('.mr-chapter-s').textContent + ']' : '')).join(' | ')`),
  rango: (pg, a, b) => pg.eval(`(() => { const f = document.querySelector('#mr-chapter-from'), t = document.querySelector('#mr-chapter-to'); f.value = '${a}'; t.value = '${b}'; document.querySelector('#mr-chapter-range').click(); })()`),
};

// ── Lectura de lo descargado ──
function zipNames(file) {
  const b = fs.readFileSync(file), names = [];
  const eocd = b.length - 22;
  let p = b.readUInt32LE(eocd + 16);
  for (let i = 0; i < b.readUInt16LE(eocd + 10); i++) {
    const n = b.readUInt16LE(p + 28);
    names.push(b.subarray(p + 46, p + 46 + n).toString());
    p += 46 + n + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
  return names;
}

// "6 × 420x640". Con Python + PyMuPDF abre el PDF de verdad y dibuja cada página; si no
// están, solo cuenta las páginas mirando el archivo.
let pyOk = null;
function pdfPages(file) {
  if (pyOk !== false) {
    try {
      const out = execFileSync('python', ['-c',
        'import fitz,sys\nd=fitz.open(sys.argv[1])\ns=set()\nfor p in d:\n  x=p.get_pixmap()\n  assert x.width>0 and len(x.samples)>0\n  s.add("%dx%d"%(round(p.rect.width),round(p.rect.height)))\nprint(str(len(d))+"|"+",".join(sorted(s)))',
        file], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
      pyOk = true;
      return out.replace('|', ' × ');
    } catch (e) {
      if (pyOk) return 'ERROR al abrir el PDF: ' + String(e.stderr || e.message).trim().split('\n').pop();
      pyOk = false;
    }
  }
  const t = fs.readFileSync(file).toString('latin1');
  const sizes = [...new Set((t.match(/\/MediaBox \[0 0 [\d.]+ [\d.]+\]/g) || []).map(s => s.slice(15, -1).replace(' ', 'x')))];
  return (t.match(/\/Type \/Page /g) || []).length + ' × ' + sizes.join(',');
}

module.exports = { lanzar, lote, zipNames, pdfPages, sleep, root, ultimaVersion, findChromium };
