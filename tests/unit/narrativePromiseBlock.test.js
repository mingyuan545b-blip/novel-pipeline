/**
 * narrativePromise 提示块 + 字段单一源（E2b 回归）
 *
 * 修复前：写入端用 sellingPoint/mainLoop/emotionRecipe，消费端读 differentiator/coreLoop/emotionFormula，
 * 实测 4 个项目里 3 个的叙事承诺在写手提示词里只剩 1/4 条。
 */
const { buildNarrativePromiseBlock } = require('../../server/services/prompts/narrativePromise');
const { FIELDS, KEYS, pickField } = require('../../server/config/narrativePromiseSpec');

const WRITER_NAMING = { readerPromise: '看规则漏洞翻盘', sellingPoint: '民俗志怪职场', mainLoop: '三章一委托', emotionRecipe: '憋屈→翻盘' };
const LEGACY_NAMING = { readerPromise: '看规则漏洞翻盘', differentiator: '民俗志怪职场', coreLoop: '三章一委托', emotionFormula: '憋屈→翻盘' };

describe('buildNarrativePromiseBlock', () => {
    test('写入端命名（sellingPoint/mainLoop/emotionRecipe）四条全部注入', () => {
        const out = buildNarrativePromiseBlock({ narrativePromise: WRITER_NAMING });
        for (const f of FIELDS) expect(out).toContain(f.label);
        expect(out.split('\n')).toHaveLength(FIELDS.length + 2);
    });

    test('历史命名（differentiator/coreLoop/emotionFormula）同样四条全部注入', () => {
        const out = buildNarrativePromiseBlock({ narrativePromise: LEGACY_NAMING });
        for (const f of FIELDS) expect(out).toContain(f.label);
    });

    test('缺字段只注入存在的，全缺返回空串', () => {
        const partial = buildNarrativePromiseBlock({ narrativePromise: { readerPromise: '只有这一条' } });
        expect(partial.split('\n')).toHaveLength(3);
        expect(buildNarrativePromiseBlock({ narrativePromise: {} })).toBe('');
        expect(buildNarrativePromiseBlock(null)).toBe('');
        expect(buildNarrativePromiseBlock({})).toBe('');
    });
});

describe('narrativePromiseSpec 单一源', () => {
    test('KEYS 由 FIELDS 派生，两者不重复维护', () => {
        expect(KEYS).toEqual(FIELDS.map(f => f.key));
    });

    test('pickField 按 aliases 顺序取第一个非空值', () => {
        const selling = FIELDS.find(f => f.key === 'sellingPoint');
        expect(pickField({ sellingPoint: '新名' }, selling)).toBe('新名');
        expect(pickField({ differentiator: '旧名' }, selling)).toBe('旧名');
        expect(pickField({ sellingPoint: '新名', differentiator: '旧名' }, selling)).toBe('新名');
        expect(pickField({ sellingPoint: '   ' }, selling)).toBe('');
        expect(pickField(null, selling)).toBe('');
    });

    test('消费端不得再硬编码字段名（防再次分叉）', () => {
        const src = require('fs').readFileSync(
            require('path').join(__dirname, '../../server/services/prompts/narrativePromise.js'), 'utf8');
        expect(src).not.toMatch(/differentiator|coreLoop|emotionFormula/);
    });
});
