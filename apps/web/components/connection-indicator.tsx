'use client';

import { useConnection } from '../stores/connection';

const COLORS = { open: 'green', connecting: 'gray', reconnecting: 'orange' } as const;

export function ConnectionIndicator() {
  const status = useConnection((s) => s.status);
  const attempt = useConnection((s) => s.attempt);
  const retryInMs = useConnection((s) => s.retryInMs);

  const label =
    status === 'open'
      ? 'conectado'
      : status === 'connecting'
        ? 'conectando…'
        : `reconectando em ${Math.ceil((retryInMs ?? 0) / 1000)} s (tentativa ${attempt})`;

  return (
    <p>
      <span style={{ color: COLORS[status] }}>●</span> {label}
    </p>
  );
}
