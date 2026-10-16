import { z } from 'zod';

/** Epoch em milissegundos. */
export const Timestamp = z.int().nonnegative();

export const Reading = z.object({
  sensorId: z.string().min(1),
  ts: Timestamp,
  value: z.number(),
});
export type Reading = z.infer<typeof Reading>;
