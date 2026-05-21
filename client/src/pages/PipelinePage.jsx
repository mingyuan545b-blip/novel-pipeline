import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { chaptersApi, pipelineApi, reviewsApi, materialsApi, publishApi, projectsApi, optimizerApi, chapterAuditApi } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const safeStr = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try { return JSON.stringify(v); } catch { return String(v); }
};

const SafeMarkdown = ({ children, ...props }) => {
    const text = safeStr(children);
    if (!text) return null;
    return <ReactMarkdown remarkPlugins={[remarkGfm]} {...props}>{text}</ReactMarkdown>;
};

const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const PIPELINE_STEPS = {
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
        { key: 'adjuster', label: '调整员', icon: '⚙️', color: '#f368e0' }
    ],
    shuangwen: [
        { key: 'intent-planner', label: '意图规划', icon: '🎯', color: '#2ed573' },
        { key: 'writer', label: '爽文执笔', icon: '✍️', color: 'var(--neon-blue)' },
        { key: 'reviser', label: '返修员', icon: '🔧', color: '#00d2d3' },
        { key: 'fast-review', label: '快审', icon: '⚡', color: 'var(--neon-green)' },
        { key: 'final-editor', label: '定稿人', icon: '✏️', color: 'var(--neon-pink)' },
        { key: 'polisher', label: '润色师', icon: '💎', color: '#a29bfe' },
        { key: 'material-manager', label: '素材管理员', icon: '📦', color: 'var(--neon-purple)' },
        { key: 'reader', label: '阅读者', icon: '📖', color: '#ff9ff3' },
        { key: 'adjuster', label: '调整员', icon: '⚙️', color: '#f368e0' }
    ],
    'tomato-short': [
        { key: 'intent-planner', label: '意图规划', icon: '🎯', color: '#2ed573' },
        { key: 'writer', label: '番茄执笔', icon: '🍅', color: '#ff6348' },
        { key: 'reviser', label: '返修员', icon: '🔧', color: '#00d2d3' },
        { key: 'fast-review', label: '番茄快审', icon: '⚡', color: '#ffa502' },
        { key: 'final-editor', label: '定稿人', icon: '✏️', color: 'var(--neon-pink)' },
        { key: 'polisher', label: '润色师', icon: '💎', color: '#a29bfe' },
        { key: 'material-manager', label: '素材管理员', icon: '📦', color: 'var(--neon-purple)' },
        { key: 'reader', label: '阅读者', icon: '📖', color: '#ff9ff3' },
        { key: 'adjuster', label: '调整员', icon: '⚙️', color: '#f368e0' }
    ]
};

const OUTPUT_TABS = {
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
        { key: 'adjusterOutput', label: '调整员', color: '#f368e0', agentKey: 'adjuster' }
    ],
    shuangwen: [
        { key: 'intentPlannerOutput', label: '意图规划', color: '#2ed573', agentKey: 'intent-planner' },
        { key: 'writerOutput', label: '爽文执笔', color: 'var(--neon-blue)', agentKey: 'writer' },
        { key: 'reviserOutput', label: '返修员', color: '#00d2d3', agentKey: 'reviser' },
        { key: 'firstReviewOutput', label: '快审', color: '#ffa502', agentKey: 'fast-review' },
        { key: 'finalEditorOutput', label: '定稿人', color: 'var(--neon-pink)', agentKey: 'final-editor' },
        { key: 'polisherOutput', label: '润色师', color: '#a29bfe', agentKey: 'polisher' },
        { key: 'materialManagerOutput', label: '素材管理员', color: 'var(--neon-purple)', agentKey: 'material-manager' },
        { key: 'readerOutput', label: '阅读者', color: '#ff9ff3', agentKey: 'reader' },
        { key: 'adjusterOutput', label: '调整员', color: '#f368e0', agentKey: 'adjuster' }
    ],
    'tomato-short': [
        { key: 'intentPlannerOutput', label: '意图规划', color: '#2ed573', agentKey: 'intent-planner' },
        { key: 'writerOutput', label: '番茄执笔', color: '#ff6348', agentKey: 'writer' },
        { key: 'reviserOutput', label: '返修员', color: '#00d2d3', agentKey: 'reviser' },
        { key: 'firstReviewOutput', label: '番茄快审', color: '#ffa502', agentKey: 'fast-review' },
        { key: 'finalEditorOutput', label: '定稿人', color: 'var(--neon-pink)', agentKey: 'final-editor' },
        { key: 'polisherOutput', label: '润色师', color: '#a29bfe', agentKey: 'polisher' },
        { key: 'materialManagerOutput', label: '素材管理员', color: 'var(--neon-purple)', agentKey: 'material-manager' },
        { key: 'readerOutput', label: '阅读者', color: '#ff9ff3', agentKey: 'reader' },
        { key: 'adjusterOutput', label: '调整员', color: '#f368e0', agentKey: 'adjuster' }
    ]
};

