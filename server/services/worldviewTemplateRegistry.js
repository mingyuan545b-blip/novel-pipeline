const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '../../data/worldview-templates');

let templates = new Map();

function load() {
    templates.clear();
    if (!fs.existsSync(TEMPLATE_DIR)) return 0;
    const files = fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8'));
            templates.set(data.id, data);
        } catch(_) { logger.warn('worldviewTemplateReg', _.message || _); }  // DEGRADE: 影响=JSON.parse 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }
    return templates.size;
}

function list() { return Array.from(templates.values()); }
function get(id) { return templates.get(id) || null; }

function inferFromGenre(genre) {
    if (!genre) return null;
    const genreMap = {
        '海贼': 'adventure-escalation', '航海': 'adventure-escalation',
        '猎人': 'adventure-escalation', '冒险': 'adventure-escalation',
        '龙珠': 'adventure-escalation', '升级': 'adventure-escalation',
        '漫威': 'superhero-universe', '超英': 'superhero-universe',
        'DC': 'superhero-universe', '英雄': 'superhero-universe',
        '仙侠': 'martial-ascension', '修仙': 'martial-ascension',
        '修真': 'martial-ascension', '飞升': 'martial-ascension',
        '都市': 'urban-awakening', '灵气复苏': 'urban-awakening',
        '诡秘': 'urban-awakening', '异能': 'urban-awakening',
        '无限流': 'crossplane-conquest', '副本': 'crossplane-conquest',
        '位面': 'crossplane-conquest', '穿越': 'crossplane-conquest',
        '高武': 'crossplane-conquest'
    };
    for (const [key, templateId] of Object.entries(genreMap)) {
        if (genre.includes(key)) return get(templateId);
    }
    return null;
}

function getCurrentPhase(templateId, chapterNumber, totalChapters) {
    const template = get(templateId);
    if (!template) return null;
    const progress = chapterNumber / (totalChapters || 100);
    for (const phase of template.phases) {
        const range = phase.chapterRange;
        const endPct = parseInt(range.split('-')[1]) / 100;
        if (progress <= endPct) return phase;
    }
    return template.phases[template.phases.length - 1];
}

function buildWriterPrompt(templateId, chapterNumber, totalChapters) {
    const template = get(templateId);
    if (!template) return '';

    const phase = getCurrentPhase(templateId, chapterNumber, totalChapters);
    if (!phase) return '';

    const parts = [];
    parts.push(`【世界观阶段：${phase.label}（${phase.chapterRange}）】`);
    parts.push(phase.description);
    parts.push(`\n当前阶段世界规则：`);
    for (const [key, value] of Object.entries(phase.worldRules)) {
        const label = {
            powerCeiling: '战力天花板', geographicScope: '地理范围',
            factionComplexity: '势力复杂度', characterScale: '角色规模',
            threatLevel: '威胁等级', knowledgeScope: '认知范围'
        }[key] || key;
        parts.push(`- ${label}：${value}`);
    }
    parts.push(`\n当前阶段叙事规则：`);
    for (const [key, value] of Object.entries(phase.narrativeRules)) {
        const label = {
            povScope: '视角范围', pacingRule: '节奏规则',
            humorDensity: '幽默密度', powerDisplay: '战力展示',
            worldReveal: '世界观揭示节奏'
        }[key] || key;
        parts.push(`- ${label}：${value}`);
    }
    parts.push(`\n当前阶段一致性锚点（必须遵守）：`);
    for (const anchor of phase.consistencyAnchors) {
        parts.push(`- ${anchor}`);
    }

    if (phase.transitionFrom) {
        parts.push(`\n阶段过渡规则：`);
        parts.push(`- 触发条件：${phase.transitionFrom.trigger}`);
        parts.push(`- 必须解决：${phase.transitionFrom.mustResolve}`);
        parts.push(`- 必须建立：${phase.transitionFrom.mustEstablish}`);
    }

    return parts.join('\n');
}

function buildReviewerPrompt(templateId, chapterNumber, totalChapters) {
    const template = get(templateId);
    if (!template) return '';

    const phase = getCurrentPhase(templateId, chapterNumber, totalChapters);
    if (!phase) return '';

    const parts = [];
    parts.push('【世界观阶段审核规则】');
    parts.push(`当前阶段：${phase.label}（${phase.chapterRange}）`);
    parts.push(`\n阶段一致性锚点（违反即为critical级问题）：`);
    for (const anchor of phase.consistencyAnchors) {
        parts.push(`- ${anchor}`);
    }

    parts.push(`\n全局一致性规则（跨阶段必须遵守）：`);
    for (const rule of template.globalConsistencyRules) {
        parts.push(`- ${rule}`);
    }

    parts.push(`\n禁止模式（出现即为major级问题）：`);
    for (const pattern of template.forbiddenPatterns) {
        parts.push(`- ${pattern}`);
    }

    parts.push(`\n当前阶段战力天花板：${phase.worldRules.powerCeiling}`);
    parts.push(`当前阶段地理范围：${phase.worldRules.geographicScope}`);
    parts.push(`审核时：超出阶段战力天花板=违规，超出地理范围=需解释，违反一致性锚点=critical`);

    return parts.join('\n');
}

function buildProjectInitPrompt(templateId) {
    const template = get(templateId);
    if (!template) return '';

    const parts = [];
    parts.push(`【世界观模板：${template.label}（${template.tag}）】`);
    parts.push(template.description);
    parts.push(`\n阶段规划：`);
    for (const phase of template.phases) {
        parts.push(`\n${phase.label}（${phase.chapterRange}）：`);
        parts.push(`  ${phase.description}`);
        parts.push(`  战力：${phase.worldRules.powerCeiling}`);
        parts.push(`  地理：${phase.worldRules.geographicScope}`);
        parts.push(`  势力：${phase.worldRules.factionComplexity}`);
    }
    parts.push(`\n全局一致性规则：`);
    for (const rule of template.globalConsistencyRules) {
        parts.push(`- ${rule}`);
    }
    parts.push(`\n禁止模式：`);
    for (const pattern of template.forbiddenPatterns) {
        parts.push(`- ${pattern}`);
    }

    return parts.join('\n');
}

function reload() { return load(); }

load();

module.exports = { list, get, inferFromGenre, getCurrentPhase, buildWriterPrompt, buildReviewerPrompt, buildProjectInitPrompt, reload };
