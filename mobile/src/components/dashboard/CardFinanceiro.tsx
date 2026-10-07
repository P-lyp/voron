import React from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react';
import { DashboardPeriod } from '@ai-db/shared';
import { formatCurrency } from '../../utils/formatters.js';

export interface CardFinanceiroProps {
  receivables: number;
  payables: number;
  period: DashboardPeriod;
  isPrivacyMode: boolean;
  isPeriodLoading?: boolean;
  onOpenReceber?: () => void;
  onOpenPagar?: () => void;
}

export const CardFinanceiro: React.FC<CardFinanceiroProps> = ({
  receivables,
  payables,
  period,
  isPrivacyMode,
  isPeriodLoading = false,
  onOpenReceber,
  onOpenPagar,
}) => {
  const totalFlow = receivables + payables;
  const receivablePercent = totalFlow > 0 ? Math.round((receivables / totalFlow) * 100) : 0;
  const payablePercent = totalFlow > 0 ? 100 - receivablePercent : 0;

  const getPeriodDueLabel = (isReceivable: boolean) => {
    switch (period) {
      case 'dia':
        return 'Vencendo hoje';
      case 'ontem':
        return 'Venceram ontem';
      case 'este_mes':
      case 'mes':
        return 'Vencem no mês';
      case 'semana':
        return 'Vencem na semana';
      case 'semana_passada':
        return 'Venceram na semana ant.';
      case 'mes_anterior':
        return 'Venceram no mês ant.';
      case '30d':
        return 'Vencendo em 30 dias';
      case 'ano':
        return 'Vencem no ano';
      case 'custom':
        return 'Vencem no período';
      default:
        return 'Títulos em aberto';
    }
  };

  return (
    <section className="w-full bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-emerald-700 rounded-full" />
          <span className="text-[11px] uppercase font-bold tracking-wider text-[#40584c]">
            Ciclo Financeiro
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold tracking-tight transition-all duration-150 ${
            isPeriodLoading ? 'opacity-40' : 'opacity-100'
          } ${
            totalFlow === 0
              ? 'bg-stone-50 border-stone-200 text-stone-600'
              : receivables >= payables
              ? 'bg-emerald-50 border-emerald-600/10 text-emerald-800'
              : 'bg-amber-50 border-amber-600/20 text-amber-900'
          }`}
        >
          <span>
            {totalFlow === 0
              ? 'Sem movimentações'
              : receivables >= payables
              ? 'Saldo líquido favorável'
              : 'Compromissos superam entradas'}
          </span>
        </div>
      </div>

      {/* Régua de Proporção Fluida */}
      <div className="w-full mb-3.5">
        <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden flex">
          {receivablePercent > 0 && (
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${receivablePercent}%` }}
            />
          )}
          {payablePercent > 0 && (
            <div
              className={`h-full bg-amber-600 rounded-full transition-all duration-500 ${
                receivablePercent > 0 ? 'ml-0.5' : ''
              }`}
              style={{ width: `${payablePercent}%` }}
            />
          )}
          {totalFlow === 0 && (
            <div className="h-full bg-stone-200 rounded-full w-full" />
          )}
        </div>
      </div>

      {/* 2 Pods Lado a Lado (Stitch Design) */}
      <div className={`grid grid-cols-2 gap-3 transition-opacity duration-150 ${isPeriodLoading ? 'opacity-40' : 'opacity-100'}`}>
        {/* A Receber */}
        <button
          type="button"
          onClick={() => {
            if (onOpenReceber) {
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate?.(6);
              }
              onOpenReceber();
            }
          }}
          className={`flex flex-col text-left p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-800/10 transition-all ${
            onOpenReceber
              ? 'cursor-pointer hover:bg-emerald-50 hover:border-emerald-800/25 active:scale-[0.98] group'
              : ''
          }`}
          aria-label={onOpenReceber ? 'Ver títulos a receber' : undefined}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-md bg-emerald-100/70 text-emerald-800 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900/80">
                A Receber
              </span>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800">
              {receivablePercent}%
            </span>
          </div>
          <span className="text-[16px] text-[#09291b] font-bold tracking-tight leading-snug font-mono">
            {formatCurrency(receivables, isPrivacyMode)}
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] font-medium text-emerald-800/80">
              {getPeriodDueLabel(true)}
            </span>
            {onOpenReceber && (
              <ChevronRight className="w-3.5 h-3.5 text-emerald-700/60 group-hover:text-emerald-900 group-hover:translate-x-0.5 transition-all shrink-0" />
            )}
          </div>
        </button>

        {/* A Pagar */}
        <button
          type="button"
          onClick={() => {
            if (onOpenPagar) {
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate?.(6);
              }
              onOpenPagar();
            }
          }}
          className={`flex flex-col text-left p-3.5 rounded-xl bg-amber-50/50 border border-amber-800/10 transition-all ${
            onOpenPagar
              ? 'cursor-pointer hover:bg-amber-50 hover:border-amber-800/25 active:scale-[0.98] group'
              : ''
          }`}
          aria-label={onOpenPagar ? 'Ver contas a pagar' : undefined}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-md bg-amber-100/70 text-amber-950/80 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-950/80">
                A Pagar
              </span>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100/70 text-amber-950/80">
              {payablePercent}%
            </span>
          </div>
          <span className="text-[16px] text-[#2b1f09] font-bold tracking-tight leading-snug font-mono">
            {formatCurrency(payables, isPrivacyMode)}
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] font-medium text-amber-950/80">
              {getPeriodDueLabel(false)}
            </span>
            {onOpenPagar && (
              <ChevronRight className="w-3.5 h-3.5 text-amber-800/60 group-hover:text-amber-950 group-hover:translate-x-0.5 transition-all shrink-0" />
            )}
          </div>
        </button>
      </div>
    </section>
  );
};
