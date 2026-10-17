'use client';

import type { HealthStatus, TreeNode } from '@plant-monitor/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { memo, useMemo } from 'react';
import { historyQuery } from '../queries/history';
import { useReadings } from '../stores/readings';
import { useSensorStatus, worstStatus } from '../stores/sensor-status';
import { useTreeUi } from '../stores/tree-ui';

interface TreeIndex {
  childrenById: Map<string | null, TreeNode[]>; // parentId → filhos
  sensorIdsById: Map<string, string[]>; // asset/location → sensores abaixo dele
}

// Lista plana → índices, uma vez só. A lista vem em pré-ordem (pai antes dos filhos).
function buildIndex(nodes: TreeNode[]): TreeIndex {
  const childrenById: TreeIndex['childrenById'] = new Map();
  const sensorIdsById: TreeIndex['sensorIdsById'] = new Map();
  const parentOf = new Map<string, string | null>();

  for (const node of nodes) {
    parentOf.set(node.id, node.parentId);
    const siblings = childrenById.get(node.parentId);
    if (siblings) siblings.push(node);
    else childrenById.set(node.parentId, [node]);

    // Cada sensor sobe pelos ancestrais (asset, location) e entra na lista de cada um.
    if (node.kind === 'sensor') {
      for (let id: string | null = node.parentId; id !== null; id = parentOf.get(id) ?? null) {
        const ids = sensorIdsById.get(id);
        if (ids) ids.push(node.id);
        else sensorIdsById.set(id, [node.id]);
      }
    }
  }
  return { childrenById, sensorIdsById };
}

export function TreeView({ nodes }: { nodes: TreeNode[] }) {
  // `nodes` vem do cache do React Query (staleTime: Infinity): os índices são montados uma vez.
  const index = useMemo(() => buildIndex(nodes), [nodes]);
  return (
    <ul>
      {(index.childrenById.get(null) ?? []).map((node) => (
        <TreeRow key={node.id} node={node} index={index} />
      ))}
    </ul>
  );
}

// Componente separado de propósito: a cada segundo só este <span> re-renderiza, não a linha.
// O seletor devolve um número, então só dispara se o valor DESTE sensor mudou. E só existe
// para sensores visíveis (pais expandidos), então só eles assinam a store.
function SensorValue({ id, unit }: { id: string; unit: string }) {
  const value = useReadings((s) => s.byId[id]?.value);
  return <span> {value === undefined ? '—' : `${value} ${unit}`}</span>;
}

export const STATUS_COLOR: Record<HealthStatus, string> = {
  ok: 'inherit',
  warning: 'darkorange',
  critical: 'crimson',
};

const plainButton = { border: 'none', background: 'none', cursor: 'pointer', padding: 0 };

// memo: quando esta linha re-renderiza, os filhos já abertos são pulados (as props deles
// não mudaram), em vez de re-renderizarem junto por causa da recursão.
const TreeRow = memo(function TreeRow({ node, index }: { node: TreeNode; index: TreeIndex }) {
  // Cada linha assina só o booleano que lhe interessa. Toda mudança na store re-executa
  // estes seletores (barato), mas só re-renderiza a linha cujo resultado mudou.
  // Anti-padrão: `useTreeUi((s) => s.expanded)` devolve um Set novo a cada clique e
  // faria TODAS as linhas re-renderizarem (o "alto-falante").
  const isExpanded = useTreeUi((s) => s.expanded.has(node.id));
  const isSelected = useTreeUi((s) => s.selectedId === node.id);
  const toggle = useTreeUi((s) => s.toggle);
  const select = useTreeUi((s) => s.select);

  // Pior status entre os sensores abaixo (um sensor é a sua própria lista). O seletor devolve
  // uma string: a linha só redesenha quando o SEU pior status muda, não a cada alerta.
  const sensorIds = index.sensorIdsById.get(node.id) ?? [node.id];
  const status = useSensorStatus((s) => worstStatus(sensorIds, s.byId));

  const queryClient = useQueryClient();
  // Hover num sensor: já busca o histórico, para o painel abrir sem esperar.
  // Respeita o staleTime (30 s): passar o mouse de novo não refaz o fetch.
  const prefetch =
    node.kind === 'sensor'
      ? () => void queryClient.prefetchQuery(historyQuery(node.id))
      : undefined;

  const children = index.childrenById.get(node.id) ?? [];

  return (
    <li>
      {children.length > 0 && (
        <button style={plainButton} aria-expanded={isExpanded} onClick={() => toggle(node.id)}>
          {isExpanded ? '▾' : '▸'}
        </button>
      )}{' '}
      <button
        style={{
          ...plainButton,
          color: STATUS_COLOR[status],
          fontWeight: isSelected ? 'bold' : 'normal',
        }}
        aria-pressed={isSelected}
        onClick={() => select(node.id)}
        onMouseEnter={prefetch}
      >
        {node.name}
      </button>
      {node.kind === 'sensor' && <SensorValue id={node.id} unit={node.unit} />}
      {isExpanded && (
        <ul>
          {children.map((child) => (
            <TreeRow key={child.id} node={child} index={index} />
          ))}
        </ul>
      )}
    </li>
  );
});
