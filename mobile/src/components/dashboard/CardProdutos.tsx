import React from 'react';
import { Award, ArrowRight, PackageSearch } from 'lucide-react';
import { DashboardPeriod } from '@ai-db/shared';
import { startTransition, addTransitionType } from '../../utils/view-transitions.js';
import { formatCurrency, toSentenceCase } from '../../utils/formatters.js';

export interface TopProductItem {
  name: string;
  quantity: number;
  unit?: string;
  total: number;
  percent?: number;
}

export interface CardProdutosProps {
  topProducts: TopProductItem[];
  revenue: number;
  period: DashboardPeriod;
  periodLabel: string;
  isPrivacyMode: boolean;
  isPeriodLoading?: boolean;
  onNavigateToCopilot: () => void;
  onPeriodChange: (p: DashboardPeriod) => void;
}

export const CardProdutos: React.FC<CardProdutosProps> = ({
  topProducts,
  revenue,
  period,
  periodLabel,
  isPrivacyMode,
  isPeriodLoading = false,
  onNavigateToCopilot,
  onPeriodChange,
}) => {
  return (
    <section className="w-full bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center">
            <Award className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-[#0f291e] tracking-tight">
              Principais Produtos
            </h2>
            <p className="text-[11px] font-medium text-stone-500">
              {topProducts.length > 0 ? 'Top por contribuição de faturamento' : 'Sem produtos faturados no período'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate?.(10);
            }
            startTransition(() => {
              addTransitionType('nav-forward');
              onNavigateToCopilot();
            });
          }}
          aria-label="Visualizar todos os produtos no Voron AI"
          title="Analisar produtos no Voron AI"
          className="w-11 h-11 rounded-xl flex items-center justify-center text-stone-500 hover:text-emerald-900 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
          type="button"
        >
          <ArrowRight className="w-4 h-4 stroke-[2]" />
        </button>
      </div>

      <div className={`transition-opacity duration-150 ${isPeriodLoading ? 'opacity-40' : 'opacity-100'}`}>
        {topProducts.length > 0 ? (
          <div className="divide-y divide-stone-100">
            {topProducts.map((prod, idx) => {
              const productPercentage = revenue > 0 ? Math.max(1, Math.round((prod.total / revenue) * 100)) : 0;

              return (
                <div key={prod.name} className="py-3 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-[#0f3928] text-white'
                            : 'bg-stone-100 text-stone-800'
                        }`}
                      >
                        0{idx + 1}
                      </span>
                      <span className="text-[13px] font-semibold text-[#11241a] leading-tight">
                        {toSentenceCase(prod.name)}
                      </span>
                    </div>
                    <span className="text-[13px] font-bold text-[#0b2b1c] shrink-0 font-mono">
                      {formatCurrency(prod.total, isPrivacyMode)}
                    </span>
                  </div>
                  <div className="pl-8.5 text-stone-500 text-[11px] flex items-center gap-1.5 ml-8">
                    <span>
                      {prod.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{' '}
                      {(prod.unit || 'un').toLowerCase()}
                    </span>
                    {productPercentage > 0 ? (
                      <>
                        <span className="text-stone-300">•</span>
                        <span className="text-emerald-700 font-semibold">
                          {prod.percent || productPercentage}% do faturamento
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-stone-100/90 text-stone-400 flex items-center justify-center mb-3 shadow-2xs">
              <PackageSearch className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h3 className="text-[14px] font-semibold text-stone-800 mb-1">
              Nenhuma venda no período selecionado
            </h3>
            <p className="text-[12px] text-stone-500 max-w-xs leading-relaxed">
              Não constam saídas de produtos no período de{' '}
              <strong>{periodLabel.toLowerCase()}</strong>. Alterne para a aba{' '}
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    onPeriodChange('total');
                  });
                }}
                className="text-emerald-800 font-bold underline hover:text-emerald-950 inline cursor-pointer"
              >
                Total
              </button>{' '}
              para visualizar o faturamento consolidado histórico.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
