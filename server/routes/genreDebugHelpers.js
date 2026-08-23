const logger = require('../shared/logger');
const { getGenreById, GENRE_REGISTRY } = require('../services/genreConfig');

const AGENT_META = {
    writer: { name: '执笔人', icon: '✍', color: 'var(--neon-blue)', category: '创作' },
    'intent-planner': { name: '意图规划', icon: '📋', color: '#2ed573', category: '规划' },
    'first-review': { name: '初审', icon: '✓', color: 'var(--neon-green)', category: '审核' },
    'second-review': { name: '复审', icon: '★', color: 'var(--neon-orange)', category: '审核' },
    'fast-review': { name: '快审', icon: '⚡', color: '#ffa502', category: '审核' },
    'final-editor': { name: '定稿人', icon: '♛', color: 'var(--neon-pink)', category: '编辑' },
    'material-manager': { name: '素材管理', icon: '⬡', color: 'var(--neon-purple)', category: '管理' },
    reader: { name: '阅读者', icon: '📖', color: '#e17055', category: '审核' },
    polisher: { name: '润色师', icon: '✦', color: '#a29bfe', category: '编辑' },
    reviser: { name: '返修员', icon: '🔧', color: '#00d2d3', category: '编辑' }
};

const ALL_AGENT_TYPES = ['writer', 'reviser', 'polisher', 'intent-planner', 'first-review', 'second-review', 'fast-review', 'final-editor', 'material-manager', 'reader'];

function resolveGenre(genreId) {
    let genre = getGenreById(genreId);
    if (genre) return genre;
    try {
        const genreProfileRegistry = require('../services/genreProfileRegistry');
        const profile = genreProfileRegistry.resolve(genreId);
        if (profile) {
            for (const g of GENRE_REGISTRY) { if (g.genreProfileIds && g.genreProfileIds.includes(profile.id)) return g; }
            const styleHints = profile.styleHints || {};
            const testProfile = { key: profile.id, label: profile.label, description: styleHints.style || styleHints.tone || '' };
            for (const g of GENRE_REGISTRY) { if (g.isMatch && g.isMatch(testProfile)) return g; }
        }
    } catch (e) { logger.error('genre-debug', '[GENRE-DEBUG] genreProfileRegistry error:', e.message); }
    return null;
}

module.exports = { AGENT_META, ALL_AGENT_TYPES, resolveGenre };
