/**
 * writerCharacterFormatter.js — Writer角色格式化辅助
 * 从writerMaterialBuilder.js拆出，处理角色称呼/名字锁定/限知约束/动态状态注入
 */

/** 小世界过滤：主世界角色+当前小世界角色 */
function _filterBySubplane(chars, isInSubplane, currentSubplaneId) {
    return chars.filter(c => {
        if (!c.parentPlane || c.parentPlane === '主世界') return true;
        return c.parentPlane === currentSubplaneId;
    });
}

/** 从stateJson中提取需要展示的动态状态字段（排除基础信息字段和深度字段） */
const BASE_STATE_KEYS = new Set(['name', 'roleLevel', 'lifecycleState', 'position', 'personality', 'speakingTone', 'gender', 'appearance', 'background']);
// 陷阱#79修复：深度字段单独成段注入，不混入动态状态
const DEPTH_FIELD_LABELS = {
    innerConflict: '内心冲突',
    independentStance: '独立立场',
    fateArc: '命运弧光',
    protagonistMirror: '主角镜像',
    signatureDetail: '标志性细节',
    catchphrases: '口头禅'
};

function _extractDynamicStateLines(stateJson) {
    if (!stateJson || typeof stateJson !== 'object') return [];
    const lines = [];
    for (const [key, value] of Object.entries(stateJson)) {
        if (BASE_STATE_KEYS.has(key)) continue;
        if (DEPTH_FIELD_LABELS[key]) continue; // 深度字段单独处理
        if (value === null || value === undefined || value === '') continue;
        // 数组类型展开
        if (Array.isArray(value)) {
            if (value.length > 0) lines.push(`  ${key}: ${value.join('、')}`);
            continue;
        }
        // 对象类型跳过（避免输出复杂结构）
        if (typeof value === 'object') continue;
        lines.push(`  ${key}: ${value}`);
    }
    return lines;
}

/** 提取深度字段（陷阱#79修复：writer必须拿到内心冲突/独立立场/命运弧光等深度设定） */
function _extractDepthLines(stateJson) {
    if (!stateJson || typeof stateJson !== 'object') return [];
    const lines = [];
    for (const [key, label] of Object.entries(DEPTH_FIELD_LABELS)) {
        const value = stateJson[key];
        if (value === null || value === undefined || value === '') continue;
        const text = Array.isArray(value) ? value.join('、') : String(value);
        lines.push(`  ${label}: ${text}`);
    }
    return lines;
}

