/**
 * 素材名称解析工具
 * 从素材content中提取有意义的name，避免出现Unnamed
 */

const TYPE_NAME_PATTERNS = {
    worldview: [/^【?([^】\n]{2,20})】?/, /^([^\n：:]{2,20})[：:]/],
    'writing-technique': [/^【?([^】\n]{2,20})】?/, /^([^\n：:]{2,20})[：:]/],
    'golden-line': [/^[""「「]([^""」」]{2,30})/, /^([^：:\n]{2,30})/],
    'famous-scene': [/^【?([^】\n]{2,20})】?/, /^([^：:\n]{2,20})[：:]/],
    foreshadowing: [/^【?([^】\n]{2,20})】?/, /^([^：:\n]{2,20})[：:]/],
    relation: [/^([^→\n]{2,20})/],
    equipment: [/^【?([^】\n]{2,20})】?/, /^([^\n：:]{2,20})[：:]/]
};

const TYPE_LABELS = {
    worldview: '世界观设定',
    'writing-technique': '写作技法',
    'golden-line': '金句',
    'famous-scene': '名场面',
    foreshadowing: '伏笔',
    relation: '人物关系',
    equipment: '装备',
    character: '角色',
    other: '素材'
};

function extractNameFromContent(type, content) {
    if (!content || typeof content !== 'string') return null;
    const patterns = TYPE_NAME_PATTERNS[type] || [];
    for (const pat of patterns) {
        const m = content.match(pat);
        if (m && m[1]) return m[1].trim();
    }
    return null;
}

function resolveMaterialName(mat) {
    if (mat.name && mat.name !== 'Unnamed' && mat.name !== '未命名') return mat.name;
    const extracted = extractNameFromContent(mat.type, mat.content);
    if (extracted) return extracted;
    return TYPE_LABELS[mat.type] || mat.type || '未命名';
}

module.exports = { resolveMaterialName, extractNameFromContent, TYPE_NAME_PATTERNS, TYPE_LABELS };
