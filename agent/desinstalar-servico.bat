@echo off
:: ============================================================================
:: Desinstalador do Servico Voron - Agente Local (Firebird)
:: ============================================================================
chcp 65001 >nul
title Desinstalando Servico Voron - Agente Local

echo.
echo ========================================================
echo   DESINSTALADOR DO VORON - AGENTE LOCAL
echo ========================================================
echo.

:: Verifica privilégios de Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Este desinstalador precisa ser executado como ADMINISTRADOR.
    echo Por favor, clique com o botão direito e selecione "Executar como Administrador".
    echo.
    pause
    exit /b 1
)

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [1/3] Parando Servico do Windows...
AI-DB-Agent-Service.exe stop >nul 2>&1

echo [2/3] Removendo Servico do Windows...
AI-DB-Agent-Service.exe uninstall

echo [3/3] Removendo inicializacao automatica da Bandeja...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "VoronTray" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AIDBAgentTray" /f >nul 2>&1

:: Encerra o VoronTray.exe e AgentTray.exe se estiverem rodando
taskkill /f /im VoronTray.exe >nul 2>&1
taskkill /f /im AgentTray.exe >nul 2>&1

echo.
echo ========================================================
echo   DESINSTALACAO CONCLUIDA!
echo ========================================================
echo.
pause
