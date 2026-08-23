import { getStepStatus } from './pipelineConstants';
import s from './PipelineFlowControls.module.css';

export default function PipelineFlowControls({
    selectedChapter, pipelineState, pipelineSteps,
    maxRounds, setMaxRounds,
    runFullPipeline, runStep, resetChapterContent,
}) {
    return (
        <div className={`cyber-card ${s.card}`}>
            <div className={s.header}>
                <div>
                    <h3 className={s.chapterTitle}>
                        第{selectedChapter.chapterNumber} {selectedChapter.title}
                    </h3>
                    <div className={s.chapterMeta}>
                        📊 {selectedChapter.status} | 字数: {selectedChapter.wordCount} | 轮次: {selectedChapter.round}
                    </div>
                </div>
                <div className={s.controlsRow}>
                    <label className={`form-label ${s.maxRoundsLabel}`}>最大轮次</label>
                    <input className="cyber-input" type="number" value={maxRounds} onChange={e => setMaxRounds(parseInt(e.target.value) || 3)} min={1} max={10} style={{ width: 60 }} />
                    <button className="cyber-btn cyber-btn-primary" onClick={() => runFullPipeline(maxRounds)} disabled={pipelineState.running}>
                        {pipelineState.running ? <><span className="cyber-loading"></span> 运行中...</> : '运行本章流水线'}
                    </button>
                    {selectedChapter && selectedChapter.status !== 'outlined' && (
                        <button className="cyber-btn cyber-btn-sm" onClick={() => resetChapterContent(selectedChapter.id, selectedChapter.chapterNumber)}
                            title="删除正文但保留大纲，可重新运行流水线">
                            🗑 删除正文
                        </button>
                    )}
                </div>
            </div>

            <div className={`pipeline-flow ${pipelineState.running ? 'pipeline-running' : ''}`}>
                {pipelineSteps.map((step, idx) => {
                    const status = getStepStatus(step.key, selectedChapter, pipelineState);
                    return (
                        <div key={step.key} className={s.stepRow}>
                            <div className={`pipeline-node pipeline-node-${status}`}>
                                <div className="pipeline-node-icon" style={{
                                    borderColor: status === 'done' ? 'var(--neon-green)' : status === 'active' ? step.color : undefined,
                                    color: step.color
                                }}>
                                    {step.icon}
                                </div>
                                <div className="pipeline-node-label">{step.label}</div>
                                <button className={`cyber-btn cyber-btn-sm ${s.execBtn}`} onClick={() => runStep(step.key)} disabled={pipelineState.running}>
                                    执行
                                </button>
                            </div>
                            {idx < pipelineSteps.length - 1 && (
                                <div className={`pipeline-arrow ${status === 'done' ? 'pipeline-arrow-active' : ''}`} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
