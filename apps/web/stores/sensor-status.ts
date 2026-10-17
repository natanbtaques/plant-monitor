import type { Alert, HealthStatus } from '@plant-monitor/contracts';
import { create } from 'zustand';

// Status de saúde de cada sensor, alimentado pelos alertas do WebSocket (lib/realtime.ts).
// Sensor ausente do byId = 'ok'.
interface SensorStatusState {
  byId: Record<string, HealthStatus>;
  replaceAll: (activeAlerts: Alert[]) => void;
  setStatus: (sensorId: string, status: HealthStatus) => void;
}

export const useSensorStatus = create<SensorStatusState>()((set) => ({
  byId: {},
  // Snapshot: só os sensores fora do normal vêm na lista; todo o resto passa a ser 'ok'.
  replaceAll: (activeAlerts) => {
    const byId: Record<string, HealthStatus> = {};
    for (const alert of activeAlerts) byId[alert.sensorId] = alert.status;
    set({ byId });
  },
  // Alert: mudança de status de um sensor ('ok' = resolvido).
  setStatus: (sensorId, status) => set((s) => ({ byId: { ...s.byId, [sensorId]: status } })),
}));

const RANK: Record<HealthStatus, number> = { ok: 0, warning: 1, critical: 2 };

// Pior status entre os sensores da lista. Função pura, usada dentro dos seletores.
export function worstStatus(ids: string[], byId: Record<string, HealthStatus>): HealthStatus {
  let worst: HealthStatus = 'ok';
  for (const id of ids) {
    const status = byId[id] ?? 'ok';
    if (status === 'critical') return status; // não tem como piorar: para cedo
    if (RANK[status] > RANK[worst]) worst = status;
  }
  return worst;
}
