import { isStepOutputVisible, AGENT_LABELS } from './pipelineConstants';
import SafeMarkdown from './SafeMarkdown';
import MaterialOutputViewer from './MaterialOutputViewer';
import ReviewOutputViewer from './ReviewOutputViewer';
import ConstraintsPanel from './ConstraintsPanel';
import s from './OutputViewer.module.css';

const REVIEW_OUTPUT_TABS = ['firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput'];
const MATERIAL_OUTPUT_TAB = 'materialManagerOutput';
const CONSTRAINTS_TAB_KEY = 'consistencyConstraintsOutput';

const getOutputData = ({ selectedChapter, activeOutputTab, viewVersion, pipelineState, reviewLogs: _reviewLogs, pipelineConfig: _pipelineConfig, constraintsData }) => {
    if (!selectedChapter) return '暂无输出';
    if (activeOutputTab === CONSTRAINTS_TAB_KEY) return constraintsData;
    if (viewVersion !== null && selectedChapter.history?.[viewVersion]) {
        return selectedChapter.history[viewVersion][activeOutputTab] || '暂无输出';
    }
    if (!isStepOutputVisible(activeOutputTab, selectedChapter)) return '⏳ 该步骤尚未执行，等待上游步骤完成';
    let output = selectedChapter[activeOutputTab];
    if (!output || (typeof output === 'object' && !Array.isArray(output) && Object.keys(output).length === 0)) output = '';
    if (!output && activeOutputTab === 'intentPlannerOutput') {
        const intentLogs = pipelineState.logs.filter(l => l.step === 'intent-planner' && (l.chapterNumber === selectedChapter.chapterNumber || !l.chapterNumber));
        if (intentLogs.length > 0) output = intentLogs.map(l => l.msg || '').filter(Boolean).join('\n\n') || '意图规划已执行，但输出数据未保存到章节数据中。';
    }
    if (!output && activeOutputTab === 'readerOutput') {
        const readerLogs = pipelineState.logs.filter(l => l.step === 'reader' && l.chapterNumber === selectedChapter.chapterNumber);
        if (readerLogs.length > 0) output = readerLogs.map(l => l.msg || '').filter(Boolean).join('\n\n') || '阅读者已执行，但输出数据未保存到章节数据中。';
    }
    return output || '暂无输出';
};

const renderOutputContent = (raw, activeOutputTab) => {
    if (raw && typeof raw !== 'string' && activeOutputTab === CONSTRAINTS_TAB_KEY) return raw;
    if (!raw || raw === '暂无输出') return <div className={s.emptyOutput}>暂无输出</div>;
    if (activeOutputTab === MATERIAL_OUTPUT_TAB) return <MaterialOutputViewer raw={raw} />;
    if (REVIEW_OUTPUT_TABS.includes(activeOutputTab)) return <ReviewOutputViewer raw={raw} stepKey={activeOutputTab} />;
    return <div className={`markdown-content ${s.markdownWrap}`}><SafeMarkdown>{raw}</SafeMarkdown></div>;
};

export default function OutputViewer({ selectedChapter, activeOutputTab, setActiveOutputTab, outputTabs, pipelineState, reviewLogs, viewVersion, outputPaths, pipelineSteps, pipelineConfig, projectId }) {
    const constraintsData = activeOutputTab === CONSTRAINTS_TAB_KEY ? <ConstraintsPanel projectId={projectId} /> : null;
    const raw = getOutputData({ selectedChapter, activeOutputTab, viewVersion, pipelineState, reviewLogs, pipelineConfig, constraintsData });

    return (
        <>
            <div className={s.outputSection}>
                <div className="cyber-section-title">Agent输出详情</div>
                <div className="cyber-tabs">
                    {outputTabs.map(tab => (
                        <button key={tab.key} className={`cyber-tab ${activeOutputTab === tab.key ? 'cyber-tab-active' : ''}`} onClick={() => setActiveOutputTab(tab.key)}
                            style={activeOutputTab === tab.key ? { borderColor: tab.color, color: tab.color } : {}}>
                            {tab.label}
                            {selectedChapter?.[tab.key] && <span className={s.tabIndicator}></span>}
                        </button>
                    ))}
                </div>
                <div className={`cyber-card ${s.outputCard}`}>
                    {viewVersion !== null && (
                        <div className={s.versionBanner}>
                            📋 第{selectedChapter.history[viewVersion]?.round}轮淘汰版本的Agent输出
                        </div>
                    )}
                    <div className={s.scrollAreaTall}>{renderOutputContent(raw, activeOutputTab)}</div>
                </div>
            </div>
            <div className={s.outputSection}>
                <div className="cyber-section-title">Agent输出文件路径</div>
                <div className="cyber-card">
                    <table className="cyber-table">
                        <thead><tr><th>Agent</th><th>文件路径</th><th>状态</th></tr></thead>
                        <tbody>
                            {Object.entries(outputPaths).map(([agentType, info]) => {
                                const stepColor = pipelineSteps.find(st => st.key === agentType)?.color;
                                return (
                                    <tr key={agentType}>
                                        <td className={`${s.agentName} ${stepColor ? '' : s.agentNameDefault}`} style={stepColor ? { color: stepColor } : {}}>{AGENT_LABELS[agentType] || agentType}</td>
                                        <td className={s.agentPath}>{info.relative}</td>
                                        <td><span className={`cyber-badge ${info.exists ? 'cyber-badge-green' : 'cyber-badge-orange'}`}>{info.exists ? '已生成' : '未生成'}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
