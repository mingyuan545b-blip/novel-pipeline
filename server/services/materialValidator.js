const logger = require('../shared/logger');
const {
    VALID_MATERIAL_TYPES,
    HIERARCHY_RULES,
    MATERIAL_STANDARDS,
    TYPE_INFERENCE_RULES,
    inferTypeFromContent
} = require('../config/materialTypes');

/** 需要"势力归属"的角色等级（主角/配角是长线角色，必须挂靠势力） */
const ROLES_NEEDING_FACTION = new Set(['protagonist', 'supporting']);

/**
 * 角色是否需要 parentFaction（2026-09-21 按用户规则重写）
 *
 * 规则：**按等级 + 是否长线判定**，而不是一刀切要求所有人物都归属势力。
 *   - 路人/一次性角色（npc，且无伏笔、无深度标记）→ 免归属：用一章就丢，强求归属只会让素材被拒、内容白白丢失
 *     （实测 ch1 的"赵四"因此登记失败，实体却已建 → 素材库与实体中心不一致）
 *   - 主角/配角 → 必须归属
 *   - 有铺垫/伏笔/势力关联的任意角色（显式标记或正文里出现伏笔线索）→ 必须归属
 *
 * @returns {boolean} true=必须填写 parentFaction
 */
function characterNeedsFaction(material) {
    const role = String(material.roleLevel || material.role || '').toLowerCase();
    if (ROLES_NEEDING_FACTION.has(role)) return true;

    // 显式叙事权重标记（组织者/注册器产出）
    if (material.narrativeWeight === true || material.isRecurring === true || material.hasForeshadowing === true) return true;
    if (Array.isArray(material.foreshadowIds) && material.foreshadowIds.length > 0) return true;
    if (material.depthLevel === 'deep' || material.depthLevel === 'full') return true;

    // 正文出现伏笔/铺垫线索 → 说明是长线角色
    const text = `${material.currentContent || material.initialContent || ''} ${material.briefText || ''}`;
    if (/伏笔|铺垫|后续将|线索|幕后|暗中操控/.test(text)) return true;

    return false;
}

async function validateHierarchy(material) {
    const type = material.type || '';
    const rule = HIERARCHY_RULES[type];
    if (!rule) return { valid: true, missing: [], message: '' };

    const missing = [];
    // character 走"按等级判定"分支，其余类型沿用配置里的 parentRequired
    const parentRequired = type === 'character' ? characterNeedsFaction(material) : rule.parentRequired;
    for (const field of rule.parentFields) {
        if (parentRequired && material[field] === undefined) {
            missing.push(field);
        }
    }

    if (type === 'character' && material.parentFaction && !material.parentPlane) {
        try {
            const store = require('../store');
            const mats = await store.listItems('materials');
            const faction = mats.find(m => m.id === material.parentFaction);
            if (faction && faction.parentPlane) {
                missing.push('parentPlane');
            }
        } catch(_) { logger.warn('materialValidator', _.message || _); }  // DEGRADE: 影响=require 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }

    if (missing.length > 0) {
        return {
            valid: false,
            missing,
            message: `${type}素材缺少必要归属字段: ${missing.join('、')}。${rule.description}`
        };
    }
    return { valid: true, missing: [], message: '' };
}

async function validateMaterial(material) {
    const type = material.type || material.category || '';
    const content = material.currentContent || material.initialContent || '';
    const name = material.name || '';

    if (!VALID_MATERIAL_TYPES.includes(type)) {
        const inferred = inferTypeFromContent(name, content);
        return {
            valid: false,
            type,
            missing: [],
            message: `无效素材类型"${type}"${inferred ? `，建议使用"${inferred}"` : ''}`,
            suggestedType: inferred
        };
    }

    const hierarchyResult = await validateHierarchy(material);
    if (!hierarchyResult.valid) {
        return {
            valid: false,
            type,
            missing: hierarchyResult.missing,
            message: hierarchyResult.message,
            hierarchyError: true
        };
    }

    const inferred = inferTypeFromContent(name, content);
    if (inferred && inferred !== type && type === 'foreshadowing') {
        const hasForeshadowKeywords = /预期回收|伏笔|悬念|钩子|待回收|揭示/.test(content);
        if (!hasForeshadowKeywords) {
            return {
                valid: true,
                type,
                missing: [],
                message: `⚠ 素材"${name}"标记为foreshadowing但内容更符合${inferred}类型，建议修正`,
                suggestedType: inferred,
                typeMismatch: true
            };
        }
    }

    const standard = MATERIAL_STANDARDS[type];
    if (!standard) return { valid: true, type, missing: [], message: '' };

    const result = standard.check(content);
    return { valid: result.valid, type, missing: result.missing, message: result.message };
}

async function validateMaterialBatch(materials) {
    const results = [];
    let invalidCount = 0;
    for (const m of materials) {
        const result = await validateMaterial(m);
        results.push({ id: m.id, name: m.name, ...result });
        if (!result.valid) invalidCount++;
    }
    return { results, total: materials.length, valid: materials.length - invalidCount, invalid: invalidCount };
}

async function getMaterialValidationPrompt(material) {
    const result = await validateMaterial(material);
    if (result.valid) return '';
    return `\n【⚠ 素材标准校验未通过】${result.message}。请在更新素材时补充这些必要字段。`;
}

module.exports = { MATERIAL_STANDARDS, HIERARCHY_RULES, validateHierarchy, validateMaterial, validateMaterialBatch, getMaterialValidationPrompt, characterNeedsFaction, ROLES_NEEDING_FACTION };
