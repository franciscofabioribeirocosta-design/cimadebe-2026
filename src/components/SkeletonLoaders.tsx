/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção
 * Componentes Skeleton Profissionais com Animação Pulsante (Estilo Neofintech)
 */

import React from 'react';

export function SkeletonCard({ className = '' }: { readonly className?: string }) {
  return (
    <div className={`p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl animate-pulse space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/80" />
        <div className="w-24 h-5 rounded-full bg-slate-800/60" />
      </div>
      <div className="space-y-2">
        <div className="w-3/4 h-6 rounded-xl bg-slate-800/80" />
        <div className="w-1/2 h-4 rounded-lg bg-slate-800/50" />
      </div>
      <div className="pt-4 border-t border-slate-800/50 flex items-center justify-between">
        <div className="w-20 h-4 rounded-md bg-slate-800/60" />
        <div className="w-16 h-8 rounded-xl bg-slate-800/80" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { readonly rows?: number }) {
  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 overflow-hidden shadow-2xl animate-pulse">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <div className="w-48 h-6 rounded-xl bg-slate-800/80" />
        <div className="w-32 h-8 rounded-xl bg-slate-800/60" />
      </div>
      <div className="divide-y divide-slate-800/60">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={`sk-row-${index}`} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 shrink-0" />
              <div className="space-y-2">
                <div className="w-36 h-4 rounded-lg bg-slate-800/80" />
                <div className="w-24 h-3 rounded-md bg-slate-800/50" />
              </div>
            </div>
            <div className="hidden sm:block w-28 h-4 rounded-lg bg-slate-800/60" />
            <div className="w-20 h-6 rounded-full bg-slate-800/80" />
            <div className="w-8 h-8 rounded-xl bg-slate-800/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDetailProfile() {
  return (
    <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-2xl animate-pulse space-y-6">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-slate-800/80 shrink-0" />
        <div className="space-y-3 w-full text-center sm:text-left">
          <div className="w-48 h-7 rounded-xl bg-slate-800/90 mx-auto sm:mx-0" />
          <div className="w-32 h-4 rounded-lg bg-slate-800/60 mx-auto sm:mx-0" />
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-2">
            <div className="w-24 h-6 rounded-full bg-slate-800/70" />
            <div className="w-28 h-6 rounded-full bg-slate-800/70" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/60">
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/50 space-y-2">
          <div className="w-20 h-3 rounded bg-slate-800/60" />
          <div className="w-32 h-5 rounded bg-slate-800/80" />
        </div>
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/50 space-y-2">
          <div className="w-20 h-3 rounded bg-slate-800/60" />
          <div className="w-32 h-5 rounded bg-slate-800/80" />
        </div>
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/50 space-y-2">
          <div className="w-20 h-3 rounded bg-slate-800/60" />
          <div className="w-32 h-5 rounded bg-slate-800/80" />
        </div>
      </div>
    </div>
  );
}
