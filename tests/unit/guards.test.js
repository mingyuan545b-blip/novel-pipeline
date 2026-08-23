'use strict';

/**
 * foreshadowGuard + characterArcGuard 单元测试（R5）
 *
 * 测试策略：
 * - mock knowledgeBase（foreshadowLedger + consistencyChecker）
 * - mock entityCenter
 * - 覆盖超期检测/回收率统计/注入文本生成/一致性检查
 *
 * 文件位置：tests/unit/guards.test.js
 */

// mock knowledgeBase
jest.mock('../../server/services/knowledgeBase', () => ({
    foreshadowLedger: {
        getActive: jest.fn().mockResolvedValue([]),
        getStats: jest.fn().mockResolvedValue({})
    },
    consistencyChecker: {
        recordCheck: jest.fn().mockResolvedValue()
    }
}));

// mock entityCenter
jest.mock('../../server/services/entityCenter', () => ({
    getEntitiesForProject: jest.fn().mockResolvedValue([])
}));

const { foreshadowGuard, ForeshadowGuard, FORESHADOW_CONFIG } = require('../../server/services/foreshadowGuard');
const { characterArcGuard, CharacterArcGuard, ARC_CONFIG } = require('../../server/services/characterArcGuard');
const { foreshadowLedger, consistencyChecker } = require('../../server/services/knowledgeBase');
const entityCenter = require('../../server/services/entityCenter');

// 构造伏笔对象
function makeForeshadow(id, name, opts = {}) {
    return {
        id, name,
        plantChapter: opts.plantChapter || 1,
        lastAdvanceChapter: opts.lastAdvanceChapter,
        importance: opts.importance || 'normal',
        storyline: opts.storyline || 'main',
        status: opts.status || 'planted'
    };
}

// 构造角色对象
function makeCharacter(id, name, opts = {}) {
    const char = {
        id, name,
        entityType: 'character',
        appearances: opts.appearances || 0,
        innerVoiceCount: opts.innerVoiceCount || 0
    };
    // 只在明确提供时设置字段，否则留给 baseState fallback 测试
    if (opts.lastAppearChapter !== undefined) char.lastAppearChapter = opts.lastAppearChapter;
    if (opts.roleLevel !== undefined) char.roleLevel = opts.roleLevel;
    else char.roleLevel = 'supporting'; // 默认值（测试未指定时）
    if (opts.genreState !== undefined) char.genreState = opts.genreState;
    if (opts.baseState !== undefined) char.baseState = opts.baseState;
    return char;
}

