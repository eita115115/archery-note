# Temporary trusted HTTPS preview for the physical iPhone acceptance checklist.
# ASCII only: Windows PowerShell 5.1 can misread UTF-8 without a BOM.
param(
  [string]$HostAddress = "0.0.0.0",
  [int]$Port = 8743
)

$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)))
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("archery-note-https-" + [Guid]::NewGuid().ToString("N"))
$certificate = $null

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
  $windowsPowerShellRoot = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\Modules"
  $securityModule = Join-Path $windowsPowerShellRoot "Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1"
  $pkiModule = Join-Path $windowsPowerShellRoot "PKI\PKI.psd1"
  if (Test-Path -LiteralPath $securityModule) {
    try { Import-Module $securityModule -ErrorAction Stop } catch {}
  }
  if (Test-Path -LiteralPath $pkiModule) {
    try { Import-Module $pkiModule -ErrorAction Stop } catch {}
  }
  if (-not (Get-PSDrive -Name Cert -ErrorAction SilentlyContinue)) {
    New-PSDrive -Name Cert -PSProvider Certificate -Root "\\" -ErrorAction Stop | Out-Null
  }
  $lanAddresses = @(
    Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254*" } |
      Select-Object -ExpandProperty IPAddress
  )
  if ($lanAddresses.Count -eq 0) {
    throw "No usable IPv4 address was found. Connect this PC to the same trusted Wi-Fi as the iPhone."
  }
  if ($HostAddress -ne "0.0.0.0" -and $HostAddress -ne "127.0.0.1" -and $lanAddresses -notcontains $HostAddress) {
    throw "HostAddress must be 0.0.0.0, 127.0.0.1, or one of this PC's IPv4 addresses."
  }

  $sanEntries = @("DNS=archery-note.local", "DNS=localhost")
  $sanEntries += @($lanAddresses | ForEach-Object { "IPAddress=" + $_ })
  $sanExtension = "2.5.29.17={text}" + ($sanEntries -join "&")
  $certificate = New-SelfSignedCertificate `
    -Subject "CN=archery-note.local" `
    -TextExtension @($sanExtension) `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyExportPolicy Exportable `
    -NotAfter (Get-Date).AddDays(7)

  $passwordText = [Guid]::NewGuid().ToString("N")
  $password = ConvertTo-SecureString $passwordText -AsPlainText -Force
  $pfxPath = Join-Path $tempRoot "archery-note-preview.pfx"
  $cerPath = Join-Path $tempRoot "archery-note-preview.cer"
  Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $password | Out-Null
  Export-Certificate -Cert $certificate -FilePath $cerPath | Out-Null

  $env:HOST = $HostAddress
  $env:PORT = [string]$Port
  $env:HTTPS_PFX = $pfxPath
  $env:HTTPS_PASSWORD = $passwordText

  Write-Output "Temporary trusted HTTPS preview prepared from: $repoRoot"
  Write-Output "Install this certificate on the iPhone before opening the preview: $cerPath"
  Write-Output "After installing it, enable full trust in Settings > General > About > Certificate Trust Settings."
  $previewAddresses = if ($HostAddress -eq "0.0.0.0") { $lanAddresses } else { @($HostAddress) }
  foreach ($lanAddress in $previewAddresses) {
    Write-Output ("Open trusted HTTPS preview from iPhone: https://{0}:{1}/" -f $lanAddress, $Port)
  }
  if ($HostAddress -eq "0.0.0.0") {
    Write-Warning "This HTTPS preview exposes the repository root on all interfaces. Use only on trusted private Wi-Fi."
  } else {
    Write-Output ("HTTPS preview is bound only to " + $HostAddress + ".")
  }
  Write-Output "For safer LAN binding, pass -HostAddress with one IPv4 address from this PC."
  Write-Warning "Use a dedicated test browser profile and do not enter production data."
  Write-Output "Press Ctrl+C to stop; the temporary certificate and private key are removed on exit."

  Push-Location $repoRoot
  try {
    & node "tools/e2e-server.js"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
} finally {
  if ($null -ne $certificate) {
    Remove-Item -LiteralPath ("Cert:\CurrentUser\My\" + $certificate.Thumbprint) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
