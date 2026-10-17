import { describe, expect, it } from 'vitest';
import { worstStatus } from './status';

describe('worstStatus', () => {
  it('lista vazia é ok', () => {
    expect(worstStatus([], {})).toBe('ok');
  });

  it('sensor ausente do byId conta como ok', () => {
    expect(worstStatus(['a', 'b'], {})).toBe('ok');
  });

  it('devolve o pior status da lista', () => {
    expect(worstStatus(['a', 'b'], { a: 'ok', b: 'warning' })).toBe('warning');
    expect(worstStatus(['a', 'b', 'c'], { a: 'warning', b: 'critical', c: 'ok' })).toBe('critical');
  });

  it('ignora sensores que não estão na lista', () => {
    expect(worstStatus(['a'], { a: 'ok', outro: 'critical' })).toBe('ok');
  });

  it('critical vence independente da posição', () => {
    expect(worstStatus(['a', 'b'], { a: 'critical', b: 'warning' })).toBe('critical');
    expect(worstStatus(['a', 'b'], { a: 'warning', b: 'critical' })).toBe('critical');
  });
});
