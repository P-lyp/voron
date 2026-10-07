import {
  DashboardOverviewDTO,
  DashboardPeriod,
  DashboardDetailType,
  DashboardDetailsResponseDTO,
  ChatMessageDTO,
  UserProfileDTO,
  CompanyDTO,
  CompanyInviteDTO,
  ItemProdutoDTO,
  ItensConfig,
  CustomerRegistrationPayload,
  CustomerRegistrationRecord,
  CustomerErpDTO,
  CheckEmailResultDTO,
  AppNotificationDTO,
} from '@ai-db/shared';
import { supabase } from './supabase.js';

const rawApiUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE = rawApiUrl ? `${rawApiUrl.replace(/\/+$/, '')}/api` : '/api';

/**
 * Utilitário fetch autenticado que injeta automaticamente o token JWT
 * da sessão ativa do Supabase no cabeçalho Authorization: Bearer <token>.
 */
async function authFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  let token: string | undefined;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch (err) {
    console.warn('[authFetch] Falha ao obter sessão do Supabase:', err);
  }

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function fetchDashboardOverview(
  companyId: string = 'empresa-piloto-001',
  period: DashboardPeriod = 'dia',
  dataInicio?: string,
  dataFim?: string
): Promise<DashboardOverviewDTO> {
  const params = new URLSearchParams({
    companyId,
    period,
  });
  if (dataInicio) params.set('dataInicio', dataInicio);
  if (dataFim) params.set('dataFim', dataFim);

  const res = await authFetch(`${API_BASE}/dashboard/overview?${params.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const error: any = new Error(errData.message || 'Falha ao carregar visão do dashboard');
    error.code = errData.error;
    error.company = errData.company;
    throw error;
  }
  return res.json();
}

export async function fetchDashboardDetails(
  companyId: string = 'empresa-piloto-001',
  tipo: DashboardDetailType = 'faturamento',
  period: DashboardPeriod = 'dia',
  dataInicio?: string,
  dataFim?: string,
  busca?: string,
  statusPedido?: string
): Promise<DashboardDetailsResponseDTO> {
  const params = new URLSearchParams({
    companyId,
    tipo,
    period,
  });
  if (dataInicio) params.set('dataInicio', dataInicio);
  if (dataFim) params.set('dataFim', dataFim);
  if (busca) params.set('busca', busca);
  if (statusPedido) params.set('statusPedido', statusPedido);

  const res = await authFetch(`${API_BASE}/dashboard/details?${params.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const error: any = new Error(errData.message || 'Falha ao carregar detalhes');
    error.code = errData.error;
    throw error;
  }
  return res.json();
}

export async function fetchItems(
  companyId: string = 'empresa-piloto-001',
  busca: string = '',
  filtroEstoque: 'todos' | 'com_estoque' | 'sem_estoque' = 'todos',
  limite: number = 40
): Promise<{ success: boolean; count: number; items: ItemProdutoDTO[]; config?: ItensConfig }> {
  const params = new URLSearchParams({
    companyId,
    busca,
    filtroEstoque,
    limite: String(limite),
  });
  const res = await authFetch(`${API_BASE}/items?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao buscar itens');
  }
  return res.json();
}

export async function sendChatMessage(
  message: string,
  companyId: string = 'empresa-piloto-001',
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<Partial<ChatMessageDTO>> {
  const res = await authFetch(`${API_BASE}/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, companyId, history }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha na resposta do Copilot');
  }

  return res.json();
}

export async function fetchServerStatus(companyId: string = 'empresa-piloto-001') {
  const res = await authFetch(`${API_BASE}/status?companyId=${encodeURIComponent(companyId)}`);
  return res.json();
}

// ==========================================
// Funções do Dashboard Administrativo
// ==========================================

export async function fetchAdminCompanies() {
  const res = await authFetch(`${API_BASE}/admin/companies`);
  if (!res.ok) throw new Error('Falha ao listar empresas no admin');
  return res.json();
}

