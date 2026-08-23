const logger = require('../../shared/logger');
const { EXTRA_CONSTRAINT_MODULES } = require('./constraintModuleExtras');

function _toText(rules) {
    return (rules && rules.length > 0) ? rules.join('\n') : '';
}

const CONSTRAINT_MODULES = {
    perspective: {
        id: 'perspective', name: '视角约束', priority: 'critical',
        description: '控制叙事视角一致性，防止越界',
        rules: [
            '严格保持限知视角，只写视角角色能感知到的内容',
            '禁止上帝视角叙述其他角色的内心想法',
            '信息获取必须通过视角角色的感官渠道'
        ],
        get text() { return _toText(this.rules); }
    },
    genre: {
        id: 'genre', name: '题材约束', priority: 'critical',
        description: '题材特定的写作规则和禁忌',
        rules: [
            '遵守题材特定的世界观规则',
            '不引入与题材不符的元素',
            '保持题材特有的节奏和氛围'
        ],
        get text() { return _toText(this.rules); }
    },
    behavior: {
        id: 'behavior', name: '行为规则', priority: 'high',
        description: '角色行为一致性约束',
        rules: [
            '角色行为必须符合其性格设定',
            '禁止OOC（Out of Character）行为',
            '行为动机必须合理可追溯'
        ],
        get text() { return _toText(this.rules); }
    },
    dialogue: {
        id: 'dialogue', name: '对话规则', priority: 'high',
        description: '对话风格和内容约束',
        rules: [
            '对话必须符合角色身份和说话风格',
            '禁止现代网络用语出现在古代背景中',
            '对话推动情节，避免无意义闲聊'
        ],
        get text() { return _toText(this.rules); }
    },
    naming: {
        id: 'naming', name: '命名规则', priority: 'medium',
        description: '名称和称呼一致性约束',
        rules: [
            '角色名称必须前后一致',
            '称呼必须符合角色关系和场景',
            '地名和术语必须统一'
        ],
        get text() { return _toText(this.rules); }
    },
    worldview: {
        id: 'worldview', name: '世界观约束', priority: 'high',
        description: '世界观设定一致性约束',
        rules: [
            '遵守已建立的世界观设定',
            '不引入与设定矛盾的新元素',
            '超自然元素必须符合体系规则'
        ],
        get text() { return _toText(this.rules); }
    },
    // 合并agentSlotRegistry引用的22个模块（来自constraintModuleExtras.js）
    // 修复前：这些moduleIds缺失，导致role-boundary/redlines-writer等slot返回null，约束全部丢失
    ...EXTRA_CONSTRAINT_MODULES
};

function getConstraintModule(id) {
    return CONSTRAINT_MODULES[id] || null;
}

function getAllConstraintModules() {
    return Object.values(CONSTRAINT_MODULES);
}

module.exports = { CONSTRAINT_MODULES, getConstraintModule, getAllConstraintModules };
