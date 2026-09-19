'use strict';

/**
 * materialDepthEnforcer.js — 角色素材深度强制补全
 *
 * 背景（2026-09-18 五章E2E实测）：
 *   题材插件要求主角≥600字/配角≥400字，实际生成 247~353字；
 *   深度校验器（materialDepthValidator）只写了一条 warning + depthValidation，无人修；
 *   已经写好的 materialDepthRepairPrompt 在生产代码里没有任何调用点（死代码）。
 *   结果：实体中心 briefText/summaryText 都浅 → 写作端"人设不崩"没有依据。
 *
 * 本模块用一次批量 LLM 调用把不达标的角色素材补到达标（深度阈值仍以
 * config/materialDepthSpec 的 DEPTH_REQUIREMENTS 为唯一数据源）。
 */
const store = require('../../store');
const llm = require('../llm');
const { validateMaterialDepth } = require('../materialDepthValidator');
const { buildDepthRepairPrompt } = require('../materialDepthRepairPrompt');
const { syncCharacterToEntityCenter } = require('./outlineEntitySync');
const { extractJSON } = require('../jsonUtils');
const logger = require('../../shared/logger');

/** 需要强制深度达标的角色定位（其余 NPC 不强制，控制 token） */
const ENFORCED_ROLE_LEVELS = ['protagonist', 'key-supporting', 'supporting'];
const MAX_REPAIR_PER_RUN = 6;

function _needsRepair(material) {
    if (material.type !== 'character') return false;
    if (!ENFORCED_ROLE_LEVELS.includes(material.roleLevel)) return false;
    return !validateMaterialDepth(material).valid;
}

/** 题材要求的最低字数（genre.characterProfile.*WordCount），与深度规范取更严者 */
function _roleMinChars(roleLevel, roleWordCounts = {}) {
    const map = {
        protagonist: roleWordCounts.protagonist,
        'key-supporting': roleWordCounts.supporting,
        supporting: roleWordCounts.supporting,
        npc: roleWordCounts.npc,
    };
    return Number(map[roleLevel]) || 0;
}

/**
 * 解析 LLM 返回为条目数组。
 * 兼容：数组 / 代码块包裹 / 前置说明文字 / 单对象 / {characters:[]} 包装
 * （extractJSON 取的是第一个 {} 块，遇到顶层数组会拼错，这里必须数组优先）
 */
function _parseItems(raw) {
    if (!raw) return [];
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced ? fenced[1] : raw;
    const arrMatch = body.match(/\[[\s\S]*\]/);
    if (arrMatch) {
        try {
            const arr = JSON.parse(arrMatch[0]);
            if (Array.isArray(arr)) return arr;
        } catch (_) { /* 落到对象解析 */ }
    }
    const parsed = extractJSON(body);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        if (parsed.name && parsed.content) return [parsed];
        for (const key of ['characters', 'materials', 'data', 'items', 'result']) {
            if (Array.isArray(parsed[key])) return parsed[key];
        }
    }
    return [];
}

