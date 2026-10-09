; ==============================================================================
; SCRIPT DE INSTALACAO PROFISSIONAL - VORON AGENTE LOCAL (FIREBIRD)
; Compilador recomendado: Inno Setup 6.x (https://jrsoftware.org/isdl.php)
; ==============================================================================

#define MyAppName "Voron - Agente Local"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Voron Sistemas"
#define MyAppURL "https://voron.com.br"
#define MyAppExeName "ConfigVoron.exe"
#define MyTrayExeName "VoronTray.exe"
#define MyServiceExeName "AI-DB-Agent-Service.exe"

[Setup]
; Identificador exclusivo da aplicacao (Nao altere em atualizacoes futuras)
AppId={{8B321F5A-4B6A-4A73-B561-92DCEF200A40}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Diretorio padrao de instalacao (C:\Voron-Agente evita restricoes de permissao de logs do Windows)
DefaultDirName=C:\Voron-Agente
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Exige privilegios de Administrador para registrar o servico nativo do Windows
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Pasta onde o instalador gerado sera salvo
OutputDir=..\releases
OutputBaseFilename=Setup-Voron-Agente-v{#MyAppVersion}

; Configuracoes de compactacao e aparencia moderna
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=force

; Informacoes de desinstalacao e icones
SetupIconFile=assets\config_voron.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostart"; Description: "Iniciar monitor da bandeja automaticamente com o Windows"; GroupDescription: "Inicializacao:"; Flags: checkedonce

[Dirs]
; Garante permissoes totais na pasta de logs para o servico rodar sem bloqueios
Name: "{app}\logs"; Permissions: users-modify

[Files]
; 1. Executaveis e Configuradores Principais
Source: "{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MyTrayExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MyServiceExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "AI-DB-Agent-Service.xml"; DestDir: "{app}"; Flags: ignoreversion
Source: "winsw.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

; 2. Scripts Utilitarios de Seguranca
Source: "instalar-servico.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "desinstalar-servico.bat"; DestDir: "{app}"; Flags: ignoreversion

; 3. Codigo Compilado do Agente (Node.js)
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; 4. Arquivo de Configuracao (.env)
; IMPORTANTE: Se o cliente ja tiver um .env configurado, NUNCA sobrescreve (onlyifdoesntexist)
Source: ".env.example"; DestDir: "{app}"; DestName: ".env"; Flags: onlyifdoesntexist uninsneveruninstall
Source: ".env.example"; DestDir: "{app}"; Flags: ignoreversion

; 5. Binario do Node.js Standalone (opcional se fornecido na pasta)
Source: "node.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

; 6. Icones e Recursos Visuais Oficiais
Source: "assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Atalhos no Menu Iniciar
Name: "{group}\{#MyAppName} - Configurador"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\{#MyAppName} - Monitor de Bandeja"; Filename: "{app}\{#MyTrayExeName}"; IconFilename: "{app}\{#MyTrayExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; Atalho Opcional na Area de Trabalho
Name: "{autodesktop}\Configurar Agente Voron"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; Registra a bandeja para inicializar com o Windows para qualquer usuario da maquina (HKLM)
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "VoronAgentTray"; ValueData: """{app}\{#MyTrayExeName}"""; Tasks: autostart; Flags: uninsdeletevalue

[Run]
; 1. Registra e inicia o servico do Windows silenciosamente
Filename: "{app}\{#MyServiceExeName}"; Parameters: "install"; StatusMsg: "Registrando Servico do Windows..."; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyServiceExeName}"; Parameters: "start"; StatusMsg: "Iniciando Servico do Agente..."; Flags: runhidden waituntilterminated

; 2. Abre a bandeja do agente em segundo plano
Filename: "{app}\{#MyTrayExeName}"; Flags: nowait

; 3. Opcao final para o tecnico ja abrir a tela de configuracao do banco Firebird
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir o Configurador agora para apontar o banco Firebird"; Flags: postinstall skipifsilent nowait

[UninstallRun]
; Procedimentos limpos executados automaticamente ao desinstalar pelo Windows
Filename: "taskkill.exe"; Parameters: "/F /IM {#MyTrayExeName}"; Flags: runhidden; RunOnceId: "KillTray"
Filename: "taskkill.exe"; Parameters: "/F /IM AgentTray.exe"; Flags: runhidden; RunOnceId: "KillLegacyTray"
Filename: "taskkill.exe"; Parameters: "/F /IM {#MyAppExeName}"; Flags: runhidden; RunOnceId: "KillConfig"
Filename: "taskkill.exe"; Parameters: "/F /IM ConfigAgente.exe"; Flags: runhidden; RunOnceId: "KillLegacyConfig"
Filename: "{app}\{#MyServiceExeName}"; Parameters: "stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopService"
Filename: "{app}\{#MyServiceExeName}"; Parameters: "uninstall"; Flags: runhidden waituntilterminated; RunOnceId: "UninstallService"
