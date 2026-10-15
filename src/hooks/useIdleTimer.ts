import { useState, useEffect, useRef, useCallback } from 'react';

interface UseIdleTimerOptions {
  emLogout: () => void;
  ativo?: boolean;
}

const TEMPO_TOTAL_MS = 30 * 60 * 1000; // 30 minutos (1.800.000 ms)
const TEMPO_AVISO_MS = 29 * 60 * 1000; // 29 minutos (1.740.000 ms)
const SEGUNDOS_CONTAGEM = 60; // 60 segundos de aviso

export function useIdleTimer({ emLogout, ativo = true }: UseIdleTimerOptions) {
  const [mostrarAviso, setMostrarAviso] = useState<boolean>(false);
  const [segundosRestantes, setSegundosRestantes] = useState<number>(SEGUNDOS_CONTAGEM);

  const timestampUltimaAtividadeRef = useRef<number>(Date.now());
  const timerAvisoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerLogoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalContagemRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emLogoutRef = useRef<() => void>(emLogout);

  useEffect(() => {
    emLogoutRef.current = emLogout;
  }, [emLogout]);

  const limparTodosTimers = useCallback(() => {
    if (timerAvisoRef.current) {
      clearTimeout(timerAvisoRef.current);
      timerAvisoRef.current = null;
    }
    if (timerLogoutRef.current) {
      clearTimeout(timerLogoutRef.current);
      timerLogoutRef.current = null;
    }
    if (intervalContagemRef.current) {
      clearInterval(intervalContagemRef.current);
      intervalContagemRef.current = null;
    }
  }, []);

  const iniciarContagemRegressiva = useCallback(() => {
    setMostrarAviso(true);
    setSegundosRestantes(SEGUNDOS_CONTAGEM);

    if (intervalContagemRef.current) {
      clearInterval(intervalContagemRef.current);
    }

    const fimEsperado = Date.now() + SEGUNDOS_CONTAGEM * 1000;

    intervalContagemRef.current = setInterval(() => {
      const restoSegundos = Math.max(0, Math.ceil((fimEsperado - Date.now()) / 1000));
      setSegundosRestantes(restoSegundos);

      if (restoSegundos <= 0) {
        if (intervalContagemRef.current) {
          clearInterval(intervalContagemRef.current);
          intervalContagemRef.current = null;
        }
      }
    }, 1000);
  }, []);

  const programarTimers = useCallback(() => {
    limparTodosTimers();
    setMostrarAviso(false);
    setSegundosRestantes(SEGUNDOS_CONTAGEM);
    timestampUltimaAtividadeRef.current = Date.now();

    if (!ativo) return;

    // Timer para acionar aviso aos 29 minutos
    timerAvisoRef.current = setTimeout(() => {
      iniciarContagemRegressiva();
    }, TEMPO_AVISO_MS);

    // Timer definitivo de logout aos 30 minutos
    timerLogoutRef.current = setTimeout(() => {
      limparTodosTimers();
      setMostrarAviso(false);
      emLogoutRef.current();
    }, TEMPO_TOTAL_MS);
  }, [ativo, limparTodosTimers, iniciarContagemRegressiva]);

  const continuarSessao = useCallback(() => {
    programarTimers();
  }, [programarTimers]);

  useEffect(() => {
    if (!ativo) {
      limparTodosTimers();
      setMostrarAviso(false);
      return;
    }

    programarTimers();

    const eventos = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

    const lidarComAtividade = () => {
      // Se o modal de aviso já estiver visível, exige que o usuário clique em "Continuar Conectado"
      if (mostrarAviso) return;

      const agora = Date.now();
      // Throttling de 1 segundo para poupar recálculos excessivos
      if (agora - timestampUltimaAtividadeRef.current > 1000) {
        timestampUltimaAtividadeRef.current = agora;
        programarTimers();
      }
    };

    eventos.forEach((evento) => {
      window.addEventListener(evento, lidarComAtividade, { passive: true });
    });

    return () => {
      eventos.forEach((evento) => {
        window.removeEventListener(evento, lidarComAtividade);
      });
      limparTodosTimers();
    };
  }, [ativo, mostrarAviso, programarTimers, limparTodosTimers]);

  return {
    mostrarAviso,
    segundosRestantes,
    continuarSessao,
  };
}
