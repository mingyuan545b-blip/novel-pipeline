import useGuideState from './guide/useGuideState';
import { TABS } from './guide/useGuideState';
import { QuickStartTab, TemplateGuideTab, StyleTemplateGuideTab, PipelineFlowTab, ComicGuideTab, AgentRolesTab, AipyProGuideTab } from './guide/GuideTabContent';

const TAB_COMPONENTS = {
    quickStart: QuickStartTab,
    templateGuide: TemplateGuideTab,
    styleTemplateGuide: StyleTemplateGuideTab,
    pipelineFlow: PipelineFlowTab,
    comicGuide: ComicGuideTab,
    agentRoles: AgentRolesTab,
    aipyProGuide: AipyProGuideTab,
};

const TAB_DATA_MAP = {
    quickStart: 'quickStart',
    templateGuide: 'templateGuide',
    styleTemplateGuide: 'styleGuide',
    pipelineFlow: 'pipelineFlow',
    comicGuide: 'comicGuide',
    agentRoles: 'agentRoles',
    aipyProGuide: 'aipyProGuide',
};

export default function GuidePage() {
    const { activeTab, setActiveTab, guideData, quickStart, templateGuide, styleGuide, pipelineFlow, comicGuide, agentRoles, aipyProGuide } = useGuideState();

    if (!guideData) return <div className="p-20 text-center text-muted">加载中...</div>;

    const dataMap = { quickStart, templateGuide, styleGuide, pipelineFlow, comicGuide, agentRoles, aipyProGuide };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">操作指南</h1>
                <p className="page-subtitle">完整的使用指南 - 从配置到生产全流程</p>
            </div>
            <div className="cyber-tabs" style={{ flexWrap: 'wrap' }}>
                {TABS.map(tab => (
                    <button key={tab.key} className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
                ))}
            </div>
            {TABS.map(tab => {
                if (activeTab !== tab.key) return null;
                const TabComponent = TAB_COMPONENTS[tab.key];
                const dataKey = TAB_DATA_MAP[tab.key];
                return TabComponent ? <TabComponent key={tab.key} data={dataMap[dataKey]} /> : null;
            })}
        </div>
    );
}
