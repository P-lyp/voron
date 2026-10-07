import React, { useState, useEffect, useCallback } from 'react';
import {
  searchErpCustomers,
  fetchCustomerRegistrations,
  approveCustomerRegistration,
  rejectCustomerRegistration,
} from '../services/api.js';
import { CustomerErpDTO, CustomerRegistrationRecord } from '@ai-db/shared';
import { ShareCustomerLinkModal } from '../components/ShareCustomerLinkModal.js';
import {
  Users,
  Search,
  Share2,
  Clock,
  CheckCircle2,
  MessageCircle,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Mail,
} from 'lucide-react';

interface CustomersScreenProps {
  companySlug: string;
  companyName: string;
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({
  companySlug,
  companyName,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [erpCustomers, setErpCustomers] = useState<CustomerErpDTO[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<CustomerRegistrationRecord[]>([]);

  const [isLoadingErp, setIsLoadingErp] = useState(false);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Expanded registration details
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerHaptic = (ms: number = 8) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(ms);
      } catch {}
    }
  };

  // Carrega fila de pendentes
  const loadPending = useCallback(async () => {
    try {
      setIsLoadingPending(true);
      const list = await fetchCustomerRegistrations(companySlug, 'pendente');
      setPendingRegistrations(list);
    } catch (err: any) {
      console.error('Erro ao carregar fila de cadastros pendentes:', err);
    } finally {
      setIsLoadingPending(false);
    }
  }, [companySlug]);

  // Busca clientes no ERP Firebird
  const searchCustomers = useCallback(
    async (term: string) => {
      try {
        setIsLoadingErp(true);
        const res = await searchErpCustomers(companySlug, term, 40);
        if (res && res.success && Array.isArray(res.data)) {
          setErpCustomers(res.data);
        } else if (Array.isArray(res)) {
          setErpCustomers(res);
        }
      } catch (err: any) {
        console.error('Erro ao consultar clientes no ERP:', err);
      } finally {
        setIsLoadingErp(false);
      }
    },
    [companySlug]
  );

