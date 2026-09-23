import { describe, it, expect } from 'vitest';
import { Messages } from '../../messages';
import { IframeToContentSchema, ContentToIframeSchema } from '../schema';

// The content script drops any REIS_FETCH its schema rejects, silently: the
// iframe then waits out the whole timeout with no error anywhere. So the new
// response type and the progress tick must each be admitted explicitly.
describe('file fetch over the proxy', () => {
  it("admits a REIS_FETCH asking for responseType 'file'", () => {
    const msg = Messages.fetch('https://is.mendelu.cz/x', { responseType: 'file' });
    expect(IframeToContentSchema.safeParse(msg).success).toBe(true);
  });

  it('admits a REIS_FETCH_PROGRESS tick, with and without a declared total', () => {
    for (const total of [1234, null]) {
      const msg = Messages.fetchProgress('id-1', { loaded: 10, total });
      expect(ContentToIframeSchema.safeParse(msg).success).toBe(true);
    }
  });

  it('rejects a progress tick without a numeric loaded', () => {
    const msg = { type: 'REIS_FETCH_PROGRESS', id: 'x', loaded: '10', total: null };
    expect(ContentToIframeSchema.safeParse(msg).success).toBe(false);
  });
});
