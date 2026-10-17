#Requires -RunAsAdministrator
[CmdletBinding()]
param([Parameter(Mandatory)][string]$InstallDirectory, [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$Commit)
$ErrorActionPreference = 'Stop'
$data = Join-Path $env:ProgramData 'NostalgiaTV'
$release = Join-Path $InstallDirectory "releases\$Commit"
if (Test-Path (Join-Path $data 'appsettings.json')) { throw 'An installation already exists. Use its verified updater; no settings were overwritten.' }
if (!(Test-Path (Join-Path $release 'WebApi.exe'))) { throw 'The native server payload is missing.' }
function Read-Secret([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    [Net.NetworkCredential]::new('', $secure).Password
}
function Random-Secret {
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    [Convert]::ToBase64String($bytes)
}
$serverUrl = Read-Host 'HTTPS server address (example: https://localhost:8443)'
$origin = [Uri]$serverUrl
if ($origin.Scheme -ne 'https' -or $origin.AbsolutePath -ne '/' -or $origin.Query -or $origin.UserInfo -or $origin.Fragment) { throw 'Use an HTTPS origin without path or credentials.' }
$runtime = Read-Secret 'SQL runtime connection: restricted login, verified TLS, existing NostalgiaTV database'
$migration = Read-Secret 'SQL migration connection: separate database owner, verified TLS'
$maintenance = Read-Secret 'SQL backup connection: separate db_backupoperator with CREATE ANY DATABASE, verified TLS (never the runtime/migration account)'
$sqlService = Read-Host 'Local SQL Server service name (example: MSSQL$SQLEXPRESS)'
if ($sqlService -notmatch '^MSSQL(\$[A-Za-z0-9_]+|SERVER)$') { throw 'Select a local SQL Server service.' }
Get-Service -Name $sqlService -ErrorAction Stop | Out-Null
$ffmpeg = Read-Host 'Folder containing ffmpeg.exe and ffprobe.exe (example: C:\ffmpeg\bin)'
foreach ($tool in 'ffmpeg.exe','ffprobe.exe') { if (!(Test-Path (Join-Path $ffmpeg $tool))) { throw "Missing $tool" } }
$admin = Read-Secret 'Initial administrator password (at least 12 characters)'
if ($admin.Length -lt 12) { throw 'The administrator password needs at least 12 characters.' }
New-Item -ItemType Directory -Path $data -Force | Out-Null
& icacls.exe $data /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE) { throw 'Could not protect the configuration directory.' }
foreach ($folder in 'wwwroot\uploads','logs','backups\sql','updates\requests','updates\status','certificates') {
    New-Item -ItemType Directory -Path (Join-Path $data $folder) -Force | Out-Null
}
$authority = New-SelfSignedCertificate -Type Custom -Subject 'CN=NostalgiaTV Local Authority' -CertStoreLocation Cert:\LocalMachine\My -KeyExportPolicy NonExportable -KeyUsage CertSign,CRLSign -TextExtension '2.5.29.19={critical}{text}ca=1&pathlength=0' -NotAfter (Get-Date).AddYears(10)
$names = if ($origin.HostNameType -eq [UriHostNameType]::IPv4 -or $origin.HostNameType -eq [UriHostNameType]::IPv6) { "2.5.29.17={text}IPAddress=$($origin.DnsSafeHost)" } else { "2.5.29.17={text}DNS=$($origin.DnsSafeHost)" }
$leaf = New-SelfSignedCertificate -Type Custom -Subject "CN=$($origin.DnsSafeHost)" -Signer $authority -CertStoreLocation Cert:\LocalMachine\My -KeyExportPolicy Exportable -KeyUsage DigitalSignature,KeyEncipherment -TextExtension @($names,'2.5.29.37={text}1.3.6.1.5.5.7.3.1') -NotAfter (Get-Date).AddDays(365)
$pfxPassword = Random-Secret
$pfx = Join-Path $data 'certificates\server.pfx'
Export-PfxCertificate -Cert $leaf -FilePath $pfx -Password (ConvertTo-SecureString $pfxPassword -AsPlainText -Force) | Out-Null
Export-Certificate -Cert $authority -FilePath (Join-Path $data 'certificates\local-ca.cer') | Out-Null
$settings = @{
    ConnectionStrings = @{ DefaultConnection = $runtime }
    Database = @{ ApplyMigrations = $false }
    NativeHosting = @{ Enabled = $true; PublicUrl = $serverUrl }
    Kestrel = @{ Endpoints = @{ Https = @{ Url = $serverUrl; Certificate = @{ Path = $pfx; Password = $pfxPassword } } } }
    Jwt = @{ Key = (Random-Secret); Issuer = 'nostalgiatv'; Audience = 'nostalgiatv' }
    Cors = @{ AllowedOrigins = @($serverUrl) }
    FFmpeg = @{ BinaryFolder = $ffmpeg }
    MediaSettings = @{ BasePath = (Join-Path $data 'wwwroot\uploads') }
    ServerUpdates = @{ CurrentCommit = $Commit; RequestsPath = (Join-Path $data 'updates\requests'); StatusPath = (Join-Path $data 'updates\status') }
    Serilog = @{ Using = @('Serilog.Sinks.File'); MinimumLevel = 'Information'; WriteTo = @(@{ Name = 'File'; Args = @{ path = (Join-Path $data 'logs\server-.log'); rollingInterval = 'Day'; retainedFileCountLimit = 14 } }) }
}
$settings | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $data 'appsettings.json') -Encoding UTF8
@{ ConnectionStrings = @{ MigrationConnection = $migration; MaintenanceConnection = $maintenance }; BootstrapAdminPassword = $admin } | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $data 'migration.private.json') -Encoding UTF8
& (Join-Path $release 'WebApi.exe') --native-check-database --contentRoot $data
if ($LASTEXITCODE) { throw 'Database login, permissions or certificate validation failed. Correct the private settings before installing services.' }
& icacls.exe (Join-Path $data 'backups\sql') /grant "NT SERVICE\${sqlService}:(OI)(CI)M" | Out-Null
& (Join-Path $release 'WebApi.exe') --native-backup (Join-Path $data ('backups\sql\before-install-' + [guid]::NewGuid().ToString('N') + '.bak')) --contentRoot $data
if ($LASTEXITCODE) { throw 'The pre-installation database backup could not be verified. No migration was run.' }
& (Join-Path $release 'WebApi.exe') --migrate --contentRoot $data
if ($LASTEXITCODE) { throw 'Migration or database permission/TLS validation failed. Services were not created; private configuration was retained for correction.' }
foreach ($name in 'NostalgiaTV','NostalgiaTV-Media') {
    $arguments = if ($name -eq 'NostalgiaTV-Media') { '--media-worker' } else { "--webroot `"$(Join-Path $data 'wwwroot')`"" }
    $command = "`"$(Join-Path $release 'WebApi.exe')`" $arguments --contentRoot `"$data`""
    New-Service -Name $name -BinaryPathName $command -StartupType Automatic | Out-Null
    & sc.exe config $name obj= "NT SERVICE\$name" | Out-Null
    if ($LASTEXITCODE) { throw "Could not configure the restricted service identity: $name" }
    & icacls.exe $data /grant "NT SERVICE\${name}:(RX)" | Out-Null
    & icacls.exe (Join-Path $data 'appsettings.json') /grant "NT SERVICE\${name}:(R)" | Out-Null
    & icacls.exe (Join-Path $data 'certificates') /grant "NT SERVICE\${name}:(OI)(CI)RX" | Out-Null
    foreach ($folder in 'wwwroot','logs','updates\requests') { & icacls.exe (Join-Path $data $folder) /grant "NT SERVICE\${name}:(OI)(CI)M" | Out-Null }
    & icacls.exe (Join-Path $data 'updates') /grant "NT SERVICE\${name}:(RX)" | Out-Null
    & icacls.exe (Join-Path $data 'updates\status') /grant "NT SERVICE\${name}:(OI)(CI)RX" | Out-Null
}
& icacls.exe (Join-Path $data 'backups\sql') /grant "NT SERVICE\${sqlService}:(OI)(CI)M" | Out-Null
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy RemoteSigned -File `"$(Join-Path $InstallDirectory 'tools\update.ps1')`" -InstallDirectory `"$InstallDirectory`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName NostalgiaTV-Updater -Action $action -Trigger $trigger -User SYSTEM -RunLevel Highest -Settings (New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 12)) | Out-Null
Start-Service NostalgiaTV,NostalgiaTV-Media
if ($origin.HostNameType -ne [UriHostNameType]::Dns -or $origin.Host -ne 'localhost') {
    if ((Read-Host 'Allow access from the local subnet on private/domain networks? (yes/no)') -eq 'yes') {
        New-NetFirewallRule -DisplayName 'NostalgiaTV Local Network' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $origin.Port -Profile Private,Domain -RemoteAddress LocalSubnet | Out-Null
    }
}
Write-Host "Server installed at $serverUrl. Install certificates\local-ca.cer as a trusted CA on each client. Private keys must never be shared."
Write-Host 'Automatic updates remain disabled. GitHub CLI is required to verify update provenance.'
