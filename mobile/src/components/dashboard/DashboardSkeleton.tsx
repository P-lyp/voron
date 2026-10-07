import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col w-full pb-6 space-y-4 animate-pulse">
      {/* 1. Barra de Período Skeleton */}
      <section className="flex items-center justify-between gap-1.5 pt-0.5 pb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="inline-flex items-center p-1 rounded-full bg-stone-200/60 border border-emerald-950/5 h-[44px]">
            <div className="w-16 h-8 rounded-full bg-stone-300/60 mr-1" />
            <div className="w-16 h-8 rounded-full bg-stone-200/80 mr-1" />
            <div className="w-14 h-8 rounded-full bg-stone-200/80" />
          </div>
          <div className="w-11 h-11 rounded-full bg-stone-200/60 shrink-0" />
        </div>
        <div className="w-20 h-4 bg-stone-200/60 rounded-md" />
      </section>

      {/* 2. Card Faturamento Skeleton */}
      <section className="w-full bg-white/90 border border-emerald-900/10 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-3.5 bg-emerald-700/40 rounded-full" />
            <div className="w-28 h-3.5 bg-stone-200/80 rounded" />
          </div>
          <div className="w-24 h-5 bg-emerald-50 rounded-full" />
        </div>
        <div className="py-1">
          <div className="h-8 w-48 bg-stone-200/80 rounded-lg" />
        </div>
        <div className="pt-3 mt-1 flex items-center border-t border-stone-100">
          <div className="w-4 h-4 bg-stone-200/80 rounded-full mr-2" />
          <div className="w-36 h-3 bg-stone-200/70 rounded" />
        </div>
      </section>

      {/* 3. Card Orçamentos Skeleton */}
      <section className="w-full bg-white/90 border border-amber-900/10 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-3.5 bg-amber-600/40 rounded-full" />
            <div className="w-32 h-3.5 bg-stone-200/80 rounded" />
          </div>
          <div className="w-28 h-5 bg-amber-50 rounded-full" />
        </div>
        <div className="py-1">
          <div className="h-7 w-40 bg-stone-200/80 rounded-lg" />
        </div>
        <div className="pt-3 mt-1 flex items-center border-t border-stone-100">
          <div className="w-4 h-4 bg-stone-200/80 rounded-full mr-2" />
          <div className="w-44 h-3 bg-stone-200/70 rounded" />
        </div>
      </section>

      {/* 4. Card Ciclo Financeiro Skeleton */}
      <section className="w-full bg-white/90 border border-emerald-900/10 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-3.5 bg-emerald-700/40 rounded-full" />
            <div className="w-28 h-3.5 bg-stone-200/80 rounded" />
          </div>
          <div className="w-32 h-5 bg-stone-100 rounded-full" />
        </div>
        <div className="w-full h-1.5 rounded-full bg-stone-200/60 mb-3.5" />
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-800/5 h-20 flex flex-col justify-between">
            <div className="w-16 h-3 bg-stone-200/80 rounded" />
            <div className="w-24 h-5 bg-stone-200/90 rounded" />
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-800/5 h-20 flex flex-col justify-between">
            <div className="w-16 h-3 bg-stone-200/80 rounded" />
            <div className="w-24 h-5 bg-stone-200/90 rounded" />
          </div>
        </div>
      </section>

      {/* 5. Quiet Micro Delight Skeleton */}
      <div className="pt-2 flex justify-center">
        <div className="w-64 h-6 rounded-full bg-emerald-50/40 border border-emerald-900/5" />
      </div>
    </div>
  );
};
