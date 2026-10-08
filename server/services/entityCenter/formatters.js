const { getGenreEntitySchema } = require('../../config/genreEntitySchemas');

function _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 2);
}

function _buildBriefText(entity) {
    const parts = [entity.name];
    if (entity.position) parts.push(`身份=${entity.position}`);
    if (entity.factionName) parts.push(`阵营=${entity.factionName}`);
    if (entity.hp !== undefined && entity.hp !== 100) parts.push(`HP=${entity.hp}`);

    const gs = entity.genreState || {};
    const genreId = entity.genreId || '';
    const schema = getGenreEntitySchema(genreId);
    const importantKeys = ['cultivationStage', 'combatPowerLevel', 'jobTitle', 'company', 'abilityLevel', 'dungeonLevel', 'sanity', 'relationshipProgress'];
    for (const key of importantKeys) {
        if (gs[key] !== undefined && gs[key] !== '' && gs[key] !== 0) {
            const config = schema.genreStateKeys?.[key];
            parts.push(`${config?.label || key}=${gs[key]}`);
        }
    }
    return parts.join(' | ');
}

function _buildSummaryText(entity) {
    const lines = [];
    const stateParts = [];

    if (entity.position) stateParts.push(`身份=${entity.position}`);
    if (entity.factionName) stateParts.push(`阵营=${entity.factionName}`);
    if (entity.personality) stateParts.push(`性格=${entity.personality}`);
    if (entity.speakingTone) stateParts.push(`语气=${entity.speakingTone}`);
    if (entity.hp !== undefined && entity.hp !== 100) stateParts.push(`HP=${entity.hp}`);
    if (entity.combatPower > 0) stateParts.push(`战力=${entity.combatPower}`);

    const gs = entity.genreState || {};
    const genreId = entity.genreId || '';
    const schema = getGenreEntitySchema(genreId);
    for (const [key, value] of Object.entries(gs)) {
        if (value === undefined || value === '' || value === 0) continue;
        const config = schema.genreStateKeys?.[key];
        if (config) {
            if (Array.isArray(value) && value.length === 0) continue;
            stateParts.push(`${config.label}=${Array.isArray(value) ? value.join(',') : value}`);
        }
    }

    lines.push(`【${entity.name}】${stateParts.join(', ')}`);

    const binds = entity.bindsSummary || [];
    if (binds.length > 0) {
        const bindParts = binds.filter(b => b.status !== 'lost' && b.status !== 'consumed').map(b => {
            let s = b.name;
            if (b.masteryLevel) s += `(${b.masteryLevel})`;
            return s;
        });
        if (bindParts.length > 0) lines.push(`持有: ${bindParts.join(', ')}`);
    }

    const rels = entity.relationsSummary || [];
    if (rels.length > 0) {
        const relParts = rels.slice(0, 5).map(r => `${r.relLabel || r.relType}:${r.targetName}`);
        if (relParts.length > 0) lines.push(`关系: ${relParts.join(', ')}`);
    }

    // 行为约束摘要（只显示是否有，不显示完整内容，节省token）
    if (entity.behaviorRules) {
        lines.push(`行为约束: 已定义(${entity.behaviorRules.length}字)`);
    }

    return lines.join('\n');
}

