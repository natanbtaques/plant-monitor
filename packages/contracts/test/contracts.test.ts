import { describe, expect, it } from 'vitest';
import { HistoryQuery, TreeNode, WsMessage, type Alert } from '../src';

const alert: Alert = {
  id: 'alert-1',
  sensorId: 'sensor-1',
  status: 'warning',
  previousStatus: 'ok',
  value: 4.7,
  threshold: 4.5,
  ts: 1_700_000_000_000,
};

describe('TreeNode', () => {
  it('aceita um sensor completo e estreita pelo kind', () => {
    const node = TreeNode.parse({
      id: 'sensor-1',
      parentId: 'component-1',
      name: 'Vibração',
      kind: 'sensor',
      sensorType: 'vibration',
      unit: 'mm/s',
      thresholds: { warning: 4.5, critical: 7.1 },
    });
    expect(node.kind === 'sensor' && node.sensorType).toBe('vibration');
  });

  it('rejeita planta com pai e área sem pai', () => {
    expect(TreeNode.safeParse({ id: 'p', parentId: 'x', name: 'P', kind: 'plant' }).success).toBe(
      false,
    );
    expect(TreeNode.safeParse({ id: 'a', parentId: null, name: 'A', kind: 'area' }).success).toBe(
      false,
    );
  });

  it('rejeita sensor sem campos específicos ou com limiares invertidos', () => {
    const sensor = { id: 's', parentId: 'c', name: 'S', kind: 'sensor' };
    expect(TreeNode.safeParse(sensor).success).toBe(false);
    expect(
      TreeNode.safeParse({
        ...sensor,
        sensorType: 'temperature',
        unit: '°C',
        thresholds: { warning: 85, critical: 70 },
      }).success,
    ).toBe(false);
  });
});

describe('WsMessage', () => {
  const reading = { sensorId: 'sensor-1', ts: 1_700_000_000_000, value: 2.1 };

  it('aceita as três variantes', () => {
    expect(WsMessage.parse({ type: 'batch', ts: reading.ts, readings: [reading] }).type).toBe(
      'batch',
    );
    expect(
      WsMessage.parse({ type: 'snapshot', ts: reading.ts, readings: [], activeAlerts: [alert] })
        .type,
    ).toBe('snapshot');
    expect(WsMessage.parse({ type: 'alert', alert }).type).toBe('alert');
  });

  it('rejeita tipo desconhecido e payload malformado', () => {
    expect(WsMessage.safeParse({ type: 'chaos' }).success).toBe(false);
    expect(
      WsMessage.safeParse({ type: 'batch', ts: reading.ts, readings: [{ ...reading, value: '2' }] })
        .success,
    ).toBe(false);
    expect(WsMessage.safeParse({ type: 'batch', ts: 1.5, readings: [] }).success).toBe(false);
  });
});

describe('HistoryQuery', () => {
  it('converte strings da query', () => {
    expect(HistoryQuery.parse({ from: '10', to: '20', limit: '5' })).toEqual({
      from: 10,
      to: 20,
      limit: 5,
    });
    expect(HistoryQuery.parse({})).toEqual({});
  });

  it('rejeita valores inválidos', () => {
    expect(HistoryQuery.safeParse({ limit: 'abc' }).success).toBe(false);
    expect(HistoryQuery.safeParse({ limit: '0' }).success).toBe(false);
    expect(HistoryQuery.safeParse({ from: '20', to: '10' }).success).toBe(false);
  });
});
