import { useState } from 'react';
import useAppStore from '../../store/useAppStore';
import { useChapters, useUpdateChapter, useDeleteChapter, useResetChapter } from '../../hooks/queries';
import { chaptersApi } from '../../services/api';
import logger from '../../shared/logger';
import { STATUS_LABELS, STATUS_COLORS, WRITTEN_STATUSES } from '../../shared/chapterStatusConstants';

export { STATUS_LABELS, STATUS_COLORS, WRITTEN_STATUSES };

export default function useChaptersState() {
    const { currentProject, chapters } = useAppStore();
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [filter, setFilter] = useState('all');
    const [collapsed, setCollapsed] = useState(false);

    const chaptersQuery = useChapters(currentProject?.id);
    const updateChapter = useUpdateChapter();
    const deleteChapterMutation = useDeleteChapter();
    const resetChapterMutation = useResetChapter();

    const chapterList = chaptersQuery.data || chapters;
    const writtenChapters = chapterList.filter(ch => WRITTEN_STATUSES.includes(ch.status));
    const unwrittenChapters = chapterList.filter(ch => !WRITTEN_STATUSES.includes(ch.status));

    const filteredChapters = (() => {
        if (filter === 'written') return writtenChapters;
        if (filter === 'unwritten') return unwrittenChapters;
        return chapterList;
    })();

    const displayChapters = collapsed && filter === 'all'
        ? [...writtenChapters, ...unwrittenChapters.slice(0, 5)]
        : filteredChapters;

    const startEdit = (chapter) => {
        setEditMode(true);
        setEditForm({ title: chapter.title, outline: chapter.outline, content: chapter.content });
        setSelectedChapter(chapter);
    };

    const saveEdit = async () => {
        if (!selectedChapter) return;
        try {
            await updateChapter.mutateAsync({ id: selectedChapter.id, data: editForm });
            const r = await chaptersQuery.refetch();
            const updated = r.data?.find(c => c.id === selectedChapter.id);
            if (updated) setSelectedChapter(updated);
            setEditMode(false);
        } catch (e) { logger.error('Chapters', 'Save error:', e.message); }
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

    const handleDeleteChapter = async (id) => {
        const ch = chapterList.find(c => c.id === id);
        const label = ch ? `第${ch.chapterNumber}章 ${ch.title || ''}` : '此章节';
        if (!confirm(`确定删除「${label}」？\n\n将同时删除：审核记录、流水线日志、状态快照、版本快照、章节产出素材（非基底）、输出文件`)) return;
        try {
            const res = await deleteChapterMutation.mutateAsync(id);
            alert(`章节已删除。${formatCascade(res?.cascade || {})}`);
            if (selectedChapter?.id === id) setSelectedChapter(null);
        } catch (e) { alert('删除失败：' + (e.response?.data?.error || e.message)); }
    };

    const handleResetChapter = async (id) => {
        const ch = chapterList.find(c => c.id === id);
        const label = ch ? `第${ch.chapterNumber}章 ${ch.title || ''}` : '此章节';
        if (!confirm(`确定重置「${label}」？\n\n将保留大纲，清除：正文、审核记录、流水线日志、状态快照、版本快照、章节产出素材（非基底）、输出文件\n章节状态将回到「已规划」`)) return;
        try {
            const res = await resetChapterMutation.mutateAsync(id);
            alert(`章节已重置。${formatCascade(res?.cascade || {})}`);
            const r = await chaptersQuery.refetch();
            const updated = r.data?.find(c => c.id === id);
            if (updated) setSelectedChapter(updated);
        } catch (e) { alert('重置失败：' + (e.response?.data?.error || e.message)); }
    };

    const handleDownload = async () => {
        try {
            const resp = await chaptersApi.downloadNovel(currentProject.id);
            const blob = new Blob([resp.data], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const disposition = resp.headers['content-disposition'];
            const match = disposition?.match(/filename="?([^"]+)"?/);
            a.download = match ? decodeURIComponent(match[1]) : `${currentProject.name || 'novel'}.txt`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch (e) { alert('下载失败: ' + e.message); }
    };

    return {
        currentProject, chapterList, selectedChapter, setSelectedChapter,
        editMode, setEditMode, editForm, setEditForm, filter, setFilter,
        collapsed, setCollapsed, writtenChapters, unwrittenChapters,
        displayChapters, startEdit, saveEdit, handleDeleteChapter,
        handleResetChapter, handleDownload,
    };
}
