/**
 * libraryTreeBuild — 藏经阁「条目 → 树/统计」纯函数
 *
 * 从 useLibraryState 抽出的原因：筛选与分组是无副作用的纯计算，
 * 抽成纯函数后可单测，也避免 hook 无限膨胀（前端单文件 200 行硬限制）。
 *
 * 文件位置：client/src/pages/library/libraryTreeBuild.js
 */

/**
 * 部门 → 世界观深度兜底映射（带数字前缀，与树节点 key 一致）。
 * SSOT 在服务端 server/services/pipeline/techniqueScheduler.js 的 TECH_WORLDVIEW_DEPTH，
 * 此处仅用于服务端 worldviewDepth 字段缺失时的兜底。
 */
export const DEPT_DEPTH = {
    '00_叙事之魂部': 'macro', '01_顶层设计部': 'macro', '06_世界构建部': 'macro',
    '02_情节引擎部': 'meso', '03_人物熔炉部': 'meso', '04_对白艺术部': 'meso',
    '05_文笔滤镜部': 'micro',
};

/**
 * 解析技法条目的深度：优先用服务端 worldviewDepth（library_techniques.worldview_depth 列），
 * 缺失再按部门兜底，最后回落 meso。
 * 修复点：原实现用 DEPTH_COLORS 的十六进制色值与部门名比较，恒不相等 → micro 分支永不成立。
 */
export const resolveDepth = (entry) =>
    entry?.worldviewDepth || DEPT_DEPTH[entry?.department] || 'meso';

/** 按 部门 → 子类 → 条目 建树；同时产出 深度 → 部门 → 子类 → 条目 */
export function buildTrees(entries) {
    const tree = {};
    const byDepth = {};
    for (const e of (entries || [])) {
        const dept = e.department || '未知部门';
        const sub = e.subcategory || '其他';
        if (!tree[dept]) tree[dept] = {};
        if (!tree[dept][sub]) tree[dept][sub] = [];
        tree[dept][sub].push(e);

        const depth = resolveDepth(e);
        if (!byDepth[depth]) byDepth[depth] = {};
        if (!byDepth[depth][dept]) byDepth[depth][dept] = {};
        if (!byDepth[depth][dept][sub]) byDepth[depth][dept][sub] = [];
        byDepth[depth][dept][sub].push(e);
    }
    return { tree, byDepth };
}

/** 完整度计数（供顶部数据条；active 用于高亮当前筛选） */
export function countByCompleteness(entries, active = '') {
    const counts = { total: 0, full: 0, partial: 0, empty: 0, active };
    for (const e of (entries || [])) {
        counts.total += 1;
        counts[e.completeness] = (counts[e.completeness] || 0) + 1;
    }
    return counts;
}

/**
 * 无来源条目归入的展示名。必须与服务端 /api/library/sources 的分组键
 * (server/routes/libraryMetaRoutes.js 的 `t.source_novel || '（未标注来源）'`) 完全一致，
 * 否则「按来源」点开某本书会一条都列不出来。
 */
export const UNKNOWN_SOURCE = '（未标注来源）';

/** 条目的来源名（索引条目上是 sourceNovel） */
export const sourceOf = (entry) => entry?.sourceNovel || UNKNOWN_SOURCE;

/** 按完整度/来源/模式筛选（客户端筛选，避免每次切筛都打服务端） */
export function filterEntries(entries, { completeness = '', source = '', mode = '' } = {}) {
    return (entries || []).filter(e => {
        if (completeness && e.completeness !== completeness) return false;
        if (source && sourceOf(e) !== source) return false;
        if (mode && !(e.modes || []).includes(mode)) return false;
        return true;
    });
}

/**
 * 按来源分组：source → 条目[]（顺序沿用入参，服务端已按"有内容优先"排序）。
 * 「按来源」视图点开一本书时用它列出该书贡献的技法 —— 此前只设了筛选条件却没有
 * 渲染任何列表，点了跟没点一样（用户 2026-10-01 反馈）。
 */
export function groupBySource(entries) {
    const map = {};
    for (const e of (entries || [])) {
        const k = sourceOf(e);
        if (!map[k]) map[k] = [];
        map[k].push(e);
    }
    return map;
}

/** 展开全部时需要的 key 集合（部门视图与深度视图的 key 不同，必须都覆盖） */
export function collectExpandKeys(tree, byDepth) {
    const keys = new Set();
    for (const [dept, subs] of Object.entries(tree || {})) {
        keys.add(dept);
        for (const sub of Object.keys(subs)) keys.add(`${dept}/${sub}`);
    }
    for (const [depth, depts] of Object.entries(byDepth || {})) {
        keys.add(depth);
        for (const [dept, subs] of Object.entries(depts)) {
            keys.add(`${depth}/${dept}`);
            for (const sub of Object.keys(subs)) keys.add(`${depth}/${dept}/${sub}`);
        }
    }
    return keys;
}
