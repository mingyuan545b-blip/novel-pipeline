/**
 * _buildTechniqueHints 单测（A2）
 * F6：原首行 detectGenre 未定义 → 调用即抛 ReferenceError，且调用点在 try 之外 → reviewChapter 必抛。
 * 见 docs/worklog/2026-10-17-假成果审查-问题统计.md
 */
const { _buildTechniqueHints } = require('../../server/services/chapterAuditor/hardBlockChecks');

describe('_buildTechniqueHints（F6 修复）', () => {
    const store = { getItem: async () => null, queryItems: async () => [] };

    test('不再因 detectGenre 未定义抛错，返回字符串', async () => {
        const r = await _buildTechniqueHints('他沉默了。空气仿佛凝固。', { genre: 'x' }, 'p1', store);
        expect(typeof r).toBe('string');
    });

    test('无 projectId / store 缺失时仍不抛', async () => {
        await expect(_buildTechniqueHints('内容内容内容', {}, null, null)).resolves.toEqual(expect.any(String));
    });

    test('store 抛错时 try 兜底，不冒泡到调用方', async () => {
        const badStore = {
            getItem: async () => { throw new Error('db down'); },
            queryItems: async () => { throw new Error('db down'); },
        };
        await expect(_buildTechniqueHints('内容', {}, 'p1', badStore)).resolves.toEqual(expect.any(String));
    });
});
