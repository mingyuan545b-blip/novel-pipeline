import { describe, test, expect } from 'vitest';
import { safeStr, truncate, escapeHtml, wordCount, camelToKebab, uuid, formatBytes, debounce, throttle } from '../../shared/utils';

describe('safeStr', () => {
    test('returns empty string for null/undefined', () => {
        expect(safeStr(null)).toBe('');
        expect(safeStr(undefined)).toBe('');
    });

    test('returns string as-is', () => {
        expect(safeStr('hello')).toBe('hello');
    });

    test('converts number to string', () => {
        expect(safeStr(42)).toBe('42');
        expect(safeStr(0)).toBe('0');
    });

    test('converts boolean to string', () => {
        expect(safeStr(true)).toBe('true');
        expect(safeStr(false)).toBe('false');
    });

    test('JSON-stringifies objects', () => {
        expect(safeStr({ a: 1 })).toBe('{"a":1}');
    });
});

describe('truncate', () => {
    test('returns short string unchanged', () => {
        expect(truncate('hi', 10)).toBe('hi');
    });

    test('truncates long string with default suffix', () => {
        expect(truncate('abcdefghij', 8)).toBe('abcde...');
    });

    test('uses custom suffix', () => {
        expect(truncate('abcdefghij', 8, '…')).toBe('abcdefg…');
    });

    test('handles non-string input', () => {
        expect(truncate(1234567890, 5)).toBe('12...');
    });
});

describe('escapeHtml', () => {
    test('escapes ampersand', () => {
        expect(escapeHtml('a&b')).toBe('a&amp;b');
    });

    test('escapes angle brackets', () => {
        expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    test('escapes quotes', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    test('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe('it&#039;s');
    });

    test('handles null input', () => {
        expect(escapeHtml(null)).toBe('');
    });
});

describe('wordCount', () => {
    test('counts Chinese characters', () => {
        expect(wordCount('你好世界')).toBe(4);
    });

    test('strips whitespace before counting', () => {
        expect(wordCount('你 好 世 界')).toBe(4);
    });

    test('returns 0 for empty/null', () => {
        expect(wordCount('')).toBe(0);
        expect(wordCount(null)).toBe(0);
    });
});

describe('camelToKebab', () => {
    test('converts camelCase', () => {
        expect(camelToKebab('myComponent')).toBe('my-component');
    });

    test('handles already kebab-case', () => {
        expect(camelToKebab('my-component')).toBe('my-component');
    });

    test('handles PascalCase', () => {
        expect(camelToKebab('MyComponent')).toBe('my-component');
    });
});

describe('uuid', () => {
    test('generates a string', () => {
        expect(typeof uuid()).toBe('string');
    });

    test('generates unique values', () => {
        const ids = new Set(Array.from({ length: 100 }, uuid));
        expect(ids.size).toBe(100);
    });

    test('follows UUID v4 format', () => {
        expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
});

describe('formatBytes', () => {
    test('formats 0 bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    test('formats bytes', () => {
        expect(formatBytes(512)).toBe('512 B');
    });

    test('formats kilobytes', () => {
        expect(formatBytes(1024)).toBe('1 KB');
    });

    test('formats megabytes', () => {
        expect(formatBytes(1048576)).toBe('1 MB');
    });

    test('handles null', () => {
        expect(formatBytes(null)).toBe('0 B');
    });
});

describe('debounce', () => {
    test('delays function execution', async () => {
        let count = 0;
        const fn = debounce(() => { count++; }, 50);
        fn();
        fn();
        fn();
        expect(count).toBe(0);
        await new Promise(r => setTimeout(r, 100));
        expect(count).toBe(1);
    });
});

describe('throttle', () => {
    test('limits function calls', () => {
        let count = 0;
        const fn = throttle(() => { count++; }, 100);
        fn();
        fn();
        fn();
        expect(count).toBe(1);
    });
});
