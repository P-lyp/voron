import { supabase } from './supabase.js';
import {
  CompanyDTO,
  BusinessRules,
  UserProfileDTO,
  AgentTokenDTO,
  CompanyInviteDTO,
  UserRole,
  DEFAULT_DASHBOARD_CARDS,
  CustomerRegistrationPayload,
  CustomerRegistrationRecord,
  CheckEmailResultDTO,
  DEFAULT_NOTIFICACOES_CONFIG,
} from '@ai-db/shared';

// Regras padrão de negócio (fallback caso o banco esteja indisponível)
export const DEFAULT_BUSINESS_RULES: BusinessRules = {
  movimentos: {
    orcamento: ['2.2.01'],
    venda: ['2.2.03'],
  },
  financeiro: {
    moduloAtivo: 'AMBOS',
    tiposDocumento: ['DP', 'BO'],
    ignorarPrevisoes: true,
  },
  roles_permissions: {
    diretor: {
      ver_faturamento_total: true,
      ver_ranking: true,
      ver_orcamentos_todos: true,
      ver_financeiro_receber: true,
      ver_financeiro_pagar: true,
      copilot_escopo: 'total',
    },
    gerente: {
      ver_faturamento_total: true,
      ver_ranking: true,
      ver_orcamentos_todos: true,
      ver_financeiro_receber: true,
      ver_financeiro_pagar: false,
      copilot_escopo: 'loja',
    },
    vendedor: {
      ver_faturamento_total: false,
      ver_ranking: false,
      ver_orcamentos_todos: false,
      ver_financeiro_receber: false,
      ver_financeiro_pagar: false,
      copilot_escopo: 'individual',
    },
  },
  copilot: {
    tomResposta: 'bluf',
    sugestoesPerguntas: [
      'Quanto faturamos hoje em vendas?',
      'Quais orçamentos estão em aberto?',
      'Quais os 3 produtos mais vendidos do mês?',
    ],
    rateLimitEnabled: true,
    rateLimitPerMinute: 20,
  },
  visao_geral: {
    cards: DEFAULT_DASHBOARD_CARDS,
  },
  itens: {
    tabelaPreco: 'PRECO1',
    exibirSaldoFisico: true,
    exibirSaldoFiscal: false,
  },
  notificacoes: DEFAULT_NOTIFICACOES_CONFIG,
};

export function normalizeBusinessRules(rules?: any): BusinessRules {
  if (!rules) return DEFAULT_BUSINESS_RULES;
  return {
    ...DEFAULT_BUSINESS_RULES,
    ...rules,
    movimentos: {
      ...DEFAULT_BUSINESS_RULES.movimentos,
      ...(rules.movimentos || {}),
    },
    financeiro: {
      ...DEFAULT_BUSINESS_RULES.financeiro,
      ...(rules.financeiro || {}),
    },
    roles_permissions: {
      diretor: {
        ...DEFAULT_BUSINESS_RULES.roles_permissions.diretor,
        ...(rules.roles_permissions?.diretor || {}),
      },
      gerente: {
        ...DEFAULT_BUSINESS_RULES.roles_permissions.gerente,
        ...(rules.roles_permissions?.gerente || {}),
      },
      vendedor: {
        ...DEFAULT_BUSINESS_RULES.roles_permissions.vendedor,
        ...(rules.roles_permissions?.vendedor || {}),
      },
    },
    copilot: {
      ...DEFAULT_BUSINESS_RULES.copilot,
      ...(rules.copilot || {}),
      rateLimitEnabled: rules.copilot?.rateLimitEnabled !== undefined ? Boolean(rules.copilot.rateLimitEnabled) : true,
      rateLimitPerMinute: Number(rules.copilot?.rateLimitPerMinute) || 20,
    },
    visao_geral: {
      cards: Array.isArray(rules.visao_geral?.cards) && rules.visao_geral.cards.length > 0
        ? rules.visao_geral.cards
        : DEFAULT_DASHBOARD_CARDS,
    },
    itens: {
      tabelaPreco: rules.itens?.tabelaPreco === 'PRECO2' ? 'PRECO2' : 'PRECO1',
      exibirSaldoFisico: rules.itens?.exibirSaldoFisico !== undefined ? Boolean(rules.itens.exibirSaldoFisico) : true,
      exibirSaldoFiscal: Boolean(rules.itens?.exibirSaldoFiscal),
    },
    notificacoes: {
      offline: {
        habilitado: rules.notificacoes?.offline?.habilitado !== undefined ? Boolean(rules.notificacoes.offline.habilitado) : DEFAULT_NOTIFICACOES_CONFIG.offline.habilitado,
        tempoToleranciaMinutos: Number(rules.notificacoes?.offline?.tempoToleranciaMinutos) || DEFAULT_NOTIFICACOES_CONFIG.offline.tempoToleranciaMinutos,
        notificarReconexao: rules.notificacoes?.offline?.notificarReconexao !== undefined ? Boolean(rules.notificacoes.offline.notificarReconexao) : DEFAULT_NOTIFICACOES_CONFIG.offline.notificarReconexao,
      },
      fechamento: {
        habilitado: rules.notificacoes?.fechamento?.habilitado !== undefined ? Boolean(rules.notificacoes.fechamento.habilitado) : DEFAULT_NOTIFICACOES_CONFIG.fechamento.habilitado,
        horarioEnvio: rules.notificacoes?.fechamento?.horarioEnvio || DEFAULT_NOTIFICACOES_CONFIG.fechamento.horarioEnvio,
        incluirComparativoOntem: rules.notificacoes?.fechamento?.incluirComparativoOntem !== undefined ? Boolean(rules.notificacoes.fechamento.incluirComparativoOntem) : DEFAULT_NOTIFICACOES_CONFIG.fechamento.incluirComparativoOntem,
        incluirTopProdutos: rules.notificacoes?.fechamento?.incluirTopProdutos !== undefined ? Boolean(rules.notificacoes.fechamento.incluirTopProdutos) : DEFAULT_NOTIFICACOES_CONFIG.fechamento.incluirTopProdutos,
      },
      metas: {
        habilitado: rules.notificacoes?.metas?.habilitado !== undefined ? Boolean(rules.notificacoes.metas.habilitado) : DEFAULT_NOTIFICACOES_CONFIG.metas.habilitado,
        valorMetaDiaria: Number(rules.notificacoes?.metas?.valorMetaDiaria) || DEFAULT_NOTIFICACOES_CONFIG.metas.valorMetaDiaria,
        marcosPercentuais: Array.isArray(rules.notificacoes?.metas?.marcosPercentuais) && rules.notificacoes.metas.marcosPercentuais.length > 0 ? rules.notificacoes.metas.marcosPercentuais : DEFAULT_NOTIFICACOES_CONFIG.metas.marcosPercentuais,
        alertaPedidoExpressivo: Boolean(rules.notificacoes?.metas?.alertaPedidoExpressivo),
        valorMinimoPedidoExpressivo: Number(rules.notificacoes?.metas?.valorMinimoPedidoExpressivo) || DEFAULT_NOTIFICACOES_CONFIG.metas.valorMinimoPedidoExpressivo,
      },
    },
  };
}

