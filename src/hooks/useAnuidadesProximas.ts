import { useMemo } from 'react';
import type { AnuidadeMinistro } from '../types';

export interface AnuidadeItem {
  readonly id: string;
  readonly ano: number;
  readonly valor: number;
  readonly vencimento: string;
  readonly status: string;
  readonly rawAnuidade?: AnuidadeMinistro;
}

export interface AnuidadeProximaInfo extends AnuidadeItem {
  readonly diasRestantes: number;
  readonly dataVencFormatada: string;
  readonly textoPrazo: string;
}

export function useAnuidadesProximas(
  anuidades: readonly AnuidadeItem[],
  diasLimite: number = 30
) {
  return useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const listaComDias: AnuidadeProximaInfo[] = [];

    for (const item of anuidades) {
      const statusUpper = (item.status || '').toUpperCase();
      if (['PAGO', 'LIQUIDADO', 'CONFIRMADO', 'ANISTIADO'].includes(statusUpper)) {
        continue;
      }
      if (!item.vencimento) continue;

      const vencStr = item.vencimento.split('T')[0];
      const dataVenc = new Date(`${vencStr}T00:00:00`);
      if (isNaN(dataVenc.getTime())) continue;

      const diffMs = dataVenc.getTime() - hoje.getTime();
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Menos de 30 dias do vencimento (0 a 30 dias)
      if (diasRestantes >= 0 && diasRestantes <= diasLimite) {
        const [ano, mes, dia] = vencStr.split('-');
        const dataVencFormatada = ano && mes && dia ? `${dia}/${mes}/${ano}` : vencStr;

        let textoPrazo = '';
        if (diasRestantes === 0) {
          textoPrazo = 'Vence hoje!';
        } else if (diasRestantes === 1) {
          textoPrazo = 'Vence amanhã!';
        } else {
          textoPrazo = `Vence em ${diasRestantes} dias`;
        }

        listaComDias.push({
          ...item,
          diasRestantes,
          dataVencFormatada,
          textoPrazo,
        });
      }
    }

    // Ordena pela que vence mais cedo
    listaComDias.sort((a, b) => a.diasRestantes - b.diasRestantes);

    const maisProxima = listaComDias.length > 0 ? listaComDias[0] : null;

    return {
      temVencimentoProximo: listaComDias.length > 0,
      anuidadesProximas: listaComDias,
      anuidadeMaisProxima: maisProxima,
      totalProximas: listaComDias.length,
    };
  }, [anuidades, diasLimite]);
}

