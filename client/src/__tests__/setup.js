import '@testing-library/jest-dom';

// localStorage mock for jsdom
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] ?? null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (i) => Object.keys(store)[i] ?? null
    };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock import.meta.env for Vite
vi.stubGlobal('import.meta', {
    env: { VITE_LOG_LEVEL: 'warn', MODE: 'test' }
});

// Suppress console.error in tests (React error boundaries, etc.)
const originalError = console.error;
beforeEach(() => {
    console.error = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
        if (typeof args[0] === 'string' && args[0].includes('ErrorBoundary')) return;
        originalError.call(console, ...args);
    };
});
afterEach(() => {
    console.error = originalError;
    localStorage.clear();
});
