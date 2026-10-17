import { HistoryResponse, type Reading } from '@plant-monitor/contracts';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { getApiUrl } from '../lib/config';

export const HISTORY_POINTS = 20;

// Receita do histórico de um sensor: uma entrada de cache por sensor (['history', id]).
export const historyQuery = (sensorId: string) =>
  queryOptions({
    queryKey: ['history', sensorId],
    queryFn: async (): Promise<HistoryResponse> => {
      const res = await fetch(`${getApiUrl()}/sensors/${sensorId}/history?limit=${HISTORY_POINTS}`);
      if (!res.ok) throw new Error(`GET /history falhou: HTTP ${res.status}`);
      return HistoryResponse.parse(await res.json());
    },
    staleTime: 30_000, // dentro de 30 s, hover/abrir de novo usa o cache sem refazer o fetch
  });

// Acrescenta uma leitura ao vivo no fim do histórico em cache, mantendo só os mais recentes.
// O queryKey vindo de queryOptions já tipa o `old` (HistoryResponse | undefined).
export function appendReading(queryClient: QueryClient, reading: Reading): void {
  queryClient.setQueryData(historyQuery(reading.sensorId).queryKey, (old) => {
    if (!old) return old; // ainda carregando: o fetch vai trazer os pontos
    const last = old.points.at(-1);
    if (last && reading.ts <= last.ts) return old; // repetida ou atrasada
    const points = [...old.points, { ts: reading.ts, value: reading.value }];
    return { ...old, points: points.slice(-HISTORY_POINTS) };
  });
}
