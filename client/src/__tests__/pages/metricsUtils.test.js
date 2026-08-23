import { describe, test, expect } from 'vitest';
import { formatMs, formatNumber } from '../../pages/metrics/metricsUtils';

describe('formatMs', () => {
    test('formats 0ms', () => expect(formatMs(0)).toBe('0ms'));
    test('formats negative', () => expect(formatMs(-1)).toBe('0ms'));
    test('formats null', () => expect(formatMs(null)).toBe('0ms'));
    test('formats undefined', () => expect(formatMs(undefined)).toBe('0ms'));
    test('formats milliseconds', () => expect(formatMs(500)).toBe('500ms'));
    test('formats seconds', () => expect(formatMs(1500)).toBe('1.5s'));
    test('formats minutes', () => expect(formatMs(90000)).toBe('1.5min'));
    test('formats 999ms', () => expect(formatMs(999)).toBe('999ms'));
    test('formats 1000ms', () => expect(formatMs(1000)).toBe('1.0s'));
    test('formats 60000ms', () => expect(formatMs(60000)).toBe('1.0min'));
});

describe('formatNumber', () => {
    test('formats null', () => expect(formatNumber(null)).toBe('-'));
    test('formats undefined', () => expect(formatNumber(undefined)).toBe('-'));
    test('formats 0', () => expect(formatNumber(0)).toBe('0'));
    test('formats small number', () => expect(formatNumber(42)).toBe('42'));
    test('formats thousands', () => expect(formatNumber(1500)).toBe('1.5K'));
    test('formats millions', () => expect(formatNumber(2500000)).toBe('2.5M'));
    test('formats 999', () => expect(formatNumber(999)).toBe('999'));
    test('formats 1000', () => expect(formatNumber(1000)).toBe('1.0K'));
    test('formats 1000000', () => expect(formatNumber(1000000)).toBe('1.0M'));
});
