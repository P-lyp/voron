import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Calendar,
} from 'lucide-react';
import {
  DashboardDetailType,
  DashboardPeriod,
  DashboardDetailsResponseDTO,
  DashboardOrderItemDTO,
  DashboardFinancialItemDTO,
} from '@ai-db/shared';
import { fetchDashboardDetails } from '../../services/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';

interface DashboardDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialType: DashboardDetailType;
  period: DashboardPeriod;
  customStartDate?: string;
  customEndDate?: string;
  periodLabel: string;
  isPrivacyMode: boolean;
  companyId?: string;
}

export const DashboardDetailSheet: React.FC<DashboardDetailSheetProps> = ({
  isOpen,
  onClose,
  initialType,
  period,
  customStartDate,
  customEndDate,
  periodLabel,
  isPrivacyMode,
  companyId = 'empresa-piloto-001',
}) => {
  const [activeType, setActiveType] = useState<DashboardDetailType>(initialType);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardDetailsResponseDTO | null>(null);

  // Input ref para foco ergonômico
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Disparo de haptic feedback suave
  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(6);
    }
  };

  // Sincroniza tipo inicial ao abrir o sheet
  useEffect(() => {
    if (isOpen) {
      setActiveType(initialType);
      setSearchTerm('');
      setStatusFilter('TODOS');
      setError(null);
    }
  }, [isOpen, initialType]);

  // Carrega os detalhes via API sob demanda
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const loadDetails = async () => {
      try {
        const res = await fetchDashboardDetails(
          companyId,
          activeType,
          period,
          customStartDate,
          customEndDate,
          undefined,
          activeType === 'orcamentos' ? statusFilter : undefined
        );
        if (isMounted) {
          setData(res);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Erro ao carregar detalhes do card:', err);
          setError(err.message || 'Falha ao buscar os detalhes.');
          setIsLoading(false);
        }
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeType, period, customStartDate, customEndDate, statusFilter, companyId]);

  // Bloqueio de rolagem do body quando o sheet estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Itens filtrados pela busca local instantânea
  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    if (!searchTerm.trim()) return data.orders;

    const term = searchTerm.toLowerCase().trim();
    return data.orders.filter((order) => {
      const matchClient = order.nomeCliente.toLowerCase().includes(term);
      const matchNumero = order.numeroMov.toLowerCase().includes(term);
      const matchVendedor = order.vendedor ? order.vendedor.toLowerCase().includes(term) : false;
      return matchClient || matchNumero || matchVendedor;
    });
  }, [data?.orders, searchTerm]);

  const filteredFinancial = useMemo(() => {
    if (!data?.financial) return [];
    if (!searchTerm.trim()) return data.financial;

    const term = searchTerm.toLowerCase().trim();
    return data.financial.filter((item) => {
      const matchClient = item.nomeCfo.toLowerCase().includes(term);
      const matchId = String(item.idLan).includes(term);
      return matchClient || matchId;
    });
  }, [data?.financial, searchTerm]);

  // Cálculo dinâmico do total dos itens filtrados
  const filteredTotalValue = useMemo(() => {
    if (activeType === 'faturamento' || activeType === 'orcamentos') {
      return filteredOrders.reduce((acc, curr) => acc + curr.valorLiquido, 0);
    }
    return filteredFinancial.reduce((acc, curr) => acc + curr.valorAberto, 0);
  }, [activeType, filteredOrders, filteredFinancial]);

  if (!isOpen) return null;

  // Informações de tema por tipo
  const isFinancial = activeType === 'receber' || activeType === 'pagar';

  const getHeaderInfo = () => {
    switch (activeType) {
      case 'faturamento':
        return {
          title: 'Pedidos Faturados',
          subtitle: `Relação de vendas concluídas • ${periodLabel}`,
          icon: TrendingUp,
          iconBg: 'bg-emerald-50 border-emerald-600/20 text-emerald-800',
        };
      case 'orcamentos':
        return {
          title: 'Orçamentos & Cotações',
          subtitle: `Propostas e pipeline comercial • ${periodLabel}`,
          icon: FileText,
          iconBg: 'bg-amber-50 border-amber-600/20 text-amber-800',
        };
      case 'receber':
        return {
          title: 'Contas a Receber',
          subtitle: `Títulos a receber pendentes • ${periodLabel}`,
          icon: ArrowDownLeft,
          iconBg: 'bg-emerald-50 border-emerald-600/20 text-emerald-800',
        };
      case 'pagar':
        return {
          title: 'Contas a Pagar',
          subtitle: `Compromissos financeiros a pagar • ${periodLabel}`,
          icon: ArrowUpRight,
          iconBg: 'bg-amber-50 border-amber-600/20 text-amber-900',
        };
    }
  };

  const headerInfo = getHeaderInfo();
  const HeaderIcon = headerInfo.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-sheet-title"
    >
      <div
        className="w-full sm:max-w-xl md:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl border border-stone-200/90 shadow-2xl flex flex-col h-[90vh] sm:h-[85vh] animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-300/80" />
        </div>

        {/* 1. Header do Sheet (Frosted Surface / Apple HIG) */}
        <div className="px-5 pt-2 pb-3.5 flex items-center justify-between border-b border-stone-100 shrink-0 bg-white/95 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${headerInfo.iconBg}`}>
              <HeaderIcon className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <h2 id="detail-sheet-title" className="text-[17px] font-bold text-stone-900 leading-tight truncate">
                {headerInfo.title}
              </h2>
              <p className="text-[11px] text-stone-500 font-medium truncate mt-0.5">
                {headerInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Botão Fechar com touch target de 44x44px rigoroso */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onClose();
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer shrink-0"
            aria-label="Fechar detalhes"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* 2. Barra de Segmentos (Tabs) para Financeiro ou Orçamentos */}
        {isFinancial && (
          <div className="px-5 pt-3 pb-1 shrink-0 bg-stone-50/50 border-b border-stone-100">
            <div className="flex p-1 bg-stone-200/60 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setActiveType('receber');
                }}
                className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeType === 'receber'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-700 stroke-[2.2]" />
                <span>A Receber</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setActiveType('pagar');
                }}
                className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeType === 'pagar'
                    ? 'bg-white text-amber-950 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-amber-700 stroke-[2.2]" />
                <span>A Pagar</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Filtros Rápidos de Status para Orçamentos */}
        {activeType === 'orcamentos' && (
          <div className="px-5 pt-2.5 pb-2 shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-stone-100 bg-stone-50/40">
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'ABERTOS', label: 'Em Aberto' },
              { id: 'FATURADOS', label: 'Convertidos' },
              { id: 'PARCIAIS', label: 'Parciais' },
            ].map((f) => {
              const isSelected = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setStatusFilter(f.id);
                  }}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? 'bg-[#0f3928] text-white shadow-xs font-bold'
                      : 'bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

        {/* 4. Barra de Busca Instantânea com padding proporcional anti-colisão (pr-11) */}
        <div className="px-5 py-3 border-b border-stone-100 shrink-0 bg-white">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                isFinancial
                  ? 'Buscar por fornecedor, cliente ou código...'
                  : 'Buscar por cliente, nº do pedido ou vendedor...'
              }
              className="w-full min-h-[44px] pl-10 pr-11 py-2 text-xs sm:text-sm bg-stone-100/80 hover:bg-stone-100 focus:bg-white border border-stone-200/80 focus:border-emerald-700/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700/10 transition-all text-stone-800 placeholder-stone-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-1 w-11 h-11 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 active:scale-95 transition-all cursor-pointer"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4 stroke-[2]" />
              </button>
            )}
          </div>
        </div>

        {/* 5. Barra Informativa de Totais & Contagem */}
        <div className="px-5 py-2.5 bg-stone-50/70 border-b border-stone-100 flex items-center justify-between text-xs shrink-0 select-none">
          <span className="text-stone-500 font-medium">
            {isLoading ? (
              <span className="inline-block w-24 h-3.5 bg-stone-200 rounded-sm animate-pulse" />
            ) : (
              `${
                activeType === 'faturamento' || activeType === 'orcamentos'
                  ? filteredOrders.length
                  : filteredFinancial.length
              } ${
                activeType === 'faturamento'
                  ? filteredOrders.length === 1 ? 'pedido listado' : 'pedidos listados'
                  : activeType === 'orcamentos'
                  ? filteredOrders.length === 1 ? 'cotação listada' : 'cotações listadas'
                  : filteredFinancial.length === 1 ? 'título listado' : 'títulos listados'
              }`
            )}
          </span>

          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-stone-400">Total:</span>
            {isLoading ? (
              <span className="inline-block w-20 h-4 bg-stone-200 rounded-sm animate-pulse" />
            ) : (
              <strong className="font-bold text-stone-900 font-mono text-[13px]">
                {formatCurrency(filteredTotalValue, isPrivacyMode)}
              </strong>
            )}
          </div>
        </div>

        {/* 6. Conteúdo com Rolagem Fluida & Skeletons */}
        <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-stone-100 no-scrollbar">
          {isLoading ? (
            /* Skeleton Refinado Pulsante (Apple HIG & M3) */
            <div className="space-y-4 py-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center justify-between py-2.5 animate-pulse">
                  <div className="space-y-2 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-3 bg-stone-200 rounded-md" />
                      <div className="w-20 h-3 bg-stone-100 rounded-md" />
                    </div>
                    <div className="w-48 h-4 bg-stone-200/80 rounded-md" />
                    <div className="w-32 h-3 bg-stone-100 rounded-md" />
                  </div>
                  <div className="space-y-1.5 text-right shrink-0">
                    <div className="w-24 h-5 bg-stone-200 rounded-md ml-auto" />
                    <div className="w-16 h-3 bg-stone-100 rounded-md ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            /* Estado de Erro */
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-sm font-bold text-stone-900 mb-1">
                Não foi possível carregar os detalhes
              </h3>
              <p className="text-xs text-stone-500 max-w-xs leading-relaxed mb-4">
                {error}
              </p>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setIsLoading(true);
                  setError(null);
                  fetchDashboardDetails(
                    companyId,
                    activeType,
                    period,
                    customStartDate,
                    customEndDate,
                    undefined,
                    activeType === 'orcamentos' ? statusFilter : undefined
                  )
                    .then((res) => {
                      setData(res);
                      setIsLoading(false);
                    })
                    .catch((err) => {
                      setError(err.message || 'Falha ao buscar os detalhes.');
                      setIsLoading(false);
                    });
                }}
                className="min-h-[44px] px-5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                Tentar novamente
              </button>
            </div>
          ) : (activeType === 'faturamento' || activeType === 'orcamentos') ? (
            /* Lista de Pedidos / Orçamentos */
            filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const isConverted = order.statusPedido === 'A';
                const isPartial = order.statusPedido === 'P';

                return (
                  <div key={order.idMov} className="py-3.5 flex items-start justify-between gap-3 group">
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: Número e Badges sutis */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[12px] font-mono font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                          #{order.numeroMov || order.idMov}
                        </span>

                        {activeType === 'orcamentos' && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isConverted
                                ? 'bg-emerald-50 text-emerald-800'
                                : isPartial
                                ? 'bg-sky-50 text-sky-800'
                                : 'bg-amber-50 text-amber-900'
                            }`}
                          >
                            {order.descricaoStatusPedido || (isConverted ? 'Convertido' : 'Em Aberto')}
                          </span>
                        )}

                        {order.dataEmissao && (
                          <span className="text-[11px] text-stone-400 font-medium">
                            {formatDate(order.dataEmissao)}
                          </span>
                        )}
                      </div>

                      {/* Linha 2: Nome do Cliente com hierarquia limpa (Anti Box-in-a-Box) */}
                      <h4 className="text-[13px] sm:text-[14px] font-bold text-[#102419] leading-snug truncate">
                        {order.nomeCliente}
                      </h4>

                      {/* Linha 3: Vendedor ou tipo de movimento */}
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500 truncate">
                        {order.vendedor && (
                          <span>Vendedor: {order.vendedor}</span>
                        )}
                        {order.tipoMovimento && (
                          <>
                            <span className="text-stone-300">•</span>
                            <span className="truncate">{order.tipoMovimento}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Valor Monetário em Destaque Alinhado à Direita */}
                    <div className="text-right shrink-0 pt-0.5">
                      <span className="text-[14px] sm:text-[15px] font-bold font-mono text-[#09291b] leading-tight block">
                        {formatCurrency(order.valorLiquido, isPrivacyMode)}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-semibold text-stone-800 mb-1">
                  Nenhum registro encontrado
                </h3>
                <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                  {searchTerm
                    ? `Nenhum pedido corresponde à busca "${searchTerm}".`
                    : `Não há movimentações para o período de ${periodLabel.toLowerCase()}.`}
                </p>
              </div>
            )
          ) : (
            /* Lista do Ciclo Financeiro (A Receber / A Pagar) */
            filteredFinancial.length > 0 ? (
              filteredFinancial.map((item) => {
                const isReceivable = item.tipo === 'R';

                return (
                  <div key={item.idLan} className="py-3.5 flex items-start justify-between gap-3 group">
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: Vencimento & Tag */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isReceivable
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-amber-50 text-amber-900'
                          }`}
                        >
                          {isReceivable ? 'A Receber' : 'A Pagar'}
                        </span>

                        <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>Vence em {formatDate(item.dataVencimento)}</span>
                        </span>

                        <span className="text-[11px] font-mono text-stone-400">
                          #{item.idLan}
                        </span>
                      </div>

                      {/* Linha 2: Nome do Fornecedor / Cliente */}
                      <h4 className="text-[13px] sm:text-[14px] font-bold text-[#12261b] leading-snug truncate">
                        {item.nomeCfo}
                      </h4>
                    </div>

                    {/* Valor Monetário */}
                    <div className="text-right shrink-0 pt-0.5">
                      <span
                        className={`text-[14px] sm:text-[15px] font-bold font-mono leading-tight block ${
                          isReceivable ? 'text-emerald-950' : 'text-amber-950'
                        }`}
                      >
                        {formatCurrency(item.valorAberto, isPrivacyMode)}
                      </span>
                      {item.valorOriginal !== item.valorAberto && (
                        <span className="text-[10px] text-stone-400 font-mono block mt-0.5">
                          Orig: {formatCurrency(item.valorOriginal, isPrivacyMode)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-semibold text-stone-800 mb-1">
                  Nenhum título encontrado
                </h3>
                <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                  {searchTerm
                    ? `Nenhum título corresponde à busca "${searchTerm}".`
                    : `Não constam títulos pendentes para o período de ${periodLabel.toLowerCase()}.`}
                </p>
              </div>
            )
          )}
        </div>

        {/* 7. Footer com Botão de Fechar Contextual */}
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/70 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onClose();
            }}
            className="w-full min-h-[46px] rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};
