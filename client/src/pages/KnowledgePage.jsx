import { useLocation } from 'react-router-dom';
import { franchiseApi } from '../services/api';
import useAppStore from '../store/useAppStore';
import useKnowledgeState from './knowledge/useKnowledgeState';
import OverviewPanel from './knowledge/OverviewPanel';
import MemoryPanel from './knowledge/MemoryPanel';
import GraphPanel from './knowledge/GraphPanel';
import PowerTracker from './knowledge/PowerTracker';
import TimelineKnowledgePanel from './knowledge/TimelineKnowledgePanel';
import ForeshadowPanel from './knowledge/ForeshadowPanel';
import ConsistencyPanel from './knowledge/ConsistencyPanel';
import SnapshotPanel from './knowledge/SnapshotPanel';
import { KNOWLEDGE_TABS } from './knowledge/knowledgeConstants';
import './knowledge/knowledge.css';

export default function KnowledgePage() {
    const location = useLocation();
    const initialTab = location.state?.initialTab;
    const state = useKnowledgeState(initialTab);
    const { currentProject } = useAppStore();

    if (!currentProject) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <div className="empty-state-icon">⬡</div>
                    <div className="empty-state-text">请先选择一个项目</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <KnowledgeHeader state={state} />
            <KnowledgeTabs activeTab={state.activeTab} setActiveTab={state.setActiveTab} />
            {state.loading && (
                <div className="knowledge-loading">
                    <div className="spinner" /> 处理中...
                </div>
            )}
            <KnowledgeContent state={state} />
        </div>
    );
}

function KnowledgeHeader({ state }) {
    const handleFileImport = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !state.projectId) return;
        const formData = new FormData();
        formData.append('projectId', state.projectId);
        for (const file of files) formData.append('files', file);
        try {
            const res = await franchiseApi.importFileToProject(formData);
            const counts = res.data?.importCounts;
            if (counts) {
                const imported = Object.entries(counts).filter(([, v]) => v > 0)
                    .map(([k, v]) => `${k}: ${v}`).join(', ');
                alert(`导入完成: ${imported}`);
            }
            window.location.reload();
        } catch (err) {
            alert('导入失败: ' + (err.response?.data?.error || err.message));
        }
        e.target.value = '';
    };

    return (
        <div className="page-header">
            <div className="knowledge-header">
                <div>
                    <h1 className="page-title">知识库 · 一致性守护</h1>
                    <div className="page-subtitle">300万字长篇一致性保障系统 | 分层记忆 · 智能校验 · 可视化纠偏</div>
                </div>
                <button className="cyber-btn cyber-btn-primary knowledge-import-btn" onClick={() => {
                    const input = document.getElementById('knowledge-file-import');
                    if (input) input.click();
                }}>
                    📄 从文件导入素材
                </button>
                <input id="knowledge-file-import" type="file" accept=".txt,.md,.markdown" multiple
                    className="knowledge-file-input" onChange={handleFileImport} />
            </div>
        </div>
    );
}

function KnowledgeTabs({ activeTab, setActiveTab }) {
    return (
        <div className="knowledge-tabs">
            {KNOWLEDGE_TABS.map(tab => (
                <button
                    key={tab.key}
                    className={`knowledge-tab-btn ${activeTab === tab.key ? 'knowledge-tab-active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                >
                    <span>{tab.icon}</span> {tab.label}
                </button>
            ))}
        </div>
    );
}

function KnowledgeContent({ state }) {
    return (
        <>
            {state.activeTab === 'overview' && <OverviewPanel overview={state.overview} onRefresh={state.loadOverview} />}
            {state.activeTab === 'memory' && <MemoryPanel layers={state.memoryLayers} onBuild={state.handleBuildMemory} projectId={state.projectId} />}
            {state.activeTab === 'graph' && <GraphPanel graph={state.graph} onRefresh={state.loadGraph} />}
            {state.activeTab === 'power' && <PowerTracker powerData={state.powerData} onCharSelect={state.handleCharTimeline} selectedCharId={state.selectedCharId} charTimeline={state.charTimeline} />}
            {state.activeTab === 'timeline' && <TimelineKnowledgePanel events={state.timelineEvents} stats={state.timelineStats} filter={state.timelineFilter} setFilter={state.setTimelineFilter} projectId={state.projectId} onRefresh={state.loadTimeline} />}
            {state.activeTab === 'foreshadowing' && <ForeshadowPanel foreshadowings={state.foreshadowings} onRefresh={state.loadForeshadowing} />}
            {state.activeTab === 'consistency' && <ConsistencyPanel result={state.consistencyResult} reports={state.consistencyReports} checkChapter={state.checkChapter} setCheckChapter={state.setCheckChapter} onCheck={state.handleConsistencyCheck} onAiCheck={state.handleAiCheck} loading={state.loading} />}
            {state.activeTab === 'snapshots' && <SnapshotPanel snapshots={state.snapshots} diff={state.snapshotDiff} onDiff={state.handleSnapshotDiff} projectId={state.projectId} />}
        </>
    );
}
