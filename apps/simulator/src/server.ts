import { createServer } from 'node:http';
import {
  HistoryQuery,
  type Alert,
  type HealthStatus,
  type HistoryResponse,
  type Reading,
  type SensorNode,
  type TreeNode,
  type TreeResponse,
  type WsMessage,
} from '@plant-monitor/contracts';
import { WebSocket, WebSocketServer } from 'ws';

// --- Configuração ---
const PORT = Number(process.env.PORT ?? 4000);
const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? 'http://localhost:3000',
};
const SENSOR_COUNT = 2000; // volume que o front precisa aguentar
const SENSORS_PER_ASSET = 2;
const ASSETS_PER_LOCATION = 20; // 2.000 sensores → 1.000 ativos → 50 locations
const DEGRADING_FRACTION = 0.03; // ~3% dos sensores sempre degradando
const REPAIR_AFTER_TICKS = 60; // segundos em crítico até a "manutenção"

const ASSET_NAMES = ['Motor', 'Bomba', 'Compressor', 'Redutor', 'Ventilador'];
// O que vai na árvore para cada tipo de sensor...
const SENSOR_META = {
  vibration: { name: 'Vibração', unit: 'mm/s', thresholds: { warning: 4.5, critical: 7.1 } },
  temperature: { name: 'Temperatura', unit: '°C', thresholds: { warning: 70, critical: 85 } },
};
// ...e como o sinal se comporta (fica só no servidor).
const SIGNAL = {
  vibration: { baseline: 2, noise: 0.15 },
  temperature: { baseline: 45, noise: 0.4 },
};

// --- Árvore: location → asset → sensor, em lista plana (o pai vem antes dos filhos) ---
const nodes: TreeNode[] = [];
let assetCount = 0;
let sensorCount = 0;
for (let l = 1; l <= SENSOR_COUNT / (SENSORS_PER_ASSET * ASSETS_PER_LOCATION); l++) {
  nodes.push({ kind: 'location', id: `location-${l}`, parentId: null, name: `Área ${l}` });
  for (let a = 0; a < ASSETS_PER_LOCATION; a++) {
    const assetId = `asset-${++assetCount}`;
    const name = `${ASSET_NAMES[Math.floor(Math.random() * ASSET_NAMES.length)]} ${assetCount}`;
    nodes.push({ kind: 'asset', id: assetId, parentId: `location-${l}`, name });
    for (let s = 0; s < SENSORS_PER_ASSET; s++) {
      const sensorType = Math.random() < 0.65 ? 'vibration' : 'temperature';
      const id = `sensor-${++sensorCount}`;
      nodes.push({ kind: 'sensor', id, parentId: assetId, sensorType, ...SENSOR_META[sensorType] });
    }
  }
}

// --- Estado de cada sensor: valor = baseline + drift (degradação) + ruído ---
const sensors = nodes
  .filter((n): n is SensorNode => n.kind === 'sensor')
  .map((node) => ({
    node,
    baseline: SIGNAL[node.sensorType].baseline * (0.8 + Math.random() * 0.4),
    drift: 0,
    rate: 0, // > 0 quando o sensor está degradando
    value: 0,
    status: 'ok' as HealthStatus,
    criticalTicks: 0,
  }));
type Sensor = (typeof sensors)[number];
const byId = new Map(sensors.map((s) => [s.node.id, s]));
let lastTs = Date.now();

const round2 = (n: number) => Math.round(n * 100) / 100;
const noise = (s: Sensor) => (Math.random() * 2 - 1) * SIGNAL[s.node.sensorType].noise;
const reading = (s: Sensor): Reading => ({ sensorId: s.node.id, ts: lastTs, value: s.value });
const statusOf = (v: number, t: SensorNode['thresholds']): HealthStatus =>
  v >= t.critical ? 'critical' : v >= t.warning ? 'warning' : 'ok';

// Escolhe um sensor saudável e faz ele subir até o crítico em 3 a 8 minutos.
function startDegradation(headStart = false) {
  const healthy = sensors.filter((s) => s.rate === 0);
  const s = healthy[Math.floor(Math.random() * healthy.length)];
  if (!s) return;
  const gap = s.node.thresholds.critical - s.baseline;
  s.rate = gap / (180 + Math.random() * 300);
  if (headStart) s.drift = Math.random() * gap; // na largada, espalha o progresso
}
for (let i = 0; i < SENSOR_COUNT * DEGRADING_FRACTION; i++) startDegradation(true);

// --- Tick (1 Hz): atualiza valores e gera um alerta a cada mudança de status ---
function tick(ts: number): Alert[] {
  lastTs = ts;
  const alerts: Alert[] = [];
  for (const s of sensors) {
    s.drift += s.rate;
    s.value = round2(Math.max(0, s.baseline + s.drift + noise(s)));
    const status = statusOf(s.value, s.node.thresholds);
    if (status !== s.status) alerts.push({ sensorId: s.node.id, status, value: s.value, ts });
    s.status = status;
    s.criticalTicks = status === 'critical' ? s.criticalTicks + 1 : 0;
    if (s.criticalTicks >= REPAIR_AFTER_TICKS) {
      // Manutenção: volta ao normal e outro sensor começa a falhar.
      Object.assign(s, { drift: 0, rate: 0, criticalTicks: 0 });
      startDegradation();
    }
  }
  return alerts;
}
tick(lastTs); // primeira leitura, para o snapshot já nascer com valores

// --- HTTP: GET /tree e GET /sensors/:id/history?limit=N ---
const treeBody = JSON.stringify({ nodes } satisfies TreeResponse);

const server = createServer((req, res) => {
  const send = (status: number, body: string) => res.writeHead(status, HEADERS).end(body);
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/tree') return send(200, treeBody);

  const id = /^\/sensors\/([^/]+)\/history$/.exec(url.pathname)?.[1];
  const s = id ? byId.get(id) : undefined;
  if (!s) return send(404, JSON.stringify({ error: 'Não encontrado' }));

  const query = HistoryQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return send(400, JSON.stringify({ error: 'Query inválida' }));

  // Histórico gerado na hora: 1 ponto por segundo, ruído em volta do valor atual.
  const { limit } = query.data;
  const points = Array.from({ length: limit }, (_, i) => ({
    ts: lastTs - (limit - 1 - i) * 1000,
    value: i === limit - 1 ? s.value : round2(Math.max(0, s.value + noise(s))),
  }));
  send(200, JSON.stringify({ sensorId: s.node.id, points } satisfies HistoryResponse));
});

// --- WebSocket: snapshot ao conectar, depois alertas + batch a cada segundo ---
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('error', console.warn);
  const activeAlerts = sensors
    .filter((s) => s.status !== 'ok')
    .map((s): Alert => ({ sensorId: s.node.id, status: s.status, value: s.value, ts: lastTs }));
  const snapshot: WsMessage = { type: 'snapshot', readings: sensors.map(reading), activeAlerts };
  ws.send(JSON.stringify(snapshot));
});

setInterval(() => {
  const alerts = tick(Date.now());
  const messages: WsMessage[] = [
    ...alerts.map((alert) => ({ type: 'alert' as const, alert })),
    { type: 'batch', readings: sensors.map(reading) },
  ];
  const payloads = messages.map((m) => JSON.stringify(m)); // serializa uma vez para todos
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) payloads.forEach((p) => ws.send(p));
  }
}, 1000);

server.listen(PORT, () => console.log(`[sim] ${nodes.length} nós em http://localhost:${PORT}`));
