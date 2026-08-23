import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTimestamp, formatDate, formatTime, formatRelative, formatDuration } from '../../shared/dateUtils';

describe('formatTimestamp', () => {
    test('formats ISO string to YYYYMMDD HH:mm:ss', () => {
        const result = formatTimestamp('2025-01-15T10:30:45.000Z');
        expect(result).toMatch(/20250115/);
        expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    test('returns empty for null', () => {
        expect(formatTimestamp(null)).toBe('');
    });

    test('returns empty for invalid date', () => {
        expect(formatTimestamp('invalid')).toBe('');
    });
});

describe('formatDate', () => {
    test('formats to YYYY-MM-DD', () => {
        const result = formatDate('2025-03-15T00:00:00.000Z');
        expect(result).toMatch(/2025-03-15/);
    });

    test('returns empty for null', () => {
        expect(formatDate(null)).toBe('');
    });
});

describe('formatTime', () => {
    test('formats to HH:mm', () => {
        const result = formatTime('2025-01-01T14:30:00.000Z');
        expect(result).toMatch(/\d{2}:\d{2}/);
    });

    test('returns empty for null', () => {
        expect(formatTime(null)).toBe('');
    });
});

describe('formatRelative', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-06-01T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('returns "刚刚" for less than 1 minute ago', () => {
        expect(formatRelative(Date.now() - 30000)).toBe('刚刚');
    });

    test('returns "X分钟前" for minutes ago', () => {
        expect(formatRelative(Date.now() - 5 * 60000)).toBe('5分钟前');
    });

    test('returns "X小时前" for hours ago', () => {
        expect(formatRelative(Date.now() - 2 * 3600000)).toBe('2小时前');
    });

    test('returns "X天前" for days ago', () => {
        expect(formatRelative(Date.now() - 3 * 86400000)).toBe('3天前');
    });

    test('returns formatted date for older dates', () => {
        const result = formatRelative(Date.now() - 10 * 86400000);
        expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    test('returns empty for null', () => {
        expect(formatRelative(null)).toBe('');
    });
});

describe('formatDuration', () => {
    test('formats milliseconds', () => {
        expect(formatDuration(500)).toBe('500ms');
    });

    test('formats seconds', () => {
        expect(formatDuration(5000)).toBe('5s');
    });

    test('formats minutes and seconds', () => {
        expect(formatDuration(125000)).toBe('2m 5s');
    });

    test('formats hours and minutes', () => {
        expect(formatDuration(7800000)).toBe('2h 10m');
    });

    test('returns "0s" for zero or negative', () => {
        expect(formatDuration(0)).toBe('0s');
        expect(formatDuration(-1)).toBe('0s');
    });

    test('returns "0s" for null', () => {
        expect(formatDuration(null)).toBe('0s');
    });
});
