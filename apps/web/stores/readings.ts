import type { Reading } from '@plant-monitor/contracts';
import { create } from 'zustand';

// Última leitura de cada sensor, alimentada pelo WebSocket (lib/realtime.ts).
interface ReadingsState {
  byId: Record<string, Reading>;
  replaceAll: (readings: Iterable<Reading>) => void;
  applyBatch: (readings: Iterable<Reading>) => void;
}

export const useReadings = create<ReadingsState>()((set) => ({
  byId: {},

  // Snapshot: é a verdade no momento em que a conexão abre, então substitui tudo.
  replaceAll: (readings) => {
    const byId: Record<string, Reading> = {};
    for (const r of readings) byId[r.sensorId] = r;
    set({ byId });
  },

  // Batch: só grava leituras mais novas que a atual (atrasadas ou repetidas são ignoradas).
  // Sensores que não mudaram mantêm a mesma referência, então os seletores deles não disparam.
  applyBatch: (readings) =>
    set((s) => {
      const byId = { ...s.byId };
      for (const r of readings) {
        const prev = byId[r.sensorId];
        if (!prev || r.ts > prev.ts) byId[r.sensorId] = r;
      }
      return { byId };
    }),
}));
