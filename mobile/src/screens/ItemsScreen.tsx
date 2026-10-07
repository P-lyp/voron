import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ViewTransition, startTransition } from '../utils/view-transitions.js';
import { Search, X, Package, AlertCircle, RefreshCw, PackageSearch } from 'lucide-react';
import { fetchItems } from '../services/api.js';
import { ItemProdutoDTO, ItensConfig } from '@ai-db/shared';
import { formatCurrency, formatSaldo } from '../utils/formatters.js';

interface ItemsScreenProps {
  companyId?: string;
}

type FiltroEstoque = 'todos' | 'com_estoque' | 'sem_estoque';

export const ItemsScreen: React.FC<ItemsScreenProps> = ({ companyId = 'empresa-piloto-001' }) => {
  const [busca, setBusca] = useState('');
  const [debouncedBusca, setDebouncedBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstoque>('todos');
  const [items, setItems] = useState<ItemProdutoDTO[]>([]);
  const [itensConfig, setItensConfig] = useState<ItensConfig>({
    tabelaPreco: 'PRECO1',
    exibirSaldoFisico: true,
    exibirSaldoFiscal: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce de 300ms na digitação para evitar sobrecarga de requisições
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBusca(busca.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregarItens = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (!debouncedBusca) {
        setItems([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const res = await fetchItems(companyId, debouncedBusca, filtro, 40);
        setItems(res.items || []);
        if (res.config) {
          setItensConfig(res.config);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Não foi possível carregar os itens.');
      } finally {
        setIsLoading(false);
        if (isManualRefresh) setIsRefreshing(false);
      }
    },
    [companyId, debouncedBusca, filtro]
  );

  // Consulta somente quando houver termo de busca
  useEffect(() => {
    if (debouncedBusca) {
      carregarItens(false);
    } else {
      setItems([]);
      setIsLoading(false);
    }
  }, [debouncedBusca, filtro, carregarItens]);

  const handleClearSearch = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(6);
    }
    setBusca('');
    setDebouncedBusca('');
    setItems([]);
    searchInputRef.current?.focus();
  };

  const handleFilterChange = (novoFiltro: FiltroEstoque) => {
    if (novoFiltro === filtro) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(8);
    }
    startTransition(() => {
      setFiltro(novoFiltro);
    });
  };

  const mostrarFisico = itensConfig.exibirSaldoFisico !== false;
  const mostrarFiscal = Boolean(itensConfig.exibirSaldoFiscal);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-md mx-auto">
      {/* 1. Barra de Busca Ergonômica (Hitbox 44px e padding proporcional) */}
      <div className="relative pb-2">
        <div className="relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-stone-400 flex items-center justify-center">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, barras ou nome..."
            className="w-full h-12 pl-10 pr-12 rounded-2xl bg-white border border-emerald-950/10 shadow-xs text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#0f3928] focus:ring-2 focus:ring-[#0f3928]/15 transition-all"
          />
          {busca.length > 0 && (
            <button
              onClick={handleClearSearch}
              aria-label="Limpar campo de busca"
              className="absolute right-1.5 top-1 bottom-1 w-11 flex items-center justify-center text-stone-400 hover:text-stone-700 active:scale-95 transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center">
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filtros Rápidos de Estoque (Apple HIG / M3 Segmented Chips) */}
      <div className="flex items-center space-x-1.5 pb-2.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleFilterChange('todos')}
          className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer border ${
            filtro === 'todos'
              ? 'bg-[#0f3928] text-[#c0ecd6] border-[#0f3928] shadow-xs'
              : 'bg-white text-stone-600 border-stone-200/80 hover:bg-stone-50'
          }`}
        >
          <span>Todos</span>
        </button>

        <button
          onClick={() => handleFilterChange('com_estoque')}
          className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer border ${
            filtro === 'com_estoque'
              ? 'bg-emerald-800 text-emerald-50 border-emerald-800 shadow-xs'
              : 'bg-white text-emerald-800 border-emerald-200/80 hover:bg-emerald-50/50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Com Estoque</span>
        </button>

        <button
          onClick={() => handleFilterChange('sem_estoque')}
          className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer border ${
            filtro === 'sem_estoque'
              ? 'bg-rose-800 text-rose-50 border-rose-800 shadow-xs'
              : 'bg-white text-rose-800 border-rose-200/80 hover:bg-rose-50/50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Zerado / Negativo</span>
        </button>

        {busca.trim() && (
          <button
            onClick={() => carregarItens(true)}
            disabled={isRefreshing || isLoading}
            title="Atualizar lista"
            aria-label="Atualizar lista de itens"
            className="min-h-[44px] min-w-[44px] px-2.5 rounded-xl bg-white border border-stone-200/80 text-stone-500 hover:text-stone-800 active:scale-95 flex items-center justify-center transition-all cursor-pointer ml-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`} />
          </button>
        )}
      </div>

      {/* 3. Indicador de Contagem e Estado (Somente quando houver pesquisa) */}
      {debouncedBusca && (
        <div className="flex items-center justify-between px-1 pb-2 text-[11px] text-stone-500 font-medium">
          <span>
            {isLoading
              ? 'Consultando dados no Firebird...'
              : `${items.length} ${items.length === 1 ? 'item encontrado' : 'itens encontrados'}`}
          </span>
          <span className="truncate max-w-[150px] text-emerald-900 font-semibold">
            "{debouncedBusca}"
          </span>
        </div>
      )}

      {/* 4. Conteúdo Principal */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 no-scrollbar pb-4">
        {errorMessage ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/70 text-rose-900 space-y-2 text-xs">
            <div className="flex items-center space-x-2 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>Falha na comunicação com o banco</span>
            </div>
            <p className="text-stone-600 leading-relaxed">{errorMessage}</p>
            <button
              onClick={() => carregarItens(true)}
              className="min-h-[44px] px-4 rounded-xl bg-rose-700 text-white font-medium active:scale-95 transition-all cursor-pointer"
            >
              Tentar Novamente
            </button>
          </div>
        ) : !debouncedBusca ? (
          // Estado de Espera: Evita sobrecarga no servidor e aguarda digitação do usuário
          <div className="flex flex-col items-center justify-center py-12 px-5 text-center space-y-4 bg-white/70 rounded-3xl border border-emerald-950/5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <PackageSearch className="w-7 h-7 stroke-[1.8]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-stone-800">Pesquise por Código ou Nome</h3>
              <p className="text-xs text-stone-500 leading-relaxed max-w-xs">
                Digite um código, código de barras ou descrição para consultar preços e saldos em tempo real no banco Firebird.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          // Skeletons de Carregamento
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="p-3.5 bg-white rounded-2xl border border-stone-200/60 shadow-2xs animate-pulse space-y-2.5"
              >
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-stone-200 rounded w-16" />
                  <div className="h-4 bg-stone-200 rounded w-20" />
                </div>
                <div className="h-4 bg-stone-200 rounded w-3/4" />
                <div className="flex justify-between items-center pt-1">
                  <div className="h-5 bg-stone-200 rounded w-24" />
                  <div className="h-5 bg-stone-200 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          // Estado de Nenhum Resultado
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3 bg-white/70 rounded-2xl border border-emerald-950/5">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center">
              <Package className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800">Nenhum item localizado</p>
              <p className="text-[11px] text-stone-500 mt-0.5 max-w-xs leading-relaxed">
                Não encontramos nenhum produto correspondente a "{debouncedBusca}". Verifique o código ou descrição.
              </p>
            </div>
            <button
              onClick={handleClearSearch}
              className="min-h-[44px] px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium active:scale-95 transition-all cursor-pointer"
            >
              Limpar Busca
            </button>
          </div>
        ) : (
          // Lista de Produtos Encontrados
          items.map((item) => {
            const saldo1 = item.saldoFisico ?? item.saldo;
            const saldo2 = item.saldoFiscal ?? 0;

            const isSaldo1Positivo = saldo1 > 0;
            const isSaldo1Zerado = saldo1 === 0;
            const isSaldo1Negativo = saldo1 < 0;

            const isSaldo2Positivo = saldo2 > 0;
            const isSaldo2Zerado = saldo2 === 0;
            const isSaldo2Negativo = saldo2 < 0;

            return (
              <ViewTransition key={item.codigo} enter="slide-up" default="none">
                <div className="p-3.5 bg-white rounded-2xl border border-emerald-950/5 shadow-[0_2px_8px_rgba(15,57,40,0.03)] hover:border-emerald-900/20 transition-all space-y-2">
                  {/* Linha 1: Código, Código de Barras e Unidade */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 font-mono text-[12px] font-bold">
                        {item.codigo}
                      </span>

                      {item.codigoBarras && (
                        <span className="text-[10px] text-stone-400 font-mono tracking-tight">
                          EAN: {item.codigoBarras}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-medium text-stone-500 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/50">
                      {item.unidade || 'UN'}
                    </span>
                  </div>

                  {/* Linha 2: Descrição / Nome sem truncamento */}
                  <div>
                    <h3 className="text-xs sm:text-[13px] font-semibold text-stone-900 leading-snug break-words">
                      {item.nome}
                    </h3>
                  </div>

                  {/* Linha 3: Preço de Venda e Saldos de Estoque */}
                  <div className="flex items-start justify-between pt-1.5 border-t border-stone-100/80 gap-3">
                    {/* Bloco de Preço */}
                    <div className="shrink-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 block">
                        {itensConfig.tabelaPreco === 'PRECO2' ? 'Preço 2' : 'Preço 1'}
                      </span>
                      <span className="text-sm font-bold text-[#0f3928] tracking-tight">
                        {formatCurrency(item.preco)}
                      </span>
                    </div>

                    {/* Bloco de Saldos: Físico (SALDOFISICO1) e Fiscal (SALDOFISICO2) */}
                    <div className="flex flex-col items-end gap-1 text-right">
                      {/* Saldo 1: Físico / Principal */}
                      {mostrarFisico && (
                        <div className="flex items-center gap-1.5">
                          {mostrarFiscal && (
                            <span className="text-[10px] font-semibold text-stone-500">
                              Físico:
                            </span>
                          )}
                          {isSaldo1Positivo && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              <span>{formatSaldo(saldo1)}</span>
                              <span className="text-[10px] font-normal text-emerald-800">
                                {item.unidade}
                              </span>
                            </span>
                          )}

                          {isSaldo1Zerado && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                              <span>0 {item.unidade}</span>
                              <span className="text-[10px] text-stone-500 font-medium">(Zerado)</span>
                            </span>
                          )}

                          {isSaldo1Negativo && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-900 border border-rose-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                              <span>{formatSaldo(saldo1)}</span>
                              <span className="text-[10px] font-semibold text-rose-800">
                                {item.unidade}
                              </span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Saldo 2: Fiscal */}
                      {mostrarFiscal && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-stone-500">
                            Fiscal:
                          </span>
                          {isSaldo2Positivo && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              <span>{formatSaldo(saldo2)}</span>
                              <span className="text-[10px] font-normal text-blue-800">
                                {item.unidade}
                              </span>
                            </span>
                          )}

                          {isSaldo2Zerado && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                              <span>0 {item.unidade}</span>
                              <span className="text-[10px] text-stone-400 font-medium">(Zerado)</span>
                            </span>
                          )}

                          {isSaldo2Negativo && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-900 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                              <span>{formatSaldo(saldo2)}</span>
                              <span className="text-[10px] font-semibold text-rose-800">
                                {item.unidade}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ViewTransition>
            );
          })
        )}
      </div>
    </div>
  );
};
