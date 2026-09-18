/**
 * contextBudgetPolicy.test.js — 上下文预算/降级/相关性门控 回归测试
 *
 * 背景：2026-09-18 修复前，calculateBudget 的 totalAllocated 计算错误导致
 * 所有 Agent 恒判 red/force-minimal → 全部素材类型被压到 L0（人设退化为"名字|定位"）。
 * 本测试锁定修复后的行为，防止回归。
 */
const { calculateBudget } = require('../../server/services/pipeline/unifiedBudgetPool');
const { applyDegradation, applyDepthBoost } = require('../../server/services/pipeline/contextCommanderHelpers');
const { assessRelevance, collectOutlineMentionedTypes } = require('../../server/services/pipeline/contextRelevance');
const { getDeclaration } = require('../../server/services/pipeline/agentDeclarations');
const { resolveContext } = require('../../server/services/pipeline/contextCommander');
const { formatEntityByDepth } = require('../../server/services/pipeline/agentMaterialFormatter');
const { BUDGET_POLICY } = require('../../server/config/budgetPolicy');

const L2_NEEDS = (agent) => getDeclaration(agent).materialNeeds.map(n => ({ ...n, resolvedDepth: 'L2' }));

describe('calculateBudget 不再恒判超限', () => {
    test('预算充足时不产生降级计划（旧bug：totalAllocated算错导致恒red）', () => {
        const decl = getDeclaration('writer');
        const r = calculateBudget({
            model: 'qwen3.8-flash', resolvedNeeds: L2_NEEDS('writer'),
            sceneTypes: [], totalBudget: decl.totalBudget * 3,
        });
        expect(r.degradationPlan).toBeNull();
        expect(r.ratio).toBeLessThan(1);
        expect(r.plannedChars).toBeGreaterThan(0);
    });

    test('真实超支时只丢低优先级非必需类型，必需类型保留', () => {
        const decl = getDeclaration('writer');
        const r = calculateBudget({
            model: 'qwen3.8-flash', resolvedNeeds: L2_NEEDS('writer'),
            sceneTypes: [], totalBudget: 3000,
        });
        expect(r.degradationPlan).not.toBeNull();
        const dropped = r.degradationPlan.steps.filter(s => s.action === 'drop').map(s => s.type);
        expect(dropped.length).toBeGreaterThan(0);
        for (const t of ['character', 'worldview', 'relationship']) {
            expect(dropped).not.toContain(t);
        }
    });

    test('必需类深度不得低于 L2 下限', () => {
        const needs = L2_NEEDS('writer');
        const r = calculateBudget({
            model: 'qwen3.8-flash', resolvedNeeds: needs, sceneTypes: [], totalBudget: 500,
        });
        const floor = BUDGET_POLICY.minDepthByRequirement.required;
        for (const step of (r.degradationPlan?.steps || [])) {
            if (step.action === 'drop') continue;
            expect(Number(step.to.replace('L', ''))).toBeGreaterThanOrEqual(Number(floor.replace('L', '')));
        }
    });

    test('plannedChars 语义为字符预算（与 selectItems 同语义）', () => {
        const r = calculateBudget({
            model: 'qwen3.8-flash', resolvedNeeds: L2_NEEDS('reader'),
            sceneTypes: [], totalBudget: 2000,
        });
        expect(r.charBudget).toBe(2000);
        expect(r.tokenCeiling).toBeGreaterThan(2000);
    });
});

describe('applyDegradation 支持整类丢弃', () => {
    test('action=drop 时标记 dropped 且不改深度', () => {
        const needs = [{ type: 'equipment', resolvedDepth: 'L2' }];
        applyDegradation(needs, { steps: [{ type: 'equipment', action: 'drop', from: 'L2', to: null }] });
        expect(needs[0].dropped).toBe(true);
        expect(needs[0].resolvedDepth).toBe('L2');
    });
});

describe('自动深度上限', () => {
    test('applyDepthBoost 不超过 maxAutoDepth（防止原始JSON灌爆prompt）', () => {
        expect(applyDepthBoost('L2', 5)).toBe(BUDGET_POLICY.maxAutoDepth);
        expect(applyDepthBoost('L4', 0)).toBe(BUDGET_POLICY.maxAutoDepth);
    });
});

