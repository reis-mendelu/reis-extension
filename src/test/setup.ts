/**
 * Vitest test setup file
 * Configures Testing Library matchers and global mocks
 */

import { vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock localStorage for tests
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock chrome API for extension environment
const chromeMock = {
    runtime: {
        id: 'test-extension-id',
        sendMessage: vi.fn(),
        onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
    },
    storage: {
        local: {
            get: vi.fn(),
            set: vi.fn(),
        },
        sync: {
            get: vi.fn(),
            set: vi.fn(),
        },
    },
};
Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true });

// Mock fetch for API tests
globalThis.fetch = vi.fn();

// Mock IntersectionObserver
class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
    value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
    value: MockResizeObserver,
});

// Reset mocks after each test
afterEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReset();
    localStorageMock.setItem.mockReset();
});
