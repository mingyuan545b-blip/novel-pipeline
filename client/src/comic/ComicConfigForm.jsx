export default function ComicConfigForm({ state }) {
    const { activeTab, localConfig, cloudConfig, updateLocal, updateCloud, testing, saving,
        handleTestConnection, handleSave, handleStartComfyUI, handleStopComfyUI } = state;

    if (activeTab === 'cloud') return <CloudConfigForm cloudConfig={cloudConfig} updateCloud={updateCloud} testing={testing} saving={saving} handleTestConnection={handleTestConnection} handleSave={handleSave} />;
    return <LocalConfigForm localConfig={localConfig} updateLocal={updateLocal} testing={testing} saving={saving} handleTestConnection={handleTestConnection} handleSave={handleSave} handleStartComfyUI={handleStartComfyUI} handleStopComfyUI={handleStopComfyUI} />;
}

function LocalConfigForm({ localConfig, updateLocal, testing, saving, handleTestConnection, handleSave, handleStartComfyUI, handleStopComfyUI }) {
    return (
        <div className="cyber-card">
            <h3 className="text-green mb-16">本地 ComfyUI 配置</h3>
            <p className="text-base text-muted mb-20">连接本地运行的 ComfyUI 实例。确保 ComfyUI 已启动并监听指定端口。</p>
            <div className="grid-2-gap-16 mb-16">
                <div className="form-group"><label className="form-label">API 地址</label><input className="cyber-input input-sm" value={localConfig.apiUrl} onChange={e => updateLocal('apiUrl', e.target.value)} placeholder="http://127.0.0.1:8188" /></div>
                <div className="form-group"><label className="form-label">WebSocket 地址</label><input className="cyber-input input-sm" value={localConfig.wsUrl} onChange={e => updateLocal('wsUrl', e.target.value)} placeholder="ws://127.0.0.1:8188" /></div>
            </div>
            <div className="grid-2-gap-16 mb-16">
                <div className="form-group"><label className="form-label">ComfyUI 安装目录</label><input className="cyber-input input-sm" value={localConfig.installDir} onChange={e => updateLocal('installDir', e.target.value)} placeholder="C:\Romc7.9" /></div>
                <div className="form-group"><label className="form-label">启动命令</label><input className="cyber-input input-sm" value={localConfig.startCommand} onChange={e => updateLocal('startCommand', e.target.value)} placeholder=".venv\Scripts\activate && python ComfyUI\main.py" /></div>
            </div>
            <div className="grid-2-gap-16 mb-16">
                <div className="form-group"><label className="form-label">输出目录（留空使用ComfyUI默认）</label><input className="cyber-input input-sm" value={localConfig.outputDir} onChange={e => updateLocal('outputDir', e.target.value)} placeholder="D:\ComfyUI\output" /></div>
                <div className="form-group"><label className="form-label">GPU 设备</label><input className="cyber-input input-sm" value={localConfig.gpuDevice} onChange={e => updateLocal('gpuDevice', e.target.value)} placeholder="0" /></div>
            </div>
            <div className="grid-2-gap-16 mb-16">
                <div className="form-group"><label className="form-label">默认大模型 (Checkpoint)</label><input className="cyber-input input-sm" value={localConfig.checkpoint} onChange={e => updateLocal('checkpoint', e.target.value)} placeholder="留空使用ComfyUI当前选择" /></div>
                <div className="form-group"><label className="form-label">默认 VAE</label><input className="cyber-input input-sm" value={localConfig.vae} onChange={e => updateLocal('vae', e.target.value)} placeholder="留空使用内置VAE" /></div>
            </div>
            <div className="grid-2-gap-16 mb-16">
                <div className="form-group"><label className="form-label">请求超时（秒）</label><input className="cyber-input input-sm" type="number" value={localConfig.timeout} onChange={e => updateLocal('timeout', parseInt(e.target.value) || 300)} min={30} max={3600} /></div>
                <div className="form-group">
                    <label className="flex gap-6 text-secondary text-base" style={{ marginTop: 24 }}>
                        <input type="checkbox" checked={localConfig.autoStart} onChange={e => updateLocal('autoStart', e.target.checked)} />
                        自动启动 ComfyUI（需要配置启动命令）
                    </label>
                </div>
            </div>
            <div className="flex gap-8 mt-16">
                <button className="cyber-btn cyber-btn-primary" onClick={handleTestConnection} disabled={testing}>{testing ? <><span className="cyber-loading"></span> 测试中</> : '◈ 测试连接'}</button>
                <button className="cyber-btn" onClick={handleStartComfyUI}>▶ 启动 ComfyUI</button>
                <button className="cyber-btn text-red" onClick={handleStopComfyUI}>■ 停止 ComfyUI</button>
                <button className="cyber-btn" onClick={handleSave} disabled={saving}>{saving ? <><span className="cyber-loading"></span> 保存中</> : '保存配置'}</button>
            </div>
        </div>
    );
}

