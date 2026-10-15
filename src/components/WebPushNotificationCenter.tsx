import React, { useState, useEffect } from 'react';
import {
  isWebPushSupported,
  obterStatusPermissaoPush,
  solicitarPermissaoWebPush,
  dispararAlertaVencimentoAnuidade,
  dispararNotificacaoNovaNoticia,
  dispararNotificacaoConvocacaoAgo,
  salvarPreferenciaPushMinistro
} from '../services/webPushService';
import { Ministro, AnuidadeMinistro } from '../types';
import { useNotification } from '../NotificationContext';
import { db } from '../firebase';
import { Newspaper, Calendar, Bell, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';

interface WebPushNotificationCenterProps {
  readonly ministro: Ministro;
  readonly anuidadePrincipal?: AnuidadeMinistro;
}

export const WebPushNotificationCenter: React.FC<WebPushNotificationCenterProps> = ({
  ministro,
  anuidadePrincipal
}) => {
  const { notifySuccess, notifyError, notifyWarning, notifyInfo } = useNotification();
  const [suportado, setSuportado] = useState<boolean>(true);
  const [permissao, setPermissao] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [solicitando, setSolicitando] = useState<boolean>(false);
  const [testandoTipo, setTestandoTipo] = useState<'noticia' | 'ago' | 'anuidade' | null>(null);

  useEffect(() => {
    const isSup = isWebPushSupported();
    setSuportado(isSup);
    if (isSup) {
      setPermissao(obterStatusPermissaoPush());
    } else {
      setPermissao('unsupported');
    }
  }, []);

  const handleAtivarNotificacoes = async () => {
    setSolicitando(true);
    try {
      const res = await solicitarPermissaoWebPush();
      setPermissao(res.status);

      if (res.success) {
        notifySuccess(
          '🔔 Notificações PUSH Ativadas via Service Worker!',
          'Você receberá alertas em tempo real sobre novas notícias, convocações da AGO e prazos de anuidade.'
        );
        if (ministro?.id) {
          await salvarPreferenciaPushMinistro(db, ministro.id, true);
        }
      } else if (res.status === 'denied') {
        notifyError(
          'Permissão de Notificação Bloqueada',
          'Para receber alertas de notícias e convocações da AGO, libere as notificações nas configurações do seu navegador.'
        );
      } else {
        notifyWarning(
          'Aviso de Notificação',
          res.error || 'A permissão não foi concedida.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notifyError('Erro ao Configurar Web Push', msg);
    } finally {
      setSolicitando(false);
    }
  };

  const handleTestarNoticia = async () => {
    if (permissao !== 'granted') {
      notifyWarning('Ative as Notificações', 'Clique em "Ativar Notificações PUSH" para receber no seu dispositivo.');
      return;
    }
    setTestandoTipo('noticia');
    try {
      const ok = await dispararNotificacaoNovaNoticia({
        titulo: 'Edital Geral de Resoluções e Atas da Convenção',
        subtitulo: 'A Mesa Diretora publicou novas diretrizes para homologação ministerial e projetos eclesiásticos 2026.',
        categoria: 'Comunicado Oficial'
      });
      if (ok) {
        notifyInfo('🔔 PUSH de Notícia Enviado', 'Verifique a notificação oficial do Service Worker no seu sistema.');
      }
    } finally {
      setTestandoTipo(null);
    }
  };

  const handleTestarConvocacaoAgo = async () => {
    if (permissao !== 'granted') {
      notifyWarning('Ative as Notificações', 'Clique em "Ativar Notificações PUSH" para receber no seu dispositivo.');
      return;
    }
    setTestandoTipo('ago');
    try {
      const ok = await dispararNotificacaoConvocacaoAgo({
        titulo: '1ª Assembleia Geral Ordinária (AGO 2026)',
        subtitulo: 'Grande Conclave Geral de Obreiros e Plenárias Deliberativas.',
        local: 'Centro de Convenções Pastor Gilberto • Salvador / BA',
        periodo: '20 a 23 de Novembro de 2026',
        temaBiblico: '“Permanecendo Firmes na Vocação da Glória” (1 Co 15:58)'
      });
      if (ok) {
        notifyInfo('🔔 PUSH de Convocação da AGO Enviado', 'Verifique a notificação oficial do Service Worker no seu sistema.');
      }
    } finally {
      setTestandoTipo(null);
    }
  };

  const handleTestarAnuidade = async () => {
    if (permissao !== 'granted') {
      notifyWarning('Ative as Notificações', 'Clique em "Ativar Notificações PUSH" para receber no seu dispositivo.');
      return;
    }
    setTestandoTipo('anuidade');
    try {
      const ano = anuidadePrincipal?.anoVigente || new Date().getFullYear();
      const venc = anuidadePrincipal?.dataVencimento || new Date().toISOString().split('T')[0];
      const valor = anuidadePrincipal?.valor || 190;

      const ok = await dispararAlertaVencimentoAnuidade({
        ministroNome: ministro.nome,
        anoVigente: ano,
        dataVencimento: venc,
        valor,
        statusCalculado: anuidadePrincipal?.statusPagamento === 'PAGO' ? 'EM_DIA' : 'PENDENTE'
      });
      if (ok) {
        notifyInfo('🔔 PUSH de Anuidade Enviado', 'Verifique a notificação oficial do Service Worker no seu sistema.');
      }
    } finally {
      setTestandoTipo(null);
    }
  };

  if (!suportado) {
    return (
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔕</span>
          <div>
            <p className="font-semibold text-slate-300">Notificações Push Não Suportadas</p>
            <p className="text-slate-500">Este navegador ou contexto não possui suporte para Web Push API.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-emerald-500/30 shadow-xl relative overflow-hidden backdrop-blur-md space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-inner ${
            permissao === 'granted'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : permissao === 'denied'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          }`}>
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>Notificações PUSH Oficiais (Service Worker)</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h4>
              {permissao === 'granted' ? (
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Ativas no Dispositivo
                </span>
              ) : permissao === 'denied' ? (
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-rose-400" />
                  Bloqueadas nas Configurações do Navegador
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                  Pendente de Ativação
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Receba alertas instantâneos na tela do seu celular ou computador sempre que uma <strong className="text-white">nova notícia</strong> ou <strong className="text-amber-400">convocação oficial da AGO</strong> for publicada no sistema.
            </p>
            {permissao === 'denied' && (
              <div className="mt-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-rose-300">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Como desbloquear as notificações no seu navegador:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 pl-1">
                  <li>Clique no ícone de <strong>Cadeado 🔒</strong> ou <strong>Ajustes do Site</strong> ao lado da barra de endereço URL.</li>
                  <li>Localize a opção <strong>Notificações</strong> e altere de <em>Bloquear</em> para <strong>Permitir</strong>.</li>
                  <li>Após permitir, clique no botão <strong>Recarregar / Verificar Permissão</strong> abaixo.</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
          {permissao === 'denied' ? (
            <button
              onClick={() => {
                const statusAtual = obterStatusPermissaoPush();
                setPermissao(statusAtual);
                if (statusAtual === 'granted') {
                  notifySuccess('Notificações Desbloqueadas!', 'Suas notificações agora estão ativas.');
                } else {
                  notifyWarning(
                    'Ainda Bloqueado no Navegador',
                    'Altere a permissão para "Permitir" no ícone de cadeado da barra de endereço e tente novamente.'
                  );
                }
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 cursor-pointer active:scale-95"
            >
              <Bell className="w-4 h-4" />
              <span>Verificar Permissão do Navegador</span>
            </button>
          ) : permissao !== 'granted' ? (
            <button
              onClick={handleAtivarNotificacoes}
              disabled={solicitando}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {solicitando ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registrando Service Worker...</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Ativar Notificações PUSH</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* Painel de Testes Interativos para o Ministro quando Ativas */}
      {permissao === 'granted' && (
        <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <span className="text-[11px] font-mono text-slate-400">
            Canais monitorados pelo Service Worker:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleTestarNoticia}
              disabled={Boolean(testandoTipo)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Testar push de nova notícia publicada"
            >
              <Newspaper className="w-3.5 h-3.5 text-sky-400" />
              <span>{testandoTipo === 'noticia' ? 'Emitindo...' : 'Testar PUSH Notícia'}</span>
            </button>

            <button
              onClick={handleTestarConvocacaoAgo}
              disabled={Boolean(testandoTipo)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Testar push de convocação oficial da AGO"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>{testandoTipo === 'ago' ? 'Emitindo...' : 'Testar PUSH Convocação AGO'}</span>
            </button>

            <button
              onClick={handleTestarAnuidade}
              disabled={Boolean(testandoTipo)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Testar push de vencimento de anuidade"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-400" />
              <span>{testandoTipo === 'anuidade' ? 'Emitindo...' : 'Testar PUSH Anuidade'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
