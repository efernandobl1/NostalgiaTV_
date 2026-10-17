#Requires -RunAsAdministrator
[CmdletBinding()]
param([Parameter(Mandatory)][string]$InstallDirectory)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$data = Join-Path $env:ProgramData 'NostalgiaTV'
try { $lease = [IO.File]::Open((Join-Path $data '.maintenance.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
catch [IO.IOException] { exit 0 }
$requests = Join-Path $data 'updates\requests'
$statusFile = Join-Path $data 'updates\status\status.json'
$state = if (Test-Path $statusFile) { Get-Content $statusFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{ state = 'idle'; heartbeat = ''; message = ''; lastWindow = '' } }
function Report([string]$Value, [string]$Message = '') {
    $state.state = $Value; $state.heartbeat = [DateTimeOffset]::UtcNow.ToString('o'); $state.message = $Message
    $state | ConvertTo-Json | Set-Content "$statusFile.tmp" -Encoding UTF8
    Move-Item -LiteralPath "$statusFile.tmp" -Destination $statusFile -Force
}
function Verify([string]$File, [string]$Bundle, [string]$Commit) {
    & gh.exe attestation verify $File --bundle $Bundle --repo efernandobl1/NostalgiaTV_ --signer-workflow efernandobl1/NostalgiaTV_/.github/workflows/deploy.yml --source-ref refs/heads/main --source-digest $Commit | Out-Null
    if ($LASTEXITCODE) { throw 'Release provenance validation failed.' }
}
if (!(Get-Command gh.exe -ErrorAction SilentlyContinue)) { Report 'unavailable' 'Instala GitHub CLI para verificar y ejecutar actualizaciones.'; exit 0 }
$requestFile = Join-Path $requests 'update.json'
$manual = Test-Path $requestFile
if ($manual) { Remove-Item -LiteralPath $requestFile }
$policyFile = Join-Path $requests 'policy.json'
$policy = if ((Test-Path $policyFile) -and ((Get-Date).ToUniversalTime() - (Get-Item $policyFile).LastWriteTimeUtc).TotalMinutes -lt 10) { Get-Content $policyFile -Raw | ConvertFrom-Json } else { $null }
$now = [DateTimeOffset]::UtcNow
$scheduled = $false
if ($policy -and $policy.enabled) {
    $window = [DateTimeOffset]::Parse($policy.windowStartUtc)
    $scheduled = $now -ge $window -and $now -lt $window.AddHours(1) -and $state.lastWindow -ne $policy.windowStartUtc
}
if (!$manual -and !$scheduled) {
    if ($state.state -in 'failed','completed') { Report $state.state $state.message }
    else { Report 'idle' }
    exit 0
}
$temporary = Join-Path $env:ProgramData ('NostalgiaTV\updates\download-' + [Guid]::NewGuid().ToString('N'))
$stopped = @()
$migrationStarted = $false
$settingsFile = Join-Path $data 'appsettings.json'
$settings = Get-Content $settingsFile -Raw | ConvertFrom-Json
$previousCommit = $settings.ServerUpdates.CurrentCommit
function Invoke-Native([string]$Executable, [string[]]$Arguments) {
    $log = Join-Path $temporary ([Guid]::NewGuid().ToString('N'))
    $quoted = ($Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $process = Start-Process -FilePath $Executable -ArgumentList $quoted -PassThru -WindowStyle Hidden -RedirectStandardOutput "$log.log" -RedirectStandardError "$log.error.log"
    try {
        while (!$process.WaitForExit(30000)) { Report 'updating' 'Respaldo y migraciones en curso. No apagues el servidor.' }
        if ($process.ExitCode) { throw "Native maintenance failed. Inspect private updater logs: $log" }
    } finally { $process.Dispose() }
}
try {
    if (!(Get-Command gh.exe -ErrorAction SilentlyContinue)) { throw 'GitHub CLI is required for provenance verification.' }
    $release = Invoke-RestMethod https://api.github.com/repos/efernandobl1/NostalgiaTV_/releases/latest -Headers @{ 'User-Agent' = 'NostalgiaTV-Updater' }
    $commit = $release.target_commitish
    if ($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v\d+\.\d+\.\d+$' -or $commit -notmatch '^[a-f0-9]{40}$') { throw 'A complete stable release is required.' }
    if ($commit -eq $previousCommit) { Report 'idle'; exit 0 }
    $mediaSize = (Get-ChildItem (Join-Path $data 'wwwroot') -File -Recurse | Measure-Object Length -Sum).Sum
    $backupSize = (Get-ChildItem (Join-Path $data 'backups\sql') -File -Filter '*.bak' | Measure-Object Length -Maximum).Maximum
    $required = [double]$mediaSize + 2 * [double]$backupSize + 4GB
    if ([IO.DriveInfo]::new([IO.Path]::GetPathRoot($data)).AvailableFreeSpace -lt $required) { throw 'Insufficient free space for the release and a verified backup. Free space without deleting the only recovery copy.' }
    New-Item -ItemType Directory -Path $temporary | Out-Null
    foreach ($name in 'release.json','release.intoto.jsonl','nostalgiatv-server-windows-x64.zip') {
        $asset = @($release.assets | Where-Object name -eq $name)
        $expectedUrl = 'https://github.com/efernandobl1/NostalgiaTV_/releases/download/' + $release.tag_name + '/' + $name
        if ($asset.Count -ne 1 -or $asset[0].browser_download_url -ne $expectedUrl -or $asset[0].size -gt 536870912) { throw 'Unexpected release asset.' }
        Invoke-WebRequest $expectedUrl -OutFile (Join-Path $temporary $name) -UseBasicParsing
    }
    $bundle = Join-Path $temporary 'release.intoto.jsonl'
    Verify (Join-Path $temporary 'release.json') $bundle $commit
    $manifest = Get-Content (Join-Path $temporary 'release.json') -Raw | ConvertFrom-Json
    if ($manifest.schemaVersion -ne 1 -or $manifest.commit -ne $commit) { throw 'Release identity mismatch.' }
    $archive = Join-Path $temporary 'nostalgiatv-server-windows-x64.zip'
    $expected = $manifest.assets | Where-Object name -eq 'nostalgiatv-server-windows-x64.zip'
    if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne $expected.sha256) { throw 'Checksum mismatch.' }
    Verify $archive $bundle $commit
    $target = Join-Path $InstallDirectory "releases\$commit"
    if (Test-Path $target) { throw 'The target version already exists; inspect the previous attempt before retrying.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        foreach ($entry in $zip.Entries) {
            $resolved = [IO.Path]::GetFullPath((Join-Path $target $entry.FullName))
            if (!$resolved.StartsWith($target.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe archive path.' }
        }
    } finally { $zip.Dispose() }
    Expand-Archive -LiteralPath $archive -DestinationPath $target
    Report 'updating' 'Respaldo y migraciones en curso. No apagues el servidor.'
    foreach ($name in 'NostalgiaTV-Media','NostalgiaTV') {
        if ((Get-Service $name).Status -eq 'Running') { Stop-Service $name; $stopped += $name }
    }
    $backup = Join-Path $data ('backups\' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backup | Out-Null
    $sqlBackup = Join-Path $data ('backups\sql\' + [Guid]::NewGuid().ToString('N') + '.bak')
    Invoke-Native (Join-Path $InstallDirectory "releases\$previousCommit\WebApi.exe") @('--native-backup', $sqlBackup, '--contentRoot', $data)
    Copy-Item -LiteralPath $sqlBackup -Destination (Join-Path $backup 'database.bak')
    foreach ($name in 'wwwroot','appsettings.json','migration.private.json','certificates') { Copy-Item -LiteralPath (Join-Path $data $name) -Destination $backup -Recurse }
    Get-ChildItem $backup -File -Recurse | Get-FileHash -Algorithm SHA256 | Select-Object Hash,Path | ConvertTo-Json | Set-Content (Join-Path $backup 'checksums.json') -Encoding UTF8
    $migrationStarted = $true
    Invoke-Native (Join-Path $target 'WebApi.exe') @('--migrate', '--contentRoot', $data)
    $settings.ServerUpdates.CurrentCommit = $commit
    $settings | ConvertTo-Json -Depth 15 | Set-Content "$settingsFile.tmp" -Encoding UTF8
    Set-Acl -LiteralPath "$settingsFile.tmp" -AclObject (Get-Acl -LiteralPath $settingsFile)
    Move-Item -LiteralPath "$settingsFile.tmp" -Destination $settingsFile -Force
    foreach ($name in 'NostalgiaTV','NostalgiaTV-Media') {
        $arguments = if ($name -eq 'NostalgiaTV-Media') { '--media-worker' } else { "--webroot `"$(Join-Path $data 'wwwroot')`"" }
        & sc.exe config $name binPath= "`"$(Join-Path $target 'WebApi.exe')`" $arguments --contentRoot `"$data`"" | Out-Null
        if ($LASTEXITCODE) { throw 'Unable to switch the service executable.' }
    }
    foreach ($name in $stopped) { Start-Service $name }
    $healthy = $false
    foreach ($attempt in 1..24) {
        & (Join-Path $target 'WebApi.exe') --native-health --contentRoot $data 2>$null
        if (!$LASTEXITCODE) { $healthy = $true; break }
        Start-Sleep -Seconds 5
    }
    if (!$healthy) { throw 'Updated server did not become ready. Inspect the backup and service logs; no downgrade was attempted.' }
    $state.lastWindow = $policy.windowStartUtc
    Report 'completed' 'Servidor actualizado y comprobado.'
} catch {
    Report 'failed' 'No se completó la actualización. Revisa el historial de tareas y el respaldo.'
    throw
} finally {
    # Keep failed downloads and backups for diagnosis; never delete the installation or media.
    foreach ($name in $stopped) {
        if ((Get-Service $name).Status -eq 'Stopped') {
            if (!$migrationStarted) { Start-Service $name }
            else { Write-Warning "$name remains stopped; inspect the failed update before restarting." }
        }
    }
}
