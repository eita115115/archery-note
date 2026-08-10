# Temporary trusted HTTPS preview for the physical iPhone acceptance checklist.
# ASCII only: Windows PowerShell 5.1 can misread UTF-8 without a BOM.
param(
  [string]$HostAddress = "0.0.0.0",
  [int]$Port = 8743,
  [switch]$OpenCertificate
)

$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)))
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("archery-note-https-" + [Guid]::NewGuid().ToString("N"))
$certificate = $null

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

function New-ManagedHttpsCertificateFiles {
  param(
    [Parameter(Mandatory = $true)][string]$PfxPath,
    [Parameter(Mandatory = $true)][string]$CerPath,
    [Parameter(Mandatory = $true)][string]$PasswordText,
    [string[]]$DnsNames = @(),
    [string[]]$IpAddresses = @()
  )

  $pwshCommand = Get-Command pwsh.exe -ErrorAction SilentlyContinue
  $pwshPath = if ($pwshCommand) { $pwshCommand.Path } else { $null }
  if (-not $pwshPath) {
    $pwshCandidates = @()
    if ($env:ProgramFiles) { $pwshCandidates += (Join-Path $env:ProgramFiles "PowerShell\7\pwsh.exe") }
    if ($env:ProgramW6432) { $pwshCandidates += (Join-Path $env:ProgramW6432 "PowerShell\7\pwsh.exe") }
    $pwshPath = $pwshCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  }
  if (-not $pwshPath) {
    throw "Unable to create the temporary HTTPS certificate: PowerShell 7 CertificateRequest fallback is unavailable. Install PowerShell 7 or restore the Windows PKI provider."
  }

  $fallbackScriptPath = Join-Path $tempRoot "create-preview-certificate.ps1"
  @'
param(
  [Parameter(Mandatory = $true)][string]$PfxPath,
  [Parameter(Mandatory = $true)][string]$CerPath,
  [Parameter(Mandatory = $true)][string]$PasswordText,
  [string]$DnsNamesText = "",
  [string]$IpAddressesText = ""
)
$DnsNames = @($DnsNamesText -split ";" | Where-Object { $_ })
$IpAddresses = @($IpAddressesText -split ";" | Where-Object { $_ })
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
  "CN=archery-note.local",
  $rsa,
  [System.Security.Cryptography.HashAlgorithmName]::SHA256,
  [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)
$san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
foreach ($dnsName in $DnsNames) {
  if ($dnsName) { $san.AddDnsName($dnsName) }
}
foreach ($ipAddress in $IpAddresses) {
  if ($ipAddress) { $san.AddIpAddress([System.Net.IPAddress]::Parse($ipAddress)) }
}
$request.CertificateExtensions.Add($san.Build($false))
$certificate = $request.CreateSelfSigned(
  [DateTimeOffset]::Now.AddMinutes(-5),
  [DateTimeOffset]::Now.AddDays(7)
)
[System.IO.File]::WriteAllBytes(
  $PfxPath,
  $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $PasswordText)
)
[System.IO.File]::WriteAllBytes(
  $CerPath,
  $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
)
'@ | Set-Content -LiteralPath $fallbackScriptPath -Encoding UTF8

  $dnsNamesText = $DnsNames -join ";"
  $ipAddressesText = $IpAddresses -join ";"
  & $pwshPath -NoProfile -ExecutionPolicy Bypass -File $fallbackScriptPath `
    -PfxPath $PfxPath -CerPath $CerPath -PasswordText $PasswordText `
    -DnsNamesText $dnsNamesText -IpAddressesText $ipAddressesText
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $PfxPath) -or -not (Test-Path -LiteralPath $CerPath)) {
    throw "PowerShell 7 CertificateRequest fallback did not create the temporary HTTPS certificate files."
  }
}

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
  $usedNetworkFallback = $false
  try {
    $lanAddresses = @(
      Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254*" } |
        Select-Object -ExpandProperty IPAddress
    )
  } catch {
    $usedNetworkFallback = $true
    $lanAddresses = @(
      [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
        Where-Object { $_.OperationalStatus -eq "Up" -and $_.NetworkInterfaceType -ne "Loopback" } |
        ForEach-Object {
          $_.GetIPProperties().UnicastAddresses |
            Where-Object {
              $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
                $_.Address.ToString() -ne "127.0.0.1" -and
                $_.Address.ToString() -notlike "169.254*"
            } |
            ForEach-Object { $_.Address.ToString() }
        }
    )
  }
  $lanAddresses = @($lanAddresses | Sort-Object -Unique)
  if ($usedNetworkFallback) {
    Write-Warning "Get-NetIPAddress was unavailable; using the .NET network interface fallback."
  }
  if ($lanAddresses.Count -eq 0 -and $HostAddress -ne "127.0.0.1") {
    throw "No usable IPv4 address was found. Connect this PC to the same trusted Wi-Fi as the iPhone."
  }
  if ($HostAddress -ne "0.0.0.0" -and $HostAddress -ne "127.0.0.1" -and $lanAddresses -notcontains $HostAddress) {
    throw "HostAddress must be 0.0.0.0, 127.0.0.1, or one of this PC's IPv4 addresses."
  }
  if ($Port -lt 1024 -or $Port -gt 65535) {
    throw "Port must be between 1024 and 65535."
  }
  $occupiedListeners = @()
  try {
    $occupiedListeners = @(
      Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop
    )
  } catch {
    $portProbe = $null
    try {
      $portProbe = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Any, $Port)
      $portProbe.Start()
      $portProbe.Stop()
      $portProbe = $null
    } catch {
      if ($null -ne $portProbe) {
        try { $portProbe.Stop() } catch {}
      }
      throw "Port $Port is already in use or unavailable. Stop the previous preview or choose another -Port value."
    }
  }
  if ($occupiedListeners.Count -gt 0) {
    $listenerPids = @($occupiedListeners | Select-Object -ExpandProperty OwningProcess -Unique)
    $pidText = if ($listenerPids.Count -gt 0) { " PID(s): " + ($listenerPids -join ",") } else { "" }
    throw "Port $Port is already in use.$pidText Stop the previous preview or choose another -Port value."
  }
  $portReachable = $false
  $probeAddresses = if ($HostAddress -eq "0.0.0.0") {
    @("127.0.0.1") + $lanAddresses
  } else {
    @($HostAddress)
  }
  foreach ($probeAddress in @($probeAddresses | Sort-Object -Unique)) {
    $portClient = $null
    try {
      $portClient = New-Object System.Net.Sockets.TcpClient
      $portClient.Connect($probeAddress, $Port)
      $portReachable = $true
      break
    } catch {
      # A refused connection means this address is free; continue probing the
      # remaining bound addresses when HostAddress is 0.0.0.0.
    } finally {
      if ($null -ne $portClient) {
        $portClient.Close()
      }
    }
  }
  if ($portReachable) {
    throw "Port $Port is already in use. Stop the previous preview or choose another -Port value."
  }
  $publicProfiles = @(
    Get-NetConnectionProfile -ErrorAction SilentlyContinue |
      Where-Object { $_.NetworkCategory -eq "Public" }
  )
  if ($publicProfiles.Count -gt 0) {
    Write-Warning "The connected Windows network profile is Public. iPhone Safari may be blocked by Windows Firewall; use a trusted Private Wi-Fi profile or an explicitly approved firewall rule."
  }

  $sanEntries = @("DNS=archery-note.local", "DNS=localhost")
  $sanEntries += @($lanAddresses | ForEach-Object { "IPAddress=" + $_ })
  $sanExtension = "2.5.29.17={text}" + ($sanEntries -join "&")
  $passwordText = [Guid]::NewGuid().ToString("N")
  $password = ConvertTo-SecureString $passwordText -AsPlainText -Force
  $pfxPath = Join-Path $tempRoot "archery-note-preview.pfx"
  $cerPath = Join-Path $tempRoot "archery-note-preview.cer"
  try {
    $certificate = New-SelfSignedCertificate `
      -Subject "CN=archery-note.local" `
      -TextExtension @($sanExtension) `
      -CertStoreLocation "Cert:\CurrentUser\My" `
      -KeyExportPolicy Exportable `
      -NotAfter (Get-Date).AddDays(7)
    Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $password | Out-Null
    Export-Certificate -Cert $certificate -FilePath $cerPath | Out-Null
  } catch {
    Write-Warning "Windows PKI certificate provider failed; using the PowerShell 7 CertificateRequest fallback."
    New-ManagedHttpsCertificateFiles `
      -PfxPath $pfxPath `
      -CerPath $cerPath `
      -PasswordText $passwordText `
      -DnsNames @("archery-note.local", "localhost") `
      -IpAddresses $lanAddresses
  }
  if ($OpenCertificate) {
    try {
      Start-Process -FilePath $cerPath -ErrorAction Stop | Out-Null
      Write-Output "Opened the temporary certificate on this PC: $cerPath"
    } catch {
      Write-Warning ("Could not open the temporary certificate automatically. Open it manually: " + $cerPath)
    }
  }

  $previewCommit = [string]((& git -c ("safe.directory=" + $repoRoot) -C $repoRoot rev-parse HEAD 2>$null) | Select-Object -First 1)
  $previewTree = [string]((& git -c ("safe.directory=" + $repoRoot) -C $repoRoot rev-parse "HEAD^{tree}" 2>$null) | Select-Object -First 1)
  $previewCommit = $previewCommit.Trim()
  $previewTree = $previewTree.Trim()

  $env:HOST = $HostAddress
  $env:PORT = [string]$Port
  $env:HTTPS_PFX = $pfxPath
  $env:HTTPS_PASSWORD = $passwordText

  Write-Output "Temporary trusted HTTPS preview prepared from: $repoRoot"
  if ($previewCommit -match "^[0-9a-fA-F]{40}$" -and $previewTree -match "^[0-9a-fA-F]{40}$") {
    Write-Output ("Preview Git commit: " + $previewCommit)
    Write-Output ("Preview Git tree: " + $previewTree)
  } else {
    Write-Warning "Could not resolve the preview Git commit/tree. Record the serving worktree HEAD manually before field acceptance."
  }
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
  Write-Output ("If Safari cannot connect, test from this PC: Test-NetConnection -ComputerName {0} -Port {1}" -f $HostAddress, $Port)
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
