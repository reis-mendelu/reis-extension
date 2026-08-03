import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendToIframe } from '../iframeManager';
import { setPlatform, __resetPlatformForTests } from '../../platform';
import { createCapacitorPlatform } from '../../platform/capacitorPlatform';
import { createExtensionPlatform } from '../../platform/extensionPlatform';

describe('sendToIframe delivery target', () => {
  let post: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    post.mockRestore();
    __resetPlatformForTests();
  });

  it('posts to its own window on Capacitor — the app IS the receiver', () => {
    setPlatform(createCapacitorPlatform());
    sendToIframe({ type: 'REIS_SYNC_UPDATE' });
    expect(post).toHaveBeenCalledWith({ type: 'REIS_SYNC_UPDATE' }, '*');
  });

  it('does NOT self-post on the extension, where a real iframe is the target', () => {
    setPlatform(createExtensionPlatform());
    // No iframe has been injected, so this is a no-op rather than a self-post.
    sendToIframe({ type: 'REIS_SYNC_UPDATE' });
    expect(post).not.toHaveBeenCalled();
  });
});
