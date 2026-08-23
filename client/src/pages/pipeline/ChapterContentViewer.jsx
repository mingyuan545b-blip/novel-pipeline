import s from './ChapterContentViewer.module.css';

export default function ChapterContentViewer({ selectedChapter, viewVersion, setViewVersion }) {
    if (!selectedChapter) return null;

    const content = viewVersion !== null && selectedChapter.history?.[viewVersion]
        ? selectedChapter.history[viewVersion].content
        : selectedChapter.content;

    return (
        <div>
            <div className={s.headerRow}>
                <div className="cyber-section-title">章节内容</div>
                {selectedChapter.history?.length > 0 && (
                    <div className={s.versionGroup}>
                        <span className={s.versionLabel}>版本:</span>
                        <button className={`cyber-btn cyber-btn-sm ${viewVersion === null ? 'cyber-btn-primary' : ''}`}
                            onClick={() => setViewVersion(null)}>
                            最新(R{selectedChapter.round})
                        </button>
                        {selectedChapter.history.map((snap, i) => (
                            <button key={i} className={`cyber-btn cyber-btn-sm ${viewVersion === i ? 'cyber-btn-primary' : ''} ${s.versionBtnOld}`}
                                onClick={() => setViewVersion(i)}>
                                R{snap.round}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className={`cyber-card ${s.contentCard}`}>
                {viewVersion !== null && (
                    <div className={s.versionBanner}>
                        <span>📋 查看第{selectedChapter.history[viewVersion]?.round}轮淘汰版</span>
                        <button className="cyber-btn cyber-btn-sm" onClick={() => setViewVersion(null)}>返回最新</button>
                    </div>
                )}
                {content && content !== '暂无内容' ? (
                    <div className={s.contentText}>{content}</div>
                ) : (
                    <div className={s.emptyContent}>尚无内容，请运行流水线</div>
                )}
            </div>
        </div>
    );
}
