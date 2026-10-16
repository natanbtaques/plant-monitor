import { z } from 'zod';
import { Timestamp } from './reading';

export const HealthStatus = z.enum(['ok', 'warning', 'critical']);
export type HealthStatus = z.infer<typeof HealthStatus>;

/**
 * Um alerta é uma *transição* de estado de um sensor (ex.: ok → warning, critical → ok).
 * Modelar como transição, e não só como "alerta disparou", deixa o front saber quando
 * um alerta foi resolvido sem precisar de um tipo de mensagem extra.
 */
export const Alert = z.object({
  id: z.string().min(1),
  sensorId: z.string().min(1),
  status: HealthStatus,
  previousStatus: HealthStatus,
  value: z.number(),
  /** Limiar que motivou a transição (o do novo estado ao subir, o do estado anterior ao descer). */
  threshold: z.number(),
  ts: Timestamp,
});
export type Alert = z.infer<typeof Alert>;
