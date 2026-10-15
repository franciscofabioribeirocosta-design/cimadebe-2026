import React from 'react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';

export interface PaginacaoGeralProps {
  readonly totalItems: number;
  readonly itensPorPagina: number | 'TODOS';
  readonly paginaAtual: number;
  readonly onMudancaPagina: (novaPagina: number) => void;
  readonly onMudancaItensPorPagina: (qtd: number | 'TODOS') => void;
  readonly opcoesItens?: readonly (number | 'TODOS')[];
}

export function PaginacaoGeral({
  totalItems,
  itensPorPagina,
  paginaAtual,
  onMudancaPagina,
  onMudancaItensPorPagina,
  opcoesItens = [15, 30, 50, 'TODOS'],
}: PaginacaoGeralProps) {
  if (totalItems === 0) return null;

  const totalPaginas =
    itensPorPagina === 'TODOS'
      ? 1
      : Math.max(1, Math.ceil(totalItems / itensPorPagina));

  const inicio =
    itensPorPagina === 'TODOS' ? 1 : (paginaAtual - 1) * itensPorPagina + 1;
  const fim =
    itensPorPagina === 'TODOS'
      ? totalItems
      : Math.min(paginaAtual * itensPorPagina, totalItems);

  // Gera lista de páginas a exibir com suporte a elipses se houver muitas páginas
  const gerarBotoesPagina = () => {
    if (totalPaginas <= 7) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    const paginas: (number | string)[] = [];
    paginas.push(1);
    if (paginaAtual > 3) paginas.push('...');
    
    const min = Math.max(2, paginaAtual - 1);
    const max = Math.min(totalPaginas - 1, paginaAtual + 1);
    for (let p = min; p <= max; p++) {
      paginas.push(p);
    }

    if (paginaAtual < totalPaginas - 2) paginas.push('...');
    paginas.push(totalPaginas);
    return paginas;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-300 animate-fadeIn mt-4">
      {/* 1. Indicador do Total de Registros Exibidos */}
      <div className="flex items-center gap-2 text-slate-400">
        <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Exibindo <strong className="text-white font-bold">{inicio}</strong> a{' '}
          <strong className="text-white font-bold">{fim}</strong> de{' '}
          <strong className="text-emerald-400 font-bold">{totalItems}</strong> registros
        </span>
      </div>

      {/* 2. Controles de Navegação por Página */}
      {itensPorPagina !== 'TODOS' && totalPaginas > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onMudancaPagina(Math.max(1, paginaAtual - 1))}
            disabled={paginaAtual === 1}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Página Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {gerarBotoesPagina().map((item, idx) => {
            if (typeof item === 'string') {
              return (
                <span key={`dots-${idx}`} className="px-2 text-slate-500 font-bold">
                  ...
                </span>
              );
            }
            const estaAtiva = item === paginaAtual;
            return (
              <button
                key={`page-${item}`}
                onClick={() => onMudancaPagina(item)}
                className={`min-w-[34px] h-[34px] rounded-xl px-2.5 flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                  estaAtiva
                    ? 'bg-emerald-500 text-slate-950 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)] scale-105'
                    : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item}
              </button>
            );
          })}

          <button
            onClick={() => onMudancaPagina(Math.min(totalPaginas, paginaAtual + 1))}
            disabled={paginaAtual === totalPaginas}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Próxima Página"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Seletor de Itens por Página (15 / 30 / 50 / TODOS) */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 hidden sm:inline">Exibir:</span>
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          {opcoesItens.map((opcao) => {
            const estaSelecionada = itensPorPagina === opcao;
            return (
              <button
                key={`opt-${opcao}`}
                onClick={() => {
                  onMudancaItensPorPagina(opcao);
                  onMudancaPagina(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  estaSelecionada
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opcao === 'TODOS' ? 'Todos' : opcao}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