// Cache em memória com TTL de 60 segundos para evitar sobrecarga no Supabase
interface CachedCompany {
  company: CompanyDTO;
  timestamp: number;
}
const companyCache = new Map<string, CachedCompany>();
const CACHE_TTL_MS = 60 * 1000;

export class CompanyService {
  private static instance: CompanyService;

  private constructor() {}

  public static getInstance(): CompanyService {
    if (!CompanyService.instance) {
      CompanyService.instance = new CompanyService();
    }
    return CompanyService.instance;
  }

  public async getAllCompanies(): Promise<CompanyDTO[]> {
    try {
      const [{ data, error }, { data: tokensData }] = await Promise.all([
        supabase.from('companies').select('*').order('created_at', { ascending: true }),
        supabase.from('agent_tokens').select('*').order('created_at', { ascending: false }),
      ]);

      if (error || !data) {
        console.warn('[CompanyService] Falha ao consultar companies no Supabase:', error?.message);
        return [this.getDefaultCompany('empresa-piloto-001')];
      }

      const tokensByCompany = new Map<string, AgentTokenDTO[]>();
      if (tokensData) {
        for (const t of tokensData) {
          const list = tokensByCompany.get(t.company_id) || [];
          list.push({
            id: t.id,
            companyId: t.company_id,
            token: t.token,
            name: t.name,
            isActive: t.is_active,
            lastSeenAt: t.last_seen_at,
            createdAt: t.created_at,
          });
          tokensByCompany.set(t.company_id, list);
        }
      }

      return data.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        isActive: row.is_active,
        activeUntil: row.active_until || null,
        blockedReason: row.blocked_reason || null,
        tokens: tokensByCompany.get(row.id) || (row.slug === 'empresa-piloto-001' ? [{
          id: 'default-token-id',
          companyId: row.id,
          token: 'token-secreto-agente-001',
          name: 'Agente Principal (Padrão)',
          isActive: true,
          createdAt: row.created_at,
        }] : []),
        businessRules: normalizeBusinessRules(row.business_rules),
        activationCode: row.activation_code || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err: any) {
      console.error('[CompanyService] Erro ao listar empresas:', err.message);
      return [this.getDefaultCompany('empresa-piloto-001')];
    }
  }

  public async getCompanyById(idOrSlug: string): Promise<CompanyDTO | null> {
    try {
      return await this.getCompanyBySlug(idOrSlug);
    } catch {
      return null;
    }
  }

  public async getCompanyBySlug(slug: string): Promise<CompanyDTO> {
    const cached = companyCache.get(slug);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.company;
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      let compQuery = supabase.from('companies').select('*');
      if (isUuid) {
        compQuery = compQuery.or(`id.eq.${slug},slug.eq.${slug}`);
      } else {
        compQuery = compQuery.eq('slug', slug);
      }
      const { data, error } = await compQuery.maybeSingle();

      if (error || !data) {
        return this.getDefaultCompany(slug);
      }

      const { data: tokensData } = await supabase
        .from('agent_tokens')
        .select('*')
        .eq('company_id', data.id)
        .order('created_at', { ascending: false });

      const tokens: AgentTokenDTO[] = (tokensData || []).map((t) => ({
        id: t.id,
        companyId: t.company_id,
        token: t.token,
        name: t.name,
        isActive: t.is_active,
        lastSeenAt: t.last_seen_at,
        createdAt: t.created_at,
      }));

      const company: CompanyDTO = {
        id: data.id,
        slug: data.slug,
        name: data.name,
        isActive: data.is_active,
        activeUntil: data.active_until || null,
        blockedReason: data.blocked_reason || null,
        tokens: tokens.length > 0 ? tokens : (slug === 'empresa-piloto-001' ? [{
          id: 'default-token-id',
          companyId: data.id,
          token: 'token-secreto-agente-001',
          name: 'Agente Principal (Padrão)',
          isActive: true,
          createdAt: data.created_at,
        }] : []),
        businessRules: normalizeBusinessRules(data.business_rules),
        activationCode: data.activation_code || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      companyCache.set(slug, { company, timestamp: Date.now() });
      return company;
    } catch {
      return this.getDefaultCompany(slug);
    }
  }

