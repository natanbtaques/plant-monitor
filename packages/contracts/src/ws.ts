import { z } from 'zod';
import { Alert } from './alert';
import { Reading, Timestamp } from './reading';

/** Enviado uma vez ao conectar: último valor de cada sensor + sensores fora do normal. */
export const SnapshotMessage = z.object({
  type: z.literal('snapshot'),
  ts: Timestamp,
  readings: z.array(Reading),
  activeAlerts: z.array(Alert),
});
export type SnapshotMessage = z.infer<typeof SnapshotMessage>;

/** Um por tick (1 Hz), com a leitura de todos os sensores. */
export const BatchMessage = z.object({
  type: z.literal('batch'),
  ts: Timestamp,
  readings: z.array(Reading),
});
export type BatchMessage = z.infer<typeof BatchMessage>;

/** Enviado quando um sensor muda de estado de saúde. */
export const AlertMessage = z.object({
  type: z.literal('alert'),
  alert: Alert,
});
export type AlertMessage = z.infer<typeof AlertMessage>;

export const WsMessage = z.discriminatedUnion('type', [
  SnapshotMessage,
  BatchMessage,
  AlertMessage,
]);
export type WsMessage = z.infer<typeof WsMessage>;
