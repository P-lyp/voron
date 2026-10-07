import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchPublicCompanyInfo,
  submitPublicCustomerRegistration,
} from '../services/api.js';
import { CustomerRegistrationPayload } from '@ai-db/shared';
import {
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  MapPin,
  Phone,
  MessageCircle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

// Hoisted Mask Helpers & RegExps (Vercel Best Practice: js-hoist-regexp)
const NON_DIGITS_REGEX = /\D/g;

function formatPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const clean = phone.replace(NON_DIGITS_REGEX, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

function formatCpfCnpj(value: string, tipo: 'F' | 'J'): string {
  const raw = value.replace(NON_DIGITS_REGEX, '');
  if (tipo === 'F') {
    const v = raw.slice(0, 11);
    return v
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    const v = raw.slice(0, 14);
    return v
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
}

function formatPhone(value: string): string {
  const raw = value.replace(NON_DIGITS_REGEX, '').slice(0, 11);
  if (raw.length <= 10) {
    return raw.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return raw.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function formatCep(value: string): string {
  const raw = value.replace(NON_DIGITS_REGEX, '').slice(0, 8);
  return raw.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

interface CustomerRegistrationScreenProps {
  companySlug: string;
}

export const CustomerRegistrationScreen: React.FC<CustomerRegistrationScreenProps> = ({ companySlug }) => {
  const [companyInfo, setCompanyInfo] = useState<{
    name: string;
    slug: string;
    habilitado: boolean;
    modo: 'direto' | 'pre_aprovacao';
    whatsappContato?: string;
  } | null>(null);

  const [isLoadingCompany, setIsLoadingCompany] = useState(true);
  const [companyError, setCompanyError] = useState<string | null>(null);

  // Form states
  const [tipoPessoa, setTipoPessoa] = useState<'F' | 'J'>('F');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [nome, setNome] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [isentoIe, setIsentoIe] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  // Endereço
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [idCidade, setIdCidade] = useState<number | undefined>(undefined);

  // Loading & submission states
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Duplicate / Success states
  const [duplicateData, setDuplicateData] = useState<{
    message: string;
    existingClient?: any;
    whatsappContato?: string;
  } | null>(null);

  const [successData, setSuccessData] = useState<{
    mode: 'direto' | 'pre_aprovacao';
    codcfo?: string;
    message: string;
  } | null>(null);

  // Feedback tátil ergonômico (Apple HIG)
  const triggerHaptic = (ms: number = 8) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(ms);
      } catch {}
    }
  };

  // Slug efetivo com fallback resiliente para pathname
  const effectiveSlug = (companySlug || '').trim().replace(/\/+$/, '') ||
    (typeof window !== 'undefined' ? window.location.pathname.replace(/^\/cadastro\/?/, '').replace(/\/+$/, '').split('?')[0].split('#')[0] : '') ||
    'empresa-piloto-001';

  // Carrega informações públicas da empresa
  const loadCompany = useCallback(async () => {
    try {
      setIsLoadingCompany(true);
      setCompanyError(null);
      const info = await fetchPublicCompanyInfo(effectiveSlug);
      setCompanyInfo(info);
      if (info.habilitado === false) {
        setCompanyError('O cadastro online de clientes está temporariamente desativado para esta loja.');
      }
    } catch (err: any) {
      setCompanyError(err.message || 'Loja não encontrada ou link inválido.');
    } finally {
      setIsLoadingCompany(false);
    }
  }, [effectiveSlug]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);



  // Consulta automática de CEP via ViaCEP
  const handleCepLookup = async (cepValue: string) => {
    const clean = cepValue.replace(/\D/g, '');
    if (clean.length !== 8) return;

    try {
      setIsSearchingCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (data.logradouro) setLogradouro(data.logradouro.toUpperCase());
        if (data.bairro) setBairro(data.bairro.toUpperCase());
        if (data.localidade) setCidade(data.localidade.toUpperCase());
        if (data.uf) setUf(data.uf.toUpperCase());
        if (data.ibge) setIdCidade(Number(data.ibge) || undefined);
        triggerHaptic(10);
      }
    } catch {
      // Falha silenciosa, usuário pode preencher manualmente
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Consulta automática de CNPJ via BrasilAPI
  const handleCnpjLookup = async (cnpjValue: string) => {
    const clean = cnpjValue.replace(/\D/g, '');
    if (clean.length !== 14) return;

    try {
      setIsSearchingCnpj(true);
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (res.ok) {
        const data = await res.json();
        if (data.razao_social) setNome(data.razao_social.toUpperCase());
        if (data.nome_fantasia) setNomeFantasia(data.nome_fantasia.toUpperCase());
        if (data.logradouro) setLogradouro(data.logradouro.toUpperCase());
        if (data.numero) setNumero(data.numero.toUpperCase());
        if (data.complemento) setComplemento(data.complemento.toUpperCase());
        if (data.bairro) setBairro(data.bairro.toUpperCase());
        if (data.municipio) setCidade(data.municipio.toUpperCase());
        if (data.uf) setUf(data.uf.toUpperCase());
        if (data.codigo_municipio_ibge || data.codigo_municipio) {
          setIdCidade(Number(data.codigo_municipio_ibge || data.codigo_municipio) || undefined);
        }
        if (data.cep) {
          const rawCep = String(data.cep).replace(/\D/g, '');
          setCep(formatCep(rawCep));
        }
        if (data.ddd_telefone_1) {
          setTelefone(formatPhone(data.ddd_telefone_1));
        }
        if (data.email) {
          setEmail(data.email.toLowerCase());
        }
        triggerHaptic(12);
      }
    } catch {
      // Ignora erro de API externa
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(15);
    setSubmitError(null);
    setDuplicateData(null);

    // Validação de campos obrigatórios
    if (!nome.trim()) {
      setSubmitError('Informe seu Nome Completo ou Razão Social.');
      return;
    }
    const cleanDoc = cpfCnpj.replace(/\D/g, '');
    if (tipoPessoa === 'F' && cleanDoc.length !== 11) {
      setSubmitError('CPF incompleto ou inválido.');
      return;
    }
    if (tipoPessoa === 'J' && cleanDoc.length !== 14) {
      setSubmitError('CNPJ incompleto ou inválido.');
      return;
    }
    if (!telefone.trim() || telefone.replace(/\D/g, '').length < 10) {
      setSubmitError('Informe um Telefone / WhatsApp válido.');
      return;
    }
    if (!cep.trim() || cep.replace(/\D/g, '').length !== 8) {
      setSubmitError('Informe um CEP válido com 8 dígitos.');
      return;
    }
    if (!logradouro.trim()) {
      setSubmitError('Informe a Rua / Logradouro.');
      return;
    }
    if (!numero.trim()) {
      setSubmitError('Informe o Número do endereço.');
      return;
    }
    if (!bairro.trim()) {
      setSubmitError('Informe o Bairro.');
      return;
    }
    if (!cidade.trim()) {
      setSubmitError('Informe a Cidade.');
      return;
    }
    if (!uf.trim()) {
      setSubmitError('Informe o Estado / UF.');
      return;
    }

    const hasIe = tipoPessoa === 'J' && !isentoIe && !!inscricaoEstadual.trim() && inscricaoEstadual.trim().toUpperCase() !== 'ISENTO';
    const resolvedIe = hasIe ? inscricaoEstadual.trim().toUpperCase() : ' ';
    const indicadorIe: 'C' | 'N' = hasIe ? 'C' : 'N';

    const payload: CustomerRegistrationPayload = {
      tipoPessoa,
      nome: nome.trim(),
      nomeFantasia: nomeFantasia.trim() || undefined,
      cpfCnpj: cpfCnpj.trim(),
      rgIe: resolvedIe,
      inscricaoEstadual: resolvedIe,
      indicadorIe,
      idCidade,
      email: email.trim() || undefined,
      telefone: telefone.trim(),
      cep: cep.trim(),
      logradouro: logradouro.trim(),
      numero: numero.trim(),
      complemento: complemento.trim() || undefined,
      bairro: bairro.trim(),
      cidade: cidade.trim(),
      uf: uf.trim(),
    };

    try {
      setIsSubmitting(true);
      const res = await submitPublicCustomerRegistration(effectiveSlug, payload);

      if (!res.success && res.existingClient) {
        // Bloqueio amigável de duplicidade (Opção 1)
        triggerHaptic(25);
        setDuplicateData({
          message: res.message || 'Este CPF/CNPJ já possui cadastro ativo em nossa base.',
          existingClient: res.existingClient,
          whatsappContato: res.whatsappContato || companyInfo?.whatsappContato,
        });
      } else {
        // Sucesso
        triggerHaptic(20);
        setSuccessData({
          mode: res.mode,
          codcfo: res.codcfo,
          message: res.message,
        });
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Tela de Carregamento Inicial
  if (isLoadingCompany) {
    return (
      <div className="min-h-screen bg-[#fafaf7] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-600/10 flex items-center justify-center animate-pulse mb-3">
          <Building2 className="w-6 h-6 text-emerald-800" />
        </div>
        <p className="text-sm font-semibold text-stone-700">Carregando formulário de cadastro...</p>
      </div>
    );
  }

  // 2. Tela de Erro de Empresa
  if (companyError || !companyInfo) {
    return (
      <div className="min-h-screen bg-[#fafaf7] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-100/80 text-amber-800 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-stone-900 mb-2">Formulário Indisponível</h1>
        <p className="text-sm text-stone-600 mb-6">{companyError || 'Esta página de cadastro não está disponível no momento.'}</p>
        <button
          onClick={() => {
            triggerHaptic(10);
            loadCompany();
          }}
          className="min-h-[48px] px-6 rounded-xl bg-stone-900 text-white font-semibold text-sm shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  // 3. Tela de Duplicidade (Bloqueio Amigável com Contato da Empresa)
  if (duplicateData) {
    const companyPhone = (duplicateData.whatsappContato || companyInfo.whatsappContato || '').trim();
    const phoneClean = companyPhone.replace(NON_DIGITS_REGEX, '');
    const clientName = duplicateData.existingClient?.nome || nome;
    const msgText = encodeURIComponent(
      `Olá! Estava preenchendo o cadastro online na ${companyInfo.name} e identifiquei que meu CPF/CNPJ (${cpfCnpj}) já possui cadastro. Meu nome é ${clientName}. Gostaria de atualizar meus dados ou realizar um pedido.`
    );
    const whatsappUrl = phoneClean ? `https://wa.me/55${phoneClean}?text=${msgText}` : null;

    return (
      <div className="min-h-screen bg-[#fafaf7] flex flex-col justify-center py-10 px-4 sm:px-6">
        <div className="max-w-md mx-auto w-full bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4 ring-8 ring-amber-50">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-300/40">
            Cadastro Já Existente
          </span>

          <h2 className="text-xl font-bold text-stone-900 mt-3 mb-2">
            Você já é cliente da {companyInfo.name}!
          </h2>

          <p className="text-sm text-stone-600 leading-relaxed mb-6">
            Identificamos que o documento <strong className="font-semibold text-stone-800">{cpfCnpj}</strong> já está cadastrado em nosso sistema.
            {duplicateData.existingClient?.codcfo && (
              <span className="block mt-1 text-xs text-stone-500">
                Código de cliente: <strong>{duplicateData.existingClient.codcfo}</strong>
              </span>
            )}
          </p>

          <div className="space-y-3">
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => triggerHaptic(10)}
                className="w-full min-h-[50px] flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 text-emerald-200" />
                <span>Falar no WhatsApp da Loja ({formatPhoneNumber(companyPhone)})</span>
              </a>
            ) : (
              <div className="p-4 bg-stone-100/80 rounded-2xl border border-stone-200/80 space-y-1 text-center">
                <p className="text-xs font-bold text-stone-800">
                  Precisa atualizar seus dados?
                </p>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Entre em contato com o atendimento da {companyInfo.name} para atualizar seu cadastro ou realizar novos pedidos.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setDuplicateData(null);
                setCpfCnpj('');
              }}
              className="w-full min-h-[48px] flex items-center justify-center text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
            >
              Voltar ao formulário com outro documento
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Tela de Sucesso
  if (successData) {
    return (
      <div className="min-h-screen bg-[#fafaf7] flex flex-col justify-center py-10 px-4 sm:px-6">
        <div className="max-w-md mx-auto w-full bg-white rounded-3xl p-6 sm:p-8 border border-emerald-900/10 shadow-lg text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300/40">
            Cadastro Concluído
          </span>

          <h2 className="text-xl font-bold text-stone-900 mt-3 mb-2">
            Muito obrigado, {nome.split(' ')[0]}!
          </h2>

          <p className="text-sm text-stone-600 leading-relaxed mb-6">
            {successData.mode === 'direto'
              ? 'Seus dados foram integrados com sucesso ao nosso sistema de faturamento e vendas.'
              : 'Seu cadastro foi recebido com sucesso e nossa equipe efetuará a conferência e liberação em breve.'}
            {successData.codcfo && (
              <span className="block mt-2 font-mono text-xs font-bold text-emerald-800 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-600/15">
                Código no ERP: {successData.codcfo}
              </span>
            )}
          </p>

          <div className="pt-3 border-t border-stone-100 space-y-2">
            <p className="text-xs text-stone-400">
              {companyInfo.name} • Atendimento Comercial
            </p>
            {companyInfo.whatsappContato && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-stone-600">
                <span>Dúvidas ou pedidos? WhatsApp:</span>
                <a
                  href={`https://wa.me/55${companyInfo.whatsappContato.replace(NON_DIGITS_REGEX, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 inline-flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{formatPhoneNumber(companyInfo.whatsappContato)}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 5. Formulário Principal
  return (
    <div className="min-h-screen bg-[#fafaf7] text-stone-800 pb-16">
      {/* Header com Frosted Glass */}
      <header className="sticky top-0 z-40 bg-[#ffffff]/90 backdrop-blur-xl border-b border-stone-200/70 shadow-xs">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0f3928] to-[#1e5841] text-[#c0ecd6] flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              {companyInfo.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block truncate">
                {companyInfo.name}
              </span>
              <h1 className="text-sm font-bold text-stone-900 truncate">
                Ficha Cadastral de Cliente
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-600/15 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Seguro</span>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-xl mx-auto px-4 pt-6">
        {/* Banner Informativo */}
        <div className="bg-gradient-to-br from-[#0f3928] to-[#194c36] text-white rounded-3xl p-5 sm:p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight">
                Agilize seu Atendimento
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 leading-relaxed">
                Preencha seus dados abaixo para cadastro e emissão de notas fiscais. O preenchimento leva menos de 1 minuto.
              </p>
            </div>
          </div>

          {/* Espaço dedicado para o WhatsApp da Empresa da Loja */}
          {companyInfo?.whatsappContato && (
            <div className="mt-4 pt-3.5 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs text-emerald-100">
                <MessageCircle className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>Dúvidas durante o preenchimento?</span>
              </div>
              <a
                href={`https://wa.me/55${companyInfo.whatsappContato.replace(NON_DIGITS_REGEX, '')}?text=${encodeURIComponent(`Olá! Estou na página de cadastro da ${companyInfo.name} e gostaria de tirar uma dúvida.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => triggerHaptic(8)}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-xs active:scale-[0.98] transition-all min-h-[44px]"
              >
                <MessageCircle className="w-4 h-4 text-emerald-300" />
                <span>WhatsApp da Loja: {formatPhoneNumber(companyInfo.whatsappContato)}</span>
              </a>
            </div>
          )}
        </div>

        {/* Mensagem de Erro Geral */}
        {submitError && (
          <div className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{submitError}</div>
          </div>
        )}

        {/* Formulário com Seções Despoluídas */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1: Identificação (PF vs PJ) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                <User className="w-4 h-4 text-emerald-800" />
                <span>Dados de Identificação</span>
              </div>
              <span className="text-[11px] text-stone-400 font-medium">* Obrigatório</span>
            </div>

            {/* Seletor Tipo de Pessoa com Touch Target de 48px */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-2">
                Tipo de Cadastro <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-2xl border border-stone-200/70">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setTipoPessoa('F');
                    setCpfCnpj('');
                    setInscricaoEstadual('');
                    setIsentoIe(false);
                  }}
                  className={`min-h-[46px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    tipoPessoa === 'F'
                      ? 'bg-white text-emerald-950 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Pessoa Física (CPF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setTipoPessoa('J');
                    setCpfCnpj('');
                  }}
                  className={`min-h-[46px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    tipoPessoa === 'J'
                      ? 'bg-white text-emerald-950 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Pessoa Jurídica (CNPJ)</span>
                </button>
              </div>
            </div>

            {/* CPF / CNPJ com Consulta Automática */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-stone-700">
                  {tipoPessoa === 'F' ? 'CPF' : 'CNPJ'} <span className="text-rose-500">*</span>
                </label>
                {tipoPessoa === 'J' && (
                  <span className="text-[11px] text-emerald-800 font-medium">
                    Busca automática na Receita
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder={tipoPessoa === 'F' ? '000.000.000-00' : '00.000.000/0000-00'}
                  value={cpfCnpj}
                  onChange={(e) => {
                    const formatted = formatCpfCnpj(e.target.value, tipoPessoa);
                    setCpfCnpj(formatted);
                    if (tipoPessoa === 'J' && formatted.replace(/\D/g, '').length === 14) {
                      handleCnpjLookup(formatted);
                    }
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 font-mono text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
                />
                {isSearchingCnpj && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                    <span>Consultando...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Nome / Razão Social */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                {tipoPessoa === 'F' ? 'Nome Completo' : 'Razão Social'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={tipoPessoa === 'F' ? 'Ex: João da Silva' : 'Ex: Distribuidora e Comércio Ltda'}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
              />
            </div>

            {/* Campos opcionais de Pessoa Jurídica */}
            {tipoPessoa === 'J' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Nome Fantasia <span className="text-stone-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nome comercial da empresa"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
                  />
                </div>

                {/* Inscrição Estadual (IE) - Opcional para Pessoa Jurídica */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-stone-700">
                      Inscrição Estadual (IE) <span className="text-stone-400 font-normal">(Opcional)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isentoIe}
                        onChange={(e) => {
                          triggerHaptic(6);
                          setIsentoIe(e.target.checked);
                          if (e.target.checked) {
                            setInscricaoEstadual('');
                          }
                        }}
                        className="rounded border-stone-300 text-emerald-700 focus:ring-emerald-500/20 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-medium text-stone-600">Não possui IE</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={isentoIe}
                    placeholder={isentoIe ? 'Sem Inscrição Estadual (Não Contribuinte)' : 'Ex: 13.767.210-1 (ou deixe em branco)'}
                    value={isentoIe ? '' : inscricaoEstadual}
                    onChange={(e) => setInscricaoEstadual(e.target.value.toUpperCase())}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden disabled:bg-stone-100 disabled:text-stone-400"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    {isentoIe || !inscricaoEstadual.trim()
                      ? 'Cadastro como Não Contribuinte (sem IE).'
                      : 'Cadastro como Contribuinte de ICMS.'}
                  </p>
                </div>
              </>
            )}

          </div>

          {/* Seção 2: Contatos */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                <Phone className="w-4 h-4 text-emerald-800" />
                <span>Canais de Contato</span>
              </div>
              <span className="text-[11px] text-stone-400 font-medium">* Obrigatório</span>
            </div>

            {/* Telefone / WhatsApp Obrigatório */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Telefone / WhatsApp <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 font-mono text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
              />
            </div>

            {/* E-mail (Opcional) */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                E-mail para envio de Notas e Boletos <span className="text-stone-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="email"
                placeholder="seuemail@exemplo.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
              />
            </div>
          </div>

          {/* Seção 3: Endereço Completo */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                <MapPin className="w-4 h-4 text-emerald-800" />
                <span>Endereço de Entrega & Faturamento</span>
              </div>
              <span className="text-[11px] text-stone-400 font-medium">* Obrigatório</span>
            </div>

            {/* CEP com Busca Automática */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-stone-700">
                  CEP <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-emerald-800 font-medium">
                  Preenche rua, bairro e cidade
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => {
                    const formatted = formatCep(e.target.value);
                    setCep(formatted);
                    if (formatted.replace(/\D/g, '').length === 8) {
                      handleCepLookup(formatted);
                    }
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 font-mono text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
                />
                {isSearchingCep && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                    <span>Buscando CEP...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Logradouro e Número */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Rua / Logradouro <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome da rua ou avenida"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Número <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="123"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
                />
              </div>
            </div>

            {/* Bairro e Complemento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Bairro <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Centro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Complemento <span className="text-stone-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sala 02, Apto 101"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
                />
              </div>
            </div>

            {/* Cidade e UF */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Cidade <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sinop"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Estado <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  placeholder="MT"
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm uppercase text-center font-bold focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Botão de Finalização com Toque Ergonômico de 52px */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-[#0f3928] to-[#1e5841] text-white font-bold text-base shadow-md hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Enviando Cadastro...</span>
                </>
              ) : (
                <>
                  <span>Concluir Cadastro</span>
                  <ArrowRight className="w-5 h-5 text-emerald-300" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-stone-400 mt-2.5">
              Seus dados estão protegidos e serão utilizados exclusivamente para relacionamento comercial.
            </p>

            {companyInfo?.whatsappContato && (
              <div className="mt-4 pt-3.5 border-t border-stone-200/60 text-center">
                <p className="text-xs text-stone-500">
                  Dúvidas no preenchimento? Fale com a equipe da <strong className="text-stone-700">{companyInfo.name}</strong>:{' '}
                  <a
                    href={`https://wa.me/55${companyInfo.whatsappContato.replace(NON_DIGITS_REGEX, '')}?text=${encodeURIComponent(`Olá! Estou com dúvidas no preenchimento da ficha cadastral da ${companyInfo.name}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 inline-flex items-center gap-1 ml-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{formatPhoneNumber(companyInfo.whatsappContato)}</span>
                  </a>
                </p>
              </div>
            )}
          </div>
        </form>
      </main>
    </div>
  );
};
