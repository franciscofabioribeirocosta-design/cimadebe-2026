/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Página de Notificação Formal de Pendência & Restrição de Inscrição (Em conformidade com o Código de Defesa do Consumidor - CDC)
 * Dados institucionais puxados dinamicamente do banco de dados (Firestore).
 */

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowLeft, AlertCircle, FileText, Phone, Mail } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import type { Ministro } from '../types';
import { useSecurity } from '../SecurityContext';

export function PaginaRegularizar() {
  const { appConfig, igrejasFiliadas } = useSecurity();
  const [ministro, setMinistro] = useState<Ministro | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  // Dados dinâmicos oficiais extraídos do banco de dados (AppConfig ou Igreja Sede)
  const igrejaSede = igrejasFiliadas.find((i) => i.chaveSede || i.tenantId === 't-sede-salvador') || igrejasFiliadas[0];
  const telefoneInstitucional = appConfig?.telefoneConvencao || igrejaSede?.telefone || '(71) 3322-8900';
  const emailInstitucional = igrejaSede?.email || 'tesouraria@cimadebe.org.br';

  useEffect(() => {
    async function carregarMinistroPendente() {
      try {
        setCarregando(true);
        const cpfSalvo = typeof window !== 'undefined' ? localStorage.getItem('sigm_cpf_regularizando') || localStorage.getItem('sigm_ministro_id') : null;
        
        if (!cpfSalvo) {
          setErro('Nenhum ministro identificado. Retorne à portaria e informe seu CPF.');
          setCarregando(false);
          return;
        }

        const cleanCpf = cpfSalvo.replace(/\D/g, '');
        let minEncontrado: Ministro | null = null;

        const qCpfFmt = query(collection(db, 'ministros'), where('cpf', '==', cleanCpf.length === 11 ? cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : cleanCpf), limit(1));
        const snapFmt = await getDocs(qCpfFmt);
        if (!snapFmt.empty) {
          const d = snapFmt.docs[0];
          minEncontrado = { ...d.data(), id: d.id } as Ministro;
        } else {
          const qRaw = query(collection(db, 'ministros'), where('cpf', '==', cleanCpf), limit(1));
          const snapRaw = await getDocs(qRaw);
          if (!snapRaw.empty) {
            const d = snapRaw.docs[0];
            minEncontrado = { ...d.data(), id: d.id } as Ministro;
          } else {
            const docRef = await getDoc(doc(db, 'ministros', cleanCpf));
            if (docRef.exists()) {
              minEncontrado = { ...docRef.data(), id: docRef.id } as Ministro;
            }
          }
        }

        if (minEncontrado) {
          setMinistro(minEncontrado);
        } else {
          setErro('Ministro não encontrado na base de dados da Convenção.');
        }
      } catch (e: any) {
        setErro('Erro ao carregar dados do ministro: ' + (e?.message || 'Erro desconhecido'));
      } finally {
        setCarregando(false);
      }
    }

    carregarMinistroPendente();
  }, []);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Bar de Retorno */}
      <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 py-3.5 sticky top-0 z-50 backdrop-blur-xl flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar ao Portal Principal</span>
        </button>
        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/80 border border-amber-500/30 px-2.5 py-1 rounded-lg">
          COMUNICADO OFICIAL • {appConfig?.sigla || 'CIMADEBE'}
        </span>
      </div>

      {/* Container Principal */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
            RESTRIÇÃO TEMPORÁRIA DE INSCRIÇÃO
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Aviso formal emitido em conformidade com as diretrizes estatutárias e princípios de transparência institucional.
          </p>
        </div>

        {carregando ? (
          <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-4 shadow-2xl">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <span className="text-xs font-mono text-slate-300">Consultando registro ministerial...</span>
          </div>
        ) : erro ? (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-slate-200 text-center space-y-4 shadow-xl">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <h3 className="text-base font-bold font-mono">Aviso Institucional</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">{erro}</p>
            <button
              type="button"
              onClick={() => window.location.href = '/'}
              className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all cursor-pointer"
            >
              Retornar ao Início
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Card de Identificação */}
            {ministro && (
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center justify-center font-bold text-lg overflow-hidden shrink-0">
                  {ministro.fotoUrl ? (
                    <img src={ministro.fotoUrl} alt={ministro.nome} className="w-full h-full object-cover" />
                  ) : (
                    ministro.nome.charAt(0)
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                    MINISTRO IDENTIFICADO
                  </span>
                  <h3 className="text-base font-black text-white">{ministro.nome}</h3>
                  <p className="text-xs font-mono text-slate-400">CPF: {ministro.cpf} • Cargo: {ministro.cargo || 'Ministro'}</p>
                </div>
              </div>
            )}

            {/* Mensagem Formal em Conformidade com o Código de Defesa do Consumidor (CDC) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-2xl space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <FileText className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-white">Comunicado Oficial de Pendência Contábil</h3>
                  <span className="text-[11px] font-mono text-slate-400">{appConfig?.nomeConvencao || 'Convenção Geral das Assembleias de Deus'}</span>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  Prezado(a) Ministro(a),
                </p>
                <p>
                  Informamos que, em virtude de pendências financeiras e contábeis em aberto (anuidades estatutárias anteriores), o sistema de autogerenciamento restringe temporariamente a efetivação de novas inscrições em conclaves e Assembleias Gerais Ordinárias (AGO) até que a situação seja regularizada junto à Tesouraria Geral.
                </p>
                <p className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-amber-200 font-mono text-xs leading-relaxed">
                  <strong>Nota de Transparência (Código de Defesa do Consumidor - CDC):</strong><br />
                  A Convenção assegura total clareza e direito à informação prévia, abstendo-se de praticar cobranças automatizadas em ambiente de inscrição pública. O processamento e a quitação de débitos devem ser tratados diretamente com a Secretaria Executiva ou Tesouraria Oficial da Convenção através dos canais de atendimento abaixo, extraídos diretamente da base de dados oficial.
                </p>
                <p>
                  Caso haja divergência nas informações cadastrais ou para obtenção de orientações sobre regularização, por favor entre em contato com a secretaria.
                </p>
              </div>

              {/* Canais de Atendimento (Puxados do Banco de Dados) */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 font-mono block">Atendimento Telefônico (Banco)</span>
                    <span className="text-xs font-bold text-white font-mono truncate block">{telefoneInstitucional}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 font-mono block">E-mail Institucional (Banco)</span>
                    <span className="text-xs font-bold text-white font-mono truncate block">{emailInstitucional}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => window.location.href = '/'}
                  className="py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all cursor-pointer shadow"
                >
                  Retornar ao Início do Portal
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PaginaRegularizar;
