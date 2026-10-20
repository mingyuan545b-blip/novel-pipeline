/**
 * materialDepthValidator.test.js — 素材深度校验器单元测试
 *
 * 验证点：
 *   1. 主角级（deep）角色素材必须包含人物魅力4维度
 *   2. 配角级（standard）角色素材只要求基础字段
 *   3. NPC级（basic）角色素材只要求辨识信息
 *   4. 世界观/伏笔/小世界/装备类型的深度校验
 *   5. 字段内容过短检测
 *   6. 字段质量关键词检测
 *   7. 批量校验统计
 */

const {
    validateMaterialDepth,
    resolveDepthLevel,
    validateField
} = require('../../server/services/materialDepthValidator');
const { validateMaterialDepthBatch } = require('../../server/services/materialDepthBatch');
const { buildDepthRepairPrompt } = require('../../server/services/materialDepthRepairPrompt');
const { DEPTH_LEVELS, extractFieldValue, countContentChars } = require('../../server/config/materialDepthSpec');

describe('materialDepthValidator', () => {
    describe('resolveDepthLevel', () => {
        test('显式 depthLevel 优先', () => {
            const m = { type: 'character', depthLevel: 'deep', roleLevel: 'npc' };
            expect(resolveDepthLevel(m)).toBe(DEPTH_LEVELS.DEEP);
        });

        test('根据 roleLevel 推断', () => {
            expect(resolveDepthLevel({ type: 'character', roleLevel: 'protagonist' })).toBe(DEPTH_LEVELS.DEEP);
            expect(resolveDepthLevel({ type: 'character', roleLevel: 'supporting' })).toBe(DEPTH_LEVELS.STANDARD);
            expect(resolveDepthLevel({ type: 'character', roleLevel: 'npc' })).toBe(DEPTH_LEVELS.BASIC);
        });

        test('无 roleLevel 默认 STANDARD', () => {
            expect(resolveDepthLevel({ type: 'worldview' })).toBe(DEPTH_LEVELS.STANDARD);
        });
    });

    describe('extractFieldValue', () => {
        test('提取字段值', () => {
            const content = '【核心欲望】想要成为最强\n【性格】冷静机智';
            expect(extractFieldValue(content, '核心欲望')).toBe('想要成为最强');
            expect(extractFieldValue(content, '性格')).toBe('冷静机智');
        });

        test('字段缺失返回空字符串', () => {
            const content = '【核心欲望】想要成为最强';
            expect(extractFieldValue(content, '性格')).toBe('');
        });

        test('多行字段值', () => {
            const content = '【金句库】场景1：金句1\n场景2：金句2\n【性格】冷静';
            const value = extractFieldValue(content, '金句库');
            expect(value).toContain('场景1：金句1');
            expect(value).toContain('场景2：金句2');
        });
    });

    describe('countContentChars', () => {
        test('去除标签和空白计数', () => {
            const content = '【标签】内容部分\n【标签2】更多内容';
            const count = countContentChars(content);
            expect(count).toBe('内容部分更多内容'.length);
        });

        test('空内容返回0', () => {
            expect(countContentChars('')).toBe(0);
            expect(countContentChars(null)).toBe(0);
        });
    });

    describe('主角级角色（deep）深度校验', () => {
        const validProtagonist = {
            type: 'character',
            roleLevel: 'protagonist',
            currentContent: `【身份/职位】青云宗外门弟子，前世游戏测试员
【性格】冷静机智，遇事先观察分析再行动，偶尔吐槽但关键时刻靠谱
【说话语气】清冷慵懒，喜欢用代码术语吐槽
【标志性细节】习惯性摸下巴思考，随身携带一把键盘飞剑
【核心欲望】这辈子绝不加班猝死，要找到回去的路
【内在矛盾】想躺平摸鱼 vs 责任感让他无法袖手旁观
【行为模式】遇到问题先观察分析，总是优先寻找系统漏洞
【成长弧光】从被动摸鱼到主动选择该摸则摸该卷则卷的平衡
【标志性动作】思考时敲击虚拟键盘
【人格魅力】吐槽役实用主义，BUG思维破局，护短
【哲学观】代码能跑就别动，人生能躺就别卷——但该修的BUG必须修
【金句库】遭遇非议：你们修的是天道，我修的是下班\n突破境界：这境界我卡了三百年BUG，今天终于提交了\n生死关头：死之前先把存档点了
【出场设计】穿越醒来第一反应不是震惊而是这渲染太差，奠定吐槽基调`
        };

        test('完整主角素材通过校验', () => {
            const result = validateMaterialDepth(validProtagonist);
            expect(result.valid).toBe(true);
            expect(result.depthLevel).toBe(DEPTH_LEVELS.DEEP);
            expect(result.missing).toEqual([]);
        });

        test('缺失人物魅力4维度任一字段 → invalid', () => {
            // 移除【人格魅力】字段
            const content = validProtagonist.currentContent.replace(/【人格魅力】[^【]*/, '');
            const result = validateMaterialDepth({ ...validProtagonist, currentContent: content });
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('人格魅力');
        });

        test('缺失哲学观 → invalid', () => {
            const content = validProtagonist.currentContent.replace(/【哲学观】[^【]*/, '');
            const result = validateMaterialDepth({ ...validProtagonist, currentContent: content });
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('哲学观');
        });

        test('缺失金句库 → invalid', () => {
            const content = validProtagonist.currentContent.replace(/【金句库】[^【]*(?:\n[^【]*)*/, '');
            const result = validateMaterialDepth({ ...validProtagonist, currentContent: content });
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('金句库');
        });

        test('缺失出场设计 → invalid', () => {
            const content = validProtagonist.currentContent.replace(/【出场设计】[^【]*/, '');
            const result = validateMaterialDepth({ ...validProtagonist, currentContent: content });
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('出场设计');
        });
    });

    describe('配角级角色（standard）深度校验', () => {
        const validSupporting = {
            type: 'character',
            roleLevel: 'supporting',
            currentContent: `【身份/职位】青云宗外门弟子，主角室友
【性格】憨厚热血，重义气但容易冲动，偶尔机智
【说话语气】豪爽直爽，喜欢大喊大叫
【标志性细节】身材高大，随身携带干粮袋，疤痕在左脸
【核心欲望】守护家人，成为体修传人
【行为模式】遇到问题总是先冲上去，习惯用蛮力解决`
        };

        test('完整配角素材通过校验', () => {
            const result = validateMaterialDepth(validSupporting);
            expect(result.valid).toBe(true);
            expect(result.depthLevel).toBe(DEPTH_LEVELS.STANDARD);
        });

        test('配角不要求人物魅力4维度', () => {
            // 配角素材没有【人格魅力】【哲学观】等字段，应通过
            const result = validateMaterialDepth(validSupporting);
            expect(result.missing).not.toContain('人格魅力');
            expect(result.missing).not.toContain('哲学观');
        });

        test('配角缺失核心欲望 → invalid', () => {
            const content = validSupporting.currentContent.replace(/【核心欲望】[^【]*/, '');
            const result = validateMaterialDepth({ ...validSupporting, currentContent: content });
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('核心欲望');
        });
    });

    describe('NPC级角色（basic）深度校验', () => {
        const validNpc = {
            type: 'character',
            roleLevel: 'npc',
            currentContent: `【身份/职位】青云宗外门执事，负责弟子登记
【性格】冷淡慵懒，对新人不感兴趣
【说话语气】清冷简洁，不多说一字
【标志性细节】左眼有刀疤，总是抱着一本泛黄的弟子名册`
        };

        test('完整NPC素材通过校验', () => {
            const result = validateMaterialDepth(validNpc);
            expect(result.valid).toBe(true);
            expect(result.depthLevel).toBe(DEPTH_LEVELS.BASIC);
        });

        test('NPC不要求核心欲望和行为模式', () => {
            const result = validateMaterialDepth(validNpc);
            expect(result.missing).not.toContain('核心欲望');
            expect(result.missing).not.toContain('行为模式');
        });
    });

    describe('世界观深度校验', () => {
        test('深度世界观通过校验', () => {
            const material = {
                type: 'worldview',
                depthLevel: 'deep',
                currentContent: `【天地格局】凡人界/灵界/仙界三层，飞升需渡天劫
【修炼体系】练气→筑基→结丹→元婴→化神，每层突破需凝结天道印记
【势力格局】宗门/世家/散修/魔道四足鼎立，互相博弈制衡
【天道法则】因果循环，天劫考验道心，违反天道遭天谴
【资源体系】灵石/丹药/法宝/灵脉稀缺，争夺激烈
【禁忌与红线】禁术使用有反噬代价，禁地闯入有死亡风险`
            };
            const result = validateMaterialDepth(material);
            expect(result.valid).toBe(true);
            expect(result.depthLevel).toBe(DEPTH_LEVELS.DEEP);
        });

        test('基础世界观缺边界条件字段 → 仍通过（deep等级不要求边界条件）', () => {
            const material = {
                type: 'worldview',
                depthLevel: 'basic',
                currentContent: `【边界条件】修士不可在凡人界动手\n【违反后果】天谴降身`
            };
            const result = validateMaterialDepth(material);
            expect(result.valid).toBe(true);
        });
    });

    describe('伏笔深度校验', () => {
        test('深度伏笔通过校验', () => {
            const material = {
                type: 'foreshadowing',
                depthLevel: 'deep',
                currentContent: `【预期回收窗口】第30章揭晓一半，第200章完全揭示
【关联角色】主角苏沉、老前辈
【伏笔内容】键盘飞剑的第7个键位功能一直未激活，老前辈暗示这是封印之力
【回收方式】第30章战斗中意外触发，揭示一半能力；第200章老前辈现身说明来历`
            };
            const result = validateMaterialDepth(material);
            expect(result.valid).toBe(true);
        });

        test('基础伏笔缺伏笔内容 → 仍通过（basic等级只要求回收窗口+关联角色）', () => {
            const material = {
                type: 'foreshadowing',
                depthLevel: 'basic',
                currentContent: `【预期回收窗口】第15章回收\n【关联角色】主角`
            };
            const result = validateMaterialDepth(material);
            expect(result.valid).toBe(true);
        });
    });

    describe('小世界（sub-plane）深度校验', () => {
        test('深度小世界通过校验', () => {
            const material = {
                type: 'sub-plane',
                depthLevel: 'deep',
                currentContent: `【核心规则】像素世界遵循贪吃蛇规则，吃方块变长，撞墙即死
【位面人物】像素蛇王、方块守护者
【势力关系】蛇王阵营 vs 守护者阵营，对立冲突
【剧情线】主角需击败蛇王获取键盘碎片，过程中触发卡BUG刷方块
【掠夺能力】可获得"吞噬进化"能力，吃方块强化自身
【触发条件】完成外门大比后由李长风分配进入
【可获取道具】键盘碎片×1、像素之心×1
【视觉特征】8-bit像素画风，环境方块化，异变时产生花屏
【IP校验】[CANON-VERIFIED] 原创世界，战力受主世界练气境压制`
            };
            const result = validateMaterialDepth(material);
            expect(result.valid).toBe(true);
        });

        test('基础小世界缺核心规则 → invalid', () => {
            const material = {
                type: 'sub-plane',
                depthLevel: 'basic',
                currentContent: `【视觉特征】像素画风`
            };
            const result = validateMaterialDepth(material);
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('核心规则');
        });
    });

    describe('字段内容过短检测', () => {
        test('字段内容过短记入 shortFields', () => {
            const material = {
                type: 'character',
                roleLevel: 'protagonist',
                currentContent: `【身份/职位】弟子
【性格】冷
【说话语气】冷
【标志性细节】疤
【核心欲望】活
【内在矛盾】躺
【行为模式】看
【成长弧光】变
【标志性动作】敲
【人格魅力】帅
【哲学观】道
【金句库】嗯
【出场设计】醒`
            };
            const result = validateMaterialDepth(material);
            // 字段都存在但内容过短
            expect(result.shortFields.length).toBeGreaterThan(0);
        });
    });

    describe('批量校验', () => {
        test('返回正确统计', () => {
            const materials = [
                { id: '1', name: '主角', type: 'character', roleLevel: 'protagonist', currentContent: '【身份/职位】弟子【性格】冷静机智观察【说话语气】清冷慵懒【标志性细节】摸下巴思考【核心欲望】活下去找到回家的路【内在矛盾】想躺平但责任感【行为模式】观察分析找漏洞【成长弧光】从被动到主动平衡【标志性动作】敲键盘【人格魅力】吐槽役实用主义【哲学观】代码能跑就别动【金句库】场景1：金句【出场设计】穿越醒来吐槽渲染' },
                { id: '2', name: '配角', type: 'character', roleLevel: 'supporting', currentContent: '【身份/职位】弟子【性格】憨厚热血重义气【说话语气】豪爽直爽【标志性细节】身材高大带干粮【核心欲望】守护家人【行为模式】冲上去用蛮力' },
                { id: '3', name: '缺字段配角', type: 'character', roleLevel: 'supporting', currentContent: '【身份/职位】弟子' }
            ];
            const result = validateMaterialDepthBatch(materials);
            expect(result.total).toBe(3);
            expect(result.passed).toBe(2);
            expect(result.failed).toBe(1);
            expect(result.summary.byDepth.deep.pass).toBe(1);
            expect(result.summary.byDepth.standard.pass).toBe(1);
            expect(result.summary.byDepth.standard.fail).toBe(1);
        });
    });

    describe('buildDepthRepairPrompt', () => {
        test('校验通过返回空字符串', () => {
            const validResult = { valid: true, missing: [], shortFields: [], qualityFailedFields: [], totalChars: 500, minTotalChars: 400 };
            expect(buildDepthRepairPrompt(validResult)).toBe('');
        });

        test('校验失败返回修复提示', () => {
            const invalidResult = {
                valid: false,
                depthLevel: 'deep',
                missing: ['人格魅力', '哲学观'],
                shortFields: ['金句库'],
                qualityFailedFields: ['性格'],
                totalChars: 200,
                minTotalChars: 400
            };
            const prompt = buildDepthRepairPrompt(invalidResult);
            expect(prompt).toContain('【必须补充的字段】');
            expect(prompt).toContain('人格魅力');
            expect(prompt).toContain('哲学观');
            expect(prompt).toContain('【内容过短需扩展的字段】');
            expect(prompt).toContain('金句库');
            expect(prompt).toContain('【质量不达标需重写的字段】');
            expect(prompt).toContain('性格');
            expect(prompt).toContain('【总字数不足】');
        });
    });

    describe('未注册类型跳过校验', () => {
        test('未注册类型返回 valid=true', () => {
            const result = validateMaterialDepth({ type: 'other', currentContent: '随便内容' });
            expect(result.valid).toBe(true);
            expect(result.message).toContain('未注册深度标准');
        });
    });
});
