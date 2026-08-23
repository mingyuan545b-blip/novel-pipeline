import { useState, useCallback } from 'react';
import logger from '../../shared/logger';
import { flavorsApi, projectsApi } from '../../services/api';

const INITIAL_FLAVOR_FORM = {
    namingStyle: '', namingStyleIntensity: 'medium',
    defaultDialect: '', defaultDialectIntensity: 'medium',
    defaultSpeechStyle: '', defaultSpeechStyleIntensity: 'medium',
    worldviewTemplate: '', systemPersona: ''
};

export default function useFlavorState({ currentProject, setProjects, showError: _showError }) {
    const [flavorNamingStyles, setFlavorNamingStyles] = useState([]);
    const [flavorDialects, setFlavorDialects] = useState([]);
    const [flavorSpeechStyles, setFlavorSpeechStyles] = useState([]);
    const [worldviewTemplates, setWorldviewTemplates] = useState([]);
    const [systemPersonas, setSystemPersonas] = useState([]);
    const [editingFlavor, setEditingFlavor] = useState(false);
    const [flavorForm, setFlavorForm] = useState(INITIAL_FLAVOR_FORM);
    const [expandedFlavorDetail, setExpandedFlavorDetail] = useState(null);
    const [flavorDetailData, setFlavorDetailData] = useState(null);
    const [flavorDetailLoading, setFlavorDetailLoading] = useState(false);

    const loadFlavorOptions = useCallback(async () => {
        flavorsApi.getNamingStyles().then(res => setFlavorNamingStyles(res.data || [])).catch(() => {});
        flavorsApi.getDialects().then(res => setFlavorDialects(res.data || [])).catch(() => {});
        flavorsApi.getStyles().then(res => setFlavorSpeechStyles(res.data || [])).catch(() => {});
        flavorsApi.getWorldviewTemplates().then(res => setWorldviewTemplates(res.data || [])).catch(() => {});
        flavorsApi.getSystemPersonas().then(res => setSystemPersonas(res.data || [])).catch(() => {});
    }, []);

    const startEditFlavor = useCallback(() => {
        const sp = currentProject?.styleProfile || {};
        setFlavorForm({
            namingStyle: sp.namingStyle || '', namingStyleIntensity: sp.namingStyleIntensity || 'medium',
            defaultDialect: sp.defaultDialect || '', defaultDialectIntensity: sp.defaultDialectIntensity || 'medium',
            defaultSpeechStyle: sp.defaultSpeechStyle || '', defaultSpeechStyleIntensity: sp.defaultSpeechStyleIntensity || 'medium',
            worldviewTemplate: sp.worldviewTemplate || '', systemPersona: sp.systemPersona || ''
        });
        setEditingFlavor(true);
    }, [currentProject]);

    const saveFlavor = useCallback(async () => {
        try {
            await projectsApi.update(currentProject.id, { styleProfile: { ...(currentProject.styleProfile || {}), ...flavorForm } });
            const projRes = await projectsApi.list();
            setProjects(projRes.data);
            setEditingFlavor(false);
        } catch (e) { alert('保存失败: ' + e.message); }
    }, [currentProject, flavorForm, setProjects]);

    const handleFlavorTagClick = useCallback(async (tagKey, tagId) => {
        if (expandedFlavorDetail === tagKey) {
            setExpandedFlavorDetail(null); setFlavorDetailData(null); return;
        }
        setExpandedFlavorDetail(tagKey); setFlavorDetailData(null); setFlavorDetailLoading(true);
        try {
            const sp = currentProject?.styleProfile || {};
            let res;
            if (tagKey === 'dialect') res = await flavorsApi.previewDialect(tagId, sp.defaultDialectIntensity || 'medium');
            else if (tagKey === 'speechStyle') res = await flavorsApi.previewStyle(tagId, sp.defaultSpeechStyleIntensity || 'medium');
            else if (tagKey === 'namingStyle') res = await flavorsApi.previewNamingStyle(tagId, sp.namingStyleIntensity || 'medium');
            else if (tagKey === 'systemPersona') res = await flavorsApi.previewSystemPersona(tagId);
            else if (tagKey === 'worldviewTemplate') res = await flavorsApi.getWorldviewTemplate(tagId);
            setFlavorDetailData(res?.data || null);
        } catch (e) {
            logger.error('useFlavorState', 'Flavor detail fetch error:', e.message);
            setFlavorDetailData({ error: true, message: e.message || '加载失败' });
        }
        setFlavorDetailLoading(false);
    }, [expandedFlavorDetail, currentProject]);

    const closeFlavorDetail = useCallback(() => {
        setExpandedFlavorDetail(null); setFlavorDetailData(null);
    }, []);

    return {
        flavorNamingStyles, flavorDialects, flavorSpeechStyles,
        worldviewTemplates, systemPersonas,
        editingFlavor, setEditingFlavor, flavorForm, setFlavorForm,
        startEditFlavor, saveFlavor, loadFlavorOptions,
        expandedFlavorDetail, flavorDetailData, flavorDetailLoading,
        handleFlavorTagClick, closeFlavorDetail
    };
}
