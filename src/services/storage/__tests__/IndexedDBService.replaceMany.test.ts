import { describe, it, expect } from 'vitest';
import { IndexedDBService } from '../IndexedDBService';

const ev = (id: string) => ({
  id,
  title: 't',
  date: '20261110',
  startTime: '15:00',
  endTime: '16:00',
});

describe('IndexedDBService.replaceMany', () => {
  it('puts and deletes together', async () => {
    await IndexedDBService.set('custom_events', 'RM-old', ev('RM-old'));
    await IndexedDBService.replaceMany('custom_events', [['RM-new', ev('RM-new')]], ['RM-old']);
    expect(await IndexedDBService.get('custom_events', 'RM-old')).toBeUndefined();
    expect(await IndexedDBService.get('custom_events', 'RM-new')).toEqual(ev('RM-new'));
  });

  // setMany skips an invalid value; here the deletes may only be right because
  // the put lands, so nothing at all is written.
  it('an invalid put refuses the whole batch, deletes included', async () => {
    await IndexedDBService.set('custom_events', 'RM-keep', ev('RM-keep'));
    await expect(
      IndexedDBService.replaceMany(
        'custom_events',
        [
          ['RM-a', ev('RM-a')],
          ['RM-bad', { id: 'RM-bad' } as never],
        ],
        ['RM-keep']
      )
    ).rejects.toThrow(/invalid/);
    expect(await IndexedDBService.get('custom_events', 'RM-keep')).toEqual(ev('RM-keep'));
    expect(await IndexedDBService.get('custom_events', 'RM-a')).toBeUndefined();
  });
});
