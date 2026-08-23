import { useState, useEffect, useMemo } from 'react';
import useAppStore from '../../store/useAppStore';
import { getProvider } from './settingsConstants';
// 修复：原实现用原生fetch绕过了鉴权拦截器（无token导致401），改用统一的带鉴权api实例
import { api } from '../../services/api';

export default function useSettingsState() {
    const settingsRaw = useAppStore(s => s.settings);
    const settings = useMemo(() => settingsRaw || {}, [settingsRaw]);
    const setSettings = useAppStore(s => s.setSettings);
    const theme = useAppStore(s => s.theme);
    const setTheme = useAppStore(s => s.setTheme);
    const membershipRaw = useAppStore(s => s.membership);
    const membership = membershipRaw || { level: 'free', licensed: false };
    const bgImage = useAppStore(s => s.bgImage);
    const setBgImage = useAppStore(s => s.setBgImage);
    const bgOpacity = useAppStore(s => s.bgOpacity);
    const setBgOpacity = useAppStore(s => s.setBgOpacity);
    const bgBlur = useAppStore(s => s.bgBlur);
    const setBgBlur = useAppStore(s => s.setBgBlur);

    const [form, setForm] = useState({ apiKey: '', groupId: '', model: 'qwen3.6-plus', provider: 'aliyunCoding', baseURL: '' });
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);
    const [apiKeys, setApiKeys] = useState([]);
    const [agentBindings, setAgentBindings] = useState([]);
    const [newKey, setNewKey] = useState({ name: '', apiKey: '', groupId: '', model: 'qwen3.6-plus', provider: 'aliyunCoding', baseURL: '' });
    const [showAddKey, setShowAddKey] = useState(false);

    const reloadKeys = async () => {
        try {
            const [keysRes, bindingsRes] = await Promise.all([
                api.get('/api-keys').then(r => r.data),
                api.get('/api-keys/agent-bindings').then(r => r.data)
            ]);
            setApiKeys(Array.isArray(keysRes) ? keysRes : (keysRes?.keys || []));
            setAgentBindings(Array.isArray(bindingsRes) ? bindingsRes : (bindingsRes?.bindings || bindingsRes?.data || []));
        } catch { /* ignore */ }
    };

    useEffect(() => { reloadKeys(); }, []);

    useEffect(() => {
        setForm(prev => ({ ...prev, groupId: settings.groupId || '', model: settings.model || 'qwen3.6-plus', provider: settings.provider || 'aliyunCoding', baseURL: settings.baseURL || '' }));
    }, [settings]);

    const currentProvider = getProvider(form.provider);
    const newKeyProvider = getProvider(newKey.provider);

    const saveSettings = async () => {
        setSaving(true); setSaveMsg(null);
        try {
            const data = { ...form };
            if (!data.apiKey && settings.hasKey) delete data.apiKey;
            await api.post('/settings', data);
            const res = await api.get('/settings').then(r => r.data);
            if (res) setSettings(res);
            setSaveMsg({ type: 'success', text: '设置已保存' });
        } catch (e) { setSaveMsg({ type: 'error', text: '保存失败: ' + (e.message || '未知错误') }); }
        finally { setSaving(false); setTimeout(() => setSaveMsg(null), 5000); }
    };

    const testConnection = async () => {
        setTesting(true); setTestResult(null);
        try {
            const res = await api.post('/settings/test', { apiConfig: { apiKey: form.apiKey || undefined, groupId: form.groupId || undefined, model: form.model, provider: form.provider, baseURL: form.baseURL || undefined, agentLabel: currentProvider.name } }).then(r => r.data);
            const data = await res.json();
            setTestResult(data || { success: false, message: '无响应数据' });
        } catch (e) { setTestResult({ success: false, message: e.message || '网络请求失败' }); }
        finally { setTesting(false); }
    };

    const addApiKey = async () => {
        if (!newKey.apiKey) { alert('请输入API Key'); return; }
        try {
            await api.post('/api-keys', newKey);
            setNewKey({ name: '', apiKey: '', groupId: '', model: 'qwen3.6-plus', provider: 'aliyunCoding', baseURL: '' });
            setShowAddKey(false);
            await reloadKeys();
        } catch (e) { alert('添加失败: ' + e.message); }
    };

    const deleteApiKey = async (id) => {
        await api.delete(`/api-keys/${id}`);
        await reloadKeys();
    };

    const bindAgent = async (agentType, keyId) => {
        try {
            await api.post('/api-keys/agent-bindings', { agentType, keyId: keyId || null });
            await reloadKeys();
        } catch { /* ignore */ }
    };

    return {
        settings, theme, setTheme, membership, bgImage: bgImage || '', setBgImage, bgOpacity: bgOpacity ?? 1, setBgOpacity,
        bgBlur: bgBlur ?? 0, setBgBlur, form, setForm, testResult, testing, saving, saveMsg, apiKeys: apiKeys || [],
        agentBindings: agentBindings || [], newKey, setNewKey, showAddKey, setShowAddKey, currentProvider,
        newKeyProvider, saveSettings, testConnection, addApiKey, deleteApiKey, bindAgent,
    };
}
