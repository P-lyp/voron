import { Router, Request, Response } from 'express';
import { CompanyService } from '../services/companyService.js';
import { CustomerRegistrationPayload } from '@ai-db/shared';

const router = Router();
const companyService = CompanyService.getInstance();

// Rate limiter específico para prevenção de spam no cadastro público (5 requisições por 10 minutos por IP)
const registrationRateMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_REGISTRATIONS_PER_IP = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (registrationRateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= MAX_REGISTRATIONS_PER_IP) {
    registrationRateMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  registrationRateMap.set(ip, timestamps);
  return false;
}

// Algoritmo oficial de validação de CPF (Dígitos verificadores)
function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(clean[10]);
}

// Algoritmo oficial de validação de CNPJ (Dígitos verificadores)
function isValidCnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(clean[i]) * weights1[i];
  let rest = sum % 11;
  const dig1 = rest < 2 ? 0 : 11 - rest;
  if (dig1 !== parseInt(clean[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(clean[i]) * weights2[i];
  rest = sum % 11;
  const dig2 = rest < 2 ? 0 : 11 - rest;
  return dig2 === parseInt(clean[13]);
}

// 1. Informações básicas da empresa para a landing page pública de cadastro
router.get('/company/:slug/info', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: 'Slug da empresa não informado' });
    }

    const info = await companyService.getPublicCompanyInfo(slug);
    return res.json(info);
  } catch (err: any) {
    console.error('Erro ao buscar dados públicos da empresa:', err.message);
    return res.status(404).json({ error: err.message || 'Empresa não encontrada' });
  }
});

// 2. Submissão pública do formulário de cadastro (com Rate Limiting e Validação Estrita)
router.post('/register/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const body = req.body as CustomerRegistrationPayload;

    if (!slug) {
      return res.status(400).json({ error: 'Identificador da empresa não fornecido.' });
    }

    // Proteção Anti-Abuso / DoS por IP
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown_ip';

    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        error: 'Você enviou muitos cadastros recentemente. Por favor, aguarde alguns minutos antes de tentar novamente.',
      });
    }

    // Validação estrita de campos obrigatórios
    const missingFields: string[] = [];
    if (!body.nome || !body.nome.trim()) missingFields.push('Nome / Razão Social');
    if (!body.cpfCnpj || !body.cpfCnpj.trim()) missingFields.push('CPF ou CNPJ');
    if (!body.telefone || !body.telefone.trim()) missingFields.push('Telefone / WhatsApp');
    if (!body.cep || !body.cep.trim()) missingFields.push('CEP');
    if (!body.logradouro || !body.logradouro.trim()) missingFields.push('Rua / Logradouro');
    if (!body.numero || !body.numero.trim()) missingFields.push('Número');
    if (!body.bairro || !body.bairro.trim()) missingFields.push('Bairro');
    if (!body.cidade || !body.cidade.trim()) missingFields.push('Cidade');
    if (!body.uf || !body.uf.trim()) missingFields.push('Estado / UF');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Por favor preencha todos os campos obrigatórios: ${missingFields.join(', ')}`,
      });
    }

    // Validação matemática rigorosa do CPF/CNPJ
    const rawDoc = (body.cpfCnpj || '').replace(/\D/g, '');
    if (rawDoc.length === 11) {
      if (!isValidCpf(rawDoc)) {
        return res.status(400).json({ error: 'O CPF informado é inválido. Verifique os números digitados.' });
      }
    } else if (rawDoc.length === 14) {
      if (!isValidCnpj(rawDoc)) {
        return res.status(400).json({ error: 'O CNPJ informado é inválido. Verifique os números digitados.' });
      }
    } else {
      return res.status(400).json({ error: 'Documento deve conter exatamente 11 dígitos (CPF) ou 14 dígitos (CNPJ).' });
    }

    // Sanitização de comprimentos máximos
    const sanitizedPayload: CustomerRegistrationPayload = {
      ...body,
      nome: body.nome.trim().slice(0, 60),
      nomeFantasia: body.nomeFantasia ? body.nomeFantasia.trim().slice(0, 60) : undefined,
      cpfCnpj: rawDoc,
      email: body.email ? body.email.trim().slice(0, 100) : undefined,
      telefone: body.telefone.trim().slice(0, 15),
      cep: body.cep.replace(/\D/g, '').slice(0, 8),
      logradouro: body.logradouro.trim().slice(0, 80),
      numero: body.numero.trim().slice(0, 10),
      complemento: body.complemento ? body.complemento.trim().slice(0, 60) : undefined,
      bairro: body.bairro.trim().slice(0, 40),
      cidade: body.cidade.trim().slice(0, 32),
      uf: body.uf.trim().slice(0, 2).toUpperCase(),
    };

    const result = await companyService.createCustomerRegistration(slug, sanitizedPayload);

    if (!result.success) {
      return res.status(409).json(result);
    }

    return res.status(201).json(result);
  } catch (err: any) {
    console.error('Erro ao registrar cliente via link público:', err.message);
    return res.status(500).json({
      error: err.message || 'Ocorreu um erro ao processar o seu cadastro. Tente novamente mais tarde.',
    });
  }
});


export default router;
