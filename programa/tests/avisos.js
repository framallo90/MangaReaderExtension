// Los botones del aviso de fin de cola, apretados de verdad. Corre dentro de Electron con la
// interfaz oculta (así el programa avisa: no tiene el foco), y aprieta cada botón con
// tests/clic-aviso.ps1 (UI Automation de Windows, sin mover el mouse). Muestra avisos en la
// pantalla y abre una ventana del Explorador (la cierra al terminar): no es parte de
// "npm run prueba". Uso: npm run avisos
//
// Cada botón tiene que hacer lo mismo que su botón de la ventana:
//   "Reintentar 1 que falló"  vuelve a la cola el capítulo que falló, respetando el freno del sitio
//   "Limpiar terminados"      saca de la lista lo terminado
//   "Abrir carpeta"           abre la carpeta de descargas en el Explorador
// Windows no muestra el primer aviso después de que Electron crea su acceso directo en el menú
// Inicio (va directo al centro de notificaciones): si un aviso no aparece, se muestra otra vez.
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn, execFileSync } = require('child_process');
const { iniciar } = require('./sitio');
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const hora = () => { const d = new Date(), p = (x, n = 2) => String(x).padStart(n, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

// Aprieta el botón `texto` del aviso del programa. Devuelve { codigo, salida } (codigo 0 = apretado)
function apretar(texto, segundos = 15) {
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'clic-aviso.ps1'),
      '-Texto', texto, '-Titulo', 'Manga Reader: terminó la cola', '-Segundos', String(segundos)], { windowsHide: true });
    let salida = '';
    ps.stdout.on('data', (d) => { salida += d; });
    ps.stderr.on('data', (d) => { salida += d; });
    ps.on('close', (codigo) => resolve({ codigo, salida: salida.trim() }));
    ps.on('error', (e) => resolve({ codigo: -1, salida: e.message }));
  });
}

// Saca del centro de notificaciones (y de la pantalla) los avisos del programa: si quedara uno de
// una corrida anterior, el clic le podría llegar a ese, que es de un proceso que ya no está
const limpiarAvisos = () => {
  const ps = "[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]; [Windows.UI.Notifications.ToastNotificationManager]::History.Clear('ar.mangareader.programa')";
  try { execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true }); return true; } catch { return false; }
};

// Las ventanas del Explorador abiertas en una carpeta (por PowerShell), y cerrarlas
const explorador = (carpeta, cerrar) => {
  const ps = `$r = @(); foreach ($w in (New-Object -ComObject Shell.Application).Windows()) { try { $p = $w.Document.Folder.Self.Path } catch { $p = '' }
    if ($p -and ($p.TrimEnd('\\') -eq '${carpeta.replace(/'/g, "''")}'.TrimEnd('\\'))) { $r += $p; ${cerrar ? '$w.Quit();' : ''} } }; $r.Count`;
  try { return +execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true }).trim() || 0; } catch { return -1; }
};

