import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface FormStepperProps {
  readonly steps: readonly StepItem[];
  readonly currentStepId: string;
  readonly onStepClick?: (stepId: string) => void;
  readonly className?: string;
}

export function FormStepper({ steps, currentStepId, onStepClick, className = '' }: FormStepperProps) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === currentStepId));
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 1 ? Math.round((currentIndex / (totalSteps - 1)) * 100) : 100;
  const remainingSteps = totalSteps - 1 - currentIndex;

  return (
    <div className={`w-full space-y-3 font-sans ${className}`}>
      {/* Top Progress Info Bar */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
            Etapa {currentIndex + 1} de {totalSteps}
          </span>
          <span className="text-slate-200 font-semibold text-[11px] hidden sm:inline">
            {steps[currentIndex]?.label || ''}
          </span>
        </div>

        <div className="text-right">
          <span className="text-emerald-400 font-black text-xs">
            {progressPercent}% Concluído
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">
            {remainingSteps > 0
              ? `Falta ${remainingSteps} passo${remainingSteps > 1 ? 's' : ''} para finalizar`
              : '✓ Etapa final do processo'}
          </span>
        </div>
      </div>

      {/* Visual Bar Track */}
      <div className="relative w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-500 ease-out rounded-full shadow-[0_0_12px_rgba(16,185,129,0.8)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Nodes Row */}
      <div className={`grid gap-2 pt-1 ${totalSteps === 3 ? 'grid-cols-3' : totalSteps === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-5'}`}>
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isClickable = Boolean(onStepClick && isCompleted);

          return (
            <div
              key={step.id}
              onClick={() => {
                if (isClickable && onStepClick) {
                  onStepClick(step.id);
                }
              }}
              className={`p-2.5 sm:p-3 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-1.5 ${
                isClickable ? 'cursor-pointer hover:border-emerald-500/50' : ''
              } ${
                isCurrent
                  ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/40'
                  : isCompleted
                  ? 'bg-slate-900/90 border-emerald-500/40 text-slate-200'
                  : 'bg-slate-950/60 border-slate-800/80 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[10px] ${
                    isCompleted
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : isCurrent
                      ? 'bg-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                </div>

                {isCurrent && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              <div>
                <span
                  className={`text-[11px] font-bold block leading-tight truncate ${
                    isCurrent
                      ? 'text-white'
                      : isCompleted
                      ? 'text-emerald-300'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
                {step.sublabel && (
                  <span className="text-[9px] text-slate-400 block truncate font-mono mt-0.5">
                    {step.sublabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
