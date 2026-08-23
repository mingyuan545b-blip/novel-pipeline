/**
 * 各题材角色状态特有字段定义
 * 纯数据文件，无逻辑依赖
 */

const GENRE_SCHEMAS = {
    'high-martial-comedy': {
        id: 'high-martial-comedy',
        label: '高武穿越·诸天万界',
        extraFields: {
            mp: { key: 'mp', label: '灵力/内力', type: 'number', defaultValue: 100, unit: '%' },
            cultivationStage: { key: 'cultivationStage', label: '修炼境界', type: 'string', defaultValue: '凡人' },
            combatPowerLevel: { key: 'combatPowerLevel', label: '战力等级', type: 'string', defaultValue: '' },
            spiritualRoot: { key: 'spiritualRoot', label: '灵根', type: 'string', defaultValue: '凡品' },
            magicTreasures: { key: 'magicTreasures', label: '法宝', type: 'array', defaultValue: [] },
            techniques: { key: 'techniques', label: '功法', type: 'array', defaultValue: [] },
            currentPlane: { key: 'currentPlane', label: '当前位面', type: 'string', defaultValue: '主世界' },
            sectRank: { key: 'sectRank', label: '宗门排名', type: 'number', defaultValue: 0 },
        },
        thresholds: { hpLow: 30, mpLow: 20, combatPowerCritical: 10000 },
    },
    'baby': {
        id: 'baby',
        label: '萌宝',
        extraFields: {
            affectionLevel: { key: 'affectionLevel', label: '好感度', type: 'number', defaultValue: 0 },
            relationshipStatus: { key: 'relationshipStatus', label: '关系状态', type: 'string', defaultValue: '陌生' },
            emotionalState: { key: 'emotionalState', label: '情感状态', type: 'string', defaultValue: '平静' },
            guardianStatus: { key: 'guardianStatus', label: '守护状态', type: 'string', defaultValue: '' },
        },
        thresholds: { hpLow: 30, affectionLow: 20 },
    },
};

module.exports = { GENRE_SCHEMAS };
