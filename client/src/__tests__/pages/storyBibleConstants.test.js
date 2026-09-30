/**
 * storyBibleConstants.test.js — 全书设定的值转换
 *
 * 背景（2026-10-01 用户报告"数据格式不匹配"）：受控 input 的 value 若是对象，
 * React 会渲染成 "[object Object]" 并对 value 赋对象告警；
 * 而 parentPlane/parentFaction 这类引用型字段在写入路径会被 normalizeMaterial 处理，
 * 历史上出现过非字符串形态；强度字段还受后端 isIn(['light','medium','heavy']) 约束。
 * 这里锁住"任何形态都能安全变成可输入字符串"。
 */
import { describe, test, expect } from 'vitest';
import { asText, asIntensity, charSummary, hasLanguageProfile, roleLabel, roleColor } from '../../pages/storybible/storyBibleConstants';

describe('asText', () => {
    test('字符串原样返回', () => {
        expect(asText('东北')).toBe('东北');
        expect(asText('')).toBe('');
    });
    test('null/undefined → 空串（不能是 "null"/"undefined" 字面量）', () => {
        expect(asText(null)).toBe('');
        expect(asText(undefined)).toBe('');
    });
    test('数字/布尔转字符串', () => {
        expect(asText(20)).toBe('20');
        expect(asText(false)).toBe('false');
    });
    test('对象取可读字段（引用型字段后端可能返回对象）', () => {
        expect(asText({ id: 'p1', name: '主世界' })).toBe('主世界');
        expect(asText({ label: '漕帮' })).toBe('漕帮');
        expect(asText({ id: 'x9' })).toBe('x9');
        expect(asText({})).toBe('');
    });
    test('数组用顿号连接，且过滤空值', () => {
        expect(asText(['漕帮', null, '白事堂'])).toBe('漕帮、白事堂');
    });
    test('绝不会产出 [object Object]', () => {
        expect(asText({ a: 1 })).not.toContain('[object');
        expect(asText({ nested: { deep: true } })).not.toContain('[object');
    });
});

describe('asIntensity', () => {
    test('合法值原样保留（后端 isIn 校验）', () => {
        expect(asIntensity('light')).toBe('light');
        expect(asIntensity('heavy')).toBe('heavy');
        expect(asIntensity('medium')).toBe('medium');
    });
    test('非法值/空值回落 medium，避免保存被 400 拒绝', () => {
        expect(asIntensity('超重')).toBe('medium');
        expect(asIntensity(null)).toBe('medium');
        expect(asIntensity(undefined)).toBe('medium');
        expect(asIntensity({ a: 1 })).toBe('medium');
    });
});

describe('角色卡辅助', () => {
    test('charSummary 截断过长文本', () => {
        expect(charSummary({ description: '短' })).toBe('短');
        expect(charSummary({ description: 'x'.repeat(100) }).length).toBeLessThanOrEqual(57);
        expect(charSummary({})).toBe('');
    });
    test('hasLanguageProfile：有方言或语体即标记', () => {
        expect(hasLanguageProfile({ dialectRegion: '东北' })).toBe(true);
        expect(hasLanguageProfile({ speechStyle: 'abstract' })).toBe(true);
        expect(hasLanguageProfile({})).toBe(false);
    });
    test('roleLabel/roleColor 覆盖三类且未知有兜底', () => {
        expect(roleLabel('protagonist')).toBe('主角');
        expect(roleLabel('npc')).toBe('NPC');
        expect(roleLabel(undefined)).toBe('未标注');
        expect(roleColor('protagonist')).toBe('#ffa502');
        expect(roleColor('weird')).toBe('#8d99ae');
    });
});