export async function createAdminCompany(slug: string, name: string, token: string, phone?: string) {
  const res = await authFetch(`${API_BASE}/admin/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, name, token, phone }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao criar empresa');
  }
  return res.json();
}

export async function fetchCompanyConfig(slug: string) {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Falha ao carregar configurações da empresa');
  return res.json();
}

export async function updateCompanyConfig(slug: string, businessRules: any, name?: string) {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessRules, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao salvar configurações');
  }
  return res.json();
}

export async function updateCompanyStatus(
  slug: string,
  isActive: boolean,
  activeUntil: string | null,
  blockedReason?: string | null
): Promise<CompanyDTO> {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive, activeUntil, blockedReason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao atualizar status da empresa');
  }
  return res.json();
}

export async function fetchErpMovimentos(slug: string) {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/erp-movimentos`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao consultar tipos de movimento do ERP');
  }
  return res.json();
}

export async function fetchErpVendedores(slug: string) {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/erp-vendedores`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao consultar vendedores do ERP');
  }
  return res.json();
}

export async function testCompanyConnection(slug: string) {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/test-connection`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha no teste de conexão');
  }
  return res.json();
}

export async function fetchCompanyTokens(slug: string) {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/tokens`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao consultar tokens do agente');
  }
  return res.json();
}

export async function createCompanyToken(slug: string, token?: string, name?: string) {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao gerar novo token');
  }
  return res.json();
}

// ==========================================
// Funções de Autenticação e Perfis
// ==========================================

export async function checkEmailAccess(email: string): Promise<CheckEmailResultDTO> {
  const res = await fetch(`${API_BASE}/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao verificar e-mail.');
  }
  return res.json();
}

export async function syncUserProfile(
  userId: string,
  email: string,
  fullName?: string
): Promise<{ profile: UserProfileDTO; company: CompanyDTO | null }> {
  const res = await authFetch(`${API_BASE}/auth/sync-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, fullName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao sincronizar perfil do usuário');
  }
  return res.json();
}

export async function fetchUserProfile(userId: string): Promise<{ profile: UserProfileDTO; company: CompanyDTO | null }> {
  const res = await authFetch(`${API_BASE}/auth/profile/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao buscar perfil');
  }
  return res.json();
}

export async function claimCompanyWithCode(
  userId: string,
  activationCode: string
): Promise<{ success: boolean; company: CompanyDTO; profile: UserProfileDTO }> {
  const res = await authFetch(`${API_BASE}/auth/claim-company`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, activationCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Código de ativação inválido');
  }
  return res.json();
}

export async function verifyActivationCode(activationCode: string) {
  const res = await authFetch(`${API_BASE}/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activationCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Código não encontrado');
  }
  return res.json();
}

export async function fetchCompanyUsersAndInvites(
  slug: string
): Promise<{ success: boolean; users: UserProfileDTO[]; invites: CompanyInviteDTO[] }> {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/users`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao buscar usuários e convites');
  }
  return res.json();
}

export async function createCompanyInvite(
  slug: string,
  email: string,
  role: string,
  erpVendedorId?: string
): Promise<{ success: boolean; data: CompanyInviteDTO }> {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role, erpVendedorId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao criar convite');
  }
  return res.json();
}

export async function deleteCompanyInvite(slug: string, inviteId: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/admin/companies/${encodeURIComponent(slug)}/invites/${encodeURIComponent(inviteId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao remover convite');
  }
  const data = await res.json();
  return data.success;
}

export async function updateUserRole(
  userId: string,
  role: string,
  erpVendedorId?: string
): Promise<{ success: boolean; data: UserProfileDTO }> {
  const res = await authFetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, erpVendedorId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao atualizar papel do usuário');
  }
  return res.json();
}

// ==========================================
// Funções Públicas de Autoatendimento
// ==========================================

