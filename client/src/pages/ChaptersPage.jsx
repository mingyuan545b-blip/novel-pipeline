import useChaptersState from './chapters/useChaptersState';
import { STATUS_LABELS, STATUS_COLORS, WRITTEN_STATUSES } from './chapters/useChaptersState';
import s from './chapters/chapters.module.css';

export default function ChaptersPage() {
    const {
        currentProject, chapterList, selectedChapter, setSelectedChapter,
        editMode, setEditMode, editForm, setEditForm, filter, setFilter,
        collapsed, setCollapsed, writtenChapters, unwrittenChapters,
        displayChapters, startEdit, saveEdit, handleDeleteChapter,
        handleResetChapter, handleDownload,
    } = useChaptersState();

    const renderChapterCard = (ch) => (
        <div key={ch.id} className={`chapter-card ${selectedChapter?.id === ch.id ? 'cyber-card-glow' : ''}`} onClick={() => { setSelectedChapter(ch); setEditMode(false); }}>
            <div className="chapter-number">{ch.chapterNumber}</div>
            <div className="chapter-info">
                <div className="chapter-title">{ch.title}</div>
                <div className="chapter-meta">
                    <span className={`cyber-badge cyber-badge-${STATUS_COLORS[ch.status] || 'blue'}`}>{STATUS_LABELS[ch.status] || ch.status}</span>
                    <span>{ch.wordCount}字</span><span>R{ch.round}</span>
                </div>
            </div>
            <div className="chapter-actions">
                <button className="cyber-btn cyber-btn-sm" onClick={e => { e.stopPropagation(); startEdit(ch); }}>编辑</button>
                {WRITTEN_STATUSES.includes(ch.status) && <button className="cyber-btn cyber-btn-sm text-orange" onClick={e => { e.stopPropagation(); handleResetChapter(ch.id); }}>重置</button>}
                <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={e => { e.stopPropagation(); handleDeleteChapter(ch.id); }}>删除</button>
            </div>
        </div>
    );

    if (!currentProject) return <div><div className="page-header"><h1 className="page-title">章节管理</h1><p className="page-subtitle">查看和管理小说章节</p></div><div className="cyber-card cyber-empty"><div className="cyber-empty-icon">▦</div><div>请先在仪表盘选择一个项目</div></div></div>;

    return (
        <div>
            <div className="page-header"><h1 className="page-title">章节管理</h1><p className="page-subtitle">查看和管理小说章节 - 支持手动编辑章节内容和大纲</p></div>
            <div className={s.chapterGrid}>
                <div>
                    <div className="flex-between mb-8">
                        <div className="cyber-section-title" style={{ marginBottom: 0 }}>章节列表 ({chapterList.length})</div>
                        <div className="flex gap-6 items-center">
                            <span className="text-sm text-muted">已写 {writtenChapters.length} / 未写 {unwrittenChapters.length}</span>
                            {writtenChapters.length > 0 && <button onClick={handleDownload} className="cyber-btn cyber-btn-sm cyber-btn-primary" style={{ fontSize: 11 }}>⬇ 下载全本TXT</button>}
                        </div>
                    </div>
                    <div className="flex gap-4 mb-8">
                        <button className={`cyber-btn cyber-btn-sm ${filter === 'all' ? 'cyber-btn-primary' : ''} ${s.filterBtn}`} onClick={() => { setFilter('all'); setCollapsed(false); }}>全部 {chapterList.length}</button>
                        <button className={`cyber-btn cyber-btn-sm ${filter === 'written' ? 'cyber-btn-primary' : ''} ${s.filterBtn}`} onClick={() => { setFilter('written'); setCollapsed(false); }}>✅ 已写 {writtenChapters.length}</button>
                        <button className={`cyber-btn cyber-btn-sm ${filter === 'unwritten' ? 'cyber-btn-primary' : ''} ${s.filterBtn}`} onClick={() => { setFilter('unwritten'); setCollapsed(false); }}>📋 未写 {unwrittenChapters.length}</button>
                    </div>
                    {filter === 'all' && unwrittenChapters.length > 5 && (
                        <button className={`cyber-btn cyber-btn-sm ${s.collapseBtn}`} onClick={() => setCollapsed(!collapsed)}>
                            {collapsed ? `▼ 展开全部 (${unwrittenChapters.length} 个未写章节)` : `▲ 折叠未写章节 (仅显示前5个)`}
                        </button>
                    )}
                    <div className={s.chapterListScroll}>
                        {chapterList.length === 0 ? <div className="cyber-card cyber-empty" style={{ padding: 30 }}><div>暂无章节</div></div> : (
                            <>
                                {filter === 'all' && !collapsed ? (
                                    <>
                                        {writtenChapters.length > 0 && <><div className={`${s.sectionDivider} ${s.sectionDividerWritten}`}>✅ 已写 ({writtenChapters.length})</div>{writtenChapters.map(renderChapterCard)}</>}
                                        {unwrittenChapters.length > 0 && <><div className={s.sectionDivider} style={{ marginTop: 4 }}>📋 未写 ({unwrittenChapters.length})</div>{unwrittenChapters.map(renderChapterCard)}</>}
                                    </>
                                ) : displayChapters.map(renderChapterCard)}
                                {collapsed && filter === 'all' && unwrittenChapters.length > 5 && <div className="text-center text-sm text-muted" style={{ padding: '8px 0' }}>还有 {unwrittenChapters.length - 5} 个未写章节已折叠</div>}
                            </>
                        )}
                    </div>
                </div>
                <div>
                    {selectedChapter ? (
                        <div>
                            <div className="cyber-section-title">第{selectedChapter.chapterNumber}章: {selectedChapter.title}</div>
                            {editMode ? (
                                <div className="cyber-card">
                                    <div className="form-group"><label className="form-label">章节标题</label><input className="cyber-input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">章节大纲</label><textarea className="cyber-textarea" value={editForm.outline} onChange={e => setEditForm({ ...editForm, outline: e.target.value })} rows={4} /></div>
                                    <div className="form-group"><label className="form-label">正文内容</label><textarea className="cyber-textarea" value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })} rows={15} style={{ minHeight: 400 }} /></div>
                                    <div className="flex gap-8"><button className="cyber-btn cyber-btn-success" onClick={saveEdit}>保存</button><button className="cyber-btn" onClick={() => setEditMode(false)}>取消</button></div>
                                </div>
                            ) : (
                                <div className="cyber-card">
                                    <div className="mb-16">
                                        <div className="flex gap-12 mb-8">
                                            <span className={`cyber-badge cyber-badge-${STATUS_COLORS[selectedChapter.status]}`}>{STATUS_LABELS[selectedChapter.status]}</span>
                                            <span className="text-sm text-muted">字数: {selectedChapter.wordCount} | 轮次: {selectedChapter.round}</span>
                                        </div>
                                    </div>
                                    <div className="mb-16"><div className="form-label">章节大纲</div><div className={s.outlineViewer}>{selectedChapter.outline || '暂无大纲'}</div></div>
                                    <div><div className="form-label">正文内容</div><div className={s.contentViewer}>{selectedChapter.content || '暂无内容，请通过流水线生成'}</div></div>
                                    <div className="flex gap-8 mt-16">
                                        <button className="cyber-btn" onClick={() => startEdit(selectedChapter)}>手动编辑</button>
                                        {WRITTEN_STATUSES.includes(selectedChapter.status) && <button className="cyber-btn text-orange" onClick={() => handleResetChapter(selectedChapter.id)}>重置章节</button>}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">▦</div><div>选择左侧章节查看详情</div></div>}
                </div>
            </div>
        </div>
    );
}
