#ifndef Commit
  #error Commit must be supplied by CI
#endif
#ifndef Version
  #error Version must be supplied by CI
#endif
[Setup]
AppId={{1A3CBFD3-4144-4CFD-BAB1-904A65C2AA57}
AppName=NostalgiaTV Server
AppVersion={#Version}
DefaultDirName={autopf}\NostalgiaTV
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\..\release
OutputBaseFilename=nostalgiatv-windows-x64-setup
Compression=lzma2
SolidCompression=yes
Uninstallable=yes
WizardStyle=modern
DisableProgramGroupPage=yes
[Files]
Source: "..\..\native-publish\*"; DestDir: "{app}\releases\{#Commit}"; Flags: recursesubdirs createallsubdirs
Source: "configure.ps1"; DestDir: "{app}\tools"
Source: "update.ps1"; DestDir: "{app}\tools"
Source: "uninstall.ps1"; DestDir: "{app}\tools"
[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy RemoteSigned -File ""{app}\tools\uninstall.ps1"""; Flags: waituntilterminated
[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Arguments: String;
begin
  if CurStep = ssPostInstall then
  begin
    Arguments := '-NoProfile -ExecutionPolicy RemoteSigned -File "' + ExpandConstant('{app}\tools\configure.ps1') + '" -InstallDirectory "' + ExpandConstant('{app}') + '" -Commit {#Commit}';
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Arguments, '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
      RaiseException('Unable to start server configuration. No working server was installed.');
    if ResultCode <> 0 then
      RaiseException('Server configuration failed. Inspect its error before retrying; existing configuration and database backups were preserved.');
  end;
end;
