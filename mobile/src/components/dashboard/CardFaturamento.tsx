import React from 'react';
import { ArrowUp, ArrowDown, CheckCircle2, ChevronRight, Target } from 'lucide-react';
import { DashboardPeriod } from '@ai-db/shared';

export interface CardFaturamentoProps {
  revenue: number;
  salesCount: number;
  period: DashboardPeriod;
  periodLabel: string;
  comparisonSuffix: string;
  growthVsYesterdayPercent?: number;
  revenueYesterday?: number;
  isPrivacyMode: boolean;
  isPeriodLoading?: boolean;
  dailyGoal?: number;
  dailyGoalEnabled?: boolean;
  onClick?: () => void;
}

export const CardFaturamento: React.FC<CardFaturamentoProps> = ({
  revenue,
  salesCount,
  period,
  periodLabel,
  comparisonSuffix,
  growthVsYesterdayPercent = 0,
  revenueYesterday = 0,
  isPrivacyMode,
  isPeriodLoading = false,
  dailyGoal,
  dailyGoalEnabled = true,
  onClick,
}) => {
  const handleClick = () => {
    if (onClick) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(6);
      }
      onClick();
    }
  };

  // Termômetro da Meta de Vendas Diária (Monitorado pelo notificationScheduler)
  const isDailyPeriod = period === 'dia' || period === 'ontem';
  const hasDailyGoal = Boolean(dailyGoal && dailyGoal > 0 && dailyGoalEnabled !== false && isDailyPeriod);

  const goalValue = dailyGoal || 0;
  const percent = hasDailyGoal && goalValue > 0 ? (revenue / goalValue) * 100 : 0;
  const roundedPercent = Math.round(percent);
  const progressWidth = Math.min(Math.max(percent, 0), 100);
  const isGoalReached = revenue >= goalValue;
  const remaining = goalValue - revenue;
  const exceeded = revenue - goalValue;

  const formatMoney = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••••';
    return `R$ ${val.toLocaleString('pt-BR', {
      minimumFractionDigits: val % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const goalStatusText = isGoalReached
    ? exceeded > 0
      ? `Superada em ${formatMoney(exceeded)}`
      : 'Meta batida!'
    : `Faltam ${formatMoney(remaining)}`;

  return (
    <section
      onClick={handleClick}
      className={`w-full bg-gradient-to-b from-[#ffffff] to-[#f7f9f6] border border-emerald-900/10 rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all group ${
        onClick
          ? 'cursor-pointer hover:border-emerald-900/25 active:scale-[0.99] select-none'
          : ''
      }`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? 'Ver lista detalhada de pedidos faturados' : undefined}
    >
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-3.5 bg-emerald-700 rounded-full shrink-0" />
          <span className="text-[11px] uppercase font-bold tracking-wider text-[#40584c] truncate">
            Faturamento Total
          </span>
        </div>
        <div className={`transition-opacity duration-150 shrink-0 ${isPeriodLoading ? 'opacity-40' : 'opacity-100'}`}>
          {period === 'total' ? (
            <span className="inline-flex items-center gap-1 text-stone-600 bg-stone-100 border border-stone-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight shrink-0">
              Consolidado histórico
            </span>
          ) : salesCount > 0 || revenueYesterday > 0 ? (
            (() => {
              const growth = growthVsYesterdayPercent;
              const isPositive = growth >= 0;
              const formattedGrowth = Math.abs(growth).toLocaleString('pt-BR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              });

              return isPositive ? (
                <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-600/20 px-2.5 py-0.5 rounded-full text-[12px] font-semibold tracking-tight shrink-0">
                  <ArrowUp className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                  +{formattedGrowth}% {comparisonSuffix}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 border border-rose-600/20 px-2.5 py-0.5 rounded-full text-[12px] font-semibold tracking-tight shrink-0">
                  <ArrowDown className="w-3.5 h-3.5 text-rose-700 stroke-[2.5]" />
                  -{formattedGrowth}% {comparisonSuffix}
                </span>
              );
            })()
          ) : (
            <span className="inline-flex items-center gap-1 text-stone-600 bg-stone-100 border border-stone-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight shrink-0">
              Sem vendas
            </span>
          )}
        </div>
      </div>

      <div className={`py-1 transition-opacity duration-150 ${isPeriodLoading ? 'opacity-40' : 'opacity-100'}`}>
        {isPrivacyMode ? (
          <div className="text-[32px] font-bold tracking-tight text-[#072418] leading-tight font-mono">
            R$ ••••••••
          </div>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[20px] font-semibold text-emerald-800/80 select-none">
              R$
            </span>
            <h1 className="text-[32px] font-bold tracking-tight text-[#072418] leading-tight font-mono">
              {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
          </div>
        )}
      </div>

      {/* Termômetro Visual da Meta de Vendas (Apple HIG & Google Material Design 3) */}
      {hasDailyGoal && (
        <div
          className={`mt-2.5 pt-2.5 border-t border-emerald-900/5 transition-opacity duration-150 ${
            isPeriodLoading ? 'opacity-40' : 'opacity-100'
          }`}
        >
          {/* Cabeçalho da Meta com status contextual e meta de referência */}
          <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <Target
                className={`w-3.5 h-3.5 shrink-0 ${
                  isGoalReached ? 'text-emerald-700' : 'text-emerald-800'
                }`}
              />
              <span className="font-semibold text-[#072418] text-[12px] tracking-tight">
                {roundedPercent}% da meta atingida
              </span>
              <span className="text-stone-300 select-none">•</span>
              <span
                className={`text-[12px] tracking-tight ${
                  isGoalReached ? 'font-semibold text-emerald-800' : 'font-medium text-stone-600'
                }`}
              >
                {goalStatusText}
              </span>
            </div>
            <span className="text-[11px] font-medium text-stone-500 shrink-0 select-none">
              Meta: {isPrivacyMode ? '••••••' : formatMoney(goalValue)}
            </span>
          </div>

          {/* Barra do Termômetro */}
          <div
            className="relative w-full h-2.5 bg-stone-200/70 rounded-full overflow-hidden p-0.5 shadow-inner"
            role="progressbar"
            aria-valuenow={roundedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da meta de vendas"
          >
            {/* Marcadores discretos dos marcos de alerta (50% e 80% monitorados pelo scheduler) */}
            <div
              className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-white/70 z-10 pointer-events-none"
              title="Marco de 50%"
            />
            <div
              className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-white/70 z-10 pointer-events-none"
              title="Marco de 80%"
            />

            {/* Preenchimento Dinâmico com Gradiente de Alta Fidelidade */}
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out relative ${
                isGoalReached
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 shadow-xs'
                  : percent >= 80
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
                  : 'bg-gradient-to-r from-emerald-700 to-emerald-500'
              }`}
              style={{ width: `${progressWidth}%` }}
            >
              {/* Brilho Superior Suave (Apple HIG / Glass depth) */}
              <div className="absolute inset-x-0 top-0 h-[35%] bg-white/30 rounded-full pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      <div className="pt-3 mt-1 flex items-center justify-between border-t border-emerald-900/5 text-stone-600">
        <div className="flex items-center gap-1.5 min-w-0">
          <CheckCircle2 className={`w-4 h-4 stroke-[2] shrink-0 ${salesCount > 0 ? 'text-emerald-700' : 'text-stone-400'}`} />
          <p className={`text-[12px] font-medium text-[#2d4237] leading-tight transition-opacity duration-150 ${isPeriodLoading ? 'opacity-40' : 'opacity-100'}`}>
            {salesCount > 0
              ? `${salesCount.toLocaleString('pt-BR')} ${salesCount === 1 ? 'pedido concluído' : 'pedidos concluídos'}`
              : 'Nenhum pedido faturado'}
          </p>
        </div>

        {onClick && salesCount > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 group-hover:text-emerald-950 transition-colors shrink-0">
            <span>Ver detalhes</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}
      </div>
    </section>
  );
};
