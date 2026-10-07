import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const AGENT_DIR = path.join(ROOT_DIR, 'agent');
const RELEASES_DIR = path.join(ROOT_DIR, 'releases');
const BACKEND_RELEASES_DIR = path.join(ROOT_DIR, 'backend', 'releases');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function calculateSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function copyFolderRecursive(source: string, target: string): void {
  ensureDir(target);
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function packageAgent(): Promise<void> {
  console.log('====================================================');
  console.log('EMPACOTADOR DE RELEASES DO VORON - AGENTE LOCAL');
  console.log('====================================================');

  // 1. Compilação do pacote agent
  console.log('Compilando @ai-db/agent...');
  execSync('npm run build --workspace=@ai-db/agent', { stdio: 'inherit', cwd: ROOT_DIR });

  // 2. Leitura da versão atual
  const agentPkgPath = path.join(AGENT_DIR, 'package.json');
  const agentPkg = JSON.parse(fs.readFileSync(agentPkgPath, 'utf-8'));
  const version = agentPkg.version || '1.0.0';
  console.log(`Versao do Voron - Agente Local detectada: v${version}`);

  // 3. Preparação do diretório de staging
  const stagingDir = path.join(ROOT_DIR, '.staging-agent-bundle');
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  ensureDir(stagingDir);

  // Copia a pasta dist/ compilada
  const distSrc = path.join(AGENT_DIR, 'dist');
  const distDest = path.join(stagingDir, 'dist');
  if (!fs.existsSync(distSrc)) {
    throw new Error(`Pasta compilada ${distSrc} nao encontrada!`);
  }
  copyFolderRecursive(distSrc, distDest);

  // Copia package.json do agent
  fs.copyFileSync(agentPkgPath, path.join(stagingDir, 'package.json'));

  // Copia scripts do agente se existirem (ex: update-worker.ps1)
  const scriptsSrc = path.join(AGENT_DIR, 'scripts');
  if (fs.existsSync(scriptsSrc)) {
    const scriptsDest = path.join(stagingDir, 'scripts');
    copyFolderRecursive(scriptsSrc, scriptsDest);
  }

  // 4. Criação do arquivo .zip
  ensureDir(RELEASES_DIR);
  ensureDir(BACKEND_RELEASES_DIR);

  const zipName = 'voron-agent-latest.zip';
  const zipPath = path.join(RELEASES_DIR, zipName);
  const fallbackZipPath = path.join(RELEASES_DIR, 'agent-latest.zip');

  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  if (fs.existsSync(fallbackZipPath)) fs.unlinkSync(fallbackZipPath);

  console.log(`Comprimindo pacote em ${zipName}...`);
  if (process.platform === 'win32') {
    const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${zipPath}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });
  } else {
    execSync(`cd "${stagingDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  }

  // Gera cópia de compatibilidade
  fs.copyFileSync(zipPath, fallbackZipPath);

  // Copia para backend/releases/
  fs.copyFileSync(zipPath, path.join(BACKEND_RELEASES_DIR, zipName));
  fs.copyFileSync(fallbackZipPath, path.join(BACKEND_RELEASES_DIR, 'agent-latest.zip'));

  // 5. Cálculo do Hash SHA-256 e Tamanho
  const sha256 = calculateSha256(zipPath);
  const sizeBytes = fs.statSync(zipPath).size;

  // 6. Geração do version.json
  const versionInfo = {
    name: 'Voron - Agente Local',
    version,
    sha256,
    sizeBytes,
    releaseDate: new Date().toISOString(),
    isMandatory: false,
    downloadUrl: '/api/agent/update/download',
    changelog: [
      `Release Voron - Agente Local v${version}`,
      'Compatibilidade nativa com Firebird 5.0 (TGA.FDB)',
      'Suporte a auto-update atomico com rollback seguro e healthcheck',
      'Executavel VoronTray e servico Voron aprimorados',
    ],
  };

  const versionJsonContent = JSON.stringify(versionInfo, null, 2);
  fs.writeFileSync(path.join(RELEASES_DIR, 'version.json'), versionJsonContent, 'utf-8');
  fs.writeFileSync(path.join(BACKEND_RELEASES_DIR, 'version.json'), versionJsonContent, 'utf-8');

  // Limpeza do diretório temporário
  fs.rmSync(stagingDir, { recursive: true, force: true });

  console.log('----------------------------------------------------');
  console.log(`PACOTE GERADO COM SUCESSO!`);
  console.log(`Arquivo: ${zipPath}`);
  console.log(`Tamanho: ${(sizeBytes / 1024).toFixed(1)} KB`);
  console.log(`SHA-256: ${sha256}`);
  console.log(`Versao: ${version}`);
  console.log('====================================================');
}

packageAgent().catch((err) => {
  console.error('[Package] Falha ao empacotar Voron - Agente Local:', err);
  process.exit(1);
});
