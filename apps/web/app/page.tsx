'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ConnectionIndicator } from '../components/connection-indicator';
import { SensorPanel } from '../components/sensor-panel';
import { TreeView } from '../components/tree-view';
import { startRealtime } from '../lib/realtime';
import { treeQuery } from '../queries/tree';

export default function Home() {
  const { data, isPending, error } = useQuery(treeQuery);

  // Abre o WebSocket ao montar e encerra ao desmontar (startRealtime devolve o "stop").
  useEffect(() => startRealtime(), []);

  if (isPending) return <p>Carregando árvore…</p>;
  if (error) return <p>Erro ao carregar a árvore: {error.message}</p>;

  return (
    <main>
      <h1>Plant Monitor</h1>
      <ConnectionIndicator />

      {/* Árvore à esquerda; painel à direita, grudado no topo ao rolar a árvore */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div>
          <h2>Árvore</h2>
          <TreeView nodes={data.nodes} />
        </div>
        <aside style={{ position: 'sticky', top: 0 }}>
          <SensorPanel nodes={data.nodes} />
        </aside>
      </div>
    </main>
  );
}
