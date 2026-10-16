import { HistoryResponse, TreeResponse, WsMessage } from '@plant-monitor/contracts';
import { WebSocket } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startSimulator, type RunningSimulator } from '../src/server';

let sim: RunningSimulator;
let base = '';

beforeAll(async () => {
  sim = await startSimulator({ port: 0 });
  base = `http://localhost:${sim.port}`;
});
afterAll(() => sim.close());

describe('simulador (smoke)', () => {
  it('GET /tree devolve ~10k nós válidos com pais existentes', async () => {
    const { nodes } = TreeResponse.parse(await (await fetch(`${base}/tree`)).json());
    expect(nodes.length).toBeGreaterThan(9_000);
    expect(nodes.length).toBeLessThan(11_000);
    const ids = new Set(nodes.map((n) => n.id));
    expect(nodes.every((n) => n.parentId === null || ids.has(n.parentId))).toBe(true);
  });

  it('GET /sensors/:id/history respeita o limit e dá 404 para sensor inexistente', async () => {
    const res = await fetch(`${base}/sensors/sensor-1/history?limit=50`);
    expect(HistoryResponse.parse(await res.json()).points).toHaveLength(50);
    expect((await fetch(`${base}/sensors/nope/history`)).status).toBe(404);
  });

  it('WS envia snapshot ao conectar e depois batches válidos', async () => {
    const ws = new WebSocket(`ws://localhost:${sim.port}/ws`);
    const received: WsMessage[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.on('error', reject);
      ws.on('message', (data) => {
        const parsed = WsMessage.safeParse(JSON.parse(String(data)));
        if (!parsed.success) return reject(parsed.error);
        received.push(parsed.data);
        if (parsed.data.type === 'batch') resolve();
      });
    });
    ws.close();

    expect(received[0]?.type).toBe('snapshot');
    const batch = received.at(-1);
    expect(batch?.type === 'batch' && batch.readings.length).toBe(sim.sensorCount);
  });
});
