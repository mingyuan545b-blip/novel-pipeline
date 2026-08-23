/**
 * high-martial-crossplane/modules/cultivationSystem.js — 能力系统模块
 *
 * 阶段3：通用能力系统配置，去不搭元素
 * 分支通过branchModuleOverrides.cultivationSystem覆盖label/description/genreStateKeys
 *
 * 已移除：古典命名规范约束（分支会注入对应命名风格）
 *         传统修仙术语（境界/灵力/功法/法宝等，分支会替换为权限/层理解/等级）
 *
 * 功能边界：能力等级、战力、技能、装备相关的状态和约束
 * 装备此模块后，题材获得能力体系功能
 */
module.exports = {
    id: 'cultivation-system',
    label: '能力系统',
    description: '能力等级、战力等级、技能装备、师门关系',

    entityTypes: ['power-system', 'equipment'],

    genreStateKeys: {
        cultivationStage: { label: '能力等级', type: 'string', default: '凡人' },
        combatPowerLevel: { label: '战力等级', type: 'string', default: '' },
        mp: { label: '能量', type: 'number', default: 100 },
        spiritualRoot: { label: '属性', type: 'string', default: '凡品' },
        techniques: { label: '技能', type: 'array', default: [] },
        magicTreasures: { label: '装备', type: 'array', default: [] },
        sectRank: { label: '组织排名', type: 'number', default: 0 }
    },

    relationTypes: ['master', 'disciple', 'fellow-disciple'],

    relationTypeKeywords: {
        master: ['师父', '师傅', '师尊'],
        disciple: ['徒弟', '弟子', '徒孙'],
        'fellow-disciple': ['师兄弟', '师姐妹', '同门', '师弟', '师兄']
    },

    narrativePhases: ['foundation', 'rising', 'enlightenment', 'transcendence'],

    milestones: {
        '3': '拜入组织',
        '5': '首次突破'
    },

    // 通用约束（分支会通过branchModuleOverrides覆盖或追加分支专属约束）
    // 已移除：naming-elegance（古典命名规范）——分支会注入对应命名风格约束
    constraints: {},

    stateSchemaExtensions: {
        supporting: {
            importantFields: [
                'cultivationStage',
                'combatPowerLevel',
                'hp',
                'mp',
                'magicTreasures',
                'techniques',
                'currentPlane'
            ]
        }
    },

    kvImportantKeysExtensions: [
        'mp',
        'combatPowerLevel',
        'cultivationStage',
        'currentPlane',
        'spiritualRoot'
    ],

    agentAccess: '*',
    dependencies: []
};
