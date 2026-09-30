/**
 * progressConstants.test.js — 运行看板格式化与状态映射
 * 关键点：没有数据时必须显示"—"，不能伪造成 0（避免用户以为"这一步 0 秒"）。
 */
import { describe, test, expect } from 'vitest';
import { fmtDuration, fmtNum, statusMeta, stepStatusColor } from '../../pages/progress/progressConstants';

describe('fmtDuration', () => {
    test('分级显示 秒/分/小时', () => {
        expect(fmtDuration(1500)).toBe('2秒');
        expect(fmtDuration(133000)).toBe('2分13秒');
        expect(fmtDuration(3 * 3600 * 1000 + 5 * 60 * 1000)).toBe('3小时5分');
    });
    test('无数据/负数显示 —（不显示 0 秒）', () => {
        expect(fmtDuration(0)).toBe('—');
        expect(fmtDuration(null)).toBe('—');
        expect(fmtDuration(undefined)).toBe('—');
        expect(fmtDuration(-5)).toBe('—');
    });
});

describe('fmtNum', () => {
    test('千分位；非数字回退 —', () => {
        expect(fmtNum(1234567)).toBe('1,234,567');
        expect(fmtNum(undefined)).toBe('—');
    });
});

describe('statusMeta', () => {
    test('已知状态有中文与颜色', () => {
        expect(statusMeta('material-updated').label).toBe('已完成');
        expect(statusMeta('failed-skipped').color).toBe('#ff4757');
    });
    test('未知状态回落灰但保留原名', () => {
        expect(statusMeta('weird').label).toBe('weird');
        expect(statusMeta(undefined).label).toBe('未知');
    });
});

describe('stepStatusColor', () => {
    test('passed=false 优先判失败（即使 status 是 completed）', () => {
        expect(stepStatusColor('completed', false)).toBe('#ff4757');
        expect(stepStatusColor('completed', true)).toBe('#2ed573');
        expect(stepStatusColor('failed', null)).toBe('#ff4757');
    });
});
