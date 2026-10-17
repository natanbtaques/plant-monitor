import { z } from 'zod';

// --- Enums de domínio ---

export const SensorType = z.enum(['vibration', 'temperature']);
export type SensorType = z.infer<typeof SensorType>;

export const HealthStatus = z.enum(['ok', 'warning', 'critical']);
export type HealthStatus = z.infer<typeof HealthStatus>;

// --- Árvore: location → asset → sensor, em lista plana com parentId ---

const node = { id: z.string().min(1), name: z.string().min(1) };

// União discriminada por `kind`: checar `node.kind === 'sensor'` já estreita o tipo.
export const TreeNode = z.discriminatedUnion('kind', [
  z.object({ ...node, kind: z.literal('location'), parentId: z.null() }),
  z.object({ ...node, kind: z.literal('asset'), parentId: z.string().min(1) }),
  z.object({
    ...node,
    kind: z.literal('sensor'),
    parentId: z.string().min(1),
    sensorType: SensorType,
    unit: z.string().min(1),
    thresholds: z.object({ warning: z.number(), critical: z.number() }),
  }),
]);
export type TreeNode = z.infer<typeof TreeNode>;
export type SensorNode = Extract<TreeNode, { kind: 'sensor' }>;

// --- Leituras e alertas ---

export const Reading = z.object({
  sensorId: z.string().min(1),
  ts: z.int().nonnegative(), // epoch em ms
  value: z.number(),
});
export type Reading = z.infer<typeof Reading>;

// Alerta = mudança de status de um sensor. `status: 'ok'` significa que o alerta foi resolvido.
export const Alert = z.object({
  sensorId: z.string().min(1),
  status: HealthStatus,
  value: z.number(),
  ts: z.int().nonnegative(),
});
export type Alert = z.infer<typeof Alert>;

// --- Mensagens do WebSocket ---

export const WsMessage = z.discriminatedUnion('type', [
  // Ao conectar: último valor de cada sensor + sensores fora do normal.
  z.object({
    type: z.literal('snapshot'),
    readings: z.array(Reading),
    activeAlerts: z.array(Alert),
  }),
  // A cada segundo: leitura de todos os sensores.
  z.object({ type: z.literal('batch'), readings: z.array(Reading) }),
  // Quando um sensor muda de status.
  z.object({ type: z.literal('alert'), alert: Alert }),
]);
export type WsMessage = z.infer<typeof WsMessage>;

// --- HTTP ---

export const TreeResponse = z.object({ nodes: z.array(TreeNode) });
export type TreeResponse = z.infer<typeof TreeResponse>;

// Query string chega como texto: `coerce` converte antes de validar.
export const HistoryQuery = z.object({
  limit: z.coerce.number().pipe(z.int().min(1).max(3600)).default(60),
});
export type HistoryQuery = z.infer<typeof HistoryQuery>;

export const HistoryResponse = z.object({
  sensorId: z.string().min(1),
  points: z.array(z.object({ ts: z.int().nonnegative(), value: z.number() })),
});
export type HistoryResponse = z.infer<typeof HistoryResponse>;
