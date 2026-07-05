import { describe, it, expect } from 'vitest';
import { mainItems } from '../MainItems';

const t = (key: string) => key;

describe('mainItems — Tisk dokumentů entry', () => {
  it('is the first entry in the "is" item\'s children', () => {
    const items = mainItems('143752', '812', t, 'cz');
    const isItem = items.find(i => i.id === 'is')!;
    expect(isItem.children![0].id).toBe('dokumenty');
  });

  it('uses the sidebar.documents i18n key and has no href (opens the drawer)', () => {
    const items = mainItems('143752', '812', t, 'cz');
    const row = items.find(i => i.id === 'is')!.children!.find(c => c.id === 'dokumenty')!;
    expect(row.label).toBe('sidebar.documents');
    expect(row.href).toBeUndefined();
  });
});
