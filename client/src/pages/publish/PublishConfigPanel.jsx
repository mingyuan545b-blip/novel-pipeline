import { MULTI_PLATFORMS, defaultConfig } from './publishConstants';
import PlatformDetailContent from './PlatformDetailContent';

export default function PublishConfigPanel({
    multiConfigs, setMultiConfigs, multiStatuses, multiLogs,
    expandedPlatform, setExpandedPlatform,
    loginChecking,
    onCheckLogin, onOpenWriter, onOpenEditor,
    onPublish, onStop, onUpdate, onCloseBrowser,
    getLoginStatusBadge
}) {
    return (
        <div>
            <div className="platform-btn-group">
                {MULTI_PLATFORMS.map(p => {
                    const isRunning = multiStatuses[p.key]?.running;
                    const loginBadge = getLoginStatusBadge(p.key);
                    return (
                        <button key={p.key}
                            className={`cyber-btn platform-btn ${expandedPlatform === p.key ? 'cyber-btn-primary' : ''}`}
                            onClick={() => setExpandedPlatform(p.key)}
                            style={expandedPlatform === p.key ? { borderColor: p.color, color: p.color } : undefined}>
                            {p.icon} {p.name}
                            {isRunning && <span className="platform-indicator platform-indicator-running" />}
                            {!isRunning && loginBadge.text !== '未检测' && (
                                <span className="platform-indicator" style={{ background: loginBadge.color }} />
                            )}
                        </button>
                    );
                })}
            </div>
            {MULTI_PLATFORMS.map(p => {
                if (expandedPlatform !== p.key) return null;
                return (
                    <PlatformDetailContent key={p.key} platform={p}
                        config={multiConfigs[p.key] || { ...defaultConfig }}
                        status={multiStatuses[p.key] || {}}
                        logs={multiLogs[p.key] || []}
                        loginChecking={loginChecking} loginBadge={getLoginStatusBadge(p.key)}
                        setMultiConfigs={setMultiConfigs}
                        onCheckLogin={onCheckLogin} onOpenWriter={onOpenWriter}
                        onOpenEditor={onOpenEditor} onPublish={onPublish}
                        onStop={onStop} onUpdate={onUpdate} onCloseBrowser={onCloseBrowser} />
                );
            })}
        </div>
    );
}