function CloudConfigForm({ cloudConfig, updateCloud, testing, saving, handleTestConnection, handleSave }) {
    return (
        <div className="cyber-card">
            <h3 className="text-blue mb-16">云端 ComfyUI 配置</h3>
            <p className="text-base text-muted mb-20">连接云端 ComfyUI 服务，无需本地GPU，按需弹性扩缩容。</p>
            <div className="form-group mb-16">
                <label className="form-label">服务提供商</label>
                <select className="cyber-input input-sm" value={cloudConfig.provider} onChange={e => updateCloud('provider', e.target.value)}>
                    <option value="comfyui-cloud">ComfyUI Cloud</option><option value="runpod">RunPod</option>
                    <option value="vastai">Vast.ai</option><option value="autoDL">AutoDL</option><option value="custom">自定义</option>
                </select>
            </div>
            <div className="grid-2-gap-16 mb-16">
                <div className="form-group"><label className="form-label">API 地址</label><input className="cyber-input input-sm" value={cloudConfig.apiUrl} onChange={e => updateCloud('apiUrl', e.target.value)} placeholder="https://api.comfyui.cloud" /></div>
                <div className="form-group"><label className="form-label">区域</label>
                    <select className="cyber-input input-sm" value={cloudConfig.region} onChange={e => updateCloud('region', e.target.value)}>
                        <option value="cn-east-1">华东1</option><option value="cn-north-1">华北1</option>
                        <option value="us-west-1">美西1</option><option value="ap-southeast-1">东南亚1</option>
                    </select>
                </div>
            </div>
            <div className="grid-2-gap-16 mb-16">
                <div className="form-group"><label className="form-label">API Key</label><input className="cyber-input input-sm" type="password" value={cloudConfig.apiKey} onChange={e => updateCloud('apiKey', e.target.value)} placeholder="输入API Key" /></div>
                <div className="form-group"><label className="form-label">API Secret</label><input className="cyber-input input-sm" type="password" value={cloudConfig.apiSecret} onChange={e => updateCloud('apiSecret', e.target.value)} placeholder="输入API Secret" /></div>
            </div>
            <div className="grid-2-gap-16 mb-16">
                <div className="form-group"><label className="form-label">实例类型</label>
                    <select className="cyber-input input-sm" value={cloudConfig.instanceType} onChange={e => updateCloud('instanceType', e.target.value)}>
                        <option value="gpu-a10">A10 (24GB)</option><option value="gpu-a100">A100 (80GB)</option>
                        <option value="gpu-4090">RTX 4090 (24GB)</option><option value="gpu-3090">RTX 3090 (24GB)</option>
                    </select>
                </div>
                <div className="form-group"><label className="form-label">空闲超时（秒）</label><input className="cyber-input input-sm" type="number" value={cloudConfig.idleTimeout} onChange={e => updateCloud('idleTimeout', parseInt(e.target.value) || 300)} min={60} max={3600} /></div>
            </div>
            <div className="grid-3-gap-16 mb-16">
                <label className="flex gap-6 text-secondary text-base" style={{ paddingTop: 24 }}>
                    <input type="checkbox" checked={cloudConfig.autoScale} onChange={e => updateCloud('autoScale', e.target.checked)} />自动扩缩容
                </label>
                <div className="form-group"><label className="form-label">最小实例</label><input className="cyber-input input-sm" type="number" value={cloudConfig.minInstances} onChange={e => updateCloud('minInstances', parseInt(e.target.value) || 0)} min={0} max={10} /></div>
                <div className="form-group"><label className="form-label">最大实例</label><input className="cyber-input input-sm" type="number" value={cloudConfig.maxInstances} onChange={e => updateCloud('maxInstances', parseInt(e.target.value) || 2)} min={1} max={20} /></div>
            </div>
            <div className="flex gap-8 mt-16">
                <button className="cyber-btn cyber-btn-primary" onClick={handleTestConnection} disabled={testing}>{testing ? <><span className="cyber-loading"></span> 测试中</> : '◈ 测试连接'}</button>
                <button className="cyber-btn" onClick={handleSave} disabled={saving}>{saving ? <><span className="cyber-loading"></span> 保存中</> : '保存配置'}</button>
            </div>
        </div>
    );
}
