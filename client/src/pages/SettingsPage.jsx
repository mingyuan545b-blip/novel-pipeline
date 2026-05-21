import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { settingsApi } from '../services/api';
import axios from 'axios';

const API_BASE = '/api';

const PROVIDER_LIST = [
    { key: 'minimax', name: 'MiniMax', color: '#00bfff', models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M1', 'MiniMax-Text-01'], needsGroupId: true, defaultModel: 'MiniMax-M2.7' },
    { key: 'openai', name: 'OpenAI', color: '#10a37f', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'], needsGroupId: false, defaultModel: 'gpt-4o' },
    { key: 'deepseek', name: 'DeepSeek', color: '#4d6bfe', models: ['deepseek-chat', 'deepseek-reasoner'], needsGroupId: false, defaultModel: 'deepseek-chat' },
    { key: 'qwen', name: '通义千问', color: '#6f42c1', models: ['qwen-max', 'qwen-max-latest', 'qwen-plus', 'qwen-plus-latest', 'qwen-turbo', 'qwen-turbo-latest', 'qwen-long'], needsGroupId: false, defaultModel: 'qwen-max' },
    { key: 'zhipu', name: '智谱AI', color: '#3b5998', models: ['glm-4-plus', 'glm-4-0520', 'glm-4-air', 'glm-4-airx', 'glm-4-long', 'glm-4-flash', 'glm-4-flashx'], needsGroupId: false, defaultModel: 'glm-4-plus' },
    { key: 'moonshot', name: '月之暗面', color: '#8b5cf6', models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'], needsGroupId: false, defaultModel: 'moonshot-v1-128k' },
    { key: 'siliconflow', name: '硅基流动', color: '#f97316', models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-32B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen/Qwen3-235B-A22B', 'Qwen/Qwen3-32B', 'Qwen/Qwen3.5-27B'], needsGroupId: false, defaultModel: 'deepseek-ai/DeepSeek-V3' },
    { key: 'aliyunCoding', name: '阿里云百炼(Coding Plan)', color: '#ff6a00', models: ['qwen3.6-plus'], needsGroupId: false, defaultModel: 'qwen3.6-plus' },
    { key: 'custom', name: '自定义', color: '#888', models: [], needsGroupId: false, defaultModel: '' }
];

function getProvider(key) {
    return PROVIDER_LIST.find(p => p.key === key) || PROVIDER_LIST[0];
}

export default function SettingsPage() {
    const settings = useAppStore(s => s.settings) || {};
    const setSettings = useAppStore(s => s.setSettings);
    const theme = useAppStore(s => s.theme);
    const setTheme = useAppStore(s => s.setTheme);
    const membership = useAppStore(s => s.membership);
    const setMembership = useAppStore(s => s.setMembership);
    const bgImage = useAppStore(s => s.bgImage);
    const setBgImage = useAppStore(s => s.setBgImage);
    const bgOpacity = useAppStore(s => s.bgOpacity);
    const setBgOpacity = useAppStore(s => s.setBgOpacity);
    const bgBlur = useAppStore(s => s.bgBlur);
    const setBgBlur = useAppStore(s => s.setBgBlur);

    const [form, setForm] = useState({
        apiKey: '',
        groupId: '',
        model: 'MiniMax-M2.7',
        provider: 'minimax',
        baseURL: ''
    });
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);
    const [apiKeys, setApiKeys] = useState([]);
    const [agentBindings, setAgentBindings] = useState([]);
    const [newKey, setNewKey] = useState({ name: '', apiKey: '', groupId: '', model: 'MiniMax-M2.7', provider: 'minimax', baseURL: '' });
    const [showAddKey, setShowAddKey] = useState(false);

    const AGENT_TYPES = [
        { key: 'writer', label: '执笔人' },
        { key: 'first-review', label: '初审' },
        { key: 'second-review', label: '复审' },
        { key: 'final-editor', label: '定稿人' },
        { key: 'material-manager', label: '素材管理' },
        { key: 'consolidator', label: '整合编辑' }
    ];

    const loadApiKeys = useCallback(async () => {
        try {
            const [keysRes, bindingsRes] = await Promise.all([
                axios.get(`${API_BASE}/api-keys`),
                axios.get(`${API_BASE}/api-keys/agent-bindings`)
            ]);
            setApiKeys(keysRes.data || []);
            setAgentBindings(bindingsRes.data || []);
        } catch (e) {
            console.error('Load API keys error:', e);
        }
    }, []);

    useEffect(() => {
        loadApiKeys();
    }, [loadApiKeys]);

    useEffect(() => {
        try {
            setForm(prev => ({
                ...prev,
                groupId: settings.groupId || '',
                model: settings.model || 'MiniMax-M2.7',
                provider: settings.provider || 'minimax',
                baseURL: settings.baseURL || ''
            }));
        } catch (e) {
            console.error('SettingsPage init error:', e);
        }
    }, [settings]);

    const saveSettings = useCallback(async () => {
        setSaving(true);
        setSaveMsg(null);
        try {
            const data = { ...form };
            if (!data.apiKey && settings.hasKey) delete data.apiKey;
            await settingsApi.save(data);
            const res = await settingsApi.get();
            if (res && res.data) setSettings(res.data);
            setSaveMsg({ type: 'success', text: '设置已保存' });
        } catch (e) {
            setSaveMsg({ type: 'error', text: '保存失败: ' + (e.message || '未知错误') });
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMsg(null), 5000);
        }
    }, [form, settings.hasKey, setSettings]);

    const currentProvider = getProvider(form.provider);
    const newKeyProvider = getProvider(newKey.provider);

    const testConnection = useCallback(async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await axios.post(`${API_BASE}/settings/test`, {
                apiConfig: {
                    apiKey: form.apiKey || undefined,
                    groupId: form.groupId || undefined,
                    model: form.model,
                    provider: form.provider,
                    baseURL: form.baseURL || undefined,
                    agentLabel: currentProvider.name
                }
            });
            setTestResult(res.data || { success: false, message: '无响应数据' });
        } catch (e) {
            setTestResult({ success: false, message: e.message || '网络请求失败' });
        } finally {
            setTesting(false);
        }
    }, [form, currentProvider]);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">系统设置</h1>
                <p className="page-subtitle">配置API Key、模型参数和系统选项</p>
            </div>

            <div className="cyber-section-title">会员管理</div>
            <div className="cyber-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <span style={{ fontWeight: 700, fontSize: 16, color: membership.level === 'pro' ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                            {membership.level === 'pro' ? '◈ 专业版' : '○ 免费版'}
                        </span>
                        {membership.trial && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--neon-orange)' }}>试用中</span>}
                    </div>
                </div>
                {membership.level === 'free' && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>免费版限制：</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                            <div>• 最多 2 个项目 / 每项目 10 章 / 30 个素材</div>
                            <div>• 仅 1 个 API Key</div>
                            <div style={{ color: 'var(--neon-red)' }}>• ✗ 自动化流水线 / 无限流水线 / 小说融合 / 发布中心 / 漫剧渲染</div>
                        </div>
                    </div>
                )}
                {membership.level === 'pro' && (
                    <div style={{ fontSize: 12, color: 'var(--neon-green)', lineHeight: 1.8 }}>
                        <div>✓ 无限项目 / 章节 / 自动化流水线 / 多 API Key</div>
                        {membership.expiresAt && <div style={{ color: 'var(--neon-orange)', marginTop: 4 }}>到期: {new Date(membership.expiresAt).toLocaleDateString('zh-CN')}</div>}
                    </div>
                )}
            </div>

            <div className="cyber-section-title">皮肤风格</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                {[
                    { key: 'glass', label: '磨砂玻璃', desc: 'Glassmorphism | 浅色磨砂 | 半透明白底', color: '#4a90d9', bg: '#e8eaf6' },
                    { key: 'liquid', label: '液态玻璃', desc: 'Liquid Glass | 彩色渐变 | 液态光感', color: '#64b4ff', bg: '#0f0c29' },
                    { key: 'ceramic', label: '渐变陶瓷', desc: 'Ceramic Clay | 暗色黏土 | 渐变光泽', color: '#9b72cf', bg: '#1a1a24' },
                    { key: 'ripple', label: '动态水波纹', desc: 'Water Ripple | 浅灰底 | 水蓝渐变 | 扫光', color: '#00bfff', bg: '#d4dade' },
                    { key: 'aurora', label: '炫彩动态', desc: 'Aurora | 极光流动 | 彩色渐变 | 动态背景', color: '#00e5ff', bg: '#0a0a1a' },
                    { key: 'mario', label: '马里奥', desc: 'Mario | 经典红黄 | 砖块按钮 | 蘑菇动效', color: '#f1c40f', bg: '#1a1a2e' }
                ].map(skin => (
                    <div key={skin.key} className="cyber-card" style={{
                        width: 180, cursor: 'pointer',
                        borderColor: theme === skin.key ? skin.color : undefined,
                        boxShadow: theme === skin.key ? `0 0 20px ${skin.color}40` : undefined,
                        transition: 'all 0.3s ease'
                    }} onClick={() => setTheme(skin.key)}>
                        <div style={{
                            height: 50, borderRadius: 8, background: skin.bg, marginBottom: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `2px solid ${skin.color}40`, position: 'relative', overflow: 'hidden'
                        }}>
                            {skin.key === 'ripple' && (
                                <div style={{
                                    width: 40, height: 24, borderRadius: 12,
                                    background: 'linear-gradient(to bottom, #d4dade, #c5c8cb)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.12), inset 0 2px 3px rgba(255,255,255,0.6)',
                                    border: '1px solid rgba(255,255,255,0.4)', position: 'relative', overflow: 'hidden'
                                }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', background: 'linear-gradient(to bottom, #87ceeb, #00bfff)', borderRadius: 12, opacity: 0.8 }}></div>
                                </div>
                            )}
                        </div>
                        <div style={{ fontWeight: 700, color: skin.color, fontSize: 13, marginBottom: 2 }}>{skin.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{skin.desc}</div>
                        {theme === skin.key && <div style={{ marginTop: 4, fontSize: 10, color: skin.color }}>✓ 当前</div>}
                    </div>
                ))}
            </div>

            <div className="cyber-section-title">背景图片</div>
            <div className="cyber-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
                        <label className="form-label">图片URL</label>
                        <input className="cyber-input" value={bgImage} onChange={e => setBgImage(e.target.value)} placeholder="输入图片URL或上传本地图片..." style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <label className="cyber-btn" style={{ cursor: 'pointer', marginBottom: 0, whiteSpace: 'nowrap', height: 38, minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', boxSizing: 'border-box' }}>
                        上传图片
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { setBgImage(ev.target.result); }; reader.readAsDataURL(file); } }} />
                    </label>
                    {bgImage && (
                        <button className="cyber-btn" style={{ color: 'var(--neon-red)', marginBottom: 0, whiteSpace: 'nowrap', height: 38, minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', boxSizing: 'border-box' }} onClick={() => setBgImage('')}>清除背景</button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 150 }}>
                        <label className="form-label">透明度: {Math.round(bgOpacity * 100)}%</label>
                        <input type="range" min="0" max="1" step="0.05" value={bgOpacity} onChange={e => setBgOpacity(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--neon-blue)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                        <label className="form-label">模糊: {bgBlur}px</label>
                        <input type="range" min="0" max="20" step="1" value={bgBlur} onChange={e => setBgBlur(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--neon-purple)' }} />
                    </div>
                </div>
                {bgImage && (
                    <div style={{ marginTop: 12, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img src={bgImage} alt="bg preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: bgOpacity, filter: `blur(${bgBlur}px)` }} />
                    </div>
                )}
            </div>

            <div className="cyber-section-title">默认 API 配置</div>
            <div className="cyber-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">API 提供商</label>
                        <select className="cyber-select" value={form.provider} onChange={e => {
                            const p = getProvider(e.target.value);
                            setForm({ ...form, provider: e.target.value, model: p.defaultModel, baseURL: '', groupId: '' });
                        }} style={{ width: '100%', boxSizing: 'border-box' }}>
                            {PROVIDER_LIST.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">API Key</label>
                        <input className="cyber-input" type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} placeholder={settings.hasKey ? '***已配置*** (留空保持不变)' : '输入API Key...'} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">模型</label>
                        {currentProvider.models.length > 0 ? (
                            <select className="cyber-select" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }}>
                                {currentProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : (
                            <input className="cyber-input" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="输入模型名称..." style={{ width: '100%', boxSizing: 'border-box' }} />
                        )}
                    </div>
                    {currentProvider.needsGroupId && (
                        <div className="form-group">
                            <label className="form-label">Group ID</label>
                            <input className="cyber-input" value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })} placeholder="输入Group ID..." style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    )}
                    {form.provider === 'custom' && (
                        <div className="form-group">
                            <label className="form-label">Base URL</label>
                            <input className="cyber-input" value={form.baseURL} onChange={e => setForm({ ...form, baseURL: e.target.value })} placeholder="https://api.example.com/v1" style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button className="cyber-btn cyber-btn-primary" onClick={saveSettings} disabled={saving}>{saving ? '保存中...' : '保存设置'}</button>
                    <button className="cyber-btn" onClick={testConnection} disabled={testing}>{testing ? '测试中...' : '测试连接'}</button>
                </div>
                {saveMsg && (
                    <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13, background: saveMsg.type === 'success' ? 'rgba(0,255,136,0.1)' : 'rgba(255,0,68,0.1)', color: saveMsg.type === 'success' ? '#00ff88' : '#ff0044', border: '1px solid ' + (saveMsg.type === 'success' ? 'rgba(0,255,136,0.3)' : 'rgba(255,0,68,0.3)') }}>{saveMsg.text}</div>
                )}
                {testResult && (
                    <div style={{ marginTop: 12, padding: 16, borderRadius: 6, background: testResult.success ? 'rgba(0,255,136,0.05)' : 'rgba(255,0,68,0.05)', border: '1px solid ' + (testResult.success ? 'rgba(0,255,136,0.3)' : 'rgba(255,0,68,0.3)') }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span className={`cyber-status-dot ${testResult.success ? 'cyber-status-dot-online' : 'cyber-status-dot-offline'}`}></span>
                            <span style={{ fontWeight: 600, color: testResult.success ? '#00ff88' : '#ff0044' }}>{testResult.success ? '连接成功' : '连接失败'}</span>
                        </div>
                        {testResult.provider && <div style={{ fontSize: 12, color: '#8888aa' }}>提供商: {testResult.provider}</div>}
                        {testResult.model && <div style={{ fontSize: 12, color: '#8888aa' }}>模型: {testResult.model}</div>}
                        {testResult.message && <div style={{ fontSize: 13, color: '#8888aa' }}>{testResult.message}</div>}
                        {testResult.response && <div style={{ fontSize: 12, color: '#555577', marginTop: 4 }}>响应: {testResult.response}</div>}
                    </div>
                )}
            </div>

            <div className="cyber-section-title">API Key 管理（多Key多提供商）</div>
            <div className="cyber-card" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                    支持配置多个API Key（MiniMax / OpenAI / DeepSeek / 通义千问 / 智谱 / 月之暗面 / 硅基流动 / 自定义），每个Agent可绑定不同的Key。
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>已配置的 Key ({apiKeys.length})</span>
                    <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={() => { setShowAddKey(!showAddKey); setNewKey({ name: '', apiKey: '', groupId: '', model: 'MiniMax-M2.7', provider: 'minimax', baseURL: '' }); }}>
                        {showAddKey ? '取消' : '+ 添加Key'}
                    </button>
                </div>

                {showAddKey && (
                    <div style={{ padding: 16, background: 'var(--bg-input)', borderRadius: 8, marginBottom: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">提供商</label>
                                <select className="cyber-input" value={newKey.provider} onChange={e => {
                                    const p = getProvider(e.target.value);
                                    setNewKey(prev => ({ ...prev, provider: e.target.value, model: p.defaultModel, groupId: '', baseURL: '' }));
                                }} style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}>
                                    {PROVIDER_LIST.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">名称</label>
                                <input className="cyber-input" value={newKey.name} onChange={e => setNewKey(p => ({ ...p, name: e.target.value }))} placeholder="例：主力Key" style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">API Key</label>
                                <input className="cyber-input" type="password" value={newKey.apiKey} onChange={e => setNewKey(p => ({ ...p, apiKey: e.target.value }))} placeholder="sk-..." style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">模型</label>
                                {newKeyProvider.models.length > 0 ? (
                                    <select className="cyber-input" value={newKey.model} onChange={e => setNewKey(p => ({ ...p, model: e.target.value }))} style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}>
                                        {newKeyProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                ) : (
                                    <input className="cyber-input" value={newKey.model} onChange={e => setNewKey(p => ({ ...p, model: e.target.value }))} placeholder="输入模型名称" style={{ width: '100%', boxSizing: 'border-box' }} />
                                )}
                            </div>
                            {newKeyProvider.needsGroupId && (
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Group ID</label>
                                    <input className="cyber-input" value={newKey.groupId} onChange={e => setNewKey(p => ({ ...p, groupId: e.target.value }))} placeholder="可选" style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                            )}
                            {newKey.provider === 'custom' && (
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Base URL</label>
                                    <input className="cyber-input" value={newKey.baseURL} onChange={e => setNewKey(p => ({ ...p, baseURL: e.target.value }))} placeholder="https://api.example.com/v1" style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                            )}
                        </div>
                        <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={async () => {
                            if (!newKey.apiKey) { alert('请输入API Key'); return; }
                            try {
                                await axios.post(`${API_BASE}/api-keys`, newKey);
                                setNewKey({ name: '', apiKey: '', groupId: '', model: 'MiniMax-M2.7', provider: 'minimax', baseURL: '' });
                                setShowAddKey(false);
                                loadApiKeys();
                            } catch (e) { alert('添加失败: ' + (e.response?.data?.error || e.message)); }
                        }}>添加</button>
                    </div>
                )}

                {apiKeys.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                        暂无额外Key，点击"+ 添加Key"配置其他提供商
                    </div>
                ) : (
                    apiKeys.map(key => {
                        const kp = getProvider(key.provider);
                        return (
                            <div key={key.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#fff', background: kp.color, whiteSpace: 'nowrap' }}>{kp.name}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{key.name}</span>
                                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key.apiKey}</span>
                                    <span style={{ fontSize: 11, color: 'var(--neon-blue)' }}>{key.model}</span>
                                </div>
                                <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-red)', fontSize: 10, flexShrink: 0 }} onClick={async () => {
                                    await axios.delete(`${API_BASE}/api-keys/${key.id}`);
                                    loadApiKeys();
                                }}>删除</button>
                            </div>
                        );
                    })
                )}

                <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Agent → Key 绑定</div>
                    {AGENT_TYPES.map(agent => {
                        const binding = agentBindings.find(b => b.agentType === agent.key);
                        return (
                            <div key={agent.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{ width: 80, fontSize: 12, color: 'var(--text-secondary)' }}>{agent.label}</span>
                                <select className="cyber-input" value={binding?.keyId || ''} onChange={async e => {
                                    try {
                                        await axios.post(`${API_BASE}/api-keys/agent-bindings`, { agentType: agent.key, keyId: e.target.value || null });
                                        loadApiKeys();
                                    } catch (err) { console.error(err); }
                                }} style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}>
                                    <option value="">使用默认Key</option>
                                    {apiKeys.map(k => {
                                        const kp = getProvider(k.provider);
                                        return <option key={k.id} value={k.id}>[{kp.name}] {k.name} ({k.model})</option>;
                                    })}
                                </select>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                    <div className="cyber-section-title">系统状态</div>
                    <div className="cyber-card">
                        <div className="table-container">
                            <table className="cyber-table">
                                <tbody>
                                    <tr><td style={{ fontWeight: 600 }}>API状态</td><td><span className={`cyber-status-dot ${settings.hasKey ? 'cyber-status-dot-online' : 'cyber-status-dot-offline'}`}></span>{settings.hasKey ? '已配置' : '未配置'}</td></tr>
                                    <tr><td style={{ fontWeight: 600 }}>提供商</td><td>{getProvider(settings.provider).name}</td></tr>
                                    <tr><td style={{ fontWeight: 600 }}>模型</td><td>{settings.model || 'MiniMax-M2.7'}</td></tr>
                                    <tr><td style={{ fontWeight: 600 }}>后端地址</td><td style={{ fontFamily: 'monospace', fontSize: 12 }}>http://localhost:3001</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div>
                    <div className="cyber-section-title">AiPy Pro 集成</div>
                    <div className="cyber-card">
                        <div style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.6, marginBottom: 12 }}>
                            将MCP Agent扩展安装到AiPy Pro扩展目录，即可通过AiPy Pro调度流水线。
                        </div>
                        <div className="table-container">
                            <table className="cyber-table">
                                <tbody>
                                    <tr><td style={{ fontWeight: 600, width: 80 }}>Windows</td><td style={{ fontFamily: 'monospace', fontSize: 11 }}>C:\Users\用户名\AppData\Roaming\aipy-pro\extensions</td></tr>
                                    <tr><td style={{ fontWeight: 600 }}>macOS</td><td style={{ fontFamily: 'monospace', fontSize: 11 }}>~/Library/Application Support/aipy-pro/extensions</td></tr>
                                    <tr><td style={{ fontWeight: 600 }}>Linux</td><td style={{ fontFamily: 'monospace', fontSize: 11 }}>~/.config/aipy-pro/extensions</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
