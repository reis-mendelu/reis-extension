import { describe, it, expect } from 'vitest';
import { isNoticeRows, isIsNoticeRow } from '../isNoticeRows';
import type { IsNotice } from '../../types/isNotices';

const notice = (over: Partial<IsNotice> = {}): IsNotice => ({
  key: 'zasadka:157890',
  title: 'Nový design UIS',
  text: 'V průběhu listopadu…',
  link: 'https://test.is.mendelu.cz',
  severity: 'info',
  from: '2026-11-09T09:00',
  until: '2026-11-30T23:59',
  ...over,
});

describe('isNoticeRows', () => {
  it('turns an IS notice into a MENDELU row of the feed', () => {
    expect(isNoticeRows([notice()], [], '2026-11-09')).toEqual([
      {
        id: 'is:zasadka:157890',
        associationId: 'mendelu',
        title: 'Nový design UIS',
        body: 'V průběhu listopadu…',
        link: 'https://test.is.mendelu.cz',
        createdAt: '2026-11-09T09:00',
        expiresAt: '2026-11-30',
        startsAt: '2026-11-09',
        priority: 'normal',
        source: 'is',
      },
    ]);
  });

  it('drops a notice a reIS admin muted', () => {
    const rows = isNoticeRows(
      [notice(), notice({ key: 'link:/auth/kontrola/', title: 'Kontrola' })],
      [{ key: 'zasadka:157890', title: 'Nový design UIS' }],
      '2026-11-09'
    );
    expect(rows.map((r) => r.id)).toEqual(['is:link:/auth/kontrola/']);
  });

  // The red tile has no window: it stays while IS shows it. Dated "today" so
  // the date label reads Dnes and the past-event filter never drops it.
  it('dates an undated red notice today and ranks it high', () => {
    const [row] = isNoticeRows(
      [notice({ severity: 'crit', from: null, until: null, link: null })],
      [],
      '2026-11-12'
    );
    expect(row).toMatchObject({
      expiresAt: '2026-11-12',
      createdAt: '2026-11-12',
      startsAt: undefined,
      priority: 'high',
      link: 'https://is.mendelu.cz/auth/index.pl',
    });
  });

  it('marks its rows so the society counters can leave them alone', () => {
    const row = isNoticeRows([notice()], [], '2026-11-09')[0]!;
    expect(isIsNoticeRow(row)).toBe(true);
    expect(isIsNoticeRow(row.id)).toBe(true);
    expect(isIsNoticeRow({ id: '6f1c', source: undefined })).toBe(false);
    expect(isIsNoticeRow('6f1c')).toBe(false);
  });
});
