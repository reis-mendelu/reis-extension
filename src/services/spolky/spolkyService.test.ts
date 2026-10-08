import { describe, it, expect } from 'vitest';
import { dropBeyondNovinkyWindow } from './spolkyService';

describe('dropBeyondNovinkyWindow', () => {
  const n = (startsAt?: string) => ({
    id: startsAt ?? 'x',
    title: '',
    body: '',
    createdAt: '',
    expiresAt: '',
    priority: 'normal' as const,
    startsAt,
  });

  it('keeps today through today+6, drops today+7 and later', () => {
    const out = dropBeyondNovinkyWindow(
      [n('2026-10-08'), n('2026-10-14'), n('2026-10-15')],
      '2026-10-08'
    );
    expect(out.map((x) => x.startsAt)).toEqual(['2026-10-08', '2026-10-14']);
  });

  it('keeps undated rows (academic)', () => {
    expect(dropBeyondNovinkyWindow([n(undefined)], '2026-10-08')).toHaveLength(1);
  });
});
