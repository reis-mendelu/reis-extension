import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  refetchForSwitch,
  refetchIfStale,
  __resetLanguageRefetchForTests,
} from '../languageRefetch';

/**
 * A sync that fetched IS in one language while the student reads another.
 *
 * Every existing English student hits this on the first load after the update:
 * the sync-language key starts empty, so that first run is Czech. So does the
 * extension's first install (the content script syncs before the iframe has
 * written the language) and a switch made in another tab. One refetch fixes
 * each; a loop of them would be a full crawl per sync update.
 */
describe('refetchIfStale', () => {
  beforeEach(() => __resetLanguageRefetchForTests());

  it('asks once when the data is in the other language', () => {
    const trigger = vi.fn();
    expect(refetchIfStale('cz', 'en', trigger)).toBe(true);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('never asks twice for the same language, however many stale updates arrive', () => {
    const trigger = vi.fn();
    for (let i = 0; i < 5; i++) refetchIfStale('cz', 'en', trigger);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('does nothing for data already in the student language, or data with no language', () => {
    const trigger = vi.fn();
    refetchIfStale('en', 'en', trigger);
    refetchIfStale(undefined, 'en', trigger);
    expect(trigger).not.toHaveBeenCalled();
  });

  // After a switch, the in-flight run still delivers the old language. The
  // switch already asked for the new one, so that delivery must not ask again.
  it('treats the language a switch asked for as already requested', () => {
    const trigger = vi.fn();
    refetchForSwitch('en', trigger);
    refetchIfStale('cz', 'en', trigger);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  // A switch is the student asking, so it always refetches — cz → en → cz → en
  // needs the English data back even though English was asked for once already.
  it('refetches on every switch, not once per language', () => {
    const trigger = vi.fn();
    refetchForSwitch('en', trigger);
    refetchForSwitch('cz', trigger);
    refetchForSwitch('en', trigger);
    expect(trigger).toHaveBeenCalledTimes(3);
  });
});
