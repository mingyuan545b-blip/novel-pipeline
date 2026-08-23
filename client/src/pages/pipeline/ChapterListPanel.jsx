import { PIPELINE_STEPS, STATUS_VALUES } from './pipelineConstants';
import { WRITTEN_STATUSES, HEADER_WRITTEN_STATUSES } from '../../shared/chapterStatusConstants';
import s from './ChapterListPanel.module.css';

const ChapterListPanel = ({
    chapters,
    selectedChapter,
    onSelectChapter,
    chapterFilter,
    setChapterFilter,
    chapterCollapsed,
    setChapterCollapsed,
    completedChapters: _completedChapters,
    onResetContent: _onResetContent,
    onRunFullPipeline: _onRunFullPipeline,
    pipelineState: _pipelineState,
    projectMode: _projectMode,
    onClearChaptersAfter,
}) => {
    const written = chapters.filter(ch => WRITTEN_STATUSES.includes(ch.status));
    const unwritten = chapters.filter(ch => !WRITTEN_STATUSES.includes(ch.status));
    const headerWrittenCount = chapters.filter(ch => HEADER_WRITTEN_STATUSES.includes(ch.status)).length;
    const headerUnwrittenCount = chapters.filter(ch => !HEADER_WRITTEN_STATUSES.includes(ch.status)).length;

    let display;
    if (chapterFilter === 'written') display = written;
    else if (chapterFilter === 'unwritten') display = unwritten;
    else display = chapterCollapsed ? [...written, ...unwritten.slice(0, 10)] : chapters;

    return (
        <>
            <div className={s.header}>
                <div className={`cyber-section-title ${s.title}`}>选择章节</div>
                <span className={s.countInfo}>
                    已写 {headerWrittenCount} / 未写 {headerUnwrittenCount}
                </span>
                {selectedChapter && onClearChaptersAfter && (
                    <button className={`cyber-btn ${s.clearBtn}`} onClick={() => onClearChaptersAfter(selectedChapter)}>
                        🗑删除后续章节内容
                    </button>
                )}
            </div>
            <div className={s.filterRow}>
                <button className={`cyber-btn cyber-btn-sm ${chapterFilter === 'all' ? 'cyber-btn-primary' : ''}`}
                    onClick={() => { setChapterFilter('all'); setChapterCollapsed(false); }}
                    style={{ fontSize: 11, flex: 1 }}>
                    全部 {chapters.length}
                </button>
                <button className={`cyber-btn cyber-btn-sm ${chapterFilter === 'written' ? 'cyber-btn-primary' : ''}`}
                    onClick={() => { setChapterFilter('written'); setChapterCollapsed(false); }}
                    style={{ fontSize: 11, flex: 1 }}>
                    已写 {written.length}
                </button>
                <button className={`cyber-btn cyber-btn-sm ${chapterFilter === 'unwritten' ? 'cyber-btn-primary' : ''}`}
                    onClick={() => { setChapterFilter('unwritten'); setChapterCollapsed(false); }}
                    style={{ fontSize: 11, flex: 1 }}>
                    📋 未写 {unwritten.length}
                </button>
            </div>
            {chapterFilter === 'all' && unwritten.length > 10 && (
                <button className="cyber-btn cyber-btn-sm"
                    onClick={() => setChapterCollapsed(!chapterCollapsed)}
                    style={{ fontSize: 10, width: '100%', marginBottom: 6, opacity: 0.7 }}>
                    {chapterCollapsed
                        ? `展开全部 (${unwritten.length} 个未写章`
                        : `折叠未写章节 (仅显示前10`
                    }
                </button>
            )}
            <div className={s.chapterGrid}>
                {chapters.length === 0 ? (
                    <div className={s.emptyHint}>暂无章节，请先在仪表盘生成章节大纲</div>
                ) : display.map(ch => (
                    <button
                        key={ch.id}
                        className={`cyber-btn cyber-btn-sm ${selectedChapter?.id === ch.id ? 'cyber-btn-primary' : ''}`}
                        onClick={() => onSelectChapter(ch)}
                    >
                        第{ch.chapterNumber}
                        <span className={`cyber-badge ${ch.status === STATUS_VALUES.APPROVED || ch.status === STATUS_VALUES.MATERIAL_UPDATED ? 'cyber-badge-green' : ch.status === STATUS_VALUES.OUTLINED ? 'cyber-badge-blue' : 'cyber-badge-orange'} ${s.badge}`}>
                            {ch.status}
                        </span>
                    </button>
                ))}
                {chapterCollapsed && chapterFilter === 'all' && unwritten.length > 10 && (
                    <div className={s.collapseInfo}>
                        +{unwritten.length - 10} 个未写章节已折叠
                    </div>
                )}
            </div>
        </>
    );
};

export default ChapterListPanel;
