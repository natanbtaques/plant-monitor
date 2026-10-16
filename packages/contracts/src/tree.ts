import { z } from 'zod';

/** Hierarquia: planta → área → linha → ativo → componente → sensor. */
export const NodeKind = z.enum(['plant', 'area', 'line', 'asset', 'component', 'sensor']);
export type NodeKind = z.infer<typeof NodeKind>;

export const SensorType = z.enum(['vibration', 'temperature']);
export type SensorType = z.infer<typeof SensorType>;

export const SensorUnit = z.enum(['mm/s', '°C']);
export type SensorUnit = z.infer<typeof SensorUnit>;

export const Thresholds = z
  .object({
    warning: z.number(),
    critical: z.number(),
  })
  .refine((t) => t.critical > t.warning, { message: 'critical deve ser maior que warning' });
export type Thresholds = z.infer<typeof Thresholds>;

const NodeId = z.string().min(1);

const base = {
  id: NodeId,
  name: z.string().min(1),
};

/** Só a planta é raiz; todo o resto precisa de pai. O tipo reflete isso. */
const childBase = { ...base, parentId: NodeId };

export const PlantNode = z.object({ ...base, kind: z.literal('plant'), parentId: z.null() });
export const AreaNode = z.object({ ...childBase, kind: z.literal('area') });
export const LineNode = z.object({ ...childBase, kind: z.literal('line') });
export const AssetNode = z.object({ ...childBase, kind: z.literal('asset') });
export const ComponentNode = z.object({ ...childBase, kind: z.literal('component') });
export const SensorNode = z.object({
  ...childBase,
  kind: z.literal('sensor'),
  sensorType: SensorType,
  unit: SensorUnit,
  thresholds: Thresholds,
});

/**
 * Nó da árvore em formato normalizado: lista plana com `parentId`.
 * União discriminada por `kind`: checar `node.kind === 'sensor'` já estreita o tipo.
 */
export const TreeNode = z.discriminatedUnion('kind', [
  PlantNode,
  AreaNode,
  LineNode,
  AssetNode,
  ComponentNode,
  SensorNode,
]);
export type TreeNode = z.infer<typeof TreeNode>;
export type PlantNode = z.infer<typeof PlantNode>;
export type SensorNode = z.infer<typeof SensorNode>;

/** Qual kind é filho direto de qual. Útil para validar integridade da árvore. */
export const PARENT_KIND: Record<NodeKind, NodeKind | null> = {
  plant: null,
  area: 'plant',
  line: 'area',
  asset: 'line',
  component: 'asset',
  sensor: 'component',
};
