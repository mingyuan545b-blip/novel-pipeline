import useWorkshopState from './workshop/useWorkshopState';
import WorkshopEditor from './workshop/WorkshopEditor';
import WorkshopPreview from './workshop/WorkshopPreview';
import { TABS } from './workshop/constants';
import s from './workshop/workshop.module.css';

export default function WorkshopPage() {
    const state = useWorkshopState();

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">创作工坊</h1>
                <p className="page-subtitle">设定导入自动生成素材库 | 多本小说融合提炼写作手法与元素</p>
            </div>

            <div className={`cyber-tabs ${s.tabsBar}`}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`cyber-tab ${state.activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => state.switchTab(tab.key)}
                        style={state.activeTab === tab.key ? { borderColor: tab.color, color: tab.color } : {}}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <WorkshopEditor
                activeTab={state.activeTab}
                loading={state.loading}
                loadingStep={state.loadingStep}
                currentProject={state.currentProject}
                importState={state.importState}
                setImportState={state.setImportState}
                fusionState={state.fusionState}
                setFusionState={state.setFusionState}
                templateState={state.templateState}
                setTemplateState={state.setTemplateState}
                templateFileRef={state.templateFileRef}
                handleImportText={state.handleImportText}
                handleImportFiles={state.handleImportFiles}
                handleFuseText={state.handleFuseText}
                handleFuseFiles={state.handleFuseFiles}
                addFusionNovel={state.addFusionNovel}
                removeFusionNovel={state.removeFusionNovel}
                updateFusionNovel={state.updateFusionNovel}
                handleTemplateValidate={state.handleTemplateValidate}
                handleTemplateImport={state.handleTemplateImport}
                handleExportTemplate={state.handleExportTemplate}
            />

            <WorkshopPreview
                activeTab={state.activeTab}
                result={state.result}
            />
        </div>
    );
}
