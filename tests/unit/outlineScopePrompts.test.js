/**
 * P1-4b 两档大纲 prompt/素材投放 单元测试
 * 约束：远景粗纲不得喂素材"内容"（否则规划超前把细节写死）；
 *      就近细纲必须以素材为准（含上一章正文节选）。
 */
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const {
    buildChapterOutlineSystemPrompt, buildSupplementOutlineSystemPrompt,
    buildNearOutlineSystemPrompt, buildOutlineMaterialDigest
} = require('../../server/services/pipeline/outlineTemplateBuilder');

const MATERIALS = [
    { type: 'character', name: '林三', currentContent: '谨慎的锁匠，右手有旧伤，独门开锁手法' },
    { type: 'worldview', name: '雾港设定', currentContent: '常年大雾，港口以齿轮机械为业' },
    { type: 'catchphrase', name: '口头禅', currentContent: '“再算一遍”' }
];

describe('buildOutlineMaterialDigest - 素材投放密度（P1-4b）', () => {
    test('far 档只给名录，不含素材内容', () => {
        const digest = buildOutlineMaterialDigest(MATERIALS, 'far');
        expect(digest).toContain('[character] 林三');
        expect(digest).toContain('[worldview] 雾港设定');
        expect(digest).not.toContain('右手有旧伤');
        expect(digest).not.toContain('齿轮机械');
    });

    test('detail 档带内容摘要（旧行为保留）', () => {
        const digest = buildOutlineMaterialDigest(MATERIALS, 'detail');
        expect(digest).toContain('[character] 林三: 谨慎的锁匠');
    });

    test('不传 scope 默认走 far（防止调用方漏传把细节喂进去）', () => {
        expect(buildOutlineMaterialDigest(MATERIALS)).not.toContain('右手有旧伤');
    });

    test('空/缺省素材不抛错', () => {
        expect(buildOutlineMaterialDigest(null)).toBe('');
        expect(buildOutlineMaterialDigest([{ type: 'character', name: '无内容' }])).toBe('[character] 无内容');
    });
});

describe('buildChapterOutlineSystemPrompt - 远景粗纲约束（P1-4b）', () => {
    test('far 档 prompt 含"远景粗纲"约束段，明令不写设定细节', () => {
        const prompt = buildChapterOutlineSystemPrompt('G', 'S', 'R', 'A', 30, 'far');
        expect(prompt).toContain('【远景粗纲】');
        expect(prompt).toContain('不要写具体设定细节');
    });

    test('默认（不传 scope）即 far，约束段存在', () => {
        expect(buildChapterOutlineSystemPrompt('G', 'S', 'R', 'A', 30)).toContain('【远景粗纲】');
    });

    test('detail 档不含远景约束段（仅用于确需一次性定细节的场景）', () => {
        expect(buildChapterOutlineSystemPrompt('G', 'S', 'R', 'A', 30, 'detail')).not.toContain('【远景粗纲】');
    });

    test('四段节拍与输出格式在所有档位都保留', () => {
        for (const scope of ['far', 'detail']) {
            const prompt = buildChapterOutlineSystemPrompt('G', 'S', 'R', 'A', 30, scope);
            expect(prompt).toContain('【场景4·章末钩子】');
            expect(prompt).toContain('"chapterNumber": 1');
        }
    });
});

describe('buildNearOutlineSystemPrompt - 就近细纲约束（P1-4b）', () => {
    const prompt = buildNearOutlineSystemPrompt('题材约束', '风格注入', 12);

    test('带章号与题材/风格注入', () => {
        expect(prompt).toContain('第12章');
        expect(prompt).toContain('题材约束');
        expect(prompt).toContain('风格注入');
    });

    test('四条硬约束齐备：以素材为准/不改主线/四段节拍/不得凭空造物', () => {
        expect(prompt).toContain('以素材为准');
        expect(prompt).toContain('不改主线');
        expect(prompt).toContain('不得凭空造物');
        expect(prompt).toContain('【场景1·铺垫】');
    });

    test('输出契约为 JSON 对象（title/outline/adjust）', () => {
        expect(prompt).toContain('"adjust"');
        expect(prompt).toContain('{"title":');
    });

    test('补充大纲 prompt 仍走"名录"（已有实现，不回归）', () => {
        const sup = buildSupplementOutlineSystemPrompt('G', 'S', 31, 40);
        expect(sup).toContain('第31章到第40章');
    });
});
