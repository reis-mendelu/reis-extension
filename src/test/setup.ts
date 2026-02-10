import { vi, expect } from 'vitest';
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
  sync: { // Keep sync mocked even if we don't use it, to prevent crashes
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }
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

// Clean up mocks after each test if needed (optional, depending on preference)
// beforeEach(() => {
//   vi.clearAllMocks();
// });
