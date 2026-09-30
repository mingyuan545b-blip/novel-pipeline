/**
 * useCharacterSettings — 角色语言/背景设定：列表 + 编辑 + 保存
 *
 * 保存走 PUT /api/materials/:id（后端白名单内的字段 + 版本号自增 + changeLog 留痕），
 * 路由保存后会 resetDataContext + memory.invalidateCache，
 * 因此**后续章节**的执笔人/意图规划会读到新设定；已生成章节不回溯。
 * 文件位置：client/src/pages/storybible/useCharacterSettings.js
 */
import { useState, useEffect, useCallback } from 'react';
import { materialsApi } from '../../services/api';
import { asText, asIntensity } from './storyBibleConstants';
import logger from '../../shared/logger';

export default function useCharacterSettings(projectId) {
    const [characters, setCharacters] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');
    const [keyword, setKeyword] = useState('');

    const load = useCallback(async () => {
        if (!projectId) { setCharacters([]); return; }
        try {
            const res = await materialsApi.list({ projectId, type: 'character' });
            const list = (Array.isArray(res) ? res : (res.data || [])).filter(m => !m.archived);
            setCharacters(list);
        } catch (e) { logger.warn('StoryBible', 'load characters failed:', e.message); }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const open = (m) => {
        setSelectedId(m.id);
        setNotice('');
        // 一律转成字符串：后端这些字段可能是 null / 对象（引用型），直接放进受控 input 会渲染成 [object Object]
        const next = {
            dialectRegion: asText(m.dialectRegion),
            dialectIntensity: asIntensity(m.dialectIntensity),
            speechStyle: asText(m.speechStyle),
            speechStyleIntensity: asIntensity(m.speechStyleIntensity),
            parentPlane: asText(m.parentPlane),
            parentFaction: asText(m.parentFaction),
            description: asText(m.description),
            currentContent: asText(m.currentContent),
        };
        setDraft(next);
    };

    const setField = (key, value) => setDraft(d => (d ? { ...d, [key]: value } : d));

    const save = useCallback(async () => {
        if (!selectedId || !draft) return;
        setSaving(true); setNotice('');
        try {
            await materialsApi.update(selectedId, draft);
            await load();
            setNotice('已保存到素材库，后续章节会按新设定写这个角色');
        } catch (e) {
            setNotice(`保存失败：${e.message}`);
        } finally { setSaving(false); }
    }, [selectedId, draft, load]);

    const filtered = keyword.trim()
        ? characters.filter(c => (c.name || '').includes(keyword.trim()))
        : characters;

    return { characters: filtered, total: characters.length, selectedId, draft, open, setField, save, reset: load, saving, notice, keyword, setKeyword };
}
