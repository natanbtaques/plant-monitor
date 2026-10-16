import type {
  NodeKind,
  SensorNode,
  SensorType,
  SensorUnit,
  Thresholds,
  TreeNode,
} from '@plant-monitor/contracts';

// 1 planta + 10 áreas + 100 linhas + ~2.000 ativos + ~6.000 componentes + ~2.000 sensores ≈ 10k nós.
const AREAS = 10;
const LINES_PER_AREA = 10;
const ASSETS_PER_LINE = [15, 25] as const;
const COMPONENTS_PER_ASSET = [2, 4] as const;
const SENSOR_CHANCE = 1 / 3;
const VIBRATION_CHANCE = 0.65;

const AREA_NAMES = [
  'Prensagem',
  'Usinagem',
  'Pintura',
  'Montagem',
  'Utilidades',
  'Caldeiraria',
  'Embalagem',
  'Tratamento Térmico',
  'Estamparia',
  'Expedição',
] as const;
const ASSET_TYPES = [
  ['Motor', 'MTR'],
  ['Bomba', 'BMB'],
  ['Compressor', 'CMP'],
  ['Redutor', 'RDT'],
  ['Ventilador', 'VNT'],
  ['Exaustor', 'EXT'],
] as const;
const COMPONENT_NAMES = [
  'Rolamento LA',
  'Rolamento LOA',
  'Mancal',
  'Acoplamento',
  'Carcaça',
  'Eixo',
] as const;

export const SENSOR_SPECS: Record<
  SensorType,
  { label: string; unit: SensorUnit; thresholds: Thresholds }
> = {
  // Faixas no estilo ISO 10816 (velocidade RMS).
  vibration: { label: 'Vibração', unit: 'mm/s', thresholds: { warning: 4.5, critical: 7.1 } },
  temperature: { label: 'Temperatura', unit: '°C', thresholds: { warning: 70, critical: 85 } },
};

const randomInt = ([min, max]: readonly [number, number]) =>
  min + Math.floor(Math.random() * (max - min + 1));
const pick = <T>(items: readonly [T, ...T[]]): T =>
  items[Math.floor(Math.random() * items.length)] ?? items[0];

/**
 * Lista plana com `parentId`, em pré-ordem (o pai sempre vem antes dos filhos).
 * IDs são contadores por kind (`sensor-1`, `sensor-2`...), mas o que cada ID é muda a cada restart.
 */
export function generateTree(): TreeNode[] {
  const nodes: TreeNode[] = [];
  const counters: Record<NodeKind, number> = {
    plant: 0,
    area: 0,
    line: 0,
    asset: 0,
    component: 0,
    sensor: 0,
  };
  const nextId = (kind: NodeKind) => `${kind}-${++counters[kind]}`;

  const plantId = nextId('plant');
  nodes.push({ id: plantId, parentId: null, kind: 'plant', name: 'Planta Industrial' });

  for (let a = 0; a < AREAS; a++) {
    const areaId = nextId('area');
    const areaName = AREA_NAMES[a % AREA_NAMES.length] ?? `Área ${a + 1}`;
    nodes.push({ id: areaId, parentId: plantId, kind: 'area', name: areaName });

    for (let l = 0; l < LINES_PER_AREA; l++) {
      const lineId = nextId('line');
      nodes.push({
        id: lineId,
        parentId: areaId,
        kind: 'line',
        name: `${areaName} · Linha ${l + 1}`,
      });

      for (let s = randomInt(ASSETS_PER_LINE); s > 0; s--) {
        const assetId = nextId('asset');
        const [typeName, tag] = pick<readonly [string, string]>(ASSET_TYPES);
        const name = `${typeName} ${tag}-${String(counters.asset).padStart(4, '0')}`;
        nodes.push({ id: assetId, parentId: lineId, kind: 'asset', name });

        const componentCount = randomInt(COMPONENTS_PER_ASSET);
        for (let c = 0; c < componentCount; c++) {
          const componentId = nextId('component');
          const componentName =
            COMPONENT_NAMES[c % COMPONENT_NAMES.length] ?? `Componente ${c + 1}`;
          nodes.push({
            id: componentId,
            parentId: assetId,
            kind: 'component',
            name: componentName,
          });

          if (Math.random() < SENSOR_CHANCE) {
            const sensorType: SensorType =
              Math.random() < VIBRATION_CHANCE ? 'vibration' : 'temperature';
            const { label, unit, thresholds } = SENSOR_SPECS[sensorType];
            nodes.push({
              id: nextId('sensor'),
              parentId: componentId,
              kind: 'sensor',
              name: `${label} · ${componentName}`,
              sensorType,
              unit,
              thresholds,
            });
          }
        }
      }
    }
  }
  return nodes;
}

export const isSensor = (node: TreeNode): node is SensorNode => node.kind === 'sensor';