function buildCharacterSection(scheduledChars, isInSubplane, currentSubplaneId) {
    const filtered = _filterBySubplane(scheduledChars, isInSubplane, currentSubplaneId);
    if (filtered.length === 0) return '';

    const refLines = [];
    const detailLines = [];
    const dynamicStateLines = [];
    const depthLines = []; // 陷阱#79修复：深度字段单独成段

    for (const cs of filtered) {
        const name = cs.name;
        const refNames = cs.refNames;
        if (refNames && typeof refNames === 'object') {
            const parts = [];
            if (refNames.narrator) parts.push(`叙事称"${refNames.narrator}"`);
            if (refNames.byChild) parts.push(`角色叫"${refNames.byChild}"`);
            if (refNames.byAdult) parts.push(`他人称"${refNames.byAdult}"`);
            if (refNames.pronoun) parts.push(`代词用"${refNames.pronoun}"`);
            if (parts.length > 0) refLines.push(`${name}：${parts.join('，')}`);
        } else {
            const gender = (cs.stateJson?.gender || '').includes('女') ? '她' : '他';
            refLines.push(`${name}：叙事称"${name}"，代词用"${gender}"`);
        }
        if (cs.content) detailLines.push(`▸ ${name}: ${cs.content}`);
        if (cs.bindsSummary && Array.isArray(cs.bindsSummary)) {
            for (const b of cs.bindsSummary) { if (b.briefDesc) detailLines.push(`  └ ${b.name}(${b.bindType}): ${b.briefDesc}`); }
        }
        // 提取动态状态字段（石化进度/HP/战力等）
        const charStateLines = _extractDynamicStateLines(cs.stateJson);
        if (charStateLines.length > 0) {
            dynamicStateLines.push(`▸ ${name}:\n${charStateLines.join('\n')}`);
        }
        // 陷阱#79修复：提取深度字段（内心冲突/独立立场/命运弧光等）
        const charDepthLines = _extractDepthLines(cs.stateJson);
        if (charDepthLines.length > 0) {
            depthLines.push(`▸ ${name}:\n${charDepthLines.join('\n')}`);
        }
    }

    let section = '';
    if (refLines.length > 0) {
        section = `\n【角色称呼表 - 必须严格遵守，不得随意切换称呼】\n${refLines.join('\n')}\n代词规则：每段首次出现用全名，换段/换场景后必须重新用全名。两个同性角色同场景时严禁连续用代词。`;
    }
    if (detailLines.length > 0) {
        section += `\n\n【角色当前状态 - 必须与素材一致，不得凭空编造角色信息】\n${detailLines.join('\n')}`;
    }
    if (dynamicStateLines.length > 0) {
        section += `\n\n【⚠️ 角色动态状态 - 必须严格继承，禁止倒退或凭空改变】\n以下状态是前序章节累积的实时状态，本章必须在此基础上延续，禁止状态倒退（如石化进度不能变小、伤势不能无故消失）：\n${dynamicStateLines.join('\n')}`;
    }
    // 陷阱#79修复：深度字段单独成段，writer必须拿到才能避免工具人化
    if (depthLines.length > 0) {
        section += `\n\n【⚠️ 角色深度设定 - 必须体现，禁止工具人化】\n以下深度设定是角色的灵魂，写作时必须通过行为/对话/内心活动体现出来，禁止把角色写成工具人：\n${depthLines.join('\n')}`;
    }
    return section;
}

function buildNameLockSection(scheduledChars, isInSubplane, currentSubplaneId) {
    const filtered = _filterBySubplane(scheduledChars, isInSubplane, currentSubplaneId);
    const characterNames = filtered.map(m => m.name).filter(Boolean);
    if (characterNames.length === 0) return '';
    return `\n\n【⚠️ 角色名字锁定 - 绝对禁止改名 - 违反即退回】\n以下角色名字是素材库锁定的，必须原样使用，禁止自创名字、禁止替换、禁止改名：\n${characterNames.map(n => `- "${n}" — 必须用这个名字，不得写成其他任何名字`).join('\n')}\n大纲中出现的角色名必须与上方列表完全一致。如果大纲中的名字不在列表中，以素材库为准。`;
}

function buildKnowledgeAccessSection(accessItems) {
    if (!accessItems || accessItems.length === 0) return '';
    const content = accessItems.map(i => i.content).filter(Boolean).join('\n');
    if (!content) return '';
    return `\n\n【⚠️ 限知约束 - 角色只能使用自己知道的信息，禁止信息泄露】\n以下记录了每个角色知道/不知道的信息。写作时必须严格遵守：\n- 角色只能使用自己"确信"或"怀疑"的信息做决策和对话\n- 角色不能表现出知道"未知"信息的行为\n- "误信"信息的角色必须按错误认知行动\n- 绝对禁止全知视角泄露角色不该知道的信息\n- ⚠️角色对自己的人设基础（身份/能力/阵营/所属势力规则/自己的名字）默认为certain，即使下方未列出。配角不是信息盲人，她至少确信自己的身份和能力\n- ⚠️禁止让配角用主角视角的概念说话（如修仙者不该用程序员黑话），配角的语言必须符合其人设认知边界\n${content}`;
}

module.exports = {
    _filterBySubplane,
    buildCharacterSection,
    buildNameLockSection,
    buildKnowledgeAccessSection,
};
