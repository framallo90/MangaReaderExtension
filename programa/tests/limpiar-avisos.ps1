<#
  limpiar-avisos.ps1: deja Windows como si el programa nunca hubiera mostrado un aviso, para probar
  el primer aviso de fin de cola desde cero (npm run avisos:limpio). Borra solo lo del programa:
    - los accesos directos del menú Inicio que apuntan a un ejecutable del programa (en desarrollo,
      el Electron.lnk que crea Electron al mostrar el primer aviso; instalado, el del instalador);
    - las claves CLSID de HKCU cuyo LocalServer32 es uno de esos ejecutables (las crea Electron
      para los botones del aviso);
    - HKCU\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\ar.mangareader.programa
      y HKCU\Software\Classes\AppUserModelId\ar.mangareader.programa, si están;
    - los avisos del programa que queden en el centro de notificaciones.
  Lo que apunta a otro ejecutable (otro programa hecho con Electron, por ejemplo) no se toca.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File tests/limpiar-avisos.ps1 [-Ejecutable "<ruta>|<ruta>"] [-Mirar]
  -Ejecutable  los ejecutables del programa (por defecto, el Electron de esta carpeta:
               node_modules\electron\dist\electron.exe). Para el programa instalado, su
               "Manga Reader.exe": correrlo después de desinstalar y antes de instalar. Varios van
               separados por | (con -File, PowerShell no parte una lista separada por comas).
  -Mirar       solo dice lo que encuentra, sin borrar nada
  Código de salida: 0 (y con -Mirar, 0 si no quedó nada del programa y 1 si quedó algo)
#>
param(
  [string[]]$Ejecutable = @(),
  [switch]$Mirar
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch { }
$aumid = 'ar.mangareader.programa'
$Ejecutable = @($Ejecutable | ForEach-Object { $_ -split '[|]' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if (-not $Ejecutable.Count) { $Ejecutable = @((Join-Path $PSScriptRoot '..\node_modules\electron\dist\electron.exe')) }
$exes = @($Ejecutable | ForEach-Object { [IO.Path]::GetFullPath($_).ToLowerInvariant() })
$verbo = if ($Mirar) { 'está' } else { 'borrado' }
$verba = if ($Mirar) { 'está' } else { 'borrada' }
$quedan = 0
Write-Output ("Ejecutables del programa: " + ($exes -join ' | '))

# 1) Accesos directos del menú Inicio que apuntan a uno de esos ejecutables
$wsh = New-Object -ComObject WScript.Shell
$raices = @((Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'), (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'))
$revisados = 0
foreach ($raiz in $raices) {
  if (-not (Test-Path -LiteralPath $raiz)) { continue }
  foreach ($lnk in Get-ChildItem -LiteralPath $raiz -Filter *.lnk -Recurse -ErrorAction SilentlyContinue) {
    $revisados++
    $destino = ''
    try { $destino = $wsh.CreateShortcut($lnk.FullName).TargetPath } catch { continue }
    if (-not $destino) { continue }
    try { $destino = [IO.Path]::GetFullPath($destino).ToLowerInvariant() } catch { continue }
    if ($exes -notcontains $destino) { continue }
    $quedan++
    if (-not $Mirar) {
      try { Remove-Item -LiteralPath $lnk.FullName -Force; } catch { Write-Output ("  no se pudo borrar (¿hace falta ser administrador?): " + $lnk.FullName); continue }
    }
    Write-Output ("acceso directo ${verbo}: " + $lnk.FullName)
  }
}
Write-Output "($revisados accesos directos revisados)"

# 2) Claves CLSID cuyo LocalServer32 es uno de esos ejecutables
$clsids = 'HKCU:\Software\Classes\CLSID'
if (Test-Path $clsids) {
  foreach ($k in Get-ChildItem $clsids -ErrorAction SilentlyContinue) {
    $ls = Join-Path $k.PSPath 'LocalServer32'
    if (-not (Test-Path $ls)) { continue }
    $valor = ''
    try { $valor = [string](Get-Item $ls).GetValue('') } catch { continue }
    if (-not $valor) { continue }
    # (el valor puede venir entre comillas y con argumentos: "C:\...\electron.exe" -ToastActivated)
    $exe = if ($valor.StartsWith('"')) { $valor.Substring(1, $valor.IndexOf('"', 1) - 1) } else { ($valor -split '\s+-')[0].Trim() }
    try { $exe = [IO.Path]::GetFullPath($exe).ToLowerInvariant() } catch { continue }
    if ($exes -notcontains $exe) { continue }
    $quedan++
    if (-not $Mirar) { Remove-Item -LiteralPath $k.PSPath -Recurse -Force }
    Write-Output ("clave CLSID ${verba}: " + $k.PSChildName + " → " + $valor)
  }
}

# 3) Los ajustes de avisos del programa (por su identificador)
foreach ($clave in @("HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\$aumid", "HKCU:\Software\Classes\AppUserModelId\$aumid")) {
  if (-not (Test-Path $clave)) { continue }
  $quedan++
  if (-not $Mirar) { Remove-Item -LiteralPath $clave -Recurse -Force }
  Write-Output ("clave ${verba}: " + $clave)
}

# 4) Los avisos del programa que queden en el centro de notificaciones
if (-not $Mirar) {
  try {
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    [Windows.UI.Notifications.ToastNotificationManager]::History.Clear($aumid)
    Write-Output "centro de notificaciones: sin avisos del programa"
  } catch { Write-Output ("centro de notificaciones: no se pudo limpiar (" + $_.Exception.Message + ")") }
}

if ($Mirar) {
  Write-Output $(if ($quedan) { "QUEDA ALGO DEL PROGRAMA: $quedan" } else { "NADA DEL PROGRAMA: estado limpio" })
  exit $(if ($quedan) { 1 } else { 0 })
}
Write-Output "LISTO: $quedan cosa(s) borrada(s)"
exit 0
