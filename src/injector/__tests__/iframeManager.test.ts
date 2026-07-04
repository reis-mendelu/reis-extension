import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveIframeSrc, resolveIframeOrigin } from '../iframeManager';

afterEach(() => vi.unstubAllEnvs());

describe('resolveIframeSrc', () => {
  it('uses the packaged extension page by default (normal build)', () => {
    // chrome.runtime.getURL is stubbed in src/test/setup.ts
    expect(resolveIframeSrc()).toBe('chrome-extension://test-extension-id/main.html');
  });

  it('points at the web origin when VITE_IFRAME_ORIGIN is set (build:mcp)', () => {
    vi.stubEnv('VITE_IFRAME_ORIGIN', 'http://localhost:5199');
    expect(resolveIframeSrc()).toBe('http://localhost:5199/main.html');
  });

  it('does not append a double slash when origin has no trailing slash', () => {
    vi.stubEnv('VITE_IFRAME_ORIGIN', 'http://localhost:5199');
    expect(resolveIframeSrc()).not.toContain('//main.html');
  });
});

describe('resolveIframeOrigin', () => {
  it('is the packaged extension origin by default (no trailing slash)', () => {
    // chrome.runtime.getURL('') is stubbed to chrome-extension://test-extension-id/
    expect(resolveIframeOrigin()).toBe('chrome-extension://test-extension-id');
  });

  it('is the web origin when VITE_IFRAME_ORIGIN is set (build:mcp)', () => {
    vi.stubEnv('VITE_IFRAME_ORIGIN', 'http://localhost:5199');
    expect(resolveIframeOrigin()).toBe('http://localhost:5199');
  });

  it('matches the origin of resolveIframeSrc so the message handler accepts it', () => {
    vi.stubEnv('VITE_IFRAME_ORIGIN', 'http://localhost:5199');
    expect(new URL(resolveIframeSrc()).origin).toBe(resolveIframeOrigin());
  });
});
