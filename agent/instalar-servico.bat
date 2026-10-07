@echo off
:: ============================================================================
:: Instalador do Servico Voron - Agente Local (Firebird)
:: ============================================================================
chcp 65001 >nul
title Instalando Servico Voron - Agente Local

echo.
echo ========================================================
echo   INSTALADOR DO VORON - AGENTE LOCAL (FIREBIRD 5.0)
echo ========================================================
echo.

:: Verifica privilégios de Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Este instalador precisa ser executado como ADMINISTRADOR.
    echo Por favor, clique com o botão direito e selecione "Executar como Administrador".
    echo.
    pause
    exit /b 1
)

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [1/3] Registrando Servico no Windows...
AI-DB-Agent-Service.exe install
if %errorLevel% neq 0 (
    echo [AVISO] Falha ao registrar servico ou ele ja esta registrado.
)

echo [2/3] Iniciando Servico em segundo plano...
AI-DB-Agent-Service.exe start

echo [3/3] Configurando inicializacao automatica da Bandeja (VoronTray)...
set TRAY_EXE=VoronTray.exe
if not exist "%SCRIPT_DIR%VoronTray.exe" (
    if exist "%SCRIPT_DIR%AgentTray.exe" (
        set TRAY_EXE=AgentTray.exe
    )
)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "VoronTray" /t REG_SZ /d "\"%SCRIPT_DIR%%TRAY_EXE%\"" /f >nul 2>&1

:: Inicia o VoronTray na sessao atual
start "" "%SCRIPT_DIR%%TRAY_EXE%"

echo.
echo ========================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================================
echo.
echo - O servico agora roda automaticamente com o Windows.
echo - O icone do agente esta visivel na bandeja do relogio.
echo - Voce pode gerenciar ou testar o banco clicando no icone.
echo.
pause
