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
// Cada aviso se aprieta al primer intento: si no aparece en pantalla, falla (no se vuelve a mostrar).
// Hasta la 0.10.3, el primer aviso después de que Electron creaba su acceso directo en el menú Inicio
// iba directo al centro de notificaciones, y la prueba lo mostraba otra vez. Desde la 0.10.4 el
// programa prepara los avisos al arrancar (prepararAvisos en main.js) y el primero ya sale en
// pantalla. Para probarlo desde cero: npm run avisos:limpio (borra antes el acceso directo y las
// claves del programa con tests/limpiar-avisos.ps1).
//
// Sobre el programa instalado (con las pruebas de esta carpeta):
//   "%LOCALAPPDATA%\Programs\Manga Reader\Manga Reader.exe" --prueba --avisos --pruebas=<esta carpeta>
// (los pasos completos, en la sección 11 de DOCUMENTACION.md)
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn, execFileSync } = require('child_process');
const { iniciar } = require('./sitio');
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const hora = () => { const d = new Date(), p = (x, n = 2) => String(x).padStart(n, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

// Aprieta el botón `texto` del aviso del programa cuando aparezca en pantalla (lo espera hasta
// `segundos`). Devuelve { mirando, fin }: `mirando` se cumple cuando el script ya está buscando el
// aviso (tarda de 2 a 5 s en arrancar), y `fin`, con { codigo, salida } (codigo 0 = apretado).
function apretar(texto, segundos = 15) {
  let yaMira = null;
  const mirando = new Promise((r) => { yaMira = r; });
  const fin = new Promise((resolve) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'clic-aviso.ps1'),
      '-Texto', texto, '-Titulo', 'Manga Reader: terminó la cola', '-Segundos', String(segundos)], { windowsHide: true });
    let salida = '';
    ps.stdout.on('data', (d) => { salida += d; if (/Busco el aviso/.test(salida)) yaMira(); });
    ps.stderr.on('data', (d) => { salida += d; });
    ps.on('close', (codigo) => { yaMira(); resolve({ codigo, salida: salida.trim() }); });
    ps.on('error', (e) => { yaMira(); resolve({ codigo: -1, salida: e.message }); });
  });
  return { mirando, fin };
}

