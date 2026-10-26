import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shareLink } from '../shareLink';

let kind: 'capacitor' | 'extension' = 'capacitor';
vi.mock('../../platform', () => ({ getPlatform: () => ({ kind }) }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));
const share = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('@capacitor/share', () => ({ Share: { share } }));

const url = 'https://play.google.com/store/apps/details?id=cz.reis.app';
const writeText = vi.fn(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

describe('shareLink', () => {
  it('opens the share sheet on the phone and iPad', async () => {
    kind = 'capacitor';
    expect(await shareLink(url)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ url });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('treats a dismissed sheet as a choice, not a failure', async () => {
    kind = 'capacitor';
    share.mockRejectedValueOnce(new Error('Share canceled'));
    expect(await shareLink(url)).toBe('canceled');
  });

  it('copies the link on the extension', async () => {
    kind = 'extension';
    expect(await shareLink(url)).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(url);
    expect(share).not.toHaveBeenCalled();
  });

  it('never claims a copy the clipboard refused', async () => {
    kind = 'extension';
    writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
    expect(await shareLink(url)).toBe('failed');
  });
});
