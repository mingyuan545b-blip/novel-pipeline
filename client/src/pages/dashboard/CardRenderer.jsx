import WorldviewCard from './WorldviewCard';
import QuickActions from './QuickActions';
import ConstraintsCard from './ConstraintsCard';
import RemediationCard from './RemediationCard';
import StyleGuideCard from './StyleGuideCard';
import StyleCard from './StyleCard';
import FlavorCard from './FlavorCard';
import WorldviewProfileCard from './WorldviewProfileCard';

export default function CardRenderer({ cardId, dragHandleProps, state }) {
    switch (cardId) {
        case 'worldview':
            return <WorldviewCard dragHandleProps={dragHandleProps}
                franchises={state.franchises} standaloneProjects={state.standaloneProjects}
                currentProject={state.currentProject} selectProject={state.selectProject}
                deleteProject={state.deleteProject} deleteFranchise={state.deleteFranchise}
                toggleFranchise={state.toggleFranchise} expandedFranchises={state.expandedFranchises}
                openCreateProduct={state.openCreateProduct}
                setShowCreateFranchise={state.setShowCreateFranchise}
                setShowCreate={state.setShowCreate} openCleanupModal={state.openCleanupModal} />;
        case 'quickActions':
            return <QuickActions dragHandleProps={dragHandleProps}
                currentProject={state.currentProject} prompt={state.prompt} setPrompt={state.setPrompt}
                genLoading={state.genLoading} generateMaterials={state.generateMaterials}
                generateOutlines={state.generateOutlines}
                totalMaterials={state.totalMaterials} totalChapters={state.totalChapters} />;
        case 'constraints':
            return <ConstraintsCard dragHandleProps={dragHandleProps}
                currentProject={state.currentProject}
                editingConstraints={state.editingConstraints} editConstraints={state.editConstraints}
                constraintPresets={state.constraintPresets} projectConstraints={state.projectConstraints}
                startEditConstraints={state.startEditConstraints} toggleEditConstraint={state.toggleEditConstraint}
                saveConstraints={state.saveConstraints} setEditingConstraints={state.setEditingConstraints} />;
        case 'remediation':
            return <RemediationCard dragHandleProps={dragHandleProps}
                currentProject={state.currentProject} reviewText={state.reviewText}
                setReviewText={state.setReviewText} remediating={state.remediating}
                remediationResult={state.remediationResult} handleRemediate={state.handleRemediate} />;
        case 'styleGuide':
            return <StyleGuideCard dragHandleProps={dragHandleProps}
                currentProject={state.currentProject} styleSuggestion={state.styleSuggestion}
                setStyleSuggestion={state.setStyleSuggestion} analyzingStyle={state.analyzingStyle}
                handleAnalyzeStyle={state.handleAnalyzeStyle} handleClearStyleGuidance={state.handleClearStyleGuidance} />;
        case 'style':
            return <StyleCard dragHandleProps={dragHandleProps}
                currentProject={state.currentProject} styleTemplate={state.styleTemplate}
                editingStyle={state.editingStyle} styleEditForm={state.styleEditForm}
                setStyleEditForm={state.setStyleEditForm} startEditingStyle={state.startEditingStyle}
                saveStyleEdits={state.saveStyleEdits} setEditingStyle={state.setEditingStyle} />;
        case 'flavor':
            return <FlavorCard dragHandleProps={dragHandleProps} state={state} />;
        case 'worldviewProfile':
            return <WorldviewProfileCard dragHandleProps={dragHandleProps}
                currentProject={state.currentProject} profiles={state.profiles}
                loading={state.loading} showSaveModal={state.showSaveModal}
                setShowSaveModal={state.setShowSaveModal} saveForm={state.saveForm}
                setSaveForm={state.setSaveForm} saving={state.saving}
                applyingId={state.applyingId} saveFromProject={state.saveFromProject}
                applyToProject={state.applyToProject} deleteProfile={state.deleteProfile} />;
        default:
            return null;
    }
}
