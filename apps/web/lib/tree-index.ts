import type { TreeNode } from '@plant-monitor/contracts';

export interface TreeIndex {
  childrenById: Map<string | null, TreeNode[]>; // parentId → filhos (null → as locations)
  sensorIdsById: Map<string, string[]>; // asset/location → sensores abaixo dele
}

// Lista plana → índices, numa única passada. A lista vem em pré-ordem (pai antes dos filhos),
// então quando um sensor aparece os ancestrais dele já estão no `parentOf`.
export function buildIndex(nodes: TreeNode[]): TreeIndex {
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
