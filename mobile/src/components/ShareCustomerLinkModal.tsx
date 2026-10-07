import React, { useState } from 'react';
import { X, Copy, Check, MessageCircle, ExternalLink, Share2, Sparkles } from 'lucide-react';

interface ShareCustomerLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  companySlug: string;
  companyName: string;
}

export const ShareCustomerLinkModal: React.FC<ShareCustomerLinkModalProps> = ({
  isOpen,
  onClose,
  companySlug,
  companyName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const registrationUrl = `${origin}/cadastro/${companySlug}`;

  const defaultMessage = `Olá! Para agilizarmos seu atendimento e faturamento na *${companyName}*, por favor acesse o link seguro abaixo para preenchimento rápido de seus dados cadastrais:\n\n${registrationUrl}\n\nO preenchimento leva menos de 1 minuto. Obrigado!`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(10);
      }
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleWhatsAppShare = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(10);
    }
    const url = `https://wa.me/?text=${encodeURIComponent(defaultMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 border border-emerald-900/10 shadow-2xl space-y-5 animate-slide-up sm:animate-scale-in">
        {/* Header do Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Link de Cadastro de Cliente
              </h3>
              <p className="text-[11px] text-stone-500">{companyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar modal de compartilhamento"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Card Informativo */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-600/15 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-950 leading-relaxed">
            Envie este link para seu cliente preencher os dados pelo celular. O cadastro entrará diretamente no ERP ou na sua fila de conferência.
          </p>
        </div>

        {/* Campo do Link com Cópia Rápida */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1.5">
            Link Público Oficial
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={registrationUrl}
              className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-mono text-stone-700 outline-hidden select-all"
            />
            <button
              onClick={handleCopy}
              className={`min-h-[44px] px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Ações de Compartilhamento com Hitbox Ergonômico de 48px */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={handleWhatsAppShare}
            className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Compartilhar no WhatsApp</span>
          </button>

          <a
            href={registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[44px] rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir formulário no navegador</span>
          </a>
        </div>
      </div>
    </div>
  );
};
