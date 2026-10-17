'use client';

import type { SensorNode, TreeNode } from '@plant-monitor/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { appendReading, historyQuery } from '../queries/history';
import { useReadings } from '../stores/readings';
import { useSensorStatus } from '../stores/sensor-status';
import { useTreeUi } from '../stores/tree-ui';
import { STATUS_COLOR } from './tree-view';

// Decide o que mostrar a partir do nó selecionado na árvore.
export function SensorPanel({ nodes }: { nodes: TreeNode[] }) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedId = useTreeUi((s) => s.selectedId);
  const node = selectedId ? byId.get(selectedId) : undefined;

  if (node?.kind !== 'sensor') return <p>Selecione um sensor.</p>;
  // key: trocar de sensor monta um painel novo (sem resto de estado do anterior).
  return <SensorDetails key={node.id} sensor={node} />;
}

// Separado do SensorPanel para os hooks abaixo nunca serem condicionais.
function SensorDetails({ sensor }: { sensor: SensorNode }) {
  const reading = useReadings((s) => s.byId[sensor.id]);
  const status = useSensorStatus((s) => s.byId[sensor.id] ?? 'ok');
  const history = useQuery(historyQuery(sensor.id));
  const queryClient = useQueryClient();

  // Cada leitura nova do sensor aberto entra no cache do histórico: a tabela cresce ao vivo
  // sem novo fetch. Só o sensor aberto faz isso; os outros não tocam no cache.
  useEffect(() => {
    if (reading) appendReading(queryClient, reading);
  }, [queryClient, reading]);

  return (
    <section>
      <h2>{sensor.name}</h2>
      <p>
        Valor atual: <strong>{reading ? `${reading.value} ${sensor.unit}` : '—'}</strong>{' '}
        <span style={{ color: STATUS_COLOR[status] }}>({status})</span>
      </p>
      <p>
        Limiares: warning ≥ {sensor.thresholds.warning}, critical ≥ {sensor.thresholds.critical}{' '}
        {sensor.unit}
      </p>

      <h3>Histórico</h3>
      {history.isPending ? (
        <p>Carregando…</p>
      ) : history.error ? (
        <p>Erro: {history.error.message}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Horário</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {/* Mais recente no topo */}
            {history.data.points.toReversed().map((p) => (
              <tr key={p.ts}>
                <td>{new Date(p.ts).toLocaleTimeString('pt-BR')}</td>
                <td>
                  {p.value} {sensor.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
