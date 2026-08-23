const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');

const ARCHETYPE_DIR = path.join(__dirname, '../../data/character-archetypes');

let archetypes = new Map();

function load() {
    archetypes.clear();
    if (!fs.existsSync(ARCHETYPE_DIR)) return 0;
    const files = fs.readdirSync(ARCHETYPE_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(ARCHETYPE_DIR, file), 'utf8'));
            archetypes.set(data.id, data);
        } catch(_) { logger.warn('characterArchetypeRe', _.message || _); }
    }
    return archetypes.size;
}

function list() { return Array.from(archetypes.values()); }
function get(id) { return archetypes.get(id) || null; }

function buildWriterPrompt(archetypeId) {
    const a = get(archetypeId);
    if (!a) return '';

    const parts = [];
    parts.push(`【人设模板：${a.label}（${a.tag}）】`);
    parts.push(a.description);
    parts.push(`角色功能：${a.roleInStory}`);
    parts.push(`与主角关系：${a.relationshipToProtagonist}`);

    parts.push(`\n四维描写规范：`);
    const dims = a.dimensions || {};
    for (const [dimKey, dim] of Object.entries(dims)) {
        const dimLabel = { innerThoughts: '心理描写', tone: '语气', actions: '动作', demeanor: '神态' }[dimKey] || dimKey;
        parts.push(`\n${dimLabel}：${dim.pattern}`);
        if (dim.examples?.length) {
            parts.push(`  示例：${dim.examples.slice(0, 3).join('；')}`);
        }
        if (dim.forbidden?.length) {
            parts.push(`  禁止：${dim.forbidden.join('；')}`);
        }
    }

    parts.push(`\n场景反应模式：`);
    const reactions = a.sceneReactions || {};
    for (const [scene, reaction] of Object.entries(reactions)) {
        const sceneLabel = { danger: '危险', boring: '无聊', tension: '紧张', success: '成功', failure: '失败' }[scene] || scene;
        parts.push(`- ${sceneLabel}：${reaction}`);
    }

    if (a.forbiddenPatterns?.length) {
        parts.push(`\n人设禁忌：`);
        for (const p of a.forbiddenPatterns) {
            parts.push(`- ${p}`);
        }
    }

    if (a.recommendedSpeechStyles?.length) {
        parts.push(`\n推荐说话风格：${a.recommendedSpeechStyles.join('、')}`);
    }
    if (a.recommendedDialects?.length) {
        parts.push(`推荐方言：${a.recommendedDialects.join('、')}`);
    }

    return parts.join('\n');
}

function buildReviewerPrompt(archetypeId) {
    const a = get(archetypeId);
    if (!a) return '';

    const parts = [];
    parts.push(`【人设审核规则：${a.label}】`);

    const dims = a.dimensions || {};
    parts.push(`\n四维一致性检查：`);
    for (const [dimKey, dim] of Object.entries(dims)) {
        const dimLabel = { innerThoughts: '心理描写', tone: '语气', actions: '动作', demeanor: '神态' }[dimKey] || dimKey;
        if (dim.forbidden?.length) {
            parts.push(`- ${dimLabel}违规：${dim.forbidden.join('；')}`);
        }
    }

    if (a.forbiddenPatterns?.length) {
        parts.push(`\n人设违规（出现即为major级问题）：`);
        for (const p of a.forbiddenPatterns) {
            parts.push(`- ${p}`);
        }
    }

    return parts.join('\n');
}

async function buildCombinedWriterPrompt(projectId) {
    const store = require('../store');
    const materials = await store.listItems('materials');
    const projectMats = materials.filter(m => m.projectId === projectId && !m.archived && m.type === 'character' && m.archetype);
    if (projectMats.length === 0) return '';

    const blocks = [];
    for (const ch of projectMats) {
        const block = buildWriterPrompt(ch.archetype);
        if (block) blocks.push(`角色"${ch.name}"：\n${block}`);
    }

    return blocks.length > 0 ? `【配角人设规范】\n${blocks.join('\n\n---\n\n')}` : '';
}

async function buildCombinedReviewerPrompt(projectId) {
    const store = require('../store');
    const materials = await store.listItems('materials');
    const projectMats = materials.filter(m => m.projectId === projectId && !m.archived && m.type === 'character' && m.archetype);
    if (projectMats.length === 0) return '';

    const blocks = [];
    for (const ch of projectMats) {
        const block = buildReviewerPrompt(ch.archetype);
        if (block) blocks.push(`角色"${ch.name}"：\n${block}`);
    }

    return blocks.length > 0 ? `【配角人设审核规则】\n${blocks.join('\n\n')}` : '';
}

function reload() { return load(); }

load();

module.exports = { list, get, buildWriterPrompt, buildReviewerPrompt, buildCombinedWriterPrompt, buildCombinedReviewerPrompt, reload };
