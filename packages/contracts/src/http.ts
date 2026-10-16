import { z } from 'zod';
import { Timestamp } from './reading';
import { TreeNode } from './tree';

export const TreeResponse = z.object({
  nodes: z.array(TreeNode),
});
export type TreeResponse = z.infer<typeof TreeResponse>;

/** Query string chega como texto: `coerce` converte antes de validar. */
export const HistoryQuery = z
  .object({
    from: z.coerce.number().pipe(Timestamp).optional(),
    to: z.coerce.number().pipe(Timestamp).optional(),
    limit: z.coerce.number().pipe(z.int().min(1).max(10_000)).optional(),
  })
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, {
    message: '`from` deve ser menor ou igual a `to`',
  });
export type HistoryQuery = z.infer<typeof HistoryQuery>;

export const HistoryPoint = z.object({
  ts: Timestamp,
  value: z.number(),
});
export type HistoryPoint = z.infer<typeof HistoryPoint>;

export const HistoryResponse = z.object({
  sensorId: z.string().min(1),
  points: z.array(HistoryPoint),
});
export type HistoryResponse = z.infer<typeof HistoryResponse>;

export const ErrorResponse = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
