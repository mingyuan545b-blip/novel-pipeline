export const TABS = [
    { key: 'materials', label: '📦 素材库' },
    { key: 'quests', label: '⚔ 主线任务' }
];

export const MATERIAL_TYPE_ICONS = {
    worldview: '🌍', character: '👤', equipment: '⚔', relationship: '🔗',
    'power-system': '⚡', 'sub-plane': '🌀', faction: '🏛', institution: '🏯',
    catchphrase: '💬', 'famous-scene': '🎬', 'growth-history': '📈',
    foreshadowing: '🔮', location: '📍', 'narrative-bridge': '🌉',
    'writing-technique': '✍️', craft: '📝', mechanism: '⚙️', index: '📑', other: '📋'
};

export const MATERIAL_TYPE_LABELS = Object.fromEntries(
    Object.entries(MATERIAL_TYPE_ICONS).map(([k, v]) => [k, `${v} ${({worldview:'世界观',character:'人物卡',equipment:'装备',relationship:'人物关系','power-system':'战力体系','sub-plane':'次位面',faction:'势力',institution:'机构',catchphrase:'金句/热梗','famous-scene':'名场面','growth-history':'成长史',foreshadowing:'伏笔',location:'地点','narrative-bridge':'叙事衔接','writing-technique':'写作手法',craft:'创作规范',mechanism:'机制',index:'索引',other:'其他'})[k] || k}`])
);

export const MATERIAL_TYPE_COLORS = {
    worldview: 'blue', character: 'pink', equipment: 'orange', relationship: 'red',
    'power-system': 'purple', 'sub-plane': 'cyan', faction: 'gold', institution: 'brown',
    catchphrase: 'green', 'famous-scene': 'orange', 'growth-history': 'blue',
    foreshadowing: 'purple', location: 'teal', 'narrative-bridge': 'gray',
    'writing-technique': 'indigo', craft: 'amber', mechanism: 'steel', index: 'slate', other: 'blue'
};

export const DOMAIN_CATEGORIES = {
    world: ['worldview', 'power-system', 'faction', 'character', 'institution', 'location', 'equipment'],
    subplane: ['sub-plane'],
    craft: ['craft', 'writing-technique', 'narrative-bridge', 'catchphrase', 'famous-scene', 'foreshadowing', 'growth-history', 'relationship', 'mechanism', 'index', 'other']
};

export const ARCHIVE_STATUS_LABELS = { retire: '已淘汰', deprecate: '已废弃', recycle: '已回收' };
export const ARCHIVE_STATUS_COLORS = { retire: 'var(--neon-red)', deprecate: 'var(--neon-orange)', recycle: 'var(--neon-green)' };

export const QUEST_STATUS_LABELS = { planned: '📋 计划中', active: '⚡ 进行中', completed: '✅ 已完成', abandoned: '❌ 已放弃' };
export const QUEST_STATUS_COLORS = { planned: 'var(--text-muted)', active: 'var(--neon-blue)', completed: 'var(--neon-green)', abandoned: 'var(--neon-red)' };
export const QUEST_STATUS_BADGE = { planned: 'cyber-badge-blue', active: 'cyber-badge-orange', completed: 'cyber-badge-green', abandoned: 'cyber-badge-red' };
export const QUEST_PRIORITY_LABELS = { low: '低', normal: '普通', high: '高', critical: '紧急' };
export const QUEST_PRIORITY_COLORS = { low: 'var(--text-muted)', normal: 'var(--neon-blue)', high: 'var(--neon-orange)', critical: 'var(--neon-red)' };

export const TIMELINE_EVENT_LABELS = { plot: '📖 剧情', character: '👤 人物', world: '🌍 世界', conflict: '⚔ 冲突', revelation: '💡 揭示', foreshadow: '🔮 伏笔', resolution: '🎯 解决' };
export const TIMELINE_EVENT_COLORS = { plot: 'var(--neon-blue)', character: 'var(--neon-pink)', world: 'var(--neon-green)', conflict: 'var(--neon-red)', revelation: 'var(--neon-orange)', foreshadow: 'var(--neon-purple)', resolution: 'var(--neon-green)' };
export const TIMELINE_EVENT_BADGE = { plot: 'cyber-badge-blue', character: 'cyber-badge-pink', world: 'cyber-badge-green', conflict: 'cyber-badge-red', revelation: 'cyber-badge-orange', foreshadow: 'cyber-badge-purple', resolution: 'cyber-badge-green' };
export const IMPORTANCE_LABELS = { low: '低', normal: '普通', high: '高', critical: '关键' };

