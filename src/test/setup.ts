import 'fake-indexeddb/auto';
import { vi, expect, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Partial mock of chrome.storage
const storageMock = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
  sync: {
    // Keep sync mocked even if we don't use it, to prevent crashes
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Partial mock of chrome.runtime
const runtimeMock = {
  id: 'test-extension-id',
  getManifest: vi.fn(() => ({ version: '1.0.0' })),
  getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
};

// Stub the global chrome object
vi.stubGlobal('chrome', {
  storage: storageMock,
  runtime: runtimeMock,
});

/**
 * Unit tests must not touch the network.
 *
 * Several suites were reaching the real jsDelivr CDN for subject data. Besides
 * being slow and offline-hostile, it made the numbers move: coverage measured on
 * one commit drifted run to run depending on whether those requests landed before
 * the environment tore down. Coverage is a gate now, so it has to be deterministic.
 *
 * Failing loudly rather than returning a canned response on purpose — a silent
 * default would hide the fact that a test is exercising a code path nobody
 * intended it to reach.
 */
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const url = typeof input === 'string' ? input : String((input as Request)?.url ?? input);
      return Promise.reject(
        new Error(
          `Unmocked network call to ${url}. Unit tests must stub fetch — ` +
            `mock the module under test, or vi.stubGlobal('fetch', ...) in this suite.`
        )
      );
    })
  );
});
