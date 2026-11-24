<#
  clic-aviso.ps1: busca un aviso de Windows con UI Automation y aprieta uno de sus botones,
  sin tocar el mouse (InvokePattern; si el botón no lo tiene, LegacyIAccessible/MSAA
  DoDefaultAction).

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File tests/clic-aviso.ps1 -Texto 'Limpiar terminados'
  Lo usa tests/avisos.js (npm run avisos), que muestra el aviso del programa y lo aprieta.

  Parámetros:
    -Texto     nombre del botón a apretar (obligatorio)
    -Titulo    texto que identifica el aviso (por defecto el del fin de cola del programa)
    -Segundos  cuánto esperar a que aparezca (por defecto 30)
    -Pausa     milisegundos entre encontrar el aviso y apretar (por defecto 1500: recién aparecido, un toque se puede perder)
    -Metodo    Auto (Invoke y, si no se puede, Legacy) | Invoke | Legacy
    -Captura   PNG donde guardar la imagen del aviso antes de apretar (opcional)
    -Explorar  describe el árbol del aviso y no aprieta nada
    -Eventos   archivo de eventos de una app que los anote: después de apretar espera hasta 10 s
               a que aparezca 'action' o 'click' y lo muestra
    -Salida    archivo donde dejar también todo lo que se imprime (UTF-8)

  Código de salida: 0 apretado (y, con -Eventos, llegó el evento), 1 no apareció,
  2 no se pudo apretar, 3 apretado pero el evento no llegó.
#>
param(
  [Parameter(Mandatory = $true)][string]$Texto,
  [string]$Titulo = 'Manga Reader: terminó la cola',
  [int]$Segundos = 30,
  [int]$Pausa = 1500,
  [ValidateSet('Auto', 'Invoke', 'Legacy')][string]$Metodo = 'Auto',
  [string]$Captura = '',
  [switch]$Explorar,
  [string]$Eventos = '',
  [string]$Salida = ''
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch { }

$script:lineas = New-Object System.Collections.Generic.List[string]
function Write-Linea([string]$t) {
  $l = (Get-Date).ToString('HH:mm:ss.fff') + ' ' + $t
  $script:lineas.Add($l)
  [Console]::Out.WriteLine($l)
}

$codigo = @'
using System;
using System.Runtime.InteropServices;
using Accessibility;

public static class AyudaAviso {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();

  [StructLayout(LayoutKind.Sequential)] public struct PUNTO { public int X; public int Y; }

  [DllImport("oleacc.dll")]
  static extern int AccessibleObjectFromPoint(PUNTO pt, [MarshalAs(UnmanagedType.Interface)] out IAccessible acc, out object hijo);

  [DllImport("oleacc.dll")]
  static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint idObjeto, ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object obj);

  [DllImport("oleacc.dll")]
  static extern int AccessibleChildren(IAccessible contenedor, int desde, int cuantos, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 4)] object[] hijos, ref int obtenidos);

  const int ROL_BOTON = 0x2B;   // ROLE_SYSTEM_PUSHBUTTON

  // Ventanas de primer nivel de una clase. Con FindWindowEx y no con EnumWindows: EnumWindows
  // (y los hijos de RootElement) no devuelven las ventanas "inmersivas" del Shell, como la
  // CoreWindow del aviso; FindWindowEx si.
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr padre, IntPtr despues, string clase, string titulo);
  public static IntPtr[] VentanasDeClase(string clase) {
    var l = new System.Collections.Generic.List<IntPtr>();
    IntPtr h = IntPtr.Zero;
    while (l.Count < 500) {
      h = FindWindowEx(IntPtr.Zero, h, clase, null);
      if (h == IntPtr.Zero) break;
      l.Add(h);
    }
    return l.ToArray();
  }

  // LegacyIAccessible por el arbol MSAA de la ventana: busca un boton con ese nombre.
  public static string PorVentana(IntPtr hwnd, string nombre, bool apretar) {
    Guid iid = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
    object o;
    int hr = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref iid, out o);   // OBJID_CLIENT
    if (hr != 0 || o == null) return "AccessibleObjectFromWindow fallo: 0x" + hr.ToString("X8");
    IAccessible raiz = o as IAccessible;
    if (raiz == null) return "la ventana no dio un IAccessible";
    string r = Buscar(raiz, nombre, apretar, 0);
    return r ?? ("no esta el boton '" + nombre + "' en el arbol MSAA de la ventana");
  }

  static string Buscar(IAccessible acc, string nombre, bool apretar, int nivel) {
    if (nivel > 30) return null;
    int n;
    try { n = acc.accChildCount; } catch { return null; }
    if (n <= 0) return null;
    object[] hijos = new object[n];
    int obtenidos = 0;
    if (AccessibleChildren(acc, 0, n, hijos, ref obtenidos) < 0) return null;
    for (int i = 0; i < obtenidos; i++) {
      IAccessible ha = hijos[i] as IAccessible;
      IAccessible duenio; object id;
      if (ha != null) { duenio = ha; id = 0; }
      else if (hijos[i] is int) { duenio = acc; id = (int)hijos[i]; }
      else continue;
      string nom = null; object rol = null;
      try { nom = duenio.get_accName(id); } catch { }
      try { rol = duenio.get_accRole(id); } catch { }
      if (nom == nombre && rol is int && (int)rol == ROL_BOTON) {
        string accion = null;
        try { accion = duenio.get_accDefaultAction(id); } catch { }
        if (apretar) duenio.accDoDefaultAction(id);
        return "OK MSAA (arbol): boton '" + nom + "', accion por defecto '" + accion + "': " + (apretar ? "accDoDefaultAction hecho" : "sin apretar");
      }
      if (ha != null) {
        string r = Buscar(ha, nombre, apretar, nivel + 1);
        if (r != null) return r;
      }
    }
    return null;
  }

  // LegacyIAccessible por un punto de la pantalla (no mueve el puntero: solo pregunta que hay ahi).
  public static string PorPunto(int x, int y, string nombre, bool apretar) {
    PUNTO p; p.X = x; p.Y = y;
    IAccessible acc; object hijo;
    int hr = AccessibleObjectFromPoint(p, out acc, out hijo);
    if (hr != 0 || acc == null) return "AccessibleObjectFromPoint fallo: 0x" + hr.ToString("X8");
    string nom = null; object rol = null;
    try { nom = acc.get_accName(hijo); } catch { }
    try { rol = acc.get_accRole(hijo); } catch { }
    if (nom != nombre) return "en ese punto hay '" + nom + "' (rol " + rol + "), no '" + nombre + "'";
    string accion = null;
    try { accion = acc.get_accDefaultAction(hijo); } catch { }
    if (apretar) acc.accDoDefaultAction(hijo);
    return "OK MSAA (punto): boton '" + nom + "', accion por defecto '" + accion + "': " + (apretar ? "accDoDefaultAction hecho" : "sin apretar");
  }
}
'@

