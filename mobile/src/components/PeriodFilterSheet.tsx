import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, Clock, ChevronRight } from 'lucide-react';
import { DashboardPeriod } from '@ai-db/shared';
import { toISODate } from '../utils/dateUtils.js';

interface PeriodFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentPeriod: DashboardPeriod;
  customStartDate?: string;
  customEndDate?: string;
  onSelectPeriod: (period: DashboardPeriod, customStart?: string, customEnd?: string) => void;
}

interface PresetOption {
  id: DashboardPeriod;
  title: string;
  subtitle: string;
  badge?: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  { id: 'dia', title: 'Hoje', subtitle: 'Vendas e movimentações de hoje em tempo real', badge: 'Ao vivo' },
  { id: 'ontem', title: 'Ontem', subtitle: 'Fechamento consolidado do dia anterior' },
  { id: 'semana', title: 'Últimos 7 Dias', subtitle: 'Desempenho dos últimos 7 dias até hoje' },
  { id: 'semana_passada', title: 'Semana Anterior', subtitle: 'Segunda a domingo da semana fechada' },
  { id: 'este_mes', title: 'Este Mês', subtitle: 'Do dia 1º até hoje (Mês corrente)', badge: 'Meta MTD' },
  { id: 'mes_anterior', title: 'Mês Anterior', subtitle: 'Fechamento contábil do mês passado completo' },
  { id: '30d', title: 'Últimos 30 Dias', subtitle: 'Janela móvel dos últimos 30 dias corridos' },
  { id: 'ano', title: 'Este Ano', subtitle: 'Consolidado acumulado do ano corrente' },
  { id: 'total', title: 'Consolidado Histórico', subtitle: 'Todas as movimentações registradas na base' },
];

export const PeriodFilterSheet: React.FC<PeriodFilterSheetProps> = ({
  isOpen,
  onClose,
  currentPeriod,
  customStartDate = '',
  customEndDate = '',
  onSelectPeriod,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [startDate, setStartDate] = useState(customStartDate);
  const [endDate, setEndDate] = useState(customEndDate);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const todayStr = toISODate(new Date());
      setStartDate(customStartDate || todayStr);
      setEndDate(customEndDate || todayStr);
      setDateError(null);
      if (currentPeriod === 'custom') {
        setActiveTab('custom');
      } else {
        setActiveTab('presets');
      }
    }
  }, [isOpen, currentPeriod, customStartDate, customEndDate]);

  if (!isOpen) return null;

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(6);
    }
  };

  const handleSelectPreset = (periodId: DashboardPeriod) => {
    triggerHaptic();
    onSelectPeriod(periodId);
    onClose();
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setDateError('Por favor, informe a data inicial e a data final.');
      return;
    }
    if (startDate > endDate) {
      setDateError('A data inicial não pode ser posterior à data final.');
      return;
    }
    setDateError(null);
    triggerHaptic();
    onSelectPeriod('custom', startDate, endDate);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/50 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="period-sheet-title"
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl border border-stone-200/80 shadow-2xl flex flex-col max-h-[85vh] animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle (Mobile Indicator) */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full bg-stone-300/80" />
        </div>

        {/* Header do Sheet */}
        <div className="px-5 pt-2 pb-3.5 flex items-center justify-between border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-600/10">
              <Calendar className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 id="period-sheet-title" className="text-base font-bold text-stone-900 leading-tight">
                Filtrar Período
              </h2>
              <p className="text-[11px] text-stone-500 font-medium">
                Selecione o intervalo de dados para a Visão Geral
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onClose();
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
            aria-label="Fechar modal de período"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Abas de Navegação (Presets vs Personalizado) */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex p-1 bg-stone-100/90 rounded-xl border border-stone-200/60">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setActiveTab('presets');
              }}
              className={`flex-1 min-h-[44px] rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'presets'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Opções Rápidas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setActiveTab('custom');
              }}
              className={`flex-1 min-h-[44px] rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'custom'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Personalizado</span>
            </button>
          </div>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2 no-scrollbar">
          {activeTab === 'presets' ? (
            <div className="space-y-1.5 pb-4">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = currentPeriod === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectPreset(opt.id)}
                    className={`w-full min-h-[52px] p-3 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-600/30 shadow-2xs'
                        : 'bg-white border-stone-200/50 hover:border-emerald-600/20 hover:bg-stone-50/60'
                    }`}
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[13px] font-bold ${
                            isSelected ? 'text-emerald-950 font-black' : 'text-stone-800'
                          }`}
                        >
                          {opt.title}
                        </span>
                        {opt.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-500 font-normal leading-tight mt-0.5">
                        {opt.subtitle}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center justify-center w-7 h-7">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-[#0f3928] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-stone-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleApplyCustom} className="space-y-4 py-2 pb-6">
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70 space-y-3">
                <div className="space-y-1">
                  <label htmlFor="custom-start-date" className="block text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    Data Inicial (De)
                  </label>
                  <input
                    id="custom-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateError(null);
                    }}
                    className="w-full min-h-[48px] px-3.5 rounded-xl bg-white border border-stone-300/80 text-sm font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="custom-end-date" className="block text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    Data Final (Até)
                  </label>
                  <input
                    id="custom-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateError(null);
                    }}
                    className="w-full min-h-[48px] px-3.5 rounded-xl bg-white border border-stone-300/80 text-sm font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    required
                  />
                </div>
              </div>

              {dateError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {dateError}
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-[#0f3928] hover:bg-[#154a35] text-white text-sm font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Aplicar Período Personalizado</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