describe('foreshadowGuard (R5)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('FORESHADOW_CONFIG', () => {
        test('包含关键阈值', () => {
            expect(FORESHADOW_CONFIG.OVERDUE_ADVANCE_CHAPTERS).toBe(10);
            expect(FORESHADOW_CONFIG.OVERDUE_RESOLVE_CHAPTERS).toBe(30);
            expect(FORESHADOW_CONFIG.IMPORTANT_OVERDUE_CHAPTERS).toBe(5);
            expect(FORESHADOW_CONFIG.TARGET_RESOLVE_RATE).toBe(0.7);
        });
    });

    describe('getOverdueForeshadows', () => {
        test('无活跃伏笔返回空数组', async () => {
            foreshadowLedger.getActive.mockResolvedValue([]);
            const result = await foreshadowGuard.getOverdueForeshadows('p1', 10);
            expect(result).toEqual([]);
        });

        test('普通伏笔 lastAdvance > 10 触发 warning', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '伏笔1', { plantChapter: 1, lastAdvanceChapter: 1 })
            ]);
            const result = await foreshadowGuard.getOverdueForeshadows('p1', 15);
            // lastAdvance = 15-1=14 > 10
            expect(result.length).toBe(1);
            expect(result[0].overdueType).toBe('no_advance');
            expect(result[0].severity).toBe('warning');
            expect(result[0].chaptersSinceAdvance).toBe(14);
        });

        test('重要伏笔 lastAdvance > 5 触发（更严格阈值）', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '重要伏笔', { plantChapter: 1, lastAdvanceChapter: 1, importance: 'critical' })
            ]);
            const result = await foreshadowGuard.getOverdueForeshadows('p1', 8);
            // lastAdvance = 8-1=7 > 5 (IMPORTANT_OVERDUE_CHAPTERS)
            expect(result.length).toBe(1);
            expect(result[0].chaptersSinceAdvance).toBe(7);
        });

        test('lastAdvance > 30 触发 critical 严重度', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '伏笔1', { plantChapter: 1, lastAdvanceChapter: 1 })
            ]);
            const result = await foreshadowGuard.getOverdueForeshadows('p1', 35);
            // lastAdvance = 35-1=34 > 30
            expect(result.length).toBe(1);
            expect(result[0].severity).toBe('critical');
            expect(result[0].suggestion).toContain('回收');
        });

        test('recent 引用不触发', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '伏笔1', { plantChapter: 1, lastAdvanceChapter: 10 })
            ]);
            const result = await foreshadowGuard.getOverdueForeshadows('p1', 12);
            // lastAdvance = 12-10=2 < 10
            expect(result).toEqual([]);
        });

        test('lastAdvanceChapter 缺失时使用 plantChapter', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '伏笔1', { plantChapter: 1, lastAdvanceChapter: undefined })
            ]);
            const result = await foreshadowGuard.getOverdueForeshadows('p1', 15);
            // lastAdvance = 15 - plantChapter(1) = 14 > 10
            expect(result.length).toBe(1);
        });

        test('importance 为 major 也视为重要', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '伏笔1', { plantChapter: 1, lastAdvanceChapter: 1, importance: 'major' })
            ]);
            const result = await foreshadowGuard.getOverdueForeshadows('p1', 8);
            // major → IMPORTANT_OVERDUE_CHAPTERS=5, lastAdvance=7 > 5
            expect(result.length).toBe(1);
        });
    });

    describe('getResolveStats', () => {
        test('无统计数据返回全 0', async () => {
            foreshadowLedger.getStats.mockResolvedValue({});
            const stats = await foreshadowGuard.getResolveStats('p1');
            expect(stats.total).toBe(0);
            expect(stats.resolved).toBe(0);
            expect(stats.resolveRate).toBe(0);
            expect(stats.meetsTarget).toBe(false); // 0 < 0.7
        });

        test('计算回收率', async () => {
            foreshadowLedger.getStats.mockResolvedValue({
                total: 10, resolved: 8, abandoned: 1, planted: 3, advanced: 2
            });
            const stats = await foreshadowGuard.getResolveStats('p1');
            expect(stats.total).toBe(10);
            expect(stats.resolved).toBe(8);
            expect(stats.abandoned).toBe(1);
            expect(stats.active).toBe(5); // planted+advanced
            expect(stats.resolveRate).toBe(0.8);
            expect(stats.abandonRate).toBe(0.1);
            expect(stats.meetsTarget).toBe(true); // 0.8 >= 0.7
        });

        test('total=0 时 meetsTarget=false', async () => {
            foreshadowLedger.getStats.mockResolvedValue({ total: 0, resolved: 0 });
            const stats = await foreshadowGuard.getResolveStats('p1');
            expect(stats.resolveRate).toBe(0);
            expect(stats.meetsTarget).toBe(false);
        });

        test('resolveRate < 0.7 时 meetsTarget=false', async () => {
            foreshadowLedger.getStats.mockResolvedValue({ total: 10, resolved: 5 });
            const stats = await foreshadowGuard.getResolveStats('p1');
            expect(stats.resolveRate).toBe(0.5);
            expect(stats.meetsTarget).toBe(false);
        });
    });

    describe('generateForeshadowHint', () => {
        test('无活跃和超期伏笔返回空字符串', async () => {
            foreshadowLedger.getActive.mockResolvedValue([]);
            const result = await foreshadowGuard.generateForeshadowHint('p1', 10);
            expect(result).toBe('');
        });

        test('有主线伏笔时包含主线标记', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '主线伏笔', { plantChapter: 1, storyline: 'main', status: 'planted' })
            ]);
            const result = await foreshadowGuard.generateForeshadowHint('p1', 10);
            expect(result).toContain('主线伏笔');
            expect(result).toContain('必须推进');
            expect(result).toContain('主线伏笔');
        });

        test('有支线伏笔时包含支线标记', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '支线伏笔', { plantChapter: 1, storyline: 'sub', status: 'advanced' })
            ]);
            const result = await foreshadowGuard.generateForeshadowHint('p1', 10);
            expect(result).toContain('支线伏笔');
            expect(result).toContain('已推进');
        });

        test('超期主线伏笔包含 🚨 标记', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '主线超期', { plantChapter: 1, lastAdvanceChapter: 1, storyline: 'main' })
            ]);
            const result = await foreshadowGuard.generateForeshadowHint('p1', 35);
            expect(result).toContain('🚨');
            expect(result).toContain('主线伏笔超期');
        });

        test('超期支线伏笔包含 ⚠️ 标记', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '支线超期', { plantChapter: 1, lastAdvanceChapter: 1, storyline: 'sub' })
            ]);
            const result = await foreshadowGuard.generateForeshadowHint('p1', 35);
            expect(result).toContain('⚠️');
            expect(result).toContain('支线伏笔超期');
        });

        test('主线伏笔最多展示 5 个', async () => {
            const many = [];
            for (let i = 0; i < 10; i++) {
                many.push(makeForeshadow(`f${i}`, `伏笔${i}`, { plantChapter: 1, storyline: 'main' }));
            }
            foreshadowLedger.getActive.mockResolvedValue(many);
            const result = await foreshadowGuard.generateForeshadowHint('p1', 10);
            // slice(0,5) 限制 5 个
            const count = (result.match(/▸/g) || []).length;
            expect(count).toBe(5);
        });
    });

    describe('checkForeshadowConsistency', () => {
        test('无超期返回空数组', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '伏笔1', { plantChapter: 1, lastAdvanceChapter: 10 })
            ]);
            const result = await foreshadowGuard.checkForeshadowConsistency('p1', 12);
            expect(result).toEqual([]);
            expect(consistencyChecker.recordCheck).not.toHaveBeenCalled();
        });

        test('有超期时调用 consistencyChecker.recordCheck', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '伏笔1', { plantChapter: 1, lastAdvanceChapter: 1 })
            ]);
            const result = await foreshadowGuard.checkForeshadowConsistency('p1', 15);
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('foreshadow_overdue');
            expect(consistencyChecker.recordCheck).toHaveBeenCalledTimes(1);
        });

        test('recordCheck 抛错不阻塞', async () => {
            consistencyChecker.recordCheck.mockRejectedValue(new Error('db'));
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '伏笔1', { plantChapter: 1, lastAdvanceChapter: 1 })
            ]);
            const result = await foreshadowGuard.checkForeshadowConsistency('p1', 15);
            expect(result.length).toBe(1); // 仍返回 issues
        });
    });

    describe('generateForeshadowCheckHint', () => {
        test('无 issue 返回空字符串', async () => {
            foreshadowLedger.getActive.mockResolvedValue([]);
            const result = await foreshadowGuard.generateForeshadowCheckHint('p1', 10);
            expect(result).toBe('');
        });

        test('有 issue 返回提示文本', async () => {
            foreshadowLedger.getActive.mockResolvedValue([
                makeForeshadow('f1', '伏笔1', { plantChapter: 1, lastAdvanceChapter: 1 })
            ]);
            const result = await foreshadowGuard.generateForeshadowCheckHint('p1', 15);
            expect(result).toContain('伏笔一致性检测');
            expect(result).toContain('1个问题');
        });
    });
});

