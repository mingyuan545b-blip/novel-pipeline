import { useState, useEffect, useCallback } from 'react';
import { knowledgeAccessApi } from '../../services/api';

const EMPTY_FORM = { factId: '', entityName: '', confidence: 'certain', sourceHow: 'witnessed', notes: '' };

export default function useKnowledgeState(projectId, characters) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState({ factId: '', entityId: '' });
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const loadRecords = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const params = { projectId };
            if (filter.factId) params.factId = filter.factId;
            if (filter.entityId) params.entityId = filter.entityId;
            const res = await knowledgeAccessApi.list(params);
            setRecords(res.data || []);
        } catch { setRecords([]); }
        setLoading(false);
    }, [projectId, filter.factId, filter.entityId]);

    useEffect(() => { loadRecords(); }, [loadRecords]);

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
