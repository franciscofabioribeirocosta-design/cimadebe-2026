/**
 * @license
 * CIMADEBE / SIGM - Core Enterprise Platform
 * CUSTOM HOOK: useFirestoreQuotaMonitor
 * Registra e audita o histórico diário de leituras/escritas do Firestore na coleção 'logs_infraestrutura'.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

export interface InfrastructureLogDay {
  id: string; // YYYY-MM-DD
  date: string;
  totalReads: number;
  totalWrites: number;
  totalRequests: number;
  peakUsage: boolean;
  updatedAt: string;
  historicoHorario?: Array<{ hora: string; requisicoes: number }>;
}

export function useFirestoreQuotaMonitor() {
  const [metricsHistory, setMetricsHistory] = useState<InfrastructureLogDay[]>([]);
  const [currentDayMetrics, setCurrentDayMetrics] = useState<InfrastructureLogDay | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const todayKey = new Date().toISOString().split('T')[0];

  // Carregar histórico de infraestrutura do Firestore ('logs_infraestrutura')
  const carregarHistoricoInfraestrutura = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'logs_infraestrutura'), orderBy('date', 'desc'), limit(30));
      const snapshot = await getDocs(q);
      const history: InfrastructureLogDay[] = [];
      snapshot.forEach((docSnap) => {
        history.push({ id: docSnap.id, ...docSnap.data() } as InfrastructureLogDay);
      });
      setMetricsHistory(history);

      const hoje = history.find((h) => h.date === todayKey);
      if (hoje) {
        setCurrentDayMetrics(hoje);
      } else {
        // Inicializa métricas reais de hoje se não existirem
        const novoDia: InfrastructureLogDay = {
          id: todayKey,
          date: todayKey,
          totalReads: 0,
          totalWrites: 0,
          totalRequests: 0,
          peakUsage: false,
          updatedAt: new Date().toISOString()
        };
        setCurrentDayMetrics(novoDia);
      }
    } catch (err: any) {
      console.warn('[useFirestoreQuotaMonitor] Erro ao carregar histórico:', err?.message);
      setError(err?.message || 'Falha ao carregar logs de infraestrutura');
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    carregarHistoricoInfraestrutura();
  }, [carregarHistoricoInfraestrutura]);

  // Função para registrar / atualizar snapshot de cota no Firestore
  const logQuotaSnapshot = useCallback(async (readsIncrement = 1, writesIncrement = 1) => {
    if (!db) return;
    try {
      const docRef = doc(db, 'logs_infraestrutura', todayKey);
      const docSnap = await getDoc(docRef);

      let dadosAtuais: InfrastructureLogDay = docSnap.exists()
        ? (docSnap.data() as InfrastructureLogDay)
        : {
            id: todayKey,
            date: todayKey,
            totalReads: 0,
            totalWrites: 0,
            totalRequests: 0,
            peakUsage: false,
            updatedAt: new Date().toISOString()
          };

      const novasLeituras = (dadosAtuais.totalReads || 0) + readsIncrement;
      const novasEscritas = (dadosAtuais.totalWrites || 0) + writesIncrement;
      const novasRequisicoes = (dadosAtuais.totalRequests || 0) + 1;
      const ehPico = novasRequisicoes >= 40000 || (novasLeituras + novasEscritas) >= 45000;

      const atualizado: InfrastructureLogDay = {
        ...dadosAtuais,
        totalReads: novasLeituras,
        totalWrites: novasEscritas,
        totalRequests: novasRequisicoes,
        peakUsage: ehPico,
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, atualizado, { merge: true });
      setCurrentDayMetrics(atualizado);
    } catch (err: any) {
      console.warn('[useFirestoreQuotaMonitor] Falha ao persistir snapshot no Firestore:', err?.message);
    }
  }, [todayKey]);

  return {
    metricsHistory,
    currentDayMetrics,
    loading,
    error,
    logQuotaSnapshot,
    recarregarHistorico: carregarHistoricoInfraestrutura
  };
}
