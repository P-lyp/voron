import { Request, Response, NextFunction } from 'express';
import { CompanyService } from '../services/companyService.js';

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequestsPerCompany?: number;
  maxRequestsPerClient?: number;
  message?: string;
}

export class SlidingWindowRateLimiter {
  private companyRecords = new Map<string, RateLimitRecord>();
  private clientRecords = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequestsPerCompany: number;
  private maxRequestsPerClient: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs || Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS) || 60 * 1000;
    this.maxRequestsPerCompany = options.maxRequestsPerCompany || Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE) || 20;
    this.maxRequestsPerClient = options.maxRequestsPerClient || 15;

    // Limpeza periódica em segundo plano de chaves inativas
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, record] of this.companyRecords.entries()) {
      record.timestamps = record.timestamps.filter((t) => t > cutoff);
      if (record.timestamps.length === 0) {
        this.companyRecords.delete(key);
      }
    }
    for (const [key, record] of this.clientRecords.entries()) {
      record.timestamps = record.timestamps.filter((t) => t > cutoff);
      if (record.timestamps.length === 0) {
        this.clientRecords.delete(key);
      }
    }
  }

  public reset(): void {
    this.companyRecords.clear();
    this.clientRecords.clear();
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.reset();
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const now = Date.now();
      const cutoff = now - this.windowMs;

      // Identificação da empresa alvo da requisição
      const companyId =
        (req.body && req.body.companyId) ||
        (req.headers['x-company-id'] as string) ||
        process.env.DEFAULT_COMPANY_ID ||
        'empresa-piloto-001';

      // 1. Obter regras dinâmicas da empresa no CompanyService (usa cache de 60s em memória)
      let isRateLimitEnabled = true;
      let effectiveCompanyLimit = this.maxRequestsPerCompany;

      try {
        const company = await CompanyService.getInstance().getCompanyBySlug(companyId);
        if (company?.businessRules?.copilot) {
          if (company.businessRules.copilot.rateLimitEnabled !== undefined) {
            isRateLimitEnabled = Boolean(company.businessRules.copilot.rateLimitEnabled);
          }
          if (company.businessRules.copilot.rateLimitPerMinute) {
            effectiveCompanyLimit = Math.max(1, Number(company.businessRules.copilot.rateLimitPerMinute));
          }
        }
      } catch (err: any) {
        console.warn(`[RateLimit] Falha ao verificar regras da empresa [${companyId}], usando fallback:`, err.message);
      }

      // Se o rate limit foi desabilitado para esta empresa no painel administrativo
      if (!isRateLimitEnabled) {
        res.setHeader('X-RateLimit-Limit', 'unlimited');
        res.setHeader('X-RateLimit-Remaining', 'unlimited');
        return next();
      }

      // Identificação do cliente IP para proteção anti-abuso individual
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown_ip';

      const clientKey = `${companyId}:${clientIp}`;

      // 2. Verificação do limite por empresa (protege o Firebird local e cota Gemini da empresa)
      let companyRec = this.companyRecords.get(companyId);
      if (!companyRec) {
        companyRec = { timestamps: [] };
        this.companyRecords.set(companyId, companyRec);
      }
      companyRec.timestamps = companyRec.timestamps.filter((t) => t > cutoff);

      if (companyRec.timestamps.length >= effectiveCompanyLimit) {
        const oldestTime = companyRec.timestamps[0];
        const retryAfterMs = Math.max(1000, oldestTime + this.windowMs - now);
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);

        res.setHeader('Retry-After', retryAfterSec);
        res.setHeader('X-RateLimit-Limit', effectiveCompanyLimit);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil((oldestTime + this.windowMs) / 1000));

        console.warn(`[RateLimit] Limite da empresa [${companyId}] atingido (${companyRec.timestamps.length}/${effectiveCompanyLimit} req/min).`);

        res.status(429).json({
          error: `Limite de mensagens excedido para esta empresa (${effectiveCompanyLimit} req/min). Aguarde ${retryAfterSec}s para não sobrecarregar o banco de dados da loja ou o Copilot.`,
          retryAfterSeconds: retryAfterSec,
          limit: effectiveCompanyLimit,
          windowSeconds: Math.round(this.windowMs / 1000),
        });
        return;
      }

      // 2. Verificação do limite por cliente/IP dentro da mesma empresa
      let clientRec = this.clientRecords.get(clientKey);
      if (!clientRec) {
        clientRec = { timestamps: [] };
        this.clientRecords.set(clientKey, clientRec);
      }
      clientRec.timestamps = clientRec.timestamps.filter((t) => t > cutoff);

      if (clientRec.timestamps.length >= this.maxRequestsPerClient) {
        const oldestTime = clientRec.timestamps[0];
        const retryAfterMs = Math.max(1000, oldestTime + this.windowMs - now);
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);

        res.setHeader('Retry-After', retryAfterSec);
        res.setHeader('X-RateLimit-Limit', this.maxRequestsPerClient);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil((oldestTime + this.windowMs) / 1000));

        console.warn(`[RateLimit] Limite do usuário [${clientIp}] na empresa [${companyId}] atingido.`);

        res.status(429).json({
          error: `Você está enviando mensagens muito rapidamente. Aguarde ${retryAfterSec}s antes de enviar a próxima pergunta.`,
          retryAfterSeconds: retryAfterSec,
          limit: this.maxRequestsPerClient,
          windowSeconds: Math.round(this.windowMs / 1000),
        });
        return;
      }

      // Registra a requisição em ambas as janelas deslizantes
      companyRec.timestamps.push(now);
      clientRec.timestamps.push(now);

      const remaining = Math.max(0, effectiveCompanyLimit - companyRec.timestamps.length);
      res.setHeader('X-RateLimit-Limit', effectiveCompanyLimit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil((companyRec.timestamps[0] + this.windowMs) / 1000));

      next();
    };
  }
}

export const chatRateLimiter = new SlidingWindowRateLimiter();
