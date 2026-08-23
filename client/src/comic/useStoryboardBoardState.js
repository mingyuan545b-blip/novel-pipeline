import { useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { comicApi } from '../services/api';

const DEFAULT_BOARD = {
    chapterId: '', sceneIndex: 0, description: '', prompt: '',
    negativePrompt: '', workflowId: '', width: 768, height: 512,
    dialogue: '', voice: '', duration: 5
};

const DEFAULT_VOICES = [
    { key: 'zh-CN-XiaoxiaoNeural', name: '晓晓（女·温柔）' },
    { key: 'zh-CN-YunxiNeural', name: '云希（男·阳光）' },
    { key: 'zh-CN-YunjianNeural', name: '云健（男·沉稳）' },
    { key: 'zh-CN-XiaoyiNeural', name: '晓依（女·活泼）' },
    { key: 'zh-CN-YunyangNeural', name: '云扬（男·新闻）' }
];

export function useStoryboardBoardState() {
    const { currentProject } = useAppStore();
    const [storyboards, setStoryboards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newBoard, setNewBoard] = useState({ ...DEFAULT_BOARD });
    const [voices, setVoices] = useState(DEFAULT_VOICES);
    const [exporting, setExporting] = useState(false);
    const [exportResult, setExportResult] = useState(null);

    useEffect(() => { comicApi.getTTSVoices().then(res => { if (res.data?.length) setVoices(res.data); }).catch(() => {}); }, []);

    const loadStoryboards = async () => {
        if (!currentProject) return;
        setLoading(true);
        try { setStoryboards((await comicApi.getStoryboards(currentProject.id)).data || []); } catch { setStoryboards([]); }
        finally { setLoading(false); }
    };

    const handleCreate = async () => {
        if (!newBoard.description.trim()) { alert('请输入分镜描述'); return; }
        setLoading(true);
        try {
            await comicApi.createStoryboard({ ...newBoard, projectId: currentProject.id });
            setNewBoard({ ...DEFAULT_BOARD }); setShowCreate(false); await loadStoryboards();
        } catch (e) { alert('创建失败: ' + e.message); } finally { setLoading(false); }
    };

    const handleRender = async (id) => {
        try { await comicApi.renderStoryboard(id); await loadStoryboards(); } catch (e) { alert('渲染失败: ' + e.message); }
    };

    const handleBatchRender = async () => {
        const readyBoards = storyboards.filter(s => s.status === 'ready');
        if (readyBoards.length === 0) { alert('没有待渲染的分镜'); return; }
        try { await comicApi.batchRender(readyBoards.map(s => s.id)); await loadStoryboards(); } catch (e) { alert('批量渲染失败: ' + e.message); }
    };

    const handleExportEpisode = async () => {
        if (!currentProject) return;
        const doneBoards = storyboards.filter(s => s.status === 'done' && s.imageUrl);
        if (doneBoards.length === 0) { alert('没有已完成的分镜可导出'); return; }
        setExporting(true); setExportResult(null);
        try {
            const scenes = doneBoards.map(sb => ({ imagePath: sb.imageUrl || '', videoPath: sb.videoUrl || '', dialogue: sb.dialogue || '', voice: sb.voice || '', duration: sb.duration || 5 }));
            setExportResult((await comicApi.exportEpisode({ projectId: currentProject.id, episode: 1, title: `EP01-${currentProject.name || '漫剧'}`, scenes, defaultVoice: 'zh-CN-YunxiNeural', burnSubtitles: true })).data);
        } catch (e) { setExportResult({ success: false, error: e.response?.data?.error || e.message }); } finally { setExporting(false); }
    };

    const handleTTSPreview = async (text, voice) => {
        if (!text || !currentProject) return;
        try { await comicApi.synthesizeTTS({ text, voice: voice || 'zh-CN-YunxiNeural', projectId: currentProject.id, fileName: `preview_${Date.now()}.mp3` }); alert('语音已生成'); } catch (e) { alert('TTS失败: ' + e.message); }
    };

    return {
        currentProject, storyboards, loading, showCreate, setShowCreate,
        newBoard, setNewBoard, voices, exporting, exportResult,
        loadStoryboards, handleCreate, handleRender, handleBatchRender,
        handleExportEpisode, handleTTSPreview,
    };
}
