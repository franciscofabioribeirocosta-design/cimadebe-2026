import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Database,
  ShieldCheck,
} from 'lucide-react';
import { useNotification, type NotificationItem } from '../NotificationContext';

export function GlobalToastNotification() {
  const { notifications, dismiss } = useNotification();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-3 pointer-events-none max-w-md w-full px-4 sm:px-0"
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((notif: NotificationItem) => (
          <ToastCard key={notif.id} notif={notif} onDismiss={() => dismiss(notif.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastCardProps {
  readonly notif: NotificationItem;
  readonly onDismiss: () => void;
}

const ToastCard = React.forwardRef<HTMLDivElement, ToastCardProps>(
  function ToastCard({ notif, onDismiss }, ref) {
    const { config, icon: Icon, badgeText } = getToastVisuals(notif.type);

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, x: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`pointer-events-auto relative overflow-hidden rounded-xl border ${config.border} ${config.bg} p-4 shadow-2xl backdrop-blur-xl transition-all`}
      >
      {/* Barra de Progresso com timer automático */}
      {notif.durationMs && notif.durationMs > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: notif.durationMs / 1000, ease: 'linear' }}
          className={`absolute top-0 left-0 h-1 ${config.progress}`}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Ícone Estilizado */}
        <div className={`mt-0.5 rounded-lg p-2 ${config.iconBg} ${config.iconColor} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Conteúdo textual */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-mono uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${config.badge}`}
            >
              {badgeText}
            </span>
            {notif.type !== 'error' && (
              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                <Database className="w-3 h-3 text-cyan-400" /> Transação ACID
              </span>
            )}
          </div>

          <h4 className="text-sm font-semibold text-white tracking-tight leading-snug">
            {notif.title}
          </h4>

          {notif.message && (
            <p className="mt-1 text-xs text-slate-300 leading-relaxed font-sans break-words">
              {notif.message}
            </p>
          )}
        </div>

        {/* Botão de Fechar */}
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          title="Fechar notificação"
          aria-label="Fechar notificação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
});

function getToastVisuals(type: NotificationItem['type']) {
  switch (type) {
    case 'success':
      return {
        icon: CheckCircle2,
        badgeText: 'SUCESSO',
        config: {
          border: 'border-emerald-500/40',
          bg: 'bg-slate-900/95 shadow-emerald-950/40',
          iconBg: 'bg-emerald-500/15',
          iconColor: 'text-emerald-400',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          progress: 'bg-emerald-500',
        },
      };
    case 'error':
      return {
        icon: AlertCircle,
        badgeText: 'ERRO / REJEIÇÃO',
        config: {
          border: 'border-rose-500/40',
          bg: 'bg-slate-900/95 shadow-rose-950/40',
          iconBg: 'bg-rose-500/15',
          iconColor: 'text-rose-400',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          progress: 'bg-rose-500',
        },
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        badgeText: 'ATENÇÃO',
        config: {
          border: 'border-amber-500/40',
          bg: 'bg-slate-900/95 shadow-amber-950/40',
          iconBg: 'bg-amber-500/15',
          iconColor: 'text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          progress: 'bg-amber-500',
        },
      };
    case 'info':
    default:
      return {
        icon: Info,
        badgeText: 'INFORMAÇÃO',
        config: {
          border: 'border-cyan-500/40',
          bg: 'bg-slate-900/95 shadow-cyan-950/40',
          iconBg: 'bg-cyan-500/15',
          iconColor: 'text-cyan-400',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          progress: 'bg-cyan-500',
        },
      };
  }
}
