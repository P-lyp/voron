import { spawn } from 'child_process';
import path from 'path';
import { QueryRequestEnvelope, QueryResponseEnvelope } from '@ai-db/shared';

import fs from 'fs';

function resolveBridgeScript(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/db-bridge.py'),
    path.resolve(process.cwd(), 'agent/src/db-bridge.py'),
    path.resolve(__dirname, '../../src/db-bridge.py'),
    path.resolve(__dirname, '../src/db-bridge.py'),
    path.resolve(__dirname, 'db-bridge.py'),
  ];

  let bestCandidate = path.resolve(__dirname, 'db-bridge.py');
  let latestMtime = 0;

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        const stats = fs.statSync(c);
        if (stats.mtimeMs > latestMtime) {
          latestMtime = stats.mtimeMs;
          bestCandidate = c;
        }
      } catch {}
    }
  }

  console.log(`[Executor] Utilizando script Python: ${bestCandidate}`);
  return bestCandidate;
}

const BRIDGE_SCRIPT = resolveBridgeScript();

export async function executeTool(request: QueryRequestEnvelope): Promise<QueryResponseEnvelope> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const pythonProcess = spawn('python', [BRIDGE_SCRIPT], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString('utf-8');
    });

    pythonProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString('utf-8');
    });

    pythonProcess.on('close', (code) => {
      const elapsed = Date.now() - startTime;
      if (code !== 0 || !stdoutData.trim()) {
        resolve({
          correlationId: request.correlationId,
          type: 'QUERY_RESPONSE',
          success: false,
          executionTimeMs: elapsed,
          error: stderrData || `Falha na execução do processo Firebird (código: ${code})`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        const errMsg = parsed.error || (parsed.success === false ? parsed.message : undefined);
        resolve({
          correlationId: request.correlationId,
          type: 'QUERY_RESPONSE',
          success: parsed.success ?? true,
          executionTimeMs: parsed.executionTimeMs || elapsed,
          data: parsed.data ?? parsed,
          error: errMsg,
          code: parsed.code,
          existingClient: parsed.existingClient,
        } as any);
      } catch (err: any) {
        resolve({
          correlationId: request.correlationId,
          type: 'QUERY_RESPONSE',
          success: false,
          executionTimeMs: elapsed,
          error: `Erro ao decodificar JSON do Firebird: ${err.message}. Saída: ${stdoutData}`,
        });
      }
    });

    pythonProcess.on('error', (err) => {
      resolve({
        correlationId: request.correlationId,
        type: 'QUERY_RESPONSE',
        success: false,
        executionTimeMs: Date.now() - startTime,
        error: `Falha ao iniciar processo Python: ${err.message}`,
      });
    });

    // Envia o envelope JSON via stdin
    const inputPayload = JSON.stringify({
      toolName: request.toolName,
      params: request.params || {},
    });

    pythonProcess.stdin.write(inputPayload, 'utf-8');
    pythonProcess.stdin.end();
  });
}
