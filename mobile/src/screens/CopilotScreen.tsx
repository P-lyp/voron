import React, { useState, useRef, useEffect } from 'react';
import { ViewTransition, startTransition } from '../utils/view-transitions.js';
import { Send, Sparkles, RotateCcw, Clock, ArrowRight } from 'lucide-react';
import { sendChatMessage } from '../services/api.js';
import { VoronLogo } from '../components/VoronLogo.js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

const DEFAULT_SUGGESTIONS = [
  'Como foram as vendas hoje?',
  'Quais contas vencem esta semana?',
  'Qual produto vendeu mais?',
  'Qual a posição de contas a pagar e receber?',
];

// Hoisted RegExps (Vercel Best Practice: js-hoist-regexp)
const BOLD_REGEX = /(\*\*.*?\*\*)/g;

// Renderizador simples e limpo de texto sem asteriscos aparentes
const FormattedContent: React.FC<{ content: string; isUser: boolean }> = ({ content, isUser }) => {
  if (isUser) {
    return <div className="whitespace-pre-line leading-relaxed">{content}</div>;
  }

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 text-xs text-stone-800 leading-relaxed font-normal">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const cleanLine = isBullet ? trimmed.substring(2) : trimmed;

        // Processa negritos **texto**
        const parts = cleanLine.split(BOLD_REGEX);

        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2);
            return (
              <strong key={pIdx} className="font-semibold text-[#0f291e]">
                {inner}
              </strong>
            );
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-1 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 mt-1.5 flex-shrink-0" />
              <div className="flex-1">{renderedLine}</div>
            </div>
          );
        }

        return <div key={idx}>{renderedLine}</div>;
      })}
    </div>
  );
};

const STORAGE_KEY = 'ai_db_copilot_messages';
const SUGGESTIONS_KEY = 'ai_db_copilot_suggestions';

interface CopilotScreenProps {
  companyId?: string;
  companyName?: string;
}

export const CopilotScreen: React.FC<CopilotScreenProps> = ({
  companyId = 'empresa-piloto-001',
  companyName = 'Empresa Piloto',
}) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Erro ao ler mensagens do localStorage:', e);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Olá! Sou o **Voron**, sua inteligência executiva integrada em tempo real ao ERP Firebird.\n\nPergunte sobre faturamento, contas, metas ou produtos para eu analisar para você.',
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(SUGGESTIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_SUGGESTIONS;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sincroniza mensagens e sugestões com localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(suggestedQuestions));
    } catch {}
  }, [suggestedQuestions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleNewChat = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(10);
    }
    const freshWelcome: Message[] = [
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content: 'Nova conversa iniciada! O que você gostaria de consultar agora no ERP?',
        createdAt: new Date().toISOString(),
      },
    ];
    startTransition(() => {
      setMessages(freshWelcome);
      setSuggestedQuestions(DEFAULT_SUGGESTIONS);
      setInput('');
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(freshWelcome));
      localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(DEFAULT_SUGGESTIONS));
    } catch {}
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isSending) return;

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(8);
    }

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    startTransition(() => {
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsSending(true);
    });

    const recentHistory = messages
      .filter((m) => !m.id.startsWith('welcome'))
      .slice(-4)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const response = await sendChatMessage(text, companyId, recentHistory);
      const assistantMsg: Message = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: response.content || 'Não foi possível gerar a resposta.',
        createdAt: new Date().toISOString(),
      };

      startTransition(() => {
        setMessages((prev) => [...prev, assistantMsg]);
        if (response.suggestedQuestions && response.suggestedQuestions.length > 0) {
          setSuggestedQuestions(response.suggestedQuestions);
        }
      });
    } catch (err: any) {
      startTransition(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `Não foi possível consultar os dados: ${err.message}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      });
    } finally {
      startTransition(() => {
        setIsSending(false);
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-135px)] max-w-md mx-auto">
      {/* Barra de Título com VoronLogo e Ação de Nova Conversa */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-emerald-950/5">
        <div className="flex items-center space-x-2.5">
          <VoronLogo size="sm" />
          <div>
            <h2 className="text-xs font-bold text-[#0f291e] leading-tight flex items-center gap-1.5">
              <span>Voron Copilot</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            <p className="text-[10px] text-stone-500">
              Inteligência executiva em tempo real
            </p>
          </div>
        </div>

        <button
          onClick={handleNewChat}
          disabled={isSending}
          aria-label="Iniciar nova conversa"
          className="min-h-[44px] px-3.5 flex items-center space-x-1.5 rounded-xl bg-stone-100/90 hover:bg-stone-200/90 text-emerald-950 active:scale-95 transition-all text-xs font-medium border border-emerald-900/10 disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-emerald-800" />
          <span>Nova Conversa</span>
        </button>
      </div>

      {/* Feed de Mensagens com animação de entrada ViewTransition */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <ViewTransition key={msg.id} enter="slide-up" default="none">
              <div
                className={`flex items-end space-x-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <VoronLogo size="xs" className="mb-0.5 shrink-0" />
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs ${
                    isUser
                      ? 'bg-[#0f3928] text-white rounded-br-xs shadow-xs'
                      : 'bg-white border border-emerald-900/10 text-stone-800 rounded-bl-xs shadow-xs'
                  }`}
                >
                  <FormattedContent content={msg.content} isUser={isUser} />
                </div>
              </div>
            </ViewTransition>
          );
        })}

        {isSending && (
          <ViewTransition enter="fade-in" exit="fade-out" default="none">
            <div className="flex items-center space-x-2 text-stone-500 text-xs py-2 px-3 bg-white rounded-xl border border-emerald-900/10 max-w-[80%] animate-pulse">
              <Clock className="w-3.5 h-3.5 text-emerald-700 animate-spin" />
              <span>Consultando dados no Firebird...</span>
            </div>
          </ViewTransition>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões Rápidas em Pílula com área de toque mínima de 44px */}
      <div className="pt-2 pb-1 overflow-x-auto no-scrollbar flex items-center space-x-2">
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={isSending}
            className="flex-shrink-0 min-h-[44px] px-4 py-2 bg-white hover:bg-emerald-50/70 text-stone-700 hover:text-emerald-900 rounded-full text-xs font-medium active:scale-95 transition-all flex items-center space-x-1.5 border border-emerald-900/10 shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <span>{q}</span>
            <ArrowRight className="w-3 h-3 text-stone-400" />
          </button>
        ))}
      </div>

      {/* Barra de Entrada de Texto com botão ergonomicamente dimensionado */}
      <div className="relative mt-1.5 pb-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Pergunte sobre vendas, faturamento..."
          disabled={isSending}
          className="w-full min-h-[50px] pl-4 pr-14 rounded-2xl bg-white border border-emerald-900/15 shadow-xs text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#0f3928] focus:ring-1 focus:ring-[#0f3928]/20 transition-all"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isSending}
          aria-label="Enviar mensagem"
          className="absolute right-1.5 top-1 bottom-2 w-11 flex items-center justify-center rounded-xl bg-[#0f3928] text-[#c0ecd6] disabled:opacity-30 disabled:bg-stone-200 disabled:text-stone-400 active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
