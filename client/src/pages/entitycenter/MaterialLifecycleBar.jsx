/**
 * MaterialLifecycleBar.jsx — 卡片上的生命周期控制（归档/报废 + 章节区间）
 * 单点写入**被加载的** materials（同名匹配），避免双写混乱。
 */
import { useState } from 'react';
import { lifecycleLabel, isRetired } from './lifecycleUi';

export default function MaterialLifecycleBar({ material, onPatch }) {
    const [from, setFrom] = useState(material?.activeFromChapter || '');
    const [to, setTo] = useState(material?.activeToChapter || '');
    const [open, setOpen] = useState(false);

    if (!material) {
        return <div className="mlb-note">素材库暂无同名条目（P0-3 统一源后可直接管理）</div>;
    }
    const retired = isRetired(material);
    return (
        <div className="mlb">
            <span className="mlb-label">生命周期：<b>{lifecycleLabel(material)}</b></span>
            <button className="cyber-btn cyber-btn-sm cyber-btn-outline"
                onClick={() => onPatch(material.id, retired ? { archived: false, state: 'active' } : { archived: true, state: 'retired' })}>
                {retired ? '恢复' : '归档/报废'}
            </button>
            <button className="cyber-btn cyber-btn-sm cyber-btn-outline" onClick={() => setOpen(!open)}>
                {open ? '收起区间' : '章节区间'}
            </button>
            {open && (
                <span className="mlb-range">
                    第<input className="mlb-input" value={from} onChange={e => setFrom(e.target.value)} placeholder="起" />章 –
                    第<input className="mlb-input" value={to} onChange={e => setTo(e.target.value)} placeholder="止" />章
                    <button className="cyber-btn cyber-btn-sm"
                        onClick={() => onPatch(material.id, { activeFromChapter: from || null, activeToChapter: to || null })}>保存</button>
                </span>
            )}
        </div>
    );
}