module.exports = async function probar(api) {
  let fallas = 0;
  const eq = (etiqueta, obtenido, esperado) => {
    if (obtenido !== esperado) fallas++;
    console.log((obtenido === esperado ? 'OK   ' : 'FALLA') + ` [${hora()}] ${etiqueta} → ${obtenido}` + (obtenido === esperado ? '' : '   (esperado: ' + esperado + ')'));
  };
  const sitio = await iniciar();
  const S = sitio.url;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-avisos-'));
  const soloPdf = { pdf: true, cbz: false, imgs: false };
  const estados = (cola) => cola.map(t => `${t.nombre || t.texto}: ${t.estado}`).join(' ; ');
  console.log(`== Avisos de Windows con botones · ${hora()} · Windows ${os.release()} · Electron ${process.versions.electron}`);
  try {
    api.guardarConfig({ carpeta: tmp, formatos: soloPdf });
    const ui = await api.abrirUI(false);          // oculta: sin el foco, el programa avisa al terminar la cola
    for (let i = 0; i < 50 && !(await ui.webContents.executeJavaScript('document.readyState === "complete" && !!window.mr').catch(() => false)); i++) await dormir(200);

    // Aprieta un botón del aviso que acaba de salir; si no aparece en pantalla, lo muestra otra vez
    const tocar = async (texto) => {
      for (let intento = 1; intento <= 3; intento++) {
        const r = await apretar(texto);
        const lineas = r.salida.split(/\r?\n/).filter(l => /OK:|NO APARECIÓ|NO SE PUDO|encontr/i.test(l));
        console.log(`      (intento ${intento}, ${hora()}: código ${r.codigo}${lineas.length ? ' · ' + lineas.slice(-2).join(' · ') : ''})`);
        if (r.codigo === 0) return `apretado al intento ${intento}`;
        if (r.codigo !== 1) return `no se pudo apretar (código ${r.codigo})`;
        api.mostrarAvisoDeFin();
      }
      return 'el aviso no apareció';
    };

    limpiarAvisos();
    // 1) Reintentar: el capítulo 1 del sitio ocupado responde 503 sin Retry-After la primera vez: el
    //    sitio queda frenado un minuto. El clic llega mucho antes, y el reintento igual espera el minuto.
    api.encolar([{ url: `${S}/leer/ocupado-1/`, texto: 'Capítulo 1', numero: 1 }], { carpeta: tmp, serie: 'Avisos', formatos: soloPdf });
    await api.colaVacia();
    const aviso1 = api.avisoDeFin();
    console.log(`  aviso: "${aviso1?.titulo}" · ${aviso1?.cuerpo} · botones: ${aviso1?.botones.map(b => b.texto).join(' | ')}`);
    const tocado1 = await tocar('Reintentar 1 que falló');
    const alTocar = Date.now();
    await dormir(500);
    const fin1 = estados(await api.colaVacia(120000));
    const h = sitio.pedidos.horas['/leer/ocupado-1/'] || [];
    const seg = (ms) => (ms / 1000).toFixed(1);
    console.log(`      (el 503 a las ${new Date(h[0]).toLocaleTimeString('es-AR')}; el clic a los ${seg(alTocar - h[0])} s; el reintento ${h[1] ? `a los ${seg(h[1] - h[0])} s` : 'no salió'})`);
    eq('clic real en "Reintentar 1 que falló" (503 sin Retry-After): el clic llega antes del minuto, el reintento sale recién al minuto del 503 (el freno del sitio) y se guarda',
      `apretado: ${tocado1.startsWith('apretado')} · clic ${alTocar - h[0] < 50000 ? 'antes de los 50 s' : 'tarde'} · ${h.length} pedidos · ${h.length >= 2 && h[1] - h[0] >= 59000 && h[1] - h[0] < 75000 ? 'el reintento, entre los 59 y los 75 s' : h[1] ? 'el reintento a los ' + seg(h[1] - h[0]) + ' s' : 'el reintento no salió'} · ${fin1}`,
      'apretado: true · clic antes de los 50 s · 2 pedidos · el reintento, entre los 59 y los 75 s · Avisos/Avisos 0001: listo');

    // 2) Limpiar terminados: el aviso del final de ese reintento
    const aviso2 = api.avisoDeFin();
    console.log(`  aviso: "${aviso2?.titulo}" · ${aviso2?.cuerpo} · botones: ${aviso2?.botones.map(b => b.texto).join(' | ')}`);
    const tocado2 = await tocar('Limpiar terminados');
    await dormir(800);
    eq('clic real en "Limpiar terminados": la lista queda vacía, en el programa y en la ventana',
      `${tocado2.startsWith('apretado')} · ${api.verCola().length} · ${await ui.webContents.executeJavaScript(`document.querySelector('#cola').textContent`)}`, 'true · 0 · Todavía no hay nada en la cola.');

    limpiarAvisos();
    // 3) Abrir carpeta: otro capítulo, y el aviso de su final
    api.encolar([{ url: `${S}/leer/alfa-1/`, texto: 'Capítulo 1', numero: 1 }], { carpeta: tmp, serie: 'Avisos', formatos: soloPdf });
    await api.colaVacia();
    const antes = explorador(tmp, false);
    const tocado3 = await tocar('Abrir carpeta');
    let abiertas = 0;
    for (let i = 0; i < 20 && !(abiertas = explorador(tmp, false)); i++) await dormir(500);
    eq('clic real en "Abrir carpeta": se abre el Explorador en la carpeta de descargas', `${tocado3.startsWith('apretado')} · antes ${antes} · después ${abiertas > 0 ? 'abierta' : abiertas}`, 'true · antes 0 · después abierta');
    explorador(tmp, true);
  } finally {
    limpiarAvisos();
    await sitio.cerrar();
    await dormir(500);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
  console.log(fallas ? `\n${fallas} FALLAS` : '\nTODO OK');
  return fallas;
};
