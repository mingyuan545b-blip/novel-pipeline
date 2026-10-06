/**
 * _registry.js — 契约共享常量注册表
 *
 * 问题（P0-C-2）：同一份 stateJson 深度键依赖手写在 7 份 *.contract.yml（WR/FR/SR/FA/FE/RV/PO-IN-003），
 * 任一处改动都要同步 7 处 → 漂移。此文件是唯一真相源，YAML 用 "@ref" 字符串引用。
 *
 * 生产端保证：agentMaterialHelpers.buildStateJson 必须真正产出这些键
 * （见 S2：从 entity/profile/KV 动态状态产出），否则契约会再次全链路失败。
 */
const CHARACTER_DEPTH_KEYS = ['innerConflict', 'independentStance', 'fateArc', 'protagonistMirror', 'personality'];

const REGISTRY = {
    characterDepthKeys: CHARACTER_DEPTH_KEYS
};

/** 解析 YAML 中的 "@ref" 引用；非引用值原样返回（兼容显式数组） */
function resolveRef(value) {
    if (typeof value === 'string' && value.startsWith('@')) return REGISTRY[value.slice(1)];
    return value;
}

module.exports = { CHARACTER_DEPTH_KEYS, REGISTRY, resolveRef };
