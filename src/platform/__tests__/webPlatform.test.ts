import { describe, it, expect } from 'vitest';
import { createWebPlatform } from '../webPlatform';

describe('webPlatform', () => {
  it('identifies as web', () => {
    expect(createWebPlatform().kind).toBe('web');
  });

  it('stores values in memory across calls', async () => {
    const p = createWebPlatform();
    await p.storage.set('lang', 'cs');
    expect(await p.storage.get('lang')).toBe('cs');
  });

  it('isolates storage between instances', async () => {
    const a = createWebPlatform();
    const b = createWebPlatform();
    await a.storage.set('lang', 'cs');
    expect(await b.storage.get('lang')).toBeUndefined();
  });

  it('resolves asset paths from the server root, tolerating a leading slash', () => {
    const p = createWebPlatform();
    expect(p.getAssetUrl('icons/x.svg')).toBe('/icons/x.svg');
    expect(p.getAssetUrl('/icons/x.svg')).toBe('/icons/x.svg');
  });
});
