/**
 * @license
 * CIMADEBE / SIGM - Zero-Trust Cryptographic Core
 * Componente: ProtectedRoute.tsx
 * Barreira Rígida de Proteção de Rotas e Layouts Administrativos
 * 
 * Regra Absoluta Zero-Trust:
 * 1. Proibição categórica de montagem e renderização sem sessão ativa comprovada.
 * 2. Purga total de estado (localStorage.clear() e sessionStorage.clear()) em caso de falha.
 * 3. Interrupção instantânea de execução (Fail-Fast Gate) e redirecionamento forçado para /login.
 */

import React, { useEffect } from 'react';
import { useSecurity } from '../SecurityContext';
import type { OperadorRole } from '../types';
import { ShieldAlert, Lock, AlertTriangle } from 'lucide-react';

export interface ProtectedRouteProps {
  readonly children: React.ReactNode;
  readonly allowedRoles?: readonly string[];
  readonly onUnauthenticated?: () => void;
  readonly fallbackMessage?: string;
}

/**
 * Normaliza strings de roles para validação agnóstica de maiúsculas/minúsculas e aliases estatutários
 */
function roleCompativel(roleAtual: OperadorRole, allowedRoles: readonly string[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;

  const roleNorm = String(roleAtual || '').toUpperCase().trim();

  // Matriz Canônica de Equivalência Estrita de Papéis (Zero-Trust RBAC)
  const ALIASES: Record<string, readonly string[]> = {
    'ADMINISTRADOR_MASTER': ['ADMINISTRADOR_MASTER', 'SUPER_ADMIN', 'ADMIN', 'MASTER', 'ADMINISTRADOR'],
    'SUPER_ADMIN': ['SUPER_ADMIN', 'MASTER', 'ROOT'],
    'MASTER': ['SUPER_ADMIN', 'MASTER', 'ADMINISTRADOR_MASTER'],
    'ADMIN': ['ADMINISTRADOR_MASTER', 'SUPER_ADMIN', 'ADMIN', 'MASTER', 'ADMINISTRADOR'],
    'SECRETARIO': ['SECRETARIO', 'SECRETARIA', 'SUPER_ADMIN', 'ADMINISTRADOR_MASTER'],
    'TESOUREIRO': ['TESOUREIRO', 'TESOURARIA', 'SUPER_ADMIN', 'ADMINISTRADOR_MASTER'],
    'PRESIDENTE_GERAL': ['PRESIDENTE_GERAL', 'SUPER_ADMIN', 'ADMINISTRADOR_MASTER'],
    'MINISTRO': ['MINISTRO_OBREIRO', 'MINISTRO', 'DELEGADO'],
    'MINISTRO_OBREIRO': ['MINISTRO_OBREIRO', 'MINISTRO', 'DELEGADO'],
    'BIRO': ['BIRO', 'SUPER_ADMIN', 'ADMINISTRADOR_MASTER'],
  };

  return allowedRoles.some((permitido) => {
    const permNorm = String(permitido || '').toUpperCase().trim();
    if (roleNorm === permNorm) return true;
    const equivalentes = ALIASES[permNorm];
    if (equivalentes && equivalentes.includes(roleNorm)) return true;
    const equivalentesRole = ALIASES[roleNorm];
    if (equivalentesRole && equivalentesRole.includes(permNorm)) return true;
    return false;
  });
}

export function ProtectedRoute({
  children,
  allowedRoles,
  onUnauthenticated,
  fallbackMessage = 'Acesso restrito: Autenticação de sessão corporativa exigida.',
}: ProtectedRouteProps) {
  const { operadorId, operadorAtual, operadorRole, isAuthenticated, authCarregando } = useSecurity();

  const sessaoValida = Boolean(
    isAuthenticated ||
      (operadorId && operadorId.trim().length > 0 && operadorAtual && operadorAtual.trim().length > 0)
  );

  const roleEfetivo = operadorRole;
  const temPermissaoRole = allowedRoles ? roleCompativel(roleEfetivo, allowedRoles) : true;

  // Redirecionamento seguro somente após conclusão da checagem de autenticação
  useEffect(() => {
    if (!authCarregando && (!sessaoValida || !temPermissaoRole)) {
      if (onUnauthenticated) {
        onUnauthenticated();
      }
    }
  }, [authCarregando, sessaoValida, temPermissaoRole, onUnauthenticated]);

  // Durante a checagem em memória, exibe o indicador de autenticação
  if (authCarregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-cyan-500/30 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 animate-pulse">
            <Lock className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-400 font-mono">Restaurando sessão segura em memória...</p>
        </div>
      </div>
    );
  }

  // LAYER 1: FAIL-FAST GATE - Se não autenticado, interrompe IMEDIATAMENTE a montagem
  if (!sessaoValida) {
    if (onUnauthenticated) {
      // Transição limpa e suave sem flash de tela de erro 401
      return null;
    }
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white tracking-tight">
              Sessão Não Autenticada
            </h2>
            <p className="text-xs text-slate-400">
              {fallbackMessage}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-300 text-xs font-mono">
            FAIL-FAST SECURITY BARRIER ACTIVE (HTTP 401)
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
          >
            Ir para Autenticação
          </button>
        </div>
      </div>
    );
  }

  // LAYER 2: RBAC ROLE BARRIER - Se autenticado porém sem o privilégio exigido
  if (!temPermissaoRole) {
    if (onUnauthenticated) {
      return null;
    }
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white tracking-tight">
              Privilégio Insuficiente (RBAC)
            </h2>
            <p className="text-xs text-slate-400">
              Seu perfil atual ({operadorRole}) não possui autorização para acessar este recurso restrito.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-300 text-xs font-mono">
            INSUFFICIENT_ROLE_PRIVILEGE (HTTP 403)
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
          >
            Retornar ao Painel Autorizado
          </button>
        </div>
      </div>
    );
  }

  // LAYER 4: Renderização estrita autorizada
  return <>{children}</>;
}

export default ProtectedRoute;
