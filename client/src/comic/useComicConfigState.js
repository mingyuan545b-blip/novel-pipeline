import { useState, useEffect, useRef } from 'react';
import { comicApi } from '../services/api';

const CONFIG_TABS = [
    { key: 'local', label: '本地 ComfyUI', icon: '⬢', color: 'var(--neon-green)' },
    { key: 'cloud', label: '云端 ComfyUI', icon: '◈', color: 'var(--neon-blue)' }
];

const DEFAULT_LOCAL_CONFIG = {
    apiUrl: 'http://127.0.0.1:8188',
    wsUrl: 'ws://127.0.0.1:8188',
    installDir: 'C:\\Romc7.9',
    startCommand: '.venv\\Scripts\\activate && python ComfyUI\\main.py',
    outputDir: '', autoStart: false, gpuDevice: '0', vae: '', checkpoint: '', timeout: 300
};

const DEFAULT_CLOUD_CONFIG = {
    provider: 'comfyui-cloud', apiUrl: '', apiKey: '', apiSecret: '',
    region: 'cn-east-1', instanceType: 'gpu-a10', autoScale: true,
    minInstances: 0, maxInstances: 2, idleTimeout: 300
};

const DEFAULT_AUTO_FREE = { enabled: true, idleSeconds: 120, vramThreshold: 0.75 };

export default function useComicConfigState() {
    const [activeTab, setActiveTab] = useState('local');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [vramInfo, setVramInfo] = useState(null);
    const [vramLoading, setVramLoading] = useState(false);
    const [vramFreeing, setVramFreeing] = useState(false);
    const [autoFreeConfig, setAutoFreeConfigState] = useState({ ...DEFAULT_AUTO_FREE });
    const [isPolling, setIsPolling] = useState(false);
    const vramPollRef = useRef(null);
    const [localConfig, setLocalConfig] = useState({ ...DEFAULT_LOCAL_CONFIG });
    const [cloudConfig, setCloudConfig] = useState({ ...DEFAULT_CLOUD_CONFIG });

    useEffect(() => { loadConfig(); loadVramInfo(true); loadAutoFreeConfig(); return () => { if (vramPollRef.current) clearInterval(vramPollRef.current); }; }, []);

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
            } else { setVramInfo(null); }
        } catch { /* vram info optional */ } finally { setVramLoading(false); }
    };

    const handleFreeMemory = async () => {
        setVramFreeing(true);
        try {
            const res = await comicApi.comfyuiFreeMemory({ unloadModels: true, freeMemory: true });
            const data = res.data || res;
            if (data.success) {
                setTestResult({ type: 'success', message: '显存释放指令已发送！ROCm VRAM回收需要10-15秒，请观察进度条变化...' });
                await new Promise(r => setTimeout(r, 2000));
                await loadVramInfo();
                setTimeout(() => loadVramInfo(), 5000);
                setTimeout(() => loadVramInfo(), 10000);
                setTimeout(() => loadVramInfo(), 15000);
            } else { setTestResult({ type: 'error', message: '释放失败: ' + (data.error || '未知错误') }); }
        } catch (e) { setTestResult({ type: 'error', message: '释放失败: ' + (e.response?.data?.error || e.message) }); } finally { setVramFreeing(false); }
    };

    const loadAutoFreeConfig = async () => { try { setAutoFreeConfigState((await comicApi.comfyuiGetAutoFreeConfig()).data || DEFAULT_AUTO_FREE); } catch { /* config optional */ } };

    const handleAutoFreeConfigChange = async (key, value) => {
        const newConfig = { ...autoFreeConfig, [key]: value }; setAutoFreeConfigState(newConfig);
        try { await comicApi.comfyuiSetAutoFreeConfig(newConfig); } catch { /* save optional */ }
    };

    const startVramPolling = () => { if (vramPollRef.current) clearInterval(vramPollRef.current); loadVramInfo(); vramPollRef.current = setInterval(loadVramInfo, 5000); setIsPolling(true); };
    const stopVramPolling = () => { if (vramPollRef.current) { clearInterval(vramPollRef.current); vramPollRef.current = null; } setIsPolling(false); };

    const loadConfig = async () => {
        try {
            const res = await comicApi.getConfig();
            if (res.data?.local) setLocalConfig(prev => ({ ...prev, ...res.data.local }));
            if (res.data?.cloud) setCloudConfig(prev => ({ ...prev, ...res.data.cloud }));
        } catch { /* config optional */ }
    };

    const handleSave = async () => {
        setSaving(true);
        try { await comicApi.saveConfig({ local: localConfig, cloud: cloudConfig }); setTestResult({ type: 'success', message: '配置已保存' }); }
        catch (e) { setTestResult({ type: 'error', message: e.message }); } finally { setSaving(false); }
    };

    const handleTestConnection = async () => {
        setTesting(true); setTestResult(null);
        try {
            const config = activeTab === 'local' ? localConfig : cloudConfig;
            setTestResult({ type: 'success', message: (await comicApi.testConnection({ type: activeTab, ...config })).data?.message || '连接成功', systemInfo: (await comicApi.testConnection({ type: activeTab, ...config })).data?.systemInfo || null });
        } catch (e) { setTestResult({ type: 'error', message: e.response?.data?.error || e.message }); } finally { setTesting(false); }
    };

    const updateLocal = (key, value) => setLocalConfig(prev => ({ ...prev, [key]: value }));
    const updateCloud = (key, value) => setCloudConfig(prev => ({ ...prev, [key]: value }));

    const handleStartComfyUI = async () => {
        try { const res = await comicApi.startComfyUI(); setTestResult({ type: res.data?.success ? 'success' : 'error', message: res.data?.message || '启动命令已发送' }); }
        catch (e) { setTestResult({ type: 'error', message: e.response?.data?.error || e.message }); }
    };

    const handleStopComfyUI = async () => {
        try { const res = await comicApi.stopComfyUI(); setTestResult({ type: res.data?.success ? 'success' : 'error', message: res.data?.message || '已停止' }); }
        catch (e) { setTestResult({ type: 'error', message: e.response?.data?.error || e.message }); }
    };

    return {
        CONFIG_TABS, activeTab, setActiveTab, saving, testing, testResult, setTestResult,
        vramInfo, vramLoading, vramFreeing, autoFreeConfig, isPolling, localConfig,
        cloudConfig, handleFreeMemory, handleAutoFreeConfigChange, startVramPolling,
        stopVramPolling, loadVramInfo, handleSave, handleTestConnection, updateLocal,
        updateCloud, handleStartComfyUI, handleStopComfyUI
    };
}