describe('相关性门控（每章只组合必要的素材）', () => {
    const materials = [
        { name: '林渊', type: 'character' },
        { name: '青云剑', type: 'equipment' },
    ];

    test('大纲点名的素材类型被识别', () => {
        const hit = collectOutlineMentionedTypes(materials, '林渊拔出青云剑');
        expect(hit.has('character')).toBe(true);
        expect(hit.has('equipment')).toBe(true);
    });

    test('场景命中的类型保留，未命中的非必需类型丢弃', () => {
        const sceneHit = assessRelevance(
            { type: 'power-system', required: false },
            { sceneBoost: 2, intentResult: null, outlineTypes: new Set() }
        );
        expect(sceneHit.relevant).toBe(true);
        const missed = assessRelevance(
            { type: 'catchphrase', required: false },
            { sceneBoost: 0, intentResult: null, outlineTypes: new Set() }
        );
        expect(missed.relevant).toBe(false);
    });

    test('一致性关键类型永不被相关性门控丢弃', () => {
        for (const type of BUDGET_POLICY.neverDropTypes) {
            const r = assessRelevance({ type, required: false }, { sceneBoost: 0, intentResult: null, outlineTypes: new Set() });
            expect(r.relevant).toBe(true);
        }
    });
});

describe('端到端装配决策', () => {
    test('战斗章保留战力体系，日常章不注入战力体系', async () => {
        const base = { projectId: 'p', materials: materials_stub(), project: { model: 'qwen3.8-flash' } };
        const combat = await resolveContext('writer', { ...base, chapter: { chapterNumber: 7, outline: '主角与敌人激战，施展功法击败对手' } });
        const daily = await resolveContext('writer', { ...base, chapter: { chapterNumber: 3, outline: '主角在城中闲逛，买了些补给' } });
        const keep = (r) => r.materialNeeds.filter(n => !n.dropped).map(n => n.type);
        expect(keep(combat)).toContain('power-system');
        expect(keep(daily)).not.toContain('power-system');
    });

    test('写字数充足时角色深度不再是 L0', async () => {
        const r = await resolveContext('writer', {
            projectId: 'p', materials: materials_stub(), project: { model: 'qwen3.8-flash' },
            chapter: { chapterNumber: 120, outline: '主角与师姐告别' },
        });
        const char = r.materialNeeds.find(n => n.type === 'character');
        expect(Number(char.resolvedDepth.replace('L', ''))).toBeGreaterThanOrEqual(2);
    });
});

describe('L0 信息密度', () => {
    test('实体 L0 至少带一句话锚点，不退化为"名字|定位"', () => {
        const text = formatEntityByDepth({ name: '林渊', roleLevel: 'protagonist', briefText: '青云宗外门弟子，性情坚韧' }, 'L0');
        expect(text).toContain('林渊');
        expect(text.length).toBeGreaterThan(6);
    });
});

function materials_stub() {
    return [{ id: '1', name: '林渊', type: 'character' }];
}

describe('长篇章阶段划分', () => {
    const { resolveChapterPhase, PHASE_RATIOS } = require('../../server/services/pipeline/contextDecisionRules');
    test('短篇仍按绝对章号（兼容旧行为）', () => {
        expect(resolveChapterPhase(3)).toBe('opening');
        expect(resolveChapterPhase(80)).toBe('climax');
    });
    test('长篇按完成比例划分（旧实现100章后全部回落development）', () => {
        expect(resolveChapterPhase(100, 2000)).toBe('opening');
        expect(resolveChapterPhase(1000, 2000)).toBe('development');
        expect(resolveChapterPhase(1900, 2000)).toBe('climax');
        expect(resolveChapterPhase(1999, 2000)).toBe('resolution');
    });
    test('阈值常量存在', () => {
        expect(PHASE_RATIOS.longNovelThreshold).toBeGreaterThan(0);
    });
});

describe('题材元素组合（genre → 素材类型）', () => {
    const { genreAccessForAgent } = require('../../server/services/pipeline/contextRelevance');
    test('题材未声明时不做限制', () => {
        expect(genreAccessForAgent(null, 'writer')).toBeNull();
    });
    test('题材声明的可见类型被解析为集合', () => {
        const set = genreAccessForAgent({ agentMaterialAccess: { writer: { needs: ['character', 'worldview'] } } }, 'writer');
        expect(set.has('character')).toBe(true);
        expect(set.has('equipment')).toBe(false);
    });
});
