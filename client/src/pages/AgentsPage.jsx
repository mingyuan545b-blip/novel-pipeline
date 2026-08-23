import useAgentsState from './agents/useAgentsState';
import AgentCard from './agents/AgentCard';
import AgentDetailPanel from './agents/AgentDetailPanel';
import ConstraintList from './agents/ConstraintList';
import ProfileList from './agents/ProfileList';
import TemplatesPanel from './agents/TemplatesPanel';
import { TABS } from './agents/agentConstants';

export default function AgentsPage() {
    const s = useAgentsState();
    const {
        currentProject, activeTab, setActiveTab, selectedAgent, editPrompt, setEditPrompt,
        saving, hasChanges, selectedTemplate, templateEditSystem, setTemplateEditSystem,
        templateSaving, templateHasChanges, selectedConstraint, setSelectedConstraint,
        selectedProfile, setSelectedProfile, applying, showResolvedPrompt, resolvedPrompt,
        resolvedPromptLoading, agents, templates, constraints, profiles, mode, projectId,
        loadAgentDetail, savePrompt, resetPrompt, selectTemplate, saveTemplate,
        applyConstraintsToProject, applyProfileToProject, toggleResolvedPrompt,
    } = s;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Agent 配置</h1>
                <p className="page-subtitle">管理流水线中的Agent设定、模板、约束预设和风格配置</p>
            </div>
            <div className="cyber-tabs mb-20">
                {TABS.map(tab => (
                    <button key={tab.key} className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={activeTab === tab.key ? { borderColor: 'var(--neon-blue)', color: 'var(--neon-blue)' } : {}}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'agents' && (<>
                <div className="cyber-section-title">流水线成员</div>
                <div className="cyber-grid cyber-grid-3 mb-24">
                    {agents.map(agent => (
                        <AgentCard key={agent.type} agent={agent} isSelected={selectedAgent?.type === agent.type} onClick={() => loadAgentDetail(agent.type)} />
                    ))}
                </div>
                <AgentDetailPanel selectedAgent={selectedAgent} editPrompt={editPrompt} setEditPrompt={setEditPrompt}
                    saving={saving} hasChanges={hasChanges} showResolvedPrompt={showResolvedPrompt}
                    resolvedPrompt={resolvedPrompt} resolvedPromptLoading={resolvedPromptLoading}
                    savePrompt={savePrompt} resetPrompt={resetPrompt} toggleResolvedPrompt={toggleResolvedPrompt}
                    mode={mode} projectId={projectId} />
            </>)}

            {activeTab === 'templates' && (
                <TemplatesPanel templates={templates} selectedTemplate={selectedTemplate}
                    templateEditSystem={templateEditSystem} setTemplateEditSystem={setTemplateEditSystem}
                    templateSaving={templateSaving} templateHasChanges={templateHasChanges}
                    selectTemplate={selectTemplate} saveTemplate={saveTemplate} />
            )}

            {activeTab === 'constraints' && (<>
                <div className="flex-between mb-12">
                    <div className="cyber-section-title" style={{ marginBottom: 0 }}>约束预设列表 ({constraints.length})</div>
                    {currentProject?.id && (
                        <button className="cyber-btn cyber-btn-primary cyber-btn-sm" disabled={applying}
                            onClick={() => applyConstraintsToProject(constraints.map(c => c.id))}>
                            {applying ? '应用中...' : `全部应用到「${currentProject.name}」`}
                        </button>
                    )}
                </div>
                <ConstraintList constraints={constraints} selectedConstraint={selectedConstraint}
                    setSelectedConstraint={setSelectedConstraint} currentProject={currentProject}
                    applying={applying} applyConstraintsToProject={applyConstraintsToProject} />
            </>)}

            {activeTab === 'profiles' && (<>
                <div className="cyber-section-title">风格配置列表 ({profiles.length})</div>
                <ProfileList profiles={profiles} selectedProfile={selectedProfile}
                    setSelectedProfile={setSelectedProfile} currentProject={currentProject}
                    applying={applying} applyProfileToProject={applyProfileToProject} />
            </>)}
        </div>
    );
}
