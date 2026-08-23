/**
 * materialInjector.js 单元测试
 * 覆盖统一素材注入层的核心功能
 */
'use strict';

const { injectMaterials, SECTION_BUILDERS } = require('../../server/services/pipeline/materialInjector');

describe('materialInjector', () => {

    describe('injectMaterials - 基础功能', () => {
        test('空素材返回空注入', () => {
            const agentContext = { content: '' };
            const result = injectMaterials({ materials: {} }, agentContext);
            expect(result.sectionsInjected).toBe(0);
            expect(result.budgetUsed).toBe(0);
            expect(agentContext.content).toBe('');
        });

        test('null scheduled不报错', () => {
            const agentContext = { content: '' };
            const result = injectMaterials(null, agentContext);
            expect(result.sectionsInjected).toBe(0);
        });

        test('character和knowledge-access不注入', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    character: [{ name: '角色1', type: 'character', content: '内容' }],
                    'knowledge-access': [{ name: '限知1', type: 'knowledge-access', content: '内容' }],
                }
            };
            const result = injectMaterials(scheduled, agentContext);
            expect(result.sectionsInjected).toBe(0);
            expect(agentContext.content).toBe('');
        });
    });

    describe('injectMaterials - 各素材类型', () => {
        test('worldview注入核心设定段', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    worldview: [{ name: '世界观1', type: 'worldview', content: '世界设定内容' }],
                }
            };
            injectMaterials(scheduled, agentContext);
            expect(agentContext.content).toContain('核心设定');
            expect(agentContext.content).toContain('世界观1');
        });

        test('equipment注入装备段', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    equipment: [{ name: '装备1', type: 'equipment', content: '装备描述' }],
                }
            };
            injectMaterials(scheduled, agentContext);
            expect(agentContext.content).toContain('装备/道具');
            expect(agentContext.content).toContain('装备1');
        });

        test('foreshadowing只注入未回收伏笔（使用archived字段判断状态）', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    foreshadowing: [
                        { name: '已回收伏笔', type: 'foreshadowing', content: '已回收的伏笔内容', archived: true },
                        { name: '未回收伏笔', type: 'foreshadowing', content: '未回收的伏笔内容', archived: false },
                    ],
                }
            };
            injectMaterials(scheduled, agentContext);
            expect(agentContext.content).toContain('未回收伏笔');
            expect(agentContext.content).not.toContain('已回收伏笔');
        });

        test('foreshadowing全量模式显示所有伏笔及真实状态（foreshadowFilter=all）', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    foreshadowing: [
                        { name: '已回收伏笔', type: 'foreshadowing', content: '已回收的伏笔内容', archived: true },
                        { name: '未回收伏笔', type: 'foreshadowing', content: '未回收的伏笔内容', archived: false },
                    ],
                }
            };
            injectMaterials(scheduled, agentContext, { foreshadowFilter: 'all' });
            expect(agentContext.content).toContain('已回收伏笔');
            expect(agentContext.content).toContain('未回收伏笔');
            expect(agentContext.content).toContain('状态：已回收');
            expect(agentContext.content).toContain('状态：未回收');
        });

        test('catchphrase注入台词段', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    catchphrase: [{ name: '台词1', type: 'catchphrase', content: '经典台词' }],
                }
            };
            injectMaterials(scheduled, agentContext);
            expect(agentContext.content).toContain('经典台词参考');
            expect(agentContext.content).toContain('台词1');
        });
    });

    describe('injectMaterials - 预算控制', () => {
        test('超过预算时截断', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    worldview: [
                        { name: '设定1', type: 'worldview', content: 'A'.repeat(200) },
                        { name: '设定2', type: 'worldview', content: 'B'.repeat(200) },
                    ],
                }
            };
            const result = injectMaterials(scheduled, agentContext, { totalBudget: 300 });
            expect(agentContext.content).toContain('素材注入已达预算上限');
        });

        test('未超预算时完整注入', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    worldview: [{ name: '设定1', type: 'worldview', content: '短内容' }],
                }
            };
            const result = injectMaterials(scheduled, agentContext, { totalBudget: 8000 });
            expect(result.budgetUsed).toBeLessThan(8000);
            expect(agentContext.content).toContain('设定1');
        });
    });

    describe('injectMaterials - subPlane嵌套展示', () => {
        test('isInSubplane时展示嵌套关系', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    'sub-plane': [{ name: '小世界A', type: 'sub-plane', content: '小世界描述' }],
                    faction: [{ name: '势力1', type: 'faction', content: '势力描述', parentPlane: '小世界A' }],
                    equipment: [{ name: '道具1', type: 'equipment', content: '道具描述', parentPlane: '小世界A' }],
                }
            };
            injectMaterials(scheduled, agentContext, {
                isInSubplane: true,
                currentSubplaneId: '小世界A',
                chapterScene: '小世界A',
            });
            expect(agentContext.content).toContain('当前小世界');
            expect(agentContext.content).toContain('小世界A');
            expect(agentContext.content).toContain('势力1');
            expect(agentContext.content).toContain('可获取道具');
        });

        test('非subplane场景展示概要', () => {
            const agentContext = { content: '' };
            const scheduled = {
                materials: {
                    'sub-plane': [{ name: '小世界A', type: 'sub-plane', content: '小世界描述' }],
                }
            };
            injectMaterials(scheduled, agentContext, {
                isInSubplane: false,
                currentSubplaneId: null,
            });
            expect(agentContext.content).toContain('当前卷小世界概要');
        });
    });

    describe('SECTION_BUILDERS注册表', () => {
        test('包含所有素材类型构建器', () => {
            const expectedTypes = [
                'worldview', 'power-system', 'sub-plane', 'faction',
                'equipment', 'location', 'foreshadowing', 'catchphrase',
                'famous-scene', 'writing-technique', 'institution',
                'character-combat', 'growth-history', 'relationship',
            ];
            for (const type of expectedTypes) {
                expect(SECTION_BUILDERS[type]).toBeDefined();
                expect(typeof SECTION_BUILDERS[type]).toBe('function');
            }
        });
    });
});
