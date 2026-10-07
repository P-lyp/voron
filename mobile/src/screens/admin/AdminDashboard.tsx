import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Server,
  Plus,
  RefreshCw,
  Sliders,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Activity,
  ShieldCheck,
  ChevronRight,
  Database,
  KeyRound,
  Sparkles,
  Copy,
  Check,
  Eye,
  EyeOff,
  X,
  LogOut,
  Users,
  ShieldAlert,
  Calendar,
  CalendarX,
  Lock,
  Unlock,
  Clock,
  Ban,
  AlertTriangle,
  Save,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { CompanyDTO } from '@ai-db/shared';
import { useAuth } from '../../context/useAuth.js';
import { VoronLogo } from '../../components/VoronLogo.js';
import {
  fetchAdminCompanies,
  createAdminCompany,
  testCompanyConnection,
  updateCompanyStatus,
} from '../../services/api.js';

// Lazy-load heavy configuration modal (119 KB) on demand (Vercel Best Practice: bundle-dynamic-imports)
const CompanyConfigModal = React.lazy(() =>
  import('./CompanyConfigModal.js').then((m) => ({ default: m.CompanyConfigModal }))
);

interface AdminDashboardProps {
  onBackToApp: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToApp }) => {
  const { user, signOut } = useAuth();
  const [companies, setCompanies] = useState<CompanyDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDTO | null>(null);

  // Modal de Criação de Empresa
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newToken, setNewToken] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Visualização e cópia de tokens e códigos
  const [showTokenMap, setShowTokenMap] = useState<Record<string, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [copiedCodeMap, setCopiedCodeMap] = useState<Record<string, boolean>>({});
  const [createdBanner, setCreatedBanner] = useState<{ name: string; slug: string; token: string; activationCode?: string } | null>(null);

  const handleCopyCode = (slug: string, code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCodeMap((prev) => ({ ...prev, [slug]: true }));
    setTimeout(() => {
      setCopiedCodeMap((prev) => ({ ...prev, [slug]: false }));
    }, 2500);
  };

  // Modal de Gestão de Status & Validade de Acesso
  const [statusModalCompany, setStatusModalCompany] = useState<CompanyDTO | null>(null);
  const [statusIsActive, setStatusIsActive] = useState<boolean>(true);
  const [statusActiveUntil, setStatusActiveUntil] = useState<string>('');
  const [statusBlockedReason, setStatusBlockedReason] = useState<string>('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusSaveError, setStatusSaveError] = useState<string | null>(null);
  const [statusSaveSuccess, setStatusSaveSuccess] = useState<string | null>(null);

  const handleOpenStatusModal = (comp: CompanyDTO) => {
    setStatusModalCompany(comp);
    setStatusIsActive(comp.isActive);
    if (comp.activeUntil) {
      try {
        const d = new Date(comp.activeUntil);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setStatusActiveUntil(`${yyyy}-${mm}-${dd}`);
      } catch {
        setStatusActiveUntil('');
      }
    } else {
      setStatusActiveUntil('');
    }
    setStatusBlockedReason(comp.blockedReason || '');
    setStatusSaveError(null);
    setStatusSaveSuccess(null);
  };

  const handleSetQuickDays = (days: number | null) => {
    if (days === null) {
      setStatusActiveUntil('');
      return;
    }
    const target = new Date();
    target.setDate(target.getDate() + days);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    setStatusActiveUntil(`${yyyy}-${mm}-${dd}`);
  };

  const handleSaveStatus = async () => {
    if (!statusModalCompany) return;
    setIsSavingStatus(true);
    setStatusSaveError(null);
    setStatusSaveSuccess(null);
    try {
      let activeUntilISO: string | null = null;
      if (statusActiveUntil) {
        const [year, month, day] = statusActiveUntil.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day, 23, 59, 59, 999);
        activeUntilISO = dateObj.toISOString();
      }

      const updated = await updateCompanyStatus(
        statusModalCompany.slug,
        statusIsActive,
        activeUntilISO,
        statusBlockedReason.trim() || null
      );

      setCompanies((prev) =>
        prev.map((c) => (c.slug === updated.slug ? { ...updated, isOnline: c.isOnline } : c))
      );
      setStatusSaveSuccess('Status salvo com sucesso!');
      setTimeout(() => {
        setStatusModalCompany(null);
      }, 700);
    } catch (err: any) {
      setStatusSaveError(err.message || 'Erro ao atualizar status');
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Status de teste rápido
  const [testStatus, setTestStatus] = useState<Record<string, { testing: boolean; result?: string }>>({});

  const handleGenerateRandomToken = (slugCandidate?: string) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let rand = '';
    for (let i = 0; i < 20; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const cleanPrefix = (slugCandidate || newSlug || 'loja')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 8);
    const generated = `agt_${cleanPrefix ? `${cleanPrefix}_` : ''}${rand}`;
    setNewToken(generated);
  };

  const handleCopyToken = (slug: string, token: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(token);
    }
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(6);
    }
    setCopiedMap((prev) => ({ ...prev, [slug]: true }));
    setTimeout(() => {
      setCopiedMap((prev) => ({ ...prev, [slug]: false }));
    }, 2500);
  };

  const toggleShowToken = (slug: string) => {
    setShowTokenMap((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminCompanies();
      setCompanies(data);
    } catch (err) {
      console.error('Erro ao carregar empresas:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
    const interval = setInterval(loadCompanies, 15000);
    return () => clearInterval(interval);
  }, [loadCompanies]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlug || !newName || !newToken) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createAdminCompany(newSlug, newName, newToken, newPhone);
      setCompanies((prev) => [...prev, created]);
      setCreatedBanner({ name: newName, slug: newSlug, token: newToken, activationCode: created.activationCode });
      setIsCreateOpen(false);
      setNewSlug('');
      setNewName('');
      setNewToken('');
      setNewPhone('');
    } catch (err: any) {
      setCreateError(err.message || 'Erro ao criar empresa');
    } finally {
      setIsCreating(false);
    }
  };

  const handleQuickTest = async (slug: string) => {
    setTestStatus((prev) => ({ ...prev, [slug]: { testing: true } }));
    try {
      const res = await testCompanyConnection(slug);
      setTestStatus((prev) => ({
        ...prev,
        [slug]: {
          testing: false,
          result: res.online ? `Online (${res.latencyMs}ms)` : 'Offline',
        },
      }));
    } catch {
      setTestStatus((prev) => ({
        ...prev,
        [slug]: { testing: false, result: 'Erro' },
      }));
    }
  };

  const onlineCount = companies.filter((c) => c.isOnline).length;

  return (
    <div className="min-h-screen bg-[#f4f5f6] text-stone-900 font-sans pb-16">
      {/* Top Navbar Frosted Glass */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-stone-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBackToApp}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 border border-stone-200 active:scale-95 transition-all min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar ao App</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <VoronLogo size="sm" />
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#0f291e] tracking-tight">
                Voron Admin
              </h1>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                Gestão Centralizada de Empresas, Agentes e Rotinas do ERP
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {user && (
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-stone-100 rounded-xl border border-stone-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-stone-700 font-semibold">{user.email}</span>
              <span className="bg-emerald-800 text-white font-bold text-[10px] px-1.5 py-0.5 rounded">Admin</span>
            </div>
          )}

          <button
            type="button"
            onClick={loadCompanies}
            disabled={isLoading}
            className="w-11 h-11 rounded-xl border border-stone-200 bg-white flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              handleGenerateRandomToken();
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 active:scale-95 transition-all min-h-[44px] shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Empresa</span>
          </button>

          <button
            type="button"
            onClick={signOut}
            className="w-11 h-11 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-center text-rose-600 hover:text-rose-800 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
            title="Sair da Conta Admin"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* Banner de Sucesso pós-criação com Token imediato */}
        {createdBanner && (
          <div className="bg-emerald-50 border border-emerald-300/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <span className="text-xs font-bold text-emerald-950">
                  Empresa criada com sucesso! Token do agente gerado:
                </span>
              </div>
              <p className="text-xs text-emerald-900 space-y-1">
                <div>
                  Empresa: <strong>{createdBanner.name}</strong> • Token:{' '}
                  <code className="font-mono bg-white/90 px-2 py-0.5 rounded-md border border-emerald-200 select-all font-semibold text-emerald-950">
                    {createdBanner.token}
                  </code>
                </div>
                {createdBanner.activationCode && (
                  <div className="pt-1">
                    Código de Ativação do App:{' '}
                    <code className="font-mono bg-white/90 px-2 py-0.5 rounded-md border border-emerald-200 select-all font-black text-emerald-950">
                      {createdBanner.activationCode}
                    </code>
                  </div>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopyToken(createdBanner.slug, createdBanner.token)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-emerald-300 bg-white hover:bg-emerald-100/60 text-emerald-900 active:scale-95 transition-all shadow-2xs min-h-[44px] cursor-pointer"
              >
                {copiedMap[createdBanner.slug] ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-800">Token Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-emerald-700" />
                    <span>Copiar Token</span>
                  </>
                )}
              </button>
              {createdBanner.activationCode && (
                <button
                  type="button"
                  onClick={() => handleCopyCode(createdBanner.slug, createdBanner.activationCode!)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-emerald-300 bg-emerald-800 hover:bg-emerald-900 text-white active:scale-95 transition-all shadow-2xs min-h-[44px] cursor-pointer"
                >
                  {copiedCodeMap[createdBanner.slug] ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Chave Copiada!</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Copiar Chave App</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setCreatedBanner(null)}
                className="p-2.5 rounded-xl text-emerald-800/70 hover:text-emerald-950 hover:bg-emerald-100/60 active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                title="Fechar aviso"
                aria-label="Fechar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Cards de Métricas */}
        {(() => {
          const activeCompaniesCount = companies.filter(
            (c) => c.isActive && (!c.activeUntil || new Date(c.activeUntil).getTime() > Date.now())
          ).length;
          const suspendedCompaniesCount = companies.length - activeCompaniesCount;

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Total de Empresas
                  </p>
                  <p className="text-2xl font-bold text-[#0f291e] mt-0.5">{companies.length}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Agentes Locais Ativos
                  </p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-2xl font-bold text-[#0f291e]">{onlineCount}</span>
                    <span className="text-xs text-stone-500">de {companies.length} online</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Acessos Liberados
                  </p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-2xl font-bold text-emerald-900">{activeCompaniesCount}</span>
                    <span className="text-xs text-stone-500">em dia</span>
                  </div>
                </div>
              </div>

              <div
                className={`bg-white rounded-2xl p-5 border shadow-xs flex items-center space-x-4 ${
                  suspendedCompaniesCount > 0 ? 'border-rose-200 bg-rose-50/20' : 'border-stone-200/80'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
                    suspendedCompaniesCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {suspendedCompaniesCount > 0 ? (
                    <Ban className="w-6 h-6" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-stone-400" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Suspensas / Vencidas
                  </p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span
                      className={`text-2xl font-bold ${
                        suspendedCompaniesCount > 0 ? 'text-rose-700' : 'text-stone-700'
                      }`}
                    >
                      {suspendedCompaniesCount}
                    </span>
                    <span className="text-xs text-stone-500">
                      {suspendedCompaniesCount === 0 ? 'Nenhum bloqueio' : 'pendência(s)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Lista de Empresas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0f291e] uppercase tracking-wider">
              Empresas Conectadas ({companies.length})
            </h2>
            <span className="text-xs text-stone-500">Atualização em tempo real</span>
          </div>

          {companies.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-stone-200/80 shadow-xs">
              <Building2 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-stone-700">Nenhuma empresa encontrada</p>
              <p className="text-xs text-stone-500 mt-1">
                Clique no botão "Nova Empresa" acima para adicionar a primeira loja.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {companies.map((company) => {
                const orcamentos = company.businessRules?.movimentos?.orcamento || ['2.2.01'];
                const vendas = company.businessRules?.movimentos?.venda || ['2.2.03'];
                const financeiro = company.businessRules?.financeiro?.moduloAtivo || 'AMBOS';
                const statusInfo = testStatus[company.slug];

                const primaryToken = company.tokens?.[0]?.token || (company.slug === 'empresa-piloto-001' ? 'token-secreto-agente-001' : '');
                const isRevealed = !!showTokenMap[company.slug];
                const isCopied = !!copiedMap[company.slug];

                return (
                  <div
                    key={company.id || company.slug}
                    className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-700/30 transition-all"
                  >
                    {/* Informações da Empresa */}
                    <div className="flex items-start space-x-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0f3928] to-[#1e5841] text-[#c0ecd6] flex items-center justify-center font-bold text-sm shrink-0">
                        {company.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h3 className="text-sm font-bold text-[#0f291e] truncate">{company.name}</h3>

                          {/* Badge Online/Offline */}
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              company.isOnline
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-600/20'
                                : 'bg-rose-50 text-rose-700 border-rose-600/20'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                company.isOnline ? 'bg-emerald-600' : 'bg-rose-500'
                              }`}
                            />
                            <span>{company.isOnline ? 'Agente Online' : 'Desconectado'}</span>
                          </span>

                          {/* Badge de Status de Cobrança / Validade */}
                          {(() => {
                            const isSuspendedManual = !company.isActive;
                            const isExpired = Boolean(
                              company.activeUntil && new Date(company.activeUntil).getTime() < Date.now()
                            );

                            if (isSuspendedManual) {
                              return (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  <Ban className="w-3 h-3 text-rose-700" />
                                  <span>Acesso Bloqueado</span>
                                </span>
                              );
                            }

                            if (isExpired) {
                              const expDate = new Date(company.activeUntil!).toLocaleDateString('pt-BR');
                              return (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <CalendarX className="w-3 h-3 text-amber-700" />
                                  <span>Vencido ({expDate})</span>
                                </span>
                              );
                            }

                            if (company.activeUntil) {
                              const expDate = new Date(company.activeUntil).toLocaleDateString('pt-BR');
                              const diffDays = Math.ceil(
                                (new Date(company.activeUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                              );
                              return (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  <Calendar className="w-3 h-3 text-emerald-600" />
                                  <span>Ativo até {expDate} ({diffDays}d)</span>
                                </span>
                              );
                            }

                            return (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                                <ShieldCheck className="w-3 h-3 text-emerald-700" />
                                <span>Acesso Vitalício</span>
                              </span>
                            );
                          })()}
                        </div>

                        <p className="text-xs text-stone-500 mt-0.5">
                          ID: <span className="font-mono text-stone-700 font-medium">{company.slug}</span>
                        </p>

                        {/* Badges de Resumo das Regras */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          <span className="text-[11px] bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded-md font-medium">
                            Orçamentos: <strong className="font-mono">{orcamentos.join(', ')}</strong>
                          </span>
                          <span className="text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-200/60 px-2 py-0.5 rounded-md font-medium">
                            Vendas: <strong className="font-mono">{vendas.join(', ')}</strong>
                          </span>
                          <span className="text-[11px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-medium">
                            Financeiro: <strong>{financeiro}</strong>
                          </span>
                        </div>

                        {/* Código de Ativação da Loja */}
                        {company.activationCode && (
                          <div className="flex flex-wrap items-center gap-2 mt-2.5">
                            <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 shrink-0">
                              <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                              Código de Ativação:
                            </span>
                            <span className="font-mono text-xs font-bold bg-emerald-50 text-emerald-950 border border-emerald-300/80 px-2 py-0.5 rounded-md">
                              {company.activationCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(company.slug, company.activationCode!)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                            >
                              {copiedCodeMap[company.slug] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                              <span>{copiedCodeMap[company.slug] ? 'Copiado!' : 'Copiar Chave'}</span>
                            </button>
                          </div>
                        )}

                        {/* WhatsApp / Contato da Loja */}
                        {company.businessRules?.cadastro_clientes?.whatsappContato && (
                          <div className="flex flex-wrap items-center gap-2 mt-2.5">
                            <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 shrink-0">
                              <Phone className="w-3.5 h-3.5 text-emerald-700" />
                              WhatsApp Loja:
                            </span>
                            <span className="font-mono text-xs font-bold bg-emerald-50 text-emerald-950 border border-emerald-300/80 px-2 py-0.5 rounded-md">
                              {company.businessRules.cadastro_clientes.whatsappContato}
                            </span>
                          </div>
                        )}

                        {/* Token do Agente com Visualizar e Copiar */}
                        {primaryToken && (
                          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-stone-100">
                            <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1.5 shrink-0">
                              <KeyRound className="w-3.5 h-3.5 text-stone-400" />
                              Token do Agente:
                            </span>
                            <div className="flex items-center gap-1 bg-stone-50 border border-stone-200/80 pl-2.5 pr-1 py-1 rounded-xl font-mono text-xs text-stone-800">
                              <span className="select-all font-semibold">
                                {isRevealed ? primaryToken : `${primaryToken.slice(0, 4)}••••••••${primaryToken.slice(-4)}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleShowToken(company.slug)}
                                className="w-9 h-9 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                                title={isRevealed ? 'Ocultar token' : 'Revelar token'}
                                aria-label={isRevealed ? 'Ocultar token' : 'Revelar token'}
                              >
                                {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyToken(company.slug, primaryToken)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 active:scale-95 transition-all shadow-2xs cursor-pointer min-h-[44px]"
                              title="Copiar token para a área de transferência"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-4 h-4 text-emerald-600" />
                                  <span className="text-emerald-700 font-semibold">Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 text-stone-500" />
                                  <span>Copiar Token</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center space-x-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 justify-end flex-wrap gap-y-2">
                      {/* Botão de Gestão de Acesso & Validade (Cobrança) */}
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal(company)}
                        className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all min-h-[44px] border cursor-pointer ${
                          !company.isActive
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                            : company.activeUntil && new Date(company.activeUntil).getTime() < Date.now()
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                        }`}
                        title="Gerenciar bloqueio de acesso e data limite de cobrança"
                      >
                        {!company.isActive ? (
                          <Ban className="w-3.5 h-3.5 text-rose-600" />
                        ) : company.activeUntil && new Date(company.activeUntil).getTime() < Date.now() ? (
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-stone-600" />
                        )}
                        <span>
                          {!company.isActive
                            ? 'Desbloquear'
                            : company.activeUntil && new Date(company.activeUntil).getTime() < Date.now()
                            ? 'Renovar Prazo'
                            : 'Acesso & Validade'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickTest(company.slug)}
                        disabled={statusInfo?.testing}
                        className="px-3 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 active:scale-95 transition-all min-h-[44px] flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Activity className={`w-3.5 h-3.5 ${statusInfo?.testing ? 'animate-spin' : ''}`} />
                        <span>{statusInfo?.result || (statusInfo?.testing ? 'Testando...' : 'Testar')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedCompany(company)}
                        className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 active:scale-[0.98] transition-all min-h-[44px] shadow-sm cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Configurar Rotinas & Permissões</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Criação de Empresa */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-stone-200 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-[#0f291e]">Cadastrar Nova Empresa</h3>
            <p className="text-xs text-stone-500">
              Gera o registro no Supabase e vincula um token de acesso para o agente local da loja.
            </p>

            {createError && (
              <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="space-y-3.5 pt-1">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mercadão das Tintas"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) {
                      setNewSlug(
                        e.target.value
                          .toLowerCase()
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)+/g, '')
                      );
                    }
                  }}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Identificador Único (Slug)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: mercadao-tintas-01"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  className="w-full font-mono px-3.5 py-2.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  WhatsApp / Telefone de Atendimento da Loja (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 66999998888"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full font-mono px-3.5 py-2.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none min-h-[44px]"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Número de atendimento que será disponibilizado aos clientes no link público de cadastro.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-700">
                    Token do Agente Local
                  </label>
                  <button
                    type="button"
                    onClick={() => handleGenerateRandomToken()}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-600/20 px-3 py-1.5 rounded-xl active:scale-95 transition-all cursor-pointer min-h-[44px]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Gerar Token Automático</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ex: agt_loja_9f8a72b1c4e2..."
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    className="w-full font-mono px-3.5 py-2.5 pr-24 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateRandomToken()}
                    className="absolute right-1 top-1 bottom-1 px-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                    title="Regerar token aleatório seguro"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
                    <span>Regerar</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Chave secreta única para autenticar o túnel WebSocket do agente da loja.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 active:scale-95 min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 active:scale-95 min-h-[44px] shadow-sm disabled:opacity-50"
                >
                  {isCreating ? 'Cadastrando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestão de Acesso & Validade (Cobrança) */}
      {statusModalCompany && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-stone-200 w-full max-w-lg shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                    !statusIsActive
                      ? 'bg-rose-100 text-rose-800'
                      : statusActiveUntil && new Date(statusActiveUntil).getTime() < Date.now()
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {!statusIsActive ? (
                    <Ban className="w-5 h-5 text-rose-700" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-emerald-700" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0f291e] tracking-tight">
                    Controle de Acesso: {statusModalCompany.name}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Bloqueio do aplicativo e data limite de validade para cobrança
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalCompany(null)}
                className="w-9 h-9 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center active:scale-95 transition-all cursor-pointer min-h-[44px] min-w-[44px]"
                title="Fechar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Alertas de Erro / Sucesso */}
            {statusSaveError && (
              <div className="bg-rose-50 text-rose-800 text-xs p-3 rounded-xl border border-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{statusSaveError}</span>
              </div>
            )}
            {statusSaveSuccess && (
              <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{statusSaveSuccess}</span>
              </div>
            )}

            {/* Seletor Mestre de Acesso (Liberado vs Bloqueado) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                1. Estado Geral de Liberação
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatusIsActive(true)}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer min-h-[80px] active:scale-[0.98] ${
                    statusIsActive
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-600/20'
                      : 'border-stone-200 hover:border-stone-300 bg-white opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Acesso Liberado
                    </span>
                    {statusIsActive && <Check className="w-4 h-4 text-emerald-700" />}
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1">
                    App funcional e sincronização de dados ativa.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusIsActive(false)}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer min-h-[80px] active:scale-[0.98] ${
                    !statusIsActive
                      ? 'border-rose-600 bg-rose-50/70 shadow-xs ring-2 ring-rose-600/20'
                      : 'border-stone-200 hover:border-stone-300 bg-white opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                      <Ban className="w-4 h-4 text-rose-600" />
                      Bloquear Acesso
                    </span>
                    {!statusIsActive && <Check className="w-4 h-4 text-rose-700" />}
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1">
                    Bloqueia o app imediatamente e desconecta o agente.
                  </p>
                </button>
              </div>
            </div>

            {/* Configuração de Validade / Data Limite */}
            <div className="space-y-2 pt-1 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                  2. Ativo Até (Data Limite de Assinatura)
                </label>
                {statusActiveUntil && (
                  <button
                    type="button"
                    onClick={() => handleSetQuickDays(null)}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    Remover data limite
                  </button>
                )}
              </div>

              {/* Atalhos Rápidos de Adição de Dias */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetQuickDays(30)}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-emerald-600 hover:bg-emerald-50 text-xs font-semibold text-stone-700 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                >
                  +30 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDays(60)}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-emerald-600 hover:bg-emerald-50 text-xs font-semibold text-stone-700 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                >
                  +60 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDays(90)}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-emerald-600 hover:bg-emerald-50 text-xs font-semibold text-stone-700 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                >
                  +90 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDays(365)}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-emerald-600 hover:bg-emerald-50 text-xs font-semibold text-stone-700 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                >
                  +1 ano
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDays(null)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold active:scale-95 transition-all cursor-pointer min-h-[36px] ${
                    !statusActiveUntil
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  Sem Prazo (Vitalício)
                </button>
              </div>

              {/* Input Date */}
              <div className="pt-1">
                <input
                  type="date"
                  value={statusActiveUntil}
                  onChange={(e) => setStatusActiveUntil(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none min-h-[44px]"
                />
              </div>

              {/* Feedback dinâmico da data */}
              <div className="text-[11px] text-stone-500 pt-0.5">
                {!statusActiveUntil ? (
                  <span className="text-emerald-700 font-medium">
                    Acesso contínuo sem expiração automática (permanece ativo até que você bloqueie manualmente).
                  </span>
                ) : (() => {
                  const [y, m, d] = statusActiveUntil.split('-').map(Number);
                  const targetTime = new Date(y, m - 1, d, 23, 59, 59).getTime();
                  const diffDays = Math.ceil((targetTime - Date.now()) / (1000 * 60 * 60 * 24));
                  if (diffDays < 0) {
                    return (
                      <span className="text-rose-600 font-bold">
                        Data já ultrapassada! O acesso da empresa será considerado vencido imediatamente.
                      </span>
                    );
                  }
                  if (diffDays === 0) {
                    return (
                      <span className="text-amber-700 font-bold">
                        Expira hoje às 23:59:59.
                      </span>
                    );
                  }
                  return (
                    <span className="text-emerald-800 font-medium">
                      Acesso ativo até {d.toString().padStart(2, '0')}/{(m).toString().padStart(2, '0')}/{y} às 23:59 ({diffDays} dias restantes).
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Mensagem Opcional de Bloqueio */}
            <div className="space-y-1.5 pt-1 border-t border-stone-100">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                3. Motivo ou Mensagem para o Usuário (Opcional)
              </label>
              <input
                type="text"
                value={statusBlockedReason}
                onChange={(e) => setStatusBlockedReason(e.target.value)}
                placeholder="Ex: Acesso suspenso por pendência financeira. Entre em contato com o suporte."
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none min-h-[44px]"
              />
              <p className="text-[11px] text-stone-500">
                Se a empresa for bloqueada, esta mensagem será exibida na tela de bloqueio do cliente.
              </p>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center space-x-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setStatusModalCompany(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 active:scale-95 transition-all min-h-[44px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={isSavingStatus}
                className="flex-1 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 active:scale-[0.98] transition-all min-h-[44px] shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isSavingStatus ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Regras (Carregado sob demanda via bundle-dynamic-imports) */}
      {selectedCompany && (
        <React.Suspense fallback={null}>
          <CompanyConfigModal
            company={selectedCompany}
            onClose={() => setSelectedCompany(null)}
            onUpdated={(updated) => {
              setCompanies((prev) =>
                prev.map((c) => (c.slug === updated.slug ? { ...updated, isOnline: c.isOnline } : c))
              );
              setSelectedCompany(null);
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
};