export const FIELD_COLORS = {
    '核心欲望': '#ff6b9d', '内在矛盾': '#ff6b9d', '行为模式': '#ff6b9d',
    '身份': '#4ecdc4', '与主角关系': '#4ecdc4',
    '所属位面': '#00c8ff', '势力名': '#ffc800', '定位': '#ffc800',
    '获取方式': '#ff9f43', '限制': '#ff9f43', '代价': '#ff9f43',
    '当前状态': '#a29bfe', '预期回收窗口': '#a29bfe', '关联角色': '#a29bfe',
    '核心规则': '#00c8ff', '视觉特征': '#00c8ff', '主线剧情': '#6c5ce7',
    '系统任务': '#fd79a8', '关键转折': '#fd79a8', '掠夺能力': '#fd79a8',
    '触发条件': '#ffeaa7', '结构': '#ffeaa7', '功能': '#ffeaa7',
    '势力关系': '#ffc800', '更新说明': '#a29bfe', '观察记录': '#a29bfe'
};

export const buildDomainTree = (mats) => {
    const matMap = {};
    mats.forEach(m => { matMap[m.id] = m; });
    const mainWorld = { id: '__mainworld__', name: '主世界', factions: {}, others: [] };
    const subPlanes = [];
    const planeMap = {};
    const craftRules = { id: '__craft__', name: '创作规范', byType: {} };

    mats.filter(m => m.type === 'sub-plane').forEach(sp => {
        const node = { ...sp, factions: {}, others: [], items: [] };
        subPlanes.push(node);
        planeMap[sp.id] = node;
    });

    const worldTypes = new Set(DOMAIN_CATEGORIES.world);
    const craftTypes = new Set(DOMAIN_CATEGORIES.craft);

    const factions = mats.filter(m => m.type === 'faction');
    const nonFactions = mats.filter(m => m.type !== 'sub-plane' && m.type !== 'faction');

    factions.forEach(f => {
        if (f.parentPlane && planeMap[f.parentPlane]) {
            planeMap[f.parentPlane].factions[f.id] = { ...f, characters: [] };
        } else {
            mainWorld.factions[f.id] = { ...f, characters: [] };
        }
    });

    nonFactions.forEach(m => {
        if (craftTypes.has(m.type)) {
            if (!craftRules.byType[m.type]) craftRules.byType[m.type] = [];
            craftRules.byType[m.type].push(m);
        } else if (m.parentPlane && planeMap[m.parentPlane]) {
            const plane = planeMap[m.parentPlane];
            if (m.type === 'character' && m.parentFaction && plane.factions[m.parentFaction]) {
                plane.factions[m.parentFaction].characters.push(m);
            } else if (m.type === 'equipment') {
                plane.items.push(m);
            } else {
                plane.others.push(m);
            }
        } else if (m.parentFaction && mainWorld.factions[m.parentFaction]) {
            mainWorld.factions[m.parentFaction].characters.push(m);
        } else if (worldTypes.has(m.type)) {
            mainWorld.others.push(m);
        } else {
            if (!craftRules.byType[m.type]) craftRules.byType[m.type] = [];
            craftRules.byType[m.type].push(m);
        }
    });

    const mainWorldOthers = {};
    mainWorld.others.forEach(m => {
        if (!mainWorldOthers[m.type]) mainWorldOthers[m.type] = [];
        mainWorldOthers[m.type].push(m);
    });
    mainWorld.othersByType = mainWorldOthers;

    const craftTotal = Object.values(craftRules.byType).reduce((s, arr) => s + arr.length, 0);
    craftRules.total = craftTotal;

    return { mainWorld, subPlanes, craftRules };
};

export const toBeijingTime = (isoStr) => {
    if (!isoStr) return '未知时间';
    const d = new Date(isoStr);
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
