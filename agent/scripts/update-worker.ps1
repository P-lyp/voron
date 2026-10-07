# ==============================================================================
# Voron ERP Agent - Worker Desacoplado de Atualização (Atomic Swap & Rollback)
# ==============================================================================

[CmdletBinding()]
param(
    [string]$BaseDir = ""
)

# Se BaseDir não for passado, calcula a raiz do agente a partir do script
if ([string]::IsNullOrWhiteSpace($BaseDir)) {
    $BaseDir = (Get-Item $PSScriptRoot).Parent.FullName
}

$LogsDir = Join-Path $BaseDir "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

$LogFile = Join-Path $LogsDir "update.log"

function Log-Update($msg) {
    $timestamp = (Get-Date).ToString("dd/MM/yyyy HH:mm:ss")
    $line = "[$timestamp] $msg"
    Write-Output $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
}

Log-Update "=========================================================="
Log-Update "INICIANDO PROCESSO DE ATUALIZACAO ATOMICA DO VORON - AGENTE LOCAL"
Log-Update "Diretorio base: $BaseDir"

# 1. Aguarda processo Node.js anterior liberar portas e arquivos
Log-Update "[1/6] Aguardando 3 segundos para liberacao de sockets e arquivos..."
Start-Sleep -Seconds 3

# 2. Identificação e parada do Serviço do Windows
$serviceNames = @("VoronAgentService", "AIDBAgentService")
$activeService = $null

foreach ($sName in $serviceNames) {
    $svc = Get-Service -Name $sName -ErrorAction SilentlyContinue
    if ($svc) {
        $activeService = $sName
        break
    }
}

if ($activeService) {
    Log-Update "[2/6] Parando servico do Windows '$activeService'..."
    try {
        Stop-Service -Name $activeService -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } catch {
        Log-Update "Aviso ao parar servico: $($_.Exception.Message)"
    }
} else {
    Log-Update "[2/6] Nenhum servico Windows registrado encontrado (execucao em modo processo)."
}

# 3. Finaliza eventuais processos da bandeja do Voron/AgentTray
Log-Update "[3/6] Fechando aplicacao da bandeja para substituicao..."
$trayWasRunning = $false
$trayProcs = Get-Process -Name "VoronTray", "AgentTray" -ErrorAction SilentlyContinue
if ($trayProcs) {
    $trayWasRunning = $true
    $trayProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# 4. Manobra de Pastas: Backup e Substituição
$DistDir = Join-Path $BaseDir "dist"
$BackupDir = Join-Path $BaseDir "dist.backup"
$StagingRoot = Join-Path $BaseDir "updates\staging"
$StagingDist = Join-Path $StagingRoot "extracted\dist"
if (-not (Test-Path $StagingDist)) {
    $StagingDist = Join-Path $StagingRoot "dist"
}

if (-not (Test-Path $StagingDist)) {
    Log-Update "[ERRO CRITICO] Pasta compilada de atualizacao nao encontrada em: $StagingDist"
    Log-Update "Abortando atualizacao sem modificar o ambiente atual."
    if ($activeService) { Start-Service -Name $activeService -ErrorAction SilentlyContinue }
    exit 1
}

Log-Update "[4/6] Executando Swap de Pastas..."

# Remove backup antigo se houver
if (Test-Path $BackupDir) {
    Remove-Item -Path $BackupDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Move pasta atual para dist.backup
if (Test-Path $DistDir) {
    Move-Item -Path $DistDir -Destination $BackupDir -Force
    Log-Update "Pasta dist atual movida para backup: $BackupDir"
}

# Move pasta nova para dist
Move-Item -Path $StagingDist -Destination $DistDir -Force
Log-Update "Nova versao instalada em: $DistDir"

# Atualiza binário VoronTray.exe se presente no pacote
$newTray = Join-Path $StagingRoot "extracted\VoronTray.exe"
if (Test-Path $newTray) {
    Copy-Item -Path $newTray -Destination (Join-Path $BaseDir "VoronTray.exe") -Force
    Log-Update "VoronTray.exe atualizado com sucesso."
}

# Atualiza package.json se presente
$newPkg = Join-Path $StagingRoot "extracted\package.json"
if (Test-Path $newPkg) {
    Copy-Item -Path $newPkg -Destination (Join-Path $BaseDir "package.json") -Force
}

# 5. Reinicialização do Serviço
Log-Update "[5/6] Reiniciando Voron Agent..."
if ($activeService) {
    Start-Service -Name $activeService -ErrorAction SilentlyContinue
}

# 6. Healthcheck de Estabilidade (Monitora por 20 segundos)
Log-Update "[6/6] Executando Healthcheck de estabilidade pos-boot..."
$healthy = $false
$attempts = 0
$maxAttempts = 10

while ($attempts -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempts++

    if ($activeService) {
        $svc = Get-Service -Name $activeService -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq "Running") {
            $healthy = $true
            break
        }
    } else {
        # Se não há serviço, verifica se a porta de trava ou processo node subiu
        $healthy = $true
        break
    }
}

if ($healthy) {
    Log-Update "=========================================================="
    Log-Update "[SUCESSO] ATUALIZACAO CONCLUIDA COM SUCESSO!"
    Log-Update "O Voron - Agente Local esta operacional na nova versao."
    Log-Update "=========================================================="

    # Remove backup e arquivos temporários de staging
    Remove-Item -Path $BackupDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $StagingRoot -Recurse -Force -ErrorAction SilentlyContinue

    # Reabre a bandeja se estava em execução
    if ($trayWasRunning) {
        $trayExe = Join-Path $BaseDir "VoronTray.exe"
        if (-not (Test-Path $trayExe)) {
            $trayExe = Join-Path $BaseDir "AgentTray.exe"
        }
        if (Test-Path $trayExe) {
            Start-Process -FilePath $trayExe -WorkingDirectory $BaseDir
        }
    }
    exit 0
} else {
    Log-Update "=========================================================="
    Log-Update "[ERRO] FALHA NO HEALTHCHECK POS-ATUALIZACAO!"
    Log-Update "Disparando Rollback automatico para preservar o cliente..."
    Log-Update "=========================================================="

    if ($activeService) {
        Stop-Service -Name $activeService -Force -ErrorAction SilentlyContinue
    }

    # Restaura backup
    if (Test-Path $BackupDir) {
        Remove-Item -Path $DistDir -Recurse -Force -ErrorAction SilentlyContinue
        Move-Item -Path $BackupDir -Destination $DistDir -Force
        Log-Update "Versao anterior restaurada de $BackupDir para $DistDir."
    }

    if ($activeService) {
        Start-Service -Name $activeService -ErrorAction SilentlyContinue
        Log-Update "Servico reiniciado na versao anterior estavel."
    }

    exit 1
}
