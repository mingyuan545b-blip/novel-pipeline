import { useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { chaptersApi } from '../services/api';

const STATUS_LABELS = {
    draft: '草稿',
    outlined: '已规划',
    written: '已创作',
    'first-reviewing': '初审中',
    'second-reviewing': '复审中',
    'final-editing': '定稿中',
    approved: '已定稿',
    'material-updated': '素材已更新'
};

const STATUS_COLORS = {
    draft: 'blue',
    outlined: 'purple',
    written: 'blue',
    'first-reviewing': 'green',
    'second-reviewing': 'orange',
    'final-editing': 'pink',
    approved: 'green',
    'material-updated': 'purple'
};

const WRITTEN_STATUSES = ['written', 'first-reviewing', 'second-reviewing', 'final-editing', 'approved', 'material-updated'];

export default function ChaptersPage() {
    const { currentProject, chapters, setChapters } = useAppStore();
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [filter, setFilter] = useState('all');
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (currentProject) {
            chaptersApi.list({ projectId: currentProject.id }).then(res => setChapters(res.data || [])).catch(console.error);
        }
    }, [currentProject, setChapters]);

    const writtenChapters = chapters.filter(ch => WRITTEN_STATUSES.includes(ch.status));
    const unwrittenChapters = chapters.filter(ch => !WRITTEN_STATUSES.includes(ch.status));

    const filteredChapters = (() => {
        if (filter === 'written') return writtenChapters;
        if (filter === 'unwritten') return unwrittenChapters;
        return chapters;
    })();

    const displayChapters = collapsed && filter === 'all'
        ? [...writtenChapters, ...unwrittenChapters.slice(0, 5)]
        : filteredChapters;

    const startEdit = (chapter) => {
        setEditMode(true);
        setEditForm({
            title: chapter.title,
            outline: chapter.outline,
            content: chapter.content
        });
        setSelectedChapter(chapter);
    };

    const saveEdit = async () => {
        if (!selectedChapter) return;
        try {
            await chaptersApi.update(selectedChapter.id, editForm);
            const res = await chaptersApi.list({ projectId: currentProject.id });
            setChapters(res.data || []);
            const updated = res.data?.find(c => c.id === selectedChapter.id);
            if (updated) setSelectedChapter(updated);
            setEditMode(false);
        } catch (e) {
            console.error('Save error:', e);
        }
    };

    const formatCascade = (cascade) => {
        const parts = [];
        if (cascade.reviews) parts.push(`${cascade.reviews}条审核`);
        if (cascade.pipelineLogs) parts.push(`${cascade.pipelineLogs}条流水线日志`);
        if (cascade.materials) parts.push(`${cascade.materials}个素材`);
        if (cascade.outputFiles) parts.push(`${cascade.outputFiles}个输出文件`);
        if (cascade.stateSnapshots) parts.push(`${cascade.stateSnapshots}个状态快照`);
        if (cascade.versionSnapshots) parts.push(`${cascade.versionSnapshots}个版本快照`);
        if (cascade.chapterAudits) parts.push(`${cascade.chapterAudits}条审计`);
        return parts.length > 0 ? `已清理关联数据：${parts.join('、')}` : '无关联数据需清理';
    };

    const deleteChapter = async (id) => {
        const ch = chapters.find(c => c.id === id);
        const label = ch ? `第${ch.chapterNumber}章 ${ch.title || ''}` : '此章节';
        if (!confirm(`确定删除「${label}」？\n\n将同时删除：审核记录、流水线日志、状态快照、版本快照、章节产出素材（非基底）、输出文件`)) return;
        try {
            const res = await chaptersApi.delete(id);
            const cascade = res.data?.cascade || {};
            alert(`章节已删除。${formatCascade(cascade)}`);
            if (selectedChapter?.id === id) setSelectedChapter(null);
            const listRes = await chaptersApi.list({ projectId: currentProject.id });
            setChapters(listRes.data || []);
        } catch (e) {
            console.error('Delete error:', e);
            alert('删除失败：' + (e.response?.data?.error || e.message));
        }
    };

    const resetChapter = async (id) => {
        const ch = chapters.find(c => c.id === id);
        const label = ch ? `第${ch.chapterNumber}章 ${ch.title || ''}` : '此章节';
        if (!confirm(`确定重置「${label}」？\n\n将保留大纲，清除：正文、审核记录、流水线日志、状态快照、版本快照、章节产出素材（非基底）、输出文件\n章节状态将回到「已规划」`)) return;
        try {
            const res = await chaptersApi.reset(id);
            const cascade = res.data?.cascade || {};
            alert(`章节已重置。${formatCascade(cascade)}`);
            const listRes = await chaptersApi.list({ projectId: currentProject.id });
            setChapters(listRes.data || []);
            const updated = listRes.data?.find(c => c.id === id);
            if (updated) setSelectedChapter(updated);
        } catch (e) {
            console.error('Reset error:', e);
            alert('重置失败：' + (e.response?.data?.error || e.message));
        }
    };

    const renderChapterCard = (ch) => (
        <div
            key={ch.id}
            className={`chapter-card ${selectedChapter?.id === ch.id ? 'cyber-card-glow' : ''}`}
            onClick={() => { setSelectedChapter(ch); setEditMode(false); }}
        >
            <div className="chapter-number">{ch.chapterNumber}</div>
            <div className="chapter-info">
                <div className="chapter-title">{ch.title}</div>
                <div className="chapter-meta">
                    <span className={`cyber-badge cyber-badge-${STATUS_COLORS[ch.status] || 'blue'}`}>
                        {STATUS_LABELS[ch.status] || ch.status}
                    </span>
                    <span>{ch.wordCount}字</span>
                    <span>R{ch.round}</span>
                </div>
            </div>
            <div className="chapter-actions">
                <button className="cyber-btn cyber-btn-sm" onClick={e => { e.stopPropagation(); startEdit(ch); }}>编辑</button>
                {WRITTEN_STATUSES.includes(ch.status) && (
                    <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-orange)' }} onClick={e => { e.stopPropagation(); resetChapter(ch.id); }}>重置</button>
                )}
                <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={e => { e.stopPropagation(); deleteChapter(ch.id); }}>删除</button>
            </div>
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">章节管理</h1>
                <p className="page-subtitle">查看和管理小说章节 - 支持手动编辑章节内容和大纲</p>
            </div>

            {!currentProject ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">▦</div>
                    <div>请先在仪表盘选择一个项目</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 20 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div className="cyber-section-title" style={{ marginBottom: 0 }}>章节列表 ({chapters.length})</div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    已写 {writtenChapters.length} / 未写 {unwrittenChapters.length}
                                </div>
                                {currentProject && writtenChapters.length > 0 && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                const resp = await chaptersApi.downloadNovel(currentProject.id);
                                                const blob = new Blob([resp.data], { type: 'text/plain;charset=utf-8' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                const disposition = resp.headers['content-disposition'];
                                                const match = disposition?.match(/filename="?([^"]+)"?/);
                                                a.download = match ? decodeURIComponent(match[1]) : `${currentProject.name || 'novel'}.txt`;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                URL.revokeObjectURL(url);
                                            } catch (e) {
                                                alert('下载失败: ' + e.message);
                                            }
                                        }}
                                        className="cyber-btn cyber-btn-sm cyber-btn-primary"
                                        style={{ fontSize: 11 }}>
                                        ⬇ 下载全本TXT
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            <button className={`cyber-btn cyber-btn-sm ${filter === 'all' ? 'cyber-btn-primary' : ''}`}
                                onClick={() => { setFilter('all'); setCollapsed(false); }}
                                style={{ fontSize: 11, flex: 1 }}>
                                全部 {chapters.length}
                            </button>
                            <button className={`cyber-btn cyber-btn-sm ${filter === 'written' ? 'cyber-btn-primary' : ''}`}
                                onClick={() => { setFilter('written'); setCollapsed(false); }}
                                style={{ fontSize: 11, flex: 1 }}>
                                ✅ 已写 {writtenChapters.length}
                            </button>
                            <button className={`cyber-btn cyber-btn-sm ${filter === 'unwritten' ? 'cyber-btn-primary' : ''}`}
                                onClick={() => { setFilter('unwritten'); setCollapsed(false); }}
                                style={{ fontSize: 11, flex: 1 }}>
                                📋 未写 {unwrittenChapters.length}
                            </button>
                        </div>

                        {filter === 'all' && unwrittenChapters.length > 5 && (
                            <button className="cyber-btn cyber-btn-sm"
                                onClick={() => setCollapsed(!collapsed)}
                                style={{ fontSize: 10, width: '100%', marginBottom: 6, opacity: 0.7 }}>
                                {collapsed
                                    ? `▼ 展开全部 (${unwrittenChapters.length} 个未写章节)`
                                    : `▲ 折叠未写章节 (仅显示前5个)`
                                }
                            </button>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
                            {chapters.length === 0 ? (
                                <div className="cyber-card cyber-empty" style={{ padding: 30 }}>
                                    <div>暂无章节</div>
                                </div>
                            ) : (
                                <>
                                    {filter === 'all' && !collapsed ? (
                                        <>
                                            {writtenChapters.length > 0 && (
                                                <>
                                                    <div style={{ fontSize: 10, color: 'var(--neon-green)', fontWeight: 700, padding: '4px 0', borderBottom: '1px solid rgba(0,200,100,0.15)' }}>
                                                        ✅ 已写 ({writtenChapters.length})
                                                    </div>
                                                    {writtenChapters.map(renderChapterCard)}
                                                </>
                                            )}
                                            {unwrittenChapters.length > 0 && (
                                                <>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, padding: '4px 0', marginTop: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                        📋 未写 ({unwrittenChapters.length})
                                                    </div>
                                                    {unwrittenChapters.map(renderChapterCard)}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        displayChapters.map(renderChapterCard)
                                    )}
                                    {collapsed && filter === 'all' && unwrittenChapters.length > 5 && (
                                        <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>
                                            还有 {unwrittenChapters.length - 5} 个未写章节已折叠
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div>
                        {selectedChapter ? (
                            <div>
                                <div className="cyber-section-title">
                                    第{selectedChapter.chapterNumber}章: {selectedChapter.title}
                                </div>
                                {editMode ? (
                                    <div className="cyber-card">
                                        <div className="form-group">
                                            <label className="form-label">章节标题</label>
                                            <input className="cyber-input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">章节大纲</label>
                                            <textarea className="cyber-textarea" value={editForm.outline} onChange={e => setEditForm({ ...editForm, outline: e.target.value })} rows={4} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">正文内容</label>
                                            <textarea className="cyber-textarea" value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })} rows={15} style={{ minHeight: 400 }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="cyber-btn cyber-btn-success" onClick={saveEdit}>保存</button>
                                            <button className="cyber-btn" onClick={() => setEditMode(false)}>取消</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="cyber-card">
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                                                <span className={`cyber-badge cyber-badge-${STATUS_COLORS[selectedChapter.status]}`}>
                                                    {STATUS_LABELS[selectedChapter.status]}
                                                </span>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                    字数: {selectedChapter.wordCount} | 轮次: {selectedChapter.round}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: 16 }}>
                                            <div className="form-label">章节大纲</div>
                                            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                                                {selectedChapter.outline || '暂无大纲'}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="form-label">正文内容</div>
                                            <div style={{
                                                fontSize: 14,
                                                lineHeight: 1.8,
                                                padding: 16,
                                                background: 'var(--bg-input)',
                                                borderRadius: 'var(--radius-md)',
                                                maxHeight: 500,
                                                overflow: 'auto',
                                                whiteSpace: 'pre-wrap'
                                            }}>
                                                {selectedChapter.content || '暂无内容，请通过流水线生成'}
                                            </div>
                                        </div>

                                        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                                            <button className="cyber-btn" onClick={() => startEdit(selectedChapter)}>手动编辑</button>
                                            {WRITTEN_STATUSES.includes(selectedChapter.status) && (
                                                <button className="cyber-btn" style={{ color: 'var(--neon-orange)' }} onClick={() => resetChapter(selectedChapter.id)}>重置章节</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="cyber-card cyber-empty">
                                <div className="cyber-empty-icon">▦</div>
                                <div>选择左侧章节查看详情</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
