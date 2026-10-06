/**
 * progressConstants — 运行看板的展示常量与格式化
 * 数据形状来源：GET /api/pipeline/progress/:projectId（服务端 progressView.js 组装）
 * 文件位置：client/src/pages/progress/progressConstants.js
 */

/** 毫秒 → 人类可读（"2分13秒"）；0/空返回 '—'，避免把"无数据"显示成"0毫秒" */
export function fmtDuration(ms) {
    if (!ms || ms < 0) return '—';
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}秒`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}分${sec % 60}秒`;
    return `${Math.floor(min / 60)}小时${min % 60}分`;
}

export function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export const fmtNum = (n) => (typeof n === 'number' ? n.toLocaleString('zh-CN') : '—');

/** 章节状态 → 中文 + 颜色（键为服务端 chapterStates 的原始状态值） */
export const CHAPTER_STATUS_META = {
    'material-updated': { label: '已完成', color: '#2ed573' },
    approved: { label: '已通过', color: '#2ed573' },
    written: { label: '已写', color: '#3498db' },
    outlined: { label: '仅有大纲', color: '#ffa502' },
    draft: { label: '草稿', color: '#ffa502' },
    'first-reviewing': { label: '初审中', color: '#3498db' },
    'first-reviewed': { label: '初审通过', color: '#2ed573' },
    'second-reviewing': { label: '复审中', color: '#3498db' },
    'second-reviewed': { label: '复审通过', color: '#2ed573' },
    'final-editing': { label: '定稿中', color: '#3498db' },
    'failed-skipped': { label: '失败跳过', color: '#ff4757' },
    'timeout-skipped': { label: '超时跳过', color: '#ff4757' },
    'cooldown-waiting': { label: '冷却等待', color: '#ffa502' },
};
export const statusMeta = (st) => CHAPTER_STATUS_META[st] || { label: st || '未知', color: '#8d99ae' };

/** 步骤状态 → 颜色 */
export function stepStatusColor(status, passed) {
    if (passed === false) return '#ff4757';
    if (status === 'completed' || status === 'done') return '#2ed573';
    if (status === 'failed' || status === 'error') return '#ff4757';
    return '#8d99ae';
}
