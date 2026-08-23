import useComicConfigState from '../comic/useComicConfigState';
import ComicConfigForm from '../comic/ComicConfigForm';
import VramMonitor from '../comic/VramMonitor';

export default function ComicConfigPage() {
    const state = useComicConfigState();
    const { CONFIG_TABS, activeTab, setActiveTab, testResult, setTestResult } = state;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">ComfyUI 配置</h1>
                <p className="page-subtitle">配置本地或云端 ComfyUI 实例，连接后可用于漫剧分镜渲染</p>
            </div>

            <div className="cyber-tabs mb-24">
                {CONFIG_TABS.map(tab => (
                    <button key={tab.key} className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => { setActiveTab(tab.key); setTestResult(null); }}
                        style={activeTab === tab.key ? { borderColor: tab.color, color: tab.color } : {}}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <ComicConfigForm state={state} />

            {activeTab === 'local' && <VramMonitor state={state} />}

            {testResult && (
                <div className="cyber-card mt-16" style={{ borderColor: testResult.type === 'success' ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                    <div className="font-semibold mb-8" style={{ color: testResult.type === 'success' ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                        {testResult.type === 'success' ? '✓' : '✗'} {testResult.message}
                    </div>
                    {testResult.systemInfo && (
                        <div className="text-sm text-secondary lh-1-8">
                            <div className="grid-2-gap-6 mb-8">
                                <div>ComfyUI 版本: <span className="text-blue">{testResult.systemInfo.comfyuiVersion}</span></div>
                                <div>Python: <span className="text-blue">{testResult.systemInfo.pythonVersion?.substring(0, 20)}</span></div>
                                <div>PyTorch: <span className="text-blue">{testResult.systemInfo.pytorchVersion}</span></div>
                                <div>系统: <span className="text-blue">{testResult.systemInfo.os}</span></div>
                                <div>内存: <span className="text-green">{testResult.systemInfo.ramTotal}GB</span> (可用: <span className="text-green">{testResult.systemInfo.ramFree}GB</span>)</div>
                            </div>
                            {testResult.systemInfo.devices?.length > 0 && (
                                <div>
                                    <div className="font-semibold text-purple mb-4">GPU 设备:</div>
                                    {testResult.systemInfo.devices.map((dev, i) => (
                                        <div key={i} className="p-4 rounded mb-4" style={{ background: 'var(--bg-input)' }}>
                                            <span className="text-orange">GPU{dev.index}</span>: {dev.name}
                                            <span className="ml-12">VRAM: <span className="text-green">{dev.vramTotal}GB</span> (空闲: <span className="text-green">{dev.vramFree}GB</span>)</span>
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
