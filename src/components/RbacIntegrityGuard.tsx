/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Componente: RbacIntegrityGuard.tsx (SRP)
 * Responsabilidade Única: Guardião de Integridade e Barreira de Acesso RBAC para Rotas e Componentes Críticos
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Lock,
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Building2,
  User,
  Fingerprint,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { useSecurity } from '../SecurityContext';
import type { RecursoCritico } from '../types';

interface RbacIntegrityGuardProps {
  readonly recurso: RecursoCritico;
  readonly tenantIdAlvo?: string;
  readonly children: React.ReactNode;
  readonly onRedirecionarInicio?: () => void;
  readonly onSolicitarElevacao?: () => void;
}

const NOMES_RECURSOS: Record<RecursoCritico, { titulo: string; departamento: string; nivelMinimo: string }> = {
  TESOURARIA_DRE: {
    titulo: 'Tesouraria Contábil, DRE & Conciliação Asaas',
    departamento: 'Controladoria & Tesouraria Geral',
    nivelMinimo: 'TESOUREIRO ou SUPER_ADMIN',
  },
  SECRETARIA_GERAL: {
    titulo: 'Secretaria Executiva & Atas Ministeriais',
    departamento: 'Secretaria Geral Eclesiástica',
    nivelMinimo: 'SECRETARIO ou SUPER_ADMIN',
  },
  GOVERNANCA_MASTER: {
    titulo: 'Bunker de Governança & Parâmetros Root',
    departamento: 'Super Master / Presidência Geral',
    nivelMinimo: 'SUPER_ADMIN (Exclusivo)',
  },
  ADMINISTRACAO_GERAL: {
    titulo: 'Painel Central Administrativo',
    departamento: 'Diretoria Executiva',
    nivelMinimo: 'ADMINISTRADOR ou SUPER_ADMIN',
  },
  GESTAO_USUARIOS: {
    titulo: 'Gestão de Usuários e Chaves Administrativas',
    departamento: 'Governança & Segurança da Informação',
    nivelMinimo: 'SUPER_ADMIN (Exclusivo)',
  },
  GESTAO_MINISTROS: {
    titulo: 'Cadastro Geral e Ficha Cadastral de Obreiros',
    departamento: 'Secretaria Geral',
    nivelMinimo: 'SECRETARIO ou SUPER_ADMIN',
  },
  GESTAO_IGREJAS: {
    titulo: 'Gestão de Igrejas Filiadas e Congregações',
    departamento: 'Secretaria Geral',
    nivelMinimo: 'SECRETARIO ou SUPER_ADMIN',
  },
  MESA_DIRETORA: {
    titulo: 'Gestão da Mesa Diretora Estatutária',
    departamento: 'Presidência & Secretaria',
    nivelMinimo: 'SECRETARIO ou SUPER_ADMIN',
  },
  GESTAO_AGO: {
    titulo: 'Homologação e Gestão de Inscrições da AGO',
    departamento: 'Comissão Organizadora AGO',
    nivelMinimo: 'SECRETARIO ou SUPER_ADMIN',
  },
  BIRO_IMPRESSAO: {
    titulo: 'Birô Gráfico de Credenciais Térmicas CR-80',
    departamento: 'Birô Central de Identificação',
    nivelMinimo: 'SUPER_ADMIN, SECRETARIO ou MINISTRO_OBREIRO',
  },
  COMPLIANCE_AUDITORIA: {
    titulo: 'Protocolo de Compliance e Trilha de Auditoria',
    departamento: 'Conselho Fiscal & Auditoria',
    nivelMinimo: 'AUDITOR_COMPLIANCE, CONSELHO_ETICA ou SUPER_ADMIN',
  },
};

export function RbacIntegrityGuard({
  recurso,
  tenantIdAlvo,
  children,
  onRedirecionarInicio,
  onSolicitarElevacao,
}: RbacIntegrityGuardProps) {
  const { validarIntegridadeAcesso, operadorAtual, operadorId, operadorRole, tenantAtivoId, alternarOperadorRole } = useSecurity() || {};

  const checagem = validarIntegridadeAcesso ? validarIntegridadeAcesso(recurso, tenantIdAlvo) : { permitido: false, codigoBloqueio: 'SESSÃO_INVALIDA', motivo: 'Carregando integridade...', hashAuditoria: undefined as string | undefined };

  if (checagem.permitido) {
    return <>{children}</>;
  }

  // Se a sessão está vazia ou sem privilégios (durante logout ou transição de login), não renderiza banner alarmante de veto
  if (!operadorAtual || !operadorId || operadorRole === 'CONSULTA_PUBLICA') {
    return null;
  }

  const metaRecurso = NOMES_RECURSOS[recurso] || {
    titulo: recurso,
    departamento: 'Área Restrita',
    nivelMinimo: 'SUPER_ADMIN',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="p-6 sm:p-10 my-4 rounded-3xl bg-slate-900/90 border border-rose-500/40 shadow-[0_0_50px_rgba(244,63,94,0.15)] backdrop-blur-2xl text-slate-100 max-w-4xl mx-auto space-y-6 font-sans relative overflow-hidden"
    >
      {/* Glow de Fundo */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header do Bloqueio de Integridade */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-rose-500/20 pb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-950 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.3)] shrink-0">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-rose-400 bg-rose-950/80 border border-rose-500/30 px-2 py-0.5 rounded">
                VETO DE INTEGRIDADE (RBAC LEVEL 4)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                CÓDIGO: {checagem.codigoBloqueio || 'ACESSO_RESTRITO'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Acesso Bloqueado ao Componente
            </h2>
          </div>
        </div>

        <div className="text-right font-mono text-xs hidden sm:block">
          <span className="text-slate-500 text-[10px] block uppercase">Proteção Anti-IDOR</span>
          <span className="text-emerald-400 font-bold">ISOLAMENTO ATIVO</span>
        </div>
      </div>

      {/* Descrição do Recurso e Motivo */}
      <div className="space-y-4 relative z-10">
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">RECURSO REQUISITADO:</span>
            <span className="text-white font-bold">{metaRecurso.titulo}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">DEPARTAMENTO:</span>
            <span className="text-cyan-400">{metaRecurso.departamento}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">CREDENCIAL EXIGIDA:</span>
            <span className="text-amber-400 font-bold">{metaRecurso.nivelMinimo}</span>
          </div>
        </div>

        {/* Motivo Detalhado */}
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200/90 leading-relaxed font-mono space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>MOTIVO DA RECUSA DE ACESSO:</span>
          </div>
          <p>{checagem.motivo}</p>
        </div>

        {/* Metadados da Sessão e Hash de Auditoria */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase">Operador Atual</span>
            <span className="text-slate-200 font-bold truncate block">{operadorAtual}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase">Perfil / Role</span>
            <span className="text-rose-400 font-bold">{operadorRole}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase">Tenant</span>
            <span className="text-cyan-300 font-bold truncate block">{tenantAtivoId}</span>
          </div>
        </div>

        {checagem.hashAuditoria && (
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[10px] font-mono text-slate-500 flex items-center justify-between">
            <span>HASH DO LOG DE AUDITORIA:</span>
            <span className="text-slate-400 truncate max-w-md">{checagem.hashAuditoria}</span>
          </div>
        )}
      </div>

      {/* Botões de Ação Segura */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80 relative z-10">
        <button
          type="button"
          onClick={onRedirecionarInicio}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Painel Geral</span>
        </button>
      </div>
    </motion.div>
  );
}
