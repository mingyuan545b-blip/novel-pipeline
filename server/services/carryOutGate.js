/**
 * carryOutGate — 副本带出判定（纯函数，无副作用）
 *
 * 用途：主角把副本内的 NPC/宠物/道具带出副本时，按世界的 carryOutPolicy
 *       判定是否允许，以及需要什么凭据（媒介/特殊道具/渠道权限/剧情许可）。
 * 依据：docs/design/实体中心-副本归属与带出机制.md
 * 边界：只做判定与标签构造，不落库、不调用 LLM/管线。
 */
const { CARRY_OUT_POLICIES } = require('./worldConstants');

const UNKNOWN_CHANNEL = '未定义渠道';

/** 策略 → 需要哪类凭据（用于 reason 文案与 UI 提示） */
const POLICY_REQUIREMENT = Object.freeze({
    medium: 'medium',
    item: 'item',
    permission: 'permission',
    plot: 'plotGrant'
});

/** 取世界带出策略；缺省/非法一律保守处理 */
function resolvePolicy(world) {
    const raw = world && world.carryOutPolicy;
    if (raw && CARRY_OUT_POLICIES[raw]) return raw;
    if (raw) return '__invalid__';
    return 'native';
}

/**
 * 判定某实体能否被带出某世界。
 * @param {object} entity  被带出对象（角色/宠物/道具，至少含 name）
 * @param {object} world   所属世界/副本（含 carryOutPolicy/channelTag）
 * @param {object} context 本次带出上下文 { medium, item, permission, plotGrant }
 * @returns {{allowed:boolean, policy:string, requires:object, reason:string}}
 */
function evaluateCarryOut(entity, world, context = {}) {
    const name = (entity && entity.name) || '该对象';
    const policy = resolvePolicy(world);

    if (policy === '__invalid__') {
        return { allowed: false, policy: 'locked', requires: {},
            reason: `世界的 carryOutPolicy「${world.carryOutPolicy}」非法，保守视同不可带出` };
    }
    if (policy === 'locked') {
        return { allowed: false, policy, requires: {},
            reason: `${name}受副本规则绑定，不可带出（policy=locked）` };
    }
    if (policy === 'native') {
        return { allowed: true, policy, requires: {}, reason: `${name}为原生物，可直接带出` };
    }

    const key = POLICY_REQUIREMENT[policy];
    const provided = !!context[key];
    const requires = { [key]: true };
    const label = CARRY_OUT_POLICIES[policy].label;
    return {
        allowed: provided, policy, requires,
        reason: provided
            ? `已提供「${label}」凭据，允许带出`
            : `带出${name}需「${label}」凭据，当前缺失`
    };
}

/**
 * 校验世界的渠道标签是否合法。
 * 规则：非 native 策略的世界必须有 channelTag（出副本必带渠道标签）。
 */
function validateChannelTag(world) {
    const policy = resolvePolicy(world);
    const tag = (world && world.channelTag) || '';
    if (policy === 'native' || policy === 'locked') return { valid: true, tag: tag || UNKNOWN_CHANNEL };
    if (!tag) return { valid: false, tag: UNKNOWN_CHANNEL, reason: `策略「${CARRY_OUT_POLICIES[policy].label}」需 channelTag，当前为空` };
    return { valid: true, tag };
}

/**
 * 构造渠道标签（用于跨世界溯源事件，模拟"出副本凭据"的落库文案）。
 * @returns {string} 形如 "秘境·白骨道·媒介:养魂木"
 */
function buildChannelTag(world, context = {}) {
    const base = (world && world.channelTag) || UNKNOWN_CHANNEL;
    const extra = [];
    if (context.medium) extra.push(`媒介:${context.medium}`);
    if (context.item) extra.push(`道具:${context.item}`);
    if (context.permission) extra.push(`权限:${context.permission}`);
    return extra.length ? `${base}·${extra.join('·')}` : base;
}

/** 世界名归一（去括号/斜杠后缀），用于按名或 id 匹配世界 */
function baseName(name) {
    return String(name || '').split(/[（(/／]/)[0].trim();
}

/**
 * 检测一次"跨世界转移"是否缺少带出凭据（软门禁）。
 * 规则：仅在"回主世界"时校验；源世界策略非 native 且无 channel → 记违规。
 * @param {Array} worlds 项目世界列表（含 carryOutPolicy/channelTag）
 * @param {object} transition { character/entityName, from/fromWorld, to/toWorld, channel }
 * @returns {object|null} 违规描述或 null
 */
function detectCarryOutViolation(worlds, transition) {
    if (!transition) return null;
    const to = transition.to || transition.toWorld || '';
    const from = transition.from || transition.fromWorld || '';
    if (to !== 'main-world' || !from || from === 'main-world') return null;
    const world = (worlds || []).find(w => w.id === from || baseName(w.name) === baseName(from));
    if (!world) return null;
    const policy = resolvePolicy(world);
    if (policy === 'native') return null;
    const channel = transition.channel || '';
    if (channel) return null;
    const name = transition.character || transition.entityName || transition.name || '对象';
    return {
        entity: name,
        homeWorld: world.name || from,
        appearedIn: to,
        policy,
        description: `从「${world.name || from}」带出「${name}」缺少渠道标签/媒介凭据（policy=${policy}）`
    };
}

module.exports = {
    UNKNOWN_CHANNEL,
    POLICY_REQUIREMENT,
    resolvePolicy,
    evaluateCarryOut,
    validateChannelTag,
    buildChannelTag,
    detectCarryOutViolation
};
