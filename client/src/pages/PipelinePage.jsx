import usePipelinePageState from './pipeline/usePipelinePageState';
import InfinitePipelineBar from './pipeline/InfinitePipelineBar';
import GenreConstraintsBar from './pipeline/GenreConstraintsBar';
import PipelineSettingsPanel from './pipeline/PipelineSettingsPanel';
import ChapterListPanel from './pipeline/ChapterListPanel';

/* eslint-disable max-lines-per-function */
import PipelineLogViewer from './pipeline/PipelineLogViewer';
import ChapterContentViewer from './pipeline/ChapterContentViewer';
import OutputViewer from './pipeline/OutputViewer';
import PipelineToolsPanel from './pipeline/PipelineToolsPanel';
import PipelineHeader from './pipeline/PipelineHeader';

export default function PipelinePage() {
    const state = usePipelinePageState();
    const {
        currentProject, chaptersData, projectMode, pipelineSteps, outputTabs,
        pipelineState, selectedChapter, maxRounds, setMaxRounds,
        infinite, chapterActions, audit, agentConfig, tools, output,
        chapterList, genre, projectTargets, setProjectTargets, completedChapters,
        buttonPollRefs, addPipelineLog,
    } = state;

    return (
        <div>
            <PipelineHeader
                currentProject={currentProject}
                projectMode={projectMode}
                infinite={infinite}
                chapterActions={chapterActions}
                startPipelineLoading={state.startPipelineMut.isLoading}
            />

            <InfinitePipelineBar infiniteStatus={infinite.infiniteStatus} onStop={infinite.stopInfinitePipeline} />

            <GenreConstraintsBar
                genreId={genre.genreId}
                genreConstraints={genre.genreConstraints}
                genreConstraintsData={genre.genreConstraintsData}
                genreStyleProfile={genre.genreStyleProfile}
            />

            {!currentProject ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">📖</div>
                    <div>请先在仪表盘选择一个项目</div>
                </div>
            ) : (
                <>
                    <PipelineSettingsPanel
                        currentProject={currentProject}
                        infiniteStatus={infinite.infiniteStatus}
                        infiniteOptions={infinite.infiniteOptions}
                        setInfiniteOptions={infinite.setInfiniteOptions}
                        projectTargets={projectTargets}
                        setProjectTargets={setProjectTargets}
                        chapters={chaptersData || []}
                        completedChapters={completedChapters}
                        contextBudgetInfo={tools.contextBudgetInfo}
                        setContextBudgetInfo={tools.setContextBudgetInfo}
                        injectionMapInfo={tools.injectionMapInfo}
                        setInjectionMapInfo={tools.setInjectionMapInfo}
                        supplementOutlines={chapterActions.supplementOutlines}
                        addPipelineLog={addPipelineLog}
                        onRerunMaterialManager={chapterActions.rerunMaterialManager}
                        onGenerateSubplaneMaterials={chapterActions.generateSubplaneMaterials}
                        agentModelConfig={agentConfig.agentModelConfig}
                        setAgentModelConfig={agentConfig.setAgentModelConfig}
                        testResults={agentConfig.testResults}
                        setTestResults={agentConfig.setTestResults}
                        showAgentConfig={agentConfig.showAgentConfig}
                        setShowAgentConfig={agentConfig.setShowAgentConfig}
                    />

                    <PipelineToolsPanel
                        currentProject={currentProject}
                        selectedChapter={selectedChapter}
                        chapters={chaptersData || []}
                        projectMode={projectMode}
                        hookBudgetInfo={tools.hookBudgetInfo} setHookBudgetInfo={tools.setHookBudgetInfo}
                        ruleStackInfo={tools.ruleStackInfo} setRuleStackInfo={tools.setRuleStackInfo}
                        promptAuditInfo={tools.promptAuditInfo} setPromptAuditInfo={tools.setPromptAuditInfo}
                        promptAuditLoading={tools.promptAuditLoading} setPromptAuditLoading={tools.setPromptAuditLoading}
                        optimizerReport={tools.optimizerReport} setOptimizerReport={tools.setOptimizerReport}
                        optimizerLoading={tools.optimizerLoading} setOptimizerLoading={tools.setOptimizerLoading}
                        optimizerApplying={tools.optimizerApplying} setOptimizerApplying={tools.setOptimizerApplying}
                        chapterIntentInfo={tools.chapterIntentInfo} setChapterIntentInfo={tools.setChapterIntentInfo}
                        chapterAuditData={audit.chapterAuditData} setChapterAuditData={audit.setChapterAuditData}
                        chapterAuditLoading={audit.chapterAuditLoading} setChapterAuditLoading={audit.setChapterAuditLoading}
                        auditPage={audit.auditPage} setAuditPage={audit.setAuditPage}
                        auditPageSize={audit.auditPageSize}
                        auditFilter={audit.auditFilter} setAuditFilter={audit.setAuditFilter}
                        expandedChapter={audit.expandedChapter} setExpandedChapter={audit.setExpandedChapter}
                        repairModels={audit.repairModels}
                        selectedRepairModel={audit.selectedRepairModel} setSelectedRepairModel={audit.setSelectedRepairModel}
                        repairingChapterId={audit.repairingChapterId} setRepairingChapterId={audit.setRepairingChapterId}
                        repairInstructions={audit.repairInstructions} setRepairInstructions={audit.setRepairInstructions}
                        repairResult={audit.repairResult} setRepairResult={audit.setRepairResult}
                        selectedForBatch={audit.selectedForBatch} setSelectedForBatch={audit.setSelectedForBatch}
                        batchRepairing={audit.batchRepairing} setBatchRepairing={audit.setBatchRepairing}
                        buttonPollRefs={buttonPollRefs}
                        repairingChapter={audit.repairingChapter} setRepairingChapter={audit.setRepairingChapter}
                        retryProgress={audit.retryProgress} setRetryProgress={audit.setRetryProgress}
                        retryTaskId={audit.retryTaskId} setRetryTaskId={audit.setRetryTaskId}
                        batchTaskId={audit.batchTaskId} setBatchTaskId={audit.setBatchTaskId}
                        batchProgress={audit.batchProgress} setBatchProgress={audit.setBatchProgress}
                        reviewLoading={audit.reviewLoading} setReviewLoading={audit.setReviewLoading}
                        reviewResult={audit.reviewResult} setReviewResult={audit.setReviewResult}
                        retryCount={audit.retryCount} setRetryCount={audit.setRetryCount}
                        expandedAttempt={audit.expandedAttempt} setExpandedAttempt={audit.setExpandedAttempt}
                    />

                    <ChapterListPanel
                        chapters={chaptersData || []}
                        selectedChapter={selectedChapter}
                        onSelectChapter={chapterActions.selectChapter}
                        chapterFilter={chapterList.chapterFilter}
                        setChapterFilter={chapterList.setChapterFilter}
                        chapterCollapsed={chapterList.chapterCollapsed}
                        setChapterCollapsed={chapterList.setChapterCollapsed}
                        completedChapters={completedChapters}
                        onResetContent={chapterActions.resetChapterContent}
                        onRunFullPipeline={chapterActions.runFullPipeline}
                        pipelineState={pipelineState}
                        projectMode={projectMode}
                        onClearChaptersAfter={chapterActions.clearChaptersAfter}
                    />

                    {selectedChapter && (
                        <>
                            <PipelineLogViewer
                                pipelineState={pipelineState}
                                pipelineSteps={pipelineSteps}
                                selectedChapter={selectedChapter}
                                projectMode={projectMode}
                                runStep={chapterActions.runStep}
                                runFullPipeline={chapterActions.runFullPipeline}
                                maxRounds={maxRounds}
                                setMaxRounds={setMaxRounds}
                                reviewLogs={output.reviewLogs}
                                resetChapterContent={chapterActions.resetChapterContent}
                            />

                            <ChapterContentViewer
                                selectedChapter={selectedChapter}
                                viewVersion={output.viewVersion}
                                setViewVersion={output.setViewVersion}
                            />

                            <OutputViewer
                                selectedChapter={selectedChapter}
                                activeOutputTab={output.activeOutputTab}
                                setActiveOutputTab={output.setActiveOutputTab}
                                outputTabs={outputTabs}
                                pipelineState={pipelineState}
                                reviewLogs={output.reviewLogs}
                                viewVersion={output.viewVersion}
                                outputPaths={output.outputPaths}
                                pipelineSteps={pipelineSteps}
                                pipelineConfig={currentProject?.pipelineConfig}
                                projectId={currentProject?.id}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
