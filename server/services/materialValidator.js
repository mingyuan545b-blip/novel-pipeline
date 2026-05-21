const {
    VALID_MATERIAL_TYPES,
    HIERARCHY_RULES,
    MATERIAL_STANDARDS,
    TYPE_INFERENCE_RULES,
    inferTypeFromContent
} = require('../config/materialTypes');

function validateHierarchy(material) {
    const type = material.type || '';
    const rule = HIERARCHY_RULES[type];
    if (!rule) return { valid: true, missing: [], message: '' };

    const missing = [];
    for (const field of rule.parentFields) {
        if (rule.parentRequired && material[field] === undefined) {
            missing.push(field);
        }
    }

    if (type === 'character' && material.parentFaction && !material.parentPlane) {
        const allMaterials = [];
        try {
            const store = require('../store');
            const mats = store.listItems('materials');
            const faction = mats.find(m => m.id === material.parentFaction);
            if (faction && faction.parentPlane) {
                missing.push('parentPlane');
            }
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
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

function validateMaterial(material) {
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

    const hierarchyResult = validateHierarchy(material);
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

function validateMaterialBatch(materials) {
    const results = [];
    let invalidCount = 0;
    for (const m of materials) {
        const result = validateMaterial(m);
        results.push({ id: m.id, name: m.name, ...result });
        if (!result.valid) invalidCount++;
    }
    return { results, total: materials.length, valid: materials.length - invalidCount, invalid: invalidCount };
}

function getMaterialValidationPrompt(material) {
    const result = validateMaterial(material);
    if (result.valid) return '';
    return `\n【⚠ 素材标准校验未通过】${result.message}。请在更新素材时补充这些必要字段。`;
}

module.exports = { MATERIAL_STANDARDS, HIERARCHY_RULES, validateHierarchy, validateMaterial, validateMaterialBatch, getMaterialValidationPrompt };
