#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
foreach ($name in 'NostalgiaTV-Media','NostalgiaTV') {
    $service = Get-Service $name -ErrorAction SilentlyContinue
    if ($service) { Stop-Service $name -ErrorAction Stop; & sc.exe delete $name | Out-Null }
}
Unregister-ScheduledTask -TaskName NostalgiaTV-Updater -Confirm:$false -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName 'NostalgiaTV Local Network' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host 'Services removed. Database, media, private configuration and backups in ProgramData were preserved.'