describe('characterArcGuard (R5)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('ARC_CONFIG', () => {
        test('包含关键阈值', () => {
            expect(ARC_CONFIG.DISAPPEAR_THRESHOLD_CHAPTERS).toBe(8);
            expect(ARC_CONFIG.STALL_THRESHOLD_CHAPTERS).toBe(10);
            expect(ARC_CONFIG.TOOL_CHARACTER_THRESHOLD).toBe(5);
            expect(ARC_CONFIG.PROTAGONIST_INNER_VOICE_INTERVAL).toBe(3);
        });
    });

    describe('checkCharacterArcs', () => {
        test('无角色返回空数组', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([]);
            const result = await characterArcGuard.checkCharacterArcs('p1', 10);
            expect(result).toEqual([]);
        });

        test('主角消失 > 8 章触发 critical', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '主角', {
                    lastAppearChapter: 1,
                    roleLevel: 'protagonist'
                })
            ]);
            const result = await characterArcGuard.checkCharacterArcs('p1', 15);
            // gap = 15-1=14 > 8
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('character_disappeared');
            expect(result[0].severity).toBe('critical');
            expect(result[0].description).toContain('主角');
        });

        test('main 角色消失触发 warning', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '主要角色', {
                    lastAppearChapter: 1,
                    roleLevel: 'main'
                })
            ]);
            const result = await characterArcGuard.checkCharacterArcs('p1', 15);
            expect(result.length).toBe(1);
            expect(result[0].severity).toBe('warning');
        });

        test('supporting 角色消失不触发（非 protagonist/main）', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '配角', {
                    lastAppearChapter: 1,
                    roleLevel: 'supporting'
                })
            ]);
            const result = await characterArcGuard.checkCharacterArcs('p1', 15);
            // supporting 不触发消失告警
            expect(result.filter(r => r.type === 'character_disappeared')).toHaveLength(0);
        });

        test('弧线停滞 > 10 章触发 warning', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '主角', {
                    lastAppearChapter: 15,
                    roleLevel: 'protagonist',
                    genreState: {
                        arcPhase: 'rising',
                        lastArcChangeChapter: 2
                    }
                })
            ]);
            const result = await characterArcGuard.checkCharacterArcs('p1', 15);
            // 15-2=13 > 10
            const stalled = result.filter(r => r.type === 'arc_stalled');
            expect(stalled.length).toBe(1);
            expect(stalled[0].description).toContain('停滞');
        });

        test('工具人化检测（appearances > 5 且 innerVoice=0）', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '配角', {
                    lastAppearChapter: 15,
                    roleLevel: 'supporting',
                    appearances: 10,
                    innerVoiceCount: 0
                })
            ]);
            const result = await characterArcGuard.checkCharacterArcs('p1', 15);
            const tool = result.filter(r => r.type === 'tool_character');
            expect(tool.length).toBe(1);
            expect(tool[0].description).toContain('工具人化');
        });

        test('background 角色不触发工具人化', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '背景板', {
                    lastAppearChapter: 15,
                    roleLevel: 'background',
                    appearances: 10,
                    innerVoiceCount: 0
                })
            ]);
            const result = await characterArcGuard.checkCharacterArcs('p1', 15);
            expect(result.filter(r => r.type === 'tool_character')).toHaveLength(0);
        });

        test('recordCheck 被调用', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '主角', {
                    lastAppearChapter: 1,
                    roleLevel: 'protagonist'
                })
            ]);
            await characterArcGuard.checkCharacterArcs('p1', 15);
            expect(consistencyChecker.recordCheck).toHaveBeenCalled();
        });

        test('entityCenter 抛错返回空数组', async () => {
            entityCenter.getEntitiesForProject.mockRejectedValue(new Error('db'));
            const result = await characterArcGuard.checkCharacterArcs('p1', 15);
            expect(result).toEqual([]);
        });

        test('baseState 作为 fallback', async () => {
            // 直接构造对象，不通过 makeCharacter（避免默认 roleLevel 覆盖）
            entityCenter.getEntitiesForProject.mockResolvedValue([
                {
                    id: 'c1', name: '主角', entityType: 'character',
                    // lastAppearChapter 和 roleLevel 故意缺失，走 baseState fallback
                    baseState: {
                        lastAppearChapter: 1,
                        roleLevel: 'protagonist'
                    },
                    appearances: 0,
                    innerVoiceCount: 0
                }
            ]);
            const result = await characterArcGuard.checkCharacterArcs('p1', 15);
            expect(result.filter(r => r.type === 'character_disappeared').length).toBe(1);
        });
    });

    describe('getCharacterActivityStats', () => {
        test('返回按 roleLevel 排序的统计', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '配角', { lastAppearChapter: 10, roleLevel: 'supporting' }),
                makeCharacter('c2', '主角', { lastAppearChapter: 10, roleLevel: 'protagonist' }),
                makeCharacter('c3', '主要', { lastAppearChapter: 10, roleLevel: 'main' })
            ]);
            const stats = await characterArcGuard.getCharacterActivityStats('p1', 12);
            expect(stats.length).toBe(3);
            // roleOrder: protagonist=0 < main=1 < supporting=2
            // 验证 protagonist 在 main 之前，main 在 supporting 之前
            const protagonistIdx = stats.findIndex(s => s.roleLevel === 'protagonist');
            const mainIdx = stats.findIndex(s => s.roleLevel === 'main');
            const supportingIdx = stats.findIndex(s => s.roleLevel === 'supporting');
            expect(protagonistIdx).toBeLessThan(mainIdx);
            expect(mainIdx).toBeLessThan(supportingIdx);
        });

        test('isActive 字段正确计算', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '主角', { lastAppearChapter: 10, roleLevel: 'protagonist' })
            ]);
            const stats = await characterArcGuard.getCharacterActivityStats('p1', 12);
            // gap = 12-10=2 <= 8 → active
            expect(stats[0].isActive).toBe(true);
        });

        test('gap > 8 时 isActive=false', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '主角', { lastAppearChapter: 1, roleLevel: 'protagonist' })
            ]);
            const stats = await characterArcGuard.getCharacterActivityStats('p1', 15);
            // gap = 14 > 8 → inactive
            expect(stats[0].isActive).toBe(false);
        });

        test('lastAppear=0 时 gap=chapterNumber', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '新角色', { lastAppearChapter: 0, roleLevel: 'supporting' })
            ]);
            const stats = await characterArcGuard.getCharacterActivityStats('p1', 10);
            expect(stats[0].gap).toBe(10);
        });

        test('entityCenter 抛错返回空数组', async () => {
            entityCenter.getEntitiesForProject.mockRejectedValue(new Error('db'));
            const stats = await characterArcGuard.getCharacterActivityStats('p1', 10);
            expect(stats).toEqual([]);
        });
    });

    describe('generateCharacterArcCheckHint', () => {
        test('无 issue 返回空字符串', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([]);
            const result = await characterArcGuard.generateCharacterArcCheckHint('p1', 10);
            expect(result).toBe('');
        });

        test('有 issue 返回提示', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '主角', {
                    lastAppearChapter: 1,
                    roleLevel: 'protagonist'
                })
            ]);
            const result = await characterArcGuard.generateCharacterArcCheckHint('p1', 15);
            expect(result).toContain('角色弧线检测');
            expect(result).toContain('🚨'); // critical
        });
    });

    describe('generateCharacterActivityHint', () => {
        test('无不活跃角色返回空字符串', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '主角', { lastAppearChapter: 10, roleLevel: 'protagonist' })
            ]);
            const result = await characterArcGuard.generateCharacterActivityHint('p1', 11);
            expect(result).toBe('');
        });

        test('有不活跃角色返回提示', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '主角', { lastAppearChapter: 1, roleLevel: 'protagonist' })
            ]);
            const result = await characterArcGuard.generateCharacterActivityHint('p1', 15);
            expect(result).toContain('角色活跃度提醒');
            expect(result).toContain('主角');
        });

        test('background 角色不活跃不包含在提示中', async () => {
            entityCenter.getEntitiesForProject.mockResolvedValue([
                makeCharacter('c1', '背景', { lastAppearChapter: 1, roleLevel: 'background' })
            ]);
            const result = await characterArcGuard.generateCharacterActivityHint('p1', 15);
            expect(result).toBe('');
        });
    });
});
