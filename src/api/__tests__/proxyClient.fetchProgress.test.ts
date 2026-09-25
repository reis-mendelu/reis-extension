import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../platform', () => ({ getPlatform: () => ({ kind: 'extension' }) }));

import { fetchViaProxy } from '../proxyClient';
import { REQUEST_TIMEOUT } from '../proxy/pendingRequests';

/** Reply as the IS host page would, to the request fetchViaProxy just posted. */
function fromParent(data: Record<string, unknown>) {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin: 'https://is.mendelu.cz', source: window.parent })
  );
}

describe('fetchViaProxy progress ticks', () => {
  let postMessage: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
  });
  afterEach(() => {
    postMessage.mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const sentId = () => (postMessage.mock.calls.at(-1)![0] as { id: string }).id;

  it('hands each tick to the caller', async () => {
    const ticks: unknown[] = [];
    const p = fetchViaProxy('https://is.mendelu.cz/f', { responseType: 'file' }, (t) =>
      ticks.push(t)
    );
    const id = sentId();
    fromParent({ type: 'REIS_FETCH_PROGRESS', id, loaded: 5, total: 10 });
    fromParent({ type: 'REIS_FETCH_RESULT', id, success: true, data: 'ok' });
    await expect(p).resolves.toBe('ok');
    expect(ticks).toEqual([{ loaded: 5, total: 10 }]);
  });

  // A 40 MB lecture PDF on campus wifi takes longer than 30 s. The cap is on
  // SILENCE, not on length: every tick proves the download is still moving.
  it('re-arms the timeout on each tick, so a long download that keeps moving survives', async () => {
    const p = fetchViaProxy('https://is.mendelu.cz/f', { responseType: 'file' });
    const id = sentId();
    let settled = false;
    p.then(
      () => (settled = true),
      () => (settled = true)
    );

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT - 5000);
    fromParent({ type: 'REIS_FETCH_PROGRESS', id, loaded: 1, total: null });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT - 5000);
    expect(settled).toBe(false);

    fromParent({ type: 'REIS_FETCH_RESULT', id, success: true, data: 'done' });
    await expect(p).resolves.toBe('done');
  });

  it('still times out, naming the URL, once the ticks stop', async () => {
    const p = fetchViaProxy('https://is.mendelu.cz/stalled', { responseType: 'file' });
    const assertion = expect(p).rejects.toThrow('Timeout: https://is.mendelu.cz/stalled');
    fromParent({ type: 'REIS_FETCH_PROGRESS', id: sentId(), loaded: 1, total: null });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT + 1);
    await assertion;
  });
});
