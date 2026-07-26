import { describe, it, expect } from 'vitest';
import cs from '../locales/cs.json';
import en from '../locales/en.json';

/** Flattens {a:{b:'x'}} to ['a.b'] so key sets can be compared directly. */
function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, path)
      : [path];
  });
}

describe('mobile i18n namespace', () => {
  it('exists in both locales', () => {
    expect((cs as Record<string, unknown>).mobile).toBeDefined();
    expect((en as Record<string, unknown>).mobile).toBeDefined();
  });

  it('has identical key sets in cs and en', () => {
    const csKeys = flatten((cs as never)['mobile']).sort();
    const enKeys = flatten((en as never)['mobile']).sort();
    expect(enKeys).toEqual(csKeys);
  });

  it('has no empty strings', () => {
    const walk = (o: Record<string, unknown>): string[] =>
      Object.values(o).flatMap((v) =>
        v !== null && typeof v === 'object' ? walk(v as Record<string, unknown>) : [String(v)]
      );
    expect(walk((cs as never)['mobile']).filter((s) => s.trim() === '')).toEqual([]);
    expect(walk((en as never)['mobile']).filter((s) => s.trim() === '')).toEqual([]);
  });
});
