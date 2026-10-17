import type { HealthStatus } from '@plant-monitor/contracts';

// Tudo o que é regra de status de saúde, sem React nem store.

// Cor de cada status na tela.
export const STATUS_COLOR: Record<HealthStatus, string> = {
  ok: 'inherit',
  warning: 'darkorange',
  critical: 'crimson',
};

const RANK: Record<HealthStatus, number> = { ok: 0, warning: 1, critical: 2 };

// Pior status entre os sensores da lista (sensor ausente do byId = 'ok').
// Função pura, usada dentro dos seletores da árvore.
export function worstStatus(ids: string[], byId: Record<string, HealthStatus>): HealthStatus {
  let worst: HealthStatus = 'ok';
  for (const id of ids) {
    const status = byId[id] ?? 'ok';
    if (status === 'critical') return status; // não tem como piorar: para cedo
    if (RANK[status] > RANK[worst]) worst = status;
  }
  return worst;
}
