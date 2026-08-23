const SAMPLER_OPTIONS = ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpmpp_2m', 'dpmpp_sde', 'dpmpp_2m_sde'];
const WORKFLOW_PARAM_DEFS = [
    { key: 'steps', label: '步数', type: 'number', min: 1, max: 50 },
    { key: 'cfg', label: 'CFG', type: 'number', min: 0.5, max: 10, step: 0.5 },
    { key: 'maxShift', label: 'MaxShift', type: 'number', min: 0.1, max: 5, step: 0.05 },
    { key: 'baseShift', label: 'BaseShift', type: 'number', min: 0.1, max: 3, step: 0.05 },
    { key: 'videoLength', label: '帧数', type: 'number', min: 1, max: 257 },
    { key: 'strength', label: '强度', type: 'number', min: 0.1, max: 1.5, step: 0.1 },
];

export { SAMPLER_OPTIONS, WORKFLOW_PARAM_DEFS };

export function VramStatusBar({ comfyuiStatus, handleFreeMemory, freeingMemory }) {
    return (
        <div className="flex gap-8 items-start">
            {comfyuiStatus && comfyuiStatus.devices?.[0] && (() => {
                const dev = comfyuiStatus.devices[0];
                const used = dev.vram_total - dev.vram_free;
                const pct = (used / dev.vram_total * 100).toFixed(0);
                const usedGB = (used / 1073741824).toFixed(1);
                const totalGB = (dev.vram_total / 1073741824).toFixed(1);
                const barColor = pct > 80 ? 'var(--neon-red)' : pct > 60 ? 'var(--neon-orange)' : 'var(--neon-green)';
                return (
                    <div className="flex items-start gap-8">
                        <span className="text-xs text-muted">VRAM</span>
                        <div style={{ width: 120, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: barColor }}>{usedGB}/{totalGB}GB ({pct}%)</span>
                    </div>
                );
            })()}
            {!comfyuiStatus && <span className="text-sm text-red">● 未连接</span>}
            <button className="cyber-btn" onClick={handleFreeMemory} disabled={freeingMemory}
                style={{ fontSize: 10, padding: '2px 10px', color: freeingMemory ? 'var(--neon-orange)' : 'var(--neon-red)' }}>
                {freeingMemory ? '⟳ 释放中' : '♻ 释放显存'}
            </button>
        </div>
    );
}

export function AutoFreeBar({ autoFreeConfig, handleUpdateAutoFree }) {
    return (
        <div className="auto-free-bar mb-16">
            <span className="text-xs text-muted">自动回收</span>
            <label className="flex gap-4 cursor-pointer text-xs">
                <input type="checkbox" checked={autoFreeConfig.enabled} onChange={e => handleUpdateAutoFree('enabled', e.target.checked)} style={{ width: 12, height: 12 }} />
                <span style={{ color: autoFreeConfig.enabled ? 'var(--neon-green)' : 'var(--text-muted)' }}>{autoFreeConfig.enabled ? 'ON' : 'OFF'}</span>
            </label>
            {autoFreeConfig.enabled && (
                <>
                    <span className="text-xs text-muted">空闲</span>
                    <input className="cyber-input input-compact" type="number" value={autoFreeConfig.idleSeconds} onChange={e => handleUpdateAutoFree('idleSeconds', parseInt(e.target.value) || 120)} min={30} max={600} step={30} style={{ width: 50, textAlign: 'center' }} />
                    <span className="text-xs text-muted">秒后回收</span>
                    <span className="text-xs text-muted ml-8">VRAM阈值</span>
                    <input className="cyber-input input-compact" type="number" value={(autoFreeConfig.vramThreshold * 100).toFixed(0)} onChange={e => handleUpdateAutoFree('vramThreshold', (parseInt(e.target.value) || 75) / 100)} min={30} max={95} step={5} style={{ width: 40, textAlign: 'center' }} />
                    <span className="text-xs text-muted">%</span>
                </>
            )}
        </div>
    );
}

export function WorkflowParams({ workflowParams, setWorkflowParams }) {
    return (
        <div className="workflow-params-grid">
            <div className="text-xs text-muted mb-6">工作流参数</div>
            <div className="grid-auto-100">
                {WORKFLOW_PARAM_DEFS.map(p => (
                    <div key={p.key}>
                        <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 2 }}>{p.label}</label>
                        <input className="cyber-input input-compact" type={p.type} value={workflowParams[p.key]}
                            onChange={e => setWorkflowParams(prev => ({ ...prev, [p.key]: parseFloat(e.target.value) || prev[p.key] }))}
                            min={p.min} max={p.max} step={p.step || 1} />
                    </div>
                ))}
                <div>
                    <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 2 }}>采样器</label>
                    <select className="cyber-input input-compact" value={workflowParams.sampler}
                        onChange={e => setWorkflowParams(prev => ({ ...prev, sampler: e.target.value }))}>
                        {SAMPLER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );
}
