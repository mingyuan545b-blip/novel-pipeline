/**
 * high-martial-crossplane/modules/subPlaneSystem.js — 探索环境系统模块
 *
 * 阶段3：通用探索环境配置，去不搭元素
 * 分支通过branchModuleOverrides.subPlaneSystem覆盖label/description/constraints
 *
 * 已移除：肉身穿越/小世界掠夺/战力堆叠/古典命名等不搭约束
 *         （分支会注入对应的概念：测试服/相邻层/副本）
 *
 * 功能边界：探索环境相关的实体、状态、约束、素材模板
 * 装备此模块后，题材获得探索环境系统功能
 */
module.exports = {
    id: 'sub-plane-system',
    label: '探索环境系统',
    description: '探索环境实体、环境切换状态、探索环境相关约束与素材模板',

    entityTypes: ['sub-plane'],

    genreStateKeys: {
        currentPlane: {
            label: '当前环境',
            type: 'string',
            default: '主环境'
        }
    },

    narrativePhases: ['plane-break', 'war'],

    milestones: {
        '8': '环境之战',
        '12': '跨界飞升',
        '16': '诸界大战',
        '20': '超脱万界'
    },

    // 通用约束（分支会通过branchModuleOverrides覆盖或追加分支专属约束）
    constraints: {
        'main-cast-depth': {
            label: '人物立体刻画',
            desc: '角色必须拥有完整行为动机、性格弧光与社交网络，禁止工具人化或为剧情强行降智。'
        }
    },

    materialTemplates: {
        'sub-plane': {
            requiredFields: ['类型', '核心规则', '环境人物', '势力关系', '剧情线', '核心BUG', '触发条件', '可获取道具', '视觉特征', 'IP校验'],
            template: '【类型】规则怪谈类/抽象概念类/文明类/动漫类\n【核心规则】[环境底层逻辑与运行法则]\n【环境人物】[人物名]（身份/性格/能力/与主角关系/出场方式）+ [CANON-VERIFIED标注（IP角色必填）]\n【势力关系】[环境内势力划分/利益冲突/与主角的立场关系]\n【剧情线】[环境主线事件/系统任务/关键转折/与主环境剧情的衔接点]\n【核心BUG】[环境内存在的规则漏洞/异常机制/逻辑错位]+[主角可利用方式]\n【触发条件】系统任务完成后获得探索资格\n【可获取道具】[道具名]（获取方式：探索遗迹/击败守护者/完成任务奖励/与人交易）+[功能描述]+[主环境等级压制规则]\n【视觉特征】[环境异变的视觉描写]\n【IP校验】知名IP角色需标注[CANON-VERIFIED]+能力受主环境等级压制',
            namingRules: {
                style: '环境命名风格由分支配置决定（程序化/层位/游戏ID）',
                forbiddenPatterns: [{}]
            },
            typeSystem: {
                categories: {
                    '规则怪谈类': { label: '规则怪谈类', desc: '以诡异规则为核心的恐怖解谜世界', examples: ['沉默之域', '诡辩迷局', '禁忌书阁'] },
                    '抽象概念类': { label: '抽象概念类', desc: '以经典动画/概念为骨架的荒诞世界', examples: ['青青草原', '任意口袋', '追逐永恒'] },
                    '文明类': { label: '文明类', desc: '以完整文明体系为背景的异世界', examples: ['铁臂穹城(高等科技)', '霓虹废墟(末日赛博)', '元素潮汐(魔法世界)', '黄沙秘典(古埃及)', '洪荒遗脉(史前文明)'] },
                    '动漫类': { label: '动漫类', desc: '以知名动漫为蓝本的战斗世界', examples: ['龙珠擂台', '伟大航路', '猎人试炼', '光之降临'] }
                },
                unlockRules: {
                    chaptersPerUnlock: 30,
                    order: 'random',
                    description: '探索环境逐步解封，平均每30章推进解锁一个新环境。解锁顺序随机。当所有已创建环境素材用完后，根据已用类型分布推断下一个应属的类型，再补充新的。'
                }
            }
        },
        'faction': {
            requiredFields: ['所属环境', '势力名', '定位', '势力关系'],
            template: '【所属环境】[环境名]\n【势力名】[势力名]\n【定位】[势力在环境中的角色]\n【势力关系】[与其他势力的关系]\n【成员】[成员列表]',
            namingRules: {
                style: '环境内势力命名风格由分支配置决定'
            }
        }
    },

    agentAccess: ['writer', 'reviser', 'first-review', 'second-review', 'material-manager'],
    dependencies: []
};
