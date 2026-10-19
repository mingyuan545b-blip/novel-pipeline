import { useState, useEffect, useCallback } from 'react';
import { knowledgeAccessApi } from '../../services/api';

const EMPTY_FORM = { factId: '', entityName: '', confidence: 'certain', sourceHow: 'witnessed', notes: '' };

/** 查询参数构造（模块级纯函数：effect 与事件处理器共用同一口径，且不进 hook 依赖推断） */
function buildListParams(projectId, factId, entityId) {
    const params = { projectId };
    if (factId) params.factId = factId;
    if (entityId) params.entityId = entityId;
    return params;
}

export default function useKnowledgeState(projectId, characters) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);   // 初始即"加载中"
    // category/chapter/query 为客户端筛选（分类=factId前缀，章节=sinceChapter），不触发重新拉取
    const [filter, setFilter] = useState({ factId: '', entityId: '', category: 'all', chapter: 'all', query: '' });
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const loadRecords = useCallback(async () => {
        if (!projectId) return;
        try {
            const params = buildListParams(projectId, filter.factId, filter.entityId);
            if (filter.factId) params.factId = filter.factId;
            if (filter.entityId) params.entityId = filter.entityId;
            const res = await knowledgeAccessApi.list(params);
            setRecords(res.data || []);
        } catch { setRecords([]); }
        setLoading(false);
    }, [projectId, filter.factId, filter.entityId]);

    // 查询条件变化 → 渲染期重置为"加载中"（不在 effect 内同步 setState，避免级联渲染 + lint 拦截）
    const queryKey = `${projectId}|${filter.factId}|${filter.entityId}`;
    const [prevQueryKey, setPrevQueryKey] = useState(queryKey);
    if (queryKey !== prevQueryKey) {
        setPrevQueryKey(queryKey);
        setLoading(true);
        setRecords([]);
    }

    // effect 直接发起请求（不在 effect 内同步 setState）：回调里 setState 属于异步、不触发级联渲染
    useEffect(() => {
        if (!projectId) return undefined;
        let cancelled = false;
        knowledgeAccessApi.list(buildListParams(projectId, filter.factId, filter.entityId))
            .then(res => { if (!cancelled) setRecords(res.data || []); })
            .catch(() => { if (!cancelled) setRecords([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [projectId, filter.factId, filter.entityId]);

    const handleCreate = async () => {
        if (!form.factId || !form.entityName) return;
        setSaving(true);
        try {
            const entity = characters.find(c => (c._adapted?.name || c.name) === form.entityName);
            await knowledgeAccessApi.create({
                projectId, factId: form.factId,
                entityId: entity?.id || form.entityName,
                factText: form.factId,
                confidence: form.confidence, sourceHow: form.sourceHow, notes: form.notes,
            });
            setForm(EMPTY_FORM); setShowForm(false); loadRecords();
        } catch { /* optional */ }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        try { await knowledgeAccessApi.delete(id); loadRecords(); } catch { /* optional */ }
    };

    const updateFilter = (key, value) => setFilter(f => ({ ...f, [key]: value }));
    const updateForm = (key, value) => setForm(f => ({ ...f, [key]: value }));

    return {
        records, loading, filter, showForm, form, saving,
        setShowForm, updateFilter, updateForm, handleCreate, handleDelete, loadRecords,
    };
}
