import React, { useState } from 'react';
import { Building2, MapPin, Filter, Eye, AlertCircle, Search, Globe, Compass, ShieldCheck } from 'lucide-react';
import type { IgrejaFiliada } from '../types';

interface GoogleMapsIgrejasViewProps {
  readonly igrejas: readonly IgrejaFiliada[];
  readonly onSelecionarIgreja: (igrejaId: string) => void;
}

export function GoogleMapsIgrejasView({
  igrejas,
  onSelecionarIgreja,
}: GoogleMapsIgrejasViewProps) {
  const [filtroAtivas, setFiltroAtivas] = useState<boolean>(true);
  const [filtroInativas, setFiltroInativas] = useState<boolean>(true);
  const [buscaTermo, setBuscaTermo] = useState<string>('');
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>('TODOS');
  const [igrejaSelecionada, setIgrejaSelecionada] = useState<IgrejaFiliada | null>(null);

  const municipiosDisponiveis = Array.from(new Set(igrejas.map((i) => i.municipio).filter(Boolean)));

  const igrejasFiltradas = igrejas.filter((ig) => {
    const isAtiva = ig.status === 'ATIVA';
    if (isAtiva && !filtroAtivas) return false;
    if (!isAtiva && !filtroInativas) return false;
    if (filtroMunicipio !== 'TODOS' && ig.municipio !== filtroMunicipio) return false;
    if (buscaTermo.trim()) {
      const termo = buscaTermo.toLowerCase();
      const matchNome = ig.nomeFantasia?.toLowerCase().includes(termo) || ig.razaoSocial?.toLowerCase().includes(termo);
      const matchMun = ig.municipio?.toLowerCase().includes(termo);
      const matchPast = ig.pastorPresidente?.toLowerCase().includes(termo);
      if (!matchNome && !matchMun && !matchPast) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-emerald-950/30 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.1)] backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] tracking-wider uppercase border border-emerald-500/30 flex items-center gap-1.5">
                <Globe className="w-3 h-3 animate-pulse" /> Jurisdição Territorial e Georreferenciamento
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <Compass className="w-7 h-7 text-emerald-400" /> Mapa de Igrejas Filiadas e Congregações
            </h2>
            <p className="text-slate-400 text-xs mt-1 max-w-2xl">
              Visualização espacial interativa das sedes e congregações subordinadas à jurisdição da convenção. Sistema operando em modo de diretório georreferenciado seguro.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800 text-xs font-mono text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Total de Templos: <strong>{igrejas.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome da igreja, município ou pastor presidente..."
            value={buscaTermo}
            onChange={(e) => setBuscaTermo(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div>
          <select
            value={filtroMunicipio}
            onChange={(e) => setFiltroMunicipio(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
          >
            <option value="TODOS">Todos os Municípios ({municipiosDisponiveis.length})</option>
            {municipiosDisponiveis.map((mun) => (
              <option key={mun} value={mun}>{mun}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 px-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-400">
            <input
              type="checkbox"
              checked={filtroAtivas}
              onChange={(e) => setFiltroAtivas(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
            />
            Ativas
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-400">
            <input
              type="checkbox"
              checked={filtroInativas}
              onChange={(e) => setFiltroInativas(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0"
            />
            Inativas
          </label>
        </div>
      </div>

      {/* Grid of Churches / Geolocation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {igrejasFiltradas.map((ig) => {
          const isAtiva = ig.status === 'ATIVA';
          return (
            <div
              key={ig.id}
              onClick={() => {
                setIgrejaSelecionada(ig);
                onSelecionarIgreja(ig.id);
              }}
              className="group p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 shadow-xl hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border ${
                    isAtiva
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                  }`}>
                    {ig.status || 'ATIVA'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {ig.municipio} - {ig.uf || 'BA'}
                  </span>
                </div>

                <h3 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors mb-1.5 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{ig.nomeFantasia}</span>
                </h3>

                <p className="text-xs text-slate-400 line-clamp-1 mb-4">
                  {ig.razaoSocial}
                </p>

                <div className="space-y-1.5 text-xs text-slate-300 font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Pastor Presidente:</span>
                    <span className="text-white font-bold truncate max-w-[160px]">{ig.pastorPresidente || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">CNPJ:</span>
                    <span className="text-slate-300">{ig.cnpj || '00.000.000/0001-00'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {ig.cep || '40000-000'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelecionarIgreja(ig.id);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-500/30"
                >
                  <Eye className="w-3.5 h-3.5" /> Detalhes
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {igrejasFiltradas.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h4 className="text-white font-bold text-base">Nenhuma igreja encontrada</h4>
          <p className="text-slate-400 text-xs mt-1">Tente ajustar os filtros de busca ou o município selecionado.</p>
        </div>
      )}
    </div>
  );
}
