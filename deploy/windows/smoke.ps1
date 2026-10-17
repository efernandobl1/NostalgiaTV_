[CmdletBinding()]
param([Parameter(Mandatory)][string]$PublishDirectory)
$ErrorActionPreference = 'Stop'
$data = Join-Path $env:RUNNER_TEMP ('nostalgia-native-smoke-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $data 'wwwroot\uploads') -Force | Out-Null
$executable = Join-Path (Resolve-Path $PublishDirectory) 'WebApi.exe'
$certificate = New-SelfSignedCertificate -DnsName localhost -CertStoreLocation Cert:\LocalMachine\My -NotAfter (Get-Date).AddDays(1)
$trusted = $null
try {
    $password = [guid]::NewGuid().ToString('N')
    $pfx = Join-Path $data 'server.pfx'
    Export-PfxCertificate -Cert $certificate -FilePath $pfx -Password (ConvertTo-SecureString $password -AsPlainText -Force) | Out-Null
    $public = Join-Path $data 'server.cer'
    Export-Certificate -Cert $certificate -FilePath $public | Out-Null
    $trusted = Import-Certificate -FilePath $public -CertStoreLocation Cert:\CurrentUser\Root
    @{
        ConnectionStrings = @{ DefaultConnection = 'Server=127.0.0.1,1;Database=smoke;User Id=unused;Password=unused;Encrypt=True;TrustServerCertificate=True;Connect Timeout=1' }
        Jwt = @{ Key = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')); Issuer = 'smoke'; Audience = 'smoke' }
        Database = @{ ApplyMigrations = $false }
        NativeHosting = @{ Enabled = $true }
        Cors = @{ AllowedOrigins = @('https://localhost:18590') }
        Kestrel = @{ Endpoints = @{ Https = @{ Url = 'https://localhost:18590'; Certificate = @{ Path = $pfx; Password = $password } } } }
        Serilog = @{ Using = @('Serilog.Sinks.File'); WriteTo = @(@{ Name = 'File'; Args = @{ path = (Join-Path $data 'smoke.log') } }) }
    } | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $data 'appsettings.json') -Encoding UTF8
    New-Service -Name NostalgiaTV -BinaryPathName "`"$executable`" --contentRoot `"$data`" --webroot `"$(Join-Path $data 'wwwroot')`"" -StartupType Manual | Out-Null
    # No production database or migrations are used by this isolated hosting/lifecycle test.
    New-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Services\NostalgiaTV -Name Environment -PropertyType MultiString -Value @('DOTNET_ENVIRONMENT=Development','ASPNETCORE_ENVIRONMENT=Development') | Out-Null
    Start-Service NostalgiaTV
    $response = $null
    foreach ($attempt in 1..30) {
        try { $response = Invoke-WebRequest https://localhost:18590/dashboard/settings; break }
        catch { Start-Sleep -Seconds 1 }
    }
    if (!$response -or $response.StatusCode -ne 200 -or $response.Content -notmatch '<app-root') { throw 'The native Windows service did not serve its SPA.' }
    if ($response.Headers['X-Content-Type-Options'] -ne 'nosniff' -or !$response.Headers['Content-Security-Policy']) { throw 'Native response security headers are missing.' }
    $missing = Invoke-WebRequest https://localhost:18590/api/does-not-exist -SkipHttpErrorCheck
    if ($missing.StatusCode -ne 404 -or $missing.Content -match '<app-root') { throw 'Unknown API routes must not return the SPA.' }
    $health = Invoke-WebRequest https://localhost:18590/health
    if ($health.StatusCode -ne 200) { throw 'Native liveness failed.' }
    Stop-Service NostalgiaTV
    if ((Get-Service NostalgiaTV).Status -ne 'Stopped') { throw 'The native service did not stop cleanly.' }
    Write-Host 'Native Windows service, HTTPS, SPA, security headers, API routing and stop lifecycle: OK'
} finally {
    if (Get-Service NostalgiaTV -ErrorAction SilentlyContinue) { Stop-Service NostalgiaTV -ErrorAction SilentlyContinue; & sc.exe delete NostalgiaTV | Out-Null }
    if ($trusted) { Remove-Item -LiteralPath $trusted.PSPath }
    Remove-Item -LiteralPath $certificate.PSPath
    if (Test-Path (Join-Path $data 'smoke.log')) { Get-Content (Join-Path $data 'smoke.log') -Tail 15 }
}
