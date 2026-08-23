import logger from '../../shared/logger';

export const PIPELINE_STEPS = {
    novel: [
        { key: 'intent-planner', label: '意图规划', icon: '🎯', color: '#2ed573' },
        { key: 'writer', label: '执笔人', icon: '✍️', color: 'var(--neon-blue)' },
        { key: 'reviser', label: '返修员', icon: '🔧', color: '#00d2d3' },
        { key: 'first-review', label: '初审', icon: '🔍', color: 'var(--neon-green)' },
        { key: 'second-review', label: '复审', icon: '🔎', color: 'var(--neon-orange)' },
        { key: 'final-editor', label: '定稿人', icon: '✏️', color: 'var(--neon-pink)' },
        { key: 'polisher', label: '润色师', icon: '💎', color: '#a29bfe' },
        { key: 'material-manager', label: '素材管理员', icon: '📦', color: 'var(--neon-purple)' },
        { key: 'reader', label: '阅读者', icon: '📖', color: '#ff9ff3' },
        { key: 'consistency-constraints', label: '一致性约束', icon: '🔒', color: '#fd79a8' }
    ]
};

export const OUTPUT_TABS = {
    novel: [
        { key: 'intentPlannerOutput', label: '意图规划', color: '#2ed573', agentKey: 'intent-planner' },
        { key: 'writerOutput', label: '执笔人', color: 'var(--neon-blue)', agentKey: 'writer' },
        { key: 'reviserOutput', label: '返修员', color: '#00d2d3', agentKey: 'reviser' },
        { key: 'firstReviewOutput', label: '初审', color: 'var(--neon-green)', agentKey: 'first-review' },
        { key: 'secondReviewOutput', label: '复审', color: 'var(--neon-orange)', agentKey: 'second-review' },
        { key: 'finalEditorOutput', label: '定稿人', color: 'var(--neon-pink)', agentKey: 'final-editor' },
        { key: 'polisherOutput', label: '润色师', color: '#a29bfe', agentKey: 'polisher' },
        { key: 'materialManagerOutput', label: '素材管理员', color: 'var(--neon-purple)', agentKey: 'material-manager' },
        { key: 'readerOutput', label: '阅读者', color: '#ff9ff3', agentKey: 'reader' },
        { key: 'consistencyConstraintsOutput', label: '一致性约束', color: '#fd79a8', agentKey: 'consistency-constraints' }
    ]
};

const FAST_REVIEW_TAB = { key: 'firstReviewOutput', label: '快审', color: '#ffa502', agentKey: 'fast-review' };
const FAST_REVIEW_STEP = { key: 'fast-review', label: '快审', icon: '⚡', color: '#ffa502' };

const REVIEW_TABS = ['firstReviewOutput', 'secondReviewOutput'];
const REVIEW_STEPS = ['first-review', 'second-review'];

export function buildPipelineSteps(pipelineConfig) {
    if (!pipelineConfig) return PIPELINE_STEPS.novel;
    const base = [...PIPELINE_STEPS.novel];
    if (pipelineConfig.skipSecondReview) {
        const reviewIdx = base.findIndex(s => s.key === 'first-review');
        if (reviewIdx >= 0) {
            base.splice(reviewIdx, 2, FAST_REVIEW_STEP);
        }
    }
    return base;
}

export function buildOutputTabs(pipelineConfig) {
    if (!pipelineConfig) return OUTPUT_TABS.novel;
    const base = [...OUTPUT_TABS.novel];
    if (pipelineConfig.skipSecondReview) {
        const firstIdx = base.findIndex(t => t.key === 'firstReviewOutput');
        const secondIdx = base.findIndex(t => t.key === 'secondReviewOutput');
        if (firstIdx >= 0 && secondIdx >= 0) {
            base.splice(firstIdx, 2, FAST_REVIEW_TAB);
        }
    }
    return base;
}

