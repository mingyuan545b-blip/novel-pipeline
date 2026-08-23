function extractContext(content, keyword, radius = 50) {
    const idx = content.indexOf(keyword);
    if (idx === -1) return '';
    const start = Math.max(0, idx - radius);
    const end = Math.min(content.length, idx + keyword.length + radius);
    return '...' + content.substring(start, end) + '...';
}

function extractTimeIndicators(content) {
    const indicators = [];
    const flashbackPatterns = [/回忆起第(\d+)章/, /想起第(\d+)章/, /回想起.*第(\d+)章/];
    const timeSkipPatterns = [/(\d+)天后/, /(\d+)个月后/, /(\d+)年后/, /过了(\d+)天/, /过了(\d+)个月/];
    for (const p of flashbackPatterns) {
        const match = content.match(p);
        if (match) indicators.push({ type: 'flashback', explicitChapter: match[1], context: extractContext(content, match[0], 30) });
    }
    for (const p of timeSkipPatterns) {
        const match = content.match(p);
        if (match) indicators.push({ type: 'timeSkip', duration: match[0], context: extractContext(content, match[0], 30) });
    }
    return indicators;
}

function detectNewForeshadowing(content) {
    const hints = [];
    const patterns = [/似乎.*?隐藏着.*?秘密/g, /暗藏.*?玄机/g, /不为人知.*?真相/g, /神秘.*?尚未揭开/g, /这一切.*?并非.*?简单/g, /隐隐约约.*?感觉/g];
    for (const p of patterns) {
        const matches = content.match(p);
        if (matches) hints.push(...matches.map(m => m.substring(0, 50)));
    }
    return hints;
}

function formatStateSummary(snapshot) {
    const parts = [];
    if (snapshot.characterStates) {
        parts.push('人物状态:');
        for (const [id, s] of Object.entries(snapshot.characterStates)) {
            parts.push(`  ${s.name}: 位置=${s.location}, 战力=${s.powerLevel}, 状态=${s.status}`);
        }
    }
    if (snapshot.relationshipStates) {
        parts.push('人物关系:');
        for (const [id, r] of Object.entries(snapshot.relationshipStates)) {
            parts.push(`  ${r.name}: 类型=${r.type}, 强度=${r.strength}`);
        }
    }
    if (snapshot.foreshadowingStates) {
        parts.push('伏笔状态:');
        for (const [id, f] of Object.entries(snapshot.foreshadowingStates)) {
            parts.push(`  ${f.name}: 状态=${f.status}, 紧急度=${f.urgency}`);
        }
    }
    return parts.join('\n');
}

module.exports = { extractTimeIndicators, detectNewForeshadowing, formatStateSummary };
