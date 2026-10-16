import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  HistoryQuery,
  type Alert,
  type AlertMessage,
  type BatchMessage,
  type ErrorResponse,
  type HistoryResponse,
  type SnapshotMessage,
  type TreeResponse,
} from '@plant-monitor/contracts';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import { Simulation } from './sensors';
import { generateTree, isSensor } from './tree';

const TICK_MS = 1000;
/** Cliente com mais que isso no buffer de envio perde o batch (alertas nunca são pulados). */
const MAX_BUFFERED_BYTES = 1024 * 1024;
const HISTORY_ROUTE = /^\/sensors\/([^/]+)\/history$/;

export interface TickInfo {
  alerts: Alert[];
  clients: number;
  skippedBatches: number;
}

export interface SimulatorOptions {
  port: number;
  corsOrigin?: string;
  onTick?: (info: TickInfo) => void;
}

export interface RunningSimulator {
  port: number;
  nodeCount: number;
  sensorCount: number;
  close(): Promise<void>;
}

export async function startSimulator({
  port,
  corsOrigin = 'http://localhost:3000',
  onTick,
}: SimulatorOptions): Promise<RunningSimulator> {
  const nodes = generateTree();
  const sensors = nodes.filter(isSensor);
  const sim = new Simulation(sensors, Date.now());
  // A árvore não muda depois do boot: serializa uma vez só.
  const treeBody = JSON.stringify({ nodes } satisfies TreeResponse);

  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, OPTIONS' }).end();
      return;
    }
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Método não permitido' });

    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/tree') return sendJson(res, 200, treeBody);

    const sensorId = HISTORY_ROUTE.exec(url.pathname)?.[1];
    if (sensorId === undefined) return sendJson(res, 404, { error: 'Rota não encontrada' });

    const query = HistoryQuery.safeParse(Object.fromEntries(url.searchParams));
    if (!query.success) {
      return sendJson(res, 400, { error: 'Query inválida', details: z.flattenError(query.error) });
    }
    const points = sim.history(sensorId, query.data);
    if (points === null) return sendJson(res, 404, { error: `Sensor ${sensorId} não encontrado` });
    sendJson(res, 200, { sensorId, points } satisfies HistoryResponse);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    ws.on('error', (err) => console.warn('[ws] erro no cliente:', err.message));
    ws.send(JSON.stringify({ type: 'snapshot', ...sim.snapshot() } satisfies SnapshotMessage));
  });

  const interval = setInterval(() => {
    const ts = Date.now();
    const { readings, alerts } = sim.tick(ts);
    // Serializa uma vez e manda a mesma string para todos os clientes.
    const batch = JSON.stringify({ type: 'batch', ts, readings } satisfies BatchMessage);
    const alertMessages = alerts.map((alert) =>
      JSON.stringify({ type: 'alert', alert } satisfies AlertMessage),
    );

    let skippedBatches = 0;
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      for (const message of alertMessages) ws.send(message);
      if (ws.bufferedAmount > MAX_BUFFERED_BYTES) skippedBatches++;
      else ws.send(batch);
    }
    onTick?.({ alerts, clients: wss.clients.size, skippedBatches });
  }, TICK_MS);

  await new Promise<void>((resolve) => server.listen(port, resolve));

  return {
    port: (server.address() as AddressInfo).port,
    nodeCount: nodes.length,
    sensorCount: sensors.length,
    close: () => {
      clearInterval(interval);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

/** Aceita um objeto ou um JSON já serializado. */
function sendJson(
  res: ServerResponse,
  status: number,
  body: ErrorResponse | HistoryResponse | string,
): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
