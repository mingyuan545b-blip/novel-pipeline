/**
 * useStoryBibleState — 全书设定：项目级字段的加载与保存
 *
 * 保存后服务端会 resetDataContext（见 routes/projects/crudRoutes.js），
 * 因此改动对**后续章节**立即生效；已生成章节不会回溯。
 * 文件位置：client/src/pages/storybible/useStoryBibleState.js
 */
import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import { projectsApi, flavorsApi } from '../../services/api';
import logger from '../../shared/logger';

export default function useStoryBibleState() {
    const { currentProject } = useAppStore();
    const projectId = currentProject?.id || null;
    const [project, setProject] = useState(null);
    const [draft, setDraft] = useState(null);
    const [dialects, setDialects] = useState([]);
    const [speechStyles, setSpeechStyles] = useState([]);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        if (!projectId) { setProject(null); return; }
        try {
            const res = await projectsApi.get(projectId);
            const p = res.project || res.data || res;
            setProject(p);
            setDraft({
                name: p.name || '', subGenre: p.subGenre || '', genreProfile: p.genreProfile || '',
                description: p.description || '', targetChapters: p.targetChapters || 0,
                targetWordCount: p.targetWordCount || 0,
                style: { ...(p.styleProfile || {}) },
                word: { ...(p.wordConfig || {}) },
            });
        } catch (e) { logger.warn('StoryBible', 'load project failed:', e.message); }
    }, [projectId]);

    // 方言/语体清单（题材无关，全局共用），只在首次打开时拉一次
    useEffect(() => {
        flavorsApi.getDialects().then(r => setDialects(r.data || r || [])).catch(e => logger.warn('StoryBible', e.message));
        flavorsApi.getStyles().then(r => setSpeechStyles(r.data || r || [])).catch(e => logger.warn('StoryBible', e.message));
    }, []);

    useEffect(() => { load(); }, [load]);

    const setField = (key, value) => setDraft(d => (d ? { ...d, [key]: value } : d));
    const setStyle = (key, value) => setDraft(d => (d ? { ...d, style: { ...d.style, [key]: value } } : d));
    const setWord = (key, value) => setDraft(d => (d ? { ...d, word: { ...d.word, [key]: Number(value) || 0 } } : d));

    /** 保存：项目主体 + 目标章数（两个端点，串行避免互相覆盖） */
    const save = useCallback(async () => {
        if (!projectId || !draft) return;
        setSaving(true); setNotice('');
        try {
            await projectsApi.update(projectId, {
                name: draft.name, subGenre: draft.subGenre, genreProfile: draft.genreProfile,
                description: draft.description,
                styleProfile: { ...(project?.styleProfile || {}), ...draft.style },
                wordConfig: draft.word,
            });
            await projectsApi.saveTargets(projectId, {
                targetChapters: Number(draft.targetChapters) || 0,
                targetWordCount: Number(draft.targetWordCount) || 0,
            });
            await load();
            setNotice('已保存，并已通知后台：后续章节的规划/写作会使用新设定（已生成章节不回溯）');
        } catch (e) {
            setNotice(`保存失败：${e.message}`);
        } finally { setSaving(false); }
    }, [projectId, draft, project, load]);

    const reset = () => { if (project) load(); };

    return { projectId, currentProject, project, draft, setDraft, setField, setStyle, setWord, save, reset, saving, notice, dialects, speechStyles };
}
