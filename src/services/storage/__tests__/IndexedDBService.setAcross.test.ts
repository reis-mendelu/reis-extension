import { describe, it, expect } from 'vitest';
import { IndexedDBService } from '../IndexedDBService';

const Z = { ph: { sections: [], fetchedAt: 1 }, vt: { tests: [], fetchedAt: 1 } };

describe('IndexedDBService.setAcross', () => {
  it('writes into several stores together', async () => {
    await IndexedDBService.setAcross([
      { store: 'zaznamnik', key: 'ACROSS-1', value: Z },
      { store: 'meta', key: 'across_1', value: { a: 1 } },
    ]);
    expect(await IndexedDBService.get('zaznamnik', 'ACROSS-1')).toEqual(Z);
    expect(await IndexedDBService.get('meta', 'across_1')).toEqual({ a: 1 });
  });

  it('a write that fails takes the others with it', async () => {
    await expect(
      IndexedDBService.setAcross([
        { store: 'zaznamnik', key: 'ACROSS-2', value: Z },
        // Not a valid IndexedDB key: the put throws and the transaction aborts.
        { store: 'meta', key: {} as never, value: true },
      ])
    ).rejects.toThrow();
    expect(await IndexedDBService.get('zaznamnik', 'ACROSS-2')).toBeUndefined();
  });
});