$codigoSalida = 1
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -AssemblyName System.Drawing
  $accesibilidad = [System.Reflection.Assembly]::LoadWithPartialName('Accessibility').Location
  Add-Type -TypeDefinition $codigo -ReferencedAssemblies $accesibilidad
  [void][AyudaAviso]::SetProcessDPIAware()   # coordenadas reales, para la captura y el punto

  $AE = [System.Windows.Automation.AutomationElement]
  $CT = [System.Windows.Automation.ControlType]
  $TS = [System.Windows.Automation.TreeScope]
  $raiz = $AE::RootElement
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $condBoton = [System.Windows.Automation.AndCondition]::new([System.Windows.Automation.Condition[]]@(
      [System.Windows.Automation.PropertyCondition]::new($AE::ControlTypeProperty, $CT::Button),
      [System.Windows.Automation.PropertyCondition]::new($AE::NameProperty, $Texto)))

  $procs = @{}
  function Get-NombreProceso([int]$id) {
    if (-not $procs.ContainsKey($id)) {
      $p = Get-Process -Id $id -ErrorAction SilentlyContinue
      $procs[$id] = if ($p) { $p.ProcessName } else { '?' }
    }
    return $procs[$id]
  }
  function Get-Descripcion($el) {
    try {
      $c = $el.Current
      $pat = ($el.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName -replace 'PatternIdentifiers\.Pattern', '' }) -join ','
      $r = $c.BoundingRectangle
      $rt = if ($r.IsEmpty) { 'vacío' } else { '{0},{1},{2}x{3}' -f [int]$r.X, [int]$r.Y, [int]$r.Width, [int]$r.Height }
      return ("ClassName='{0}' Name='{1}' ControlType={2} AutomationId='{3}' Proceso={4} HWND=0x{5:X} Rect=({6}) Patrones=[{7}]" -f `
          $c.ClassName, $c.Name, $c.ControlType.ProgrammaticName, $c.AutomationId, (Get-NombreProceso $c.ProcessId), $c.NativeWindowHandle,
          $rt, $pat)
    } catch { return "(elemento ya no disponible: $($_.Exception.Message))" }
  }
  function Test-Candidata($v) {
    try {
      $cn = $v.Current.ClassName
      $pn = Get-NombreProceso $v.Current.ProcessId
      return (($cn -match 'CoreWindow|Toast|Notif') -or ($pn -match '^(ShellExperienceHost|ShellHost)$'))
    } catch { return $false }
  }
  # Busca dentro de una ventana un elemento que nombre el aviso y, subiendo desde él, el botón.
  function Find-EnVentana($v) {
    try {
      $todos = $v.FindAll($TS::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    } catch { return $null }
    foreach ($e in $todos) {
      $nom = $null
      try { $nom = $e.Current.Name } catch { continue }
      if (-not $nom -or $nom.IndexOf($Titulo, [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }
      $a = $e
      for ($k = 0; $k -lt 10 -and $a -ne $null; $k++) {
        $b = $null
        try { $b = $a.FindFirst($TS::Descendants, $condBoton) } catch { }
        if ($b) { return @{ ventana = $v; aviso = $a; boton = $b; titulo = $e } }
        if ([System.Windows.Automation.Automation]::Compare($a, $v)) { break }
        try { $a = $walker.GetParent($a) } catch { $a = $null }
      }
    }
    return $null
  }
  function Find-Aviso {
    # 1) Lo pedido: desde RootElement, entre sus ventanas hijas.
    $ventanas = $raiz.FindAll($TS::Children, [System.Windows.Automation.Condition]::TrueCondition)
    $cands = @()
    foreach ($v in $ventanas) { if (Test-Candidata $v) { $cands += $v } }
    foreach ($v in $cands) {
      $r = Find-EnVentana $v
      if ($r) { $r.via = 'RootElement (hijos del escritorio)'; $r.candidatas = $cands; return $r }
    }
    # 2) En Windows 11 la ventana del aviso ("Nueva notificación", CoreWindow de
    #    ShellExperienceHost) no figura entre esos hijos: se la busca con FindWindowEx y se
    #    entra a UI Automation con FromHandle.
    foreach ($h in [AyudaAviso]::VentanasDeClase('Windows.UI.Core.CoreWindow')) {
      $v = $null
      try { $v = $AE::FromHandle($h) } catch { continue }
      try {
        if ((Get-NombreProceso $v.Current.ProcessId) -notmatch '^(ShellExperienceHost|ShellHost)$') { continue }
      } catch { continue }
      $r = Find-EnVentana $v
      if ($r) { $r.via = 'FindWindowEx + AutomationElement.FromHandle'; $r.candidatas = $cands; return $r }
    }
    return @{ candidatas = $cands }
  }
  function Show-Arbol($el, [int]$nivel) {
    if ($nivel -gt 14) { return }
    Write-Linea (('  ' * $nivel) + (Get-Descripcion $el))
    $h = $null
    try { $h = $walker.GetFirstChild($el) } catch { }
    while ($h -ne $null) {
      Show-Arbol $h ($nivel + 1)
      try { $h = $walker.GetNextSibling($h) } catch { $h = $null }
    }
  }
  function Save-Captura($rect, [string]$ruta) {
    $x = [int][Math]::Floor($rect.X) - 8; $y = [int][Math]::Floor($rect.Y) - 8
    $w = [int][Math]::Ceiling($rect.Width) + 16; $h = [int][Math]::Ceiling($rect.Height) + 16
    if ($rect.Width -le 0 -or $rect.Height -le 0) { return 'sin captura: rectángulo vacío' }
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($x, $y, 0, 0, (New-Object System.Drawing.Size $w, $h))
    $bmp.Save($ruta, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    return "captura guardada en $ruta ($w x $h desde $x,$y)"
  }

  Write-Linea "Busco el aviso '$Titulo' con el botón '$Texto' (hasta $Segundos s, método $Metodo)"
  $limite = (Get-Date).AddSeconds($Segundos)
  $res = $null; $vueltas = 0
  do {
    $vueltas++
    $res = Find-Aviso
    if ($res.boton) { break }
    Start-Sleep -Milliseconds 300
  } while ((Get-Date) -lt $limite)

  if (-not $res.boton) {
    Write-Linea "NO APARECIÓ el aviso con el botón '$Texto' en $Segundos s ($vueltas vueltas)."
    Write-Linea 'Ventanas candidatas que se vieron en la última vuelta:'
    foreach ($v in $res.candidatas) { Write-Linea ('  ' + (Get-Descripcion $v)) }
    # Para descubrir dónde vive el aviso si no es una ventana conocida: clase y proceso de
    # todas las ventanas de primer nivel (el nombre solo de las del sistema).
    Write-Linea 'Todas las ventanas de primer nivel (clase / proceso):'
    foreach ($v in $raiz.FindAll($TS::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
      try {
        $c = $v.Current; $pn = Get-NombreProceso $c.ProcessId
        $nom = if ($pn -match '^(explorer|ShellExperienceHost|ShellHost|StartMenuExperienceHost|SearchHost|sihost|svchost|dwm)$') { $c.Name } else { '-' }
        $r = $c.BoundingRectangle
        Write-Linea ("  {0} / {1} / '{2}' Rect=({3},{4},{5}x{6}) Offscreen={7}" -f $c.ClassName, $pn, $nom, [int]$r.X, [int]$r.Y, [int]$r.Width, [int]$r.Height, $c.IsOffscreen)
      } catch { }
    }
    $codigoSalida = 1
  } else {
    Write-Linea "Encontrado en la vuelta $vueltas, vía $($res.via)."
    $enRaiz = $false
    foreach ($v in $raiz.FindAll($TS::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
      if ([System.Windows.Automation.Automation]::Compare($v, $res.ventana)) { $enRaiz = $true }
    }
    Write-Linea "¿La ventana del aviso está entre los hijos de RootElement? $enRaiz"
    Write-Linea ('VENTANA: ' + (Get-Descripcion $res.ventana))
    Write-Linea ('AVISO:   ' + (Get-Descripcion $res.aviso))
    if (-not [System.Windows.Automation.Automation]::Compare($res.titulo, $res.aviso)) { Write-Linea ('TÍTULO:  ' + (Get-Descripcion $res.titulo)) }
    Write-Linea ('BOTÓN:   ' + (Get-Descripcion $res.boton))

    if ($Captura) {
      try { Write-Linea (Save-Captura $res.aviso.Current.BoundingRectangle $Captura) } catch { Write-Linea "sin captura: $($_.Exception.Message)" }
    }

    if ($Explorar) {
      Write-Linea 'Árbol de la ventana del aviso (ControlView):'
      Show-Arbol $res.ventana 0
      $codigoSalida = 0
    } else {
      # Recién aparecido, el aviso todavía se está mostrando (con su animación) y un toque en ese
      # momento puede perderse: se espera un poco, como esperaría una persona
      if ($Pausa -gt 0) { Start-Sleep -Milliseconds $Pausa }
      $apretado = $false
      $hwnd = [IntPtr]$res.ventana.Current.NativeWindowHandle
      $r = $res.boton.Current.BoundingRectangle
      $cx = [int]($r.X + $r.Width / 2); $cy = [int]($r.Y + $r.Height / 2)
      if ($Metodo -ne 'Legacy') {
        $pat = $null
        if ($res.boton.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) {
          try {
            $pat.Invoke()
            $apretado = $true
            Write-Linea "OK: InvokePattern.Invoke() sobre '$Texto'."
          } catch { Write-Linea "InvokePattern.Invoke() falló: $($_.Exception.GetType().Name): $($_.Exception.Message)" }
        } else {
          Write-Linea 'El botón no tiene InvokePattern.'
        }
      }
      if (-not $apretado -and $Metodo -ne 'Invoke') {
        $m = [AyudaAviso]::PorVentana($hwnd, $Texto, $true)
        Write-Linea "LegacyIAccessible por la ventana: $m"
        if ($m.StartsWith('OK')) { $apretado = $true }
        else {
          $m = [AyudaAviso]::PorPunto($cx, $cy, $Texto, $true)
          Write-Linea "LegacyIAccessible por el punto ($cx,$cy): $m"
          if ($m.StartsWith('OK')) { $apretado = $true }
        }
      }

      if (-not $apretado) {
        Write-Linea "NO SE PUDO APRETAR '$Texto'."
        $codigoSalida = 2
      } else {
        Start-Sleep -Milliseconds 1500
        $sigue = $false
        try { $null = $res.boton.Current.Name; $sigue = -not $res.boton.Current.IsOffscreen } catch { $sigue = $false }
        Write-Linea ('Después de apretar, el aviso ' + $(if ($sigue) { 'SIGUE en pantalla.' } else { 'ya no está en pantalla.' }))
        $codigoSalida = 0
        if ($Eventos) {
          $hasta = (Get-Date).AddSeconds(10); $vio = $false
          do {
            if (Test-Path $Eventos) {
              $txt = [System.IO.File]::ReadAllText($Eventos)
              if ($txt -match ' (action|click)') { $vio = $true; break }
            }
            Start-Sleep -Milliseconds 300
          } while ((Get-Date) -lt $hasta)
          if ($vio) { Write-Linea 'La app anotó el evento:' } else { Write-Linea 'La app NO anotó action ni click en 10 s. Lo que hay:'; $codigoSalida = 3 }
          if (Test-Path $Eventos) { foreach ($l in [System.IO.File]::ReadAllLines($Eventos)) { Write-Linea ('  | ' + $l) } }
        }
      }
    }
  }
} catch {
  Write-Linea "ERROR: $($_.Exception.GetType().FullName): $($_.Exception.Message)"
  Write-Linea ($_.ScriptStackTrace)
  $codigoSalida = 2
} finally {
  if ($Salida) { [System.IO.File]::WriteAllLines($Salida, $script:lineas, (New-Object System.Text.UTF8Encoding $false)) }
}
exit $codigoSalida
