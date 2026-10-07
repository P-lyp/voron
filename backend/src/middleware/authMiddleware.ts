import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase.js';
import { CompanyService } from '../services/companyService.js';
import { UserProfileDTO, UserRole } from '@ai-db/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
  erpVendedorId?: string | null;
  profile?: UserProfileDTO | null;
  token: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware para validar o token JWT de autenticação do Supabase.
 * Extrai e verifica o usuário na fonte oficial, injetando req.user.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token de autenticação não fornecido no cabeçalho Authorization.',
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token de autenticação vazio.',
    });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Sessão de usuário inválida ou expirada. Faça login novamente.',
      });
    }

    const email = (user.email || '').toLowerCase().trim();
    const isMasterAdmin = email === 'felipealves13tga@hotmail.com';

    // Obtém perfil cadastrado
    const profile = await CompanyService.getInstance().getUserProfile(user.id);

    const role: UserRole = isMasterAdmin ? 'admin' : ((profile?.role as UserRole) || 'vendedor');

    req.user = {
      id: user.id,
      email,
      role,
      companyId: profile?.companyId || null,
      erpVendedorId: profile?.erpVendedorId || null,
      profile,
      token,
    };

    next();
  } catch (err: any) {
    console.error('[AuthMiddleware] Falha ao autenticar token JWT:', err.message);
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Falha na validação das credenciais de acesso.',
    });
  }
}

/**
 * Middleware para exigir papel de Administrador Mestre do sistema.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Autenticação necessária para acessar esta funcionalidade.',
    });
  }

  if (req.user.role !== 'admin' && req.user.email !== 'felipealves13tga@hotmail.com') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Acesso negado. Esta rota é restrita a Super Administradores do sistema.',
    });
  }

  next();
}

/**
 * Middleware para garantir isolamento Multi-Tenant estrito (Prevenção de IDOR / BOLA).
 * Garante que usuários normais só possam acessar dados da sua própria empresa.
 */
export async function requireCompanyAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Autenticação necessária.',
    });
  }

  // Superadministradores têm permissão de visualização e diagnóstico em qualquer empresa
  if (req.user.role === 'admin' || req.user.email === 'felipealves13tga@hotmail.com') {
    return next();
  }

  const requestedIdentifier = (
    req.params.slug ||
    req.params.companyId ||
    req.query.companyId ||
    req.query.companySlug ||
    req.body?.companyId ||
    req.body?.companySlug ||
    req.headers['x-company-id'] ||
    ''
  ).toString().trim();

  const userCompanyId = req.user.companyId;
  if (!userCompanyId) {
    return res.status(403).json({
      error: 'NO_COMPANY_ASSIGNED',
      message: 'Seu usuário ainda não possui vínculo com nenhuma empresa cadastrada.',
    });
  }

  // Se nenhum identificador foi especificado na query, assume a empresa do próprio usuário
  if (!requestedIdentifier) {
    return next();
  }

  const companyService = CompanyService.getInstance();
  const company = await companyService.getCompanyBySlug(requestedIdentifier);

  if (!company || (company.id !== userCompanyId && company.slug !== userCompanyId)) {
    console.warn(`[TenantViolation] Usuário [${req.user.email}] tentou acessar empresa [${requestedIdentifier}] sem permissão.`);
    return res.status(403).json({
      error: 'FORBIDDEN_TENANT_ACCESS',
      message: 'Acesso negado. Você não possui autorização para consultar dados desta empresa.',
    });
  }

  next();
}