export async function fetchPublicCompanyInfo(slug: string): Promise<{
  name: string;
  slug: string;
  habilitado: boolean;
  modo: 'direto' | 'pre_aprovacao';
  whatsappContato?: string;
}> {
  const cleanSlug = (slug || '').trim().replace(/\/+$/, '') || 'empresa-piloto-001';
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/public/customers/company/${encodeURIComponent(cleanSlug)}/info`);
  } catch (err: any) {
    throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está em execução.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new Error(err.error || `A loja [${cleanSlug}] não foi encontrada.`);
    }
    throw new Error(err.error || `Erro ao carregar dados da empresa (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function submitPublicCustomerRegistration(
  slug: string,
  payload: CustomerRegistrationPayload
): Promise<{
  success: boolean;
  mode: 'direto' | 'pre_aprovacao';
  codcfo?: string;
  message: string;
  existingClient?: any;
  whatsappContato?: string;
}> {
  const res = await fetch(`${API_BASE}/public/customers/register/${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) {
    throw new Error(data.error || 'Falha ao processar cadastro');
  }
  return data;
}

// ==========================================
// Funções de Gestão de Clientes ERP
// ==========================================

export async function searchErpCustomers(
  companySlug: string = 'empresa-piloto-001',
  busca: string = '',
  limite: number = 30
): Promise<{ success: boolean; data: CustomerErpDTO[] }> {
  const params = new URLSearchParams({
    companySlug,
    busca,
    limite: String(limite),
  });
  const res = await authFetch(`${API_BASE}/customers/search?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao consultar clientes no ERP');
  }
  const result = await res.json();
  if (Array.isArray(result)) {
    return {
      success: true,
      data: result.map((row: any) => ({
        codcfo: (row.codcfo || row.CODCFO || '').trim(),
        nome: (row.nome || row.NOME || '').trim(),
        nomeFantasia: (row.nomeFantasia || row.NOMEFANTASIA || row.NOME || '').trim(),
        cpfCnpj: (row.cpfCnpj || row.CGCCFO || '').trim(),
        telefone: (row.telefone || row.TELEFONE || '').trim() || undefined,
        cidade: (row.cidade || row.CIDADE || '').trim() || undefined,
        uf: (row.uf || row.UF || '').trim() || undefined,
        ativo: (row.ativo || row.ATIVO || 'T').trim(),
      })),
    };
  }
  return result;
}

export async function fetchCustomerRegistrations(
  companySlug: string = 'empresa-piloto-001',
  status?: string
): Promise<CustomerRegistrationRecord[]> {
  const params = new URLSearchParams({ companySlug });
  if (status) params.append('status', status);
  const res = await authFetch(`${API_BASE}/customers/registrations?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao carregar fila de cadastros');
  }
  return res.json();
}

export async function approveCustomerRegistration(
  registrationId: string,
  userId?: string
): Promise<{ success: boolean; codcfo?: string; message: string }> {
  const res = await authFetch(`${API_BASE}/customers/registrations/${encodeURIComponent(registrationId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao aprovar cadastro');
  }
  return res.json();
}

export async function rejectCustomerRegistration(
  registrationId: string,
  reason?: string
): Promise<{ success: boolean }> {
  const res = await authFetch(`${API_BASE}/customers/registrations/${encodeURIComponent(registrationId)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao rejeitar cadastro');
  }
  return res.json();
}

// ==========================================
// Módulo de Notificações Push & In-App
// ==========================================

export async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/notifications/vapid-key`);
  if (!res.ok) {
    throw new Error('Falha ao obter chave pública VAPID');
  }
  const data = await res.json();
  return data.publicKey;
}

export async function registerPushSubscription(subscription: PushSubscription): Promise<boolean> {
  const rawSub = subscription.toJSON();
  if (!rawSub.endpoint || !rawSub.keys?.p256dh || !rawSub.keys?.auth) {
    throw new Error('Assinatura Push incompleta');
  }

  const res = await authFetch(`${API_BASE}/notifications/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: rawSub.endpoint,
      keys: {
        p256dh: rawSub.keys.p256dh,
        auth: rawSub.keys.auth,
      },
      userAgent: navigator.userAgent,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao registrar assinatura push');
  }
  return true;
}

export async function unregisterPushSubscription(endpoint: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/notifications/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  return res.ok;
}

export async function fetchNotifications(): Promise<AppNotificationDTO[]> {
  const res = await authFetch(`${API_BASE}/notifications`);
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return data.notifications || [];
}

export async function markNotificationAsRead(id: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/notifications/${id}/read`, {
    method: 'PATCH',
  });
  return res.ok;
}

export async function markAllNotificationsAsRead(): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/notifications/read-all`, {
    method: 'POST',
  });
  return res.ok;
}

export async function triggerTestNotification(tipo?: string): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${API_BASE}/notifications/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao disparar notificação de teste');
  }
  return res.json();
}
