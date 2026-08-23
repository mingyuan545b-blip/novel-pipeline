import { chaptersApi } from '../services/api';
import logger from '../../../shared/logger';
import { ChapterCard } from './ChapterComponents';
import { WRITTEN_STATUSES } from '../../../shared/chapterStatusConstants';

const formatCascade = (cascade) => {
    const parts = [];
    if (cascade?.reviews) parts.push(`${cascade.reviews}条审核`);
    if (cascade?.pipelineLogs) parts.push(`${cascade.pipelineLogs}条流水线日志`);
    if (cascade?.materials) parts.push(`${cascade.materials}个素材`);
    if (cascade?.outputFiles) parts.push(`${cascade.outputFiles}个输出文件`);
    if (cascade?.stateSnapshots) parts.push(`${cascade.stateSnapshots}个状态快照`);
    if (cascade?.versionSnapshots) parts.push(`${cascade.versionSnapshots}个版本快照`);
    if (cascade?.chapterAudits) parts.push(`${cascade.chapterAudits}条审计`);
    return parts.length > 0 ? `已清理关联数据：${parts.join('、')}` : '无关联数据需清理';
};

export default function ChapterList({ chapters, selectedChapter, onSelect, onEdit, onDelete, onReset, filter, setFilter, collapsed, setCollapsed }) {
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

    const handleDelete = async (id) => {
        const ch = chapters.find(c => c.id === id);
        const label = ch ? `第${ch.chapterNumber}章 ${ch.title || ''}` : '此章节';
        if (!confirm(`确定删除「${label}」？\n\n将同时删除：审核记录、流水线日志、状态快照、版本快照、章节产出素材（非基底）、输出文件`)) return;
        try {
            const res = await chaptersApi.delete(id);
            const cascade = res.data?.cascade || {};
            alert(`章节已删除。${formatCascade(cascade)}`);
            onDelete?.(id);
        } catch (e) {
            logger.error('ChapterList', 'Delete error:', e.message);
            alert('删除失败：' + (e.response?.data?.error || e.message));
        }
    };

    const handleReset = async (id) => {
        const ch = chapters.find(c => c.id === id);
        const label = ch ? `第${ch.chapterNumber}章 ${ch.title || ''}` : '此章节';
        if (!confirm(`确定重置「${label}」？\n\n将保留大纲，清除：正文、审核记录、流水线日志、状态快照、版本快照、章节产出素材（非基底）、输出文件\n章节状态将回到「已规划」`)) return;
        try {
            const res = await chaptersApi.reset(id);
            const cascade = res.data?.cascade || {};
            alert(`章节已重置。${formatCascade(cascade)}`);
            onReset?.(id);
        } catch (e) {
            logger.error('ChapterList', 'Reset error:', e.message);
            alert('重置失败：' + (e.response?.data?.error || e.message));
        }
    };

    return (
        <div className="chapter-list-panel">
            <div className="chapter-list-header">
                <h3>章节列表 ({chapters.length})</h3>
                <div className="chapter-filters">
                    <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>全部</button>
                    <button className={`filter-btn ${filter === 'written' ? 'active' : ''}`} onClick={() => setFilter('written')}>已写</button>
                    <button className={`filter-btn ${filter === 'unwritten' ? 'active' : ''}`} onClick={() => setFilter('unwritten')}>未写</button>
                    <button className="filter-btn collapse-btn" onClick={() => setCollapsed(!collapsed)}>
                        {collapsed ? '展开' : '收起'}
                    </button>
                </div>
            </div>
            <div className="chapter-list">
                {displayChapters.length === 0 && (
                    <p className="empty-state">暂无章节</p>
                )}
                {displayChapters.map(ch => (
                    <ChapterCard
                        key={ch.id}
                        chapter={ch}
                        selected={selectedChapter?.id === ch.id}
                        onSelect={onSelect}
                        onEdit={onEdit}
                        onDelete={handleDelete}
                        onReset={handleReset}
                    />
                ))}
            </div>
        </div>
    );
}
