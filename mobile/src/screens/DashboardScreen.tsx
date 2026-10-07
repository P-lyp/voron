import React, { useState, useMemo } from 'react';
import { ViewTransition, startTransition } from '../utils/view-transitions.js';
import {
  DashboardOverviewDTO,
  DashboardPeriod,
  DashboardDetailType,
  DEFAULT_DASHBOARD_CARDS,
  UserRole,
} from '@ai-db/shared';
import {
  AlertCircle,
  Sliders,
  SlidersHorizontal,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { PeriodFilterSheet } from '../components/PeriodFilterSheet.js';
import {
  getPeriodDisplayLabel,
  getComparisonLabel,
  getPeriodShortDateBadge,
} from '../utils/dateUtils.js';
import {
  CardFaturamento,
  CardOrcamentos,
  CardFinanceiro,
  CardProdutos,
  DashboardSkeleton,
  DashboardDetailSheet,
} from '../components/dashboard/index.js';

interface DashboardScreenProps {
  data: DashboardOverviewDTO | null;
  isLoading: boolean;
  isPeriodLoading?: boolean;
  isPrivacyMode: boolean;
  period: DashboardPeriod;
  customStartDate?: string;
  customEndDate?: string;
  onPeriodChange: (p: DashboardPeriod, customStart?: string, customEnd?: string) => void;
  onNavigateToCopilot: () => void;
  userRole?: UserRole;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  data,
  isLoading,
  isPeriodLoading = false,
  isPrivacyMode,
  period,
  customStartDate,
  customEndDate,
  onPeriodChange,
  onNavigateToCopilot,
  userRole = 'diretor',
}) => {
  const [isPeriodSheetOpen, setIsPeriodSheetOpen] = useState(false);
  const [detailSheetType, setDetailSheetType] = useState<DashboardDetailType | null>(null);

  // Configuração modular e ordenada dos cards por empresa (Hoisted Hooks para cumprir rigorosamente as Rules of Hooks)
  const cardsConfig = data?.cardsConfig || DEFAULT_DASHBOARD_CARDS;
  const sortedCards = useMemo(() => {
    return [...cardsConfig].sort((a, b) => a.ordem - b.ordem);
  }, [cardsConfig]);

  const activeCardsForRole = useMemo(() => {
    return sortedCards.filter((card) => {
      if (!card.ativo) return false;
      if (userRole === 'admin') return true;
      const roleKey = (userRole || 'diretor') as 'diretor' | 'gerente' | 'vendedor';
      return card.roles?.[roleKey] ?? true;
    });
  }, [sortedCards, userRole]);

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  const isServerOffline = Boolean(data && !data.isOnline);

  // Vinculação aos dados do backend/ERP
  const hasValidData = data !== null;
  const revenue = hasValidData && data.revenueToday !== undefined ? Number(data.revenueToday) : 0;
  const salesCount = hasValidData && data.salesCountToday !== undefined ? Number(data.salesCountToday) : 0;
  const quotesTotal = hasValidData && data.quotesTotalToday !== undefined ? Number(data.quotesTotalToday) : 0;
  const quotesCount = hasValidData && data.quotesCountToday !== undefined ? Number(data.quotesCountToday) : 0;
  const quotesConvertedCount = hasValidData && data.quotesConvertedCountToday !== undefined ? Number(data.quotesConvertedCountToday) : 0;
  const quotesConvertedTotal = hasValidData && data.quotesConvertedTotalToday !== undefined ? Number(data.quotesConvertedTotalToday) : 0;
  const quotesPartialCount = hasValidData && data.quotesPartialCountToday !== undefined ? Number(data.quotesPartialCountToday) : 0;
  const receivables = hasValidData && data.receivablesToday !== undefined ? Number(data.receivablesToday) : 0;
  const payables = hasValidData && data.payablesToday !== undefined ? Number(data.payablesToday) : 0;
  const dailyGoal = hasValidData && data.dailyGoal !== undefined ? Number(data.dailyGoal) : 0;
  const dailyGoalEnabled = hasValidData && data.dailyGoalEnabled !== undefined ? Boolean(data.dailyGoalEnabled) : true;
  const topProductsList = data?.topProducts || [];

  const periodLabel = getPeriodDisplayLabel(period, customStartDate, customEndDate);
  const comparisonSuffix = getComparisonLabel(period);
  const shortDateBadge = getPeriodShortDateBadge(period, customStartDate, customEndDate);

  return (
    <div className="flex flex-col w-full pb-6 space-y-4">
      {/* Alerta de Servidor Offline com animação enter/exit */}
      {isServerOffline && (
        <ViewTransition enter="slide-down" exit="fade-out" default="none">
          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 flex items-start space-x-3 text-rose-900 shadow-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
            <div className="text-xs leading-relaxed">
              <strong className="block text-xs font-bold text-rose-950 mb-0.5">
                Servidor da Loja Offline
              </strong>
              O computador com o Firebird não está respondendo. Verifique se o agente local está ligado no servidor.
            </div>
          </div>
        </ViewTransition>
      )}

      {/* 1. Barra de Período Limpa & Minimalista (Apple HIG / M3) */}
      {(() => {
        const isSecondary = !['dia', 'ontem', 'este_mes', 'mes'].includes(period);

        return (
          <section className="flex items-center justify-between gap-1.5 pt-0.5 pb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Segmented Control dos 3 Períodos Principais com altura ergonômica mínima de 44px (Apple HIG & M3) */}
              <div className="inline-flex items-center p-1 rounded-full bg-stone-200/50 border border-emerald-950/5 shadow-2xs">
                {/* Hoje */}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                      navigator.vibrate?.(6);
                    }
                    startTransition(() => {
                      onPeriodChange('dia');
                    });
                  }}
                  className={`relative min-h-[44px] px-3 sm:px-4 rounded-full text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                    period === 'dia'
                      ? 'font-bold text-white shadow-xs'
                      : 'font-medium text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {period === 'dia' && (
                    <ViewTransition name="dashboard-period-indicator" share="tab-underline">
                      <span className="absolute inset-0 rounded-full bg-[#0f3928] pointer-events-none" />
                    </ViewTransition>
                  )}
                  <span className="relative z-10">Hoje</span>
                </button>

                {/* Ontem */}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                      navigator.vibrate?.(6);
                    }
                    startTransition(() => {
                      onPeriodChange('ontem');
                    });
                  }}
                  className={`relative min-h-[44px] px-3 sm:px-4 rounded-full text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                    period === 'ontem'
                      ? 'font-bold text-white shadow-xs'
                      : 'font-medium text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {period === 'ontem' && (
                    <ViewTransition name="dashboard-period-indicator" share="tab-underline">
                      <span className="absolute inset-0 rounded-full bg-[#0f3928] pointer-events-none" />
                    </ViewTransition>
                  )}
                  <span className="relative z-10">Ontem</span>
                </button>

                {/* Este Mês */}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                      navigator.vibrate?.(6);
                    }
                    startTransition(() => {
                      onPeriodChange('este_mes');
                    });
                  }}
                  className={`relative min-h-[44px] px-3 sm:px-4 rounded-full text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                    period === 'este_mes' || period === 'mes'
                      ? 'font-bold text-white shadow-xs'
                      : 'font-medium text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {(period === 'este_mes' || period === 'mes') && (
                    <ViewTransition name="dashboard-period-indicator" share="tab-underline">
                      <span className="absolute inset-0 rounded-full bg-[#0f3928] pointer-events-none" />
                    </ViewTransition>
                  )}
                  <span className="relative z-10">Mês</span>
                </button>
              </div>

              {/* Botão de Mais Filtros / Calendário Personalizado (Área de Toque Ergonômica de 44px) */}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                    navigator.vibrate?.(6);
                  }
                  setIsPeriodSheetOpen(true);
                }}
                className={`inline-flex items-center justify-center min-h-[44px] rounded-full transition-all active:scale-95 cursor-pointer border ${
                  isSecondary
                    ? 'px-3 gap-1.5 bg-[#0f3928] text-white border-[#0f3928] shadow-xs text-xs font-bold shrink-0'
                    : 'w-11 h-11 bg-stone-200/50 hover:bg-stone-200/80 text-stone-600 border-emerald-950/5 shadow-2xs shrink-0'
                }`}
                title="Mais períodos e calendário personalizado"
                aria-label="Mais opções de período"
              >
                {isSecondary ? (
                  <>
                    <span className="truncate max-w-[95px]">{periodLabel}</span>
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  </>
                ) : (
                  <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
                )}
              </button>
            </div>

            {/* Lado Direito: Data Informativa Pura ou Aviso de Offline (omite data duplicada se o botão customizado já a exibe) */}
            <div className="flex items-center shrink-0 pr-0.5 select-none">
              {isServerOffline ? (
                <div className="inline-flex items-center gap-1.5 text-rose-700 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
                  <span>Sem conexão</span>
                </div>
              ) : !isSecondary ? (
                <div className="inline-flex items-center gap-1 text-stone-400">
                  <Calendar className="w-3.5 h-3.5 text-stone-400/80 shrink-0 stroke-[1.8]" />
                  <span className="text-[12px] font-medium text-stone-500 tracking-tight">
                    {shortDateBadge}
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        );
      })()}

      {/* 2. Renderização Modular dos Cards */}
      {activeCardsForRole.length > 0 ? (
        activeCardsForRole.map((card) => {
          switch (card.id) {
            case 'faturamento':
              return (
                <CardFaturamento
                  key="faturamento"
                  revenue={revenue}
                  salesCount={salesCount}
                  period={period}
                  periodLabel={periodLabel}
                  comparisonSuffix={comparisonSuffix}
                  growthVsYesterdayPercent={data?.growthVsYesterdayPercent}
                  revenueYesterday={data?.revenueYesterday}
                  isPrivacyMode={isPrivacyMode}
                  isPeriodLoading={isPeriodLoading}
                  dailyGoal={dailyGoal}
                  dailyGoalEnabled={dailyGoalEnabled}
                  onClick={() => setDetailSheetType('faturamento')}
                />
              );
            case 'orcamentos':
              return (
                <CardOrcamentos
                  key="orcamentos"
                  quotesCount={quotesCount}
                  quotesConvertedCount={quotesConvertedCount}
                  quotesConvertedTotal={quotesConvertedTotal}
                  quotesPartialCount={quotesPartialCount}
                  quotesTotal={quotesTotal}
                  period={period}
                  periodLabel={periodLabel}
                  isPrivacyMode={isPrivacyMode}
                  isPeriodLoading={isPeriodLoading}
                  onClick={() => setDetailSheetType('orcamentos')}
                />
              );
            case 'financeiro':
              return (
                <CardFinanceiro
                  key="financeiro"
                  receivables={receivables}
                  payables={payables}
                  period={period}
                  isPrivacyMode={isPrivacyMode}
                  isPeriodLoading={isPeriodLoading}
                  onOpenReceber={() => setDetailSheetType('receber')}
                  onOpenPagar={() => setDetailSheetType('pagar')}
                />
              );
            case 'produtos':
              return (
                <CardProdutos
                  key="produtos"
                  topProducts={topProductsList}
                  revenue={revenue}
                  period={period}
                  periodLabel={periodLabel}
                  isPrivacyMode={isPrivacyMode}
                  isPeriodLoading={isPeriodLoading}
                  onNavigateToCopilot={onNavigateToCopilot}
                  onPeriodChange={onPeriodChange}
                />
              );
            default:
              return null;
          }
        })
      ) : (
        <div className="bg-white border border-stone-200/90 rounded-2xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <Sliders className="w-6 h-6 stroke-[1.75]" />
          </div>
          <h3 className="text-[14px] font-semibold text-stone-800">
            Nenhum card configurado para exibição
          </h3>
          <p className="text-[12px] text-stone-500 max-w-xs mx-auto leading-relaxed">
            Os módulos da Visão Geral foram desativados para esta empresa ou o seu cargo ({userRole}) não possui permissão para visualizá-los.
          </p>
        </div>
      )}

      {/* 3. Quiet Micro Delight: Layout Displacement Morph no Footer */}
      <ViewTransition>
        <footer className="pt-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/60 border border-emerald-900/10 text-emerald-900 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <p className="text-[11px] font-medium text-[#2d4d3e]">
              Operação rodando com estabilidade e margem saudável.
            </p>
          </div>
        </footer>
      </ViewTransition>

      {/* Modal / Bottom Sheet de Período Completo e Personalizado */}
      <PeriodFilterSheet
        isOpen={isPeriodSheetOpen}
        onClose={() => setIsPeriodSheetOpen(false)}
        currentPeriod={period}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onSelectPeriod={(newPeriod, customStart, customEnd) => {
          startTransition(() => {
            onPeriodChange(newPeriod, customStart, customEnd);
          });
        }}
      />

      {/* Drawer / Bottom Sheet de Detalhamento dos Cards (Drill-Down) */}
      {detailSheetType && (
        <DashboardDetailSheet
          isOpen={Boolean(detailSheetType)}
          onClose={() => setDetailSheetType(null)}
          initialType={detailSheetType}
          period={period}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          periodLabel={periodLabel}
          isPrivacyMode={isPrivacyMode}
        />
      )}
    </div>
  );
};