export const AGENT_LABELS = {
    'intent-planner': '意图规划',
    'intent-detail': '意图详情',
    writer: '执笔人',
    reviser: '返修员',
    'fast-review': '快审',
    'first-review': '初审',
    'second-review': '复审',
    'final-editor': '定稿人',
    polisher: '润色师',
    'material-manager': '素材管理',
    reader: '阅读者',
    'consistency-constraints': '一致性约束',
    'tomato-writer': '番茄执笔',
    'tomato-fast-review': '番茄快审',
    'pipeline-start': '开始',
    'pipeline-done': '完成',
    'pipeline-error': '异常',
    'word-count-fail': '字数拦截',
    'review-fail': '审核拦截',
    'chapter-skip': '跳过',
    'material-update': '素材更新',
    'outline-supplement': '补充大纲',
    'cooldown': '冷却',
    'pipeline-stop': '停止',
    'chapter-status': '章节状态',
    'alert-loop': '熔断诊断',
    'writer-branching': 'A/B分支'
};

// 状态值常量（P1-Q1铁律：禁止业务代码直接写字面量，统一从此处引用）
export const STATUS_VALUES = {
    APPROVED: 'approved',
    MATERIAL_UPDATED: 'material-updated',
    OUTLINED: 'outlined',
    WRITTEN: 'written'
};

export const STATUS_ORDER = ['outlined', 'written', 'first-reviewing', 'first-reviewed', 'second-reviewing', 'second-reviewed', 'final-editing', 'approved', 'material-updated', 'cooldown-waiting'];

export const safeStr = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try { return JSON.stringify(v); } catch (e) { logger.warn('PipelinePage', 'safeStr JSON.stringify failed:', e.message); return String(v); }
};

export const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const getStepStatus = (stepKey, selectedChapter, pipelineState) => {
    if (!selectedChapter) return 'pending';
    const ch = selectedChapter;
    if (ch.status === STATUS_VALUES.APPROVED || ch.status === STATUS_VALUES.MATERIAL_UPDATED) return 'done';
    const statusIdx = STATUS_ORDER.indexOf(ch.status);
    if (stepKey === 'intent-planner') return (ch.intentPlannerOutput && (typeof ch.intentPlannerOutput === 'string' ? ch.intentPlannerOutput.trim() : true)) ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (stepKey === 'writer') return statusIdx >= 1 ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (stepKey === 'reviser') return ch.reviserOutput ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (stepKey === 'first-review' || stepKey === 'fast-review') return statusIdx >= 2 ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (stepKey === 'second-review') return statusIdx >= 3 ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (stepKey === 'final-editor') return statusIdx >= 4 ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (stepKey === 'polisher') return ch.polisherOutput ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (stepKey === 'material-manager') return ch.status === STATUS_VALUES.MATERIAL_UPDATED ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (stepKey === 'reader') return ch.readerOutput ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (stepKey === 'consistency-constraints') return ch.consistencyConstraintsOutput ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
    if (pipelineState.currentStep === stepKey) return 'active';
    return 'pending';
};

export const isStepOutputVisible = (outputKey, selectedChapter) => {
    if (!selectedChapter) return false;
    const ch = selectedChapter;
    if (ch.status === STATUS_VALUES.APPROVED || ch.status === STATUS_VALUES.MATERIAL_UPDATED) return true;
    const statusIdx = STATUS_ORDER.indexOf(ch.status);
    if (outputKey === 'intentPlannerOutput') return statusIdx >= 0;
    if (outputKey === 'writerOutput') return statusIdx >= 1;
    if (outputKey === 'reviserOutput') return !!ch.reviserOutput;
    if (outputKey === 'firstReviewOutput') return statusIdx >= 2;
    if (outputKey === 'secondReviewOutput') return statusIdx >= 3;
    if (outputKey === 'finalEditorOutput') return statusIdx >= 4;
    if (outputKey === 'materialManagerOutput') return ch.status === STATUS_VALUES.MATERIAL_UPDATED;
    return true;
};

export const AGENT_ICONS = {
    'intent-planner': '🎯',
    'intent-detail': '📋',
    writer: '✍️',
    reviser: '🔧',
    'fast-review': '⚡',
    'first-review': '🔍',
    'second-review': '🔎',
    'final-editor': '✏️',
    polisher: '💎',
    'material-manager': '📦',
    reader: '📖',
    'consistency-constraints': '🔒',
    'pipeline-start': '🚀',
    'pipeline-done': '✅',
    'pipeline-error': '❌',
    'word-count-fail': '📏',
    'review-fail': '🚫',
    'chapter-skip': '⏭️',
    'material-update': '📦',
    'outline-supplement': '📝',
    'cooldown': '❄️',
    'pipeline-stop': '🛑',
    'chapter-status': '📋',
    'alert-loop': '🚨',
    'writer-branching': '🔀'
};
