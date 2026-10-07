import React from 'react';
import { FileText, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { DashboardPeriod } from '@ai-db/shared';
import { formatCurrency } from '../../utils/formatters.js';

export interface CardOrcamentosProps {
  quotesCount: number;
  quotesConvertedCount: number;
  quotesConvertedTotal: number;
  quotesPartialCount: number;
  quotesTotal: number;
  period: DashboardPeriod;
  periodLabel: string;
  isPrivacyMode: boolean;
  isPeriodLoading?: boolean;
  onClick?: () => void;
}

export const CardOrcamentos: React.FC<CardOrcamentosProps> = ({
  quotesCount,
  quotesConvertedCount,
  quotesConvertedTotal,
  quotesPartialCount,
  quotesTotal,
  period,
  periodLabel,
  isPrivacyMode,
  isPeriodLoading = false,
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

  const hasQuotes = quotesCount > 0 || quotesConvertedCount > 0 || quotesPartialCount > 0;

  return (
    <section
      onClick={handleClick}
      className={`w-full bg-gradient-to-b from-[#ffffff] to-[#fbfaf8] border border-amber-900/10 rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all group ${
        onClick
          ? 'cursor-pointer hover:border-amber-900/25 active:scale-[0.99] select-none'
          : ''
      }`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? 'Ver lista detalhada de orçamentos e cotações' : undefined}
    >
      <div className="absolute -right-8 -top-8 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-3.5 bg-amber-600 rounded-full shrink-0" />
          <span className="text-[11px] uppercase font-bold tracking-wider text-[#584838] truncate">
            Orçamentos & Cotações
          </span>
        </div>
        <div className={`transition-opacity duration-150 shrink-0 ${isPeriodLoading ? 'opacity-40' : 'opacity-100'}`}>
          {quotesCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-50 border border-amber-600/20 px-2.5 py-0.5 rounded-full text-[12px] font-semibold tracking-tight shrink-0">
              <FileText className="w-3.5 h-3.5 text-amber-700" />
              {quotesCount} {quotesCount === 1 ? 'proposta ativa' : 'propostas ativas'}
            </span>
          ) : quotesConvertedCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-600/20 px-2.5 py-0.5 rounded-full text-[12px] font-semibold tracking-tight shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              100% faturado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-stone-600 bg-stone-100 border border-stone-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight shrink-0">
              Sem propostas
            </span>
          )}
        </div>
      </div>

      <div className={`py-1 transition-opacity duration-150 ${isPeriodLoading ? 'opacity-40' : 'opacity-100'}`}>
        {isPrivacyMode ? (
          <div className="text-[28px] font-bold tracking-tight text-[#2d2113] leading-tight font-mono">
            R$ ••••••••
          </div>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-semibold text-amber-800/80 select-none">
              R$
            </span>
            <h2 className="text-[28px] font-bold tracking-tight text-[#2d2113] leading-tight font-mono">
              {quotesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>
        )}
      </div>

      <div className={`transition-opacity duration-150 ${isPeriodLoading ? 'opacity-40' : 'opacity-100'}`}>
        {quotesConvertedCount > 0 ? (
          <div className="pt-3 mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-amber-900/5 text-stone-600">
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 stroke-[2] shrink-0" />
              <p className="text-[12px] font-medium text-[#2d4237] leading-tight">
                <span>{quotesConvertedCount} {quotesConvertedCount === 1 ? 'orçamento faturado' : 'orçamentos faturados'}</span>
                <span className="text-stone-300 mx-1.5">•</span>
                <strong className="font-bold text-emerald-950 font-mono">
                  {formatCurrency(quotesConvertedTotal, isPrivacyMode)}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                Convertido
              </span>
              {onClick && (
                <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-900 group-hover:translate-x-0.5 transition-all" />
              )}
            </div>
          </div>
        ) : quotesPartialCount > 0 ? (
          <div className="pt-3 mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-amber-900/5 text-stone-600">
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className="w-4 h-4 text-sky-700 stroke-[2] shrink-0" />
              <p className="text-[12px] font-medium text-sky-950 leading-tight">
                {quotesPartialCount} {quotesPartialCount === 1 ? 'proposta parcial' : 'propostas parciais'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sky-50 text-sky-800">
                Parcial
              </span>
              {onClick && (
                <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-900 group-hover:translate-x-0.5 transition-all" />
              )}
            </div>
          </div>
        ) : (
          <div className="pt-3 mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-amber-900/5 text-stone-600">
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className={`w-4 h-4 stroke-[2] shrink-0 ${quotesCount > 0 ? 'text-amber-700' : 'text-stone-400'}`} />
              <p className="text-[12px] font-medium text-[#443527] leading-tight">
                {quotesCount > 0
                  ? `${quotesCount.toLocaleString('pt-BR')} cotações em negociação`
                  : 'Nenhum orçamento emitido'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${quotesCount > 0 ? 'bg-amber-100/70 text-amber-900' : 'bg-stone-100 text-stone-500'}`}>
                {quotesCount > 0 ? 'Pipeline Aberto' : 'Sem propostas'}
              </span>
              {onClick && hasQuotes && (
                <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-900 group-hover:translate-x-0.5 transition-all" />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
