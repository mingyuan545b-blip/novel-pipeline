/**
 * OwnershipSection.jsx — 角色副本归属 + 带出判定（后端为准）
 *
 * 让"这个角色属于哪个副本的哪个位置""能不能带出、需要什么凭据"在 UI 上可见；
 * 判定调用后端 /worldscope/:projectId/carry-out-check（与 carryOutGate 同一实现）。
 * 依据：docs/design/实体中心-副本归属与带出机制.md
 */
import { useState } from 'react';
import { pipelineApi } from '../../services/api';
import { getCarryOutLabel } from './worldConstants';
import logger from '../../shared/logger';

function Chip({ label, value, color }) {
    if (!value) return null;
    return (
        <span className="ec-badge" style={{ color: color || 'var(--neon-cyan)', borderColor: 'currentColor' }}>
            {label}: {value}
        </span>
    );
}

export default function OwnershipSection({ projectId, adapted }) {
    const [result, setResult] = useState(null);
    const [checking, setChecking] = useState(false);
    if (!adapted) return null;

    const scopeWorldId = adapted.scopeWorldId || 'main-world';
    const locationSlot = adapted.locationSlot || '';
    const bindMedium = adapted.bindMedium || '';
    const isMain = scopeWorldId === 'main-world';

    const handleCheck = async () => {
        setChecking(true);
        setResult(null);
        try {
            const res = await pipelineApi.carryOutCheck(projectId, {
                worldId: scopeWorldId, entityName: adapted.name
            });
            setResult(res.data?.data || null);
        } catch (err) {
            logger.error('Ownership', 'carry-out check failed:', err.message);
            setResult({ error: err.response?.data?.error || err.message });
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="cyber-card ec-border-cyan">
            <h4 className="ec-section-title ec-color-cyan">
                <span aria-hidden="true">🧭</span> 副本归属 / 带出
            </h4>
            <div className="ec-flex ec-gap-6 ec-flex-wrap ec-mb-8">
                <Chip label="归属" value={isMain ? '主世界' : scopeWorldId} color="var(--neon-cyan)" />
                <Chip label="位置" value={locationSlot} color="var(--neon-purple)" />
                <Chip label="绑定媒介" value={bindMedium} color="var(--neon-orange)" />
                {!locationSlot && !bindMedium && isMain && (
                    <span className="ec-text-12 ec-text-muted">主世界常驻 · 无副本绑定</span>
                )}
            </div>
            <div className="ec-flex ec-items-center ec-gap-8">
                <button className="cyber-btn cyber-btn-sm cyber-btn-outline" onClick={handleCheck} disabled={checking}>
                    {checking ? '判定中...' : '试算带出'}
                </button>
                {result && !result.error && (
                    <span className={`ec-text-12 ${result.evaluation?.allowed ? 'ec-color-green' : 'ec-color-orange'}`}>
                        {result.evaluation?.allowed ? '✅ 允许带出' : '⛔ 不可带出'} · 策略「{getCarryOutLabel(result.world?.carryOutPolicy)}」
                        {result.evaluation?.reason ? ` · ${result.evaluation.reason}` : ''}
                    </span>
                )}
                {result?.error && <span className="ec-text-12 ec-color-orange">判定失败: {result.error}</span>}
            </div>
            {result && !result.error && (
                <div className="ec-text-11 ec-text-muted ec-mt-4">
                    渠道标签: {result.channelTag || '未定义'} · 世界渠道: {result.world?.channelTag || '（未设置）'}
                    {result.channel && !result.channel.valid ? ' · ⚠ 该策略要求渠道标签' : ''}
                </div>
            )}
        </div>
    );
}