  public async getCompanyTokens(slug: string): Promise<AgentTokenDTO[]> {
    const company = await this.getCompanyBySlug(slug);
    if (!company || !company.id) return [];

    const { data, error } = await supabase
      .from('agent_tokens')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (slug === 'empresa-piloto-001') {
        return [{
          id: 'default-token-id',
          companyId: company.id,
          token: 'token-secreto-agente-001',
          name: 'Agente Principal (Padrão)',
          isActive: true,
          createdAt: company.createdAt,
        }];
      }
      return [];
    }

    return data.map((t) => ({
      id: t.id,
      companyId: t.company_id,
      token: t.token,
      name: t.name,
      isActive: t.is_active,
      lastSeenAt: t.last_seen_at,
      createdAt: t.created_at,
    }));
  }

  public async createCompanyToken(slug: string, customToken?: string, name?: string): Promise<AgentTokenDTO> {
    const company = await this.getCompanyBySlug(slug);
    if (!company || !company.id) {
      throw new Error(`Empresa com slug [${slug}] não encontrada.`);
    }

    const token = customToken && customToken.trim()
      ? customToken.trim()
      : `agt_${company.slug.replace(/[^a-z0-9]/g, '').slice(0, 8)}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

    const tokenName = name && name.trim() ? name.trim() : `Agente Local (${new Date().toLocaleDateString('pt-BR')})`;

    const { data, error } = await supabase
      .from('agent_tokens')
      .insert({
        company_id: company.id,
        token,
        name: tokenName,
        is_active: true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Falha ao registrar novo token: ${error?.message}`);
    }

    // Invalida cache da empresa para recarregar tokens atualizados
    companyCache.delete(slug);

    return {
      id: data.id,
      companyId: data.company_id,
      token: data.token,
      name: data.name,
      isActive: data.is_active,
      lastSeenAt: data.last_seen_at,
      createdAt: data.created_at,
    };
  }

  public async updateCompanyConfig(slug: string, businessRules: Partial<BusinessRules>, name?: string): Promise<CompanyDTO> {
    const current = await this.getCompanyBySlug(slug);
    const mergedRules: BusinessRules = {
      ...current.businessRules,
      ...businessRules,
      movimentos: {
        ...current.businessRules.movimentos,
        ...(businessRules.movimentos || {}),
      },
      financeiro: {
        ...current.businessRules.financeiro,
        ...(businessRules.financeiro || {}),
      },
      roles_permissions: {
        ...current.businessRules.roles_permissions,
        ...(businessRules.roles_permissions || {}),
      },
      copilot: {
        ...current.businessRules.copilot,
        ...(businessRules.copilot || {}),
      },
      visao_geral: {
        cards: businessRules.visao_geral?.cards || current.businessRules.visao_geral?.cards || DEFAULT_DASHBOARD_CARDS,
      },
    };

    const updatePayload: Record<string, any> = {
      business_rules: mergedRules,
      updated_at: new Date().toISOString(),
    };
    if (name) updatePayload.name = name;

    const { data, error } = await supabase
      .from('companies')
      .update(updatePayload)
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar configuração: ${error.message}`);
    }

    const updated: CompanyDTO = {
      id: data.id,
      slug: data.slug,
      name: data.name,
      isActive: data.is_active,
      activeUntil: data.active_until || null,
      blockedReason: data.blocked_reason || null,
      businessRules: normalizeBusinessRules(data.business_rules),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    companyCache.set(slug, { company: updated, timestamp: Date.now() });
    return updated;
  }

  public async createCompany(slug: string, name: string, token: string, phone?: string): Promise<CompanyDTO> {
    const cleanPrefix = slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const activationCode = `${cleanPrefix || 'LOJA'}-${Math.floor(1000 + Math.random() * 9000)}`;

    const businessRules = {
      ...DEFAULT_BUSINESS_RULES,
      cadastro_clientes: {
        ...DEFAULT_BUSINESS_RULES.cadastro_clientes,
        whatsappContato: phone ? phone.trim() : '',
      },
    };

    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .insert({
        slug,
        name,
        is_active: true,
        business_rules: businessRules,
        activation_code: activationCode,
      })
      .select()
      .single();

    if (companyErr) {
      throw new Error(`Falha ao criar empresa: ${companyErr.message}`);
    }

    // Cria o token do agente associado
    const { data: tokenData, error: tokenErr } = await supabase
      .from('agent_tokens')
      .insert({
        company_id: company.id,
        token,
        name: `Agente Principal (${name})`,
        is_active: true,
      })
      .select()
      .single();

    if (tokenErr) {
      console.warn('[CompanyService] Falha ao registrar token do agente:', tokenErr.message);
    }

    const createdTokenDTO: AgentTokenDTO = tokenData
      ? {
          id: tokenData.id,
          companyId: tokenData.company_id,
          token: tokenData.token,
          name: tokenData.name,
          isActive: tokenData.is_active,
          lastSeenAt: tokenData.last_seen_at,
          createdAt: tokenData.created_at,
        }
      : {
          id: 'temp-token',
          companyId: company.id,
          token,
          name: `Agente Principal (${name})`,
          isActive: true,
          createdAt: company.created_at,
        };

    const companyDTO: CompanyDTO = {
      id: company.id,
      slug: company.slug,
      name: company.name,
      isActive: company.is_active,
      tokens: [createdTokenDTO],
      businessRules: company.business_rules,
      activationCode: company.activation_code || activationCode,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    };

    companyCache.set(slug, { company: companyDTO, timestamp: Date.now() });
    return companyDTO;
  }

  public async validateAgentToken(token: string): Promise<{ valid: boolean; companySlug?: string; companyId?: string }> {
    try {
      const cleanToken = token.trim();
      // 1. Tenta validar via RPC segura com privilégios de SECURITY DEFINER
      const { data: rpcData, error: rpcErr } = await supabase.rpc('validate_agent_token_rpc', {
        p_token: cleanToken,
      });

      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        const row = rpcData[0];
        if (row.valid) {
          return { valid: true, companySlug: row.company_slug, companyId: row.company_id };
        }
        return { valid: false };
      }

      // 2. Fallback via consulta direta se o client tiver permissões de service_role
      const { data, error } = await supabase
        .from('agent_tokens')
        .select('company_id, is_active, companies(slug, is_active, active_until)')
        .eq('token', cleanToken)
        .maybeSingle();

      if (error || !data || !data.is_active) {
        return { valid: false };
      }

      const comp = (data as any).companies;
      if (!comp || !comp.is_active) {
        return { valid: false };
      }

      if (comp.active_until && new Date(comp.active_until).getTime() < Date.now()) {
        console.warn(`[CompanyService] Agente rejeitado: Empresa [${comp.slug}] está com assinatura expirada (${comp.active_until}).`);
        return { valid: false };
      }

      // Atualiza last_seen_at sem esperar
      supabase
        .from('agent_tokens')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('token', cleanToken)
        .then();

      return { valid: true, companySlug: comp.slug, companyId: data.company_id };
    } catch {
      return { valid: false };
    }
  }

  public async getCompanyByActivationCode(code: string): Promise<CompanyDTO | null> {
    const clean = code.trim().toUpperCase();
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('activation_code', clean)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    return this.getCompanyBySlug(data.slug);
  }

  public async checkEmailAccess(email: string): Promise<CheckEmailResultDTO> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Tenta via RPC segura (não expõe tabelas user_profiles e company_invites para anon)
    try {
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('check_email_access_rpc', {
        p_email: cleanEmail,
      });

      if (!rpcErr && rpcResult && typeof rpcResult === 'object') {
        return rpcResult as CheckEmailResultDTO;
      }
    } catch {}

    const isMasterAdmin = cleanEmail === 'felipealves13tga@hotmail.com';

    // 2. Fallback direto se o client estiver com service_role ativo
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role, company_id, companies(name)')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (profile) {
      const companyName = (profile as any).companies?.name || undefined;
      return {
        status: 'registered',
        email: cleanEmail,
        fullName: profile.full_name,
        companyName,
        role: profile.role as UserRole,
      };
    }

    if (isMasterAdmin) {
      return {
        status: 'first_access',
        email: cleanEmail,
        fullName: 'Administrador Mestre',
        companyName: 'Administração Geral',
        role: 'admin',
      };
    }

    const { data: invite } = await supabase
      .from('company_invites')
      .select('id, email, role, company_id, companies(name, business_rules)')
      .ilike('email', cleanEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invite) {
      const company = (invite as any).companies;
      const companyName = company?.name || 'sua empresa';
      const whatsappSupport = company?.business_rules?.cadastro_clientes?.whatsappContato || undefined;

      return {
        status: 'first_access',
        email: cleanEmail,
        companyName,
        role: invite.role as UserRole,
        whatsappSupport,
      };
    }

    return {
      status: 'not_found',
      email: cleanEmail,
      message: 'Este e-mail ainda não possui autorização ou convite ativo no sistema. Entre em contato com o suporte para solicitar a liberação do seu acesso.',
    };
  }

  public async syncUserProfile(userId: string, email: string, fullName?: string): Promise<UserProfileDTO> {
    const cleanEmail = email.trim().toLowerCase();
    const resolvedName = fullName?.trim() || cleanEmail.split('@')[0];

    // 1. Prioriza RPC com privilégios de SECURITY DEFINER (imune a bloqueios de RLS no anon key)
    try {
      const { data: rpcProfile, error: rpcErr } = await supabase.rpc('sync_user_profile_rpc', {
        p_user_id: userId,
        p_email: cleanEmail,
        p_full_name: resolvedName,
      });

      if (!rpcErr && rpcProfile) {
        return rpcProfile as UserProfileDTO;
      }
      if (rpcErr) {
        console.warn('[CompanyService] Erro ao sincronizar via sync_user_profile_rpc:', rpcErr.message);
      }
    } catch (err: any) {
      console.warn('[CompanyService] Falha inesperada no RPC sync_user_profile_rpc:', err.message);
    }

    // 2. Fallback direto se o client estiver com permissões de service_role
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const isMasterAdmin = cleanEmail === 'felipealves13tga@hotmail.com';

    if (existing) {
      // Se for o admin mestre, garante role 'admin'
      if (isMasterAdmin && existing.role !== 'admin') {
        const { data: updated } = await supabase
          .from('user_profiles')
          .update({ role: 'admin', updated_at: new Date().toISOString() })
          .eq('id', userId)
          .select()
          .single();
        if (updated) {
          return {
            id: updated.id,
            companyId: updated.company_id,
            role: updated.role,
            erpVendedorId: updated.erp_vendedor_id,
            fullName: updated.full_name,
            email: cleanEmail,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          };
        }
      }

      return {
        id: existing.id,
        companyId: existing.company_id,
        role: existing.role,
        erpVendedorId: existing.erp_vendedor_id,
        fullName: existing.full_name,
        email: cleanEmail,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      };
    }

    // Perfil novo: checar se é admin ou se há convite pendente
    let role: UserRole = isMasterAdmin ? 'admin' : 'vendedor';
    let companyId: string | null = null;
    let erpVendedorId: string | null = null;

    if (!isMasterAdmin) {
      const { data: invite } = await supabase
        .from('company_invites')
        .select('*')
        .eq('email', cleanEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (invite) {
        companyId = invite.company_id;
        role = invite.role as UserRole;
        erpVendedorId = invite.erp_vendedor_id;

        // Remove convite utilizado
        await supabase.from('company_invites').delete().eq('id', invite.id);
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        email: cleanEmail,
        company_id: companyId,
        role,
        erp_vendedor_id: erpVendedorId,
        full_name: resolvedName,
      })
      .select()
      .single();

    if (insErr || !inserted) {
      console.warn('[CompanyService] Falha ao criar user_profile via fallback:', insErr?.message);
      return {
        id: userId,
        companyId,
        role,
        erpVendedorId,
        fullName: resolvedName,
        email: cleanEmail,
        createdAt: new Date().toISOString(),
      };
    }

    return {
      id: inserted.id,
      companyId: inserted.company_id,
      role: inserted.role,
      erpVendedorId: inserted.erp_vendedor_id,
      fullName: inserted.full_name,
      email: cleanEmail,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  }

  public async getUserProfile(userId: string): Promise<UserProfileDTO | null> {
    // 1. Tenta via RPC com privilégios de SECURITY DEFINER
    try {
      const { data: rpcProfile, error: rpcErr } = await supabase.rpc('get_user_profile_rpc', {
        p_user_id: userId,
      });

      if (!rpcErr && rpcProfile) {
        return rpcProfile as UserProfileDTO;
      }
    } catch {}

    // 2. Fallback via consulta direta
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      companyId: data.company_id,
      role: data.role,
      erpVendedorId: data.erp_vendedor_id,
      fullName: data.full_name,
      email: data.email,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public async claimCompanyWithCode(userId: string, activationCode: string): Promise<{ success: boolean; company: CompanyDTO; profile: UserProfileDTO }> {
    const company = await this.getCompanyByActivationCode(activationCode);
    if (!company || !company.id) {
      throw new Error('Código de ativação inválido ou empresa inativa.');
    }

    // 1. Tenta via RPC com SECURITY DEFINER
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('claim_company_with_code_rpc', {
        p_user_id: userId,
        p_company_id: company.id,
      });
      if (!rpcErr && rpcData) {
        return { success: true, company, profile: rpcData as UserProfileDTO };
      }
    } catch {}

    // 2. Fallback via query direta
    const { data: updatedProfile, error } = await supabase
      .from('user_profiles')
      .update({
        company_id: company.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error || !updatedProfile) {
      throw new Error(`Falha ao vincular empresa: ${error?.message}`);
    }

    return {
      success: true,
      company,
      profile: {
        id: updatedProfile.id,
        companyId: updatedProfile.company_id,
        role: updatedProfile.role,
        erpVendedorId: updatedProfile.erp_vendedor_id,
        fullName: updatedProfile.full_name,
        email: updatedProfile.email,
        createdAt: updatedProfile.created_at,
        updatedAt: updatedProfile.updated_at,
      },
    };
  }

  public async getCompanyUsersAndInvites(companySlug: string): Promise<{ users: UserProfileDTO[]; invites: CompanyInviteDTO[] }> {
    const company = await this.getCompanyBySlug(companySlug);
    if (!company || !company.id) return { users: [], invites: [] };

    // 1. Tenta via RPC com SECURITY DEFINER
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_company_users_and_invites_rpc', {
        p_company_id: company.id,
      });
      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        return {
          users: (rpcData as any).users || [],
          invites: (rpcData as any).invites || [],
        };
      }
    } catch {}

    // 2. Fallback via query direta
    const [{ data: usersData }, { data: invitesData }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('company_invites')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),
    ]);

    const users: UserProfileDTO[] = (usersData || []).map((u) => ({
      id: u.id,
      companyId: u.company_id,
      role: u.role,
      erpVendedorId: u.erp_vendedor_id,
      fullName: u.full_name,
      email: u.email,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    }));

    const invites: CompanyInviteDTO[] = (invitesData || []).map((inv) => ({
      id: inv.id,
      companyId: inv.company_id,
      email: inv.email,
      role: inv.role,
      erpVendedorId: inv.erp_vendedor_id,
      createdAt: inv.created_at,
    }));

    return { users, invites };
  }

  public async createCompanyInvite(
    companySlug: string,
    email: string,
    role: UserRole,
    erpVendedorId?: string
  ): Promise<CompanyInviteDTO> {
    const company = await this.getCompanyBySlug(companySlug);
    if (!company || !company.id) {
      throw new Error(`Empresa [${companySlug}] não encontrada.`);
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Tenta via RPC com SECURITY DEFINER
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('create_company_invite_rpc', {
        p_company_id: company.id,
        p_email: cleanEmail,
        p_role: role,
        p_erp_vendedor_id: erpVendedorId || null,
      });
      if (!rpcErr && rpcData) {
        return rpcData as CompanyInviteDTO;
      }
    } catch {}

    // 2. Fallback via query direta
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (existingUser) {
      const { data: updated } = await supabase
        .from('user_profiles')
        .update({
          company_id: company.id,
          role,
          erp_vendedor_id: erpVendedorId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      return {
        id: updated?.id || existingUser.id,
        companyId: company.id,
        email: cleanEmail,
        role,
        erpVendedorId,
        createdAt: new Date().toISOString(),
      };
    }

    const { data: created, error } = await supabase
      .from('company_invites')
      .upsert({
        company_id: company.id,
        email: cleanEmail,
        role,
        erp_vendedor_id: erpVendedorId || null,
      }, { onConflict: 'company_id,email' })
      .select()
      .single();

    if (error || !created) {
      throw new Error(`Falha ao criar convite: ${error?.message}`);
    }

    return {
      id: created.id,
      companyId: created.company_id,
      email: created.email,
      role: created.role,
      erpVendedorId: created.erp_vendedor_id,
      createdAt: created.created_at,
    };
  }

  public async deleteCompanyInvite(inviteId: string): Promise<boolean> {
    // 1. Tenta via RPC com SECURITY DEFINER
    try {
      const { data, error } = await supabase.rpc('delete_company_invite_rpc', {
        p_invite_id: inviteId,
      });
      if (!error && data !== false) return true;
    } catch {}

    // 2. Fallback via query direta
    const { error } = await supabase.from('company_invites').delete().eq('id', inviteId);
    return !error;
  }

  public async updateUserRole(userId: string, role: UserRole, erpVendedorId?: string): Promise<UserProfileDTO> {
    // 1. Tenta via RPC com SECURITY DEFINER
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('update_user_role_rpc', {
        p_user_id: userId,
        p_role: role,
        p_erp_vendedor_id: erpVendedorId || null,
      });
      if (!rpcErr && rpcData) {
        return rpcData as UserProfileDTO;
      }
    } catch {}

    // 2. Fallback via query direta
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        role,
        erp_vendedor_id: erpVendedorId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Falha ao atualizar papel do usuário: ${error?.message}`);
    }

    return {
      id: data.id,
      companyId: data.company_id,
      role: data.role,
      erpVendedorId: data.erp_vendedor_id,
      fullName: data.full_name,
      email: data.email,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public async getPublicCompanyInfo(slug: string): Promise<{
    name: string;
    slug: string;
    habilitado: boolean;
    modo: 'direto' | 'pre_aprovacao';
    whatsappContato?: string;
  }> {
    const cleanSlug = (slug || '').trim().replace(/\/+$/, '') || 'empresa-piloto-001';
    const company = await this.getCompanyBySlug(cleanSlug);
    if (!company) {
      throw new Error(`Empresa [${cleanSlug}] não encontrada.`);
    }

    const config = company.businessRules?.cadastro_clientes || {
      habilitado: true,
      modo: 'direto',
      whatsappContato: '',
    };

    return {
      name: company.name,
      slug: company.slug,
      habilitado: config.habilitado ?? true,
      modo: config.modo ?? 'direto',
      whatsappContato: config.whatsappContato,
    };
  }

  public async createCustomerRegistration(
    slug: string,
    payload: CustomerRegistrationPayload
  ): Promise<{
    success: boolean;
    mode: 'direto' | 'pre_aprovacao';
    codcfo?: string;
    message: string;
    existingClient?: any;
    whatsappContato?: string;
    code?: string;
  }> {
    const company = await this.getCompanyBySlug(slug);
    if (!company) {
      throw new Error(`Empresa [${slug}] não encontrada.`);
    }

    const config = company.businessRules?.cadastro_clientes || {
      habilitado: true,
      modo: 'direto',
      whatsappContato: '',
    };

    if (config.habilitado === false) {
      throw new Error(`O cadastro público de clientes está desativado para esta loja.`);
    }

    const mode = config.modo || 'direto';
    const rawDoc = (payload.cpfCnpj || '').replace(/\D/g, '');

    // 0. VERIFICAÇÃO PREVENTIVA DE DUPLICIDADE (OPÇÃO 1)
    // A) Checagem no banco de dados local do ERP Firebird (se o agente estiver online)
    const { AgentManager } = await import('../gateway/agentManager.js');
    const agentManager = AgentManager.getInstance();

    if (agentManager.isAgentOnline(company.slug)) {
      try {
        const erpResults = await agentManager.sendQuery(
          company.slug,
          'consultar_clientes_erp',
          { busca: rawDoc, limite: 5 },
          5000
        );

        const rows: any[] = Array.isArray(erpResults) ? erpResults : (erpResults as any)?.data || [];
        const existingInErp = rows.find((c: any) => {
          const docClean = (c.CGCCFO || c.cpfCnpj || '').replace(/\D/g, '');
          return docClean && docClean === rawDoc;
        });

        if (existingInErp) {
          const codExist = (existingInErp.CODCFO || existingInErp.codcfo || '').trim();
          const nomeExist = (existingInErp.NOME || existingInErp.nome || '').trim();
          const docExist = (existingInErp.CGCCFO || existingInErp.cpfCnpj || '').trim();

          return {
            success: false,
            mode,
            code: 'DOCUMENT_ALREADY_EXISTS',
            existingClient: {
              codcfo: codExist,
              nome: nomeExist,
              documento: docExist,
            },
            whatsappContato: config.whatsappContato,
            message: `Este CPF/CNPJ já possui cadastro ativo na empresa (Código: ${codExist} - ${nomeExist}).`,
          };
        }
      } catch (err: any) {
        console.warn('[CompanyService] Não foi possível consultar duplicidade no agente local no momento:', err.message);
      }
    }

    // B) Checagem preventiva no Supabase (cadastros já aprovados ou pendentes)
    const { data: existingSupabase } = await supabase
      .from('customer_registrations')
      .select('id, codcfo_gerado, nome, cpf_cnpj, status')
      .eq('company_id', company.id)
      .in('status', ['aprovado', 'pendente'])
      .or(`cpf_cnpj.eq.${payload.cpfCnpj.trim()},cpf_cnpj.eq.${rawDoc}`)
      .limit(1);

    if (existingSupabase && existingSupabase.length > 0) {
      const match = existingSupabase[0];
      return {
        success: false,
        mode,
        code: 'DOCUMENT_ALREADY_EXISTS',
        existingClient: {
          codcfo: match.codcfo_gerado || '',
          nome: match.nome,
          documento: match.cpf_cnpj,
        },
        whatsappContato: config.whatsappContato,
        message: match.status === 'aprovado'
          ? `Este CPF/CNPJ já possui cadastro ativo na empresa.`
          : `Já existe um cadastro com este CPF/CNPJ aguardando análise pela equipe da loja.`,
      };
    }

    const hasIe = payload.tipoPessoa === 'J' &&
      !!(payload.inscricaoEstadual?.trim() || payload.rgIe?.trim()) &&
      (payload.inscricaoEstadual?.trim().toUpperCase() !== 'ISENTO' && payload.rgIe?.trim().toUpperCase() !== 'ISENTO');

    const resolvedIndicador = payload.indicadorIe || (hasIe ? 'C' : 'N');
    const resolvedIe = hasIe
      ? (payload.inscricaoEstadual?.trim().toUpperCase() || payload.rgIe?.trim().toUpperCase() || ' ')
      : ' ';

    // 1. Grava submissão no Supabase com status pendente
    const { data: inserted, error: insertErr } = await supabase
      .from('customer_registrations')
      .insert({
        company_id: company.id,
        tipo_pessoa: payload.tipoPessoa,
        nome: payload.nome.trim().toUpperCase(),
        nome_fantasia: payload.nomeFantasia ? payload.nomeFantasia.trim().toUpperCase() : null,
        cpf_cnpj: payload.cpfCnpj.trim(),
        rg_ie: resolvedIe.trim() ? resolvedIe : null,
        indicador_ie: resolvedIndicador,
        email: payload.email ? payload.email.trim().toLowerCase() : null,
        telefone: payload.telefone.trim(),
        cep: payload.cep.trim(),
        logradouro: payload.logradouro.trim().toUpperCase(),
        numero: payload.numero.trim().toUpperCase(),
        complemento: payload.complemento ? payload.complemento.trim().toUpperCase() : null,
        bairro: payload.bairro.trim().toUpperCase(),
        cidade: payload.cidade.trim().toUpperCase(),
        uf: payload.uf.trim().toUpperCase(),
        id_cidade: payload.idCidade || null,
        status: 'pendente',
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      console.error('Erro ao salvar cadastro no Supabase:', insertErr);
      throw new Error(`Falha ao registrar dados cadastrais: ${insertErr?.message}`);
    }

    const registrationId = inserted.id;

    // 2. Se for inserção direta, chama o agente local
    if (mode === 'direto') {
      try {
        const { AgentManager } = await import('../gateway/agentManager.js');
        const agentManager = AgentManager.getInstance();

        if (!agentManager.isAgentOnline(company.slug)) {
          // Servidor local offline: mantém pendente para sync
          return {
            success: true,
            mode: 'direto',
            message: 'Cadastro recebido com sucesso! O servidor local da loja sincronizará os dados em breve.',
          };
        }

        const agentResponse = await agentManager.sendQuery(
          company.slug,
          'cadastrar_cliente_erp',
          {
            ...payload,
            inscricaoEstadual: resolvedIe,
            rgIe: resolvedIe,
            indicadorIe: resolvedIndicador,
          },
          10000
        );

        if (agentResponse.success) {
          // Atualiza status no Supabase para aprovado
          await supabase
            .from('customer_registrations')
            .update({
              status: 'aprovado',
              codcfo_gerado: agentResponse.codcfo,
              approved_at: new Date().toISOString(),
            })
            .eq('id', registrationId);

          return {
            success: true,
            mode: 'direto',
            codcfo: agentResponse.codcfo,
            message: agentResponse.message || 'Cadastro inserido com sucesso no ERP!',
          };
        } else if (agentResponse.code === 'DOCUMENT_ALREADY_EXISTS') {
          // Opção 1: Documento já existe! Atualiza status no Supabase e bloqueia duplicidade
          await supabase
            .from('customer_registrations')
            .update({
              status: 'duplicado',
              erro_mensagem: agentResponse.message,
            })
            .eq('id', registrationId);

          return {
            success: false,
            mode: 'direto',
            message: agentResponse.message,
            existingClient: agentResponse.existingClient,
            whatsappContato: config.whatsappContato,
          };
        } else {
          // Erro genérico do Firebird
          await supabase
            .from('customer_registrations')
            .update({
              status: 'erro_agente',
              erro_mensagem: agentResponse.error || 'Erro no Firebird',
            })
            .eq('id', registrationId);

          throw new Error(agentResponse.error || 'Falha ao processar cadastro no banco de dados local.');
        }
      } catch (err: any) {
        console.error('Erro na execução do agente:', err.message);
        return {
          success: true,
          mode: 'direto',
          message: 'Cadastro recebido com sucesso! O servidor local finalizará a integração.',
        };
      }
    }

    // Modo pré-aprovação
    return {
      success: true,
      mode: 'pre_aprovacao',
      message: 'Cadastro recebido com sucesso! Seus dados foram encaminhados para a equipe da loja para ativação.',
    };
  }

  public async getCustomerRegistrations(
    slugOrId: string,
    statusFilter?: string
  ): Promise<CustomerRegistrationRecord[]> {
    let companyId = slugOrId;
    if (!slugOrId.includes('-') || slugOrId.length < 30) {
      const comp = await this.getCompanyBySlug(slugOrId);
      if (comp) companyId = comp.id;
    }

    let query = supabase
      .from('customer_registrations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'todos') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error('Erro ao buscar cadastros no Supabase:', error);
      return [];
    }

    return data.map((r: any) => ({
      id: r.id,
      companyId: r.company_id,
      tipoPessoa: r.tipo_pessoa,
      nome: r.nome,
      nomeFantasia: r.nome_fantasia,
      cpfCnpj: r.cpf_cnpj,
      rgIe: r.rg_ie,
      inscricaoEstadual: r.rg_ie,
      indicadorIe: r.indicador_ie,
      email: r.email,
      telefone: r.telefone,
      cep: r.cep,
      logradouro: r.logradouro,
      numero: r.numero,
      complemento: r.complemento,
      bairro: r.bairro,
      cidade: r.cidade,
      uf: r.uf,
      idCidade: r.id_cidade,
      status: r.status,
      codcfoGerado: r.codcfo_gerado,
      erroMensagem: r.erro_mensagem,
      createdAt: r.created_at,
      approvedAt: r.approved_at,
      approvedBy: r.approved_by,
    }));
  }

  public async approveCustomerRegistration(
    registrationId: string,
    approvedByUserId?: string
  ): Promise<{ success: boolean; codcfo?: string; message: string }> {
    const { data: record, error: fetchErr } = await supabase
      .from('customer_registrations')
      .select('*, companies:company_id(slug)')
      .eq('id', registrationId)
      .single();

    if (fetchErr || !record) {
      throw new Error(`Cadastro [${registrationId}] não encontrado.`);
    }

    const companySlug = record.companies?.slug;
    if (!companySlug) {
      throw new Error(`Empresa associada não encontrada.`);
    }

    const hasIe = record.tipo_pessoa === 'J' &&
      !!record.rg_ie && record.rg_ie.trim() !== '' && record.rg_ie.toUpperCase() !== 'ISENTO';
    const resolvedIndicador = record.indicador_ie || (hasIe ? 'C' : 'N');
    const resolvedIe = hasIe ? record.rg_ie.trim().toUpperCase() : ' ';

    const payload: CustomerRegistrationPayload = {
      tipoPessoa: record.tipo_pessoa,
      nome: record.nome,
      nomeFantasia: record.nome_fantasia || undefined,
      cpfCnpj: record.cpf_cnpj,
      rgIe: resolvedIe,
      inscricaoEstadual: resolvedIe,
      indicadorIe: resolvedIndicador,
      email: record.email || undefined,
      telefone: record.telefone,
      cep: record.cep,
      logradouro: record.logradouro,
      numero: record.numero,
      complemento: record.complemento || undefined,
      bairro: record.bairro,
      cidade: record.cidade,
      uf: record.uf,
      idCidade: record.id_cidade || undefined,
    };

    const { AgentManager } = await import('../gateway/agentManager.js');
    const agentManager = AgentManager.getInstance();

    if (!agentManager.isAgentOnline(companySlug)) {
      throw new Error(`O servidor local da empresa [${companySlug}] está offline. Não é possível gravar no ERP agora.`);
    }

    let agentResponse: any;
    try {
      agentResponse = await agentManager.sendQuery(
        companySlug,
        'cadastrar_cliente_erp',
        payload,
        12000
      );
    } catch (agentErr: any) {
      const errMsg = agentErr.message || '';
      if (
        agentErr.code === 'DOCUMENT_ALREADY_EXISTS' ||
        errMsg.includes('já possui cadastro') ||
        errMsg.includes('DOCUMENT_ALREADY_EXISTS')
      ) {
        await supabase
          .from('customer_registrations')
          .update({
            status: 'duplicado',
            erro_mensagem: errMsg,
          })
          .eq('id', registrationId);

        throw new Error(errMsg || 'Este CPF/CNPJ já possui cadastro ativo no ERP.');
      }
      throw agentErr;
    }

    if (!agentResponse.success) {
      if (agentResponse.code === 'DOCUMENT_ALREADY_EXISTS') {
        await supabase
          .from('customer_registrations')
          .update({
            status: 'duplicado',
            erro_mensagem: agentResponse.message,
          })
          .eq('id', registrationId);
      }
      throw new Error(agentResponse.message || agentResponse.error || 'Falha na gravação do ERP.');
    }

    // Sucesso: atualiza no Supabase
    await supabase
      .from('customer_registrations')
      .update({
        status: 'aprovado',
        codcfo_gerado: agentResponse.codcfo,
        approved_at: new Date().toISOString(),
        approved_by: approvedByUserId || null,
      })
      .eq('id', registrationId);

    return {
      success: true,
      codcfo: agentResponse.codcfo,
      message: agentResponse.message || `Cliente cadastrado com código ${agentResponse.codcfo}`,
    };
  }

  public async rejectCustomerRegistration(
    registrationId: string,
    reason?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('customer_registrations')
      .update({
        status: 'rejeitado',
        erro_mensagem: reason || 'Rejeitado pelo gestor',
      })
      .eq('id', registrationId);

    return !error;
  }

  public isCompanySuspended(company: CompanyDTO): { suspended: boolean; reason?: string } {
    if (!company.isActive) {
      return {
        suspended: true,
        reason: company.blockedReason || 'Acesso da empresa suspenso temporariamente. Entre em contato com o suporte.',
      };
    }
    if (company.activeUntil) {
      const expiry = new Date(company.activeUntil).getTime();
      if (Date.now() > expiry) {
        return {
          suspended: true,
          reason: company.blockedReason || 'Assinatura da empresa expirada. Entre em contato com o suporte para regularizar o acesso.',
        };
      }
    }
    return { suspended: false };
  }

  public async updateCompanyStatus(
    slug: string,
    isActive: boolean,
    activeUntil: string | null,
    blockedReason?: string | null
  ): Promise<CompanyDTO> {
    const updatePayload: Record<string, any> = {
      is_active: isActive,
      active_until: activeUntil || null,
      blocked_reason: blockedReason !== undefined ? blockedReason : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('companies')
      .update(updatePayload)
      .eq('slug', slug)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao atualizar status da empresa: ${error?.message}`);
    }

    // Invalida cache local
    companyCache.delete(slug);

    // Se estiver suspensa/bloqueada, desconecta o agente Firebird da empresa
    const isSuspended = !isActive || (activeUntil ? new Date(activeUntil).getTime() < Date.now() : false);
    if (isSuspended) {
      try {
        const { AgentManager } = await import('../gateway/agentManager.js');
        AgentManager.getInstance().disconnectCompanyAgent(slug, 'Empresa suspensa pelo administrador');
      } catch (err: any) {
        console.warn('[CompanyService] Falha ao desconectar agente da empresa:', err.message);
      }
    }

    return this.getCompanyBySlug(slug);
  }

  private getDefaultCompany(slug: string): CompanyDTO {
    return {
      id: '4c510514-e374-4e51-a9c6-288cbb6f9698',
      slug,
      name: slug === 'empresa-piloto-001' ? 'Empresa Piloto' : slug,
      isActive: true,
      activeUntil: null,
      blockedReason: null,
      businessRules: DEFAULT_BUSINESS_RULES,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
