'use strict';

/**
 * addressResolver.js — 角色称谓建议解析（纯函数）
 *
 * 依据（D2-c 反趋同）：从 config/addressTemplates 按 roleLevel 取称谓建议，供提示词注入。
 *   只对 character 生效；未知角色等级回落 default；无建议返回空串（不污染提示词）。
 */
const { ADDRESS_BY_ROLE } = require('../config/addressTemplates');

/**
 * @param {{entityType?:string, roleLevel?:string}} entity
 * @returns {string} 称谓建议（无则空串）
 */
function resolveAddressGuide(entity) {
    if (!entity || entity.entityType !== 'character') return '';
    const key = entity.roleLevel && ADDRESS_BY_ROLE[entity.roleLevel] ? entity.roleLevel : 'default';
    return ADDRESS_BY_ROLE[key] || '';
}

module.exports = { resolveAddressGuide };
