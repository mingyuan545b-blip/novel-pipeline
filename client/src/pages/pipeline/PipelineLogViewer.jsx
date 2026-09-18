import PipelineFlowControls from './PipelineFlowControls';
import PipelineLogList from './PipelineLogList';

export default function PipelineLogViewer({
    pipelineState,
    pipelineSteps,
    selectedChapter,
    projectMode: _projectMode,
    runStep,
    runFullPipeline,
    maxRounds,
    setMaxRounds,
    reviewLogs,
    resetChapterContent,
}) {
    if (!selectedChapter) return null;

    return (
        <>
            <PipelineFlowControls
                selectedChapter={selectedChapter}
                pipelineState={pipelineState}
                pipelineSteps={pipelineSteps}
                maxRounds={maxRounds}
                setMaxRounds={setMaxRounds}
                runFullPipeline={runFullPipeline}
                runStep={runStep}
                resetChapterContent={resetChapterContent}
            />
            <PipelineLogList
                pipelineState={pipelineState}
                pipelineSteps={pipelineSteps}
                reviewLogs={reviewLogs}
                selectedChapter={selectedChapter}
            />
        </>
    );
}
