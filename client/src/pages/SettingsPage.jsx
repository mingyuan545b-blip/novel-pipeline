import useSettingsState from './settings/useSettingsState';
import SettingsForm from './settings/SettingsForm';
import { getProvider } from './settings/settingsConstants';

const SKIN_LIST = [
    { key: 'glass', label: '磨砂玻璃', desc: 'Glassmorphism | 浅色磨砂 | 半透明白底', color: '#4a90d9', bg: '#e8eaf6' },
    { key: 'liquid', label: '液态玻璃', desc: 'Liquid Glass | 彩色渐变 | 液态光感', color: '#64b4ff', bg: '#0f0c29' },
    { key: 'ceramic', label: '渐变陶瓷', desc: 'Ceramic Clay | 暗色黏土 | 渐变光泽', color: '#9b72cf', bg: '#1a1a24' },
    { key: 'ripple', label: '动态水波纹', desc: 'Water Ripple | 浅灰底 | 水蓝渐变 | 扫光', color: '#00bfff', bg: '#d4dade' },
    { key: 'aurora', label: '炫彩动态', desc: 'Aurora | 极光流动 | 彩色渐变 | 动态背景', color: '#00e5ff', bg: '#0a0a1a' },
    { key: 'mario', label: '马里奥', desc: 'Mario | 经典红黄 | 砖块按钮 | 蘑菇动效', color: '#f1c40f', bg: '#1a1a2e' }
];

