import ImportTab from './ImportTab';
import TemplateTab from './TemplateTab';
import FusionTab from './FusionTab';

export default function WorkshopEditor({
    activeTab,
    loading,
    loadingStep,
    currentProject,
    importState,
    setImportState,
    fusionState,
    setFusionState,
    templateState,
    setTemplateState,
    templateFileRef,
    handleImportText,
    handleImportFiles,
    handleFuseText,
    handleFuseFiles,
    addFusionNovel,
    removeFusionNovel,
    updateFusionNovel,
    handleTemplateValidate,
    handleTemplateImport,
    handleExportTemplate
}) {
    const commonProps = { loading, loadingStep };

    if (activeTab === 'import') {
        return (
            <ImportTab
                {...commonProps}
                currentProject={currentProject}
                importState={importState}
                setImportState={setImportState}
                handleImportText={handleImportText}
                handleImportFiles={handleImportFiles}
            />
        );
    }

    if (activeTab === 'template') {
        return (
            <TemplateTab
                {...commonProps}
                currentProject={currentProject}
                templateState={templateState}
                setTemplateState={setTemplateState}
                templateFileRef={templateFileRef}
                handleTemplateValidate={handleTemplateValidate}
                handleTemplateImport={handleTemplateImport}
                handleExportTemplate={handleExportTemplate}
            />
        );
    }

    if (activeTab === 'fusion') {
        return (
            <FusionTab
                {...commonProps}
                fusionState={fusionState}
                setFusionState={setFusionState}
                handleFuseText={handleFuseText}
                handleFuseFiles={handleFuseFiles}
                addFusionNovel={addFusionNovel}
                removeFusionNovel={removeFusionNovel}
                updateFusionNovel={updateFusionNovel}
            />
        );
    }

    return null;
}
