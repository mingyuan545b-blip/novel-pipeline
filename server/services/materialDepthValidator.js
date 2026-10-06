/**
 * materialDepthValidator.js — 素材深度校验器（核心校验逻辑）
 * 职责：字段齐全+字数+质量关键词校验。批量校验见materialDepthBatch.js，修复提示词见materialDepthRepairPrompt.js
 * 陷阱#22：之前只看关键词不检查字段深度，导致垃圾素材通过
 */
'use strict';

const logger = require('../shared/logger');
const {
    DEPTH_LEVELS, FIELD_SPECS, DEPTH_REQUIREMENTS, ROLE_LEVEL_TO_DEPTH,
    countContentChars
} = require('../config/materialDepthSpec');
// R1：别名感知提取（读写同口径，避免"要【标志性细节】、产出写【标志性动作】"误判缺失）
const { extractFieldWithAliases } = require('../config/fieldRegistry');

/**
 * 解析素材的深度等级
 * 优先级：material.depthLevel > 根据 roleLevel 推断 > 默认 STANDARD
 * @param {object} material - 素材对象
 * @returns {string} 深度等级（basic/standard/deep）
 */
function resolveDepthLevel(material) {
    // 1. 显式指定的深度等级
    if (material.depthLevel && Object.values(DEPTH_LEVELS).includes(material.depthLevel)) {
        return material.depthLevel;
    }
    // 2. 根据 roleLevel 推断（仅 character 类型）
    if (material.type === 'character' && material.roleLevel) {
        const inferred = ROLE_LEVEL_TO_DEPTH[material.roleLevel];
        if (inferred) return inferred;
    }
    // 3. 默认 STANDARD
    return DEPTH_LEVELS.STANDARD;
}

/**
 * 校验单个字段
 * @param {string} content - 素材全文内容
 * @param {string} fieldLabel - 字段标签
 * @returns {{ exists: boolean, value: string, charCount: number, qualityPassed: boolean, issues: string[] }}
 */
function validateField(content, fieldLabel) {
    const issues = [];
    const spec = FIELD_SPECS[fieldLabel];

    if (!spec) {
        // 未在 FIELD_SPECS 注册的字段，只检查存在性
        const value = extractFieldWithAliases(content, fieldLabel);
        return {
            exists: !!value,
            value,
            charCount: value.length,
            qualityPassed: true,
            issues: []
        };
    }

    const value = extractFieldWithAliases(content, fieldLabel);

    // 1. 存在性检查
    if (!value) {
        return {
            exists: false,
            value: '',
            charCount: 0,
            qualityPassed: false,
            issues: [`字段【${fieldLabel}】缺失`]
        };
    }

    // 2. 字数检查（去除标签后的内容字符数）
    const charCount = value.replace(/\s/g, '').length;
    if (charCount < spec.minChars) {
        issues.push(`字段【${fieldLabel}】内容过短：${charCount}字 < 最低${spec.minChars}字`);
    }

    // 3. 质量关键词检查（至少匹配1个）
    let qualityPassed = true;
    if (spec.qualityHints && spec.qualityHints.length > 0) {
        const hasQuality = spec.qualityHints.some(hint => value.includes(hint));
        if (!hasQuality) {
            qualityPassed = false;
            issues.push(`字段【${fieldLabel}】内容质量不达标：未匹配到关键词（${spec.qualityHints.slice(0, 3).join('/')}等）`);
        }
    }

    return {
        exists: true,
        value,
        charCount,
        qualityPassed,
        issues
    };
}

/**
 * 校验素材深度
 * @param {object} material - 素材对象，需含 type, currentContent/initialContent, 可选 roleLevel/depthLevel
 * @returns {{ valid: boolean, depthLevel: string, type: string, missing: string[], shortFields: string[], qualityFailedFields: string[], totalChars: number, minTotalChars: number, issues: string[], message: string }}
 */
function validateMaterialDepth(material) {
    const type = material.type || material.category || '';
    const content = material.currentContent || material.initialContent || material.content || '';
    const depthLevel = resolveDepthLevel(material);

    const result = {
        valid: true,
        depthLevel,
        type,
        missing: [],
        shortFields: [],
        qualityFailedFields: [],
        totalChars: 0,
        minTotalChars: 0,
        issues: [],
        message: ''
    };

    // 获取该类型+深度等级的要求
    const typeRequirements = DEPTH_REQUIREMENTS[type];
    if (!typeRequirements) {
        // 未注册的类型，跳过深度校验
        result.message = `素材类型"${type}"未注册深度标准，跳过深度校验`;
        return result;
    }

    const requirements = typeRequirements[depthLevel];
    if (!requirements) {
        result.message = `素材类型"${type}"无 ${depthLevel} 等级要求，跳过深度校验`;
        return result;
    }

    result.minTotalChars = requirements.minTotalChars;

    // 1. 校验必填字段
    for (const fieldLabel of requirements.requiredFields) {
        const fieldResult = validateField(content, fieldLabel);
        if (!fieldResult.exists) {
            result.missing.push(fieldLabel);
            result.issues.push(`缺失必填字段：【${fieldLabel}】`);
        } else {
            if (fieldResult.issues.length > 0) {
                if (fieldResult.charCount < (FIELD_SPECS[fieldLabel]?.minChars || 0)) {
                    result.shortFields.push(fieldLabel);
                }
                if (!fieldResult.qualityPassed) {
                    result.qualityFailedFields.push(fieldLabel);
                }
                result.issues.push(...fieldResult.issues);
            }
        }
    }

    // 2. 校验总字数
    result.totalChars = countContentChars(content);
    if (result.totalChars < requirements.minTotalChars) {
        result.issues.push(`素材总字数不足：${result.totalChars}字 < 最低${requirements.minTotalChars}字（${depthLevel}等级要求）`);
    }

    // 3. 汇总结果
    const hasMissing = result.missing.length > 0;
    const hasShort = result.shortFields.length > 0;
    const hasQualityFail = result.qualityFailedFields.length > 0;
    const hasTotalShort = result.totalChars < requirements.minTotalChars;

    // valid 标准：无缺失字段（字数不足和质量不达标只告警不阻断，避免生成卡死）
    result.valid = !hasMissing;

    if (result.issues.length > 0) {
        const parts = [];
        if (hasMissing) parts.push(`缺失${result.missing.length}个字段`);
        if (hasShort) parts.push(`${result.shortFields.length}个字段内容过短`);
        if (hasQualityFail) parts.push(`${result.qualityFailedFields.length}个字段质量不达标`);
        if (hasTotalShort) parts.push('总字数不足');
        result.message = `[${depthLevel}等级] ${parts.join('，')}`;
    } else {
        result.message = `[${depthLevel}等级] 深度校验通过`;
    }

    return result;
}

/**
 * 批量校验见 materialDepthBatch.js，修复提示词见 materialDepthRepairPrompt.js
 * 引用方按需从独立模块引入，避免循环依赖（陷阱#45）
 */
module.exports = {
    validateMaterialDepth,
    resolveDepthLevel,
    validateField
};
