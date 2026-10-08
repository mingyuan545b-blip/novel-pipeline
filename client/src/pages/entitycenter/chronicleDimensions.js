/**
 * chronicleDimensions.js — 编年史维度定义与抽取（纯函数，供组件与 Tab 共用）
 * 9 个维度：立场 / 立场转变 / 心理变化 / 日常 / 高光时刻 / 名言台词 / 口头禅名梗 / 事迹 / 关系变化
 */
export const DIMENSIONS = [
    { key: 'stance', label: '立场', icon: '🎯', color: '#00c8ff' },
    { key: 'shift', label: '立场转变', icon: '🔄', color: '#ffa502' },
    { key: 'psychology', label: '心理变化', icon: '🫀', color: '#ff6b9d' },
    { key: 'daily', label: '日常', icon: '🍵', color: '#4ecdc4' },
    { key: 'highlight', label: '高光时刻', icon: '✨', color: '#a29bfe' },
    { key: 'quote', label: '名言台词', icon: '💬', color: '#8ab4f8' },
    { key: 'catchphrase', label: '口头禅名梗', icon: '🗣', color: '#f7b731' },
    { key: 'deed', label: '事迹', icon: '⚔', color: '#ff9f43' },
    { key: 'relation', label: '关系变化', icon: '🔗', color: '#ff6b9d' },
];

/**
 * 档位 → 可展示维度（与设计文档《角色编年史升级》§二"适用档位"对齐）。
 * 修复用户反馈"基础/精简/完整都一个样"：此前 UI 恒展示 8 维、与档位无关，
 * 三个档位看起来完全相同。现在按档位收敛展示面：
 *   精简(minimal): 只提取/展示主角+核心反派的立场；
 *   基础(basic)  : 立场 + 日常 + 心理变化；
 *   完整(full)   : 全 9 维（含立场转变/高光/名言/口头禅/事迹/关系）。
 */
export const LEVEL_DIMENSIONS = {
    minimal: ['stance'],
    basic: ['stance', 'daily', 'psychology'],
    full: DIMENSIONS.map(d => d.key),
};

/** 档位说明（展示在头部，让用户知道当前档位能看到什么） */
export const LEVEL_HINTS = {
    minimal: '仅主角+核心反派的立场',
    basic: '立场 / 日常 / 心理变化',
    full: '全 9 维：立场 / 转变 / 心理 / 日常 / 高光 / 名言 / 口头禅 / 事迹 / 关系',
};

/** 档位允许的维度 key（未知档位按完整处理） */
export function dimensionKeysForLevel(level) {
    return LEVEL_DIMENSIONS[level] || LEVEL_DIMENSIONS.full;
}

/** 档位允许的维度定义数组（保持 DIMENSIONS 的顺序） */
export function dimensionsForLevel(level) {
    const keys = dimensionKeysForLevel(level);
    return DIMENSIONS.filter(d => keys.includes(d.key));
}

/** 从一条编年史记录抽取某维度的条目（统一为 {chapter, entity, scene?, text, note?}） */
export function itemsOf(entry, key) {
    const base = { chapter: entry.chapterNumber || 0, entity: entry.entityName || '' };
    const fromList = (arr, fn) => (Array.isArray(arr) ? arr : []).map(fn).filter(x => x && x.text);
    switch (key) {
        case 'stance':
            return entry.stance ? [{ ...base, text: entry.stance, note: entry.innerConflict ? `内心矛盾：${entry.innerConflict}` : '' }] : [];
        case 'shift':
            return entry.stanceShiftReason ? [{ ...base, text: entry.stanceShiftReason }] : [];
        case 'psychology':
            return entry.psychology ? [{ ...base, text: entry.psychology }] : [];
        case 'daily':
            return entry.daily ? [{ ...base, text: entry.daily }] : [];
        case 'highlight':
            return fromList(entry.highlights, h => ({
                ...base, scene: h.scene, text: h.what,
                note: [h.cost ? `代价：${h.cost}` : '', h.why].filter(Boolean).join(' / ')
            }));
        case 'quote':
            return fromList(entry.quotes, q => {
                const x = typeof q === 'string' ? { quote: q } : q;
                return { ...base, scene: x.scene, text: `“${x.quote}”`, note: x.why };
            });
        case 'catchphrase':
            return fromList(entry.catchphrases, c => {
                const x = typeof c === 'string' ? { text: c } : c;
                return { ...base, scene: x.trigger, text: `「${x.text}」`, note: x.why };
            });
        case 'deed':
            return fromList(entry.deeds, d => ({ ...base, text: typeof d === 'string' ? d : (d && (d.text || d.what)) }));
        case 'relation':
            return fromList(entry.relations, r => ({ ...base, text: `${r.target || ''}：${r.from || ''} → ${r.to || ''}`, note: r.reason }));
        default:
            return [];
    }
}

/** 每个维度的条目数（用于筛选条与"哪些维度有数据"）。传 level 时只统计该档位可见维度 */
export function dimensionCounts(data = [], level) {
    const dims = level ? dimensionsForLevel(level) : DIMENSIONS;
    const counts = {};
    for (const d of dims) counts[d.key] = data.reduce((n, e) => n + itemsOf(e, d.key).length, 0);
    return counts;
}