export default function SettingsPage() {
    const s = useSettingsState();
    const {
        settings, theme, setTheme, membership, bgImage, setBgImage, bgOpacity, setBgOpacity,
        bgBlur, setBgBlur, form, setForm, testResult, testing, saving, saveMsg, apiKeys,
        agentBindings, newKey, setNewKey, showAddKey, setShowAddKey, currentProvider,
        newKeyProvider, saveSettings, testConnection, addApiKey, deleteApiKey, bindAgent,
    } = s || {};

    const safeSettings = settings || {};
    const safeMembership = membership || { level: 'free', licensed: false };

    return (
        <div>
            <div className="page-header"><h1 className="page-title">系统设置</h1><p className="page-subtitle">配置API Key、模型参数和系统选项</p></div>

            <div className="cyber-section-title">会员管理</div>
            <div className="cyber-card mb-24">
                <div className="flex-between mb-16">
                    <div>
                        <span className="font-bold text-lg" style={{ color: safeMembership.level === 'pro' ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                            {safeMembership.level === 'pro' ? '◈ 专业版' : '○ 免费版'}
                        </span>
                        {safeMembership.trial && <span className="ml-8 text-sm text-orange">试用中</span>}
                    </div>
                </div>
                {safeMembership.level === 'free' && (
                    <div className="mb-16">
                        <div className="text-base text-muted mb-8">免费版限制：</div>
                        <div className="text-sm text-secondary lh-1-8">
                            <div>• 最多 2 个项目 / 每项目 10 章 / 30 个素材</div>
                            <div>• 仅 1 个 API Key</div>
                            <div className="text-red">• ✗ 自动化流水线 / 无限流水线 / 小说融合 / 发布中心 / 漫剧渲染</div>
                        </div>
                    </div>
                )}
                {safeMembership.level === 'pro' && (
                    <div className="text-sm text-green lh-1-8">
                        <div>✓ 无限项目 / 章节 / 自动化流水线 / 多 API Key</div>
                        {safeMembership.expiresAt && <div className="text-orange mt-4">到期: {new Date(safeMembership.expiresAt).toLocaleDateString('zh-CN')}</div>}
                    </div>
                )}
            </div>

            <div className="cyber-section-title">皮肤风格</div>
            <div className="flex gap-16 mb-24 flex-wrap">
                {SKIN_LIST.map(skin => (
                    <div key={skin.key} className="cyber-card cursor-pointer"
                        style={{ width: 180, borderColor: theme === skin.key ? skin.color : undefined, boxShadow: theme === skin.key ? `0 0 20px ${skin.color}40` : undefined, transition: 'all 0.3s ease' }}
                        onClick={() => setTheme(skin.key)}>
                        <div style={{ height: 50, borderRadius: 8, background: skin.bg, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${skin.color}40`, position: 'relative', overflow: 'hidden' }}>
                            {skin.key === 'ripple' && (
                                <div style={{ width: 40, height: 24, borderRadius: 12, background: 'linear-gradient(to bottom, #d4dade, #c5c8cb)', boxShadow: '0 4px 8px rgba(0,0,0,0.12), inset 0 2px 3px rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.4)', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', background: 'linear-gradient(to bottom, #87ceeb, #00bfff)', borderRadius: 12, opacity: 0.8 }}></div>
                                </div>
                            )}
                        </div>
                        <div className="font-bold" style={{ color: skin.color, fontSize: 13, marginBottom: 2 }}>{skin.label}</div>
                        <div className="text-xs text-muted">{skin.desc}</div>
                        {theme === skin.key && <div className="mt-4 text-xs" style={{ color: skin.color }}>✓ 当前</div>}
                    </div>
                ))}
            </div>

            <div className="cyber-section-title">背景图片</div>
            <div className="cyber-card mb-24">
                <div className="flex gap-12 items-end flex-wrap mb-12">
                    <div className="form-group flex-1" style={{ margin: 0, minWidth: 200 }}>
                        <label className="form-label">图片URL</label>
                        <input className="cyber-input w-full border-box" value={bgImage || ''} onChange={e => setBgImage(e.target.value)} placeholder="输入图片URL或上传本地图片..." />
                    </div>
                    <label className="cyber-btn cursor-pointer whitespace-nowrap" style={{ marginBottom: 0, height: 38, minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
                        上传图片
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => setBgImage(ev.target.result); reader.readAsDataURL(file); } }} />
                    </label>
                    {bgImage && <button className="cyber-btn whitespace-nowrap" style={{ color: 'var(--neon-red)', marginBottom: 0, height: 38, minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }} onClick={() => setBgImage('')}>清除背景</button>}
                </div>
                <div className="flex gap-20 items-center flex-wrap">
                    <div className="flex-1" style={{ minWidth: 150 }}>
                        <label className="form-label">透明度: {Math.round((bgOpacity ?? 1) * 100)}%</label>
                        <input type="range" min="0" max="1" step="0.05" value={bgOpacity ?? 1} onChange={e => setBgOpacity(parseFloat(e.target.value))} className="w-full" style={{ accentColor: 'var(--neon-blue)' }} />
                    </div>
                    <div className="flex-1" style={{ minWidth: 150 }}>
                        <label className="form-label">模糊: {bgBlur ?? 0}px</label>
                        <input type="range" min="0" max="20" step="1" value={bgBlur ?? 0} onChange={e => setBgBlur(parseInt(e.target.value))} className="w-full" style={{ accentColor: 'var(--neon-purple)' }} />
                    </div>
                </div>
                {bgImage && (
                    <div className="mt-12 overflow-hidden rounded" style={{ height: 80, border: '1px solid var(--border-color)' }}>
                        <img src={bgImage} alt="bg preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: bgOpacity ?? 1, filter: `blur(${bgBlur ?? 0}px)` }} />
                    </div>
                )}
            </div>

            <SettingsForm settings={safeSettings} form={form || {}} setForm={setForm} testResult={testResult} testing={testing}
                saving={saving} saveMsg={saveMsg} apiKeys={apiKeys || []} agentBindings={agentBindings || []} newKey={newKey}
                setNewKey={setNewKey} showAddKey={showAddKey} setShowAddKey={setShowAddKey} currentProvider={currentProvider}
                newKeyProvider={newKeyProvider} saveSettings={saveSettings} testConnection={testConnection}
                addApiKey={addApiKey} deleteApiKey={deleteApiKey} bindAgent={bindAgent} />

            <div className="grid-2">
                <div>
                    <div className="cyber-section-title">系统状态</div>
                    <div className="cyber-card">
                        <div className="table-container"><table className="cyber-table"><tbody>
                            <tr><td className="font-semibold">API状态</td><td><span className={`cyber-status-dot ${safeSettings.hasKey ? 'cyber-status-dot-online' : 'cyber-status-dot-offline'}`}></span>{safeSettings.hasKey ? '已配置' : '未配置'}</td></tr>
                            <tr><td className="font-semibold">提供商</td><td>{getProvider(safeSettings.provider).name}</td></tr>
                            <tr><td className="font-semibold">模型</td><td>{safeSettings.model || '未设置'}</td></tr>
                            <tr><td className="font-semibold">后端地址</td><td className="font-mono text-sm">{window.location.origin.replace(/:\d+$/, '')}:{import.meta.env.VITE_API_PORT || '3001'}</td></tr>
                        </tbody></table></div>
                    </div>
                </div>
                <div>
                    <div className="cyber-section-title">AiPy Pro 集成</div>
                    <div className="cyber-card">
                        <div className="text-base lh-1-6 mb-12" style={{ color: '#8888aa' }}>将MCP Agent扩展安装到AiPy Pro扩展目录，即可通过AiPy Pro调度流水线。</div>
                        <div className="table-container"><table className="cyber-table"><tbody>
                            <tr><td className="font-semibold" style={{ width: 80 }}>Windows</td><td className="font-mono text-sm">C:\Users\用户名\AppData\Roaming\aipy-pro\extensions</td></tr>
                            <tr><td className="font-semibold">macOS</td><td className="font-mono text-sm">~/Library/Application Support/aipy-pro/extensions</td></tr>
                            <tr><td className="font-semibold">Linux</td><td className="font-mono text-sm">~/.config/aipy-pro/extensions</td></tr>
                        </tbody></table></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
