/**
 * Cliente de verificação: valida as respostas do simulador com os mesmos schemas que o front vai usar.
 * Uso: pnpm --filter @plant-monitor/simulator probe [segundos=15]
 */
import { HistoryResponse, TreeResponse, WsMessage } from '@plant-monitor/contracts';
import { WebSocket } from 'ws';

const BASE = process.env.SIM_URL ?? 'http://localhost:4000';
const seconds = Number(process.argv[2] ?? 15);

const treeRes = await fetch(`${BASE}/tree`);
const tree = TreeResponse.parse(await treeRes.json());
const sensors = tree.nodes.filter((n) => n.kind === 'sensor');
console.log(`[tree] ${tree.nodes.length} nós válidos, ${sensors.length} sensores`);

const firstSensor = sensors[0];
if (firstSensor) {
  const res = await fetch(`${BASE}/sensors/${firstSensor.id}/history?limit=100`);
  const history = HistoryResponse.parse(await res.json());
  console.log(`[history] ${history.sensorId}: ${history.points.length} pontos`);
}
const missing = await fetch(`${BASE}/sensors/nao-existe/history`);
console.log(`[history] sensor inexistente → HTTP ${missing.status}`);

const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws`);
let lastBatchAt: number | null = null;
let invalid = 0;

ws.on('message', (data) => {
  const parsed = WsMessage.safeParse(JSON.parse(String(data)));
  if (!parsed.success) {
    invalid++;
    console.error('[ws] mensagem inválida:', parsed.error.issues.slice(0, 3));
    return;
  }
  const msg = parsed.data;
  switch (msg.type) {
    case 'snapshot':
      console.log(
        `[ws] snapshot: ${msg.readings.length} leituras, ${msg.activeAlerts.length} alertas ativos`,
      );
      break;
    case 'batch': {
      const now = performance.now();
      const gap = lastBatchAt === null ? '-' : `${Math.round(now - lastBatchAt)} ms`;
      lastBatchAt = now;
      console.log(`[ws] batch ts=${msg.ts}: ${msg.readings.length} leituras, intervalo ${gap}`);
      break;
    }
    case 'alert':
      console.log(
        `[ws] alert ${msg.alert.sensorId}: ${msg.alert.previousStatus} → ${msg.alert.status}`,
      );
      break;
  }
});

setTimeout(() => {
  console.log(`[probe] fim. mensagens inválidas: ${invalid}`);
  ws.close();
  process.exit(invalid > 0 ? 1 : 0);
}, seconds * 1000);
