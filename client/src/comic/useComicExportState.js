import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { comicApi } from '../services/api';
import logger from '../shared/logger';

const DEFAULT_VOICES = [
    { key: 'zh-CN-XiaoxiaoNeural', name: '晓晓（女·温柔）' },
    { key: 'zh-CN-XiaoyiNeural', name: '晓依（女·活泼）' },
    { key: 'zh-CN-YunjianNeural', name: '云健（男·沉稳）' },
    { key: 'zh-CN-YunxiNeural', name: '云希（男·阳光）' },
    { key: 'zh-CN-YunxiaNeural', name: '云夏（男·少年）' },
    { key: 'zh-CN-YunyangNeural', name: '云扬（男·新闻）' }
];

const INITIAL_SCENE = { imagePath: '', videoPath: '', dialogue: '', voice: '', duration: 5 };

export default function useComicExportState() {
    const { currentProject } = useAppStore();
    const [voices, setVoices] = useState(DEFAULT_VOICES);
    const [defaultVoice, setDefaultVoice] = useState('zh-CN-YunxiNeural');
    const [episodeNumber, setEpisodeNumber] = useState(1);
    const [episodeTitle, setEpisodeTitle] = useState('');
    const [scenes, setScenes] = useState([{ ...INITIAL_SCENE }]);
    const [exporting, setExporting] = useState(false);
    const [exportResult, setExportResult] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [burnSubtitles, setBurnSubtitles] = useState(false);

    useEffect(() => {
        comicApi.getTTSVoices().then(res => {
            if (res.data?.length) setVoices(res.data);
        }).catch(() => {});
    }, []);

    const loadEpisodes = useCallback(async () => {
        if (!currentProject) return;
        try {
            const res = await comicApi.getExportStatus(currentProject.id);
            setEpisodes(res.data?.episodes || []);
        } catch { /* episodes optional */ }
    }, [currentProject]);

    useEffect(() => { loadEpisodes(); }, [loadEpisodes]);

    const addScene = () => {
        setScenes([...scenes, { ...INITIAL_SCENE }]);
    };

    const removeScene = (idx) => {
        if (scenes.length <= 1) return;
        setScenes(scenes.filter((_, i) => i !== idx));
    };

    const updateScene = (idx, field, value) => {
        const updated = [...scenes];
        updated[idx] = { ...updated[idx], [field]: value };
        setScenes(updated);
    };

    const handleExport = async () => {
        if (!currentProject) return;
        setExporting(true);
        setExportResult(null);
        try {
            const res = await comicApi.exportEpisode({
                projectId: currentProject.id,
                episode: episodeNumber,
                title: episodeTitle || `EP${String(episodeNumber).padStart(2, '0')}`,
                scenes,
                defaultVoice,
                burnSubtitles
            });
            setExportResult(res.data);
            loadEpisodes();
        } catch (e) {
            setExportResult({ success: false, error: e.response?.data?.error || e.message });
        } finally {
            setExporting(false);
        }
    };

    const handleTTSPreview = async (text, voice) => {
        if (!text || !currentProject) return;
        try {
            await comicApi.synthesizeTTS({
                text,
                voice: voice || defaultVoice,
                projectId: currentProject.id,
                fileName: `preview_${Date.now()}.mp3`
            });
        } catch (e) {
            logger.error('ComicExport', 'TTS preview error:', e.message);
        }
    };

    return {
        currentProject, voices, defaultVoice, setDefaultVoice,
        episodeNumber, setEpisodeNumber, episodeTitle, setEpisodeTitle,
        scenes, addScene, removeScene, updateScene,
        exporting, exportResult, episodes, burnSubtitles, setBurnSubtitles,
        handleExport, handleTTSPreview
    };
}