function _buildDetailText(entity) {
    const lines = [];
    const genreId = entity.genreId || '';

    lines.push(`【${entity.name}】`);
    if (entity.roleLevel) lines.push(`角色等级: ${entity.roleLevel}`);
    if (entity.position) lines.push(`身份: ${entity.position}`);
    if (entity.factionName) lines.push(`阵营: ${entity.factionName}`);
    // 副本归属（见 docs/design/实体中心-副本归属与带出机制.md）
    if (entity.locationSlot) lines.push(`所在位置: ${entity.locationSlot}`);
    if (entity.scopeWorldId && entity.scopeWorldId !== 'main-world') lines.push(`归属世界/副本: ${entity.scopeWorldId}`);
    if (entity.bindMedium) lines.push(`绑定媒介: ${entity.bindMedium}`);
    if (entity.personality) lines.push(`性格: ${entity.personality}`);
    if (entity.speakingTone) lines.push(`说话语气: ${entity.speakingTone}`);
    if (entity.signatureDetail) lines.push(`标志性细节: ${entity.signatureDetail}`);
    if (entity.hp !== undefined) lines.push(`HP: ${entity.hp}`);
    if (entity.combatPower > 0) lines.push(`战力: ${entity.combatPower}`);

    const gs = entity.genreState || {};
    const schema = getGenreEntitySchema(genreId);
    for (const [key, value] of Object.entries(gs)) {
        if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        const config = schema.genreStateKeys?.[key];
        if (config) lines.push(`${config.label}: ${Array.isArray(value) ? value.join(', ') : value}`);
    }

    const profile = entity.profile || {};
    if (profile.appearance) lines.push(`外貌: ${profile.appearance}`);
    if (profile.background) lines.push(`背景: ${profile.background}`);
    if (profile.motivation) lines.push(`核心动机: ${profile.motivation}`);
    // 人物四件套（欲望/恐惧/谎言/创伤）——写作与审核的"人设不崩"依据
    if (profile.desire) lines.push(`核心欲望: ${profile.desire}`);
    if (profile.fear) lines.push(`核心恐惧: ${profile.fear}`);
    if (profile.lie) lines.push(`核心谎言: ${profile.lie}`);
    if (profile.trauma) lines.push(`核心创伤: ${profile.trauma}`);

    // 人物魅力系统4维度——注入到detailText供Reviewer/Writer参考
    if (entity.charisma) lines.push(`人格魅力: ${entity.charisma}`);
    if (entity.philosophy) lines.push(`哲学观: ${entity.philosophy}`);
    if (entity.entranceDesign) lines.push(`出场设计: ${entity.entranceDesign}`);
    if (Array.isArray(entity.quoteLibrary) && entity.quoteLibrary.length > 0) {
        lines.push('金句库:');
        for (const q of entity.quoteLibrary) {
            lines.push(`  【${q.scene || '通用场景'}】${q.quote}`);
        }
    }
    if (Array.isArray(entity.highlightScenes) && entity.highlightScenes.length > 0) {
        lines.push('高光时刻:');
        for (const h of entity.highlightScenes) {
            lines.push(`  【${h.scene || '名场面'}】${h.what}${h.cost ? `（代价：${h.cost}）` : ''}${h.why ? '（' + h.why + '）' : ''}`);
        }
    }
    if (Array.isArray(entity.catchphrases) && entity.catchphrases.length > 0) {
        lines.push('口头禅/名梗:');
        for (const c of entity.catchphrases) {
            lines.push(`  「${c.text}」${c.trigger ? `（${c.trigger}）` : ''}`);
        }
    }

    const binds = entity.bindsSummary || [];
    if (binds.length > 0) {
        lines.push('\n绑定物:');
        for (const b of binds) {
            if (b.status === 'lost' || b.status === 'consumed') continue;
            let desc = `  ${b.type || '物品'}/${b.name}`;
            if (b.masteryLevel) desc += ` [${b.masteryLevel}]`;
            if (b.brief) desc += ` - ${b.brief}`;
            lines.push(desc);
        }
    }

    const rels = entity.relationsSummary || [];
    if (rels.length > 0) {
        lines.push('\n关系:');
        for (const r of rels) lines.push(`  ${r.targetName}: ${r.relLabel || r.relType} (强度${r.strength || 50})`);
    }

    // 行为约束（完整展示，前端可见，执笔审核加载的就是这个）
    if (entity.behaviorRules) {
        lines.push('\n行为约束:');
        lines.push(entity.behaviorRules);
    }

    return lines.join('\n');
}

function _recomputePromptTexts(entity) {
    entity.briefText = _buildBriefText(entity);
    entity.briefTokens = _estimateTokens(entity.briefText);
    entity.summaryText = _buildSummaryText(entity);
    entity.summaryTokens = _estimateTokens(entity.summaryText);
    entity.detailText = _buildDetailText(entity);
    entity.detailTokens = _estimateTokens(entity.detailText);
    return entity;
}

module.exports = { _estimateTokens, _buildBriefText, _buildSummaryText, _buildDetailText, _recomputePromptTexts };
