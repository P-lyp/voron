import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { ViewTransition, startTransition, addTransitionType } from './utils/view-transitions.js';
import { Header } from './components/Header.js';
import { BottomNav, TabType } from './components/BottomNav.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { ItemsScreen } from './screens/ItemsScreen.js';
import { CustomersScreen } from './screens/CustomersScreen.js';
import { CopilotScreen } from './screens/CopilotScreen.js';
import { fetchDashboardOverview, fetchCustomerRegistrations, fetchNotifications } from './services/api.js';
import { DashboardOverviewDTO, DashboardPeriod } from '@ai-db/shared';
import { useAuth } from './context/useAuth.js';
import { VoronLogo } from './components/VoronLogo.js';

// Lazy-loaded heavy and route-conditional screens (Vercel Best Practice: bundle-dynamic-imports)
const CustomerRegistrationScreen = lazy(() =>
  import('./screens/CustomerRegistrationScreen.js').then((m) => ({ default: m.CustomerRegistrationScreen }))
);
const AdminDashboard = lazy(() =>
  import('./screens/admin/AdminDashboard.js').then((m) => ({ default: m.AdminDashboard }))
);
const AdminLoginScreen = lazy(() =>
  import('./screens/admin/AdminLoginScreen.js').then((m) => ({ default: m.AdminLoginScreen }))
);
const AuthScreen = lazy(() =>
  import('./screens/AuthScreen.js').then((m) => ({ default: m.AuthScreen }))
);
const ClaimCompanyScreen = lazy(() =>
  import('./screens/ClaimCompanyScreen.js').then((m) => ({ default: m.ClaimCompanyScreen }))
);
const ProfileDrawer = lazy(() =>
  import('./components/ProfileDrawer.js').then((m) => ({ default: m.ProfileDrawer }))
);
const NotificationsDrawer = lazy(() =>
  import('./components/NotificationsDrawer.js').then((m) => ({ default: m.NotificationsDrawer }))
);
const CompanySuspendedScreen = lazy(() =>
  import('./screens/CompanySuspendedScreen.js').then((m) => ({ default: m.CompanySuspendedScreen }))
);

