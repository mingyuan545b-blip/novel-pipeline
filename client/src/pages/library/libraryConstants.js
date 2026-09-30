/**
 * libraryConstants — 藏经阁前端展示常量（完整度/视图/标签）
 *
 * 完整度语义由服务端判定（server/services/libraryCompleteness.js），
 * 此处只负责"怎么显示"：文案、颜色、徽标。禁止在前端重新判定是否空壳。
 *
 * 文件位置：client/src/pages/library/libraryConstants.js
 */

/** 内容完整度 → 展示配置（与 server/services/libraryCompleteness.js 的 LEVELS 对齐） */
export const COMPLETENESS = {
    full: { label: '可直接注入', short: '完整', color: '#2ed573', hint: '实施规则≥2条，能真正指导写作' },
    partial: { label: '部分内容', short: '部分', color: '#ffa502', hint: '有描述或反模式，但缺少可执行的实施规则' },
    empty: { label: '空壳条目', short: '空壳', color: '#8d99ae', hint: '只有名字和标签，注入时给不了模型任何做法' },
};

export const COMPLETENESS_ORDER = ['full', 'partial', 'empty'];

/** 完整度筛选（顶部 chips） */
export const COMPLETENESS_FILTERS = [
    { key: '', label: '全部' },
    { key: 'full', label: '可直接注入' },
    { key: 'partial', label: '部分内容' },
    { key: 'empty', label: '空壳' },
];

/** 左栏视图 */
export const VIEW_TABS = [
    { key: 'source', label: '按来源' },
    { key: 'department', label: '按部门' },
    { key: 'depth', label: '按深度' },
];

/** 髓标文案：有规则显示条数，空壳显示"空壳" */
export function completenessBadge(item) {
    if (!item) return '';
    if (item.completeness === 'full') return `${item.rulesCount}条规则`;
    if (item.completeness === 'partial') return item.antiCount ? `${item.antiCount}条反模式` : '仅有描述';
    return '空壳';
}

/** 去掉部门/子类的数字前缀，用于显示 */
export const cleanDept = (name) => (name || '').replace(/^\d+_/, '');
