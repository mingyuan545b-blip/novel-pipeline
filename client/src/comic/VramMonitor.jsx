export default function VramMonitor({ state }) {
    const { vramInfo, vramLoading, vramFreeing, isPolling, autoFreeConfig,
        handleFreeMemory, handleAutoFreeConfigChange, startVramPolling, stopVramPolling, loadVramInfo } = state;

    const usagePct = parseFloat(vramInfo?.usagePercent || 0);
    const barFillClass = usagePct > 80 ? 'vram-bar-fill-red' : usagePct > 50 ? 'vram-bar-fill-orange' : 'vram-bar-fill-green';

    return (
        <>
            <div className="cyber-card mt-16">
                <div className="flex-between mb-16">
                    <h3 className="text-purple" style={{ margin: 0 }}>◈ 显存监控</h3>
                    <div className="flex gap-6">
                        <button className="cyber-btn cyber-btn-sm" onClick={() => loadVramInfo(true)} disabled={vramLoading}>
                            {vramLoading ? '⟳' : '↻'} 刷新
                        </button>
                        {isPolling ? (
                            <button className="cyber-btn cyber-btn-sm text-red" onClick={stopVramPolling}>■ 停止监控</button>
                        ) : (
                            <button className="cyber-btn cyber-btn-sm text-green" onClick={startVramPolling}>▶ 实时监控</button>
                        )}
                    </div>
                </div>

                {vramInfo ? (
                    <div>
                        <div className="grid-2-gap-16 mb-16">
                            <div className="config-stat-box">
                                <div className="text-xs text-muted mb-4">GPU 设备</div>
                                <div className="text-base text-orange font-semibold">{vramInfo.gpuName}</div>
                            </div>
                            <div className="config-stat-box">
                                <div className="text-xs text-muted mb-4">显存使用率</div>
                                <div className="text-xl font-bold" style={{ color: usagePct > 80 ? 'var(--neon-red)' : usagePct > 50 ? 'var(--neon-orange)' : 'var(--neon-green)', fontSize: 20 }}>
                                    {vramInfo.usagePercent}%
                                </div>
                            </div>
                        </div>
                        <div className="mb-16">
                            <div className="flex-between text-sm text-secondary mb-4">
                                <span>VRAM</span>
                                <span>{vramInfo.vramUsed}GB / {vramInfo.vramTotal}GB (空闲: {vramInfo.vramFree}GB)</span>
                            </div>
                            <div className="vram-bar">
                                <div className={`vram-bar-fill ${barFillClass}`} style={{ width: `${vramInfo.usagePercent}%` }} />
                                {usagePct > 80 && (
                                    <div className="position-absolute" style={{ right: 8, top: 2, fontSize: 11, color: 'var(--neon-red)', fontWeight: 600, animation: 'pulse 1s infinite' }}>⚠ 高占用</div>
                                )}
                            </div>
                        </div>
                        {vramInfo.ramTotal && (
                            <div className="mb-16">
                                <div className="flex-between text-sm text-secondary mb-4">
                                    <span>RAM</span>
                                    <span>空闲: {vramInfo.ramFree}GB / {vramInfo.ramTotal}GB</span>
                                </div>
                                <div className="ram-bar">
                                    <div className="vram-bar-fill vram-bar-fill-blue" style={{ width: `${((vramInfo.ramTotal - vramInfo.ramFree) / vramInfo.ramTotal * 100).toFixed(1)}%` }} />
                                </div>
                            </div>
                        )}
                        <div className="flex gap-8">
                            <button className="cyber-btn cyber-btn-primary flex-1" onClick={handleFreeMemory} disabled={vramFreeing}>
                                {vramFreeing ? <><span className="cyber-loading"></span> 释放中...</> : '⚡ 完全释放显存'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-20 text-muted">{vramLoading ? '正在检测显存...' : '无法获取显存信息，请确保 ComfyUI 已启动'}</div>
                )}
            </div>

            <div className="cyber-card mt-16">
                <h3 className="text-blue mb-16">⚙ 自动释放配置</h3>
                <p className="text-base text-muted mb-16">当显存占用超过阈值且空闲时间达到设定值时，自动释放显存。</p>
                <div className="grid-3-gap-16 mb-16">
                    <div className="form-group">
                        <label className="flex gap-6 text-secondary text-base">
                            <input type="checkbox" checked={autoFreeConfig.enabled} onChange={e => handleAutoFreeConfigChange('enabled', e.target.checked)} />
                            启用自动释放
                        </label>
                    </div>
                    <div className="form-group">
                        <label className="form-label">空闲时间（秒）</label>
                        <input className="cyber-input input-sm" type="number" value={autoFreeConfig.idleSeconds}
                            onChange={e => handleAutoFreeConfigChange('idleSeconds', parseInt(e.target.value) || 120)}
                            min={10} max={3600} disabled={!autoFreeConfig.enabled}
                            style={{ opacity: autoFreeConfig.enabled ? 1 : 0.5 }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">VRAM阈值（%）</label>
                        <input className="cyber-input input-sm" type="number" value={Math.round(autoFreeConfig.vramThreshold * 100)}
                            onChange={e => handleAutoFreeConfigChange('vramThreshold', (parseInt(e.target.value) || 75) / 100)}
                            min={30} max={99} disabled={!autoFreeConfig.enabled}
                            style={{ opacity: autoFreeConfig.enabled ? 1 : 0.5 }} />
                    </div>
                </div>
                {autoFreeConfig.enabled && (
                    <div className="text-sm text-muted p-8 rounded" style={{ background: 'var(--bg-input)' }}>
                        当前策略：空闲 <span className="text-blue">{autoFreeConfig.idleSeconds}秒</span> 后，
                        若VRAM占用超过 <span className="text-orange">{Math.round(autoFreeConfig.vramThreshold * 100)}%</span>，
                        则自动卸载模型并释放显存
                    </div>
                )}
            </div>
        </>
    );
}