export const App: React.FC = () => {
  const { user, profile, company, isLoading: authLoading, isAdmin, hasCompany, refreshProfile } = useAuth();

  const [isAdminMode, setIsAdminMode] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  });

  const [isCustomerRegPath, setIsCustomerRegPath] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/cadastro');
  });

  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Monitora contagem de notificações não lidas
  useEffect(() => {
    if (user && hasCompany) {
      fetchNotifications()
        .then((items) => {
          const unread = items.filter((n) => !n.lida).length;
          setUnreadNotificationsCount(unread);
        })
        .catch(() => {});
    }
  }, [user, hasCompany]);

  // Estados de Suspensão / Bloqueio de Acesso
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);
  const [suspendedActiveUntil, setSuspendedActiveUntil] = useState<string | null>(null);

  const customerRegSlug = typeof window !== 'undefined' && window.location.pathname.startsWith('/cadastro')
    ? window.location.pathname.replace(/^\/cadastro\/?/, '').replace(/\/+$/, '').split('?')[0].split('#')[0].trim() || 'empresa-piloto-001'
    : 'empresa-piloto-001';

  const [activeTab, setActiveTab] = useState<TabType>('dados');
  const [dashboardData, setDashboardData] = useState<DashboardOverviewDTO | null>(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('companyId');
      if (fromUrl) return fromUrl;
      const fromStorage = localStorage.getItem('ai_db_selected_company');
      if (fromStorage) return fromStorage;
    }
    return 'empresa-piloto-001';
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPeriodLoading, setIsPeriodLoading] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>('dia');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Determina o ID da empresa de forma determinística
  const effectiveCompanyId = (!isAdmin && company?.slug) ? company.slug : (company?.slug || selectedCompanyId);

  // Atualiza empresa selecionada quando a empresa do usuário for carregada
  useEffect(() => {
    if (company?.slug) {
      setSelectedCompanyId(company.slug);
      localStorage.setItem('ai_db_selected_company', company.slug);
    }
  }, [company]);

  const loadData = useCallback(async (
    isManualRefresh: boolean = false,
    targetPeriod: DashboardPeriod = period,
    targetStart: string = customStartDate,
    targetEnd: string = customEndDate,
    isPeriodSwitch: boolean = false
  ) => {
    if (isManualRefresh) setIsRefreshing(true);
    if (isPeriodSwitch) setIsPeriodLoading(true);
    try {
      const data = await fetchDashboardOverview(
        effectiveCompanyId,
        targetPeriod,
        targetPeriod === 'custom' ? targetStart : undefined,
        targetPeriod === 'custom' ? targetEnd : undefined
      );
      setDashboardData(data);
      setIsSuspended(false);
      setSuspensionReason(null);
    } catch (err: any) {
      if (err.code === 'COMPANY_SUSPENDED') {
        setIsSuspended(true);
        setSuspensionReason(err.message || 'Acesso suspenso. Entre em contato com o suporte.');
        if (err.company?.activeUntil) {
          setSuspendedActiveUntil(err.company.activeUntil);
        }
      } else {
        console.error('Erro ao buscar dados do dashboard:', err);
      }
    } finally {
      setIsLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
      if (isPeriodSwitch) setIsPeriodLoading(false);
    }
  }, [period, customStartDate, customEndDate, effectiveCompanyId]);

  const handlePeriodChange = (
    newPeriod: DashboardPeriod,
    customStart?: string,
    customEnd?: string
  ) => {
    setPeriod(newPeriod);
    const start = customStart ?? customStartDate;
    const end = customEnd ?? customEndDate;
    if (customStart !== undefined) setCustomStartDate(customStart);
    if (customEnd !== undefined) setCustomEndDate(customEnd);
    loadData(false, newPeriod, start, end, true);
  };

  const TAB_ORDER: TabType[] = ['dados', 'itens', 'clientes', 'copilot'];

  const handleTabChange = (newTab: TabType) => {
    if (newTab === activeTab) return;
    const oldIndex = TAB_ORDER.indexOf(activeTab);
    const newIndex = TAB_ORDER.indexOf(newTab);
    startTransition(() => {
      if (newIndex > oldIndex) {
        addTransitionType('nav-forward');
      } else {
        addTransitionType('nav-back');
      }
      setActiveTab(newTab);
    });
  };

  useEffect(() => {
    if (user && (hasCompany || isAdmin)) {
      loadData(false, period, customStartDate, customEndDate);

      const interval = setInterval(() => {
        loadData(false, period, customStartDate, customEndDate);
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [loadData, period, customStartDate, customEndDate, user, hasCompany, isAdmin]);

  // Monitora fila de cadastros pendentes para exibir badge no BottomNav
  useEffect(() => {
    if (user && (hasCompany || isAdmin)) {
      const checkPending = async () => {
        try {
          const list = await fetchCustomerRegistrations(effectiveCompanyId, 'pendente');
          setPendingApprovalsCount(list.length);
        } catch {}
      };
      checkPending();
      const interval = setInterval(checkPending, 30000);
      return () => clearInterval(interval);
    }
  }, [user, hasCompany, isAdmin, effectiveCompanyId]);

  // Listener para histórico de navegação (botão Voltar/Avançar do navegador)
  useEffect(() => {
    const handlePopState = () => {
      setIsAdminMode(window.location.pathname.startsWith('/admin'));
      setIsCustomerRegPath(window.location.pathname.startsWith('/cadastro'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 1. Rota Pública de Cadastro de Cliente (/cadastro/:slug) - Não exige login
  if (isCustomerRegPath) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#0f3928]/30 border-t-[#0f3928] rounded-full animate-spin" />
          </div>
        }
      >
        <CustomerRegistrationScreen companySlug={customerRegSlug} />
      </Suspense>
    );
  }

  // 2. Tela de Carregamento Inicial do Auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f9f9fa] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <VoronLogo size="lg" />
          <div className="w-5 h-5 border-2 border-[#0f3928]/30 border-t-[#0f3928] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // 3. Rota do Portal Administrativo (/admin)
  if (isAdminMode) {
    if (!user || !isAdmin) {
      return (
        <Suspense fallback={null}>
          <AdminLoginScreen
            onBackToApp={() => {
              window.history.pushState({}, '', '/');
              setIsAdminMode(false);
            }}
            onSuccess={() => {
              setIsAdminMode(true);
            }}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={null}>
        <AdminDashboard
          onBackToApp={() => {
            window.history.pushState({}, '', '/');
            setIsAdminMode(false);
          }}
        />
      </Suspense>
    );
  }

  // 4. Usuário Não Autenticado no App Padrão -> Tela de Login/Cadastro
  if (!user) {
    return (
      <Suspense fallback={null}>
        <AuthScreen
          onOpenAdminLogin={() => {
            window.history.pushState({}, '', '/admin');
            setIsAdminMode(true);
          }}
        />
      </Suspense>
    );
  }

  // 5. Usuário Autenticado sem Empresa Vinculada (não-admin) -> Tela de Código de Ativação
  if (!hasCompany && !isAdmin) {
    return (
      <Suspense fallback={null}>
        <ClaimCompanyScreen />
      </Suspense>
    );
  }

  // 6. Empresa Suspensa (Bloqueio manual ou assinatura vencida) - Aplicado aos usuários da loja (não-admin)
  const isCompanyDirectlySuspended = Boolean(
    company &&
      (!company.isActive ||
        (company.activeUntil && new Date(company.activeUntil).getTime() < Date.now()))
  );

  if ((isSuspended || isCompanyDirectlySuspended) && !isAdmin) {
    return (
      <Suspense fallback={null}>
        <CompanySuspendedScreen
          companyName={dashboardData?.companyName || company?.name}
          reason={suspensionReason || company?.blockedReason || undefined}
          activeUntil={suspendedActiveUntil || company?.activeUntil || null}
          onRetry={async () => {
            await refreshProfile();
            await loadData(true);
          }}
          isRetrying={isRefreshing}
          onOpenAdmin={() => {
            window.history.pushState({}, '', '/admin');
            setIsAdminMode(true);
          }}
        />
      </Suspense>
    );
  }

  const isOnline = dashboardData ? dashboardData.isOnline : false;

  const headerTitle =
    activeTab === 'dados'
      ? 'Visão Geral'
      : activeTab === 'itens'
      ? 'Consulta de Itens'
      : activeTab === 'clientes'
      ? 'Clientes'
      : 'Assistente IA';

  return (
    <div className="min-h-screen bg-stone-200/50 flex justify-center font-sans">
      {/* Container simulando smartphone em telas grandes e 100% no celular */}
      <div className="w-full max-w-md min-h-screen bg-[#f9f9fa] flex flex-col shadow-2xl relative">
        <Header
          companyName={dashboardData?.companyName || company?.name || 'Empresa Piloto'}
          isOnline={isOnline}
          onRefresh={() => loadData(true, period)}
          isRefreshing={isRefreshing}
          isPrivacyMode={isPrivacyMode}
          onTogglePrivacy={() => setIsPrivacyMode((prev) => !prev)}
          title={headerTitle}
          onOpenProfile={() => setIsProfileDrawerOpen(true)}
          onOpenNotifications={() => setIsNotificationsDrawerOpen(true)}
          unreadNotificationsCount={unreadNotificationsCount}
          userInitials={profile?.fullName ? profile.fullName.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase() || 'U'}
        />

        <main className="flex-1 px-4 pt-3 pb-20 overflow-y-auto">
          <ViewTransition
            key={activeTab}
            enter={{
              'nav-forward': 'slide-from-right',
              'nav-back': 'slide-from-left',
              default: 'fade-in',
            }}
            exit={{
              'nav-forward': 'slide-to-left',
              'nav-back': 'slide-to-right',
              default: 'fade-out',
            }}
            default="none"
          >
            <div>
              {activeTab === 'dados' && (
                <DashboardScreen
                  data={dashboardData}
                  isLoading={isLoading}
                  isPeriodLoading={isPeriodLoading}
                  isPrivacyMode={isPrivacyMode}
                  period={period}
                  customStartDate={customStartDate}
                  customEndDate={customEndDate}
                  onPeriodChange={handlePeriodChange}
                  userRole={profile?.role || 'diretor'}
                  onNavigateToCopilot={() => {
                    startTransition(() => {
                      addTransitionType('nav-forward');
                      setActiveTab('copilot');
                    });
                  }}
                />
              )}

              {activeTab === 'itens' && (
                <ItemsScreen companyId={effectiveCompanyId} />
              )}

              {activeTab === 'clientes' && (
                <CustomersScreen
                  companySlug={effectiveCompanyId}
                  companyName={dashboardData?.companyName || company?.name || 'Empresa Piloto'}
                />
              )}

              {activeTab === 'copilot' && (
                <CopilotScreen
                  companyId={effectiveCompanyId}
                  companyName={dashboardData?.companyName || company?.name}
                />
              )}
            </div>
          </ViewTransition>
        </main>

        <BottomNav
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          pendingApprovalsCount={pendingApprovalsCount}
        />

        {/* Drawer de Perfil e Configurações (Carregado sob demanda via bundle-dynamic-imports) */}
        {isProfileDrawerOpen && (
          <Suspense fallback={null}>
            <ProfileDrawer
              isOpen={isProfileDrawerOpen}
              onClose={() => setIsProfileDrawerOpen(false)}
              isOnline={isOnline}
              companyName={dashboardData?.companyName || company?.name || 'Empresa Piloto'}
              onOpenAdmin={() => {
                window.history.pushState({}, '', '/admin');
                setIsAdminMode(true);
              }}
            />
          </Suspense>
        )}

        {/* Drawer de Notificações e Web Push */}
        {isNotificationsDrawerOpen && (
          <Suspense fallback={null}>
            <NotificationsDrawer
              isOpen={isNotificationsDrawerOpen}
              onClose={() => setIsNotificationsDrawerOpen(false)}
              onUnreadCountChange={(count) => setUnreadNotificationsCount(count)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default App;
