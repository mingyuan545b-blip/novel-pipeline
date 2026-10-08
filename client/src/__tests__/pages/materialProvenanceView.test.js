/**
 * T2 验收（前端）：素材出身展示
 * 验收标准：创建/最近更新/出身/创建时间 都要能显示；存量推断值必须标注"（推断）"。
 */
import { describe, test, expect } from 'vitest';
import { buildProvenanceRows, chapterLabel, formatProvenanceTime, ORIGIN_LABELS } from '../../pages/entitycenter/materialProvenanceView';

const rowMap = (rows) => Object.fromEntries(rows);

describe('chapterLabel', () => {
    test('章号 > 0 → 第N章', () => expect(chapterLabel(8)).toBe('第8章'));
    test('章号 0 → 建项时（不是空白）', () => expect(chapterLabel(0)).toBe('建项时'));
    test('缺失 → 空串', () => {
        expect(chapterLabel(null)).toBe('');
        expect(chapterLabel(undefined)).toBe('');
        expect(chapterLabel('')).toBe('');
    });
});

describe('formatProvenanceTime', () => {
    test('格式化到分钟', () => expect(formatProvenanceTime('2026-10-05T16:11:02.050Z')).toMatch(/^2026-10-0[56] \d{2}:11$/));
    test('非法值 → 空串', () => expect(formatProvenanceTime('not-a-date')).toBe(''));
    test('缺失 → 空串', () => expect(formatProvenanceTime(null)).toBe(''));
});

describe('buildProvenanceRows', () => {
    test('完整 provenance → 四行齐全（核心：第几章生成看得见）', () => {
        const rows = rowMap(buildProvenanceRows({}, {
            sourceChapter: 1,
            lastUpdatedChapter: 8,
            provenance: { createdChapter: 1, createdAt: '2026-10-05T16:11:00.000Z', origin: 'chapter', source: null },
        }));
        expect(rows['创建']).toBe('第1章');
        expect(rows['最近更新']).toBe('第8章');
        expect(rows['出身']).toBe('正文提取');
        expect(rows['创建时间']).toBeTruthy();
    });

    test('第1章创建、第8章更新 → 创建仍显示第1章（T2 缺陷的 UI 侧证据）', () => {
        const rows = rowMap(buildProvenanceRows({}, {
            sourceChapter: 8,           // 旧数据：被覆盖成 8
            provenance: { createdChapter: 1, createdAt: '2026-10-05T16:11:00.000Z', origin: 'chapter' },
            lastUpdatedChapter: 8,
        }));
        expect(rows['创建']).toBe('第1章');
    });

    test('存量推断值必须标注（不把猜测伪装成事实）', () => {
        const rows = rowMap(buildProvenanceRows({}, {
            provenance: { createdChapter: 3, createdAt: '2026-10-05T16:11:00.000Z', origin: 'outline', source: 'inferred-from-legacy' },
        }));
        expect(rows['创建']).toBe('第3章（推断）');
    });

    test('建项生成的素材显示"建项时"而不是空白', () => {
        const rows = rowMap(buildProvenanceRows({}, {
            provenance: { createdChapter: 0, createdAt: '2026-10-05T16:11:00.000Z', origin: 'outline' },
        }));
        expect(rows['创建']).toBe('建项时');
        expect(rows['出身']).toBe(ORIGIN_LABELS.outline);
    });

    test('无 provenance 的旧数据 → 回落 sourceChapter，不显示空行', () => {
        const rows = rowMap(buildProvenanceRows({ sourceChapter: 5 }, { sourceChapter: 5 }));
        expect(rows['创建']).toBe('第5章');
        expect(rows['创建时间']).toBeUndefined();
        expect(rows['最近更新']).toBeUndefined();
    });

    test('完全无数据 → 返回空数组（不渲染空壳）', () => {
        expect(buildProvenanceRows({}, {})).toEqual([]);
        expect(buildProvenanceRows(null, null)).toEqual([]);
    });
});
