import { formatTime } from './pipelineConstants';
import s from './InfinitePipelineBar.module.css';

export default function InfinitePipelineBar({ infiniteStatus, onStop }) {
    if (!infiniteStatus.running) return null;

    return (
        <div className={`cyber-card ${s.pipelineBar}`}>
            <div className={s.barRow}>
                <div className={s.statusInfo}>
                    <span className={`cyber-loading ${s.loadingSpinner}`}></span>
                    <span className={s.statusText}>无限流水线运行中</span>
                    {infiniteStatus.phase && <span className={s.phaseTag}>[{infiniteStatus.phase}]</span>}
                    {infiniteStatus.batchProgress && <span className={s.batchProgress}>{infiniteStatus.batchProgress}</span>}
                    {infiniteStatus.currentChapter && <span className={s.currentChapter}>当前: 第{infiniteStatus.currentChapter}章</span>}
                    {infiniteStatus.completedChapters > 0 && <span className={s.completedCount}>已完成{infiniteStatus.completedChapters}章</span>}
                </div>
                <button className={`cyber-btn cyber-btn-sm ${s.stopBtn}`} onClick={onStop}>停止</button>
            </div>
            {infiniteStatus.logs?.length > 0 && (
                <div className={s.logArea}>
                    {infiniteStatus.logs.map((log, i) => (
                        <div key={i}>{formatTime(log.time)} {log.msg}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
