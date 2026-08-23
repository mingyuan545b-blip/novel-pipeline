import { PROVIDER_LIST, AGENT_TYPES, getProvider } from './settingsConstants';

export default function SettingsForm({
    settings, form, setForm, testResult, testing, saving, saveMsg, apiKeys,
    agentBindings, newKey, setNewKey, showAddKey, setShowAddKey, currentProvider,
    newKeyProvider, saveSettings, testConnection, addApiKey, deleteApiKey, bindAgent,
}) {
    return (
        <>
            <div className="cyber-section-title">默认 API 配置</div>
            <div className="cyber-card mb-24">
                <div className="grid-2">
                    <div className="form-group"><label className="form-label">API 提供商</label>
                        <select className="cyber-select w-full border-box" value={form.provider} onChange={e => { const p = getProvider(e.target.value); setForm({ ...form, provider: e.target.value, model: p.defaultModel, baseURL: '', groupId: '' }); }}>
                            {PROVIDER_LIST.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                        </select></div>
                    <div className="form-group"><label className="form-label">API Key</label>
                        <input className="cyber-input w-full border-box" type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} placeholder={settings.hasKey ? '***已配置*** (留空保持不变)' : '输入API Key...'} /></div>
                    <div className="form-group"><label className="form-label">模型</label>
                        {currentProvider.models.length > 0 ? (
                            <select className="cyber-select w-full border-box" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>{currentProvider.models.map(m => <option key={m} value={m}>{m}</option>)}</select>
                        ) : (
                            <input className="cyber-input w-full border-box" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="输入模型名称..." />
                        )}</div>
                    {currentProvider.needsGroupId && <div className="form-group"><label className="form-label">Group ID</label><input className="cyber-input w-full border-box" value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })} placeholder="输入Group ID..." /></div>}
                    {form.provider === 'custom' && <div className="form-group"><label className="form-label">Base URL</label><input className="cyber-input w-full border-box" value={form.baseURL} onChange={e => setForm({ ...form, baseURL: e.target.value })} placeholder="https://api.example.com/v1" /></div>}
                </div>
                <div className="flex gap-8 mt-16">
                    <button className="cyber-btn cyber-btn-primary" onClick={saveSettings} disabled={saving}>{saving ? '保存中...' : '保存设置'}</button>
                    <button className="cyber-btn" onClick={testConnection} disabled={testing}>{testing ? '测试中...' : '测试连接'}</button>
                </div>
                {saveMsg && <div className="mt-12 rounded" style={{ padding: '8px 12px', fontSize: 13, background: saveMsg.type === 'success' ? 'rgba(0,255,136,0.1)' : 'rgba(255,0,68,0.1)', color: saveMsg.type === 'success' ? '#00ff88' : '#ff0044', border: '1px solid ' + (saveMsg.type === 'success' ? 'rgba(0,255,136,0.3)' : 'rgba(255,0,68,0.3)') }}>{saveMsg.text}</div>}
                {testResult && (
                    <div className="mt-12 rounded p-16" style={{ background: testResult.success ? 'rgba(0,255,136,0.05)' : 'rgba(255,0,68,0.05)', border: '1px solid ' + (testResult.success ? 'rgba(0,255,136,0.3)' : 'rgba(255,0,68,0.3)') }}>
                        <div className="flex items-center gap-8 mb-8">
                            <span className={`cyber-status-dot ${testResult.success ? 'cyber-status-dot-online' : 'cyber-status-dot-offline'}`}></span>
                            <span className="font-semibold" style={{ color: testResult.success ? '#00ff88' : '#ff0044' }}>{testResult.success ? '连接成功' : '连接失败'}</span>
                        </div>
                        {testResult.provider && <div className="text-sm" style={{ color: '#8888aa' }}>提供商: {testResult.provider}</div>}
                        {testResult.model && <div className="text-sm" style={{ color: '#8888aa' }}>模型: {testResult.model}</div>}
                        {testResult.message && <div className="text-base" style={{ color: '#8888aa' }}>{testResult.message}</div>}
                        {testResult.response && <div className="text-sm mt-4" style={{ color: '#555577' }}>响应: {testResult.response}</div>}
                    </div>
                )}
            </div>

            <div className="cyber-section-title">API Key 管理（多Key多提供商）</div>
            <div className="cyber-card mb-24">
                <p className="text-base text-muted mb-12">支持配置多个API Key，每个Agent可绑定不同的Key。</p>
                <div className="flex-between mb-12">
                    <span className="font-semibold text-secondary">已配置的 Key ({apiKeys.length})</span>
                    <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={() => { setShowAddKey(!showAddKey); setNewKey({ name: '', apiKey: '', groupId: '', model: 'qwen3.6-plus', provider: 'aliyunCoding', baseURL: '' }); }}>{showAddKey ? '取消' : '+ 添加Key'}</button>
                </div>
                {showAddKey && (
                    <div className="rounded mb-12 p-16" style={{ background: 'var(--bg-input)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <div className="form-group" style={{ margin: 0 }}><label className="form-label">提供商</label>
                                <select className="cyber-input w-full border-box" value={newKey.provider} onChange={e => { const p = getProvider(e.target.value); setNewKey(prev => ({ ...prev, provider: e.target.value, model: p.defaultModel, groupId: '', baseURL: '' })); }}>{PROVIDER_LIST.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select></div>
                            <div className="form-group" style={{ margin: 0 }}><label className="form-label">名称</label><input className="cyber-input w-full border-box" value={newKey.name} onChange={e => setNewKey(p => ({ ...p, name: e.target.value }))} placeholder="例：主力Key" /></div>
                            <div className="form-group" style={{ margin: 0 }}><label className="form-label">API Key</label><input className="cyber-input w-full border-box" type="password" value={newKey.apiKey} onChange={e => setNewKey(p => ({ ...p, apiKey: e.target.value }))} placeholder="sk-..." /></div>
                            <div className="form-group" style={{ margin: 0 }}><label className="form-label">模型</label>
                                {newKeyProvider.models.length > 0 ? (<select className="cyber-input w-full border-box" value={newKey.model} onChange={e => setNewKey(p => ({ ...p, model: e.target.value }))}>{newKeyProvider.models.map(m => <option key={m} value={m}>{m}</option>)}</select>) : (<input className="cyber-input w-full border-box" value={newKey.model} onChange={e => setNewKey(p => ({ ...p, model: e.target.value }))} placeholder="输入模型名称" />)}</div>
                            {newKeyProvider.needsGroupId && <div className="form-group" style={{ margin: 0 }}><label className="form-label">Group ID</label><input className="cyber-input w-full border-box" value={newKey.groupId} onChange={e => setNewKey(p => ({ ...p, groupId: e.target.value }))} placeholder="可选" /></div>}
                            {newKey.provider === 'custom' && <div className="form-group" style={{ margin: 0 }}><label className="form-label">Base URL</label><input className="cyber-input w-full border-box" value={newKey.baseURL} onChange={e => setNewKey(p => ({ ...p, baseURL: e.target.value }))} placeholder="https://api.example.com/v1" /></div>}
                        </div>
                        <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={addApiKey}>添加</button>
                    </div>
                )}
                {apiKeys.length === 0 ? (
                    <div className="text-sm text-muted text-center p-16">暂无额外Key，点击"+ 添加Key"配置其他提供商</div>
                ) : apiKeys.map(key => {
                    const kp = getProvider(key.provider);
                    return (
                        <div key={key.id} className="flex-between items-center rounded mb-6" style={{ padding: '10px 14px', background: 'var(--bg-input)' }}>
                            <div className="flex items-center gap-10 flex-1 min-w-0">
                                <span className="whitespace-nowrap rounded" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#fff', background: kp.color }}>{kp.name}</span>
                                <span className="font-semibold text-secondary text-md whitespace-nowrap">{key.name}</span>
                                <span className="text-sm font-mono text-muted truncate">{key.apiKey}</span>
                                <span className="text-sm text-blue">{key.model}</span>
                            </div>
                            <button className="cyber-btn cyber-btn-sm text-sm shrink-0" style={{ color: 'var(--neon-red)' }} onClick={() => deleteApiKey(key.id)}>删除</button>
                        </div>
                    );
                })}
                <div className="mt-16">
                    <div className="font-semibold text-secondary mb-8">Agent → Key 绑定</div>
                    {AGENT_TYPES.map(agent => {
                        const binding = agentBindings.find(b => b.agentType === agent.key);
                        return (
                            <div key={agent.key} className="flex items-center gap-8 mb-6">
                                <span className="text-sm text-secondary" style={{ width: 80 }}>{agent.label}</span>
                                <select className="cyber-input flex-1 text-sm" value={binding?.keyId || ''} onChange={e => bindAgent(agent.key, e.target.value)}>
                                    <option value="">使用默认Key</option>
                                    {apiKeys.map(k => { const kp = getProvider(k.provider); return <option key={k.id} value={k.id}>[{kp.name}] {k.name} ({k.model})</option>; })}
                                </select>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
