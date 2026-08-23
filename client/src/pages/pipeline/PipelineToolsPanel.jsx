import ChapterAuditPanel from './ChapterAuditPanel';
import ChapterIntentDisplay from './ChapterIntentDisplay';
import HookBudgetPanel from './HookBudgetPanel';
import OptimizerPanel from './OptimizerPanel';
import PromptAuditPanel from './PromptAuditPanel';
import RuleStackPanel from './RuleStackPanel';
import s from './PipelineToolsPanel.module.css';

export default function PipelineToolsPanel({
    currentProject,
    selectedChapter,
    chapters,
    projectMode,
    hookBudgetInfo, setHookBudgetInfo,
    ruleStackInfo, setRuleStackInfo,
    promptAuditInfo, setPromptAuditInfo,
    promptAuditLoading, setPromptAuditLoading,
    optimizerReport, setOptimizerReport,
    optimizerLoading, setOptimizerLoading,
    optimizerApplying, setOptimizerApplying,
    chapterIntentInfo, setChapterIntentInfo,
    chapterAuditData, setChapterAuditData,
    chapterAuditLoading, setChapterAuditLoading,
    auditPage, setAuditPage,
    auditPageSize,
    auditFilter, setAuditFilter,
    expandedChapter, setExpandedChapter,
    repairModels,
    selectedRepairModel, setSelectedRepairModel,
    repairingChapterId, setRepairingChapterId,
    repairInstructions, setRepairInstructions,
    repairResult, setRepairResult,
    selectedForBatch, setSelectedForBatch,
    batchRepairing, setBatchRepairing,
    buttonPollRefs,
    repairingChapter, setRepairingChapter,
    retryProgress, setRetryProgress,
    retryTaskId, setRetryTaskId,
    batchTaskId, setBatchTaskId,
    batchProgress, setBatchProgress,
    reviewLoading, setReviewLoading,
    reviewResult, setReviewResult,
    retryCount, setRetryCount,
    expandedAttempt, setExpandedAttempt
}) {
    return (
        <div className={`cyber-card ${s.card}`}>
            <div className={s.toolsGrid}>
                <HookBudgetPanel
                    currentProject={currentProject}
                    selectedChapter={selectedChapter}
                    chapters={chapters}
                    hookBudgetInfo={hookBudgetInfo}
                    setHookBudgetInfo={setHookBudgetInfo}
                />
                <RuleStackPanel
                    currentProject={currentProject}
                    ruleStackInfo={ruleStackInfo}
                    setRuleStackInfo={setRuleStackInfo}
                />
            </div>

            <PromptAuditPanel
                currentProject={currentProject}
                projectMode={projectMode}
                promptAuditInfo={promptAuditInfo} setPromptAuditInfo={setPromptAuditInfo}
                promptAuditLoading={promptAuditLoading} setPromptAuditLoading={setPromptAuditLoading}
            />

            <OptimizerPanel
                currentProject={currentProject}
                optimizerReport={optimizerReport} setOptimizerReport={setOptimizerReport}
                optimizerLoading={optimizerLoading} setOptimizerLoading={setOptimizerLoading}
                optimizerApplying={optimizerApplying} setOptimizerApplying={setOptimizerApplying}
            />

            <ChapterAuditPanel
                currentProject={currentProject}
                chapterAuditData={chapterAuditData} setChapterAuditData={setChapterAuditData}
                chapterAuditLoading={chapterAuditLoading} setChapterAuditLoading={setChapterAuditLoading}
                auditPage={auditPage} setAuditPage={setAuditPage}
                auditPageSize={auditPageSize}
                auditFilter={auditFilter} setAuditFilter={setAuditFilter}
                expandedChapter={expandedChapter} setExpandedChapter={setExpandedChapter}
                repairModels={repairModels}
                selectedRepairModel={selectedRepairModel} setSelectedRepairModel={setSelectedRepairModel}
                repairingChapterId={repairingChapterId} setRepairingChapterId={setRepairingChapterId}
                repairInstructions={repairInstructions} setRepairInstructions={setRepairInstructions}
                repairResult={repairResult} setRepairResult={setRepairResult}
                selectedForBatch={selectedForBatch} setSelectedForBatch={setSelectedForBatch}
                batchRepairing={batchRepairing} setBatchRepairing={setBatchRepairing}
                buttonPollRefs={buttonPollRefs}
                repairingChapter={repairingChapter} setRepairingChapter={setRepairingChapter}
                retryProgress={retryProgress} setRetryProgress={setRetryProgress}
                retryTaskId={retryTaskId} setRetryTaskId={setRetryTaskId}
                batchTaskId={batchTaskId} setBatchTaskId={setBatchTaskId}
                batchProgress={batchProgress} setBatchProgress={setBatchProgress}
                reviewLoading={reviewLoading} setReviewLoading={setReviewLoading}
                reviewResult={reviewResult} setReviewResult={setReviewResult}
                retryCount={retryCount} setRetryCount={setRetryCount}
                expandedAttempt={expandedAttempt} setExpandedAttempt={setExpandedAttempt}
            />

            <ChapterIntentDisplay
                selectedChapter={selectedChapter}
                chapterIntentInfo={chapterIntentInfo}
                setChapterIntentInfo={setChapterIntentInfo}
            />
        </div>
    );
}