  // Inicialização e busca debounced
  useEffect(() => {
    loadPending();
    searchCustomers('');
  }, [loadPending, searchCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomers(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, searchCustomers]);

  // Aprova cadastro e envia para o ERP
  const handleApprove = async (reg: CustomerRegistrationRecord) => {
    triggerHaptic(15);
    setProcessingId(reg.id);
    setActionMessage(null);

    try {
      const res = await approveCustomerRegistration(reg.id);
      triggerHaptic(20);
      setActionMessage({
        text: `Cliente aprovado com sucesso! Inserido no ERP com código ${res.codcfo || ''}.`,
        type: 'success',
      });
      // Remove da lista pendente
      setPendingRegistrations((prev) => prev.filter((item) => item.id !== reg.id));
      // Recarrega busca de clientes do ERP
      searchCustomers(searchTerm);
    } catch (err: any) {
      triggerHaptic(25);
      if (
        err.message &&
        (err.message.includes('já possui cadastro') ||
          err.message.includes('duplicado') ||
          err.message.includes('C00'))
      ) {
        setPendingRegistrations((prev) => prev.filter((item) => item.id !== reg.id));
      }
      setActionMessage({
        text: err.message || 'Falha ao aprovar cadastro no ERP.',
        type: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Rejeita cadastro
  const handleReject = async (regId: string) => {
    triggerHaptic(10);
    setProcessingId(regId);
    setActionMessage(null);

    try {
      await rejectCustomerRegistration(regId, 'Descartado pelo gestor');
      setPendingRegistrations((prev) => prev.filter((item) => item.id !== regId));
      setActionMessage({
        text: 'Cadastro rejeitado e arquivado.',
        type: 'success',
      });
    } catch (err: any) {
      setActionMessage({
        text: err.message || 'Falha ao rejeitar cadastro.',
        type: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
      {/* Barra de Ação Superior Refinada (Apple HIG & M3) */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <p className="text-xs text-stone-500 font-medium">
          Gestão cadastral e consulta ao ERP
        </p>

        {/* Botão de Compartilhar Link com Recipiente Tonal Elegante */}
        <button
          onClick={() => {
            triggerHaptic(8);
            setIsShareModalOpen(true);
          }}
          className="h-10 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-850 border border-emerald-200/80 font-semibold text-xs flex items-center gap-2 active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0"
        >
          <Share2 className="w-4 h-4 text-emerald-700" />
          <span>Compartilhar Link</span>
        </button>
      </div>

      {/* Alerta de Ação */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-between gap-2 animate-fade-in ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-600/20'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            aria-label="Fechar mensagem"
            className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-stone-700 cursor-pointer active:scale-95 transition-all"
          >
            ×
          </button>
        </div>
      )}

      {/* Seção 1: Fila de Cadastros Pendentes de Aprovação */}
      {pendingRegistrations.length > 0 && (
        <div className="bg-amber-50/80 rounded-3xl p-4 sm:p-5 border border-amber-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-amber-950">
                  Cadastros Aguardando Aprovação ({pendingRegistrations.length})
                </h3>
                <p className="text-[11px] text-amber-800/80">
                  Revise e aprove para gravar direto no ERP Firebird
                </p>
              </div>
            </div>
            <button
              onClick={loadPending}
              disabled={isLoadingPending}
              title="Atualizar fila"
              aria-label="Atualizar fila de cadastros pendentes"
              className="w-11 h-11 rounded-xl flex items-center justify-center text-amber-700 hover:bg-amber-100 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingPending ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Cards de Clientes Pendentes */}
          <div className="space-y-2.5 pt-1">
            {pendingRegistrations.map((reg) => {
              const isExpanded = expandedId === reg.id;
              const isBusy = processingId === reg.id;

              return (
                <div
                  key={reg.id}
                  className="bg-white rounded-2xl p-4 border border-amber-200/70 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-stone-900 truncate">
                          {reg.nome}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                          {reg.tipoPessoa === 'F' ? 'PF' : 'PJ'}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                        {reg.cpfCnpj} • {reg.cidade}/{reg.uf}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botão Aprovar (Toque Ergonômico de 44px - Apple HIG & M3) */}
                      <button
                        onClick={() => handleApprove(reg)}
                        disabled={isBusy}
                        className="min-h-[44px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isBusy ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Aprovar</span>
                      </button>

                      {/* Botão Expandir com área de toque mínima de 44x44px */}
                      <button
                        onClick={() => {
                          triggerHaptic(6);
                          setExpandedId(isExpanded ? null : reg.id);
                        }}
                        className="w-11 h-11 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center hover:bg-stone-200 active:scale-95 transition-all cursor-pointer"
                        title={isExpanded ? 'Recolher detalhes' : 'Ver detalhes'}
                        aria-label={isExpanded ? 'Recolher detalhes do cadastro' : 'Ver detalhes do cadastro'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Detalhes Expandidos do Cadastro */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-stone-100 text-xs space-y-1.5 text-stone-600 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-stone-400" />
                          <span>WhatsApp: <strong>{reg.telefone}</strong></span>
                        </div>
                        {reg.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-stone-400" />
                            <span className="truncate">E-mail: <strong>{reg.email}</strong></span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 col-span-1 sm:col-span-2">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>
                            {reg.logradouro}, {reg.numero}
                            {reg.complemento ? ` (${reg.complemento})` : ''} - {reg.bairro}, {reg.cidade}/{reg.uf} - CEP {reg.cep}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-1 sm:col-span-2">
                          <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>
                            Indicador Fiscal:{' '}
                            <strong className={reg.indicadorIe === 'C' ? 'text-emerald-700' : 'text-stone-700'}>
                              {reg.indicadorIe === 'C' ? 'Contribuinte (C)' : 'Não Contribuinte (N)'}
                            </strong>
                            {reg.inscricaoEstadual && reg.inscricaoEstadual.trim()
                              ? ` • IE: ${reg.inscricaoEstadual}`
                              : ' (Sem IE)'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleReject(reg.id)}
                          disabled={isBusy}
                          className="min-h-[44px] px-3.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl font-semibold flex items-center justify-center active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Descartar este cadastro
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seção 2: Consulta de Clientes no ERP Firebird */}
      <div className="space-y-3">
        {/* Campo de Busca com Botão de Limpar e Padding Ergonômico de pr-12 (Apple HIG) */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, fantasia, CPF/CNPJ ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[48px] pl-10 pr-12 rounded-2xl bg-white border border-stone-200/90 text-sm text-stone-900 placeholder:text-stone-400 shadow-xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
          />
          {searchTerm && (
            <button
              onClick={() => {
                triggerHaptic(6);
                setSearchTerm('');
              }}
              aria-label="Limpar campo de busca"
              className="w-11 h-11 absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-stone-400 hover:text-stone-600 active:scale-90 transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-sm">
                ×
              </div>
            </button>
          )}
        </div>

        {/* Indicador de Carregamento */}
        {isLoadingErp && (
          <div className="flex items-center justify-center py-6 text-stone-400 gap-2">
            <span className="w-4 h-4 border-2 border-stone-300 border-t-emerald-700 rounded-full animate-spin" />
            <span className="text-xs">Consultando base do Firebird...</span>
          </div>
        )}

        {/* Lista de Clientes do ERP */}
        {!isLoadingErp && erpCustomers.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-xs text-center">
            <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">Nenhum cliente encontrado</p>
            <p className="text-xs text-stone-400 mt-1">
              Tente pesquisar com outro termo ou código cadastral.
            </p>
          </div>
        )}

        {!isLoadingErp && erpCustomers.length > 0 && (
          <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs divide-y divide-stone-100 overflow-hidden">
            {erpCustomers.map((cli) => {
              const phoneClean = cli.telefone ? cli.telefone.replace(/\D/g, '') : '';
              const whatsappUrl = phoneClean
                ? `https://wa.me/55${phoneClean}?text=${encodeURIComponent(`Olá ${cli.nome}, tudo bem?`)}`
                : null;

              return (
                <div
                  key={cli.codcfo}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-stone-50/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-600/10">
                        {cli.codcfo}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                        {cli.nome}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono mt-1 flex-wrap">
                      {cli.cpfCnpj && <span>{cli.cpfCnpj}</span>}
                      {cli.cidade && (
                        <span>
                          • {cli.cidade}
                          {cli.uf ? `/${cli.uf}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ação Rápida WhatsApp se houver telefone */}
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-11 h-11 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer"
                      title="Chamar no WhatsApp"
                    >
                      <MessageCircle className="w-5 h-5 text-emerald-700" />
                    </a>
                  ) : (
                    <div className="w-11 h-11 flex items-center justify-center shrink-0 text-stone-300">
                      <Phone className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Compartilhamento do Link */}
      <ShareCustomerLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        companySlug={companySlug}
        companyName={companyName}
      />
    </div>
  );
};
