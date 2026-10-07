import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Save,
  RefreshCw,
  Sliders,
  DollarSign,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Users,
  Mail,
  UserPlus,
  Trash2,
  LayoutDashboard,
  Package,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Bell,
  BarChart3,
  Target,
} from 'lucide-react';
import {
  CompanyDTO,
  BusinessRules,
  ErpTipoMovimentoDTO,
  AgentTokenDTO,
  UserProfileDTO,
  CompanyInviteDTO,
  UserRole,
  ErpVendedorDTO,
  DEFAULT_DASHBOARD_CARDS,
  DashboardCardConfigItem,
  DashboardCardId,
  DEFAULT_NOTIFICACOES_CONFIG,
  NotificacoesConfig,
} from '@ai-db/shared';
import {
  updateCompanyConfig,
  fetchErpMovimentos,
  testCompanyConnection,
  fetchCompanyTokens,
  createCompanyToken,
  fetchCompanyUsersAndInvites,
  createCompanyInvite,
  deleteCompanyInvite,
  updateUserRole,
  fetchErpVendedores,
  triggerTestNotification,
} from '../../services/api.js';

interface CompanyConfigModalProps {
  company: CompanyDTO;
  onClose: () => void;
  onUpdated: (updated: CompanyDTO) => void;
}

type TabKey =
  | 'movimentos'
  | 'itens'
  | 'cards'
  | 'cadastro_clientes'
  | 'notificacoes'
  | 'financeiro'
  | 'permissoes'
  | 'copilot'
  | 'usuarios'
  | 'tokens'
  | 'diagnostico';