function _buildMessages(targets) {
    const system = [
        '你是小说角色设定补全师。任务：把不达标的角色素材补全到规定深度。',
        '硬性要求：',
        '1. 输出 JSON 数组，每项 {"name": "角色名", "content": "补全后的完整角色设定"}',
        '2. content 必须使用【字段名】标签分节，且**完整保留原有一切信息**，只做补充与扩写',
        '3. 不得改动角色姓名、身份、阵营等既有事实（防止人设漂移）',
        '4. 只输出 JSON，不要解释、不要 Markdown 代码块',
    ].join('\n');
    const items = targets.map(({ material, validation, requiredChars }) => [
        `### 角色：${material.name}（${material.roleLevel}）`,
        `当前字数：${validation.totalChars}，要求至少：${requiredChars}字，深度等级：${validation.depthLevel}`,
        buildDepthRepairPrompt(validation),
        '现有内容：',
        (material.currentContent || material.initialContent || ''),
    ].join('\n')).join('\n\n');
    const user = `请补全以下 ${targets.length} 个角色素材，保持既有事实不变：\n\n${items}`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/**
 * 强制补全不达标的角色素材
 * @param {string} projectId
 * @param {object} options { apiConfig, maxItems, roleWordCounts }
 * @returns {Promise<{checked:number, targets:number, repaired:number}>}
 */
async function enforceMaterialDepth(projectId, options = {}) {
    const stats = { checked: 0, targets: 0, repaired: 0 };
    try {
        const all = await store.queryItems('materials', { projectId });
        const chars = all.filter((m) => m.type === 'character' && !m.archived);
        stats.checked = chars.length;
        const targets = [];
        for (const material of chars) {
            if (!_needsRepair(material)) continue;
            if (targets.length >= (options.maxItems || MAX_REPAIR_PER_RUN)) break;
            const validation = validateMaterialDepth(material);
            const requiredChars = Math.max(validation.minTotalChars, _roleMinChars(material.roleLevel, options.roleWordCounts));
            if (validation.totalChars >= requiredChars) continue;
            targets.push({ material, validation, requiredChars });
        }
        stats.targets = targets.length;
        if (targets.length === 0) return stats;

        logger.info('materialDepthEnforcer', `角色深度补全: ${targets.map((t) => `${t.material.name}(${t.validation.totalChars}→${t.requiredChars})`).join(', ')}`);
        const result = await llm.chat(_buildMessages(targets), {
            maxTokens: 32768, temperature: 0.6, enableThinking: false, apiConfig: options.apiConfig,
        });
        const raw = result.choices?.[0]?.message?.content || '';
        const parsed = _parseItems(raw);
        if (parsed.length === 0) {
            logger.warn('materialDepthEnforcer', `补全响应无法解析为条目，原文前200字: ${raw.substring(0, 200)}`);
            return stats;
        }

        for (const item of parsed) {
            if (!item || !item.name || !item.content) continue;
            const target = targets.find((t) => t.material.name === item.name);
            if (!target) continue;
            const material = target.material;
            // 只在确实变长时写回，避免 LLM 精简导致信息丢失
            if (item.content.length <= (material.currentContent || '').length) continue;
            material.currentContent = item.content;
            if ((material.initialContent || '').length < item.content.length) material.initialContent = item.content;
            material.updatedAt = new Date().toISOString();
            delete material.depthValidation;
            await store.setItem('materials', material.id, material);
            await syncCharacterToEntityCenter(projectId, { ...material, content: item.content }, material.id);
            stats.repaired++;
        }
        logger.info('materialDepthEnforcer', `ch深度补全完成: ${stats.repaired}/${stats.targets}`);
    } catch (e) {
        // 补全失败不阻断项目初始化（深度不足会在装配图"无数据/深度"告警里继续可见）
        logger.warn('materialDepthEnforcer', `深度补全失败: ${e.message}`);
    }
    return stats;
}

/**
 * 章节更新后的深度巡检（每章调用，默认不花 token）：
 *   先用 validateMaterialDepth 免费校验；只有当某角色跌破"要求字数 × driftRepairTriggerRatio"
 *   时才触发一次批量补全 —— 兼顾"人设不崩"与 token 成本。
 * @param {string} projectId
 * @param {object} options { apiConfig, roleWordCounts, chapterNumber }
 * @returns {Promise<{checked:number, drifted:string[], repaired:number}>}
 */
async function enforceChapterDrift(projectId, options = {}) {
    const { MATERIAL_CONTENT_POLICY } = require('../../../config/materialContentPolicy');
    const stats = { checked: 0, drifted: [], repaired: 0 };
    if (!MATERIAL_CONTENT_POLICY.driftCheckEnabled) return stats;
    try {
        const all = await store.queryItems('materials', { projectId });
        const chars = all.filter((m) => m.type === 'character' && !m.archived);
        stats.checked = chars.length;
        const thresholdRatio = MATERIAL_CONTENT_POLICY.driftRepairTriggerRatio;
        for (const material of chars) {
            if (!ENFORCED_ROLE_LEVELS.includes(material.roleLevel)) continue;
            const validation = validateMaterialDepth(material);
            const required = Math.max(validation.minTotalChars, _roleMinChars(material.roleLevel, options.roleWordCounts));
            const floor = Math.round(required * thresholdRatio);
            if (validation.totalChars < floor) stats.drifted.push(`${material.name}(${validation.totalChars}<${floor})`);
        }
        if (stats.drifted.length === 0) return stats;
        logger.warn('materialDepthEnforcer', `第${options.chapterNumber ?? '-'}章深度巡检发现退化: ${stats.drifted.join(', ')} → 触发补全`);
        const repairStats = await enforceMaterialDepth(projectId, options);
        stats.repaired = repairStats.repaired;
    } catch (e) {
        logger.warn('materialDepthEnforcer', `深度巡检失败: ${e.message}`);
    }
    return stats;
}

module.exports = { enforceMaterialDepth, enforceChapterDrift, ENFORCED_ROLE_LEVELS };
