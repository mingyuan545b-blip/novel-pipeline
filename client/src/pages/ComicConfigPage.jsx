import { useState, useEffect, useRef, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { comicApi } from '../services/api';

const CONFIG_TABS = [
    { key: 'local', label: '本地 ComfyUI', icon: '⬢', color: 'var(--neon-green)' },
    { key: 'cloud', label: '云端 ComfyUI', icon: '◈', color: 'var(--neon-blue)' }
];

export default function ComicConfigPage() {
    const { currentProject } = useAppStore();
    const [activeTab, setActiveTab] = useState('local');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const [vramInfo, setVramInfo] = useState(null);
    const [vramLoading, setVramLoading] = useState(false);
    const [vramFreeing, setVramFreeing] = useState(false);
    const [autoFreeConfig, setAutoFreeConfigState] = useState({ enabled: true, idleSeconds: 120, vramThreshold: 0.75 });
    const [isPolling, setIsPolling] = useState(false);
    const vramPollRef = useRef(null);

    const [localConfig, setLocalConfig] = useState({
        apiUrl: 'http://127.0.0.1:8188',
        wsUrl: 'ws://127.0.0.1:8188',
        installDir: 'C:\\Romc7.9',
        startCommand: '.venv\\Scripts\\activate && python ComfyUI\\main.py',
        outputDir: '',
        autoStart: false,
        gpuDevice: '0',
        vae: '',
        checkpoint: '',
        timeout: 300
    });

    const [cloudConfig, setCloudConfig] = useState({
        provider: 'comfyui-cloud',
        apiUrl: '',
        apiKey: '',
        apiSecret: '',
        region: 'cn-east-1',
        instanceType: 'gpu-a10',
        autoScale: true,
        minInstances: 0,
        maxInstances: 2,
        idleTimeout: 300
    });

    useEffect(() => {
        loadConfig();
        loadVramInfo(true);
        loadAutoFreeConfig();
        return () => { if (vramPollRef.current) clearInterval(vramPollRef.current); };
    }, []);

    const loadVramInfo = async (showLoading = false) => {
        if (showLoading) setVramLoading(true);
        try {
            const res = await comicApi.comfyuiSystemInfo();
            const data = res.data || res;
            const dev = data?.devices?.[0];
            if (dev) {
                setVramInfo({
                    gpuName: dev.name,
                    vramTotal: (dev.vram_total / 1073741824).toFixed(1),
                    vramFree: (dev.vram_free / 1073741824).toFixed(1),
                    vramUsed: ((dev.vram_total - dev.vram_free) / 1073741824).toFixed(1),
                    usagePercent: (((dev.vram_total - dev.vram_free) / dev.vram_total) * 100).toFixed(1),
                    ramTotal: data.system ? (data.system.ram_total / 1073741824).toFixed(1) : null,
                    ramFree: data.system ? (data.system.ram_free / 1073741824).toFixed(1) : null
                });
            } else {
                setVramInfo(null);
            }
        } catch (e) {
            setVramInfo(null);
        } finally {
            setVramLoading(false);
        }
    };

    const handleFreeMemory = async () => {
        setVramFreeing(true);
        try {
            const res = await comicApi.comfyuiFreeMemory({ unloadModels: true, freeMemory: true });
            const data = res.data || res;
            if (data.success) {
                setTestResult({ type: 'success', message: `显存释放指令已发送！ROCm VRAM回收需要10-15秒，请观察进度条变化...` });
                await new Promise(r => setTimeout(r, 2000));
                await loadVramInfo();
                setTimeout(() => loadVramInfo(), 5000);
                setTimeout(() => loadVramInfo(), 10000);
                setTimeout(() => loadVramInfo(), 15000);
            } else {
                setTestResult({ type: 'error', message: '释放失败: ' + (data.error || '未知错误') });
            }
        } catch (e) {
            setTestResult({ type: 'error', message: '释放失败: ' + (e.response?.data?.error || e.message) });
        } finally {
            setVramFreeing(false);
        }
    };

    const loadAutoFreeConfig = async () => {
        try {
            const res = await comicApi.comfyuiGetAutoFreeConfig();
            setAutoFreeConfigState(res.data || res);
        } catch (e) { }
    };

    const handleAutoFreeConfigChange = async (key, value) => {
        const newConfig = { ...autoFreeConfig, [key]: value };
        setAutoFreeConfigState(newConfig);
        try {
            await comicApi.comfyuiSetAutoFreeConfig(newConfig);
        } catch (e) { }
    };

    const startVramPolling = () => {
        if (vramPollRef.current) clearInterval(vramPollRef.current);
        loadVramInfo();
        vramPollRef.current = setInterval(loadVramInfo, 5000);
        setIsPolling(true);
    };

    const stopVramPolling = () => {
        if (vramPollRef.current) {
            clearInterval(vramPollRef.current);
            vramPollRef.current = null;
        }
        setIsPolling(false);
    };

    const loadConfig = async () => {
        try {
            const res = await comicApi.getConfig();
            if (res.data?.local) setLocalConfig(prev => ({ ...prev, ...res.data.local }));
            if (res.data?.cloud) setCloudConfig(prev => ({ ...prev, ...res.data.cloud }));
        } catch (e) {
            console.log('No saved config, using defaults');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await comicApi.saveConfig({
                local: localConfig,
                cloud: cloudConfig
            });
            setTestResult({ type: 'success', message: '配置已保存' });
        } catch (e) {
            setTestResult({ type: 'error', message: e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const config = activeTab === 'local' ? localConfig : cloudConfig;
            const res = await comicApi.testConnection({ type: activeTab, ...config });
            setTestResult({
                type: 'success',
                message: res.data?.message || '连接成功',
                systemInfo: res.data?.systemInfo || null
            });
        } catch (e) {
            setTestResult({ type: 'error', message: e.response?.data?.error || e.message });
        } finally {
            setTesting(false);
        }
    };

    const updateLocal = (key, value) => setLocalConfig(prev => ({ ...prev, [key]: value }));
    const updateCloud = (key, value) => setCloudConfig(prev => ({ ...prev, [key]: value }));

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">ComfyUI 配置</h1>
                <p className="page-subtitle">配置本地或云端 ComfyUI 实例，连接后可用于漫剧分镜渲染</p>
            </div>

            <div className="cyber-tabs" style={{ marginBottom: 24 }}>
                {CONFIG_TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => { setActiveTab(tab.key); setTestResult(null); }}
                        style={activeTab === tab.key ? { borderColor: tab.color, color: tab.color } : {}}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'local' && (
                <>
                <div className="cyber-card">
                    <h3 style={{ color: 'var(--neon-green)', marginBottom: 16 }}>本地 ComfyUI 配置</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                        连接本地运行的 ComfyUI 实例。确保 ComfyUI 已启动并监听指定端口。
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">API 地址</label>
                            <input className="cyber-input" value={localConfig.apiUrl}
                                onChange={e => updateLocal('apiUrl', e.target.value)}
                                placeholder="http://127.0.0.1:8188"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">WebSocket 地址</label>
                            <input className="cyber-input" value={localConfig.wsUrl}
                                onChange={e => updateLocal('wsUrl', e.target.value)}
                                placeholder="ws://127.0.0.1:8188"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">ComfyUI 安装目录</label>
                            <input className="cyber-input" value={localConfig.installDir}
                                onChange={e => updateLocal('installDir', e.target.value)}
                                placeholder="C:\Romc7.9"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">启动命令</label>
                            <input className="cyber-input" value={localConfig.startCommand}
                                onChange={e => updateLocal('startCommand', e.target.value)}
                                placeholder=".venv\Scripts\activate && python ComfyUI\main.py"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">输出目录（留空使用ComfyUI默认）</label>
                            <input className="cyber-input" value={localConfig.outputDir}
                                onChange={e => updateLocal('outputDir', e.target.value)}
                                placeholder="D:\ComfyUI\output"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">GPU 设备</label>
                            <input className="cyber-input" value={localConfig.gpuDevice}
                                onChange={e => updateLocal('gpuDevice', e.target.value)}
                                placeholder="0"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">默认大模型 (Checkpoint)</label>
                            <input className="cyber-input" value={localConfig.checkpoint}
                                onChange={e => updateLocal('checkpoint', e.target.value)}
                                placeholder="留空使用ComfyUI当前选择"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">默认 VAE</label>
                            <input className="cyber-input" value={localConfig.vae}
                                onChange={e => updateLocal('vae', e.target.value)}
                                placeholder="留空使用内置VAE"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">请求超时（秒）</label>
                            <input className="cyber-input" type="number" value={localConfig.timeout}
                                onChange={e => updateLocal('timeout', parseInt(e.target.value) || 300)}
                                min={30} max={3600}
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, marginTop: 24 }}>
                                <input type="checkbox" checked={localConfig.autoStart}
                                    onChange={e => updateLocal('autoStart', e.target.checked)} />
                                自动启动 ComfyUI（需要配置启动命令）
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button className="cyber-btn cyber-btn-primary" onClick={handleTestConnection} disabled={testing}>
                            {testing ? <><span className="cyber-loading"></span> 测试中</> : '◈ 测试连接'}
                        </button>
                        <button className="cyber-btn" onClick={async () => {
                            try {
                                const res = await comicApi.startComfyUI();
                                setTestResult({ type: res.data?.success ? 'success' : 'error', message: res.data?.message || '启动命令已发送' });
                            } catch (e) {
                                setTestResult({ type: 'error', message: e.response?.data?.error || e.message });
                            }
                        }}>
                            ▶ 启动 ComfyUI
                        </button>
                        <button className="cyber-btn" style={{ color: 'var(--neon-red)' }} onClick={async () => {
                            try {
                                const res = await comicApi.stopComfyUI();
                                setTestResult({ type: res.data?.success ? 'success' : 'error', message: res.data?.message || '已停止' });
                            } catch (e) {
                                setTestResult({ type: 'error', message: e.response?.data?.error || e.message });
                            }
                        }}>
                            ■ 停止 ComfyUI
                        </button>
                        <button className="cyber-btn" onClick={handleSave} disabled={saving}>
                            {saving ? <><span className="cyber-loading"></span> 保存中</> : '保存配置'}
                        </button>
                    </div>
                </div>

                <div className="cyber-card" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ color: 'var(--neon-purple)', margin: 0 }}>◈ 显存监控</h3>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => loadVramInfo(true)} disabled={vramLoading}>
                                {vramLoading ? '⟳' : '↻'} 刷新
                            </button>
                            {isPolling ? (
                                <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-red)' }} onClick={stopVramPolling}>
                                    ■ 停止监控
                                </button>
                            ) : (
                                <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-green)' }} onClick={startVramPolling}>
                                    ▶ 实时监控
                                </button>
                            )}
                        </div>
                    </div>

                    {vramInfo ? (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>GPU 设备</div>
                                    <div style={{ fontSize: 13, color: 'var(--neon-orange)', fontWeight: 600 }}>{vramInfo.gpuName}</div>
                                </div>
                                <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>显存使用率</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: parseFloat(vramInfo.usagePercent) > 80 ? 'var(--neon-red)' : parseFloat(vramInfo.usagePercent) > 50 ? 'var(--neon-orange)' : 'var(--neon-green)' }}>
                                        {vramInfo.usagePercent}%
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                    <span>VRAM</span>
                                    <span>{vramInfo.vramUsed}GB / {vramInfo.vramTotal}GB (空闲: {vramInfo.vramFree}GB)</span>
                                </div>
                                <div style={{ height: 20, background: 'var(--bg-input)', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${vramInfo.usagePercent}%`,
                                        background: parseFloat(vramInfo.usagePercent) > 80
                                            ? 'linear-gradient(90deg, var(--neon-red), #ff4444)'
                                            : parseFloat(vramInfo.usagePercent) > 50
                                                ? 'linear-gradient(90deg, var(--neon-orange), #ffaa00)'
                                                : 'linear-gradient(90deg, var(--neon-green), #00ff88)',
                                        borderRadius: 10,
                                        transition: 'width 0.5s ease',
                                        boxShadow: parseFloat(vramInfo.usagePercent) > 80 ? '0 0 10px var(--neon-red)' : 'none'
                                    }} />
                                    {parseFloat(vramInfo.usagePercent) > 80 && (
                                        <div style={{ position: 'absolute', right: 8, top: 2, fontSize: 11, color: 'var(--neon-red)', fontWeight: 600, animation: 'pulse 1s infinite' }}>
                                            ⚠ 高占用
                                        </div>
                                    )}
                                </div>
                            </div>

                            {vramInfo.ramTotal && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                        <span>RAM</span>
                                        <span>空闲: {vramInfo.ramFree}GB / {vramInfo.ramTotal}GB</span>
                                    </div>
                                    <div style={{ height: 12, background: 'var(--bg-input)', borderRadius: 6, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${((vramInfo.ramTotal - vramInfo.ramFree) / vramInfo.ramTotal * 100).toFixed(1)}%`,
                                            background: 'linear-gradient(90deg, var(--neon-blue), #4488ff)',
                                            borderRadius: 6,
                                            transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="cyber-btn cyber-btn-primary" onClick={handleFreeMemory} disabled={vramFreeing}
                                    style={{ flex: 1 }}>
                                    {vramFreeing ? <><span className="cyber-loading"></span> 释放中...</> : '⚡ 完全释放显存'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                            {vramLoading ? '正在检测显存...' : '无法获取显存信息，请确保 ComfyUI 已启动'}
                        </div>
                    )}
                </div>

                <div className="cyber-card" style={{ marginTop: 16 }}>
                    <h3 style={{ color: 'var(--neon-blue)', marginBottom: 16 }}>⚙ 自动释放配置</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                        当显存占用超过阈值且空闲时间达到设定值时，自动释放显存。
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                                <input type="checkbox" checked={autoFreeConfig.enabled}
                                    onChange={e => handleAutoFreeConfigChange('enabled', e.target.checked)} />
                                启用自动释放
                            </label>
                        </div>
                        <div className="form-group">
                            <label className="form-label">空闲时间（秒）</label>
                            <input className="cyber-input" type="number" value={autoFreeConfig.idleSeconds}
                                onChange={e => handleAutoFreeConfigChange('idleSeconds', parseInt(e.target.value) || 120)}
                                min={10} max={3600} disabled={!autoFreeConfig.enabled}
                                style={{ width: '100%', boxSizing: 'border-box', opacity: autoFreeConfig.enabled ? 1 : 0.5 }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">VRAM阈值（%）</label>
                            <input className="cyber-input" type="number" value={Math.round(autoFreeConfig.vramThreshold * 100)}
                                onChange={e => handleAutoFreeConfigChange('vramThreshold', (parseInt(e.target.value) || 75) / 100)}
                                min={30} max={99} disabled={!autoFreeConfig.enabled}
                                style={{ width: '100%', boxSizing: 'border-box', opacity: autoFreeConfig.enabled ? 1 : 0.5 }} />
                        </div>
                    </div>

                    {autoFreeConfig.enabled && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                            当前策略：空闲 <span style={{ color: 'var(--neon-blue)' }}>{autoFreeConfig.idleSeconds}秒</span> 后，
                            若VRAM占用超过 <span style={{ color: 'var(--neon-orange)' }}>{Math.round(autoFreeConfig.vramThreshold * 100)}%</span>，
                            则自动卸载模型并释放显存
                        </div>
                    )}
                </div>
                </>
            )}

            {activeTab === 'cloud' && (
                <div className="cyber-card">
                    <h3 style={{ color: 'var(--neon-blue)', marginBottom: 16 }}>云端 ComfyUI 配置</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                        连接云端 ComfyUI 服务，无需本地GPU，按需弹性扩缩容。
                    </p>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">服务提供商</label>
                        <select className="cyber-input" value={cloudConfig.provider}
                            onChange={e => updateCloud('provider', e.target.value)}
                            style={{ width: '100%', padding: '8px 12px' }}>
                            <option value="comfyui-cloud">ComfyUI Cloud</option>
                            <option value="runpod">RunPod</option>
                            <option value="vastai">Vast.ai</option>
                            <option value="autoDL">AutoDL</option>
                            <option value="custom">自定义</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">API 地址</label>
                            <input className="cyber-input" value={cloudConfig.apiUrl}
                                onChange={e => updateCloud('apiUrl', e.target.value)}
                                placeholder="https://api.comfyui.cloud"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">区域</label>
                            <select className="cyber-input" value={cloudConfig.region}
                                onChange={e => updateCloud('region', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}>
                                <option value="cn-east-1">华东1</option>
                                <option value="cn-north-1">华北1</option>
                                <option value="us-west-1">美西1</option>
                                <option value="ap-southeast-1">东南亚1</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">API Key</label>
                            <input className="cyber-input" type="password" value={cloudConfig.apiKey}
                                onChange={e => updateCloud('apiKey', e.target.value)}
                                placeholder="输入API Key"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">API Secret</label>
                            <input className="cyber-input" type="password" value={cloudConfig.apiSecret}
                                onChange={e => updateCloud('apiSecret', e.target.value)}
                                placeholder="输入API Secret"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">实例类型</label>
                            <select className="cyber-input" value={cloudConfig.instanceType}
                                onChange={e => updateCloud('instanceType', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}>
                                <option value="gpu-a10">A10 (24GB)</option>
                                <option value="gpu-a100">A100 (80GB)</option>
                                <option value="gpu-4090">RTX 4090 (24GB)</option>
                                <option value="gpu-3090">RTX 3090 (24GB)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">空闲超时（秒）</label>
                            <input className="cyber-input" type="number" value={cloudConfig.idleTimeout}
                                onChange={e => updateCloud('idleTimeout', parseInt(e.target.value) || 300)}
                                min={60} max={3600}
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, paddingTop: 24 }}>
                            <input type="checkbox" checked={cloudConfig.autoScale}
                                onChange={e => updateCloud('autoScale', e.target.checked)} />
                            自动扩缩容
                        </label>
                        <div className="form-group">
                            <label className="form-label">最小实例</label>
                            <input className="cyber-input" type="number" value={cloudConfig.minInstances}
                                onChange={e => updateCloud('minInstances', parseInt(e.target.value) || 0)}
                                min={0} max={10}
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">最大实例</label>
                            <input className="cyber-input" type="number" value={cloudConfig.maxInstances}
                                onChange={e => updateCloud('maxInstances', parseInt(e.target.value) || 2)}
                                min={1} max={20}
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button className="cyber-btn cyber-btn-primary" onClick={handleTestConnection} disabled={testing}>
                            {testing ? <><span className="cyber-loading"></span> 测试中</> : '◈ 测试连接'}
                        </button>
                        <button className="cyber-btn" onClick={handleSave} disabled={saving}>
                            {saving ? <><span className="cyber-loading"></span> 保存中</> : '保存配置'}
                        </button>
                    </div>
                </div>
            )}

            {testResult && (
                <div className="cyber-card" style={{
                    marginTop: 16,
                    borderColor: testResult.type === 'success' ? 'var(--neon-green)' : 'var(--neon-red)'
                }}>
                    <div style={{ color: testResult.type === 'success' ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 600, marginBottom: testResult.systemInfo ? 12 : 0 }}>
                        {testResult.type === 'success' ? '✓' : '✗'} {testResult.message}
                    </div>
                    {testResult.systemInfo && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                                <div>ComfyUI 版本: <span style={{ color: 'var(--neon-blue)' }}>{testResult.systemInfo.comfyuiVersion}</span></div>
                                <div>Python: <span style={{ color: 'var(--neon-blue)' }}>{testResult.systemInfo.pythonVersion?.substring(0, 20)}</span></div>
                                <div>PyTorch: <span style={{ color: 'var(--neon-blue)' }}>{testResult.systemInfo.pytorchVersion}</span></div>
                                <div>系统: <span style={{ color: 'var(--neon-blue)' }}>{testResult.systemInfo.os}</span></div>
                                <div>内存: <span style={{ color: 'var(--neon-green)' }}>{testResult.systemInfo.ramTotal}GB</span> (可用: <span style={{ color: 'var(--neon-green)' }}>{testResult.systemInfo.ramFree}GB</span>)</div>
                            </div>
                            {testResult.systemInfo.devices?.length > 0 && (
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--neon-purple)', marginBottom: 4 }}>GPU 设备:</div>
                                    {testResult.systemInfo.devices.map((dev, i) => (
                                        <div key={i} style={{ padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 4, marginBottom: 4 }}>
                                            <span style={{ color: 'var(--neon-orange)' }}>GPU{dev.index}</span>: {dev.name}
                                            <span style={{ marginLeft: 12 }}>VRAM: <span style={{ color: 'var(--neon-green)' }}>{dev.vramTotal}GB</span> (空闲: <span style={{ color: 'var(--neon-green)' }}>{dev.vramFree}GB</span>)</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
