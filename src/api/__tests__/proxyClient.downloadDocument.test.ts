import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadDocument } from '../proxyClient';

describe('downloadDocument dispatch', () => {
  let postMessage: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { vi.useFakeTimers(); postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {}); });
  afterEach(() => { postMessage.mockRestore(); vi.clearAllTimers(); vi.useRealTimers(); });

  it('posts a download_document REIS_ACTION with url + filename', () => {
    void downloadDocument('https://is.mendelu.cz/x', 'Potvrzeni_o_studiu.pdf').catch(() => {});
    expect(postMessage).toHaveBeenCalledTimes(1);
    const msg = postMessage.mock.calls[0][0] as { type: string; action: string; payload: { url: string; filename: string } };
    expect(msg.type).toBe('REIS_ACTION');
    expect(msg.action).toBe('download_document');
    expect(msg.payload).toEqual({ url: 'https://is.mendelu.cz/x', filename: 'Potvrzeni_o_studiu.pdf' });
  });
});