const AGENT_LABELS = {
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
    adjuster: '调整员',
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

const AGENT_ICONS = {
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
    adjuster: '⚙️',
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

function ReviewResultPanel({ result }) {
    if (!result) return null;
    const passed = result.passed;
    const issues = result.issues || [];
    const suggestions = result.suggestions || [];
    const summary = result.summary || '';
    return (
        <div style={{ marginTop: 8, padding: 12, background: passed ? 'rgba(46,213,115,0.05)' : 'rgba(255,0,68,0.05)', borderRadius: 8, border: `1px solid ${passed ? 'rgba(46,213,115,0.2)' : 'rgba(255,0,68,0.2)'}` }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: issues.length > 0 || suggestions.length > 0 ? 10 : 0 }}>
                <div style={{ flex: '0 0 auto', padding: '10px 14px', background: passed ? 'rgba(46,213,115,0.1)' : 'rgba(255,0,68,0.1)', borderRadius: 8, borderLeft: `4px solid ${passed ? 'var(--neon-green)' : 'var(--neon-red)'}`, minWidth: 120 }}>
                    <div style={{ fontSize: 20, marginBottom: 2 }}>{passed ? '✅' : '❌'}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: passed ? 'var(--neon-green)' : 'var(--neon-red)' }}>{passed ? '审核通过' : '未通过'}</div>
                    <div style={{ fontSize: 10, color: 'var(--neon-blue)', marginTop: 4 }}>{result.usedProvider}/{result.usedModel}</div>
                    {result.wordCount && <div style={{ fontSize: 10, color: '#d5d5d5', marginTop: 2 }}>{result.wordCount}字</div>}
                </div>
                <div style={{ flex: 1 }}>
                    {summary && (
                        <div className="markdown-content" style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12, lineHeight: 1.6 }}>
                            <SafeMarkdown>{summary}</SafeMarkdown>
                        </div>
                    )}
                </div>
            </div>
            {issues.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-red)', marginBottom: 4 }}>⚠ 发现问题 ({issues.length})</div>
                    {issues.map((issue, i) => {
                        const sevColor = issue.severity === 'critical' ? 'var(--neon-red)' : issue.severity === 'high' ? 'var(--neon-orange)' : 'var(--text-muted)';
                        return (
                            <div key={i} className="markdown-content" style={{ padding: '6px 10px', borderLeft: `3px solid ${sevColor}`, marginBottom: 3, fontSize: 11, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                                <span style={{ color: sevColor, fontWeight: 600, fontSize: 9, marginRight: 6 }}>{(issue.severity || 'medium').toUpperCase()}</span>
                                <span style={{ color: '#eee', fontWeight: 600 }}>{issue.title}</span>
                                {issue.location && <div style={{ color: '#54a0ff', marginTop: 2, fontSize: 10 }}>📍 {issue.location}</div>}
                                {issue.originalText && <div style={{ color: '#ffa502', marginTop: 2, fontSize: 10 }}>原文: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>{issue.originalText}</code></div>}
                                {issue.perspective && <span style={{ color: '#747d8c', fontSize: 9, marginLeft: 6 }}>({issue.perspective}视角)</span>}
                                {issue.violationReason && <div style={{ color: '#ff6b6b', marginTop: 2, fontSize: 10 }}>违规: {issue.violationReason}</div>}
                                {issue.howToFix && <div style={{ color: '#2ed573', marginTop: 2, fontSize: 10 }}>改法: {issue.howToFix}</div>}
                                {issue.targetText && <div style={{ color: '#2ed573', marginTop: 2, fontSize: 10 }}>改为: <code style={{ background: 'rgba(46,213,115,0.1)', padding: '1px 4px', borderRadius: 3, color: '#2ed573' }}>{issue.targetText}</code></div>}
                                {issue.description && !issue.originalText && !issue.violationReason && <div style={{ color: '#ddd', marginTop: 3 }}><SafeMarkdown>{issue.description}</SafeMarkdown></div>}
                            </div>
                        );
                    })}
                </div>
            )}
            {suggestions.length > 0 && (
                <div style={{ padding: '8px 10px', background: 'rgba(0,210,211,0.06)', borderRadius: 8, border: '1px solid rgba(0,210,211,0.15)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-blue)', marginBottom: 4 }}>💡 修改建议 ({suggestions.length})</div>
                    {suggestions.map((s, i) => (
                        <div key={i} className="markdown-content" style={{ padding: '6px 10px', borderLeft: '3px solid var(--neon-blue)', marginBottom: 3, fontSize: 11, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                            {s.title && <span style={{ color: 'var(--neon-blue)', fontWeight: 600 }}>{s.title}</span>}
                            {s.description && <div style={{ color: '#ddd', marginTop: 2 }}><SafeMarkdown>{s.description}</SafeMarkdown></div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function PipelinePage() {
    const PROVIDER_DEFAULTS = {
        aliyunCoding: { model: 'qwen3.6-plus', baseURL: 'https://coding.dashscope.aliyuncs.com/v1' },
        minimax: { model: 'MiniMax-M2.7', baseURL: 'https://api.minimaxi.com/v1' },
        lmstudio: { model: '', baseURL: 'http://localhost:1234/v1' },
        siliconflow: { model: 'deepseek-ai/DeepSeek-V3', baseURL: 'https://api.siliconflow.cn/v1' },
        deepseek: { model: 'deepseek-chat', baseURL: 'https://api.deepseek.com' },
        qwen: { model: 'qwen-max', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
        custom: { model: '', baseURL: '' }
    };
    const [searchParams] = useSearchParams();
    const { currentProject, chapters, setChapters, pipelineState, setPipelineState, addPipelineLog, clearPipelineLogs, materials, setMaterials } = useAppStore();
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [maxRounds, setMaxRounds] = useState(3);
    const projectMode = currentProject?.mode || 'novel';
    const pipelineSteps = PIPELINE_STEPS[projectMode] || PIPELINE_STEPS.novel;
    const outputTabs = OUTPUT_TABS[projectMode] || OUTPUT_TABS.novel;

    useEffect(() => {
        setMaxRounds(projectMode === 'shuangwen' ? 2 : projectMode === 'tomato-short' ? 2 : 3);
    }, [projectMode]);
    const [reviewLogs, setReviewLogs] = useState([]);
    const [activeOutputTab, setActiveOutputTab] = useState('writerOutput');
    const [outputPaths, setOutputPaths] = useState({});
    const [infiniteStatus, setInfiniteStatus] = useState({ running: false });
    const [infiniteOptions, setInfiniteOptions] = useState({ chaptersPerBatch: 30, maxSupplements: 999, stopAfterChapter: '', maxRounds: 5 });
    const [projectTargets, setProjectTargets] = useState({ targetChapterCount: '', targetWordCount: '' });
    const [contextBudgetInfo, setContextBudgetInfo] = useState(null);
    const [injectionMapInfo, setInjectionMapInfo] = useState(null);
    const [hookBudgetInfo, setHookBudgetInfo] = useState(null);
    const [ruleStackInfo, setRuleStackInfo] = useState(null);
    const [chapterIntentInfo, setChapterIntentInfo] = useState(null);
    const [promptAuditInfo, setPromptAuditInfo] = useState(null);
    const [promptAuditLoading, setPromptAuditLoading] = useState(false);
    const [optimizerReport, setOptimizerReport] = useState(null);
    const [optimizerLoading, setOptimizerLoading] = useState(false);
    const [optimizerApplying, setOptimizerApplying] = useState(null);
    const [chapterAuditData, setChapterAuditData] = useState(null);
    const [chapterAuditLoading, setChapterAuditLoading] = useState(false);
    const [repairingChapter, setRepairingChapter] = useState(null);
    const [repairInstructions, setRepairInstructions] = useState('');
    const [auditPage, setAuditPage] = useState(1);
    const [auditPageSize] = useState(20);
    const [auditFilter, setAuditFilter] = useState('all');
    const [expandedChapter, setExpandedChapter] = useState(null);
    const [repairingChapterId, setRepairingChapterId] = useState(null);
    const [selectedForBatch, setSelectedForBatch] = useState(new Set());
    const [repairResult, setRepairResult] = useState(null);
    const [batchRepairing, setBatchRepairing] = useState(false);
    const [repairModels, setRepairModels] = useState([]);
    const [selectedRepairModel, setSelectedRepairModel] = useState('');
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewResult, setReviewResult] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [batchTaskId, setBatchTaskId] = useState(null);
    const [batchProgress, setBatchProgress] = useState(null);
    const [autoRetryUntilPass, setAutoRetryUntilPass] = useState(false);
    const [followUpPipeline, setFollowUpPipeline] = useState(true);
    const [retryTaskId, setRetryTaskId] = useState(null);
    const [retryProgress, setRetryProgress] = useState(null);
    const [expandedAttempt, setExpandedAttempt] = useState(null);
    const [agentModelConfig, setAgentModelConfig] = useState(null);
    const [testResults, setTestResults] = useState({});
    const [showAgentConfig, setShowAgentConfig] = useState(false);
    const [generateImages, setGenerateImages] = useState(false);
    const [imageAspectRatio, setImageAspectRatio] = useState('16:9');
    const [chapterImages, setChapterImages] = useState([]);
    const [viewVersion, setViewVersion] = useState(null);
    const [chapterFilter, setChapterFilter] = useState('all');
    const [chapterCollapsed, setChapterCollapsed] = useState(false);
    const pollRef = useRef(null);
    const buttonPollRefs = useRef([]);

    useEffect(() => {
        if (currentProject) {
            chapterAuditApi.getModels().then(res => {
                const models = res.data || [];
                setRepairModels(models);
                const def = models.find(m => m.isDefault);
                if (def) setSelectedRepairModel(`${def.provider}|${def.model}`);
            }).catch(() => {});
            chaptersApi.list({ projectId: currentProject.id }).then(res => {
                setChapters(res.data || []);
                const chapterIdParam = searchParams.get('chapterId');
                const chapterNumParam = searchParams.get('chapter');
                if (chapterIdParam) {
                    const found = (res.data || []).find(c => c.id === chapterIdParam);
                    if (found) setSelectedChapter(found);
                } else if (chapterNumParam) {
                    const found = (res.data || []).find(c => c.chapterNumber === parseInt(chapterNumParam));
                    if (found) setSelectedChapter(found);
                }
            }).catch(console.error);
        }
    }, [currentProject, setChapters]);

    useEffect(() => {
        if (currentProject && selectedChapter) {
            pipelineApi.getOutputPaths(currentProject.id, selectedChapter.id)
                .then(res => setOutputPaths(res.data || {}))
                .catch(() => setOutputPaths({}));
        }
    }, [currentProject, selectedChapter?.id]);

    const mapInfiniteLogs = (logs) => logs.map(e => ({
        step: e.step,
        status: e.passed ? 'done' : (e.passed === false ? 'error' : 'running'),
        result: e.passed !== undefined ? { passed: e.passed, feedback: e.feedback } : undefined,
        error: e.error,
        timestamp: e.time || e.timestamp,
        round: e.round,
        chapterNumber: e.chapterNumber,
        msg: e.msg,
        affectedChapter: e.affectedChapter
    }));

    useEffect(() => {
        if (currentProject && infiniteStatus.running) {
            pollRef.current = setInterval(() => {
                pipelineApi.getInfiniteStatus(currentProject.id).then(res => {
                    setInfiniteStatus(res.data || {});
                    if (res.data?.logs?.length > 0) {
                        const syncLogs = mapInfiniteLogs(res.data.logs);
                        setPipelineState({ logs: syncLogs, running: res.data.running, currentStep: res.data.phase });
                    }
                    if (!res.data?.running) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                        if (res.data?.logs?.length > 0) {
                            const finalLogs = mapInfiniteLogs(res.data.logs);
                            setPipelineState({ logs: finalLogs, running: false, currentStep: null });
                        } else {
                            setPipelineState({ running: false, currentStep: null });
                        }
                        chaptersApi.list({ projectId: currentProject.id }).then(res => {
                            const list = res.data || [];
                            setChapters(list);
                            if (selectedChapter?.id) {
                                const updated = list.find(c => c.id === selectedChapter.id);
                                if (updated) setSelectedChapter(updated);
                            }
                        }).catch(console.error);
                    } else if (selectedChapter?.id) {
                        chaptersApi.list({ projectId: currentProject.id }).then(res => {
                            const list = res.data || [];
                            setChapters(list);
                            const updated = list.find(c => c.id === selectedChapter.id);
                            if (updated) setSelectedChapter(updated);
                        }).catch(console.error);
                    }
                }).catch(console.error);
            }, 5000);
            return () => { if (pollRef.current) clearInterval(pollRef.current); };
        }
    }, [currentProject, infiniteStatus.running, selectedChapter?.id, setChapters]);

    useEffect(() => {
        if (currentProject) {
            pipelineApi.getInfiniteStatus(currentProject.id).then(res => setInfiniteStatus(res.data || {})).catch(() => {});
            projectsApi.getAgentModelConfig(currentProject.id).then(res => {
                if (res.data && Object.keys(res.data).length > 0) {
                    setAgentModelConfig(res.data);
                }
            }).catch(() => {});
            if (currentProject.targetChapterCount || currentProject.targetWordCount) {
                setProjectTargets({
                    targetChapterCount: currentProject.targetChapterCount || '',
                    targetWordCount: currentProject.targetWordCount || ''
                });
            }
        }
    }, [currentProject]);

    const startInfinitePipeline = async () => {
        if (!currentProject) {
            alert('请先选择一个项目');
            return;
        }
        try {
            const statusRes = await pipelineApi.getInfiniteStatus(currentProject.id);
            if (statusRes.data?.running) {
                const doReset = confirm('检测到流水线状态异常（显示运行中但可能已中断），是否强制重置后重新启动？');
                if (doReset) {
                    await pipelineApi.resetInfinite({ projectId: currentProject.id });
                    setInfiniteStatus({ running: false });
                } else {
                    return;
                }
            }
            setInfiniteStatus({ running: true, currentChapter: null, completedChapters: 0, logs: [{ time: new Date().toISOString(), msg: '正在启动无限流水线...' }] });
            const res = await pipelineApi.startInfinite({
                projectId: currentProject.id,
                chaptersPerBatch: infiniteOptions.chaptersPerBatch,
                maxSupplements: infiniteOptions.maxSupplements,
                maxRounds: infiniteOptions.maxRounds,
                stopAfterChapter: infiniteOptions.stopAfterChapter ? parseInt(infiniteOptions.stopAfterChapter) : null
            });
            if (res.data?.success || res.success) {
                setInfiniteStatus(prev => ({ ...prev, running: true, logs: [...(prev.logs || []), { time: new Date().toISOString(), msg: '✅无限流水线已启动' }] }));
            } else {
                const errMsg = res.data?.error || res.error || res.data?.message || '服务端未返回成功标识';
                setInfiniteStatus({ running: false });
                alert('启动失败：' + errMsg);
            }
        } catch (e) {
            console.error('startInfinitePipeline error:', e);
            setInfiniteStatus({ running: false });
            const errMsg = e.response?.data?.error || e.response?.data?.message || e.message || '网络请求失败';
            alert('启动无限流水线失败: ' + errMsg);
        }
    };

    const stopInfinitePipeline = async () => {
        if (!currentProject) return;
        try {
            await pipelineApi.stopInfinite({ projectId: currentProject.id });
            setInfiniteStatus({ running: false, stopped: true });
        } catch (e) {
            console.error('stopInfinitePipeline error:', e);
            setInfiniteStatus({ running: false, stopped: true });
        }
    };

    const forceResetPipeline = async () => {
        if (!currentProject) return;
        if (!confirm('确定强制重置流水线状态？这会清除所有运行中的状态')) return;
        try {
            await pipelineApi.resetInfinite({ projectId: currentProject.id });
            setInfiniteStatus({ running: false });
            alert('流水线状态已重置');
        } catch (e) {
            alert('重置失败: ' + e.message);
        }
    };

    const resetChapterContent = async (chapterId, chapterNumber) => {
        if (!currentProject) return;
        if (!confirm(`确定删除{chapterNumber}章的正文？大纲将保留。`)) return;
        try {
            const res = await pipelineApi.resetChapterContent({ projectId: currentProject.id, chapterId });
            if (res.data?.success) {
                alert(res.data.message);
                chaptersApi.list({ projectId: currentProject.id }).then(res => {
                    const list = res.data || [];
                    setChapters(list);
                    if (selectedChapter?.id === chapterId) {
                        const updated = list.find(c => c.id === chapterId);
                        if (updated) setSelectedChapter(updated);
                    }
                });
            }
        } catch (e) {
            alert('重置失败: ' + e.message);
        }
    };

    const resetChaptersBulk = async () => {
        if (!currentProject) return;
        const from = prompt('从第几章开始删除正文？');
        const to = prompt('到第几章结束删除正文？');
        if (!from || !to) return;
        if (!confirm(`确定删除{from}-${to}章的正文？大纲将保留。`)) return;
        try {
            const res = await pipelineApi.resetChaptersBulk({ projectId: currentProject.id, fromChapter: parseInt(from), toChapter: parseInt(to) });
            if (res.data?.success) {
                alert(res.data.message);
                chaptersApi.list({ projectId: currentProject.id }).then(res => {
                    const list = res.data || [];
                    setChapters(list);
                    if (selectedChapter?.id) {
                        const updated = list.find(c => c.id === selectedChapter.id);
                        if (updated) setSelectedChapter(updated);
                    }
                });
            }
        } catch (e) {
            alert('批量重置失败: ' + e.message);
        }
    };

    const runStep = async (step) => {
        if (!currentProject || !selectedChapter) return;
        setPipelineState({ running: true, currentStep: step });
        addPipelineLog({ step, status: 'running', timestamp: new Date().toISOString() });
        try {
            const res = await pipelineApi.runStep({
                projectId: currentProject.id,
                chapterId: selectedChapter.id,
                step,
                round: pipelineState.currentRound || 1,
                context: {}
            });
            addPipelineLog({ step, status: 'done', result: res.data, timestamp: new Date().toISOString() });
            const chRes = await chaptersApi.list({ projectId: currentProject.id });
            setChapters(chRes.data || []);
            const updated = chRes.data?.find(c => c.id === selectedChapter.id);
            if (updated) setSelectedChapter(updated);
            if (step === 'material-manager') {
                const matRes = await materialsApi.list({ projectId: currentProject.id });
                setMaterials(matRes.data || []);
            }
            pipelineApi.getOutputPaths(currentProject.id, selectedChapter.id)
                .then(res => setOutputPaths(res.data || {}))
                .catch(() => {});
        } catch (e) {
            addPipelineLog({ step, status: 'error', error: e.message, timestamp: new Date().toISOString() });
        } finally {
            setPipelineState({ running: false, currentStep: null });
        }
    };

    const runFullPipeline = async () => {
        if (!currentProject) {
            alert('请先选择一个项目');
            return;
        }
        if (!selectedChapter) {
            alert('请先选择一个章节');
            return;
        }
        setPipelineState({ running: true, currentStep: 'full', currentRound: 1 });
        clearPipelineLogs();
        addPipelineLog({ step: 'full-pipeline', status: 'running', message: '正在提交任务...', timestamp: new Date().toISOString() });
        try {
            const res = await pipelineApi.runFull({
                projectId: currentProject.id,
                chapterId: selectedChapter.id,
                maxRounds,
                generateImages,
                imageAspectRatio
            });

            const taskId = res.data?.taskId;
            if (!taskId) {
                const errMsg = res.data?.error || '服务端未返回任务ID，可能流水线启动失败';
                addPipelineLog({ step: 'full-pipeline', status: 'error', error: errMsg, timestamp: new Date().toISOString() });
                alert('本章流水线启动失败：' + errMsg);
                setPipelineState({ running: false, currentStep: null });
                return;
            }

            addPipelineLog({ step: 'full-pipeline', status: 'running', message: `任务已提ID: ${taskId.substring(0,12)})，AI正在写作..`, timestamp: new Date().toISOString() });

            const pollStart = Date.now();
            const MAX_POLL_TIME = 15 * 60 * 1000;
            let pollErrors = 0;
            while (true) {
                if (Date.now() - pollStart > MAX_POLL_TIME) {
                    addPipelineLog({ step: 'full-pipeline', status: 'error', error: '流水线超时(5分钟)', timestamp: new Date().toISOString() });
                    alert('本章流水线超时(15分钟)，请检查服务器状态');
                    break;
                }
                await new Promise(r => setTimeout(r, 3000));
                try {
                    const taskRes = await pipelineApi.getTaskStatus(taskId);
                    const task = taskRes.data;
                    if (!task) {
                        pollErrors++;
                        if (pollErrors > 5) {
                            addPipelineLog({ step: 'full-pipeline', status: 'error', error: '无法获取任务状态', timestamp: new Date().toISOString() });
                            break;
                        }
                        continue;
                    }
                    pollErrors = 0;

                    if (task.status === 'completed') {
                        addPipelineLog({ step: 'full-pipeline', status: 'done', result: task.result, timestamp: new Date().toISOString() });
                        break;
                    } else if (task.status === 'failed') {
                        const failMsg = task.error || task.result?.error || task.result?.message || '流水线执行失败'
                        addPipelineLog({ step: 'full-pipeline', status: 'error', error: failMsg, timestamp: new Date().toISOString() });
                        alert('本章流水线执行失败：' + failMsg);
                        break;
                    } else if (task.progress && typeof task.progress === 'string') {
                        addPipelineLog({ step: 'full-pipeline', status: 'running', message: task.progress, timestamp: new Date().toISOString() });
                    }
                    const elapsed = Math.round((Date.now() - pollStart) / 1000);
                    setPipelineState(s => ({
                        ...s,
                        logs: s.logs.map((l, i) => i === s.logs.length - 1 && l.step === 'full-pipeline' && l.status === 'running'
                            ? { ...l, message: `AI正在写作.. 已用{elapsed}秒`, timestamp: new Date().toISOString() }
                            : l)
                    }));
                } catch (pollErr) {
                    pollErrors++;
                    if (pollErrors > 10) {
                        addPipelineLog({ step: 'full-pipeline', status: 'error', error: `轮询失败(连续${pollErrors}: ${pollErr.message}`, timestamp: new Date().toISOString() });
                        alert('无法获取流水线状态，请检查网络连接');
                        break;
                    }
                }
            }

            try {
                const chRes = await chaptersApi.list({ projectId: currentProject.id });
                setChapters(chRes.data || []);
                const updated = chRes.data?.find(c => c.id === selectedChapter.id);
                if (updated) setSelectedChapter(updated);
            } catch (e) { console.error('刷新章节列表失败:', e); }
            try {
                const matRes = await materialsApi.list({ projectId: currentProject.id });
                setMaterials(matRes.data || []);
            } catch (e) { console.error('刷新素材列表失败:', e); }
            pipelineApi.getOutputPaths(currentProject.id, selectedChapter.id)
                .then(res => setOutputPaths(res.data || {}))
                .catch(() => {});
        } catch (e) {
            console.error('runFullPipeline error:', e);
            const errMsg = e.code === 'ECONNABORTED' ? '请求超时，服务器可能正在处理' :
                          e.response?.data?.error || e.response?.data?.message || e.message || '未知错误';
            const detail = e.response?.status === 403 ? '授权已过期，请检查许可证' :
                          e.response?.status === 404 ? 'API路由不存在，请检查服务器版本' :
                          e.response?.status >= 500 ? '服务器内部错误: ' + errMsg : errMsg;
            addPipelineLog({ step: 'full-pipeline', status: 'error', error: detail, timestamp: new Date().toISOString() });
            alert('本章流水线失败: ' + detail);
        } finally {
            setPipelineState({ running: false, currentStep: null });
        }
    };

    const supplementOutlines = async () => {
        if (!currentProject) return;
        try {
            const res = await pipelineApi.supplementOutlines({
                projectId: currentProject.id,
                supplementCount: infiniteOptions.chaptersPerBatch
            });
            addPipelineLog({ step: 'supplement-outlines', status: 'done', result: res.data, timestamp: new Date().toISOString() });
            const chRes = await chaptersApi.list({ projectId: currentProject.id });
            setChapters(chRes.data || []);
        } catch (e) {
            addPipelineLog({ step: 'supplement-outlines', status: 'error', error: e.message, timestamp: new Date().toISOString() });
        }
    };

    const loadReviews = async (chapterId) => {
        try {
            const res = await reviewsApi.list({ chapterId });
            setReviewLogs(res.data || []);
        } catch (e) { console.error(e); }
    };

    const loadPipelineLogs = async (projectId, chapterId) => {
        try {
            const res = await pipelineApi.getPipelineLogs(projectId, chapterId);
            const entries = res.data?.entries || [];
            if (entries.length > 0 && pipelineState.logs.length === 0) {
                const restoredLogs = entries.map(e => ({
                    step: e.step,
                    status: e.passed ? 'done' : 'error',
                    result: e.passed !== undefined ? { passed: e.passed, feedback: e.feedback } : undefined,
                    error: e.error,
                    timestamp: e.timestamp,
                    round: e.round
                }));
                setPipelineState({ logs: restoredLogs });
            }
        } catch (e) { console.error(e); }
    };

    const loadChapterImages = async () => {
        if (!currentProject) return;
        try {
            const res = await pipelineApi.getImages(currentProject.id);
            setChapterImages(res.data || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (currentProject) loadChapterImages();
    }, [currentProject]);

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            buttonPollRefs.current.forEach(id => clearInterval(id));
            buttonPollRefs.current = [];
        };
    }, []);

    useEffect(() => {
        if (selectedChapter) {
            loadReviews(selectedChapter.id);
            if (currentProject) {
                loadPipelineLogs(currentProject.id, selectedChapter.id);
            }
        }
    }, [selectedChapter?.id]);

    const getStepStatus = (stepKey) => {
        if (!selectedChapter) return 'pending';
        const ch = selectedChapter;
        if (ch.status === 'approved' || ch.status === 'material-updated') return 'done';
        const statusOrder = ['outlined', 'written', 'first-reviewing', 'second-reviewing', 'final-editing', 'approved', 'material-updated'];
        const statusIdx = statusOrder.indexOf(ch.status);
        if (stepKey === 'intent-planner') return ch.intentPlannerOutput ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (stepKey === 'writer') return statusIdx >= 1 ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (stepKey === 'reviser') return ch.reviserOutput ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (stepKey === 'first-review' || stepKey === 'fast-review') return statusIdx >= 2 ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (stepKey === 'second-review') return statusIdx >= 3 ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (stepKey === 'final-editor') return statusIdx >= 4 ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (stepKey === 'polisher') return ch.polisherOutput ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (stepKey === 'material-manager') return ch.status === 'material-updated' ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (stepKey === 'reader') return ch.readerOutput ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (stepKey === 'adjuster') return ch.adjusterOutput ? 'done' : (pipelineState.currentStep === stepKey ? 'active' : 'pending');
        if (pipelineState.currentStep === stepKey) return 'active';
        return 'pending';
    };

    const isStepOutputVisible = (outputKey) => {
        if (!selectedChapter) return false;
        const ch = selectedChapter;
        if (ch.status === 'approved' || ch.status === 'material-updated') return true;
        const statusOrder = ['outlined', 'written', 'first-reviewing', 'second-reviewing', 'final-editing'];
        const statusIdx = statusOrder.indexOf(ch.status);
        if (outputKey === 'intentPlannerOutput') return statusIdx >= 0;
        if (outputKey === 'writerOutput') return statusIdx >= 1;
        if (outputKey === 'reviserOutput') return !!ch.reviserOutput;
        if (outputKey === 'firstReviewOutput') return statusIdx >= 2;
        if (outputKey === 'secondReviewOutput') return statusIdx >= 3;
        if (outputKey === 'finalEditorOutput') return statusIdx >= 4;
        if (outputKey === 'materialManagerOutput') return ch.status === 'material-updated';
        return true;
    };

    const getDisplayData = () => {
        if (!selectedChapter) return { content: '暂无输出', output: '暂无输出' };
        if (viewVersion !== null && selectedChapter.history?.[viewVersion]) {
            const snap = selectedChapter.history[viewVersion];
            const outputKey = activeOutputTab;
            return {
                content: snap.content || '暂无内容',
                output: snap[outputKey] || '暂无输出'
            };
        }
        if (!isStepOutputVisible(activeOutputTab)) {
            return {
                content: selectedChapter.content || '暂无内容',
                output: '⏳ 该步骤尚未执行，等待上游步骤完成'
            };
        }
        let output = selectedChapter[activeOutputTab] || '';
        if (!output && activeOutputTab === 'intentPlannerOutput') {
            const intentLogs = pipelineState.logs.filter(l => l.step === 'intent-planner' && (l.chapterNumber === selectedChapter.chapterNumber || !l.chapterNumber));
            if (intentLogs.length > 0) {
                const parts = intentLogs.map(l => l.msg || '').filter(Boolean);
                output = parts.join('\n\n') || '意图规划已执行，但输出数据未保存到章节数据中。';
            } else {
                output = '意图规划尚未执行或数据未同步。';
            }
        }
        if (!output && activeOutputTab === 'reviserOutput') {
            const reviserLogsAll = pipelineState.logs.filter(l => l.step === 'reviser');
            const reviserLogsAffected = reviserLogsAll.filter(l => l.affectedChapter);
            const reviserReviews = reviewLogs.filter(r => r.type === 'reviser' || r.step === 'reviser');
            if (reviserLogsAffected.length > 0) {
                const affectedChapters = [...new Set(reviserLogsAffected.map(l => l.affectedChapter))];
                const currentChapterAffected = affectedChapters.includes(selectedChapter.chapterNumber);
                if (currentChapterAffected) {
                    const latestReview = reviserReviews.sort((a, b) => (b.round || 0) - (a.round || 0))[0];
                    output = latestReview?.content || '返修员已执行修改，但输出数据可能尚未同步。请稍后刷新页面查看。';
                } else {
                    output = `返修员在本章未执行修改。\n\n本次流水线中，返修员修改了以下章节：\n${affectedChapters.map(ch => `- 第${ch}章`).join('\n')}\n\n请切换到对应章节查看返修员输出详情。`;
                }
            } else if (reviserReviews.length > 0) {
                const latestReview = reviserReviews.sort((a, b) => (b.round || 0) - (a.round || 0))[0];
                if (latestReview?.content && latestReview.content !== '返修员返回空响应，保留原文') {
                    output = latestReview.content;
                } else {
                    output = '返修员已执行，但输出详情未保存到章节数据中。返修员的修改已合并到最终正文中。';
                }
            } else if (reviserLogsAll.length > 0) {
                output = '返修员已执行，但输出详情未保存到章节数据中。返修员的修改已合并到最终正文中。';
            } else {
                output = '本章未触发返修员修改。返修员仅在初审/复审未通过且字数达标时，或阅读者发现跨章节硬伤时执行。';
            }
        }
        return {
            content: selectedChapter.content || '暂无内容',
            output
        };
    };

    const completedChapters = chapters.filter(ch => ch.content).length;

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">流水线控制台</h1>
                        <p className="page-subtitle">
                            {projectMode === 'shuangwen'
                                ? '爽文模式 - 意图规划→爽文执笔→快审→定稿→润色→素材更新'
                                : projectMode === 'tomato-short'
                                    ? '🍅 番茄爽文模式 - 意图规划→番茄执笔→番茄快审→定稿→润色→素材更新(1900-2100 对话8%)'
                                    : '管理小说创作自动化流水线 - 意图规划→执笔人→初审→复审→定稿→润色→素材更新'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {infiniteStatus.running ? (
                            <>
                                <button className="cyber-btn" style={{ background: 'var(--neon-red)', borderColor: 'var(--neon-red)', color: '#fff' }} onClick={stopInfinitePipeline}>
                                    <span className="cyber-loading"></span> 停止无限流水线...
                                </button>
                                <button className="cyber-btn cyber-btn-sm" onClick={forceResetPipeline} title="流水线卡住时使用">
                                    🔄 强制重置
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="cyber-btn cyber-btn-primary" onClick={startInfinitePipeline} disabled={!currentProject}>
                                    启动无限流水线
                                </button>
                                <button className="cyber-btn cyber-btn-sm" onClick={resetChaptersBulk} disabled={!currentProject} title="删除正文但保留大纲，可重新运行流水线">
                                    🗑 批量删除正文
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {infiniteStatus.running && (
                <div className="cyber-card" style={{ marginBottom: 20, borderColor: 'var(--neon-green)', background: 'rgba(0, 255, 100, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span className="cyber-loading" style={{ marginRight: 8 }}></span>
                            <span style={{ color: 'var(--neon-green)', fontWeight: 700 }}>无限流水线运行中</span>
                            {infiniteStatus.phase && <span style={{ marginLeft: 12, color: 'var(--neon-yellow)', fontWeight: 600 }}>[{infiniteStatus.phase}]</span>}
                            {infiniteStatus.batchProgress && <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>{infiniteStatus.batchProgress}</span>}
                            {infiniteStatus.currentChapter && <span style={{ marginLeft: 12, color: 'var(--text-secondary)' }}>当前: 第{infiniteStatus.currentChapter}章</span>}
                            {infiniteStatus.completedChapters > 0 && <span style={{ marginLeft: 12, color: 'var(--neon-blue)' }}>已完成{infiniteStatus.completedChapters}章</span>}
                        </div>
                        <button className="cyber-btn cyber-btn-sm" style={{ background: 'var(--neon-red)', color: '#fff' }} onClick={stopInfinitePipeline}>停止</button>
                    </div>
                    {infiniteStatus.logs?.length > 0 && (
                        <div style={{ marginTop: 8, maxHeight: 100, overflow: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {infiniteStatus.logs.map((log, i) => (
                                <div key={i}>{formatTime(log.time)} {log.msg}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {!currentProject ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">📖</div>
                    <div>请先在仪表盘选择一个项目</div>
                </div>
            ) : (
                <>
                    <div className="cyber-section-title">无限流水线设置</div>
                    <div className="cyber-card" style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label className="form-label" style={{ margin: 0, color: '#F39C12' }}>🎯 目标章数</label>
                                <input className="cyber-input" type="number" value={projectTargets.targetChapterCount} onChange={e => setProjectTargets(p => ({ ...p, targetChapterCount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="如 200" style={{ width: 80 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label className="form-label" style={{ margin: 0, color: '#F39C12' }}>🎯 目标字数</label>
                                <input className="cyber-input" type="number" value={projectTargets.targetWordCount} onChange={e => setProjectTargets(p => ({ ...p, targetWordCount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="如 1000000" style={{ width: 100 }} />
                            </div>
                            <button className="cyber-btn" onClick={async () => {
                                if (!currentProject) return;
                                try {
                                    await projectsApi.saveTargets(currentProject.id, {
                                        targetChapterCount: projectTargets.targetChapterCount ? parseInt(projectTargets.targetChapterCount) : null,
                                        targetWordCount: projectTargets.targetWordCount ? parseInt(projectTargets.targetWordCount) : null
                                    });
                                    alert('目标已保存');
                                } catch (e) { alert('保存失败: ' + e.message); }
                            }} style={{ fontSize: 12, borderColor: '#F39C12', color: '#F39C12' }}>💾 保存目标</button>
                            <span style={{ color: '#555', fontSize: 11 }}>达到目标后自动停止并规划结局</span>
                        </div>
                    </div>
                    <div className="cyber-card" style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label className="form-label" style={{ margin: 0 }}>每次补充章数:</label>
                                <input className="cyber-input" type="number" value={infiniteOptions.chaptersPerBatch} onChange={e => setInfiniteOptions(p => ({ ...p, chaptersPerBatch: parseInt(e.target.value) || 30 }))} min={1} max={60} style={{ width: 60 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label className="form-label" style={{ margin: 0 }}>最大审核轮次</label>
                                <input className="cyber-input" type="number" value={infiniteOptions.maxRounds} onChange={e => setInfiniteOptions(p => ({ ...p, maxRounds: parseInt(e.target.value) || 5 }))} min={1} max={10} style={{ width: 60 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label className="form-label" style={{ margin: 0 }}>最大补充次数</label>
                                <input className="cyber-input" type="number" value={infiniteOptions.maxSupplements} onChange={e => setInfiniteOptions(p => ({ ...p, maxSupplements: parseInt(e.target.value) || 999 }))} min={1} max={9999} style={{ width: 60 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label className="form-label" style={{ margin: 0 }}>停止章节号</label>
                                <input className="cyber-input" type="number" value={infiniteOptions.stopAfterChapter} onChange={e => setInfiniteOptions(p => ({ ...p, stopAfterChapter: e.target.value }))} placeholder="不限" style={{ width: 80 }} />
                            </div>
                            <button className="cyber-btn" onClick={supplementOutlines} disabled={infiniteStatus.running}>
                                手动补充大纲
                            </button>
                            <button className="cyber-btn" onClick={async () => {
                                if (!currentProject) return;
                                const emptyMatChapters = chapters.filter(ch => (ch.status === 'approved' || ch.status === 'material-updated') && ch.content && (!ch.materialManagerOutput || ch.materialManagerOutput === ''));
                                if (emptyMatChapters.length === 0) {
                                    alert('所有已通过章节都有素材管理输出，无需补跑');
                                    return;
                                }
                                if (!confirm(`将为 ${emptyMatChapters.length} 个缺少素材输出的章节重新运行素材管理员，确认？`)) return;
                                try {
                                    const res = await pipelineApi.rerunMaterialManager(currentProject.id);
                                    addPipelineLog({ step: 'rerun-material-manager', status: 'started', result: res.data, timestamp: new Date().toISOString() });
                                    alert(`已启动素材管理员补跑，共 ${emptyMatChapters.length} 章`);
                                } catch (e) {
                                    addPipelineLog({ step: 'rerun-material-manager', status: 'error', error: e.message, timestamp: new Date().toISOString() });
                                }
                            }} disabled={infiniteStatus.running}>
                                🔄 补跑素材管理
                            </button>
                            <button className="cyber-btn" onClick={async () => {
                                if (!currentProject) return;
                                try {
                                    const res = await pipelineApi.getContextBudget(currentProject.id);
                                    setContextBudgetInfo(res.data || res);
                                } catch (e) { console.error(e); }
                            }}>
                                📊 计算上下文容
                            </button>
                            <button className="cyber-btn" onClick={async () => {
                                if (!currentProject) return;
                                try {
                                    const res = await pipelineApi.getOutlineInjectionMap(currentProject.id);
                                    setInjectionMapInfo(res.data || res);
                                } catch (e) { console.error(e); }
                            }}>
                                🗺️ 注入层级表
                            </button>
                            <button className="cyber-btn" onClick={async () => {
                                const name = prompt('次位面名称（如：锈蚀王庭）');
                                if (!name) return;
                                const type = prompt('类型（规则怪谈类/文明类/动漫类/抽象概念类）', '规则怪谈类');
                                if (!type) return;
                                const ip = prompt('IP参考（可选，如：寂静岭/黑客帝国）', '');
                                const vol = prompt('分配到第几卷？', '1');
                                if (!confirm(`确认生成次位面「${name}」(${type})的素材包？`)) return;
                                try {
                                    const res = await pipelineApi.generateSubplaneMaterials({
                                        projectId: currentProject.id,
                                        subplaneName: name,
                                        subplaneType: type,
                                        ipReference: ip || '',
                                        volumeNumber: parseInt(vol) || 1
                                    });
                                    alert(`生成成功！共${res.data?.count || 0}个素材\n` + (res.data?.createdMaterials || []).map(m => `[${m.type}] ${m.name}`).join('\n'));
                                    const mapRes = await pipelineApi.getOutlineInjectionMap(currentProject.id);
                                    setInjectionMapInfo(mapRes.data || mapRes);
                                } catch (e) {
                                    alert('生成失败: ' + (e.response?.data?.error || e.message));
                                }
                            }}>
                                🧪 生成次位面素材
                            </button>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                已完 {completedChapters}/{chapters.length} | 大纲待写: {chapters.filter(ch => ch.status === 'outlined').length}
                            </span>
                        </div>
                        {contextBudgetInfo && (
                            <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontWeight: 700, color: 'var(--neon-blue)' }}>📐 上下文容量分析{contextBudgetInfo.model}</span>
                                    <button className="cyber-btn cyber-btn-sm" onClick={() => setContextBudgetInfo(null)} style={{ fontSize: 10 }}></button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
                                    <div style={{ padding: '6px 10px', background: 'rgba(0,255,100,0.08)', borderRadius: 6, border: '1px solid rgba(0,255,100,0.2)' }}>
                                        <div style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: 20 }}>{contextBudgetInfo.recommendedMax}</div>
                                        <div style={{ color: 'var(--text-muted)' }}>推荐批量章数</div>
                                    </div>
                                    <div style={{ padding: '6px 10px', background: 'rgba(255,165,0,0.08)', borderRadius: 6, border: '1px solid rgba(255,165,0,0.2)' }}>
                                        <div style={{ color: 'var(--neon-orange)', fontWeight: 700, fontSize: 20 }}>{contextBudgetInfo.safeMax}</div>
                                        <div style={{ color: 'var(--text-muted)' }}>安全上限</div>
                                    </div>
                                    <div style={{ padding: '6px 10px', background: 'rgba(0,150,255,0.08)', borderRadius: 6, border: '1px solid rgba(0,150,255,0.2)' }}>
                                        <div style={{ color: 'var(--neon-blue)', fontWeight: 700, fontSize: 20 }}>{contextBudgetInfo.maxChapters}</div>
                                        <div style={{ color: 'var(--text-muted)' }}>理论极限</div>
                                    </div>
                                    <div style={{ padding: '6px 10px', background: 'rgba(150,0,255,0.08)', borderRadius: 6, border: '1px solid rgba(150,0,255,0.2)' }}>
                                        <div style={{ color: 'var(--neon-purple)', fontWeight: 700, fontSize: 14 }}>{(contextBudgetInfo.totalBudget / 1000).toFixed(0)}k</div>
                                        <div style={{ color: 'var(--text-muted)' }}>总上下文</div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                                    <span>固定开销: {contextBudgetInfo.fixedCost.toLocaleString()} tokens ({Object.entries(contextBudgetInfo.fixedBreakdown).filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(', ')})</span>
                                    <span>每章开销: {contextBudgetInfo.perChapterTotal.toLocaleString()} tokens (输入{contextBudgetInfo.perChapterInput} + 输出{contextBudgetInfo.perChapterOutput})</span>
                                    <span>可用章节空间: {contextBudgetInfo.availableForChapters.toLocaleString()} tokens</span>
                                    <span>素材: 世界观{contextBudgetInfo.worldviewMatCount} | 角色{contextBudgetInfo.characterMatCount} | 其他{contextBudgetInfo.otherMatCount}</span>
                                </div>
                            </div>
                        )}
                        {injectionMapInfo && (
                            <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontWeight: 700, color: 'var(--neon-cyan)' }}>🗺️ 大纲注入层级关系表 <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(点击🔒/🔓手动切换)</span></span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="cyber-btn cyber-btn-sm" onClick={async () => {
                                            if (!currentProject) return;
                                            try {
                                                const res = await pipelineApi.getOutlineInjectionMap(currentProject.id);
                                                setInjectionMapInfo(res.data || res);
                                            } catch (e) { console.error(e); }
                                        }} style={{ fontSize: 10 }}>🔄刷新</button>
                                        <button className="cyber-btn cyber-btn-sm" onClick={() => setInjectionMapInfo(null)} style={{ fontSize: 10 }}>✕</button>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
                                    <div style={{ padding: '6px 10px', background: 'rgba(0,200,255,0.08)', borderRadius: 6, border: '1px solid rgba(0,200,255,0.2)' }}>
                                        <div style={{ color: 'var(--neon-cyan)', fontWeight: 700, fontSize: 18 }}>第{injectionMapInfo.currentVolume}卷</div>
                                        <div style={{ color: 'var(--text-muted)' }}>当前卷</div>
                                    </div>
                                    <div style={{ padding: '6px 10px', background: 'rgba(0,255,100,0.08)', borderRadius: 6, border: '1px solid rgba(0,255,100,0.2)' }}>
                                        <div style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: 18 }}>{injectionMapInfo.currentVolumeSubplane?.name || '无'}</div>
                                        <div style={{ color: 'var(--text-muted)' }}>当前卷次位面</div>
                                    </div>
                                    <div style={{ padding: '6px 10px', background: 'rgba(255,165,0,0.08)', borderRadius: 6, border: '1px solid rgba(255,165,0,0.2)' }}>
                                        <div style={{ color: 'var(--neon-orange)', fontWeight: 700, fontSize: 18 }}>{injectionMapInfo.injectedMaterialsCount}/{injectionMapInfo.totalMaterialsCount}</div>
                                        <div style={{ color: 'var(--text-muted)' }}>注入/总素材</div>
                                    </div>
                                    <div style={{ padding: '6px 10px', background: 'rgba(150,0,255,0.08)', borderRadius: 6, border: '1px solid rgba(150,0,255,0.2)' }}>
                                        <div style={{ color: 'var(--neon-purple)', fontWeight: 700, fontSize: 18 }}>{injectionMapInfo.existingChapterCount}章</div>
                                        <div style={{ color: 'var(--text-muted)' }}>已完成</div>
                                    </div>
                                </div>
                                {injectionMapInfo.debug && (
                                    <div style={{ marginBottom: 10, padding: 8, background: 'rgba(0,100,200,0.06)', borderRadius: 6, border: '1px solid rgba(0,100,200,0.15)', fontSize: 11 }}>
                                        <div style={{ fontWeight: 700, color: 'var(--neon-blue)', marginBottom: 4 }}>🔍 可见性决策调试</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, color: 'var(--text-secondary)' }}>
                                            <span>总素材: {injectionMapInfo.debug.totalMaterials}</span>
                                            <span>过滤后: {injectionMapInfo.debug.filteredMaterials}</span>
                                            <span>移除: {injectionMapInfo.debug.removedMaterials}</span>
                                            <span>次位面总数: {injectionMapInfo.debug.subplaneCount}</span>
                                            <span style={{ color: 'var(--neon-green)' }}>解锁: {injectionMapInfo.debug.unlockedSubplanes?.join(', ') || '无'}</span>
                                            <span style={{ color: 'var(--neon-red)' }}>锁定: {injectionMapInfo.debug.lockedSubplanes?.join(', ') || '无'}</span>
                                        </div>
                                    </div>
                                )}
                                {injectionMapInfo.orphanChildren?.length > 0 && (
                                    <div style={{ marginBottom: 10, padding: 8, background: 'rgba(255,50,50,0.1)', borderRadius: 6, border: '1px solid rgba(255,50,50,0.3)' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--neon-red)', marginBottom: 4 }}>⚠️ 孤儿素材（parentPlane无法匹配次位面）</div>
                                        {injectionMapInfo.orphanChildren.map(c => (
                                            <div key={c.id} style={{ fontSize: 11, padding: '2px 6px', margin: '2px 0', background: 'rgba(255,50,50,0.05)', borderRadius: 4 }}>
                                                <span style={{ color: 'var(--neon-red)' }}>{c.name}</span>
                                                <span style={{ color: 'var(--text-muted)' }}> [{c.type}] parentPlane="{c.parentPlane}" → {c.issue}</span>
                                                <span style={{ marginLeft: 6, color: c.willBeInjected ? 'var(--neon-green)' : 'var(--neon-red)' }}>{c.willBeInjected ? '⚠️会注入' : '🚫已过滤'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <table className="cyber-table" style={{ fontSize: 11 }}>
                                    <thead>
                                        <tr>
                                            <th>卷</th>
                                            <th>次位面</th>
                                            <th>锁定</th>
                                            <th>注入</th>
                                            <th>角色/势力/道具</th>
                                            <th>parentPlane匹配</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ background: 'rgba(0,255,100,0.05)' }}>
                                            <td>-</td>
                                            <td style={{ color: 'var(--neon-green)', fontWeight: 700 }}>主世界</td>
                                            <td>-</td>
                                            <td style={{ color: 'var(--neon-green)' }}>✅</td>
                                            <td>{injectionMapInfo.mainWorldCharacters.map(c => (
                                                <span key={c.id} style={{ display: 'inline-block', margin: '1px 3px', padding: '1px 5px', background: 'rgba(0,255,100,0.1)', borderRadius: 3, fontSize: 10 }}>{c.name}</span>
                                            ))}</td>
                                            <td style={{ color: 'var(--text-muted)' }}>主世界</td>
                                            <td>-</td>
                                        </tr>
                                        {injectionMapInfo.subplanes.sort((a, b) => (a.assignedVolume || 99) - (b.assignedVolume || 99)).map(sp => (
                                            <tr key={sp.id} style={{ background: sp.isCurrentVolume ? 'rgba(0,200,255,0.08)' : sp.isLocked ? 'rgba(255,50,50,0.03)' : 'transparent' }}>
                                                <td style={{ fontWeight: sp.isCurrentVolume ? 700 : 400, color: sp.isCurrentVolume ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
                                                    {sp.assignedVolume ? `V${sp.assignedVolume}` : '-'}
                                                </td>
                                                <td style={{ fontWeight: 700, color: sp.isCurrentVolume ? 'var(--neon-cyan)' : sp.isLocked ? 'var(--neon-red)' : 'var(--text-secondary)' }}>
                                                    {sp.isCurrentVolume && '▶ '}{sp.name}
                                                </td>
                                                <td>
                                                    <span
                                                        style={{ cursor: 'pointer', color: sp.isLocked ? 'var(--neon-red)' : 'var(--neon-green)', fontSize: 14 }}
                                                        onClick={async () => {
                                                            if (!currentProject) return;
                                                            try {
                                                                await pipelineApi.toggleMaterialLock({ materialId: sp.id, isLocked: !sp.isLocked });
                                                                const res = await pipelineApi.getOutlineInjectionMap(currentProject.id);
                                                                setInjectionMapInfo(res.data || res);
                                                            } catch (e) { alert('操作失败: ' + e.message); }
                                                        }}
                                                        title={sp.isLocked ? '点击解锁' : '点击锁定'}
                                                    >{sp.isLocked ? '🔒' : '🔓'}</span>
                                                </td>
                                                <td style={{ color: sp.willBeInjected ? 'var(--neon-green)' : 'var(--neon-red)' }}>{sp.willBeInjected ? '✅' : '🚫'}</td>
                                                <td>{sp.children.length > 0 ? sp.children.map(c => (
                                                    <span key={c.id} style={{ display: 'inline-block', margin: '1px 3px', padding: '1px 5px', background: c.willBeInjected ? 'rgba(0,255,100,0.1)' : 'rgba(255,50,50,0.1)', borderRadius: 3, fontSize: 10, color: c.willBeInjected ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                                                        {c.name}
                                                    </span>
                                                )) : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                                                <td style={{ fontSize: 10 }}>
                                                    {sp.children.length > 0 ? [...new Set(sp.children.map(c => c.parentPlaneMatch))].map(m => (
                                                        <span key={m} style={{ display: 'inline-block', margin: '1px 2px', padding: '0 4px', background: m === 'id匹配' ? 'rgba(0,255,100,0.15)' : m === 'name匹配' ? 'rgba(255,165,0,0.15)' : m === '短名匹配' ? 'rgba(255,255,0,0.15)' : 'rgba(255,50,50,0.15)', borderRadius: 3, color: m === '不匹配' ? 'var(--neon-red)' : 'var(--text-secondary)' }}>{m}</span>
                                                    )) : '-'}
                                                </td>
                                                <td>
                                                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 9, padding: '2px 6px' }} onClick={async () => {
                                                        if (!currentProject) return;
                                                        if (!confirm(`确认将第${sp.assignedVolume || injectionMapInfo.currentVolume}卷切换到「${sp.name}？\n这将锁定其他所有次位面并解锁此位面。`)) return;
                                                        try {
                                                            await pipelineApi.setVolumeSubplane({
                                                                projectId: currentProject.id,
                                                                volumeNumber: sp.assignedVolume || injectionMapInfo.currentVolume,
                                                                subplaneId: sp.id
                                                            });
                                                            const res = await pipelineApi.getOutlineInjectionMap(currentProject.id);
                                                            setInjectionMapInfo(res.data || res);
                                                        } catch (e) { alert('切换失败: ' + e.message); }
                                                    }}>设为当前</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ marginTop: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <button className="cyber-btn cyber-btn-sm" onClick={async () => {
                                    if (!currentProject) return;
                                    if (!showAgentConfig) {
                                        try {
                                            const res = await projectsApi.getAgentModelConfig(currentProject.id);
                                            setAgentModelConfig(res.data || {});
                                        } catch (e) { console.error(e); }
                                    }
                                    setShowAgentConfig(!showAgentConfig);
                                }} style={{ fontSize: 11 }}>
                                    ⚙️ Agent API 配置 {showAgentConfig ? '▲' : '▼'}
                                </button>
                                {agentModelConfig && <span style={{ color: '#ffffff', fontSize: 11 }}>已配{Object.keys(agentModelConfig).length}个步骤</span>}
                            </div>
                            {showAgentConfig && (
                                <div style={{ padding: 16, background: 'transparent', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', fontSize: 13 }}>
                                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>⚙️ Agent API 配置 每个步骤可独立设置模</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                                        {[
                                            { step: 'writer', label: '执笔人', defaultProvider: 'aliyunCoding', defaultModel: 'qwen3.6-plus' },
                                            { step: 'reviser', label: '返修员', defaultProvider: 'minimax', defaultModel: 'MiniMax-M2.7' },
                                            { step: 'intent-planner', label: '意图规划', defaultProvider: 'minimax', defaultModel: 'MiniMax-M2.7' },
                                            { step: 'first-review', label: '初审', defaultProvider: 'minimax', defaultModel: 'MiniMax-M2.7' },
                                            { step: 'second-review', label: '复审', defaultProvider: 'minimax', defaultModel: 'MiniMax-M2.7' },
                                            { step: 'final-editor', label: '定稿人', defaultProvider: 'minimax', defaultModel: 'MiniMax-M2.7' },
                                            { step: 'material-manager', label: '素材管理员', defaultProvider: 'minimax', defaultModel: 'MiniMax-M2.7' },
                                            { step: 'polisher', label: '润色师', defaultProvider: 'minimax', defaultModel: 'MiniMax-M2.7' },
                                            { step: 'fast-review', label: '快审', defaultProvider: 'minimax', defaultModel: 'MiniMax-M2.7' },
                                            { step: 'reader', label: '阅读者', defaultProvider: 'lmstudio', defaultModel: '' },
                                            { step: 'adjuster', label: '调整员', defaultProvider: 'lmstudio', defaultModel: '' }
                                        ].map(({ step, label, defaultProvider, defaultModel }) => {
                                            const cfg = agentModelConfig?.[step] || {};
                                            const testResult = testResults[step];
                                            return (
                                                <div key={step} style={{ display: 'grid', gridTemplateColumns: '200px 130px 1fr 1fr 1fr 80px 80px', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'rgba(30,30,50,0.5)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <span style={{ color: '#ff9f43', fontWeight: 700, fontSize: 13 }}>{label}<span style={{ color: '#d5d5d5', fontSize: 11, fontWeight: 400, marginLeft: 6 }}>{cfg.model || defaultModel || '未指定'}</span></span>
                                                    <select value={cfg.provider || defaultProvider} onChange={e => {
                                                        const newProvider = e.target.value;
                                                        const defaults = PROVIDER_DEFAULTS[newProvider] || {};
                                                        const newCfg = { ...agentModelConfig };
                                                        newCfg[step] = {
                                                            ...newCfg[step],
                                                            provider: newProvider,
                                                            model: defaults.model || '',
                                                            baseURL: defaults.baseURL || '',
                                                            apiKey: ''
                                                        };
                                                        setAgentModelConfig({ ...newCfg });
                                                    }} style={{ background: '#1a1a2e', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}>
                                                        <option value="lmstudio">LM Studio</option>
                                                        <option value="minimax">MiniMax</option>
                                                        <option value="aliyunCoding">阿里云百炼(Coding Plan)</option>
                                                        <option value="siliconflow">硅基流动</option>
                                                        <option value="deepseek">DeepSeek</option>
                                                        <option value="qwen">通义千问</option>
                                                        <option value="custom">自定义</option>
                                                    </select>
                                                    <input placeholder="API Key" value={cfg.apiKey || ''} onChange={e => {
                                                        const newCfg = { ...agentModelConfig };
                                                        newCfg[step] = { ...newCfg[step], apiKey: e.target.value };
                                                        setAgentModelConfig({ ...newCfg });
                                                    }} style={{ background: '#1a1a2e', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 8px', fontSize: 12, width: '100%' }} />
                                                    <input placeholder="模型名称" value={cfg.model || ''} onChange={e => {
                                                        const newCfg = { ...agentModelConfig };
                                                        newCfg[step] = { ...newCfg[step], model: e.target.value };
                                                        setAgentModelConfig({ ...newCfg });
                                                    }} style={{ background: '#1a1a2e', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 8px', fontSize: 12, width: '100%' }} />
                                                    <input placeholder="Base URL (可选)" value={cfg.baseURL || ''} onChange={e => {
                                                        const newCfg = { ...agentModelConfig };
                                                        newCfg[step] = { ...newCfg[step], baseURL: e.target.value };
                                                        setAgentModelConfig({ ...newCfg });
                                                    }} style={{ background: '#1a1a2e', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 8px', fontSize: 12, width: '100%' }} />
                                                    <button className="cyber-btn cyber-btn-sm" onClick={async () => {
                                                        const c = agentModelConfig?.[step] || { provider: defaultProvider };
                                                        if (!c.provider) c.provider = defaultProvider;
                                                        if (!c.model) c.model = defaultModel;
                                                        c.agentLabel = label;
                                                        setTestResults(prev => ({ ...prev, [step]: { testing: true } }));
                                                        try {
                                                            const res = await projectsApi.testConnection(c);
                                                            setTestResults(prev => ({ ...prev, [step]: res.data }));
                                                        } catch (e) {
                                                            setTestResults(prev => ({ ...prev, [step]: { success: false, message: e.message } }));
                                                        }
                                                    }} style={{ fontSize: 10 }}>
                                                        {testResult?.testing ? '...' : '测试'}
                                                    </button>
                                                    <span title={testResult?.message} style={{ fontSize: 11, color: testResult?.success ? '#2ed573' : testResult?.success === false ? '#ff6b6b' : '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {testResult?.success ? `✅ ${testResult.message || '成功'}` : testResult?.success === false ? `❌ ${testResult.message || '失败'}` : testResult?.testing ? '⏳ 测试中...' : '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {testResults && Object.values(testResults).some(r => r?.message) && (
                                        <div style={{ marginTop: 10, padding: 10, background: 'rgba(30,30,50,0.5)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', maxHeight: 120, overflow: 'auto', fontSize: 11 }}>
                                            {Object.entries(testResults).filter(([,r]) => r?.message).map(([step, r]) => (
                                                <div key={step} style={{ color: r.success ? '#2ed573' : '#ff6b6b', marginBottom: 2 }}>
                                                    {step}: {r.message.substring(0, 80)}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                        <button className="cyber-btn" onClick={async () => {
                                            if (!currentProject) return;
                                            try {
                                                await projectsApi.saveAgentModelConfig(currentProject.id, agentModelConfig);
                                                alert('Agent API 配置已保存');
                                            } catch (e) { alert('保存失败: ' + e.message); }
                                        }} style={{ fontSize: 12 }}>💾 保存配置</button>
                                        <button className="cyber-btn" onClick={async () => {
                                            if (!currentProject) return;
                                            const steps = ['writer', 'reviser', 'intent-planner', 'first-review', 'second-review', 'final-editor', 'material-manager', 'polisher', 'fast-review', 'reader', 'adjuster'];
                                            for (const step of steps) {
                                                const c = agentModelConfig?.[step] || { provider: step === 'writer' ? 'lmstudio' : 'minimax' };
                                                setTestResults(prev => ({ ...prev, [step]: { testing: true } }));
                                                try {
                                                    const res = await projectsApi.testConnection(c);
                                                    setTestResults(prev => ({ ...prev, [step]: res.data }));
                                                } catch (e) {
                                                    setTestResults(prev => ({ ...prev, [step]: { success: false, message: e.message } }));
                                                }
                                            }
                                        }} style={{ fontSize: 12 }}>🧪 全部测试</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={{ padding: 14, background: 'transparent', borderRadius: 8, border: '1px solid rgba(255,165,0,0.3)', fontSize: 13 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <span style={{ fontWeight: 700, color: '#ff9f43', fontSize: 14 }}>🪝 伏笔预算 (Hook Budget)</span>
                                    <button className="cyber-btn cyber-btn-sm" onClick={async () => {
                                        if (!currentProject) return;
                                        try {
                                            const chNum = selectedChapter?.chapterNumber || chapters.filter(c => c.content).length || 0;
                                            const res = await pipelineApi.getHookBudget(currentProject.id, chNum);
                                            setHookBudgetInfo(res.data);
                                        } catch (e) { console.error(e); }
                                    }} style={{ fontSize: 10 }}>刷新</button>
                                </div>
                                {hookBudgetInfo ? (
                                    <div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                                            <div style={{ padding: '8px 10px', background: hookBudgetInfo.budget.overCapacity ? 'rgba(255,50,50,0.2)' : hookBudgetInfo.budget.nearCapacity ? 'rgba(255,165,0,0.15)' : 'rgba(50,255,100,0.1)', borderRadius: 6, border: `1px solid ${hookBudgetInfo.budget.overCapacity ? 'rgba(255,80,80,0.5)' : hookBudgetInfo.budget.nearCapacity ? 'rgba(255,165,0,0.4)' : 'rgba(50,255,100,0.3)'}` }}>
                                                <div style={{ color: hookBudgetInfo.budget.overCapacity ? '#ff6b6b' : hookBudgetInfo.budget.nearCapacity ? '#ffa502' : '#2ed573', fontWeight: 700, fontSize: 22 }}>{hookBudgetInfo.budget.activeCount}/{hookBudgetInfo.budget.maxCapacity}</div>
                                                <div style={{ color: '#ffffff', fontSize: 11, marginTop: 2 }}>活跃伏笔</div>
                                            </div>
                                            <div style={{ padding: '8px 10px', background: 'rgba(50,150,255,0.12)', borderRadius: 6, border: '1px solid rgba(50,150,255,0.3)' }}>
                                                <div style={{ color: '#54a0ff', fontWeight: 700, fontSize: 22 }}>{hookBudgetInfo.budget.remaining}</div>
                                                <div style={{ color: '#ffffff', fontSize: 11, marginTop: 2 }}>剩余坑位</div>
                                            </div>
                                            <div style={{ padding: '8px 10px', background: hookBudgetInfo.budget.staleCount > 0 ? 'rgba(255,50,50,0.15)' : 'rgba(50,50,60,0.3)', borderRadius: 6, border: `1px solid ${hookBudgetInfo.budget.staleCount > 0 ? 'rgba(255,80,80,0.4)' : 'rgba(100,100,120,0.3)'}` }}>
                                                <div style={{ color: hookBudgetInfo.budget.staleCount > 0 ? '#ff6b6b' : '#ffffff', fontWeight: 700, fontSize: 22 }}>{hookBudgetInfo.budget.staleCount}</div>
                                                <div style={{ color: '#ffffff', fontSize: 11, marginTop: 2 }}>过期</div>
                                            </div>
                                        </div>
                                        {hookBudgetInfo.agenda.mustAdvance?.length > 0 && (
                                            <div style={{ marginBottom: 5, color: '#ffffff' }}><span style={{ color: '#ff6b6b', fontWeight: 700 }}>必须推进:</span> {hookBudgetInfo.agenda.mustAdvance.map(h => h.id).join(', ')}</div>
                                        )}
                                        {hookBudgetInfo.agenda.eligibleResolve?.length > 0 && (
                                            <div style={{ marginBottom: 5, color: '#ffffff' }}><span style={{ color: '#2ed573', fontWeight: 700 }}>可回收</span> {hookBudgetInfo.agenda.eligibleResolve.map(h => h.id).join(', ')}</div>
                                        )}
                                        {hookBudgetInfo.agenda.staleDebt?.length > 0 && (
                                            <div style={{ marginBottom: 5, color: '#ffffff' }}><span style={{ color: '#ff6b6b', fontWeight: 700 }}>🚨过期:</span> {hookBudgetInfo.agenda.staleDebt.map(h => `${h.id}(${h.age}`).join(', ')}</div>
                                        )}
                                        {hookBudgetInfo.summary.hooks.length > 0 && (
                                            <div style={{ maxHeight: 100, overflow: 'auto', fontSize: 11, color: '#ffffff', borderTop: '1px solid rgba(255,165,0,0.2)', paddingTop: 6, marginTop: 6 }}>
                                                {hookBudgetInfo.summary.hooks.map(h => (
                                                    <div key={h.id} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                                                        <span style={{ color: h.status === 'resolved' ? '#2ed573' : '#ffa502' }}>{h.status === 'resolved' ? '✅已解决' : '⏳进行中'}</span>
                                                        <span style={{ color: '#ffffff', fontWeight: 600 }}>{h.id}</span>
                                                        <span style={{ color: '#a29bfe' }}>{h.type}</span>
                                                        <span style={{ color: '#ffffff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.notes}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ color: '#ffffff', fontSize: 12 }}>点击"刷新"加载伏笔预算数据</div>
                                )}
                            </div>

                            <div style={{ padding: 14, background: 'transparent', borderRadius: 8, border: '1px solid rgba(162,155,254,0.3)', fontSize: 13 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <span style={{ fontWeight: 700, color: '#a29bfe', fontSize: 14 }}>📚 规则(Rule Stack)</span>
                                    <button className="cyber-btn cyber-btn-sm" onClick={async () => {
                                        if (!currentProject) return;
                                        try {
                                            const res = await pipelineApi.getRuleStack(currentProject.id, 'writer');
                                            setRuleStackInfo(res.data);
                                        } catch (e) { console.error(e); }
                                    }} style={{ fontSize: 10 }}>刷新</button>
                                </div>
                                {ruleStackInfo ? (
                                    <div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                                            {Object.entries(ruleStackInfo.summary.byLayer || {}).map(([layer, count]) => {
                                                const colors = { L1: '#ff6b6b', L2: '#ffa502', L3: '#54a0ff', L4: '#2ed573' };
                                                const names = { L1: '硬事实', L2: '作者意图', L3: '规划', L4: '当前任务' };
                                                return (
                                                    <div key={layer} style={{ padding: '6px 8px', background: 'transparent', borderRadius: 6, textAlign: 'center', border: `1px solid ${colors[layer] || '#636e72'}40` }}>
                                                        <div style={{ color: colors[layer] || '#ffffff', fontWeight: 700, fontSize: 20 }}>{count}</div>
                                                        <div style={{ color: '#ffffff', fontSize: 10, marginTop: 2 }}>{names[layer] || layer}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#ffffff', marginBottom: 6, padding: '4px 8px', background: 'transparent', borderRadius: 4 }}>
                                            优先 <span style={{ color: '#ff6b6b' }}>L1(100)</span> {'>'} <span style={{ color: '#ffa502' }}>L2(80)</span> {'>'} <span style={{ color: '#2ed573' }}>L4(70)</span> {'>'} <span style={{ color: '#54a0ff' }}>L3(60)</span> | 覆盖: L4→L3L4→L2L4→L1
                                        </div>
                                        {ruleStackInfo.effectiveRules?.length > 0 && (
                                            <div style={{ maxHeight: 100, overflow: 'auto', fontSize: 11, borderTop: '1px solid rgba(162,155,254,0.2)', paddingTop: 6 }}>
                                                {ruleStackInfo.effectiveRules.slice(0, 10).map(r => (
                                                    <div key={r.id} style={{ marginBottom: 3, display: 'flex', gap: 6 }}>
                                                        <span style={{ color: r.layer === 'L1' ? '#ff6b6b' : r.layer === 'L2' ? '#ffa502' : '#54a0ff', fontWeight: 700 }}>[{r.layer}]</span>
                                                        <span style={{ color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content.substring(0, 60)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ color: '#ffffff', fontSize: 12 }}>点击"刷新"加载规则(Rule Stack)栈数</div>
                                )}
                            </div>
                        </div>

                        <div style={{ marginTop: 12, padding: 14, background: 'transparent', borderRadius: 8, border: '1px solid rgba(255,100,100,0.3)', fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <span style={{ fontWeight: 700, color: '#ff6b6b', fontSize: 14 }}>🔍 约束词审计(Prompt Audit)</span>
                                <button className="cyber-btn cyber-btn-sm" onClick={async () => {
                                    if (!currentProject) return;
                                    setPromptAuditLoading(true);
                                    try {
                                        const res = await pipelineApi.getPromptAudit(currentProject.id, projectMode);
                                        const data = res.data || res;
                                        if (data.error) {
                                            alert('审计失败: ' + data.error);
                                        } else {
                                            setPromptAuditInfo(data);
                                        }
                                    } catch (e) {
                                        alert('审计请求失败: ' + (e.response?.data?.error || e.message));
                                    } finally {
                                        setPromptAuditLoading(false);
                                    }
                                }} style={{ fontSize: 10 }} disabled={promptAuditLoading}>{promptAuditLoading ? '⏳审计中...' : '审计'}</button>
                            </div>
                            {promptAuditInfo && promptAuditInfo.overall ? (
                                <div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                                        <div style={{ padding: '8px 10px', background: promptAuditInfo.overall.healthScore >= 80 ? 'rgba(50,255,100,0.1)' : promptAuditInfo.overall.healthScore >= 60 ? 'rgba(255,165,0,0.15)' : 'rgba(255,50,50,0.2)', borderRadius: 6, border: `1px solid ${promptAuditInfo.overall.healthScore >= 80 ? 'rgba(50,255,100,0.3)' : promptAuditInfo.overall.healthScore >= 60 ? 'rgba(255,165,0,0.4)' : 'rgba(255,80,80,0.5)'}` }}>
                                            <div style={{ color: promptAuditInfo.overall.healthScore >= 80 ? '#2ed573' : promptAuditInfo.overall.healthScore >= 60 ? '#ffa502' : '#ff6b6b', fontWeight: 700, fontSize: 22 }}>{promptAuditInfo.overall.healthScore}</div>
                                            <div style={{ color: '#ffffff', fontSize: 11, marginTop: 2 }}>健康度</div>
                                        </div>
                                        <div style={{ padding: '8px 10px', background: 'rgba(255,50,50,0.12)', borderRadius: 6, border: '1px solid rgba(255,50,50,0.3)' }}>
                                            <div style={{ color: '#ff6b6b', fontWeight: 700, fontSize: 22 }}>{promptAuditInfo.overall.totalDuplicates || 0}</div>
                                            <div style={{ color: '#ffffff', fontSize: 11, marginTop: 2 }}>重复概念</div>
                                        </div>
                                        <div style={{ padding: '8px 10px', background: 'rgba(255,165,0,0.12)', borderRadius: 6, border: '1px solid rgba(255,165,0,0.3)' }}>
                                            <div style={{ color: '#ffa502', fontWeight: 700, fontSize: 22 }}>{promptAuditInfo.overall.totalInflation || 0}</div>
                                            <div style={{ color: '#ffffff', fontSize: 11, marginTop: 2 }}>膨胀问题</div>
                                        </div>
                                        <div style={{ padding: '8px 10px', background: 'rgba(50,150,255,0.12)', borderRadius: 6, border: '1px solid rgba(50,150,255,0.3)' }}>
                                            <div style={{ color: '#54a0ff', fontWeight: 700, fontSize: 22 }}>{Object.keys(promptAuditInfo.agents || {}).filter(k => !promptAuditInfo.agents[k].error).length}</div>
                                            <div style={{ color: '#ffffff', fontSize: 11, marginTop: 2 }}>已审计Agent</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#ffffff', marginBottom: 8, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                                        {promptAuditInfo.overall.summary || '审计完成'}
                                    </div>
                                    {Object.entries(promptAuditInfo.agents || {}).filter(([, a]) => !a.error && (a.duplicateConcepts?.length > 0 || a.inflationIssues?.length > 0)).map(([agentType, audit]) => (
                                        <div key={agentType} style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, border: `1px solid ${audit.healthScore >= 80 ? 'rgba(50,255,100,0.2)' : audit.healthScore >= 60 ? 'rgba(255,165,0,0.3)' : 'rgba(255,80,80,0.4)'}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <span style={{ color: audit.healthScore >= 80 ? '#2ed573' : audit.healthScore >= 60 ? '#ffa502' : '#ff6b6b', fontWeight: 700, fontSize: 12 }}>{AGENT_LABELS[agentType] || agentType}</span>
                                                <span style={{ color: '#ffffff', fontSize: 11 }}>健康度: {audit.healthScore} | 重复 {audit.totalDuplicates} | 膨胀 {audit.totalInflation}</span>
                                            </div>
                                            {audit.duplicateConcepts?.map((c, i) => (
                                                <div key={i} style={{ fontSize: 11, color: '#ffffff', marginBottom: 2 }}>
                                                    <span style={{ color: c.severity === 'high' ? '#ff6b6b' : c.severity === 'medium' ? '#ffa502' : '#2ed573' }}>{c.severity === 'high' ? '🔴' : c.severity === 'medium' ? '🟡' : '🟢'}</span>
                                                    <span style={{ fontWeight: 600 }}>{c.label}</span> x{c.totalCount} ?{c.fix}
                                                </div>
                                            ))}
                                            {audit.inflationIssues?.map((issue, i) => (
                                                <div key={i} style={{ fontSize: 11, color: '#ffffff', marginBottom: 2 }}>
                                                    <span style={{ color: issue.severity === 'high' ? '#ff6b6b' : issue.severity === 'medium' ? '#ffa502' : '#2ed573' }}>⚠️</span>
                                                    <span style={{ fontWeight: 600 }}>{issue.desc}</span> ({issue.count}/{issue.maxCount}) ?{issue.fix}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ color: '#ffffff', fontSize: 12 }}>点击"审计"检测约束词重复和膨胀问题</div>
                            )}
                        </div>

                        <div style={{ marginTop: 12, padding: 14, background: 'transparent', borderRadius: 8, border: '1px solid rgba(100,200,255,0.3)', fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <span style={{ fontWeight: 700, color: '#64b5f6', fontSize: 14 }}>🧠 提示词优化器 (Prompt Optimizer)</span>
                                <button className="cyber-btn cyber-btn-sm" onClick={async () => {
                                    if (!currentProject) return;
                                    setOptimizerLoading(true);
                                    try {
                                        const res = await optimizerApi.report(currentProject.id, 10);
                                        const data = res.data;
                                        if (data.error) { alert('检测失败：' + data.error); }
                                        else { setOptimizerReport(data); }
                                    } catch (e) { alert('检测请求失败：' + e.message); }
                                    finally { setOptimizerLoading(false); }
                                }} style={{ fontSize: 10 }} disabled={optimizerLoading}>{optimizerLoading ? '⏳检测中...' : '检测'}</button>
                            </div>
                            {optimizerReport && optimizerReport.detection ? (
                                <div>
                                    <div style={{ fontSize: 11, color: '#c8c8c8', marginBottom: 8 }}>分析最近{optimizerReport.detection.analyzedChapters}章 | {optimizerReport.detection.totalReviewsAnalyzed}条审核记录</div>
                                    {optimizerReport.detection.patterns.length === 0 ? (
                                        <div style={{ color: '#2ed573', fontSize: 12 }}>✅ 未检测到跨章节高频问题</div>
                                    ) : (
                                        <div>
                                            {optimizerReport.detection.patterns.map((p, i) => {
                                                const canOpt = optimizerReport.canOptimize?.find(c => c.patternId === p.patternId);
                                                const sevColor = p.severity === 'critical' ? '#ff4757' : p.severity === 'high' ? '#ffa502' : '#54a0ff';
                                                return (
                                                    <div key={p.patternId} style={{ marginBottom: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: `1px solid ${sevColor}33` }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                            <div>
                                                                <span style={{ color: sevColor, fontWeight: 700, fontSize: 12 }}>{p.category}</span>
                                                                <span style={{ color: '#d5d5d5', fontSize: 10, marginLeft: 8 }}>{p.severity}</span>
                                                            </div>
                                                            <div style={{ fontSize: 11 }}>
                                                                <span style={{ color: '#ff6b6b' }}>{p.totalHits}次</span>
                                                                <span style={{ color: '#c8c8c8', margin: '0 4px' }}>|</span>
                                                                <span style={{ color: '#ffa502' }}>{p.chapterCount}章</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: 10, color: '#b8b8b8', marginBottom: 4 }}>根因: {p.rootCause}</div>
                                                        <div style={{ fontSize: 10, color: '#c8c8c8' }}>影响章节: {p.affectedChapters.join(', ')}</div>
                                                        {canOpt && canOpt.allowed && p.canAutoOptimize ? (
                                                            <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                                                                <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 9 }} onClick={async () => {
                                                                    if (!confirm(`确认优化"${p.category}"？\n\n将修改 ${p.targetField}\n根因: ${p.rootCause}\n\n优化后健康度必须≥0，Token只减不增。`)) return;
                                                                    setOptimizerApplying(p.patternId);
                                                                    try {
                                                                        const res = await optimizerApi.suggestion(currentProject.id, p.patternId);
                                                                        const sug = res.data;
                                                                        if (sug.error) { alert('获取建议失败: ' + sug.error); return; }
                                                                        const applyRes = await optimizerApi.apply(currentProject.id, p.patternId, { suggestionIndex: 0 });
                                                                        const result = applyRes.data;
                                                                        if (result.success) {
                                                                            alert(`✅ 优化成功！\n\nToken变化: ${result.tokenDelta > 0 ? '+' : ''}${result.tokenDelta}\n健康度: ${result.healthScoreAfter}\n字数变化: ${result.charDelta > 0 ? '+' : ''}${result.charDelta}`);
                                                                            const rptRes = await optimizerApi.report(currentProject.id, 10);
                                                                            setOptimizerReport(rptRes.data);
                                                                        } else {
                                                                            alert('❌ 优化失败：' + result.error);
                                                                        }
                                                                    } catch (e) { alert('优化请求失败: ' + e.message); }
                                                                    finally { setOptimizerApplying(null); }
                                                                }} disabled={optimizerApplying === p.patternId}>
                                                                    {optimizerApplying === p.patternId ? '⏳执行中...' : '🔧 优化'}
                                                                </button>
                                                            </div>
                                                        ) : canOpt && !canOpt.allowed ? (
                                                            <div style={{ fontSize: 10, color: '#ff6b6b', marginTop: 4 }}>🚫 {canOpt.reason}</div>
                                                        ) : !p.canAutoOptimize ? (
                                                            <div style={{ fontSize: 10, color: '#d5d5d5', marginTop: 4 }}>⚠️ 此模式需手动优化</div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {optimizerReport.history && optimizerReport.history.log?.length > 0 && (
                                        <div style={{ marginTop: 10, borderTop: '1px solid rgba(100,200,255,0.2)', paddingTop: 8 }}>
                                            <div style={{ fontSize: 11, color: '#d5d5d5', fontWeight: 600, marginBottom: 4 }}>优化历史 ({optimizerReport.history.log.length}?</div>
                                            {optimizerReport.history.log.slice(-3).reverse().map((l, i) => (
                                                <div key={i} style={{ fontSize: 10, color: '#c8c8c8', marginBottom: 2 }}>
                                                    {l.timestamp?.split('T')[0]} {l.category} | Token{l.tokenDelta > 0 ? '+' : ''}{l.tokenDelta} | 健康{l.healthScoreAfter}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ color: '#ffffff', fontSize: 12 }}>点击"检测"分析跨章节高频问题模式</div>
                            )}
                        </div>

                        <div style={{ marginTop: 12, padding: 14, background: 'transparent', borderRadius: 8, border: '1px solid rgba(255,100,100,0.3)', fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <span style={{ fontWeight: 700, color: '#ff6b6b', fontSize: 14 }}>🔍 章节审计</span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {selectedForBatch.size > 0 && <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 9, background: '#ff6b6b33', borderColor: '#ff6b6b' }} disabled={batchRepairing || !!repairingChapter || !!retryTaskId} onClick={async () => {
                                        if (batchRepairing || repairingChapter || retryTaskId) return;
                                        if (!confirm(`确认顺序返修${selectedForBatch.size}章？每章修完再修下一章，返修+审核通过后自动执行复审→定稿→润色→素材更新`)) return;
                                        setBatchRepairing(true);
                                        const ids = [...selectedForBatch];
                                        const [provider, model] = (selectedRepairModel || '').split('|');
                                        try {
                                            const res = await chapterAuditApi.batchRepair(currentProject.id, { chapterIds: ids, provider: provider || undefined, model: model || undefined, maxRetries: 10, autoReview: true, followUpPipeline: true });
                                            const { taskId } = res.data;
                                            setBatchTaskId(taskId);
                                            const pollInterval = setInterval(async () => {
                                                try {
                                                    const status = (await chapterAuditApi.batchRepairStatus(taskId)).data;
                                                    setBatchProgress(status);
                                                    if (status.status === 'completed') {
                                                        clearInterval(pollInterval);
                                                        buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                                                        setBatchTaskId(null);
                                                        setBatchRepairing(false);
                                                        setSelectedForBatch(new Set());
                                                        const ok = status.results.filter(r => r.allPassed).length;
                                                        const fail = status.results.filter(r => !r.allPassed).length;
                                                        const pipelineOk = status.results.filter(r => r.pipelineSuccess).length;
                                                        alert(`批量返修完成：✅${ok}章通过 ❌${fail}章未通过 | 流水线完成${pipelineOk}章`);
                                                        const newAudit = await chapterAuditApi.audit(currentProject.id);
                                                        setChapterAuditData(newAudit.data);
                                                    }
                                                } catch { clearInterval(pollInterval); buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval); setBatchRepairing(false); }
                                            }, 5000);
                                            buttonPollRefs.current.push(pollInterval);
                                        } catch (e) { alert('批量返修请求失败: ' + e.message); setBatchRepairing(false); }
                                    }}>{batchRepairing ? `⏳顺序返修中${batchProgress ? `(${batchProgress.completed}/${batchProgress.total})` : ''}...` : `🔧顺序返修+流水线(${selectedForBatch.size})`}</button>}
                                    <button className="cyber-btn cyber-btn-sm" onClick={async () => {
                                        if (!currentProject) return;
                                        setChapterAuditLoading(true);
                                        try {
                                            const res = await chapterAuditApi.audit(currentProject.id);
                                            const data = res.data;
                                            if (data.error) alert('审计失败: ' + data.error);
                                            else { setChapterAuditData(data); setAuditPage(1); }
                                        } catch (e) { alert('审计请求失败: ' + e.message); }
                                        finally { setChapterAuditLoading(false); }
                                    }} style={{ fontSize: 10 }} disabled={chapterAuditLoading}>{chapterAuditLoading ? '⏳扫描中...' : '全量扫描'}</button>
                                </div>
                            </div>
                            {retryProgress && retryProgress.status === 'running' && (
                                <div style={{ marginBottom: 8, padding: 10, background: 'rgba(0,100,255,0.08)', borderRadius: 6, border: '1px solid rgba(0,100,255,0.3)', fontSize: 11 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#54a0ff', fontWeight: 600 }}>⏳ Ch{repairingChapter} 返修进行中.....</span>
                                        {retryTaskId && (
                                            <button style={{ fontSize: 9, color: '#ff6b6b', background: 'rgba(255,80,80,0.2)', border: '1px solid rgba(255,80,80,0.5)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={async () => {
                                                if (!confirm('确认停止返修？已完成的修改会保留')) return;
                                                try {
                                                    await chapterAuditApi.repairRetryCancel(retryTaskId);
                                                    setRetryTaskId(null);
                                                    setRepairingChapter(null);
                                                    const newAudit = await chapterAuditApi.audit(currentProject.id);
                                                    setChapterAuditData(newAudit.data);
                                                } catch (e) { console.error(e); }
                                            }}>?停止</button>
                                        )}
                                    </div>
                                    <div style={{ color: '#c8c8c8', marginTop: 4, fontSize: 10 }}>
                                        {retryProgress.currentPhase === 'repair' && `第${retryProgress.currentAttempt}次返修中...`}
                                        {retryProgress.currentPhase === 'repair-done' && `第${retryProgress.currentAttempt}次返修完成，审核中...`}
                                        {retryProgress.currentPhase === 'pipeline-start' && '返修通过，启动流水线...'}
                                        {retryProgress.currentPhase === 'pipeline-step' && `流水线执行中...`}
                                        {retryProgress.currentPhase === 'pipeline-done' && '流水线完成✅'}
                                    </div>
                                    <div style={{ marginTop: 4 }}>
                                        {(retryProgress.progress || []).filter(p => p.phase === 'repair-done').map((p, i) => (
                                            <div key={i} style={{ fontSize: 9, color: p.attemptRecord?.reviewPassed ? '#2ed573' : '#ffa502', marginTop: 2 }}>
                                                第{p.attempt}次 修复{p.attemptRecord?.violationsFixed}项剩余{p.attemptRecord?.violationsAfter}项{p.attemptRecord?.reviewPassed ? '✅审核通过' : '❌审核未通过'} [{p.attemptRecord?.repairModel}]
                                                {(p.attemptRecord?.reviewIssues || []).length > 0 && <span style={{ color: '#ff6b6b', marginLeft: 4 }}>问题{p.attemptRecord.reviewIssues.length}项</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {repairResult && (
                                <div style={{ marginBottom: 8, padding: 10, background: repairResult.success === false ? 'rgba(255,0,68,0.08)' : repairResult.allPassed ? 'rgba(0,255,0,0.1)' : repairResult.violationsAfter === 0 ? 'rgba(0,255,0,0.1)' : 'rgba(255,165,0,0.08)', borderRadius: 6, border: `1px solid ${repairResult.success === false ? 'rgba(255,0,68,0.3)' : repairResult.allPassed ? 'rgba(0,255,0,0.3)' : repairResult.violationsAfter === 0 ? 'rgba(0,255,0,0.3)' : 'rgba(255,165,0,0.3)'}`, fontSize: 11 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: repairResult.success === false ? '#ff4757' : repairResult.allPassed ? '#2ed573' : repairResult.violationsAfter === 0 ? '#2ed573' : '#ffa502', fontWeight: 600 }}>
                                            {repairResult.success === false ? '❌' : repairResult.allPassed ? '✅' : repairResult.violationsAfter === 0 ? '✅' : '⚠️'} Ch{repairResult.chapterNumber} 返修{repairResult.success === false ? '失败' : repairResult.allPassed ? '全部通过' : '完成'}{repairResult.attempts ? ` (${repairResult.attempts}次尝试)` : retryCount > 0 ? ` (共${retryCount}次重试)` : ''}
                                        </span>
                                        <button style={{ fontSize: 9, color: '#d5d5d5', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => { setRepairResult(null); setReviewResult(null); setRetryCount(0); setRetryProgress(null); setExpandedAttempt(null); }}>✕</button>
                                    </div>
                                    {repairResult.success === false && repairResult.error && (
                                        <div style={{ color: '#ff4757', marginTop: 4, fontWeight: 600 }}>错误: {repairResult.error}</div>
                                    )}
                                    {repairResult.success !== false && (
                                        <div style={{ color: '#c8c8c8', marginTop: 4 }}>修复{repairResult.violationsFixed ?? 0}项 | 剩余{repairResult.violationsAfter ?? 0}项 | 字数{repairResult.oldWordCount}→{repairResult.newWordCount}({repairResult.wordCountDelta > 0 ? '+' : ''}{repairResult.wordCountDelta})</div>
                                    )}
                                    <div style={{ color: '#54a0ff', marginTop: 2, fontSize: 10 }}>模型: {repairResult.usedProvider || '未知'} / {repairResult.usedModel || '未知'}</div>
                                    {(repairResult.remainingViolations || []).length > 0 && <div style={{ color: '#ffa502', marginTop: 2 }}>剩余：{repairResult.remainingViolations.map(v => v.category).join('、')}</div>}

                                    {(repairResult.attemptHistory || []).length > 0 && (
                                        <div style={{ marginTop: 8 }}>
                                            <div style={{ color: '#ddd', fontWeight: 600, fontSize: 10, marginBottom: 4 }}>📋 返修过程详情 ({repairResult.attemptHistory.length}次尝试)</div>
                                            {repairResult.attemptHistory.map((att, idx) => (
                                                <div key={idx} style={{ marginTop: 4, padding: 6, background: 'rgba(0,0,0,0.2)', borderRadius: 4, border: `1px solid ${att.auditClean && att.reviewPassed ? 'rgba(0,255,0,0.15)' : 'rgba(255,165,0,0.15)'}` }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ color: att.auditClean && att.reviewPassed ? '#2ed573' : '#ffa502', fontWeight: 600, fontSize: 10, cursor: 'pointer' }} onClick={() => setExpandedAttempt(expandedAttempt === att.attempt ? null : att.attempt)}>
                                                            第{att.attempt}次 {att.auditClean && att.reviewPassed ? '✅通过' : '❌未通过'}
                                                        </span>
                                                        <span style={{ color: '#54a0ff', fontSize: 9 }}>{att.repairModel}</span>
                                                    </div>
                                                    <div style={{ color: '#c8c8c8', fontSize: 9, marginTop: 2 }}>
                                                        违规: {att.violationsBefore}→{att.violationsAfter} (修{att.violationsFixed}项) | 字数: {att.wordCount?.before}→{att.wordCount?.after}({att.wordCount?.delta > 0 ? '+' : ''}{att.wordCount?.delta})
                                                    </div>
                                                    <div style={{ color: att.reviewPassed ? '#2ed573' : '#ff6b6b', fontSize: 9, marginTop: 2 }}>
                                                        审核: {att.reviewPassed ? '✅通过' : '❌未通过'} {att.reviewModel ? `[${att.reviewModel}]` : ''}
                                                    </div>
                                                    {(att.remainingViolations || []).length > 0 && (
                                                        <div style={{ color: '#ffa502', fontSize: 9, marginTop: 2 }}>
                                                            剩余违规: {att.remainingViolations.map(v => <span key={v.type} style={{ marginRight: 4 }}>[{v.category}] {v.desc?.substring(0, 30)}</span>)}
                                                        </div>
                                                    )}
                                                    {expandedAttempt === att.attempt && (
                                                        <>
                                                            {att.repairInstructions && (
                                                                <div style={{ marginTop: 4, padding: 4, background: 'rgba(0,100,255,0.1)', borderRadius: 4, border: '1px solid rgba(0,100,255,0.2)' }}>
                                                                    <div style={{ color: '#54a0ff', fontSize: 9, fontWeight: 600 }}>📝 返修指令</div>
                                                                    <div style={{ color: '#c8c8c8', fontSize: 9, marginTop: 2, whiteSpace: 'pre-wrap' }}>{att.repairInstructions}</div>
                                                                </div>
                                                            )}
                                                            {att.reviewContent && (
                                                                <div style={{ marginTop: 4, padding: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 4, border: `1px solid ${att.reviewPassed ? 'rgba(0,255,0,0.2)' : 'rgba(255,80,80,0.2)'}` }}>
                                                                    <div style={{ color: att.reviewPassed ? '#2ed573' : '#ff6b6b', fontSize: 9, fontWeight: 600 }}>
                                                                        {att.reviewPassed ? '✅ 审核通过理由' : '❌ 审核拒绝理由'}
                                                                    </div>
                                                                    {att.reviewSummary && <div style={{ color: '#ddd', fontSize: 9, marginTop: 2, lineHeight: 1.5 }}>{att.reviewSummary}</div>}
                                                                    {(att.reviewIssues || []).length > 0 && (
                                                                        <div style={{ marginTop: 4 }}>
                                                                            <div style={{ color: '#ff6b6b', fontSize: 9, fontWeight: 600 }}>问题列表 ({att.reviewIssues.length}?</div>
                                                                            {att.reviewIssues.map((issue, ii) => (
                                                                                <div key={ii} style={{ marginTop: 3, padding: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 3, borderLeft: `3px solid ${issue.severity === 'critical' ? '#ff4757' : issue.severity === 'high' ? '#ffa502' : '#747d8c'}` }}>
                                                                                    <div style={{ color: issue.severity === 'critical' ? '#ff4757' : issue.severity === 'high' ? '#ffa502' : '#747d8c', fontSize: 8, fontWeight: 600 }}>
                                                                                        [{issue.severity?.toUpperCase()}] {issue.title}
                                                                                    </div>
                                                                                    {issue.location && <div style={{ color: '#54a0ff', fontSize: 8, marginTop: 1 }}>📍 {issue.location}</div>}
                                                                                    {issue.originalText && <div style={{ color: '#ffa502', fontSize: 8, marginTop: 1 }}>原文: <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0 3px', borderRadius: 2 }}>{issue.originalText}</code></div>}
                                                                                    {issue.violationReason && <div style={{ color: '#ff6b6b', fontSize: 8, marginTop: 1 }}>违规: {issue.violationReason}</div>}
                                                                                    {issue.howToFix && <div style={{ color: '#2ed573', fontSize: 8, marginTop: 1 }}>改法: {issue.howToFix}</div>}
                                                                                    {issue.targetText && <div style={{ color: '#2ed573', fontSize: 8, marginTop: 1 }}>改为: <code style={{ background: 'rgba(46,213,115,0.08)', padding: '0 3px', borderRadius: 2, color: '#2ed573' }}>{issue.targetText}</code></div>}
                                                                                    {issue.description && !issue.originalText && !issue.violationReason && <div style={{ color: '#ddd', fontSize: 9, marginTop: 2, lineHeight: 1.4 }}>{issue.description}</div>}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {(att.reviewSuggestions || []).length > 0 && (
                                                                        <div style={{ marginTop: 4 }}>
                                                                            <div style={{ color: '#54a0ff', fontSize: 9, fontWeight: 600 }}>修改建议 ({att.reviewSuggestions.length})</div>
                                                                            {att.reviewSuggestions.map((s, si) => (
                                                                                <div key={si} style={{ marginTop: 2, padding: 3, background: 'rgba(0,100,255,0.1)', borderRadius: 3, borderLeft: '3px solid #54a0ff' }}>
                                                                                    <div style={{ color: '#54a0ff', fontSize: 8, fontWeight: 600 }}>{s.title}</div>
                                                                                    <div style={{ color: '#c8c8c8', fontSize: 9, marginTop: 1 }}>{s.description}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {!(att.reviewIssues || []).length && !(att.reviewSuggestions || []).length && (
                                                                        <div style={{ color: '#ddd', fontSize: 9, marginTop: 2, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                                                            {att.reviewContent}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {(att.contentDiff || []).length > 0 && (
                                                                <div style={{ marginTop: 4, padding: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 4, border: '1px solid rgba(100,100,100,0.3)' }}>
                                                                    <div style={{ color: '#ddd', fontSize: 9, fontWeight: 600 }}>📊 修改对比 ({att.contentDiff.length}处变更)</div>
                                                                    <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 2 }}>
                                                                        {att.contentDiff.slice(0, 20).map((d, di) => (
                                                                            <div key={di} style={{ marginTop: 3, padding: 3, background: 'rgba(0,0,0,0.2)', borderRadius: 3, fontSize: 9 }}>
                                                                                <div style={{ color: '#ff6b6b', fontSize: 8 }}>L{d.line}: {d.before?.substring(0, 100)}</div>
                                                                                <div style={{ color: '#2ed573', fontSize: 8 }}>L{d.line}: {d.after?.substring(0, 100)}</div>
                                                                            </div>
                                                                        ))}
                                                                        {att.contentDiff.length > 20 && <div style={{ color: '#d5d5d5', fontSize: 8, marginTop: 2 }}>...还有{att.contentDiff.length - 20}处变更</div>}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {att.contentBefore && att.contentAfter && (
                                                                <div style={{ marginTop: 6 }}>
                                                                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                                                        <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, flex: 1 }} onClick={() => {
                                                                            const w = window.open('', '_blank', 'width=600,height=800');
                                                                            w.document.write(`<html><head><title>Ch${repairResult.chapterNumber} ${att.attempt}次返修前</title><style>body{font-family:sans-serif;padding:20px;line-height:1.8;white-space:pre-wrap;background:#1a1a2e;color:#eee;}</style></head><body>${att.contentBefore.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</body></html>`);
                                                                            w.document.close();
                                                                        }}>📄 查看返修前全文</button>
                                                                        <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, flex: 1 }} onClick={() => {
                                                                            const w = window.open('', '_blank', 'width=600,height=800');
                                                                            w.document.write(`<html><head><title>Ch${repairResult.chapterNumber} ${att.attempt}次返修后</title><style>body{font-family:sans-serif;padding:20px;line-height:1.8;white-space:pre-wrap;background:#1a1a2e;color:#eee;}</style></head><body>${att.contentAfter.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</body></html>`);
                                                                            w.document.close();
                                                                        }}>📄 查看返修后全文</button>
                                                                        <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, flex: 1, background: '#54a0ff33', borderColor: '#54a0ff' }} onClick={() => {
                                                                            const w = window.open('', '_blank', 'width=1200,height=800');
                                                                            w.document.write(`<html><head><title>Ch${repairResult.chapterNumber} ${att.attempt}?左右对比</title><style>body{margin:0;font-family:sans-serif;display:flex;height:100vh;overflow:hidden;background:#0a0a1a;color:#eee;} .panel{flex:1;overflow-y:auto;padding:20px;line-height:1.8;white-space:pre-wrap;} .left{border-right:2px solid #333;background:#1a1a2e;} .right{background:#16213e;} h3{position:sticky;top:0;background:inherit;padding:8px 0;margin:0;border-bottom:1px solid #333;font-size:14px;}</style></head><body><div class="left panel"><h3>📝 返修前(${att.wordCount?.before}字</h3>${att.contentBefore.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div><div class="right panel"><h3>返修后(${att.wordCount?.after}字</h3>${att.contentAfter.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div></body></html>`);
                                                                            w.document.close();
                                                                        }}>📄 左右对比</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {repairResult.reviewResults && !(repairResult.attemptHistory || []).length && (
                                        <ReviewResultPanel result={repairResult.reviewResults} />
                                    )}
                                    {reviewResult && !repairResult.reviewResults && !(repairResult.attemptHistory || []).length && (
                                        <ReviewResultPanel result={reviewResult} />
                                    )}
                                    {repairResult.contentBefore && repairResult.contentAfter && !(repairResult.attemptHistory || []).length && (
                                        <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, flex: 1 }} onClick={() => {
                                                const w = window.open('', '_blank', 'width=600,height=800');
                                                w.document.write(`<html><head><title>Ch${repairResult.chapterNumber} 返修前</title><style>body{font-family:sans-serif;padding:20px;line-height:1.8;white-space:pre-wrap;background:#1a1a2e;color:#eee;}</style></head><body>${repairResult.contentBefore.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</body></html>`);
                                                w.document.close();
                                            }}>📄 查看返修前全文</button>
                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, flex: 1 }} onClick={() => {
                                                const w = window.open('', '_blank', 'width=600,height=800');
                                                w.document.write(`<html><head><title>Ch${repairResult.chapterNumber} 返修后</title><style>body{font-family:sans-serif;padding:20px;line-height:1.8;white-space:pre-wrap;background:#1a1a2e;color:#eee;}</style></head><body>${repairResult.contentAfter.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</body></html>`);
                                                w.document.close();
                                            }}>📄 查看返修后全文</button>
                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, flex: 1, background: '#54a0ff33', borderColor: '#54a0ff' }} onClick={() => {
                                                const w = window.open('', '_blank', 'width=1200,height=800');
                                                w.document.write(`<html><head><title>Ch${repairResult.chapterNumber} 左右对比</title><style>body{margin:0;font-family:sans-serif;display:flex;height:100vh;overflow:hidden;background:#0a0a1a;color:#eee;} .panel{flex:1;overflow-y:auto;padding:20px;line-height:1.8;white-space:pre-wrap;} .left{border-right:2px solid #333;background:#1a1a2e;} .right{background:#16213e;} h3{position:sticky;top:0;background:inherit;padding:8px 0;margin:0;border-bottom:1px solid #333;font-size:14px;}</style></head><body><div class="left panel"><h3>📝 返修前(${repairResult.oldWordCount}字</h3>${repairResult.contentBefore.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div><div class="right panel"><h3>返修后(${repairResult.newWordCount}字</h3>${repairResult.contentAfter.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div></body></html>`);
                                                w.document.close();
                                            }}>📄 左右对比</button>
                                        </div>
                                    )}
                                    {repairResult.pipelineResult && (
                                        <div style={{ marginTop: 6, padding: 6, background: 'rgba(0,0,0,0.2)', borderRadius: 4, border: `1px solid ${repairResult.pipelineResult.success ? 'rgba(0,255,0,0.2)' : 'rgba(255,80,80,0.2)'}` }}>
                                            <div style={{ color: repairResult.pipelineResult.success ? '#2ed573' : '#ff6b6b', fontWeight: 600, fontSize: 10 }}>
                                                {repairResult.pipelineResult.success ? '✅ 流水线完成' : '❌ 流水线未完成'}
                                            </div>
                                            <div style={{ color: '#d5d5d5', marginTop: 2, fontSize: 9 }}>
                                                {(repairResult.pipelineResult.results || []).map((r, i) => (
                                                    <span key={i} style={{ marginRight: 6 }}>{r.step}: {r.passed ? '▲' : '▼'}</span>
                                                ))}
                                            </div>
                                            {repairResult.pipelineResult.finalWordCount && <div style={{ color: '#c8c8c8', marginTop: 2, fontSize: 9 }}>最终字数 {repairResult.pipelineResult.finalWordCount} | 状态 {repairResult.pipelineResult.finalStatus}</div>}
                                        </div>
                                    )}
                                    {repairResult.pipelineError && (
                                        <div style={{ marginTop: 4, color: '#ff6b6b', fontSize: 9 }}>流水线错误: {repairResult.pipelineError}</div>
                                    )}
                                    {repairResult.maxRetriesReached && (
                                        <div style={{ marginTop: 4, color: '#ffa502', fontSize: 9 }}>⚠️ 已达最大重试次数({repairResult.attempts})，仍有{repairResult.violationsAfter}项违规</div>
                                    )}
                                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                        {!repairResult.allPassed && !repairResult.pipelineResult && (
                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, background: '#2ed57333', borderColor: '#2ed573' }} disabled={!!repairingChapter || !!retryTaskId || reviewLoading} onClick={async () => {
                                                if (repairingChapter || retryTaskId) return;
                                                if (!confirm('确认自动重试返修直到通过？将通过后自动执行复审→定稿→润色→素材更新')) return;
                                                setRepairingChapter(repairResult.chapterNumber);
                                                setRetryProgress({ status: 'running', progress: [], currentPhase: 'repair', currentAttempt: 1 });
                                                try {
                                                    const [provider, model] = (selectedRepairModel || '').split('|');
                                                    const res = await chapterAuditApi.repairRetry(currentProject.id, repairResult.chapterId, { provider: provider || undefined, model: model || undefined, maxRetries: 10, autoReview: true, followUpPipeline: true });
                                                    const { taskId } = res.data;
                                                    setRetryTaskId(taskId);
                                                    const pollInterval = setInterval(async () => {
                                                        try {
                                                            const status = (await chapterAuditApi.repairRetryStatus(taskId)).data;
                                                            setRetryProgress(status);
                                                            if (status.status === 'completed') {
                                                                clearInterval(pollInterval);
                                                                buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                                                                setRepairResult(status.result);
                                                                setReviewResult(status.result?.reviewResults);
                                                                setRetryTaskId(null);
                                                                setRepairingChapter(null);
                                                                const newAudit = await chapterAuditApi.audit(currentProject.id);
                                                                setChapterAuditData(newAudit.data);
                                                            } else if (status.status === 'error') {
                                                                clearInterval(pollInterval);
                                                                buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                                                                alert('返修失败: ' + status.error);
                                                                setRetryTaskId(null); setRetryProgress(null); setRepairingChapter(null);
                                                            }
                                                        } catch { clearInterval(pollInterval); buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval); setRepairingChapter(null); }
                                                    }, 3000);
                                                    buttonPollRefs.current.push(pollInterval);
                                                } catch (e) { alert('自动重试请求失败: ' + e.message); setRepairingChapter(null); setRetryProgress(null); }
                                            }}>🔄 自动重试到通过+流水线</button>
                                        )}
                                        {!repairResult.allPassed && !repairResult.pipelineResult && (
                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, background: '#ffa50233', borderColor: '#ffa502' }} disabled={!!repairingChapter || !!retryTaskId || reviewLoading} onClick={async () => {
                                                if (repairingChapter || retryTaskId) return;
                                                setRepairingChapter(repairResult.chapterNumber);
                                                setRetryCount(prev => prev + 1);
                                                try {
                                                    const [provider, model] = (selectedRepairModel || '').split('|');
                                                    const res = await chapterAuditApi.repair(currentProject.id, repairResult.chapterId, { repairInstructions: repairInstructions || undefined, provider: provider || undefined, model: model || undefined, autoReview: true });
                                                    const result = res.data;
                                                    if (result.success) {
                                                        setRepairResult(result);
                                                        setReviewResult(result.reviewResults);
                                                        const newAudit = await chapterAuditApi.audit(currentProject.id);
                                                        setChapterAuditData(newAudit.data);
                                                    } else { alert('❌ 重试返修失败：' + result.error); }
                                                } catch (e) { alert('重试请求失败: ' + e.message); }
                                                finally { setRepairingChapter(null); }
                                            }}>🔄 手动再修一次</button>
                                        )}
                                        {repairResult.allPassed && !repairResult.pipelineResult && !repairResult.pipelineError && (
                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, background: '#54a0ff33', borderColor: '#54a0ff' }} disabled={!!repairingChapter || !!retryTaskId} onClick={async () => {
                                                if (repairingChapter || retryTaskId) return;
                                                if (!confirm('确认执行复审→定稿→润色→素材更新流水线?')) return;
                                                setRepairingChapter(repairResult.chapterNumber);
                                                setRetryProgress({ status: 'running', progress: [], currentPhase: 'pipeline-start' });
                                                try {
                                                    const res = await chapterAuditApi.repairRetry(currentProject.id, repairResult.chapterId, { maxRetries: 1, autoReview: false, followUpPipeline: true });
                                                    const { taskId } = res.data;
                                                    setRetryTaskId(taskId);
                                                    const pollInterval = setInterval(async () => {
                                                        try {
                                                            const status = (await chapterAuditApi.repairRetryStatus(taskId)).data;
                                                            setRetryProgress(status);
                                                            if (status.status === 'completed') {
                                                                clearInterval(pollInterval);
                                                                buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                                                                setRepairResult(status.result);
                                                                setRetryTaskId(null);
                                                                setRepairingChapter(null);
                                                                const newAudit = await chapterAuditApi.audit(currentProject.id);
                                                                setChapterAuditData(newAudit.data);
                                                            } else if (status.status === 'error') {
                                                                clearInterval(pollInterval);
                                                                buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                                                                alert('流水线失败：' + status.error);
                                                                setRetryTaskId(null); setRetryProgress(null); setRepairingChapter(null);
                                                            }
                                                        } catch { clearInterval(pollInterval); buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval); setRepairingChapter(null); }
                                                    }, 3000);
                                                    buttonPollRefs.current.push(pollInterval);
                                                } catch (e) { alert('流水线请求失败：' + e.message); setRepairingChapter(null); setRetryProgress(null); }
                                            }}>▶️ 执行复审定稿润色流水线</button>
                                        )}
                                        <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8 }} disabled={reviewLoading || repairingChapter} onClick={async () => {
                                            setReviewLoading(true);
                                            try {
                                                const [provider, model] = (selectedRepairModel || '').split('|');
                                                const res = await chapterAuditApi.review(currentProject.id, repairResult.chapterId, { provider: provider || undefined, model: model || undefined });
                                                const data = res.data;
                                                setReviewResult(data);
                                            } catch (e) { alert('审核请求失败: ' + e.message); }
                                            finally { setReviewLoading(false); }
                                        }}>{reviewLoading ? '⏳审核中...' : '🔍 单独初审复审'}</button>
                                        {repairResult.snapshotId && (
                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, background: '#ff6b6b33', borderColor: '#ff6b6b' }} disabled={repairingChapter} onClick={async () => {
                                                if (!confirm('确认回滚到返修前版本?')) return;
                                                try {
                                                    const res = await chapterAuditApi.rollback(currentProject.id, repairResult.snapshotId);
                                                    const data = res.data;
                                                    if (data.success) {
                                                        alert(`已回滚Ch${data.chapterNumber}，恢复${data.restoredWordCount}字`);
                                                        setRepairResult(null); setReviewResult(null); setRetryCount(0); setRetryProgress(null); setExpandedAttempt(null);
                                                        const newAudit = await chapterAuditApi.audit(currentProject.id);
                                                        setChapterAuditData(newAudit.data);
                                                    } else { alert('回滚失败: ' + data.error); }
                                                } catch (e) { alert('回滚请求失败: ' + e.message); }
                                            }}>?回滚</button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {chapterAuditData ? (() => {
                                const violated = chapterAuditData.results.filter(r => !r.clean);
                                const filtered = auditFilter === 'all' ? violated : auditFilter === 'critical' ? violated.filter(r => r.criticalCount > 0) : violated.filter(r => r.violations.some(v => v.type === auditFilter));
                                const totalPages = Math.ceil(filtered.length / auditPageSize);
                                const paged = filtered.slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize);
                                const typeOptions = [...new Set(violated.flatMap(r => r.violations.map(v => v.type)))];
                                return (
                                    <div>
                                        <div style={{ fontSize: 11, color: '#c8c8c8', marginBottom: 6 }}>
                                            扫描{chapterAuditData.summary.total}章 | ✅{chapterAuditData.summary.clean} | ⚠️违规{chapterAuditData.summary.withViolations} | 🔴严重{chapterAuditData.summary.critical}
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                            <button onClick={() => { setAuditFilter('all'); setAuditPage(1); }} style={{ fontSize: 9, padding: '2px 6px', background: auditFilter === 'all' ? '#ff6b6b33' : '#333', color: auditFilter === 'all' ? '#ff6b6b' : '#c8c8c8', border: '1px solid #666', borderRadius: 3, cursor: 'pointer' }}>全部({violated.length})</button>
                                            <button onClick={() => { setAuditFilter('critical'); setAuditPage(1); }} style={{ fontSize: 9, padding: '2px 6px', background: auditFilter === 'critical' ? '#ff000033' : '#333', color: auditFilter === 'critical' ? '#ff4757' : '#c8c8c8', border: '1px solid #666', borderRadius: 3, cursor: 'pointer' }}>🔴严重({violated.filter(r => r.criticalCount > 0).length})</button>
                                            {typeOptions.map(t => <button key={t} onClick={() => { setAuditFilter(t); setAuditPage(1); }} style={{ fontSize: 9, padding: '2px 6px', background: auditFilter === t ? '#ffa50233' : '#333', color: auditFilter === t ? '#ffa502' : '#c8c8c8', border: '1px solid #666', borderRadius: 3, cursor: 'pointer' }}>{t}({violated.filter(r => r.violations.some(v => v.type === t)).length})</button>)}
                                        </div>
                                        <div style={{ maxHeight: 600, overflowY: 'auto', marginBottom: 8 }}>
                                            {paged.map(r => {
                                                const wordCountViolation = r.violations.find(v => v.type === 'wordCountTooLow' || v.type === 'wordCountTooHigh');
                                                const otherViolations = r.violations.filter(v => v.type !== 'wordCountTooLow' && v.type !== 'wordCountTooHigh');
                                                return (
                                                <div key={r.chapterId} style={{ marginBottom: 6, padding: '8px 10px', background: r.criticalCount > 0 ? 'rgba(255,0,68,0.06)' : 'rgba(255,165,0,0.04)', borderRadius: 6, border: `1px solid ${selectedForBatch.has(r.chapterId) ? '#54a0ff' : r.criticalCount > 0 ? 'rgba(255,0,68,0.25)' : 'rgba(255,165,0,0.15)'}` }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <input type="checkbox" checked={selectedForBatch.has(r.chapterId)} onChange={() => {
                                                                const ns = new Set(selectedForBatch);
                                                                if (ns.has(r.chapterId)) ns.delete(r.chapterId); else ns.add(r.chapterId);
                                                                setSelectedForBatch(ns);
                                                            }} disabled={repairingChapter || batchRepairing} style={{ width: 12, height: 12 }} />
                                                            <span style={{ fontSize: 12, color: r.criticalCount > 0 ? '#ff4757' : '#ffa502', fontWeight: 700, cursor: 'pointer' }} onClick={() => setExpandedChapter(expandedChapter === r.chapterId ? null : r.chapterId)}>
                                                                Ch{r.chapterNumber} {r.criticalCount > 0 ? '🔴' : '🟡'} {r.violations.length}项违规
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 10, color: wordCountViolation ? '#ff4757' : '#555', fontWeight: wordCountViolation ? 600 : 400 }}>{r.wordCount}字{wordCountViolation ? (wordCountViolation.type === 'wordCountTooLow' ? ` ⚠差${wordCountViolation.gap || ''}字` : ' ⚠超标') : ''}</span>
                                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 8, padding: '2px 8px' }} onClick={() => setRepairingChapterId(repairingChapterId === r.chapterId ? null : r.chapterId)} disabled={repairingChapter || batchRepairing}>
                                                                {repairingChapter === r.chapterNumber ? '⏳返修中' : '🔧返修'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {expandedChapter === r.chapterId && (
                                                        <div style={{ marginTop: 8 }}>
                                                            {wordCountViolation && (
                                                                <div style={{ padding: '8px 12px', background: 'rgba(255,0,68,0.08)', borderRadius: 6, borderLeft: '4px solid var(--neon-red)', marginBottom: 8 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neon-red)' }}>⚠字数不达标</div>
                                                                    <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4, lineHeight: 1.6 }}>
                                                                        当前 <b>{r.wordCount}</b> 字{wordCountViolation.target ? `，目标${wordCountViolation.target} 字` : ''}{wordCountViolation.gap ? `，还差<b style={{color:'#ff4757'}}>${wordCountViolation.gap}</b> 字` : ''}
                                                                        <br />{wordCountViolation.desc}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {otherViolations.length > 0 && (
                                                                <div style={{ marginBottom: 8 }}>
                                                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neon-red)', marginBottom: 4 }}>🔴违规问题 ({otherViolations.length})</div>
                                                                    {otherViolations.map((v, i) => {
                                                                        const sevColor = v.severity === 'critical' ? 'var(--neon-red)' : v.severity === 'high' ? 'var(--neon-orange)' : 'var(--neon-blue)';
                                                                        return (
                                                                            <div key={i} style={{ padding: '6px 10px', borderLeft: `3px solid ${sevColor}`, marginBottom: 3, fontSize: 11, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                                                                                <span style={{ color: sevColor, fontWeight: 600, fontSize: 9, marginRight: 6 }}>{v.severity?.toUpperCase()}</span>
                                                                                <span style={{ color: sevColor, fontWeight: 600, marginRight: 6 }}>[{v.category}]</span>
                                                                                <span style={{ color: '#ddd' }}>{v.desc}</span>
                                                                                {v.match && <div style={{ fontSize: 10, color: '#d5d5d5', marginTop: 2 }}>匹配: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>{v.match}</code></div>}
                                                                                {v.suggestion && <div style={{ fontSize: 10, color: 'var(--neon-blue)', marginTop: 2 }}>💡 {v.suggestion}</div>}
                                                                                {v.jargons && v.jargons.length > 0 && (
                                                                                    <div style={{ fontSize: 10, marginTop: 2 }}>
                                                                                        {v.jargons.map((j, ji) => (
                                                                                            <div key={ji} style={{ color: '#c8c8c8', marginLeft: 8 }}>
                                                                                                <code style={{ color: '#ff6b6b' }}>{j.match}</code> ?<code style={{ color: '#2ed573' }}>{j.suggestion}</code>{j.perspective ? ` (${j.perspective})` : ''}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                                {v.count !== undefined && <div style={{ fontSize: 10, color: '#d5d5d5', marginTop: 2 }}>数量: {v.count}</div>}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {!expandedChapter && (
                                                        <div style={{ fontSize: 9, color: '#c8c8c8', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                                            {r.violations.map((v, i) => <span key={i} style={{ padding: '0px 4px', borderRadius: 2, background: v.severity === 'critical' ? 'rgba(255,0,68,0.15)' : v.severity === 'high' ? 'rgba(255,165,0,0.12)' : 'rgba(84,160,255,0.1)', color: v.severity === 'critical' ? '#ff4757' : v.severity === 'high' ? '#ffa502' : '#54a0ff' }}>[{v.category}]</span>)}
                                                        </div>
                                                    )}
                                                    {repairingChapterId === r.chapterId && (
                                                        <div style={{ marginTop: 6, padding: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: 4, border: '1px solid rgba(100,200,255,0.3)' }}>
                                                            <div style={{ fontSize: 10, color: '#c8c8c8', marginBottom: 4 }}>返修指令（留空则自动修复所有违规）</div>
                                                            <textarea value={repairInstructions} onChange={e => setRepairInstructions(e.target.value)} placeholder="例：修复全知旁白，改为林晚视角感知；补入3个拟声词；添加2句母子对话" style={{ width: '100%', height: 60, fontSize: 10, background: '#1a1a2e', color: '#eee', border: '1px solid #666', borderRadius: 4, padding: 4, resize: 'vertical' }} />
                                                            <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                                                {repairModels.length > 0 && (
                                                                    <select value={selectedRepairModel} onChange={e => setSelectedRepairModel(e.target.value)} style={{ fontSize: 9, background: '#1a1a2e', color: '#eee', border: '1px solid #666', borderRadius: 3, padding: '2px 4px' }}>
                                                                        {repairModels.map(m => <option key={`${m.provider}|${m.model}`} value={`${m.provider}|${m.model}`}>{m.label}{m.isDefault ? ' (默认)' : ''}</option>)}
                                                                    </select>
                                                                )}
                                                                <label style={{ fontSize: 9, color: '#c8c8c8', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                    <input type="checkbox" defaultChecked={true} id={`autoReview_${r.chapterId}`} style={{ width: 12, height: 12 }} />
                                                                    自动审核
                                                                </label>
                                                                <label style={{ fontSize: 9, color: '#c8c8c8', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                    <input type="checkbox" defaultChecked={true} id={`followUpPipeline_${r.chapterId}`} style={{ width: 12, height: 12 }} />
                                                                    通过后流水线
                                                                </label>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                                                <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 9, background: '#2ed57333', borderColor: '#2ed573' }} disabled={!!repairingChapter || !!retryTaskId || batchRepairing} onClick={async () => {
                                                                    if (repairingChapter || retryTaskId || batchRepairing) return;
                                                                    setRepairingChapter(r.chapterNumber);
                                                                    setRetryCount(0);
                                                                    setRetryProgress({ status: 'running', progress: [], currentPhase: 'repair', currentAttempt: 1 });
                                                                    try {
                                                                        const [provider, model] = (selectedRepairModel || '').split('|');
                                                                        const autoReviewEl = document.getElementById(`autoReview_${r.chapterId}`);
                                                                        const followUpEl = document.getElementById(`followUpPipeline_${r.chapterId}`);
                                                                        const autoReview = autoReviewEl ? autoReviewEl.checked : true;
                                                                        const followUpPipeline = followUpEl ? followUpEl.checked : true;
                                                                        const res = await chapterAuditApi.repairRetry(currentProject.id, r.chapterId, { repairInstructions: repairInstructions || undefined, provider: provider || undefined, model: model || undefined, maxRetries: 10, autoReview, followUpPipeline });
                                                                        const { taskId } = res.data;
                                                                        setRetryTaskId(taskId);
                                                                        setRepairingChapterId(null);
                                                                        setRepairInstructions('');
                                                                        const pollInterval = setInterval(async () => {
                                                                            try {
                                                                                const status = (await chapterAuditApi.repairRetryStatus(taskId)).data;
                                                                                setRetryProgress(status);
                                                                                if (status.status === 'completed') {
                                                                                    clearInterval(pollInterval);
                                                                                    buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                                                                                    setRepairResult(status.result);
                                                                                    setReviewResult(status.result?.reviewResults);
                                                                                    setRetryTaskId(null);
                                                                                    setRepairingChapter(null);
                                                                                    const newAudit = await chapterAuditApi.audit(currentProject.id);
                                                                                    setChapterAuditData(newAudit.data);
                                                                                } else if (status.status === 'error') {
                                                                                    clearInterval(pollInterval);
                                                                                    buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval);
                                                                                    alert('返修失败: ' + status.error);
                                                                                    setRetryTaskId(null); setRetryProgress(null); setRepairingChapter(null);
                                                                                }
                                                                            } catch { clearInterval(pollInterval); buttonPollRefs.current = buttonPollRefs.current.filter(id => id !== pollInterval); setRepairingChapter(null); }
                                                                        }, 3000);
                                                                        buttonPollRefs.current.push(pollInterval);
                                                                    } catch (e) { alert('返修请求失败: ' + e.message); setRepairingChapter(null); setRetryProgress(null); }
                                                                }}>🔄 重试到通过+流水线</button>
                                                                <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 9 }} disabled={!!repairingChapter || !!retryTaskId || batchRepairing} onClick={async () => {
                                                                    if (repairingChapter || retryTaskId || batchRepairing) return;
                                                                    setRepairingChapter(r.chapterNumber);
                                                                    setRetryCount(0);
                                                                    try {
                                                                        const [provider, model] = (selectedRepairModel || '').split('|');
                                                                        const autoReviewEl = document.getElementById(`autoReview_${r.chapterId}`);
                                                                        const autoReview = autoReviewEl ? autoReviewEl.checked : true;
                                                                        const res = await chapterAuditApi.repair(currentProject.id, r.chapterId, { repairInstructions: repairInstructions || undefined, provider: provider || undefined, model: model || undefined, autoReview });
                                                                        const result = res.data;
                                                                        if (result.success) {
                                                                            setRepairResult(result);
                                                                            setReviewResult(result.reviewResults);
                                                                            const newAudit = await chapterAuditApi.audit(currentProject.id);
                                                                            setChapterAuditData(newAudit.data);
                                                                        } else { alert('❌ 返修失败：' + result.error); }
                                                                    } catch (e) { alert('返修请求失败: ' + e.message); }
                                                                    finally { setRepairingChapter(null); setRepairingChapterId(null); setRepairInstructions(''); }
                                                                }}>修一次</button>
                                                                <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 9 }} onClick={() => { setRepairingChapterId(null); setRepairInstructions(''); }}>取消</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ); })}
                                        </div>
                                        {totalPages > 1 && (
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 10 }}>
                                                <button disabled={auditPage <= 1} onClick={() => setAuditPage(auditPage - 1)} style={{ fontSize: 9, padding: '2px 8px', background: '#3a3a4a', color: '#c8c8c8', border: '1px solid #666', borderRadius: 3, cursor: auditPage <= 1 ? 'not-allowed' : 'pointer' }}>◀</button>
                                                <span style={{ color: '#c8c8c8' }}>{auditPage}/{totalPages} (共{filtered.length}条)</span>
                                                <button disabled={auditPage >= totalPages} onClick={() => setAuditPage(auditPage + 1)} style={{ fontSize: 9, padding: '2px 8px', background: '#3a3a4a', color: '#c8c8c8', border: '1px solid #666', borderRadius: 3, cursor: auditPage >= totalPages ? 'not-allowed' : 'pointer' }}>▶</button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })() : (
                                <div style={{ color: '#ffffff', fontSize: 12 }}>点击"全量扫描"检测所有章节违规</div>
                            )}
                        </div>

                        {selectedChapter && chapterIntentInfo && (
                            <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontWeight: 700, color: 'var(--neon-green)' }}>📋 章节意图 第{selectedChapter.chapterNumber}</span>
                                    <button className="cyber-btn cyber-btn-sm" onClick={() => setChapterIntentInfo(null)} style={{ fontSize: 10 }}></button>
                                </div>
                                <div style={{ fontSize: 11 }}>
                                    {chapterIntentInfo.intent.goal && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--neon-blue)', fontWeight: 600 }}>🎯 目标:</span> {typeof chapterIntentInfo.intent.goal === 'string' ? chapterIntentInfo.intent.goal : JSON.stringify(chapterIntentInfo.intent.goal)}</div>}
                                    {chapterIntentInfo.intent.mustKeep?.length > 0 && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--neon-green)', fontWeight: 600 }}>必须保持:</span> {chapterIntentInfo.intent.mustKeep.map(i => typeof i === 'string' ? i : JSON.stringify(i)).join(' | ')}</div>}
                                    {chapterIntentInfo.intent.mustAvoid?.length > 0 && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--neon-red)', fontWeight: 600 }}>🚫 必须避免:</span> {chapterIntentInfo.intent.mustAvoid.map(i => typeof i === 'string' ? i : JSON.stringify(i)).join(' | ')}</div>}
                                    {chapterIntentInfo.intent.styleEmphasis && <div style={{ marginBottom: 6 }}><span style={{ color: '#ffd700', fontWeight: 600 }}>风格强调:</span> {typeof chapterIntentInfo.intent.styleEmphasis === 'string' ? chapterIntentInfo.intent.styleEmphasis : JSON.stringify(chapterIntentInfo.intent.styleEmphasis)}</div>}
                                    {chapterIntentInfo.intent.conflictDesign && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--neon-orange)', fontWeight: 600 }}>⚔️ 冲突:</span> {typeof chapterIntentInfo.intent.conflictDesign === 'string' ? chapterIntentInfo.intent.conflictDesign : JSON.stringify(chapterIntentInfo.intent.conflictDesign)}</div>}
                                    {chapterIntentInfo.intent.chapterEndHook && <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--neon-purple)', fontWeight: 600 }}>🪝 章末钩子:</span> {typeof chapterIntentInfo.intent.chapterEndHook === 'string' ? chapterIntentInfo.intent.chapterEndHook : JSON.stringify(chapterIntentInfo.intent.chapterEndHook)}</div>}
                                    {chapterIntentInfo.intent.hookAdvance?.length > 0 && <div style={{ marginBottom: 6 }}><span style={{ color: '#00d2d3', fontWeight: 600 }}>📌 推进伏笔:</span> {chapterIntentInfo.intent.hookAdvance.map(i => typeof i === 'string' ? i : JSON.stringify(i)).join(' | ')}</div>}
                                    {chapterIntentInfo.intent.hookResolve?.length > 0 && <div style={{ marginBottom: 6 }}><span style={{ color: '#ff6b6b', fontWeight: 600 }}>🔓 回收伏笔:</span> {chapterIntentInfo.intent.hookResolve.map(i => typeof i === 'string' ? i : JSON.stringify(i)).join(' | ')}</div>}
                                    {chapterIntentInfo.intent.hookAgenda && <div style={{ marginBottom: 6 }}><span style={{ color: '#a29bfe', fontWeight: 600 }}>📊 伏笔预算:</span> {chapterIntentInfo.intent.hookAgenda.budgetUsed || 0}/{chapterIntentInfo.intent.hookAgenda.budgetMax || '?'} 已用</div>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div className="cyber-section-title" style={{ margin: 0 }}>选择章节</div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            已写 {chapters.filter(ch => ['written','first-reviewing','second-reviewing','final-editing','approved'].includes(ch.status)).length} / 未写 {chapters.filter(ch => !['written','first-reviewing','second-reviewing','final-editing','approved'].includes(ch.status)).length}
                        </span>
                        {selectedChapter && (
                            <button className="cyber-btn" style={{ background: 'rgba(255,50,50,0.3)', borderColor: '#ff3232' }} onClick={async () => {
                                if (!currentProject || !selectedChapter) return;
                                const chNum = selectedChapter.chapterNumber;
                                const count = chapters.filter(ch => ch.chapterNumber > chNum).length;
                                if (count === 0) { alert('没有后续章节需要清理'); return; }
                                if (!confirm(`确定删除第${chNum + 1}章及以后的所有内容（保留大纲）？{count}章`)) return;
                                try {
                                    const res = await pipelineApi.clearChaptersAfter(currentProject.id, chNum);
                                    if (res.data?.success) {
                                        alert(`已清{res.data.cleared}章的内容（大纲已保留）`);
                                        window.location.reload();
                                    } else { alert('清理失败: ' + (res.data?.error || '未知错误')); }
                                } catch (e) { alert('清理失败: ' + e.message); }
                            }}>
                                🗑删除后续章节内容
                            </button>
                        )}
                    </div>
                    {(() => {
                        const WRITTEN = ['written','first-reviewing','second-reviewing','final-editing','approved','material-updated'];
                        const written = chapters.filter(ch => WRITTEN.includes(ch.status));
                        const unwritten = chapters.filter(ch => !WRITTEN.includes(ch.status));
                        let display;
                        if (chapterFilter === 'written') display = written;
                        else if (chapterFilter === 'unwritten') display = unwritten;
                        else display = chapterCollapsed ? [...written, ...unwritten.slice(0, 10)] : chapters;
                        return (
                            <>
                                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                                    <button className={`cyber-btn cyber-btn-sm ${chapterFilter === 'all' ? 'cyber-btn-primary' : ''}`}
                                        onClick={() => { setChapterFilter('all'); setChapterCollapsed(false); }}
                                        style={{ fontSize: 11, flex: 1 }}>
                                        全部 {chapters.length}
                                    </button>
                                    <button className={`cyber-btn cyber-btn-sm ${chapterFilter === 'written' ? 'cyber-btn-primary' : ''}`}
                                        onClick={() => { setChapterFilter('written'); setChapterCollapsed(false); }}
                                        style={{ fontSize: 11, flex: 1 }}>
                                        已写 {written.length}
                                    </button>
                                    <button className={`cyber-btn cyber-btn-sm ${chapterFilter === 'unwritten' ? 'cyber-btn-primary' : ''}`}
                                        onClick={() => { setChapterFilter('unwritten'); setChapterCollapsed(false); }}
                                        style={{ fontSize: 11, flex: 1 }}>
                                        📋 未写 {unwritten.length}
                                    </button>
                                </div>
                                {chapterFilter === 'all' && unwritten.length > 10 && (
                                    <button className="cyber-btn cyber-btn-sm"
                                        onClick={() => setChapterCollapsed(!chapterCollapsed)}
                                        style={{ fontSize: 10, width: '100%', marginBottom: 6, opacity: 0.7 }}>
                                        {chapterCollapsed
                                            ? `展开全部 (${unwritten.length} 个未写章`
                                            : `折叠未写章节 (仅显示前10`
                                        }
                                    </button>
                                )}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                                    {chapters.length === 0 ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>暂无章节，请先在仪表盘生成章节大</div>
                                    ) : display.map(ch => (
                                        <button
                                            key={ch.id}
                                            className={`cyber-btn cyber-btn-sm ${selectedChapter?.id === ch.id ? 'cyber-btn-primary' : ''}`}
                                            onClick={() => { setSelectedChapter(ch); setViewVersion(null); if (ch.intentPlannerOutput) { pipelineApi.getChapterIntent(currentProject.id, ch.chapterNumber).then(res => { setChapterIntentInfo(res.data); }).catch(() => { setChapterIntentInfo(null); }); } else { setChapterIntentInfo(null); } }}
                                        >
                                            第{ch.chapterNumber}
                                            <span className={`cyber-badge ${ch.status === 'approved' || ch.status === 'material-updated' ? 'cyber-badge-green' : ch.status === 'outlined' ? 'cyber-badge-blue' : 'cyber-badge-orange'}`} style={{ marginLeft: 6 }}>
                                                {ch.status}
                                            </span>
                                        </button>
                                    ))}
                                    {chapterCollapsed && chapterFilter === 'all' && unwritten.length > 10 && (
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px' }}>
                                            +{unwritten.length - 10} 个未写章节已折叠
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                    })()}

                    {selectedChapter && (
                        <>
                            <div className="cyber-card" style={{ marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--neon-blue)' }}>
                                            第{selectedChapter.chapterNumber} {selectedChapter.title}
                                        </h3>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            📊 {selectedChapter.status} | 字数: {selectedChapter.wordCount} | 轮次: {selectedChapter.round}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <label className="form-label" style={{ margin: 0 }}>最大轮次</label>
                                        <input className="cyber-input" type="number" value={maxRounds} onChange={e => setMaxRounds(parseInt(e.target.value) || 3)} min={1} max={10} style={{ width: 60 }} />
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: generateImages ? 'var(--neon-blue)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            <input type="checkbox" checked={generateImages} onChange={e => setGenerateImages(e.target.checked)} style={{ accentColor: 'var(--neon-blue)' }} />
                                            定稿人生成配图
                                        </label>
                                        {generateImages && (
                                            <select className="cyber-input" value={imageAspectRatio} onChange={e => setImageAspectRatio(e.target.value)} style={{ width: 90, padding: '4px 8px', fontSize: 12 }}>
                                                <option value="16:9">16:9 横屏</option>
                                                <option value="3:4">3:4 竖屏</option>
                                                <option value="1:1">1:1 方形</option>
                                                <option value="4:3">4:3 标准</option>
                                                <option value="9:16">9:16 手机</option>
                                            </select>
                                        )}
                                        <button className="cyber-btn cyber-btn-primary" onClick={runFullPipeline} disabled={pipelineState.running}>
                                            {pipelineState.running ? <><span className="cyber-loading"></span> 运行中...</> : '运行本章流水线'}
                                        </button>
                                        {selectedChapter && selectedChapter.status !== 'outlined' && (
                                            <button className="cyber-btn cyber-btn-sm" onClick={() => resetChapterContent(selectedChapter.id, selectedChapter.chapterNumber)}
                                                title="删除正文但保留大纲，可重新运行流水线">
                                                🗑 删除正文
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className={`pipeline-flow ${pipelineState.running ? 'pipeline-running' : ''}`}>
                                    {pipelineSteps.map((step, idx) => {
                                        const status = getStepStatus(step.key);
                                        return (
                                            <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
                                                <div className={`pipeline-node pipeline-node-${status}`}>
                                                    <div className="pipeline-node-icon" style={{
                                                        borderColor: status === 'done' ? 'var(--neon-green)' : status === 'active' ? step.color : undefined,
                                                        color: step.color
                                                    }}>
                                                        {step.icon}
                                                    </div>
                                                    <div className="pipeline-node-label">{step.label}</div>
                                                    <button className="cyber-btn cyber-btn-sm" onClick={() => runStep(step.key)} disabled={pipelineState.running} style={{ marginTop: 6, fontSize: 10 }}>
                                                        执行
                                                    </button>
                                                </div>
                                                {idx < pipelineSteps.length - 1 && (
                                                    <div className={`pipeline-arrow ${status === 'done' ? 'pipeline-arrow-active' : ''}`} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="cyber-section-title">章节内容</div>
                                        {selectedChapter.history?.length > 0 && (
                                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>版本:</span>
                                                <button className={`cyber-btn cyber-btn-sm ${viewVersion === null ? 'cyber-btn-primary' : ''}`}
                                                    onClick={() => setViewVersion(null)} style={{ fontSize: 10 }}>
                                                    最R{selectedChapter.round})
                                                </button>
                                                {selectedChapter.history.map((snap, i) => (
                                                    <button key={i} className={`cyber-btn cyber-btn-sm ${viewVersion === i ? 'cyber-btn-primary' : ''}`}
                                                        onClick={() => setViewVersion(i)} style={{ fontSize: 10, opacity: 0.7 }}>
                                                        R{snap.round}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="cyber-card" style={{ maxHeight: 400, overflow: 'auto' }}>
                                        {viewVersion !== null && (
                                            <div style={{ padding: '6px 10px', background: 'rgba(255,165,2,0.1)', borderBottom: '1px solid var(--border-color)', fontSize: 11, color: '#ffa502', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>📋 查看第{selectedChapter.history[viewVersion]?.round}轮淘汰版</span>
                                                <button className="cyber-btn cyber-btn-sm" onClick={() => setViewVersion(null)} style={{ fontSize: 10 }}>返回最</button>
                                            </div>
                                        )}
                                        {getDisplayData().content && getDisplayData().content !== '暂无内容' ? (
                                            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8 }}>
                                                {getDisplayData().content}
                                            </div>
                                        ) : (
                                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>尚无内容，请运行流水线</div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <div className="cyber-section-title">执行日志</div>
                                    <div style={{ maxHeight: 400, overflow: 'auto' }}>
                                        {pipelineState.logs.length === 0 && reviewLogs.length === 0 ? (
                                            <div className="cyber-card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>暂无日志</div>
                                        ) : (
                                            <>
                                                {pipelineState.logs.map((log, idx) => {
                                                    const stepInfo = pipelineSteps.find(s => s.key === log.step);
                                                    const beijingTime = formatTime(log.timestamp || log.time);
                                                    const affectedCh = log.affectedChapter || log.result?.affectedChapter || log.chapterNumber;
                                                    const icon = stepInfo?.icon || AGENT_ICONS[log.step] || '❓';
                                                    const label = stepInfo?.label || AGENT_LABELS[log.step] || log.step || '';
                                                    const isPassed = log.result?.passed ?? log.passed;
                                                    const isStatusMsg = !stepInfo && ['pipeline-start','pipeline-done','pipeline-error','pipeline-stop','cooldown','chapter-skip','outline-supplement','chapter-status'].includes(log.step);
                                                    return (
                                                    <div key={`pl-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid var(--border-color)', fontSize: 12, ...(isStatusMsg ? { background: 'rgba(255,255,255,0.02)' } : {}) }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                            <span style={{ color: stepInfo?.color || 'var(--neon-purple)', fontWeight: 600, minWidth: 60, whiteSpace: 'nowrap' }}>
                                                                {icon} {label}
                                                            </span>
                                                            {affectedCh && (
                                                                <span className="cyber-badge" style={{ background: 'rgba(0,210,211,0.15)', color: '#00d2d3', fontSize: 10 }}>
                                                                    第${affectedCh}章
                                                                </span>
                                                            )}
                                                            {log.round && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>R{log.round}</span>}
                                                            {log.status === 'running' && <span className="cyber-loading"></span>}
                                                            {log.status === 'error' && <span style={{ color: 'var(--neon-red)' }}>错误</span>}
                                                            {isPassed !== undefined && (
                                                                <span className={`cyber-badge ${isPassed ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                                                                    {isPassed ? '通过' : '未通过'}
                                                                </span>
                                                            )}
                                                            {log.msg && (isStatusMsg || !stepInfo) && (
                                                                <span style={{ color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {log.msg.replace(/[━]/g, '').trim().substring(0, 60)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 8 }}>{beijingTime}</span>
                                                    </div>
                                                    );
                                                })}
                                                {reviewLogs.map(review => {
                                                    const isPassed = review.result?.passed === true || review.result?.approved === true || review.passed === true;
                                                    const issues = review.result?.issues || review.issues || [];
                                                    const suggestions = review.result?.suggestions || review.suggestions || [];
                                                    const edits = review.result?.edits || [];
                                                    const summary = review.result?.summary || review.content || '';
                                                    const styleScore = review.result?.styleScore;
                                                    const round = review.round || 1;
                                                    return (
                                                    <div key={review.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', fontSize: 12 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span style={{ fontWeight: 600, color: 'var(--neon-purple)' }}>{AGENT_LABELS[review.type] || review.type}</span>
                                                                <span className={`cyber-badge ${isPassed ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                                                                    {isPassed ? '通过' : '未通过'}
                                                                </span>
                                                                {styleScore && <span className="cyber-badge cyber-badge-blue">风格{styleScore}/10</span>}
                                                                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>R{round}</span>
                                                            </div>
                                                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{review.createdAt}</span>
                                                        </div>
                                                        {summary && (
                                                            <div style={{ color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{typeof summary === 'string' ? summary.substring(0, 200) : JSON.stringify(summary).substring(0, 200)}</div>
                                                        )}
                                                        {issues.length > 0 && (
                                                            <div style={{ marginTop: 4 }}>
                                                                {issues.map((issue, i) => {
                                                                    const desc = typeof issue === 'string' ? issue : (issue.description || issue.title || JSON.stringify(issue));
                                                                    const severity = issue.severity || 'medium';
                                                                    const sevColor = severity === 'critical' ? 'var(--neon-red)' : severity === 'high' ? 'var(--neon-orange)' : 'var(--text-muted)';
                                                                    return <div key={i} style={{ color: sevColor, fontSize: 11, lineHeight: 1.4, paddingLeft: 8, borderLeft: `2px solid ${sevColor}`, marginBottom: 2 }}>{desc.substring(0, 120)}</div>;
                                                                })}
                                                            </div>
                                                        )}
                                                        {edits.length > 0 && (
                                                            <div style={{ marginTop: 4 }}>
                                                                {edits.map((edit, i) => {
                                                                    const desc = typeof edit === 'string' ? edit : (edit.description || JSON.stringify(edit));
                                                                    const severity = edit.severity || 'minor';
                                                                    const sevColor = severity === 'critical' ? 'var(--neon-red)' : 'var(--neon-orange)';
                                                                    return <div key={i} style={{ color: sevColor, fontSize: 11, lineHeight: 1.4, paddingLeft: 8, borderLeft: `2px solid ${sevColor}`, marginBottom: 2 }}>{desc.substring(0, 120)}</div>;
                                                                })}
                                                            </div>
                                                        )}
                                                        {suggestions.length > 0 && (
                                                            <div style={{ marginTop: 4 }}>
                                                                {suggestions.slice(0, 3).map((sug, i) => {
                                                                    const desc = typeof sug === 'string' ? sug : JSON.stringify(sug);
                                                                    return <div key={i} style={{ color: 'var(--neon-blue)', fontSize: 11, lineHeight: 1.4, paddingLeft: 8, borderLeft: '2px solid var(--neon-blue)', marginBottom: 2 }}>💡 {desc.substring(0, 120)}</div>;
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 20 }}>
                                <div className="cyber-section-title">Agent输出详情</div>
                                <div className="cyber-tabs">
                                    {outputTabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            className={`cyber-tab ${activeOutputTab === tab.key ? 'cyber-tab-active' : ''}`}
                                            onClick={() => setActiveOutputTab(tab.key)}
                                            style={activeOutputTab === tab.key ? { borderColor: tab.color, color: tab.color } : {}}
                                        >
                                            {tab.label}
                                            {selectedChapter?.[tab.key] && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}></span>}
                                        </button>
                                    ))}
                                </div>
                                <div className="cyber-card" style={{ maxHeight: 500, overflow: 'auto' }}>
                                    {viewVersion !== null && (
                                        <div style={{ padding: '6px 10px', background: 'rgba(255,165,2,0.1)', borderBottom: '1px solid var(--border-color)', fontSize: 11, color: '#ffa502' }}>
                                            📋 第{selectedChapter.history[viewVersion]?.round}轮淘汰版本的Agent输出
                                        </div>
                                    )}
                                    {(() => {
                                        const raw = getDisplayData().output;
                                        if (!raw || raw === '暂无输出') return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>暂无输出</div>;
                                        const isReviewOutput = activeOutputTab === 'firstReviewOutput' || activeOutputTab === 'secondReviewOutput' || activeOutputTab === 'finalEditorOutput' || activeOutputTab === 'firstReviewOutput';
                                        const isMaterialOutput = activeOutputTab === 'materialManagerOutput';
                                        if (isReviewOutput || isMaterialOutput) {
                                            try {
                                                const parsed = typeof raw === 'string' ? JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw) : raw;
                                                if (isMaterialOutput) {
                                                    const updates = parsed.updates || [];
                                                    const rawArchiveLog = parsed.archiveLog;
                                                    const archiveLog = Array.isArray(rawArchiveLog) ? rawArchiveLog : (typeof rawArchiveLog === 'string' && rawArchiveLog ? [rawArchiveLog] : []);
                                                    const rawForeshadow = parsed.foreshadowTracking;
                                                    const foreshadowTracking = Array.isArray(rawForeshadow) ? rawForeshadow : (typeof rawForeshadow === 'string' && rawForeshadow ? [rawForeshadow] : []);
                                                    const createItems = updates.filter(u => u.action === 'create' || !u.action);
                                                    const updateItems = updates.filter(u => u.action === 'update');
                                                    const archiveItems = updates.filter(u => ['retire', 'deprecate', 'recycle'].includes(u.action));
                                                    return (
                                                        <div style={{ padding: 12 }}>
                                                            {parsed.summary && (
                                                                <div className="markdown-content" style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                                                                    <SafeMarkdown>{parsed.summary}</SafeMarkdown>
                                                                </div>
                                                            )}
                                                            {createItems.length > 0 && (
                                                                <div style={{ marginBottom: 10 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-green)', marginBottom: 6 }}>🆕新建素材 ({createItems.length})</div>
                                                                    {createItems.map((u, i) => {
                                                                        const uType = safeStr(u.type);
                                                                        const uName = safeStr(u.name);
                                                                        const uReason = u.reason ? safeStr(u.reason) : '';
                                                                        let uContent = '';
                                                                        if (u.content) {
                                                                            if (typeof u.content === 'string') {
                                                                                uContent = u.content;
                                                                            } else if (typeof u.content === 'object') {
                                                                                uContent = Object.entries(u.content).map(([k, v]) => `**${k}**：${safeStr(v)}`).join('\n');
                                                                            } else {
                                                                                uContent = String(u.content);
                                                                            }
                                                                        }
                                                                        return (
                                                                        <div key={i} style={{ padding: '6px 10px', borderLeft: '3px solid var(--neon-green)', marginBottom: 4, fontSize: 12, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                                                                            <span style={{ color: 'var(--neon-purple)', fontWeight: 600, marginRight: 6 }}>[{uType}]</span>
                                                                            <span style={{ fontWeight: 600 }}>{uName}</span>
                                                                            {uReason && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>📝{uReason}</span>}
                                                                            {uContent && <div className="markdown-content" style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)', padding: '4px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}><SafeMarkdown>{uContent.substring(0, 500)}{uContent.length > 500 ? '...' : ''}</SafeMarkdown></div>}
                                                                        </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            {updateItems.length > 0 && (
                                                                <div style={{ marginBottom: 10 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-blue)', marginBottom: 6 }}>📝 更新素材 ({updateItems.length})</div>
                                                                    {updateItems.map((u, i) => {
                                                                        const uType = safeStr(u.type);
                                                                        const uName = safeStr(u.name);
                                                                        const uReason = u.reason ? safeStr(u.reason) : '';
                                                                        return (
                                                                        <div key={i} style={{ padding: '6px 10px', borderLeft: '3px solid var(--neon-blue)', marginBottom: 4, fontSize: 12, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                                                                            <span style={{ color: 'var(--neon-purple)', fontWeight: 600, marginRight: 6 }}>[{uType}]</span>
                                                                            <span style={{ fontWeight: 600 }}>{uName}</span>
                                                                            {uReason && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>?{uReason}</span>}
                                                                        </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            {archiveItems.length > 0 && (
                                                                <div style={{ marginBottom: 10 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-orange)', marginBottom: 6 }}>📦 归档素材 ({archiveItems.length})</div>
                                                                    {archiveItems.map((u, i) => {
                                                                        const uType = safeStr(u.type);
                                                                        const uName = safeStr(u.name);
                                                                        const uAction = safeStr(u.action);
                                                                        const uReason = u.reason ? safeStr(u.reason) : '';
                                                                        return (
                                                                        <div key={i} style={{ padding: '6px 10px', borderLeft: '3px solid var(--neon-orange)', marginBottom: 4, fontSize: 12, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                                                                            <span style={{ color: 'var(--neon-purple)', fontWeight: 600, marginRight: 6 }}>[{uType}]</span>
                                                                            <span style={{ fontWeight: 600 }}>{uName}</span>
                                                                            <span className="cyber-badge" style={{ marginLeft: 8, fontSize: 10 }}>{uAction}</span>
                                                                            {uReason && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>?{uReason}</span>}
                                                                        </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            {foreshadowTracking.length > 0 && (
                                                                <div style={{ marginBottom: 10 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-purple)', marginBottom: 6 }}>🔮 伏笔追踪 ({foreshadowTracking.length})</div>
                                                                    {foreshadowTracking.map((ft, i) => {
                                                                        const ftName = safeStr(ft.name);
                                                                        const ftStatus = safeStr(ft.status);
                                                                        let ftDetail = '';
                                                                        if (ft.detail) {
                                                                            if (typeof ft.detail === 'string') ftDetail = ft.detail;
                                                                            else if (typeof ft.detail === 'object') ftDetail = Object.entries(ft.detail).map(([k, v]) => `${k}：${safeStr(v)}`).join('；');
                                                                            else ftDetail = String(ft.detail);
                                                                        }
                                                                        const isRecovered = ftStatus === '已回收' || ftStatus === '回收';
                                                                        return (
                                                                            <div key={i} style={{ padding: '6px 10px', borderLeft: `3px solid ${isRecovered ? 'var(--neon-green)' : 'var(--neon-orange)'}`, marginBottom: 4, fontSize: 12, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                                                                                <span style={{ fontWeight: 600 }}>{ftName}</span>
                                                                                <span className={`cyber-badge ${isRecovered ? 'cyber-badge-green' : 'cyber-badge-purple'}`} style={{ marginLeft: 8, fontSize: 10 }}>{ftStatus}</span>
                                                                                {ftDetail && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{ftDetail}</span>}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            {archiveLog.length > 0 && (
                                                                <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(255,165,0,0.06)', borderRadius: 8, border: '1px solid rgba(255,165,0,0.15)' }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-orange)', marginBottom: 6 }}>📋 归档日志 ({archiveLog.length})</div>
                                                                    {archiveLog.map((log, i) => (
                                                                        <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                                                            {typeof log === 'string' ? log : `${log.action || ''} ${log.name || ''}: ${log.reason || ''}`}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                const isApproved = !!(parsed.passed || parsed.approved);
                                                const isOverridden = !!parsed._overridden;
                                                const overrideReason = parsed._overrideReason || '';
                                                return (
                                                    <div style={{ padding: 12 }}>
                                                        {isOverridden && (
                                                            <div style={{ padding: '8px 12px', marginBottom: 10, background: 'rgba(255,165,2,0.1)', borderRadius: 8, border: '1px solid rgba(255,165,2,0.3)', fontSize: 12, color: '#ffa502' }}>
                                                                🔄 系统覆盖通过 — {overrideReason}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                                            <div style={{ flex: '0 0 auto', padding: '12px 16px', background: isApproved ? (isOverridden ? 'rgba(255,165,2,0.1)' : 'rgba(46,213,115,0.1)') : 'rgba(255,0,68,0.1)', borderRadius: 10, borderLeft: `4px solid ${isApproved ? (isOverridden ? '#ffa502' : 'var(--neon-green)') : 'var(--neon-red)'}`, minWidth: 140 }}>
                                                                <div style={{ fontSize: 22, marginBottom: 4 }}>{isApproved ? (isOverridden ? '🔄' : '✅') : '❌'}</div>
                                                                <div style={{ fontSize: 16, fontWeight: 700, color: isApproved ? (isOverridden ? '#ffa502' : 'var(--neon-green)') : 'var(--neon-red)' }}>{isApproved ? (isOverridden ? '覆盖通过' : '审核通过') : '未通过'}</div>
                                                                {parsed.styleScore && <div style={{ fontSize: 12, color: 'var(--neon-blue)', marginTop: 4 }}>风格 {parsed.styleScore}/10</div>}
                                                                {parsed.action && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>动作: {parsed.action}</div>}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                {parsed.summary && (
                                                                    <div className="markdown-content" style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
                                                                        <SafeMarkdown>{parsed.summary}</SafeMarkdown>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {parsed.issues?.length > 0 && (
                                                            <div style={{ marginBottom: 10 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-red)', marginBottom: 6 }}>⚠ 发现问题 ({parsed.issues.length})</div>
                                                                {parsed.issues.map((issue, i) => {
                                                                    const desc = typeof issue === 'string' ? issue : (issue.description || issue.title || JSON.stringify(issue));
                                                                    const severity = issue.severity || 'medium';
                                                                    const sevColor = severity === 'critical' ? 'var(--neon-red)' : severity === 'high' ? 'var(--neon-orange)' : 'var(--text-muted)';
                                                                    return <div key={i} className="markdown-content" style={{ padding: '6px 10px', borderLeft: `3px solid ${sevColor}`, marginBottom: 4, fontSize: 12, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                                                                        <span style={{ color: sevColor, fontWeight: 600, fontSize: 10, marginRight: 6 }}>{severity.toUpperCase()}</span>
                                                                        <SafeMarkdown>{desc}</SafeMarkdown>
                                                                    </div>;
                                                                })}
                                                            </div>
                                                        )}
                                                        {parsed.edits?.length > 0 && (
                                                            <div style={{ marginBottom: 10 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-orange)', marginBottom: 6 }}>📝修改记录({parsed.edits.length})</div>
                                                                {parsed.edits.map((edit, i) => {
                                                                    const desc = typeof edit === 'string' ? edit : (edit.description || JSON.stringify(edit));
                                                                    const severity = edit.severity || 'minor';
                                                                    return <div key={i} className="markdown-content" style={{ padding: '6px 10px', borderLeft: '3px solid var(--neon-orange)', marginBottom: 4, fontSize: 12, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                                                                        <span style={{ color: severity === 'critical' ? 'var(--neon-red)' : 'var(--neon-orange)', fontWeight: 600, fontSize: 10, marginRight: 6 }}>{severity.toUpperCase()}</span>
                                                                        <SafeMarkdown>{desc}</SafeMarkdown>
                                                                    </div>;
                                                                })}
                                                            </div>
                                                        )}
                                                        {parsed.suggestions?.length > 0 && (
                                                            <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(0,210,211,0.06)', borderRadius: 8, border: '1px solid rgba(0,210,211,0.15)' }}>
                                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-blue)', marginBottom: 6 }}>💡 建议 ({parsed.suggestions.length})</div>
                                                                {parsed.suggestions.map((sug, i) => {
                                                                    const desc = typeof sug === 'string' ? sug : safeStr(sug);
                                                                    return <div key={i} className="markdown-content" style={{ padding: '6px 10px', borderLeft: '3px solid var(--neon-blue)', marginBottom: 4, fontSize: 12, lineHeight: 1.5, background: 'var(--bg-secondary)', borderRadius: '0 6px 6px 0' }}>
                                                                        <SafeMarkdown>{desc}</SafeMarkdown>
                                                                    </div>;
                                                                })}
                                                            </div>
                                                        )}
                                                        {parsed.ipDirection && <div className="markdown-content" style={{ padding: '8px 12px', background: 'rgba(46,213,115,0.08)', borderRadius: 8, fontSize: 12, lineHeight: 1.5, borderLeft: '3px solid var(--neon-green)' }}>📌 后续方向: <SafeMarkdown>{parsed.ipDirection}</SafeMarkdown></div>}
                                                        {parsed.materialGuidance && <div className="markdown-content" style={{ padding: '8px 12px', background: 'rgba(126,87,194,0.08)', borderRadius: 8, fontSize: 12, lineHeight: 1.5, marginTop: 6, borderLeft: '3px solid var(--neon-purple)' }}>📦 素材指导: <SafeMarkdown>{parsed.materialGuidance}</SafeMarkdown></div>}
                                                    </div>
                                                );
                                            } catch (e) {
                                                return (
                                                    <div className="markdown-content" style={{ padding: 12 }}>
                                                        <SafeMarkdown>{raw}</SafeMarkdown>
                                                    </div>
                                                );
                                            }
                                        }
                                        return (
                                            <div className="markdown-content" style={{ padding: 12, fontSize: 14, lineHeight: 1.8 }}>
                                                <SafeMarkdown>{raw}</SafeMarkdown>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div style={{ marginTop: 20 }}>
                                <div className="cyber-section-title">Agent输出文件路径</div>
                                <div className="cyber-card">
                                    <table className="cyber-table">
                                        <thead>
                                            <tr>
                                                <th>Agent</th>
                                                <th>文件路径</th>
                                                <th>状态</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(outputPaths).map(([agentType, info]) => (
                                                <tr key={agentType}>
                                                    <td style={{ fontWeight: 600, color: pipelineSteps.find(s => s.key === agentType)?.color || 'var(--neon-purple)' }}>
                                                        {AGENT_LABELS[agentType] || agentType}
                                                    </td>
                                                    <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                                        {info.relative}
                                                    </td>
                                                    <td>
                                                        <span className={`cyber-badge ${info.exists ? 'cyber-badge-green' : 'cyber-badge-orange'}`}>
                                                            {info.exists ? '已生成' : '未生成'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div style={{ marginTop: 20 }}>
                                <div className="cyber-section-title">章节配图</div>
                                <div className="cyber-card">
                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                                        使用MiniMax图片生成模型，根据章节中悬念/人物/场景等高讨论度内容自动生成配图
                                        图片命名格式：第XX章_章节号_场景描述.png章节场景描述.png
                                    </p>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                                        <button className="cyber-btn cyber-btn-primary" onClick={async () => {
                                            if (!currentProject || !selectedChapter) return;
                                            try {
                                                const res = await pipelineApi.generateImages({
                                                    projectId: currentProject.id,
                                                    chapterId: selectedChapter.id,
                                                    aspectRatio: imageAspectRatio
                                                });
                                                addPipelineLog({ step: 'image-generation', status: 'done', result: res.data, timestamp: new Date().toISOString() });
                                                loadChapterImages();
                                            } catch (e) {
                                                addPipelineLog({ step: 'image-generation', status: 'error', error: e.message, timestamp: new Date().toISOString() });
                                            }
                                        }} disabled={pipelineState.running}>
                                            🖼 手动生成配图
                                        </button>
                                        <button className="cyber-btn" onClick={loadChapterImages}>刷新图片列表</button>
                                        <select className="cyber-input" value={imageAspectRatio} onChange={e => setImageAspectRatio(e.target.value)} style={{ width: 110, padding: '4px 8px', fontSize: 12 }}>
                                            <option value="16:9">16:9 横屏</option>
                                            <option value="3:4">3:4 竖屏</option>
                                            <option value="1:1">1:1 方形</option>
                                            <option value="4:3">4:3 标准</option>
                                            <option value="9:16">9:16 手机</option>
                                        </select>
                                    </div>
                                    {chapterImages.length > 0 ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                                            {chapterImages.map((img, idx) => (
                                                <div key={idx} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}>
                                                    <img src={img.filePath} alt={img.fileName} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                                                    <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {img.fileName}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                                            暂无配图，运行流水线时开启定稿人生成配图，或点🖼手动生成配图
                                        </div>
                                    )}
                                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 8 }}>
                                        图片输出目录: output/{currentProject.id}/images/
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
