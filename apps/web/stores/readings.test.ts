import { beforeEach, describe, expect, it } from 'vitest';
import { useReadings } from './readings';

const state = () => useReadings.getState();
const reading = (sensorId: string, ts: number, value: number) => ({ sensorId, ts, value });

describe('applyBatch', () => {
  beforeEach(() => state().replaceAll([]));

  it('grava a primeira leitura de um sensor', () => {
    state().applyBatch([reading('a', 10, 1)]);
    expect(state().byId.a).toEqual(reading('a', 10, 1));
  });

  it('substitui por uma leitura mais nova', () => {
    state().applyBatch([reading('a', 10, 1)]);
    state().applyBatch([reading('a', 11, 2)]);
    expect(state().byId.a?.value).toBe(2);
  });

  it('ignora leituras mais antigas ou com o mesmo ts', () => {
    state().applyBatch([reading('a', 10, 1)]);
    state().applyBatch([reading('a', 9, 99), reading('a', 10, 98)]);
    expect(state().byId.a?.value).toBe(1);
  });

  it('mantém a referência dos sensores que não vieram no batch', () => {
    state().applyBatch([reading('a', 10, 1), reading('b', 10, 5)]);
    const before = state().byId.b;
    state().applyBatch([reading('a', 11, 2)]);
    expect(state().byId.b).toBe(before); // mesma referência → seletor de 'b' não dispara
  });
});
