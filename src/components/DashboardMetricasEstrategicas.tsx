/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Dashboard de Métricas Estratégicas - Recharts
 * Distribuição Geográfica de Igrejas por Região e Volume de Novas Filiações Mensais
 */

import React, { useMemo, useState } from 'react';
import type { IgrejaFiliada, Ministro } from '../types';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
} from 'recharts';
import {
  Building2,
  TrendingUp,
  MapPin,
  Calendar,
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  CheckCircle2,
  Users,
  Compass,
} from 'lucide-react';

interface DashboardMetricasEstrategicasProps {
  readonly igrejas: readonly IgrejaFiliada[];
  readonly ministros: readonly Ministro[];
  readonly onNavegarIgrejas?: () => void;
  readonly onNavegarMinistros?: () => void;
}

// Cores temáticas elegantes para gráficos
const PALETA_REGIOES = [
  '#0d9488', // Teal 600
  '#06b6d4', // Cyan 500
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#6366f1', // Indigo 500
  '#8b5cf6', // Violet 500
  '#ec4899', // Pink 500
  '#3b82f6', // Blue 500
];

const MESES_NOMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export function DashboardMetricasEstrategicas({
  igrejas,
  ministros,
  onNavegarIgrejas,
  onNavegarMinistros,
}: DashboardMetricasEstrategicasProps) {
  // Filtros de visualização
  const [filtroAno, setFiltroAno] = useState<'TODOS' | '2026' | '2025'>('TODOS');
  const [tipoGraficoRegiao, setTipoGraficoRegiao] = useState<'DONUT' | 'BARRAS'>('DONUT');

  // Mapeamento das macrorregiões da Bahia e Federação com base no município e UF
  const mapearRegiao = (municipio: string, uf: string): string => {
    const mun = (municipio || '').toLowerCase().trim();
    const ufUpper = (uf || 'BA').toUpperCase().trim();

    if (ufUpper !== 'BA' && ufUpper !== '') {
      return `Outros Estados (${ufUpper})`;
    }

    if (
      mun.includes('salvador') ||
      mun.includes('lauro de freitas') ||
      mun.includes('camaçari') ||
      mun.includes('simões filho') ||
      mun.includes('candeias') ||
      mun.includes('dias d') ||
      mun.includes('madre de deus')
    ) {
      return 'Metropolitana de Salvador';
    }

    if (
      mun.includes('feira de santana') ||
      mun.includes('santo antônio de jesus') ||
      mun.includes('cruz das almas') ||
      mun.includes('valença') ||
      mun.includes('amargosa') ||
      mun.includes('cachoeira') ||
      mun.includes('maragogipe')
    ) {
      return 'Recôncavo & Portal do Sertão';
    }

    if (
      mun.includes('vitória da conquista') ||
      mun.includes('jequié') ||
      mun.includes('itapetinga') ||
      mun.includes('brumado') ||
      mun.includes('guanambi') ||
      mun.includes('poções')
    ) {
      return 'Centro-Sul & Sudoeste';
    }

    if (
      mun.includes('ilhéus') ||
      mun.includes('itabuna') ||
      mun.includes('porto seguro') ||
      mun.includes('eunápolis') ||
      mun.includes('teixeira de freitas') ||
      mun.includes('itacaré')
    ) {
      return 'Litoral Sul & Extremo Sul';
    }

    if (
      mun.includes('juazeiro') ||
      mun.includes('paulo afonso') ||
      mun.includes('senhor do bonfim') ||
      mun.includes('jacobina') ||
      mun.includes('serrinha') ||
      mun.includes('euclides da cunha')
    ) {
      return 'Norte & Nordeste Baiano';
    }

    if (
      mun.includes('barreiras') ||
      mun.includes('luís eduardo magalhães') ||
      mun.includes('bom jesus da lapa') ||
      mun.includes('ibotirama') ||
      mun.includes('santa maria da vitória')
    ) {
      return 'Oeste & Velho Chico';
    }

    if (mun.length > 0) {
      // Capitalizar nome do município caso seja cidade única
      return `${municipio} / ${ufUpper}`;
    }

    return 'Região Central / Interior';
  };

  // 1. DADOS DE DISTRIBUIÇÃO POR REGIÃO
  const dadosDistribuicaoRegiao = useMemo(() => {
    const contagem: Record<string, number> = {};

    igrejas.forEach((ig) => {
      const regiao = mapearRegiao(ig.municipio, ig.uf);
      contagem[regiao] = (contagem[regiao] || 0) + 1;
    });

    const lista = Object.entries(contagem).map(([nome, total]) => ({
      name: nome,
      regiao: nome,
      quantidade: total,
      porcentagem: igrejas.length > 0 ? Number(((total / igrejas.length) * 100).toFixed(1)) : 0,
    }));

    // Ordenar do maior para o menor
    lista.sort((a, b) => b.quantidade - a.quantidade);
    return lista;
  }, [igrejas]);

  // Região líder
  const regiaoMaisPresente = useMemo(() => {
    if (dadosDistribuicaoRegiao.length === 0) return { name: 'Nenhuma', quantidade: 0, porcentagem: 0 };
    return dadosDistribuicaoRegiao[0];
  }, [dadosDistribuicaoRegiao]);

  // Total de municípios distintos
  const totalMunicipiosAlcancados = useMemo(() => {
    const setMuns = new Set(igrejas.map((i) => `${i.municipio?.toLowerCase().trim()}-${i.uf?.toUpperCase().trim()}`));
    return setMuns.size;
  }, [igrejas]);

  // 2. DADOS DE VOLUME DE NOVAS FILIAÇÕES MENSAIS
  const dadosFiliacoesMensais = useMemo(() => {
    // Array estruturado dos 12 meses para o gráfico
    const anoAlvo = filtroAno === 'TODOS' ? '2026' : filtroAno;

    const mesesMap: {
      [key: string]: {
        mesRotulo: string;
        mesKey: string;
        novasIgrejas: number;
        novosMinistros: number;
        totalGeral: number;
      };
    } = {};

    MESES_NOMES.forEach((mNome, idx) => {
      const mesNumStr = String(idx + 1).padStart(2, '0');
      const mesChave = `${anoAlvo}-${mesNumStr}`;
      mesesMap[mesChave] = {
        mesRotulo: `${mNome}/${anoAlvo.slice(-2)}`,
        mesKey: mesChave,
        novasIgrejas: 0,
        novosMinistros: 0,
        totalGeral: 0,
      };
    });

    // Contar filiações de igrejas
    igrejas.forEach((ig) => {
      if (!ig.dataFiliacao) return;
      const [ano, mes] = ig.dataFiliacao.split('-');
      if (!ano || !mes) return;

      if (filtroAno === 'TODOS' || ano === filtroAno) {
        const chave = `${anoAlvo}-${mes}`;
        if (mesesMap[chave]) {
          mesesMap[chave].novasIgrejas++;
          mesesMap[chave].totalGeral++;
        }
      }
    });

    // Contar filiações de ministros
    ministros.forEach((min) => {
      const dataRef = min.dataFiliacao || min.dataConsagracao;
      if (!dataRef) return;
      const [ano, mes] = dataRef.split('-');
      if (!ano || !mes) return;

      if (filtroAno === 'TODOS' || ano === filtroAno) {
        const chave = `${anoAlvo}-${mes}`;
        if (mesesMap[chave]) {
          mesesMap[chave].novosMinistros++;
          mesesMap[chave].totalGeral++;
        }
      }
    });

    const resultado = Object.values(mesesMap);

    // Calcular acumulado
    let acumulado = 0;
    return resultado.map((item) => {
      acumulado += item.totalGeral;
      return {
        ...item,
        acumuladoGeral: acumulado,
      };
    });
  }, [igrejas, ministros, filtroAno]);

  // Estatísticas do volume de filiação
  const totalNovasIgrejasPeriodo = useMemo(() => {
    return dadosFiliacoesMensais.reduce((acc, curr) => acc + curr.novasIgrejas, 0);
  }, [dadosFiliacoesMensais]);

  const totalNovosMinistrosPeriodo = useMemo(() => {
    return dadosFiliacoesMensais.reduce((acc, curr) => acc + curr.novosMinistros, 0);
  }, [dadosFiliacoesMensais]);

  const mediaFiliacaoMensal = useMemo(() => {
    const total = totalNovasIgrejasPeriodo + totalNovosMinistrosPeriodo;
    return (total / 12).toFixed(1);
  }, [totalNovasIgrejasPeriodo, totalNovosMinistrosPeriodo]);

  return (
    <div className="space-y-3.5 w-full min-w-0">
      {/* Header Estratégico com Filtros Rápidos */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-slate-900/90 via-teal-950/40 to-slate-900/90 border border-teal-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-teal-400 uppercase">
                INTELIGÊNCIA CONVENCIONAL
              </span>
              <span className="text-[10px] font-mono text-slate-500">• RECHARTS ENGINE</span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
              Métricas Estratégicas & Expansão Territorial
            </h3>
          </div>
        </div>

        {/* Controles de Filtro */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFiltroAno('TODOS')}
              className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                filtroAno === 'TODOS'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Geral
            </button>
            <button
              onClick={() => setFiltroAno('2026')}
              className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                filtroAno === '2026'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2026
            </button>
            <button
              onClick={() => setFiltroAno('2025')}
              className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                filtroAno === '2025'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2025
            </button>
          </div>
        </div>
      </div>

      {/* Mini KPIs de Performance Territorial */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 min-w-0">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Municípios Alcançados</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-cyan-400 mt-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span>{totalMunicipiosAlcancados} cidades</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Presença institucional ativa</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Polo Principal</span>
          <div className="text-sm sm:text-base font-bold text-teal-300 mt-1 truncate">
            {regiaoMaisPresente.name}
          </div>
          <span className="text-[10px] text-teal-400 font-mono mt-1">
            {regiaoMaisPresente.quantidade} igrejas ({regiaoMaisPresente.porcentagem}%)
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Novas Filiações (Ano)</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>+{totalNovasIgrejasPeriodo + totalNovosMinistrosPeriodo}</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {totalNovasIgrejasPeriodo} templos / {totalNovosMinistrosPeriodo} obreiros
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Média Mensal</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-400 mt-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>~{mediaFiliacaoMensal} / mês</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Ritmo de crescimento contínuo</span>
        </div>
      </div>

      {/* Grade 2 Colunas: Distribuição Regional vs Volume Mensal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-3.5 min-w-0">
        {/* GRÁFICO 1: DISTRIBUIÇÃO DE IGREJAS POR REGIÃO */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 backdrop-blur-sm shadow-sm space-y-3 min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5 min-w-0">
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Distribuição de Igrejas por Região</span>
              </h4>
              <p className="text-[11px] text-slate-400 truncate">
                Concentração territorial dos templos federados à CIMADEBE.
              </p>
            </div>

            {/* Alternador de Tipo de Gráfico */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setTipoGraficoRegiao('DONUT')}
                className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                  tipoGraficoRegiao === 'DONUT' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Visualização em Rosca"
              >
                <PieIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTipoGraficoRegiao('BARRAS')}
                className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                  tipoGraficoRegiao === 'BARRAS' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Visualização em Barras"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Área do Gráfico */}
          <div className="h-64 sm:h-72 w-full pt-1">
            {tipoGraficoRegiao === 'DONUT' ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosDistribuicaoRegiao}
                    dataKey="quantidade"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {dadosDistribuicaoRegiao.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PALETA_REGIOES[index % PALETA_REGIOES.length]}
                        stroke="#090d16"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${value} Igrejas (${item?.payload?.porcentagem}%)`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#f8fafc',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosDistribuicaoRegiao}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: any, _: any, item: any) => [
                      `${value} Templos (${item?.payload?.porcentagem}%)`,
                      'Quantidade',
                    ]}
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#f8fafc',
                    }}
                  />
                  <Bar dataKey="quantidade" fill="#0d9488" radius={[0, 4, 4, 0]}>
                    {dadosDistribuicaoRegiao.map((_, index) => (
                      <Cell
                        key={`bar-cell-${index}`}
                        fill={PALETA_REGIOES[index % PALETA_REGIOES.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Rodapé do Card com Link */}
          {onNavegarIgrejas && (
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>{igrejas.length} templos federados</span>
              <button
                onClick={onNavegarIgrejas}
                className="text-teal-400 hover:text-teal-300 font-semibold cursor-pointer flex items-center gap-1"
              >
                <span>Ver Cadastro de Igrejas</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>

        {/* GRÁFICO 2: VOLUME DE NOVAS FILIAÇÕES MENSAIS */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 backdrop-blur-sm shadow-sm space-y-3 min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5 min-w-0">
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Volume de Novas Filiações Mensais</span>
              </h4>
              <p className="text-[11px] text-slate-400 truncate">
                Evolução cronológica de novos templos e obreiros homologados.
              </p>
            </div>

            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded shrink-0">
              EXPANSÃO
            </span>
          </div>

          {/* Área do Gráfico */}
          <div className="h-64 sm:h-72 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dadosFiliacoesMensais}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorIgrejas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorMinistros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="mesRotulo" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    if (name === 'novasIgrejas') return [`${value} Igrejas`, 'Novas Igrejas'];
                    if (name === 'novosMinistros') return [`${value} Obreiros`, 'Novos Ministros'];
                    if (name === 'acumuladoGeral') return [`${value} Total`, 'Acumulado no Ano'];
                    return [value, name];
                  }}
                  contentStyle={{
                    backgroundColor: '#090d16',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#f8fafc',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                  formatter={(value) => {
                    if (value === 'novasIgrejas') return 'Novas Igrejas';
                    if (value === 'novosMinistros') return 'Novos Ministros';
                    if (value === 'acumuladoGeral') return 'Acumulado Geral';
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="novasIgrejas"
                  fill="url(#colorIgrejas)"
                  stroke="#0d9488"
                  strokeWidth={2}
                  name="novasIgrejas"
                />
                <Bar
                  dataKey="novosMinistros"
                  fill="#06b6d4"
                  radius={[4, 4, 0, 0]}
                  barSize={14}
                  name="novosMinistros"
                />
                <Line
                  type="monotone"
                  dataKey="acumuladoGeral"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b' }}
                  name="acumuladoGeral"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Rodapé do Card com Link */}
          {onNavegarMinistros && (
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>{ministros.length} ministros cadastrados</span>
              <button
                onClick={onNavegarMinistros}
                className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer flex items-center gap-1"
              >
                <span>Ver Quadro Ministerial</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
