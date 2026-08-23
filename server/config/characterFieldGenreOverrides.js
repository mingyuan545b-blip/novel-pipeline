/**
 * characterFieldGenreOverrides.js — 各题材角色字段覆盖定义
 * 从characterFieldSpec.js拆出，避免单文件超200行
 */

const GENRE_FIELD_OVERRIDES = {
    'baby': {
        requiredBaseFields: ['position', 'personality', 'speakingTone', 'signatureDetail'],
        characterPromptNote: '萌宝题材：必须明确角色的可爱特征和与大人互动方式',
        extraPromptFields: [
            { key: 'affectionLevel', label: '好感度', required: false },
            { key: 'guardianStatus', label: '守护状态', required: false },
        ]
    },
    'high-martial-comedy': {
        requiredBaseFields: ['position', 'personality', 'speakingTone', 'signatureDetail'],
        characterPromptNote: '高武穿越题材：必须明确修炼境界和当前位面',
        extraPromptFields: [
            { key: 'cultivationStage', label: '修炼境界', required: true },
            { key: 'currentPlane', label: '当前位面', required: false },
        ]
    },
};

module.exports = { GENRE_FIELD_OVERRIDES };
