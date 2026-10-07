import React from 'react';
import { ViewTransition, startTransition } from '../utils/view-transitions.js';
import { LayoutDashboard, PackageSearch, Sparkles, Users } from 'lucide-react';

export type TabType = 'dados' | 'itens' | 'clientes' | 'copilot';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  pendingApprovalsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, pendingApprovalsCount = 0 }) => {
  const tabs = [
    {
      id: 'dados' as TabType,
      label: 'Visão Geral',
      icon: LayoutDashboard,
    },
    {
      id: 'itens' as TabType,
      label: 'Itens',
      icon: PackageSearch,
    },
    {
      id: 'clientes' as TabType,
      label: 'Clientes',
      icon: Users,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      id: 'copilot' as TabType,
      label: 'Voron AI',
      icon: Sparkles,
    },
  ];

  const handleTabClick = (tabId: TabType) => {
    if (tabId === activeTab) return;
    // Resposta tátil sutil quando suportada (Apple HIG / M3)
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(8);
    }
    startTransition(() => {
      onChangeTab(tabId);
    });
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#ffffff]/90 backdrop-blur-xl border-t border-emerald-950/5 shadow-[0_-4px_16px_rgba(15,57,40,0.03)]"
    >
      <div className="max-w-md mx-auto px-2 sm:px-4 h-16 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-1.5 sm:px-2.5 min-w-[64px] sm:min-w-[72px] min-h-[48px] rounded-xl transition-all active:scale-95 cursor-pointer ${
                isActive ? 'text-[#0f3928]' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              <div className="relative px-3 py-0.5 flex items-center justify-center">
                {/* Sliding Indicator (Tab Pill Morph) */}
                {isActive && (
                  <ViewTransition name="bottom-nav-active-indicator" share="tab-underline">
                    <span className="absolute inset-0 rounded-full bg-emerald-100/70 pointer-events-none" />
                  </ViewTransition>
                )}
                <Icon
                  className={`relative z-10 w-4 h-4 transition-colors ${
                    isActive ? 'stroke-[2.5] text-[#0f3928]' : 'stroke-[2] text-stone-400'
                  }`}
                />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-0.5 z-20 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-0.5 tracking-tight transition-colors ${
                  isActive ? 'font-bold text-[#0f3928]' : 'font-medium text-stone-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
