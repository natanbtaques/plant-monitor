import type { TreeNode } from '@plant-monitor/contracts';
import { describe, expect, it } from 'vitest';
import { buildIndex } from './tree-index';

const location = (id: string): TreeNode => ({ kind: 'location', id, parentId: null, name: id });
const asset = (id: string, parentId: string): TreeNode => ({
  kind: 'asset',
  id,
  parentId,
  name: id,
});
const sensor = (id: string, parentId: string): TreeNode => ({
  kind: 'sensor',
  id,
  parentId,
  name: id,
  sensorType: 'vibration',
  unit: 'mm/s',
  thresholds: { warning: 4.5, critical: 7.1 },
});

// L1 ── A1 ── S1, S2
//    └─ A2 ── S3
// L2 ── A3 ── S4
const nodes: TreeNode[] = [
  location('L1'),
  asset('A1', 'L1'),
  sensor('S1', 'A1'),
  sensor('S2', 'A1'),
  asset('A2', 'L1'),
  sensor('S3', 'A2'),
  location('L2'),
  asset('A3', 'L2'),
  sensor('S4', 'A3'),
];

const { childrenById, sensorIdsById } = buildIndex(nodes);
const childIds = (parentId: string | null) => childrenById.get(parentId)?.map((n) => n.id);

describe('buildIndex: childrenById', () => {
  it('as raízes (parentId null) são as locations, na ordem da lista', () => {
    expect(childIds(null)).toEqual(['L1', 'L2']);
  });

  it('cada location tem os seus assets', () => {
    expect(childIds('L1')).toEqual(['A1', 'A2']);
    expect(childIds('L2')).toEqual(['A3']);
  });

  it('cada asset tem os seus sensores', () => {
    expect(childIds('A1')).toEqual(['S1', 'S2']);
    expect(childIds('A2')).toEqual(['S3']);
    expect(childIds('A3')).toEqual(['S4']);
  });

  it('sensores não têm filhos', () => {
    for (const id of ['S1', 'S2', 'S3', 'S4']) expect(childIds(id)).toBeUndefined();
  });
});

describe('buildIndex: sensorIdsById', () => {
  it('cada asset lista os sensores diretamente abaixo dele', () => {
    expect(sensorIdsById.get('A1')).toEqual(['S1', 'S2']);
    expect(sensorIdsById.get('A2')).toEqual(['S3']);
    expect(sensorIdsById.get('A3')).toEqual(['S4']);
  });

  it('cada location lista todos os sensores dos seus assets', () => {
    expect(sensorIdsById.get('L1')).toEqual(['S1', 'S2', 'S3']);
    expect(sensorIdsById.get('L2')).toEqual(['S4']);
  });

  it('sensores não entram como chave (a linha usa [o próprio id])', () => {
    expect(sensorIdsById.has('S1')).toBe(false);
  });
});
