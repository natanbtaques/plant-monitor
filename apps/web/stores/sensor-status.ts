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
