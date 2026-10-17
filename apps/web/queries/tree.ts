import { TreeResponse } from '@plant-monitor/contracts';
import { queryOptions } from '@tanstack/react-query';
import { getApiUrl } from '../lib/config';

// Receita de requisição da arvore de dispositivos.
export async function fetchTree(): Promise<TreeResponse> {
  const res = await fetch(`${getApiUrl()}/tree`);
  if (!res.ok) throw new Error(`GET /tree falhou: HTTP ${res.status}`);
  // Fronteira: o que vem da rede só vira TreeResponse depois de validado.
  return TreeResponse.parse(await res.json());
}

// Chave + função + política de cache num só lugar, reutilizável em useQuery, prefetch, invalidate.
export const treeQuery = queryOptions({
  queryKey: ['tree'],
  queryFn: fetchTree,
  staleTime: Infinity, // a árvore não muda enquanto o simulador roda
});
