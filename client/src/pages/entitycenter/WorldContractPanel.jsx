/**
 * WorldContractPanel.jsx — 世界通行契约（独立栏：每个世界一行，可编辑）
 *
 * 把"带出策略 / 离开方式 / 渠道标签"按世界独立成栏，避免堆在世界列表底部翻找。
 * 依据：docs/design/实体中心-副本归属与带出机制.md
 */
import { useState } from 'react';
import { CARRY_OUT_POLICIES, WORLD_TYPES, getCarryOutLabel } from './worldConstants';
import { contractOf } from './worldContractUtils';

function ContractRow({ world, contract, count, onSave }) {
    const [policy, setPolicy] = useState(contract.carryOutPolicy);
    const [channelTag, setChannelTag] = useState(contract.channelTag);
    const [exitMethod, setExitMethod] = useState(contract.exitMethod);
    const [saving, setSaving] = useState(false);

    const dirty = policy !== contract.carryOutPolicy
        || channelTag !== contract.channelTag
        || exitMethod !== contract.exitMethod;
    const needsChannel = policy !== 'native' && policy !== 'locked';

    const handleSave = async () => {
        setSaving(true);
        await onSave(world.id, { carryOutPolicy: policy, channelTag, exitMethod });
        setSaving(false);
    };

    return (
        <div className="ws-contract-row">
            <div className="ws-contract-head">
                <span className="ws-contract-name">
                    {WORLD_TYPES[world.worldType]?.icon || '🌍'} {world.name}
                    <span className="ws-contract-count">归属 {count}</span>
                </span>
                <span className="ws-contract-policy">{getCarryOutLabel(policy)}</span>
            </div>
            <div className="ws-contract-fields">
                <label className="ws-contract-field">带出策略
                    <select value={policy} onChange={e => setPolicy(e.target.value)} aria-label="带出策略">
                        {Object.values(CARRY_OUT_POLICIES).map(p => (
                            <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                        ))}
                    </select>
                </label>
                <label className="ws-contract-field">离开方式
                    <input value={exitMethod} onChange={e => setExitMethod(e.target.value)} placeholder="如 自然离开 / 通关传送" />
                </label>
                <label className="ws-contract-field">渠道标签{needsChannel ? ' *' : ''}
                    <input value={channelTag} onChange={e => setChannelTag(e.target.value)}
                        placeholder={needsChannel ? '必填：出副本凭据' : '可选'} />
                </label>
                <button className="cyber-btn cyber-btn-sm" disabled={!dirty || saving} onClick={handleSave}>
                    {saving ? '保存中' : '保存'}
                </button>
            </div>
            {needsChannel && !channelTag && (
                <div className="ws-contract-warn">⚠ 该策略下缺渠道标签，出副本会被判违规</div>
            )}
        </div>
    );
}

export default function WorldContractPanel({ worlds = [], projectWorlds = [], worldEntities = {}, onSave }) {
    if (!worlds.length) return <div className="cb-empty">暂无世界，先在「世界与归属」添加或补提取</div>;
    return (
        <div className="ws-contract-list">
            {worlds.map(w => (
                <ContractRow key={w.id} world={w}
                    contract={contractOf(projectWorlds, w)}
                    count={(worldEntities[w.id] || []).length}
                    onSave={onSave} />
            ))}
        </div>
    );
}
