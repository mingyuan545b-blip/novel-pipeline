import s from './PipelineHeader.module.css';

export default function PipelineHeader({ currentProject, projectMode, infinite, chapterActions, startPipelineLoading }) {
    return (
        <div className="page-header">
            <div className={s.headerRow}>
                <div>
                    <h1 className="page-title">流水线控制台</h1>
                    <p className="page-subtitle">
                        {projectMode === 'shuangwen'
                            ? '爽文模式 - 意图规划→爽文执笔→快审→定稿→润色→素材更新'
                            : projectMode === 'tomato-short'
                                ? '🍅 番茄爽文模式 - 意图规划→番茄执笔→番茄快审→定稿→润色→素材更新(1900-2100 对话8%)'
                                : '管理小说创作自动化流水线 - 意图规划→执笔人→初审→复审→定稿→润色→素材更新'}
                    </p>
                </div>
                <div className={s.btnGroup}>
                    {infinite.infiniteStatus.running ? (
                        <>
                            <button className={`cyber-btn ${s.btnStop}`} onClick={infinite.stopInfinitePipeline}>
                                <span className="cyber-loading"></span> 停止无限流水线...
                            </button>
                            <button className="cyber-btn cyber-btn-sm" onClick={infinite.forceResetPipeline} title="流水线卡住时使用">
                                🔄 强制重置
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="cyber-btn cyber-btn-primary" onClick={infinite.startInfinitePipeline} disabled={!currentProject || startPipelineLoading}>
                                {startPipelineLoading ? <><span className="cyber-loading"></span> 启动中...</> : '启动无限流水线'}
                            </button>
                            <button className="cyber-btn cyber-btn-sm" onClick={chapterActions.resetChaptersBulk} disabled={!currentProject} title="删除正文但保留大纲，可重新运行流水线">
                                🗑 批量删除正文
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