const defaultBusinessRules: BusinessRules = {
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
      ver_ranking: true,
      ver_orcamentos_todos: false,
      ver_financeiro_receber: false,
      ver_financeiro_pagar: false,
      copilot_escopo: 'individual',
    },
  },
  copilot: {
    tomResposta: 'bluf',
    sugestoesPerguntas: [
      'Quanto faturamos hoje?',
      'Qual o produto mais vendido?',
      'Quanto temos a receber essa semana?',
      'Quais orçamentos estão em aberto?',
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
  cadastro_clientes: {
    habilitado: true,
    modo: 'direto',
    whatsappContato: '',
  },
  notificacoes: DEFAULT_NOTIFICACOES_CONFIG,
};

function mergeBusinessRules(incoming?: Partial<BusinessRules> | null): BusinessRules {
  if (!incoming) return defaultBusinessRules;
  return {
    ...defaultBusinessRules,
    ...incoming,
    movimentos: {
      ...defaultBusinessRules.movimentos,
      ...(incoming.movimentos || {}),
    },
    financeiro: {
      ...defaultBusinessRules.financeiro,
      ...(incoming.financeiro || {}),
    },
    roles_permissions: {
      diretor: {
        ...defaultBusinessRules.roles_permissions?.diretor,
        ...(incoming.roles_permissions?.diretor || {}),
      },
      gerente: {
        ...defaultBusinessRules.roles_permissions?.gerente,
        ...(incoming.roles_permissions?.gerente || {}),
      },
      vendedor: {
        ...defaultBusinessRules.roles_permissions?.vendedor,
        ...(incoming.roles_permissions?.vendedor || {}),
      },
    },
    copilot: {
      ...defaultBusinessRules.copilot,
      ...(incoming.copilot || {}),
      rateLimitEnabled: incoming.copilot?.rateLimitEnabled !== undefined ? Boolean(incoming.copilot.rateLimitEnabled) : true,
      rateLimitPerMinute: Number(incoming.copilot?.rateLimitPerMinute) || 20,
    },
    visao_geral: {
      cards: Array.isArray(incoming.visao_geral?.cards) && incoming.visao_geral.cards.length > 0
        ? incoming.visao_geral.cards
        : defaultBusinessRules.visao_geral?.cards || DEFAULT_DASHBOARD_CARDS,
    },
    itens: {
      tabelaPreco: incoming.itens?.tabelaPreco === 'PRECO2' ? 'PRECO2' : 'PRECO1',
      exibirSaldoFisico: incoming.itens?.exibirSaldoFisico !== undefined ? Boolean(incoming.itens.exibirSaldoFisico) : true,
      exibirSaldoFiscal: Boolean(incoming.itens?.exibirSaldoFiscal),
    },
    cadastro_clientes: {
      habilitado: incoming.cadastro_clientes?.habilitado !== undefined ? Boolean(incoming.cadastro_clientes.habilitado) : true,
      modo: incoming.cadastro_clientes?.modo === 'pre_aprovacao' ? 'pre_aprovacao' : 'direto',
      whatsappContato: incoming.cadastro_clientes?.whatsappContato || '',
    },
    notificacoes: {
      offline: {
        habilitado: incoming.notificacoes?.offline?.habilitado !== undefined ? Boolean(incoming.notificacoes.offline.habilitado) : (defaultBusinessRules.notificacoes?.offline.habilitado ?? true),
        tempoToleranciaMinutos: Number(incoming.notificacoes?.offline?.tempoToleranciaMinutos) || (defaultBusinessRules.notificacoes?.offline.tempoToleranciaMinutos ?? 3),
        notificarReconexao: incoming.notificacoes?.offline?.notificarReconexao !== undefined ? Boolean(incoming.notificacoes.offline.notificarReconexao) : (defaultBusinessRules.notificacoes?.offline.notificarReconexao ?? true),
      },
      fechamento: {
        habilitado: incoming.notificacoes?.fechamento?.habilitado !== undefined ? Boolean(incoming.notificacoes.fechamento.habilitado) : (defaultBusinessRules.notificacoes?.fechamento.habilitado ?? true),
        horarioEnvio: incoming.notificacoes?.fechamento?.horarioEnvio || (defaultBusinessRules.notificacoes?.fechamento.horarioEnvio ?? '18:30'),
        incluirComparativoOntem: incoming.notificacoes?.fechamento?.incluirComparativoOntem !== undefined ? Boolean(incoming.notificacoes.fechamento.incluirComparativoOntem) : (defaultBusinessRules.notificacoes?.fechamento.incluirComparativoOntem ?? true),
        incluirTopProdutos: incoming.notificacoes?.fechamento?.incluirTopProdutos !== undefined ? Boolean(incoming.notificacoes.fechamento.incluirTopProdutos) : (defaultBusinessRules.notificacoes?.fechamento.incluirTopProdutos ?? true),
      },
      metas: {
        habilitado: incoming.notificacoes?.metas?.habilitado !== undefined ? Boolean(incoming.notificacoes.metas.habilitado) : (defaultBusinessRules.notificacoes?.metas.habilitado ?? true),
        valorMetaDiaria: Number(incoming.notificacoes?.metas?.valorMetaDiaria) || (defaultBusinessRules.notificacoes?.metas.valorMetaDiaria ?? 30000),
        marcosPercentuais: Array.isArray(incoming.notificacoes?.metas?.marcosPercentuais) && incoming.notificacoes.metas.marcosPercentuais.length > 0 ? incoming.notificacoes.metas.marcosPercentuais : [50, 100],
        alertaPedidoExpressivo: Boolean(incoming.notificacoes?.metas?.alertaPedidoExpressivo),
        valorMinimoPedidoExpressivo: Number(incoming.notificacoes?.metas?.valorMinimoPedidoExpressivo) || (defaultBusinessRules.notificacoes?.metas.valorMinimoPedidoExpressivo ?? 5000),
      },
    },
  };
}

export const CompanyConfigModal: React.FC<CompanyConfigModalProps> = ({
  company,
  onClose,
  onUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('movimentos');
  const [rules, setRules] = useState<BusinessRules>(() => mergeBusinessRules(company.businessRules));
  const [companyName, setCompanyName] = useState(company.name);

  // Controle de rolagem horizontal fluido das abas (Apple HIG / M3)
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollState = useCallback(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(checkScrollState, 100);
    const handleResize = () => checkScrollState();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [checkScrollState]);

  const handleScrollBy = (offset: number) => {
    if (tabScrollRef.current) {
      tabScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkScrollState, 250);
    }
  };

  const handleWheelOnTabs = (e: React.WheelEvent<HTMLDivElement>) => {
    if (tabScrollRef.current && e.deltaY !== 0) {
      tabScrollRef.current.scrollLeft += e.deltaY;
      checkScrollState();
    }
  };

  const handleSelectTab = (key: TabKey, e: React.MouseEvent<HTMLButtonElement>) => {
    setActiveTab(key);
    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    setTimeout(checkScrollState, 300);
  };

  // Entradas manuais para adicionar códigos customizados
  const [customOrcamento, setCustomOrcamento] = useState('');
  const [customVenda, setCustomVenda] = useState('');

  const handleAddCustomOrcamento = () => {
    const code = customOrcamento.trim();
    if (!code) return;
    if (!(rules.movimentos?.orcamento || []).includes(code)) {
      toggleOrcamento(code);
    }
    setCustomOrcamento('');
  };

  const handleAddCustomVenda = () => {
    const code = customVenda.trim();
    if (!code) return;
    if (!(rules.movimentos?.venda || []).includes(code)) {
      toggleVenda(code);
    }
    setCustomVenda('');
  };

  // Estados da busca no Firebird
  const [erpMovimentos, setErpMovimentos] = useState<ErpTipoMovimentoDTO[]>([]);
  const [isLoadingErp, setIsLoadingErp] = useState(false);
  const [erpError, setErpError] = useState<string | null>(null);

  // Diagnóstico
  const [diagResult, setDiagResult] = useState<{
    online: boolean;
    latencyMs?: number;
    message?: string;
  } | null>(null);
  const [isTestingDiag, setIsTestingDiag] = useState(false);

  // Salvamento
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estados de Tokens do Agente
  const [tokens, setTokens] = useState<AgentTokenDTO[]>(() => company.tokens || []);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showTokenMap, setShowTokenMap] = useState<Record<string, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);

  const loadTokens = async () => {
    setIsLoadingTokens(true);
    setTokenError(null);
    try {
      const res = await fetchCompanyTokens(company.slug);
      if (res.data) {
        setTokens(res.data);
      }
    } catch (err: any) {
      setTokenError(err.message || 'Falha ao consultar tokens');
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const handleCreateToken = async () => {
    setIsGeneratingToken(true);
    setTokenError(null);
    try {
      const created = await createCompanyToken(company.slug, undefined, newTokenName || undefined);
      setTokens((prev) => [created, ...prev]);
      setNewTokenName('');
      setShowTokenMap((prev) => ({ ...prev, [created.id]: true }));
      handleCopyToken(created.id, created.token);
    } catch (err: any) {
      setTokenError(err.message || 'Erro ao gerar novo token');
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleCopyToken = (id: string, token: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(token);
    }
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(6);
    }
    setCopiedMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedMap((prev) => ({ ...prev, [id]: false }));
    }, 2500);
  };

  const toggleShowToken = (id: string) => {
    setShowTokenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Estados e handler para teste de notificações em tempo real
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [testNotifResult, setTestNotifResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestNotification = async (tipo: 'offline' | 'fechamento' | 'meta') => {
    setIsTestingNotif(true);
    setTestNotifResult(null);
    try {
      const res = await triggerTestNotification(tipo);
      setTestNotifResult({ success: true, message: res.message || 'Notificação disparada com sucesso!' });
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([40, 30, 40]);
      }
    } catch (err: any) {
      setTestNotifResult({ success: false, message: err.message || 'Erro ao disparar notificação' });
    } finally {
      setIsTestingNotif(false);
    }
  };

  const [users, setUsers] = useState<UserProfileDTO[]>([]);
  const [invites, setInvites] = useState<CompanyInviteDTO[]>([]);
  const [erpVendedores, setErpVendedores] = useState<ErpVendedorDTO[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Formulário de novo convite
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<UserRole>('vendedor');
  const [newInviteVendedorId, setNewInviteVendedorId] = useState('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const loadUsersAndInvites = async () => {
    setIsLoadingUsers(true);
    try {
      const [resUsers, resVendedores] = await Promise.all([
        fetchCompanyUsersAndInvites(company.slug),
        fetchErpVendedores(company.slug).catch(() => ({ data: [] })),
      ]);
      setUsers(resUsers.users || []);
      setInvites(resUsers.invites || []);
      if (resVendedores.data) {
        setErpVendedores(resVendedores.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail.trim()) return;
    setIsCreatingInvite(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await createCompanyInvite(
        company.slug,
        newInviteEmail.trim(),
        newInviteRole,
        newInviteVendedorId || undefined
      );
      setInvites((prev) => [res.data, ...prev.filter((i) => i.id !== res.data.id)]);
      setNewInviteEmail('');
      setNewInviteVendedorId('');
      setInviteSuccess('Convite registrado! Quando o usuário se cadastrar, terá acesso imediato.');
      setTimeout(() => setInviteSuccess(null), 4000);
      loadUsersAndInvites();
    } catch (err: any) {
      setInviteError(err.message || 'Erro ao registrar convite');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm('Deseja remover este convite pendente?')) return;
    try {
      await deleteCompanyInvite(company.slug, inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err: any) {
      alert(err.message || 'Erro ao remover convite');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole, erpVendedorId?: string) => {
    try {
      const res = await updateUserRole(userId, newRole, erpVendedorId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? res.data : u)));
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar papel do usuário');
    }
  };

  const handleCopyActivationCode = () => {
    const code = company.activationCode || 'PILOTO-001';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  useEffect(() => {
    if (activeTab === 'usuarios') {
      loadUsersAndInvites();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'tokens' && tokens.length === 0) {
      loadTokens();
    }
  }, [activeTab]);

  // Carrega movimentos do ERP ao abrir a aba se ainda não foram carregados
  const handleLoadErpMovimentos = async () => {
    setIsLoadingErp(true);
    setErpError(null);
    try {
      const res = await fetchErpMovimentos(company.slug);
      if (res.data) {
        setErpMovimentos(res.data);
      }
    } catch (err: any) {
      setErpError(err.message || 'Falha ao buscar movimentos do ERP.');
    } finally {
      setIsLoadingErp(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingDiag(true);
    try {
      const res = await testCompanyConnection(company.slug);
      setDiagResult(res);
    } catch (err: any) {
      setDiagResult({ online: false, message: err.message });
    } finally {
      setIsTestingDiag(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await updateCompanyConfig(company.slug, rules, companyName);
      onUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Alterna movimento de orçamento
  const toggleOrcamento = (cod: string) => {
    setRules((prev) => {
      const current = prev.movimentos?.orcamento || [];
      const exists = current.includes(cod);
      const updated = exists ? current.filter((c) => c !== cod) : [...current, cod];
      return {
        ...prev,
        movimentos: {
          ...prev.movimentos,
          orcamento: updated,
        },
      };
    });
  };

  // Alterna movimento de venda
  const toggleVenda = (cod: string) => {
    setRules((prev) => {
      const current = prev.movimentos?.venda || [];
      const exists = current.includes(cod);
      const updated = exists ? current.filter((c) => c !== cod) : [...current, cod];
      return {
        ...prev,
        movimentos: {
          ...prev.movimentos,
          venda: updated,
        },
      };
    });
  };

  // Alterna tipo de documento financeiro
  const toggleTipoDoc = (doc: string) => {
    setRules((prev) => {
      const current = prev.financeiro?.tiposDocumento || [];
      const exists = current.includes(doc);
      const updated = exists ? current.filter((d) => d !== doc) : [...current, doc];
      return {
        ...prev,
        financeiro: {
          ...prev.financeiro,
          tiposDocumento: updated,
        },
      };
    });
  };

  // Funções para manipular cards da Visão Geral
  const handleToggleCardAtivo = (id: DashboardCardId) => {
    setRules((prev) => {
      const currentCards = prev.visao_geral?.cards || DEFAULT_DASHBOARD_CARDS;
      const updated = currentCards.map((c) => (c.id === id ? { ...c, ativo: !c.ativo } : c));
      return {
        ...prev,
        visao_geral: { cards: updated },
      };
    });
  };

  const handleToggleCardRole = (id: DashboardCardId, role: 'diretor' | 'gerente' | 'vendedor') => {
    setRules((prev) => {
      const currentCards = prev.visao_geral?.cards || DEFAULT_DASHBOARD_CARDS;
      const updated = currentCards.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          roles: {
            ...c.roles,
            [role]: !c.roles[role],
          },
        };
      });
      return {
        ...prev,
        visao_geral: { cards: updated },
      };
    });
  };

  const handleMoveCard = (index: number, direction: 'up' | 'down') => {
    setRules((prev) => {
      const currentCards = [...(prev.visao_geral?.cards || DEFAULT_DASHBOARD_CARDS)].sort(
        (a, b) => a.ordem - b.ordem
      );
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentCards.length) return prev;

      const temp = currentCards[index];
      currentCards[index] = currentCards[targetIndex];
      currentCards[targetIndex] = temp;

      const reordered = currentCards.map((card, idx) => ({
        ...card,
        ordem: idx + 1,
      }));

      return {
        ...prev,
        visao_geral: { cards: reordered },
      };
    });
  };

  // Manipulação de regras do Copilot IA & Rate Limiting
  const [newSuggestionInput, setNewSuggestionInput] = useState('');

  const handleToggleRateLimit = () => {
    setRules((prev) => ({
      ...prev,
      copilot: {
        ...prev.copilot,
        rateLimitEnabled: prev.copilot?.rateLimitEnabled === false ? true : false,
      },
    }));
  };

  const handleSetRateLimitPerMinute = (val: number) => {
    const sanitized = Math.max(1, Math.min(300, val));
    setRules((prev) => ({
      ...prev,
      copilot: {
        ...prev.copilot,
        rateLimitPerMinute: sanitized,
      },
    }));
  };

  const handleSetTomResposta = (tom: 'bluf' | 'detalhado') => {
    setRules((prev) => ({
      ...prev,
      copilot: {
        ...prev.copilot,
        tomResposta: tom,
      },
    }));
  };

  const handleAddSuggestion = () => {
    const text = newSuggestionInput.trim();
    if (!text) return;
    const current = rules.copilot?.sugestoesPerguntas || [];
    if (!current.includes(text)) {
      setRules((prev) => ({
        ...prev,
        copilot: {
          ...prev.copilot,
          sugestoesPerguntas: [...current, text],
        },
      }));
    }
    setNewSuggestionInput('');
  };

  const handleRemoveSuggestion = (index: number) => {
    setRules((prev) => {
      const current = [...(prev.copilot?.sugestoesPerguntas || [])];
      current.splice(index, 1);
      return {
        ...prev,
        copilot: {
          ...prev.copilot,
          sugestoesPerguntas: current,
        },
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header do Modal */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80 backdrop-blur-md">
          <div className="min-w-0 pr-4 flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Empresa • ID: <code className="font-mono text-stone-700 font-semibold">{company.slug}</code>
              </span>
            </div>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              aria-label="Nome da Empresa"
              className="text-base sm:text-lg font-bold text-[#0f291e] bg-white hover:bg-stone-50 focus:bg-white border border-stone-200/90 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 w-full max-w-md transition-all"
              placeholder="Nome da Empresa"
            />
          </div>

          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 active:scale-95 transition-all shrink-0 ml-2 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas Superiores com Navegação Fluida (Apple HIG / M3) */}
        <div className="relative border-b border-stone-100 bg-white group">
          {/* Botão de Rolagem Esquerda */}
          {canScrollLeft && (
            <div className="absolute left-0 inset-y-0 z-10 flex items-center pl-2 pr-4 bg-gradient-to-r from-white via-white/95 to-transparent pointer-events-none">
              <button
                type="button"
                onClick={() => handleScrollBy(-220)}
                className="w-8 h-8 rounded-full bg-white shadow-md border border-stone-200/80 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-50 active:scale-95 transition-all pointer-events-auto cursor-pointer"
                aria-label="Rolar abas para a esquerda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Container com Rolagem Horizontal Suave */}
          <div
            ref={tabScrollRef}
            onScroll={checkScrollState}
            onWheel={handleWheelOnTabs}
            className="flex px-4 sm:px-6 bg-white overflow-x-auto no-scrollbar space-x-1 sm:space-x-2 scroll-smooth"
          >
            {[
              { key: 'movimentos', label: 'Orçamentos & Vendas', icon: Sliders },
              { key: 'itens', label: 'Itens & Estoque', icon: Package },
              { key: 'cards', label: 'Visão Geral', icon: LayoutDashboard },
              { key: 'cadastro_clientes', label: 'Cadastro de Clientes', icon: UserPlus },
              { key: 'notificacoes', label: 'Notificações', icon: Bell },
              { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
              { key: 'permissoes', label: 'Cargos & Permissões', icon: ShieldCheck },
              { key: 'copilot', label: 'Voron Copilot', icon: Sparkles },
              { key: 'usuarios', label: 'Usuários & Convites', icon: Users },
              { key: 'tokens', label: 'Token do Agente', icon: KeyRound },
              { key: 'diagnostico', label: 'Diagnóstico Firebird', icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={(e) => handleSelectTab(tab.key as TabKey, e)}
                  className={`flex items-center space-x-2 py-3 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap shrink-0 min-h-[44px] transition-all active:scale-[0.98] cursor-pointer ${
                    isSelected
                      ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
                      : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-stone-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Botão de Rolagem Direita */}
          {canScrollRight && (
            <div className="absolute right-0 inset-y-0 z-10 flex items-center pr-2 pl-4 bg-gradient-to-l from-white via-white/95 to-transparent pointer-events-none">
              <button
                type="button"
                onClick={() => handleScrollBy(220)}
                className="w-8 h-8 rounded-full bg-white shadow-md border border-stone-200/80 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-50 active:scale-95 transition-all pointer-events-auto cursor-pointer"
                aria-label="Rolar abas para a direita"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Corpo com Rolagem */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ============================================================== */}
          {/* ABA 1: MOVIMENTOS COMERCIAIS                                   */}
          {/* ============================================================== */}
          {activeTab === 'movimentos' && (
            <div className="space-y-6">
              <div className="bg-emerald-50/70 border border-emerald-900/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[#0f291e]">Consultar Catálogo do ERP</h4>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    Busca os movimentos reais cadastrados na tabela <code className="font-mono font-semibold">TTIPOMOV</code> (iniciados em 2.1 e 2.2).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadErpMovimentos}
                  disabled={isLoadingErp}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 active:scale-95 transition-all min-h-[44px] shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingErp ? 'animate-spin' : ''}`} />
                  <span>{isLoadingErp ? 'Buscando no ERP...' : 'Buscar no Firebird'}</span>
                </button>
              </div>

              {erpError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{erpError}</span>
                </div>
              )}

              {/* Seção A: Movimento de Orçamento */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0f291e] uppercase tracking-wider">
                    1. Movimento(s) para ORÇAMENTO (Cotações em Aberto)
                  </label>
                  <span className="text-[11px] text-stone-500 font-medium">
                    {(rules.movimentos?.orcamento || []).length} selecionado(s)
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Estes códigos serão somados como orçamentos e propostas em negociação.
                </p>

                {/* Pílulas dos códigos selecionados com botão de remover */}
                <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-amber-50/50 border border-amber-900/10 min-h-[44px]">
                  <span className="text-[11px] font-semibold text-amber-900/80 mr-1">Ativos:</span>
                  {(rules.movimentos?.orcamento || []).length === 0 ? (
                    <span className="text-xs text-stone-400 italic">Nenhum código selecionado</span>
                  ) : (
                    (rules.movimentos?.orcamento || []).map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 font-mono text-xs font-bold shadow-2xs"
                      >
                        <span>{code}</span>
                        <button
                          type="button"
                          onClick={() => toggleOrcamento(code)}
                          className="w-4 h-4 rounded-full hover:bg-amber-300 flex items-center justify-center text-amber-900 font-bold transition-colors cursor-pointer"
                          title={`Remover ${code}`}
                          aria-label={`Remover ${code}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Input para adicionar manualmente */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Código (ex: 2.2.01)"
                    value={customOrcamento}
                    onChange={(e) => setCustomOrcamento(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomOrcamento();
                      }
                    }}
                    className="px-3 py-2 text-xs border border-stone-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 max-w-[160px] min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomOrcamento}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 min-h-[44px] active:scale-95 transition-all cursor-pointer"
                  >
                    + Adicionar Código
                  </button>
                </div>

                {/* Catálogo do Firebird */}
                {erpMovimentos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {erpMovimentos.map((m) => {
                      const isChecked = (rules.movimentos?.orcamento || []).includes(m.codtmv);
                      return (
                        <label
                          key={`orc-${m.codtmv}`}
                          className={`flex items-start space-x-3 p-3 rounded-xl border text-xs cursor-pointer transition-all active:scale-[0.99] min-h-[48px] ${
                            isChecked
                              ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-medium'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOrcamento(m.codtmv)}
                            className="mt-0.5 rounded text-amber-700 focus:ring-amber-600"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-bold text-stone-900">{m.codtmv}</span>
                            <span className="text-stone-600 block truncate">{m.descricao}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seção B: Movimentos de Venda Efetivada */}
              <div className="space-y-3 pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0f291e] uppercase tracking-wider">
                    2. Movimento(s) para VENDA (Faturamento Efetivado)
                  </label>
                  <span className="text-[11px] text-stone-500 font-medium">
                    {(rules.movimentos?.venda || []).length} selecionado(s)
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Estes códigos serão somados como faturamento real de vendas no dashboard e pelo Copilot.
                </p>

                {/* Pílulas dos códigos selecionados com botão de remover */}
                <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-900/10 min-h-[44px]">
                  <span className="text-[11px] font-semibold text-emerald-900/80 mr-1">Ativos:</span>
                  {(rules.movimentos?.venda || []).length === 0 ? (
                    <span className="text-xs text-stone-400 italic">Nenhum código selecionado</span>
                  ) : (
                    (rules.movimentos?.venda || []).map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 border border-emerald-300 text-emerald-950 font-mono text-xs font-bold shadow-2xs"
                      >
                        <span>{code}</span>
                        <button
                          type="button"
                          onClick={() => toggleVenda(code)}
                          className="w-4 h-4 rounded-full hover:bg-emerald-300 flex items-center justify-center text-emerald-900 font-bold transition-colors cursor-pointer"
                          title={`Remover ${code}`}
                          aria-label={`Remover ${code}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Input para adicionar manualmente */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Código (ex: 2.2.03)"
                    value={customVenda}
                    onChange={(e) => setCustomVenda(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomVenda();
                      }
                    }}
                    className="px-3 py-2 text-xs border border-stone-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700/20 max-w-[160px] min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomVenda}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 min-h-[44px] active:scale-95 transition-all cursor-pointer"
                  >
                    + Adicionar Código
                  </button>
                </div>

                {/* Catálogo do Firebird */}
                {erpMovimentos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {erpMovimentos.map((m) => {
                      const isChecked = (rules.movimentos?.venda || []).includes(m.codtmv);
                      return (
                        <label
                          key={`ven-${m.codtmv}`}
                          className={`flex items-start space-x-3 p-3 rounded-xl border text-xs cursor-pointer transition-all active:scale-[0.99] min-h-[48px] ${
                            isChecked
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleVenda(m.codtmv)}
                            className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-600"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-bold text-stone-900">{m.codtmv}</span>
                            <span className="text-stone-600 block truncate">{m.descricao}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA: ITENS, PREÇOS E ESTOQUE                                   */}
          {/* ============================================================== */}
          {activeTab === 'itens' && (
            <div className="space-y-6">
              <div className="bg-emerald-50/70 border border-emerald-900/10 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-[#0f291e] flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-800" />
                  Configuração de Consulta de Itens & Estoque
                </h4>
                <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                  Defina qual tabela de preços e quais saldos de estoque da tabela <code className="font-mono font-semibold">TPRODSALDO</code> serão utilizados e exibidos aos usuários nesta empresa.
                </p>
              </div>

              {/* Seção 1: Tabela de Preço Ativa */}
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 space-y-3 shadow-xs">
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-700">Tabela de Preço Padrão</h5>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Selecione qual campo da tabela <code className="font-mono">TPRODUTO</code> deve alimentar o preço principal do item no app:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setRules((prev) => ({
                      ...prev,
                      itens: {
                        ...(prev.itens || { exibirSaldoFisico: true, exibirSaldoFiscal: false, tabelaPreco: 'PRECO1' }),
                        tabelaPreco: 'PRECO1',
                      },
                    }))}
                    className={`p-4 rounded-xl border text-left transition-all active:scale-[0.98] cursor-pointer min-h-[48px] flex items-start space-x-3 ${
                      (rules.itens?.tabelaPreco || 'PRECO1') === 'PRECO1'
                        ? 'border-emerald-700 bg-emerald-50/60 ring-2 ring-emerald-700/20'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                      (rules.itens?.tabelaPreco || 'PRECO1') === 'PRECO1' ? 'border-emerald-700 bg-emerald-700' : 'border-stone-300'
                    }`}>
                      {(rules.itens?.tabelaPreco || 'PRECO1') === 'PRECO1' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">Preço 1 (Padrão de Venda)</span>
                      <span className="text-[11px] text-stone-500 mt-0.5 block leading-normal">
                        Utiliza o campo <code className="font-mono text-emerald-800 font-semibold">TPRODUTO.PRECO1</code>.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRules((prev) => ({
                      ...prev,
                      itens: {
                        ...(prev.itens || { exibirSaldoFisico: true, exibirSaldoFiscal: false, tabelaPreco: 'PRECO1' }),
                        tabelaPreco: 'PRECO2',
                      },
                    }))}
                    className={`p-4 rounded-xl border text-left transition-all active:scale-[0.98] cursor-pointer min-h-[48px] flex items-start space-x-3 ${
                      rules.itens?.tabelaPreco === 'PRECO2'
                        ? 'border-emerald-700 bg-emerald-50/60 ring-2 ring-emerald-700/20'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                      rules.itens?.tabelaPreco === 'PRECO2' ? 'border-emerald-700 bg-emerald-700' : 'border-stone-300'
                    }`}>
                      {rules.itens?.tabelaPreco === 'PRECO2' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">Preço 2 (Tabela Alternativa)</span>
                      <span className="text-[11px] text-stone-500 mt-0.5 block leading-normal">
                        Utiliza o campo <code className="font-mono text-emerald-800 font-semibold">TPRODUTO.PRECO2</code>.
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Seção 2: Exibição de Saldos de Estoque */}
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 space-y-4 shadow-xs">
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-700">Exibição de Saldos de Estoque</h5>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Controle quais saldos da tabela <code className="font-mono font-semibold">TPRODSALDO</code> serão exibidos no card de produtos:
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Saldo 1: Físico / Principal */}
                  <label className="flex items-start space-x-3.5 p-3.5 rounded-xl border border-stone-200 hover:bg-stone-50/70 transition-all cursor-pointer min-h-[48px]">
                    <input
                      type="checkbox"
                      checked={rules.itens?.exibirSaldoFisico !== false}
                      onChange={(e) => setRules((prev) => ({
                        ...prev,
                        itens: {
                          ...(prev.itens || { tabelaPreco: 'PRECO1', exibirSaldoFiscal: false, exibirSaldoFisico: true }),
                          exibirSaldoFisico: e.target.checked,
                        },
                      }))}
                      className="w-5 h-5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700/20 mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-stone-900 flex items-center space-x-2">
                        <span>Saldo 1 — Saldo Físico / Principal</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                          TPRODSALDO.SALDOFISICO1
                        </span>
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-normal">
                        Saldo físico real disponível para pronta entrega em loja.
                      </p>
                    </div>
                  </label>

                  {/* Saldo 2: Fiscal */}
                  <label className="flex items-start space-x-3.5 p-3.5 rounded-xl border border-stone-200 hover:bg-stone-50/70 transition-all cursor-pointer min-h-[48px]">
                    <input
                      type="checkbox"
                      checked={Boolean(rules.itens?.exibirSaldoFiscal)}
                      onChange={(e) => setRules((prev) => ({
                        ...prev,
                        itens: {
                          ...(prev.itens || { tabelaPreco: 'PRECO1', exibirSaldoFisico: true, exibirSaldoFiscal: false }),
                          exibirSaldoFiscal: e.target.checked,
                        },
                      }))}
                      className="w-5 h-5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700/20 mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-stone-900 flex items-center space-x-2">
                        <span>Saldo 2 — Saldo Fiscal</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold">
                          TPRODSALDO.SALDOFISICO2
                        </span>
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-normal">
                        Saldo fiscal/contábil registrado no ERP para escrituração e faturamento.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA: CARDS DA VISÃO GERAL                                      */}
          {/* ============================================================== */}
          {activeTab === 'cards' && (
            <div className="space-y-6">
              <div className="bg-emerald-50/70 border border-emerald-900/10 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-[#0f291e] flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-emerald-800" />
                  Personalização Modular da Visão Geral
                </h4>
                <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                  Defina quais blocos aparecem na tela inicial do app para esta empresa, a sequência de exibição e os cargos autorizados. Módulos desativados não realizam consultas ao banco Firebird, acelerando a resposta.
                </p>
              </div>

              {/* Lista dos Cards na Ordem Configurada */}
              <div className="space-y-3">
                {(() => {
                  const sortedCards = [...(rules.visao_geral?.cards || DEFAULT_DASHBOARD_CARDS)].sort(
                    (a, b) => a.ordem - b.ordem
                  );

                  return sortedCards.map((card, index) => {
                    const isFirst = index === 0;
                    const isLast = index === sortedCards.length - 1;

                    return (
                      <div
                        key={card.id}
                        className={`rounded-2xl border p-4 transition-all duration-200 ${
                          card.ativo
                            ? 'bg-white border-stone-200/90 shadow-xs'
                            : 'bg-stone-50/80 border-stone-200/60 opacity-75'
                        }`}
                      >
                        {/* Topo do Card: Número, Título, Status e Ações */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <span
                              className={`w-7 h-7 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                                card.ativo
                                  ? 'bg-[#0f3928] text-white'
                                  : 'bg-stone-200 text-stone-600'
                              }`}
                            >
                              0{index + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                                  {card.label}
                                </h5>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    card.ativo
                                      ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-300'
                                      : 'bg-stone-200 text-stone-600'
                                  }`}
                                >
                                  {card.ativo ? 'Ativo' : 'Oculto'}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                                {card.descricao}
                              </p>
                            </div>
                          </div>

                          {/* Controles de Reordenação e Switch Ativar/Desativar */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {/* Botões Subir/Descer com área de toque mínima de 44x44px (Apple HIG) */}
                            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200/80">
                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={() => handleMoveCard(index, 'up')}
                                title="Mover card para cima"
                                aria-label={`Mover ${card.label} para cima`}
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                              >
                                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                disabled={isLast}
                                onClick={() => handleMoveCard(index, 'down')}
                                title="Mover card para baixo"
                                aria-label={`Mover ${card.label} para baixo`}
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                              >
                                <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                              </button>
                            </div>

                            {/* Toggle Ativar/Desativar com área de toque ergonômica */}
                            <button
                              type="button"
                              onClick={() => handleToggleCardAtivo(card.id)}
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all active:scale-95 cursor-pointer ${
                                card.ativo
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-white text-stone-500 border-stone-300 hover:bg-stone-50'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  card.ativo ? 'bg-emerald-600 animate-pulse' : 'bg-stone-400'
                                }`}
                              />
                              <span>{card.ativo ? 'Habilitado' : 'Desabilitado'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Linha de Permissões por Cargo para este Card */}
                        <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                            Cargos autorizados a visualizar:
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {[
                              { role: 'diretor' as const, label: 'Diretor' },
                              { role: 'gerente' as const, label: 'Gerente' },
                              { role: 'vendedor' as const, label: 'Vendedor' },
                            ].map((roleOpt) => {
                              const isPermitted = card.roles?.[roleOpt.role] ?? true;
                              return (
                                <button
                                  key={roleOpt.role}
                                  type="button"
                                  onClick={() => handleToggleCardRole(card.id, roleOpt.role)}
                                  disabled={!card.ativo}
                                  className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                                    !card.ativo
                                      ? 'opacity-40 cursor-not-allowed bg-stone-100 border-stone-200 text-stone-400'
                                      : isPermitted
                                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs font-semibold'
                                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                                  }`}
                                >
                                  <span
                                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                                      isPermitted ? 'text-white' : 'text-stone-300'
                                    }`}
                                  >
                                    {isPermitted ? <Check className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />}
                                  </span>
                                  <span>{roleOpt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA: CADASTRO DE CLIENTES (LINK PÚBLICO & APROVAÇÃO)           */}
          {/* ============================================================== */}
          {activeTab === 'cadastro_clientes' && (
            <div className="space-y-6">
              {/* Card de Habilitação do Link */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0f291e]">Formulário Público de Cadastro</h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Permite que novos clientes façam o auto-cadastro através do link compartilhável.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rules.cadastro_clientes?.habilitado ?? true}
                      onChange={(e) => {
                        setRules((prev) => ({
                          ...prev,
                          cadastro_clientes: {
                            ...(prev.cadastro_clientes || { modo: 'direto', whatsappContato: '' }),
                            habilitado: e.target.checked,
                          },
                        }));
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
                  </label>
                </div>

                {/* Seletor Dinâmico de Modo de Processamento */}
                <div className="pt-3 border-t border-stone-200/70 space-y-2">
                  <label className="text-xs font-bold text-[#0f291e] uppercase tracking-wider block">
                    Modo de Processamento de Novos Cadastros
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Opção Inserção Direta */}
                    <div
                      onClick={() => {
                        setRules((prev) => ({
                          ...prev,
                          cadastro_clientes: {
                            ...(prev.cadastro_clientes || { habilitado: true, whatsappContato: '' }),
                            modo: 'direto',
                          },
                        }));
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] ${
                        (rules.cadastro_clientes?.modo ?? 'direto') === 'direto'
                          ? 'bg-emerald-50/80 border-emerald-500/80 shadow-xs'
                          : 'bg-white border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                        <h5 className="text-xs font-bold text-stone-900">Inserção Direta no ERP</h5>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-relaxed">
                        O cliente preenche o formulário e é inserido <strong>imediatamente na tabela FCFO</strong> do Firebird local com a usuária MARCELIA e Tipo 01.
                      </p>
                    </div>

                    {/* Opção Fila de Pré-Aprovação */}
                    <div
                      onClick={() => {
                        setRules((prev) => ({
                          ...prev,
                          cadastro_clientes: {
                            ...(prev.cadastro_clientes || { habilitado: true, whatsappContato: '' }),
                            modo: 'pre_aprovacao',
                          },
                        }));
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] ${
                        rules.cadastro_clientes?.modo === 'pre_aprovacao'
                          ? 'bg-amber-50/80 border-amber-500/80 shadow-xs'
                          : 'bg-white border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <h5 className="text-xs font-bold text-stone-900">Fila de Pré-Aprovação</h5>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-relaxed">
                        O cadastro fica retido na nuvem como pendente. Os gestores revisam os dados e aprovam com 1 clique antes de gravar no Firebird.
                      </p>
                    </div>
                  </div>
                </div>

                {/* WhatsApp / Contato da Empresa */}
                <div className="pt-3 border-t border-stone-200/70 space-y-1.5">
                  <label className="text-xs font-bold text-[#0f291e] block">
                    WhatsApp / Telefone de Atendimento da Loja
                  </label>
                  <p className="text-[11px] text-stone-500">
                    Número da empresa exibido para seus clientes na página pública de cadastro (link web) para dúvidas e atendimento:
                  </p>
                  <input
                    type="text"
                    value={rules.cadastro_clientes?.whatsappContato || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRules((prev) => ({
                        ...prev,
                        cadastro_clientes: {
                          ...(prev.cadastro_clientes || { habilitado: true, modo: 'direto' }),
                          whatsappContato: val,
                        },
                      }));
                    }}
                    placeholder="Ex: 66999998888"
                    className="w-full max-w-sm min-h-[44px] px-3.5 rounded-xl border border-stone-200 bg-white text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>

                {/* Link Oficial da Empresa */}
                <div className="pt-3 border-t border-stone-200/70 space-y-1.5">
                  <label className="text-xs font-bold text-[#0f291e] block">
                    Link de Cadastro da Loja
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={typeof window !== 'undefined' ? `${window.location.origin}/cadastro/${company.slug}` : `/cadastro/${company.slug}`}
                      className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-white border border-stone-200 text-xs font-mono text-stone-700 outline-hidden select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/cadastro/${company.slug}`;
                        navigator.clipboard.writeText(url);
                        alert('Link copiado para a área de transferência!');
                      }}
                      className="min-h-[44px] px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA: NOTIFICAÇÕES & ALERTAS PROATIVOS                          */}
          {/* ============================================================== */}
          {activeTab === 'notificacoes' && (
            <div className="space-y-6">
              {/* Cabeçalho explicativo */}
              <div className="bg-gradient-to-br from-emerald-50/80 via-white to-stone-50 border border-emerald-100/80 rounded-2xl p-4 sm:p-5">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                      Alertas Proativos & Notificações Web Push
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      Transforme o Voron em um copiloto vigilante. Habilite e personalize os avisos estratégicos que o gestor recebe em tempo real no dispositivo (PWA), mesmo com o aplicativo fechado.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feedback do Teste de Notificação */}
              {testNotifResult && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                    testNotifResult.success
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/90 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testNotifResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testNotifResult.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestNotifResult(null)}
                    className="p-1 text-stone-400 hover:text-stone-700 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* CARD 1: QUEDA DO SERVIDOR & CONECTIVIDADE ERP */}
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-700" />
                      <h4 className="text-sm font-bold text-stone-900">
                        Queda do Servidor & Conectividade ERP
                      </h4>
                    </div>
                    <p className="text-xs text-stone-500">
                      Dispara push para a diretoria caso o servidor on-premise perca conexão com a nuvem.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 min-h-[44px] min-w-[44px] justify-center">
                    <input
                      type="checkbox"
                      checked={Boolean(rules.notificacoes?.offline?.habilitado)}
                      onChange={(e) =>
                        setRules((prev) => ({
                          ...prev,
                          notificacoes: {
                            ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                            offline: {
                              ...(prev.notificacoes?.offline || DEFAULT_NOTIFICACOES_CONFIG.offline),
                              habilitado: e.target.checked,
                            },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[4px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
                  </label>
                </div>

                {rules.notificacoes?.offline?.habilitado && (
                  <div className="pt-3 border-t border-stone-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Tolerância de Inatividade */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-700">
                          Tolerância sem Heartbeat (minutos):
                        </label>
                        <select
                          value={rules.notificacoes?.offline?.tempoToleranciaMinutos || 3}
                          onChange={(e) =>
                            setRules((prev) => ({
                              ...prev,
                              notificacoes: {
                                ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                                offline: {
                                  ...(prev.notificacoes?.offline || DEFAULT_NOTIFICACOES_CONFIG.offline),
                                  tempoToleranciaMinutos: Number(e.target.value),
                                },
                              },
                            }))
                          }
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-stone-800 outline-hidden focus:border-emerald-700 cursor-pointer"
                        >
                          <option value={1}>1 minuto (Imediato)</option>
                          <option value={2}>2 minutos (Recomendado)</option>
                          <option value={3}>3 minutos (Padrão)</option>
                          <option value={5}>5 minutos (Tolerante)</option>
                          <option value={10}>10 minutos (Alta tolerância)</option>
                        </select>
                        <span className="text-[11px] text-stone-400">
                          Evita falsos alertas em reinicializações rápidas do roteador.
                        </span>
                      </div>

                      {/* Notificar Reconexão */}
                      <div className="flex flex-col justify-center space-y-2">
                        <label className="text-xs font-semibold text-stone-700">
                          Avisar quando restabelecer:
                        </label>
                        <label className="flex items-center space-x-2.5 min-h-[44px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rules.notificacoes?.offline?.notificarReconexao !== false}
                            onChange={(e) =>
                              setRules((prev) => ({
                                ...prev,
                                notificacoes: {
                                  ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                                  offline: {
                                    ...(prev.notificacoes?.offline || DEFAULT_NOTIFICACOES_CONFIG.offline),
                                    notificarReconexao: e.target.checked,
                                  },
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-700 cursor-pointer"
                          />
                          <span className="text-xs text-stone-700 font-medium">
                            Enviar aviso quando o ERP voltar a responder
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Preview do Alerta */}
                    <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                        Prévia da Mensagem (Push & In-App)
                      </div>
                      <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                        <span>Servidor Local Offline - {company.name}</span>
                      </div>
                      <div className="text-xs text-stone-600">
                        O servidor da empresa parou de responder há {rules.notificacoes?.offline?.tempoToleranciaMinutos || 3} min. O ERP local está inacessível.
                      </div>
                    </div>

                    {/* Botão de Disparo de Teste */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={isTestingNotif}
                        onClick={() => handleTestNotification('offline')}
                        className="min-h-[44px] px-4 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-[0.98] text-stone-800 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Bell className="w-3.5 h-3.5 text-stone-500" />
                        <span>{isTestingNotif ? 'Enviando...' : 'Testar Alerta de Queda'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 2: RESUMO EXECUTIVO DE FECHAMENTO */}
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-700" />
                      <h4 className="text-sm font-bold text-stone-900">
                        Resumo Executivo de Fechamento do Dia
                      </h4>
                    </div>
                    <p className="text-xs text-stone-500">
                      Envia o consolidado de vendas, pedidos e faturamento ao término do expediente.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 min-h-[44px] min-w-[44px] justify-center">
                    <input
                      type="checkbox"
                      checked={Boolean(rules.notificacoes?.fechamento?.habilitado)}
                      onChange={(e) =>
                        setRules((prev) => ({
                          ...prev,
                          notificacoes: {
                            ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                            fechamento: {
                              ...(prev.notificacoes?.fechamento || DEFAULT_NOTIFICACOES_CONFIG.fechamento),
                              habilitado: e.target.checked,
                            },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[4px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
                  </label>
                </div>

                {rules.notificacoes?.fechamento?.habilitado && (
                  <div className="pt-3 border-t border-stone-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Horário de Envio */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-700">
                          Horário de Disparo (Fim do Expediente):
                        </label>
                        <input
                          type="time"
                          value={rules.notificacoes?.fechamento?.horarioEnvio || '18:30'}
                          onChange={(e) =>
                            setRules((prev) => ({
                              ...prev,
                              notificacoes: {
                                ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                                fechamento: {
                                  ...(prev.notificacoes?.fechamento || DEFAULT_NOTIFICACOES_CONFIG.fechamento),
                                  horarioEnvio: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-800 outline-hidden focus:border-emerald-700 cursor-pointer"
                        />
                        <span className="text-[11px] text-stone-400">
                          Horário de Brasília (America/Sao_Paulo).
                        </span>
                      </div>

                      {/* Opções de Enriquecimento */}
                      <div className="space-y-2 pt-1">
                        <label className="flex items-center space-x-2.5 min-h-[44px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rules.notificacoes?.fechamento?.incluirComparativoOntem !== false}
                            onChange={(e) =>
                              setRules((prev) => ({
                                ...prev,
                                notificacoes: {
                                  ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                                  fechamento: {
                                    ...(prev.notificacoes?.fechamento || DEFAULT_NOTIFICACOES_CONFIG.fechamento),
                                    incluirComparativoOntem: e.target.checked,
                                  },
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-700 cursor-pointer"
                          />
                          <span className="text-xs text-stone-700 font-medium">
                            Incluir comparativo de crescimento com ontem (% vs ontem)
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Preview do Fechamento */}
                    <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                        Prévia da Mensagem (Push & In-App)
                      </div>
                      <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                        <span>Fechamento do Dia - {company.name}</span>
                      </div>
                      <div className="text-xs text-stone-600">
                        Hoje foram faturados R$ 48.950,00 em 29 vendas (+12.5% vs ontem). Toque para ver o balanço.
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={isTestingNotif}
                        onClick={() => handleTestNotification('fechamento')}
                        className="min-h-[44px] px-4 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-[0.98] text-stone-800 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Bell className="w-3.5 h-3.5 text-stone-500" />
                        <span>{isTestingNotif ? 'Enviando...' : 'Testar Resumo de Fechamento'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 3: METAS DO DIA & MARCOS DE FATURAMENTO */}
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-700" />
                      <h4 className="text-sm font-bold text-stone-900">
                        Metas de Vendas & Marcos de Faturamento
                      </h4>
                    </div>
                    <p className="text-xs text-stone-500">
                      Comemora com a equipe quando o faturamento do dia cruza marcos estratégicos (50%, 80%, 100%).
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 min-h-[44px] min-w-[44px] justify-center">
                    <input
                      type="checkbox"
                      checked={Boolean(rules.notificacoes?.metas?.habilitado)}
                      onChange={(e) =>
                        setRules((prev) => ({
                          ...prev,
                          notificacoes: {
                            ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                            metas: {
                              ...(prev.notificacoes?.metas || DEFAULT_NOTIFICACOES_CONFIG.metas),
                              habilitado: e.target.checked,
                            },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[4px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
                  </label>
                </div>

                {rules.notificacoes?.metas?.habilitado && (
                  <div className="pt-3 border-t border-stone-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Meta Diária em Reais */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-700">
                          Meta Diária de Faturamento (R$):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                            R$
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={rules.notificacoes?.metas?.valorMetaDiaria || 30000}
                            onChange={(e) =>
                              setRules((prev) => ({
                                ...prev,
                                notificacoes: {
                                  ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                                  metas: {
                                    ...(prev.notificacoes?.metas || DEFAULT_NOTIFICACOES_CONFIG.metas),
                                    valorMetaDiaria: Number(e.target.value) || 0,
                                  },
                                },
                              }))
                            }
                            className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-900 outline-hidden focus:border-emerald-700"
                          />
                        </div>
                        <span className="text-[11px] text-stone-400">
                          Valor diário base para o cálculo dos percentuais.
                        </span>
                      </div>

                      {/* Marcos de Notificação */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-700">
                          Marcos de Notificação (%):
                        </label>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {[50, 80, 100, 120].map((percent) => {
                            const currentMarcos = rules.notificacoes?.metas?.marcosPercentuais || [50, 100];
                            const isSelected = currentMarcos.includes(percent);
                            return (
                              <button
                                key={percent}
                                type="button"
                                onClick={() => {
                                  const updated = isSelected
                                    ? currentMarcos.filter((p) => p !== percent)
                                    : [...currentMarcos, percent].sort((a, b) => a - b);
                                  setRules((prev) => ({
                                    ...prev,
                                    notificacoes: {
                                      ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                                      metas: {
                                        ...(prev.notificacoes?.metas || DEFAULT_NOTIFICACOES_CONFIG.metas),
                                        marcosPercentuais: updated.length > 0 ? updated : [100],
                                      },
                                    },
                                  }));
                                }}
                                className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-emerald-700 text-white shadow-xs'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                }`}
                              >
                                {percent}%
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-[11px] text-stone-400">
                          Toque nos percentuais que devem disparar alertas.
                        </span>
                      </div>
                    </div>

                    {/* Alerta de Pedido Expressivo */}
                    <div className="pt-2 border-t border-stone-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2.5 min-h-[44px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(rules.notificacoes?.metas?.alertaPedidoExpressivo)}
                            onChange={(e) =>
                              setRules((prev) => ({
                                ...prev,
                                notificacoes: {
                                  ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                                  metas: {
                                    ...(prev.notificacoes?.metas || DEFAULT_NOTIFICACOES_CONFIG.metas),
                                    alertaPedidoExpressivo: e.target.checked,
                                  },
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-700 cursor-pointer"
                          />
                          <span className="text-xs text-stone-700 font-medium">
                            Notificar Pedidos de Alto Valor (Grande Venda)
                          </span>
                        </label>

                        {rules.notificacoes?.metas?.alertaPedidoExpressivo && (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-stone-500">Piso mínimo:</span>
                            <div className="relative w-32">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                                R$
                              </span>
                              <input
                                type="number"
                                min="500"
                                step="500"
                                value={rules.notificacoes?.metas?.valorMinimoPedidoExpressivo || 5000}
                                onChange={(e) =>
                                  setRules((prev) => ({
                                    ...prev,
                                    notificacoes: {
                                      ...(prev.notificacoes || DEFAULT_NOTIFICACOES_CONFIG),
                                      metas: {
                                        ...(prev.notificacoes?.metas || DEFAULT_NOTIFICACOES_CONFIG.metas),
                                        valorMinimoPedidoExpressivo: Number(e.target.value) || 0,
                                      },
                                    },
                                  }))
                                }
                                className="w-full min-h-[40px] pl-8 pr-2.5 rounded-lg border border-stone-200 bg-white text-xs font-bold text-stone-900 outline-hidden focus:border-emerald-700"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Preview da Meta */}
                    <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                        Prévia da Mensagem (Push & In-App)
                      </div>
                      <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                        <span>Meta do Dia Batida! (102%)</span>
                      </div>
                      <div className="text-xs text-stone-600">
                        {company.name}: R$ 30.600,00 faturados hoje (Meta: R${' '}
                        {Number(rules.notificacoes?.metas?.valorMetaDiaria || 30000).toLocaleString('pt-BR')}
                        ).
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={isTestingNotif}
                        onClick={() => handleTestNotification('meta')}
                        className="min-h-[44px] px-4 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-[0.98] text-stone-800 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Bell className="w-3.5 h-3.5 text-stone-500" />
                        <span>{isTestingNotif ? 'Enviando...' : 'Testar Alerta de Meta'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 2: FINANCEIRO                                              */}
          {/* ============================================================== */}
          {activeTab === 'financeiro' && (
            <div className="space-y-6">
              {/* Módulo Ativo */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#0f291e] uppercase tracking-wider">
                  Módulo Financeiro Ativo no App
                </label>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'RECEBER', label: 'Apenas Receber' },
                    { id: 'PAGAR', label: 'Apenas Pagar' },
                    { id: 'AMBOS', label: 'Ambos (Pagar & Receber)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setRules((prev) => ({
                          ...prev,
                          financeiro: { ...prev.financeiro, moduloAtivo: opt.id as any },
                        }))
                      }
                      className={`py-3 px-2 rounded-xl text-xs font-semibold border min-h-[44px] transition-all active:scale-95 ${
                        rules.financeiro?.moduloAtivo === opt.id
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-sm'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipos de Documentos Considerados */}
              <div className="space-y-2 pt-4 border-t border-stone-100">
                <label className="text-xs font-bold text-[#0f291e] uppercase tracking-wider">
                  Tipos de Documento Considerados (Tabela FLAN)
                </label>
                <p className="text-xs text-stone-500">
                  Selecione quais tipos de lançamento financeiro entrarão no cálculo:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { code: 'DP', label: 'Duplicata (DP)' },
                    { code: 'BO', label: 'Boleto (BO)' },
                    { code: 'CH', label: 'Cheque (CH)' },
                    { code: 'AD', label: 'Adiantamento (AD)' },
                    { code: 'CT', label: 'Cartão (CT)' },
                    { code: 'DN', label: 'Dinheiro (DN)' },
                  ].map((doc) => {
                    const isChecked = (rules.financeiro?.tiposDocumento || []).includes(doc.code);
                    return (
                      <label
                        key={doc.code}
                        className={`flex items-center space-x-2.5 p-3 rounded-xl border text-xs cursor-pointer min-h-[44px] transition-all active:scale-95 ${
                          isChecked
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-semibold'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTipoDoc(doc.code)}
                          className="rounded text-emerald-700 focus:ring-emerald-600"
                        />
                        <span>{doc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Excluir Previsões */}
              <div className="pt-4 border-t border-stone-100">
                <label className="flex items-start space-x-3 p-4 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer min-h-[48px]">
                  <input
                    type="checkbox"
                    checked={rules.financeiro?.ignorarPrevisoes ?? true}
                    onChange={(e) =>
                      setRules((prev) => ({
                        ...prev,
                        financeiro: { ...prev.financeiro, ignorarPrevisoes: e.target.checked },
                      }))
                    }
                    className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      Ignorar Títulos de Previsão (CODTDO = 'PRE')
                    </span>
                    <span className="text-[11px] text-stone-500 block mt-0.5">
                      Evita inflar o contas a pagar com lançamentos orçamentários previstos que ainda não são obrigações reais.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 3: PERMISSÕES POR CARGO                                    */}
          {/* ============================================================== */}
          {activeTab === 'permissoes' && (
            <div className="space-y-4">
              <p className="text-xs text-stone-500">
                Defina o que os usuários de cada cargo podem visualizar no app móvel e consultar no Copilot:
              </p>

              <div className="overflow-x-auto border border-stone-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-700 font-bold">
                    <tr>
                      <th className="p-3.5">Módulo / Permissão</th>
                      <th className="p-3.5 text-center">Diretor / Dono</th>
                      <th className="p-3.5 text-center">Gerente</th>
                      <th className="p-3.5 text-center">Vendedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-800">
                    <tr>
                      <td className="p-3.5 font-medium">Ver Faturamento Total da Loja</td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={rules.roles_permissions?.diretor?.ver_faturamento_total ?? true}
                          disabled
                          className="rounded text-emerald-700"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={rules.roles_permissions?.gerente?.ver_faturamento_total ?? true}
                          onChange={(e) =>
                            setRules((prev) => ({
                              ...prev,
                              roles_permissions: {
                                ...prev.roles_permissions,
                                gerente: { ...prev.roles_permissions.gerente, ver_faturamento_total: e.target.checked },
                              },
                            }))
                          }
                          className="rounded text-emerald-700"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={rules.roles_permissions?.vendedor?.ver_faturamento_total ?? false}
                          onChange={(e) =>
                            setRules((prev) => ({
                              ...prev,
                              roles_permissions: {
                                ...prev.roles_permissions,
                                vendedor: { ...prev.roles_permissions.vendedor, ver_faturamento_total: e.target.checked },
                              },
                            }))
                          }
                          className="rounded text-emerald-700"
                        />
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3.5 font-medium">Ver Ranking de Vendedores</td>
                      <td className="p-3.5 text-center">
                        <input type="checkbox" checked disabled className="rounded text-emerald-700" />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={rules.roles_permissions?.gerente?.ver_ranking ?? true}
                          onChange={(e) =>
                            setRules((prev) => ({
                              ...prev,
                              roles_permissions: {
                                ...prev.roles_permissions,
                                gerente: { ...prev.roles_permissions.gerente, ver_ranking: e.target.checked },
                              },
                            }))
                          }
                          className="rounded text-emerald-700"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={rules.roles_permissions?.vendedor?.ver_ranking ?? false}
                          onChange={(e) =>
                            setRules((prev) => ({
                              ...prev,
                              roles_permissions: {
                                ...prev.roles_permissions,
                                vendedor: { ...prev.roles_permissions.vendedor, ver_ranking: e.target.checked },
                              },
                            }))
                          }
                          className="rounded text-emerald-700"
                        />
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3.5 font-medium">Ver Contas a Receber (Inadimplência)</td>
                      <td className="p-3.5 text-center">
                        <input type="checkbox" checked disabled className="rounded text-emerald-700" />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={rules.roles_permissions?.gerente?.ver_financeiro_receber ?? true}
                          onChange={(e) =>
                            setRules((prev) => ({
                              ...prev,
                              roles_permissions: {
                                ...prev.roles_permissions,
                                gerente: { ...prev.roles_permissions.gerente, ver_financeiro_receber: e.target.checked },
                              },
                            }))
                          }
                          className="rounded text-emerald-700"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={rules.roles_permissions?.vendedor?.ver_financeiro_receber ?? false}
                          disabled
                          className="rounded text-stone-300"
                        />
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3.5 font-medium">Ver Contas a Pagar (Despesas/Fornecedores)</td>
                      <td className="p-3.5 text-center">
                        <input type="checkbox" checked disabled className="rounded text-emerald-700" />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={rules.roles_permissions?.gerente?.ver_financeiro_pagar ?? false}
                          onChange={(e) =>
                            setRules((prev) => ({
                              ...prev,
                              roles_permissions: {
                                ...prev.roles_permissions,
                                gerente: { ...prev.roles_permissions.gerente, ver_financeiro_pagar: e.target.checked },
                              },
                            }))
                          }
                          className="rounded text-emerald-700"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={rules.roles_permissions?.vendedor?.ver_financeiro_pagar ?? false}
                          disabled
                          className="rounded text-stone-300"
                        />
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3.5 font-medium">Escopo do Copilot IA</td>
                      <td className="p-3.5 text-center font-semibold text-emerald-800">Total</td>
                      <td className="p-3.5 text-center font-semibold text-emerald-800">Loja</td>
                      <td className="p-3.5 text-center font-semibold text-stone-600">Individual (CODVEN1)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA: COPILOT IA & RATE LIMITING                                */}
          {/* ============================================================== */}
          {activeTab === 'copilot' && (
            <div className="space-y-6">
              {/* Card 1: Proteção e Rate Limiting da IA */}
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                        <Gauge className="w-4 h-4 text-emerald-800" />
                      </div>
                      <h4 className="text-sm font-bold text-[#0f291e]">
                        Rate Limiting do Voron Copilot
                      </h4>
                    </div>
                    <p className="text-xs text-stone-500 max-w-xl">
                      Controla a cadência máxima de perguntas para proteger o banco de dados Firebird da loja física contra sobrecargas e controlar o consumo de tokens do Gemini.
                    </p>
                  </div>

                  {/* Toggle Switch Ergonômico (Apple HIG / M3) */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="text-xs font-semibold text-stone-600">
                      {rules.copilot?.rateLimitEnabled !== false ? 'Proteção Ativada' : 'Sem Limite (Livre)'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rules.copilot?.rateLimitEnabled !== false}
                      onClick={handleToggleRateLimit}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-700/20 active:scale-95 ${
                        rules.copilot?.rateLimitEnabled !== false ? 'bg-emerald-800' : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          rules.copilot?.rateLimitEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Bloco de Configuração de Limite por Minuto */}
                <div
                  className={`transition-all duration-200 ${
                    rules.copilot?.rateLimitEnabled !== false ? 'opacity-100' : 'opacity-40 pointer-events-none'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#0f291e] uppercase tracking-wider">
                        Limite de Mensagens por Minuto / Empresa
                      </label>
                      <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-900/10">
                        <span>{rules.copilot?.rateLimitPerMinute || 20}</span>
                        <span className="font-normal text-[11px] text-emerald-700">req/min</span>
                      </div>
                    </div>

                    {/* Presets Rápidos Ergonômicos (Touch Target >= 44px) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {[10, 15, 20, 30, 60, 100].map((preset) => {
                        const isSelected = (rules.copilot?.rateLimitPerMinute || 20) === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleSetRateLimitPerMinute(preset)}
                            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                              isSelected
                                ? 'bg-emerald-800 text-white shadow-xs'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200/80 hover:text-stone-900'
                            }`}
                          >
                            {preset} req/min
                          </button>
                        );
                      })}

                      {/* Ajuste Fino (+ / -) */}
                      <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-xl ml-auto">
                        <button
                          type="button"
                          onClick={() => handleSetRateLimitPerMinute((rules.copilot?.rateLimitPerMinute || 20) - 5)}
                          className="w-9 h-9 rounded-lg bg-white shadow-2xs hover:bg-stone-50 text-stone-700 font-bold active:scale-95 transition-all flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
                          title="Diminuir 5"
                        >
                          -5
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={300}
                          value={rules.copilot?.rateLimitPerMinute || 20}
                          onChange={(e) => handleSetRateLimitPerMinute(Number(e.target.value) || 20)}
                          className="w-14 text-center text-xs font-bold text-stone-800 bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSetRateLimitPerMinute((rules.copilot?.rateLimitPerMinute || 20) + 5)}
                          className="w-9 h-9 rounded-lg bg-white shadow-2xs hover:bg-stone-50 text-stone-700 font-bold active:scale-95 transition-all flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
                          title="Aumentar 5"
                        >
                          +5
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-500">
                      Recomendado: <strong>20 req/min</strong> para uso executivo regular. O servidor bloqueia rajadas acima desta cota com HTTP 429 e orienta o usuário a aguardar alguns instantes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Personalização de Resposta e Sugestões */}
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-5">
                <div className="space-y-1 border-b border-stone-100 pb-3">
                  <h4 className="text-sm font-bold text-[#0f291e]">
                    Estilo de Resposta do Copilot
                  </h4>
                  <p className="text-xs text-stone-500">
                    Defina como a IA deve responder às solicitações dos gestores no app móvel.
                  </p>
                </div>

                {/* Segmented Control de Tom de Resposta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSetTomResposta('bluf')}
                    className={`p-4 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer min-h-[44px] ${
                      rules.copilot?.tomResposta !== 'detalhado'
                        ? 'border-emerald-700 bg-emerald-50/50 text-[#0f291e] shadow-2xs'
                        : 'border-stone-200 hover:border-stone-300 text-stone-600 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold">BLUF (Bottom Line Up Front)</span>
                      {rules.copilot?.tomResposta !== 'detalhado' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      Respostas diretas e números imediatos logo na primeira linha. Ideal para tomadas de decisão rápidas na rotina da loja.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetTomResposta('detalhado')}
                    className={`p-4 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer min-h-[44px] ${
                      rules.copilot?.tomResposta === 'detalhado'
                        ? 'border-emerald-700 bg-emerald-50/50 text-[#0f291e] shadow-2xs'
                        : 'border-stone-200 hover:border-stone-300 text-stone-600 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold">Detalhado & Analítico</span>
                      {rules.copilot?.tomResposta === 'detalhado' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      Explicações complementares, detalhamento de dados e orientações analíticas contextualizadas.
                    </p>
                  </button>
                </div>

                {/* Perguntas Sugeridas */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0f291e] uppercase tracking-wider">
                      Atalhos Rápidos de Perguntas Sugeridas
                    </label>
                    <span className="text-[11px] text-stone-500">
                      {(rules.copilot?.sugestoesPerguntas || []).length} atalhos ativos
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSuggestionInput}
                      onChange={(e) => setNewSuggestionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSuggestion();
                        }
                      }}
                      placeholder="Ex: Qual o vendedor líder desta semana?"
                      className="flex-1 text-xs border border-stone-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={handleAddSuggestion}
                      className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold active:scale-95 transition-all min-h-[44px] flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {(rules.copilot?.sugestoesPerguntas || []).map((sug, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 text-stone-700 border border-stone-200/80 rounded-xl text-xs font-medium"
                      >
                        <span>{sug}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSuggestion(idx)}
                          className="text-stone-400 hover:text-rose-600 transition-colors p-0.5 rounded cursor-pointer"
                          title="Remover pergunta"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA: USUÁRIOS E ACESSOS DA EMPRESA                             */}
          {/* ============================================================== */}
          {activeTab === 'usuarios' && (
            <div className="space-y-6">
              {/* Card Código de Ativação da Loja */}
              <div className="bg-gradient-to-r from-emerald-50 to-stone-50 border border-emerald-900/15 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-emerald-800" />
                    <h4 className="text-xs font-bold text-[#0f291e]">Código de Ativação da Loja</h4>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    O lojista ou colaborador pode digitar esta chave no primeiro acesso caso ainda não tenha o e-mail pré-cadastrado.
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <div className="font-mono text-sm font-black bg-white px-3 py-1.5 rounded-xl border border-emerald-900/20 text-emerald-950 tracking-wider shadow-2xs">
                    {company.activationCode || 'PILOTO-001'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyActivationCode}
                    className="inline-flex items-center space-x-1 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all min-h-[44px] cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Formulário: Pré-cadastrar Novo Usuário */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-[#0f291e] flex items-center space-x-1.5">
                      <UserPlus className="w-4 h-4 text-emerald-800" />
                      <span>Pré-autorizar Novo Usuário (Acesso Imediato)</span>
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Ao cadastrar o e-mail aqui, quando o cliente criar a conta no App ele entrará diretamente nesta empresa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadUsersAndInvites}
                    disabled={isLoadingUsers}
                    className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Atualizar lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {inviteError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                {inviteSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{inviteSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleCreateInvite} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[11px] font-bold text-stone-700">E-mail do Colaborador</label>
                    <input
                      type="email"
                      value={newInviteEmail}
                      onChange={(e) => setNewInviteEmail(e.target.value)}
                      placeholder="vendas@sualoja.com"
                      required
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0f3928] focus:bg-white min-h-[44px]"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-bold text-stone-700">Cargo / Papel</label>
                    <select
                      value={newInviteRole}
                      onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0f3928] focus:bg-white min-h-[44px]"
                    >
                      <option value="diretor">Diretor (Visão Total)</option>
                      <option value="gerente">Gerente (Visão Loja)</option>
                      <option value="vendedor">Vendedor (Individual)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[11px] font-bold text-stone-700">Vendedor no Firebird (ERP)</label>
                    <select
                      value={newInviteVendedorId}
                      onChange={(e) => setNewInviteVendedorId(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0f3928] focus:bg-white min-h-[44px]"
                    >
                      <option value="">Não vincular a vendedor específico</option>
                      {erpVendedores.map((v) => (
                        <option key={v.codven} value={v.codven}>
                          {v.codven} - {v.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-12 flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isCreatingInvite || !newInviteEmail.trim()}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold active:scale-95 transition-all min-h-[44px] cursor-pointer disabled:opacity-50"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{isCreatingInvite ? 'Registrando...' : 'Pré-autorizar Usuário'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabela de Usuários Ativos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#0f291e] flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-emerald-800" />
                    <span>Usuários Ativos nesta Empresa ({users.length})</span>
                  </h4>
                </div>

                <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  {users.length === 0 ? (
                    <div className="p-8 text-center text-xs text-stone-500">
                      Nenhum usuário com conta criada associado a esta empresa no momento.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-50/80 border-b border-stone-200/80 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Nome / E-mail</th>
                            <th className="py-3 px-4">Cargo Atual</th>
                            <th className="py-3 px-4">Vendedor Firebird</th>
                            <th className="py-3 px-4 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {users.map((u) => (
                            <tr key={u.id} className="hover:bg-stone-50/50">
                              <td className="py-3 px-4">
                                <div className="font-bold text-stone-900">{u.fullName || 'Sem nome'}</div>
                                <div className="text-[11px] text-stone-500 font-mono">{u.email || u.id.slice(0, 8)}</div>
                              </td>
                              <td className="py-3 px-4">
                                <select
                                  value={u.role}
                                  onChange={(e) => handleUpdateUserRole(u.id, e.target.value as UserRole, u.erpVendedorId || undefined)}
                                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold bg-white text-stone-800 focus:ring-1 focus:ring-emerald-700"
                                >
                                  <option value="diretor">Diretor</option>
                                  <option value="gerente">Gerente</option>
                                  <option value="vendedor">Vendedor</option>
                                </select>
                              </td>
                              <td className="py-3 px-4 text-[11px] text-stone-600 font-mono">
                                {u.erpVendedorId ? (
                                  <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200/60 font-semibold">
                                    Cód: {u.erpVendedorId}
                                  </span>
                                ) : (
                                  <span className="text-stone-400">Não vinculado</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-100/70 text-emerald-900">
                                  Ativo
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabela de Convites Pendentes */}
              {invites.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center space-x-1.5">
                    <Mail className="w-4 h-4 text-amber-700" />
                    <span>Pré-cadastros Pendentes de Primeiro Acesso ({invites.length})</span>
                  </h4>
                  <div className="border border-amber-200/70 bg-amber-50/20 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-amber-100/40 border-b border-amber-200/60 text-amber-900 font-semibold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">E-mail Convidado</th>
                          <th className="py-2.5 px-4">Cargo Pré-definido</th>
                          <th className="py-2.5 px-4">Vendedor Firebird</th>
                          <th className="py-2.5 px-4 text-right">Cancelar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100/60">
                        {invites.map((inv) => (
                          <tr key={inv.id} className="hover:bg-amber-50/50">
                            <td className="py-3 px-4 font-mono font-medium text-stone-800">{inv.email}</td>
                            <td className="py-3 px-4 capitalize font-semibold text-stone-700">{inv.role}</td>
                            <td className="py-3 px-4 text-[11px] text-stone-600 font-mono">
                              {inv.erpVendedorId || '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteInvite(inv.id)}
                                className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors min-h-[36px] min-w-[36px] inline-flex items-center justify-center cursor-pointer"
                                title="Remover convite"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 4: TOKENS DO AGENTE LOCAL                                  */}
          {/* ============================================================== */}
          {activeTab === 'tokens' && (
            <div className="space-y-6">
              <div className="bg-emerald-50/70 border border-emerald-900/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[#0f291e] flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-800" />
                    <span>Autenticação do Agente Local</span>
                  </h4>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    Tokens de segurança utilizados pelo executável local da loja física para se conectar ao túnel em nuvem.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadTokens}
                  disabled={isLoadingTokens}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50 active:scale-95 transition-all min-h-[44px] shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTokens ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              {tokenError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{tokenError}</span>
                </div>
              )}

              {/* Lista de Tokens Ativos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0f291e] uppercase tracking-wider">
                    Tokens Cadastrados ({tokens.length})
                  </label>
                  <span className="text-[11px] text-stone-500 font-medium">
                    1 token por computador/instância do agente
                  </span>
                </div>

                {tokens.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-stone-200 bg-stone-50 text-center text-xs text-stone-500">
                    <KeyRound className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-semibold text-stone-700">Nenhum token encontrado</p>
                    <p className="mt-1">Gere um token abaixo para vincular um novo agente local a esta empresa.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {tokens.map((tok) => {
                      const isRevealed = !!showTokenMap[tok.id];
                      const isCopied = !!copiedMap[tok.id];

                      return (
                        <div
                          key={tok.id}
                          className="p-4 rounded-2xl border border-stone-200/90 bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-700/30 transition-all"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-stone-900">{tok.name || 'Agente Local'}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  tok.isActive
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-600/20'
                                    : 'bg-stone-100 text-stone-500 border-stone-200'
                                }`}
                              >
                                {tok.isActive ? 'Ativo' : 'Revogado'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="inline-flex items-center gap-1.5 bg-stone-100/80 border border-stone-200/70 pl-2.5 pr-1 py-1 rounded-xl font-mono text-xs text-stone-800">
                                <span className="truncate max-w-[200px] sm:max-w-xs font-semibold select-all">
                                  {isRevealed ? tok.token : `${tok.token.slice(0, 5)}••••••••••••${tok.token.slice(-4)}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleShowToken(tok.id)}
                                  className="w-9 h-9 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                                  title={isRevealed ? 'Ocultar token' : 'Revelar token'}
                                  aria-label={isRevealed ? 'Ocultar token' : 'Revelar token'}
                                >
                                  {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCopyToken(tok.id, tok.token)}
                                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 active:scale-95 transition-all shadow-2xs cursor-pointer min-h-[44px]"
                                title="Copiar token para a área de transferência"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-4 h-4 text-emerald-600" />
                                    <span className="text-emerald-700">Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 text-stone-500" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="text-[11px] text-stone-400">
                              Criado em: {new Date(tok.createdAt).toLocaleDateString('pt-BR')}
                              {tok.lastSeenAt && ` • Último acesso: ${new Date(tok.lastSeenAt).toLocaleString('pt-BR')}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Formulário para Gerar Novo Token */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span>Gerar Novo Token para Esta Empresa</span>
                </h4>
                <p className="text-[11px] text-stone-500">
                  Cria uma nova credencial criptografada caso queira configurar outro terminal ou rotacionar o token atual.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Nome/identificador do agente (ex: Servidor Caixa 2)"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={handleCreateToken}
                    disabled={isGeneratingToken}
                    className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 active:scale-95 transition-all min-h-[44px] disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isGeneratingToken ? 'Gerando...' : 'Gerar Token'}</span>
                  </button>
                </div>
              </div>

              {/* Guia de Configuração Rápida */}
              <div className="border border-stone-200 bg-stone-50/60 rounded-2xl p-4 text-xs text-stone-600 space-y-2">
                <h5 className="font-bold text-stone-800 flex items-center gap-1.5">
                  <span>ℹ️ Como utilizar este token no cliente:</span>
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-stone-600 leading-relaxed">
                  <li>Copie o token gerado acima.</li>
                  <li>No computador com o Firebird, abra o arquivo <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-stone-200">.env</code> do agente (ou o executável de configuração).</li>
                  <li>Insira a variável: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-stone-200 text-emerald-800 font-bold">AGENT_TOKEN=seu_token_aqui</code></li>
                  <li>Inicie o agente. A conexão será estabelecida e o status mudará para <span className="font-bold text-emerald-700">Online</span> imediatamente.</li>
                </ol>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 5: DIAGNÓSTICO                                             */}
          {/* ============================================================== */}
          {activeTab === 'diagnostico' && (
            <div className="space-y-4">
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0f291e]">Teste de Comunicação Firebird 5.0</h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Envia um comando ping através do túnel reverso para o banco de dados da loja.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingDiag}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 active:scale-95 transition-all min-h-[44px] disabled:opacity-50"
                  >
                    <Activity className={`w-4 h-4 ${isTestingDiag ? 'animate-pulse' : ''}`} />
                    <span>{isTestingDiag ? 'Testando...' : 'Executar Teste'}</span>
                  </button>
                </div>

                {diagResult && (
                  <div
                    className={`mt-4 p-4 rounded-xl border text-xs flex items-start space-x-3 ${
                      diagResult.online
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {diagResult.online ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">{diagResult.message}</p>
                      {diagResult.latencyMs !== undefined && (
                        <p className="text-[11px] mt-1 opacity-80">
                          Tempo de resposta total: <strong>{diagResult.latencyMs} ms</strong>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Botão Salvar */}
        <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between bg-stone-50/80 backdrop-blur-md">
          <div>
            {saveSuccess && (
              <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Configurações salvas no Supabase com sucesso!</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-100 active:scale-95 transition-all min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 active:scale-[0.98] transition-all min-h-[44px] shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