// Espera a que no quede en pantalla ningún aviso del programa con el botón `texto`. Un aviso que
// ya se apretó (o se limpió) tarda un momento en irse; si el que aprieta el siguiente arranca antes,
// lo encuentra a él, y cuando lo va a apretar ya no está. Pasó el 26-11-2026 sobre el programa
// instalado: "Limpiar terminados" encontró el aviso anterior a los 2,8 s de apretado, y dio "no se
// pudo apretar" (código 2) sin que el aviso que le tocaba hubiera salido todavía. Mira con el mismo
// script, sin apretar nada (-Explorar), hasta que no lo encuentra. Devuelve cuánto esperó, en ms.
async function sinAvisoEnPantalla(texto, hastaMs = 20000) {
  const t0 = Date.now();
  for (;;) {
    const codigo = await new Promise((resolve) => {
      const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'clic-aviso.ps1'),
        '-Texto', texto, '-Titulo', 'Manga Reader: terminó la cola', '-Segundos', '1', '-Explorar'], { windowsHide: true, stdio: 'ignore' });
      ps.on('close', resolve);
      ps.on('error', () => resolve(-1));
    });
    if (codigo !== 0 || Date.now() - t0 > hastaMs) return Date.now() - t0;      // (0: lo encontró, sigue en pantalla)
  }
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
  console.log(`  programa: ${api.empaquetado ? 'instalado' : 'sin instalar (npm)'} · ${api.ejecutable}`);
  // Lo que hizo al arrancar: si el acceso directo no estaba (instalación limpia), lo tuvo que preparar
  const alArrancar = api.estadoAvisos ? api.estadoAvisos() : '(esta versión no lo dice)';
  console.log(`  al arrancar: ${alArrancar}${/ya estaba/.test(alArrancar) ? '' : ' → corrida desde cero: el primer aviso es el primero que ve Windows'}`);
  try {
    api.guardarConfig({ carpeta: tmp, formatos: soloPdf });
    const ui = await api.abrirUI(false);          // oculta: sin el foco, el programa avisa al terminar la cola
    for (let i = 0; i < 50 && !(await ui.webContents.executeJavaScript('document.readyState === "complete" && !!window.mr').catch(() => false)); i++) await dormir(200);

    // Aprieta un botón del aviso que va a salir, al primer intento: si no aparece en pantalla, no se
    // vuelve a mostrar (eso escondía que el primer aviso no salía). El que aprieta arranca antes de
    // que salga el aviso y ya está mirando la pantalla cuando aparece, como una persona: un aviso
    // dura unos 5 s en pantalla y el script tarda de 2 a 5 en arrancar, así que si arrancara después
    // a veces llegaría tarde (pasó el 25-11-2026 a las 20:01: lo encontró cuando ya se iba).
    // Devuelve { mirando, fin }: `fin` es 'apretado' o por qué no.
    const tocar = (texto, segundos = 40) => {
      const a = apretar(texto, segundos);
      const fin = a.fin.then((r) => {
        const lineas = r.salida.split(/\r?\n/).filter(l => /OK:|NO APARECIÓ|NO SE PUDO|ERROR|falló|encontr/i.test(l));
        console.log(`      (${hora()}: código ${r.codigo}${lineas.length ? ' · ' + lineas.slice(-2).join(' · ') : ''})`);
        if (r.codigo === 0) return 'apretado';
        if (r.codigo === 1 && /NO APARECIÓ EN PANTALLA/.test(r.salida)) return 'el aviso existe pero Windows no lo mostró en pantalla (¿la pantalla está apagada, o está puesto No molestar?)';
        if (r.codigo === 1) return 'el aviso no apareció en pantalla';
        return `no se pudo apretar (código ${r.codigo})`;
      });
      return { mirando: a.mirando, fin };
    };
    const desdeCero = !/ya estaba/.test(alArrancar);

    limpiarAvisos();
    // 1) Reintentar: el capítulo 1 del sitio ocupado responde 503 sin Retry-After la primera vez: el
    //    sitio queda frenado un minuto. El clic llega mucho antes, y el reintento igual espera el minuto.
    //    Desde cero, la cola sale ya: el programa retiene ese primer aviso unos segundos (es lo que se
    //    prueba) y el que aprieta llega a tiempo. Con el acceso directo ya creado, el aviso sale apenas
    //    termina la cola: se espera a que el que aprieta esté mirando.
    const clic1 = tocar('Reintentar 1 que falló');
    if (!desdeCero) await clic1.mirando;
    api.encolar([{ url: `${S}/leer/ocupado-1/`, texto: 'Capítulo 1', numero: 1 }], { carpeta: tmp, serie: 'Avisos', formatos: soloPdf });
    await api.colaVacia();
    const aviso1 = api.avisoDeFin();
    console.log(`  aviso: "${aviso1?.titulo}" · ${aviso1?.cuerpo} · botones: ${aviso1?.botones.map(b => b.texto).join(' | ')}`);
    const tocado1 = await clic1.fin;
    const alTocar = Date.now();
    eq('el primer aviso de fin de cola sale en pantalla y se aprieta al primer intento, sin volver a mostrarlo', tocado1, 'apretado');
    if (api.estadoAvisos) console.log(`      (lo que hizo al arrancar, ya terminado: ${api.estadoAvisos()})`);
    await dormir(500);
    // (el primer aviso ya se usó: se saca, se espera a que se haya ido de la pantalla —también tiene
    // un botón "Limpiar terminados"— y el que aprieta el botón del siguiente lo espera desde ahora:
    // sale cuando termina el reintento, al minuto)
    limpiarAvisos();
    console.log(`      (el aviso anterior se fue de la pantalla a los ${((await sinAvisoEnPantalla('Limpiar terminados')) / 1000).toFixed(1)} s de limpiarlo)`);
    const clic2 = tocar('Limpiar terminados', 110);
    const fin1 = estados(await api.colaVacia(120000));
    const h = sitio.pedidos.horas['/leer/ocupado-1/'] || [];
    const seg = (ms) => (ms / 1000).toFixed(1);
    console.log(`      (el 503 a las ${new Date(h[0]).toLocaleTimeString('es-AR', { hour12: false })}; el clic a los ${seg(alTocar - h[0])} s; el reintento ${h[1] ? `a los ${seg(h[1] - h[0])} s` : 'no salió'})`);
    eq('clic real en "Reintentar 1 que falló" (503 sin Retry-After): el clic llega antes del minuto, el reintento sale recién al minuto del 503 (el freno del sitio) y se guarda',
      `apretado: ${tocado1.startsWith('apretado')} · clic ${alTocar - h[0] < 50000 ? 'antes de los 50 s' : 'tarde'} · ${h.length} pedidos · ${h.length >= 2 && h[1] - h[0] >= 59000 && h[1] - h[0] < 75000 ? 'el reintento, entre los 59 y los 75 s' : h[1] ? 'el reintento a los ' + seg(h[1] - h[0]) + ' s' : 'el reintento no salió'} · ${fin1}`,
      'apretado: true · clic antes de los 50 s · 2 pedidos · el reintento, entre los 59 y los 75 s · Avisos/Avisos 0001: listo');

    // 2) Limpiar terminados: el aviso del final de ese reintento
    const aviso2 = api.avisoDeFin();
    console.log(`  aviso: "${aviso2?.titulo}" · ${aviso2?.cuerpo} · botones: ${aviso2?.botones.map(b => b.texto).join(' | ')}`);
    const tocado2 = await clic2.fin;
    await dormir(800);
    eq('clic real en "Limpiar terminados": la lista queda vacía, en el programa y en la ventana',
      `${tocado2.startsWith('apretado')} · ${api.verCola().length} · ${await ui.webContents.executeJavaScript(`document.querySelector('#cola').textContent`)}`, 'true · 0 · Todavía no hay nada en la cola.');

    limpiarAvisos();
    console.log(`      (el aviso anterior se fue de la pantalla a los ${((await sinAvisoEnPantalla('Abrir carpeta')) / 1000).toFixed(1)} s de limpiarlo)`);
    // 3) Abrir carpeta: otro capítulo, y el aviso de su final
    const antes = explorador(tmp, false);
    const clic3 = tocar('Abrir carpeta');
    await clic3.mirando;
    api.encolar([{ url: `${S}/leer/alfa-1/`, texto: 'Capítulo 1', numero: 1 }], { carpeta: tmp, serie: 'Avisos', formatos: soloPdf });
    await api.colaVacia();
    const tocado3 = await clic3.fin;
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
