/**
 * craftWriteGate 单元测试 — 工艺字段唯一写入门禁（M1）
 *
 * 治的是 2026-10-17 取证到的真实脏数据：
 *   - 设计期解析（characterStateExtractor → buildCharacterEntityPatch）绕过校验直写实体；
 *   - 素材管理员特质增量（processTraitNotes）写裸字符串 catchphrases。
 */
const { gateEntityCraftPatch } = require('../../server/services/craftWriteGate');

const goodCharisma = '当【队友受伤拖累进度】时，他宁可【背着队友走完】，也不【抛下他独自逃生】';

describe('gateEntityCraftPatch', () => {
    test('不合格工艺字段被丢弃，非工艺字段原样保留', () => {
        const out = gateEntityCraftPatch({
            roleLevel: 'protagonist',
            quoteLibrary: [{ scene: '通用场景', quote: '路就在脚下', why: '' }],
            charisma: '智勇双全、游走于灰色地带',
        });
        expect(out.roleLevel).toBe('protagonist');
        expect(out.quoteLibrary).toBeUndefined();
        expect(out.charisma).toBeUndefined();
    });

    test('合规范例保留（防误伤）', () => {
        const out = gateEntityCraftPatch({
            charisma: goodCharisma,
            quoteLibrary: [{ scene: '对账时发现假账', quote: '这笔账不平', why: '因为他把账当命根子，所以宁可掀桌也不放过一笔糊涂账' }],
            catchphrases: [{ text: '珠子落定才算完', trigger: '确认交易结束时', why: '这是他的招牌话，别人说会怪' }],
        });
        expect(out.charisma).toBe(goodCharisma);
        expect(out.quoteLibrary).toHaveLength(1);
        expect(out.catchphrases).toHaveLength(1);
    });

    test('混合数组只保留合格项', () => {
        const out = gateEntityCraftPatch({
            highlightScenes: [
                { scene: '对峙', what: '划出蓝光弧线冻结探员', cost: '暴露底牌', why: '因为他怕线索断，所以宁可违规也不退' },
                { scene: '处境', what: '摇头否定并给出精密方案', cost: '', why: '记忆点：体现冷静' },
            ],
        });
        expect(out.highlightScenes).toHaveLength(1);
        expect(out.highlightScenes[0].what).toContain('蓝光弧线');
    });

    test('裸字符串口头禅（无 trigger/why）被丢弃', () => {
        const out = gateEntityCraftPatch({ catchphrases: ['清理完毕。'] });
        expect(out.catchphrases).toBeUndefined();
    });

    test('非对象入参原样返回', () => {
        expect(gateEntityCraftPatch(null)).toBeNull();
        expect(gateEntityCraftPatch('x')).toBe('x');
    });
});
