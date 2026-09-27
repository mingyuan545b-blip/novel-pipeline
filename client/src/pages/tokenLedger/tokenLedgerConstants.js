/**
 * tokenLedgerConstants.js — Token 面板前端常量（步骤配色）
 * 步骤中文名由服务端下发（AGENT_ROLE_NAMES 唯一数据源），前端只负责配色。
 */

export const STEP_COLORS = {
    writer: '#38bdf8',
    reviser: '#f97316',
    'first-review': '#a78bfa',
    'second-review': '#c084fc',
    'fast-review': '#e879f9',
    'final-editor': '#22d3ee',
    polisher: '#f472b6',
    reader: '#94a3b8',
    'intent-planner': '#4ade80',
    'material-manager': '#facc15',
    'material-organizer': '#fbbf24',
};

const PALETTE = ['#38bdf8', '#f97316', '#a78bfa', '#22d3ee', '#f472b6', '#4ade80', '#facc15'];

export function stepColor(step, index = 0) {
    return STEP_COLORS[step] || PALETTE[index % PALETTE.length];
}

/** 后端 byStep → 可渲染条目（中文名来自服务端 stepLabel + 前端配色） */
export function decorateSteps(byStep) {
    return (byStep || []).map((x, i) => ({ ...x, label: x.stepLabel || x.step, color: stepColor(x.step, i) }));
}
