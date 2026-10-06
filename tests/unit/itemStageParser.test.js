const { parseStagesFromContent, buildItemProperties } = require('../../server/services/itemStageParser');

describe('itemStageParser — 装备/功法成长阶段解析（P0-D）', () => {
    test('中文分节：阶 + 属性 + 特效', () => {
        const c = '【功能】斩妖\n【成长阶段】\n一阶：攻击+4，微光\n二阶·凝罡：攻击+12，罡气外放\n【当前阶段】二阶';
        const r = parseStagesFromContent(c);
        expect(r.stages).toHaveLength(2);
        expect(r.stages[0]).toMatchObject({ key: '一阶', attributes: { 攻击: '+4' } });
        expect(r.stages[1].label).toBe('二阶·凝罡');
        expect(r.stages[1].effects).toContain('罡气外放');
        expect(r.currentStage).toBe('二阶');
    });
    test('内嵌 JSON 优先', () => {
        const c = '{"stages":[{"key":"一阶","attributes":{"攻击":"+1"}}],"currentStage":"一阶"}';
        const r = parseStagesFromContent(c);
        expect(r.stages[0].key).toBe('一阶');
        expect(r.currentStage).toBe('一阶');
    });
    test('无阶段返回 null / 空结构', () => {
        expect(parseStagesFromContent('【功能】普通物品')).toBeNull();
        expect(buildItemProperties('无标签正文')).toEqual({ currentStage: '', stages: [] });
    });
    test('数字编号行也识别', () => {
        const c = '【成长阶段】\n1. 一阶：攻击+2\n2. 二阶：攻击+6，破甲';
        const r = parseStagesFromContent(c);
        expect(r.stages).toHaveLength(2);
        expect(r.stages[1].effects).toContain('破甲');
    });
});
