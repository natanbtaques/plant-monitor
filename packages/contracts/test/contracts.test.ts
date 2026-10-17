import { describe, expect, it } from 'vitest';
import { HistoryQuery, TreeNode, WsMessage, type Alert } from '../src';

const sensor = {
  id: 'sensor-1',
  parentId: 'asset-1',
  name: 'Vibração',
  kind: 'sensor',
  sensorType: 'vibration',
  unit: 'mm/s',
  thresholds: { warning: 4.5, critical: 7.1 },
};
const reading = { sensorId: 'sensor-1', ts: 1_700_000_000_000, value: 2.1 };
const alert: Alert = { sensorId: 'sensor-1', status: 'warning', value: 4.7, ts: reading.ts };

describe('TreeNode', () => {
  it('aceita os 3 níveis e estreita pelo kind', () => {
    expect(
      TreeNode.parse({ id: 'location-1', parentId: null, name: 'L', kind: 'location' }).kind,
    ).toBe('location');
    expect(
      TreeNode.parse({ id: 'asset-1', parentId: 'location-1', name: 'A', kind: 'asset' }).kind,
    ).toBe('asset');
    const node = TreeNode.parse(sensor);
    expect(node.kind === 'sensor' && node.sensorType).toBe('vibration');
  });

  it('exige pai em asset e sensor, e nenhum pai em location', () => {
    expect(
      TreeNode.safeParse({ id: 'l', parentId: 'x', name: 'L', kind: 'location' }).success,
    ).toBe(false);
    expect(TreeNode.safeParse({ id: 'a', parentId: null, name: 'A', kind: 'asset' }).success).toBe(
      false,
    );
    expect(TreeNode.safeParse({ ...sensor, parentId: null }).success).toBe(false);
  });

  it('rejeita sensor sem os campos específicos', () => {
    const { thresholds: _, ...withoutThresholds } = sensor;
    expect(TreeNode.safeParse(withoutThresholds).success).toBe(false);
  });
});

describe('WsMessage', () => {
  it('aceita snapshot, batch e alert', () => {
    expect(
      WsMessage.parse({ type: 'snapshot', readings: [reading], activeAlerts: [alert] }).type,
    ).toBe('snapshot');
    expect(WsMessage.parse({ type: 'batch', readings: [reading] }).type).toBe('batch');
    expect(WsMessage.parse({ type: 'alert', alert }).type).toBe('alert');
  });

  it('rejeita tipo desconhecido e valor não numérico', () => {
    expect(WsMessage.safeParse({ type: 'chaos' }).success).toBe(false);
    expect(
      WsMessage.safeParse({ type: 'batch', readings: [{ ...reading, value: '2' }] }).success,
    ).toBe(false);
  });
});

describe('HistoryQuery', () => {
  it('converte string e aplica o padrão', () => {
    expect(HistoryQuery.parse({ limit: '50' })).toEqual({ limit: 50 });
    expect(HistoryQuery.parse({})).toEqual({ limit: 60 });
  });

  it('rejeita limit inválido', () => {
    for (const limit of ['abc', '0', '3601', '1.5']) {
      expect(HistoryQuery.safeParse({ limit }).success).toBe(false);
    }
  });
});
