export default function HistoryTab({ historyData, historyCharId, setHistoryCharId, charactersData, statesData, toBeijingTime }) {
    return (
        <div>
            <div className="flex gap-12 mb-16 items-center flex-wrap">
                <label className="text-base text-muted">选择角色:</label>
                <select className="cyber-select max-w-250" value={historyCharId || ''} onChange={e => setHistoryCharId(e.target.value || null)}>
                    <option value="">-- 请选择 --</option>
                    {charactersData?.characters?.map(c => <option key={c.entityKey} value={c.entityKey}>{c.name} ({c.entityKey})</option>)}
                </select>
                {statesData?.length > 0 && !historyCharId && (
                    <select className="cyber-select max-w-250" onChange={e => setHistoryCharId(e.target.value)}>
                        <option value="">从状态记录中选择...</option>
                        {[...new Set(statesData.map(s => s.characterId))].map(cid => (
                            <option key={cid} value={cid}>{statesData.find(s => s.characterId === cid)?.characterName || cid}</option>
                        ))}
                    </select>
                )}
            </div>
            {!historyData?.length ? (
                <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">📋</div><div>{historyCharId ? '该角色暂无状态历史记录' : '请先选择一个角色查看状态历史'}</div></div>
            ) : (
                <div className="relative" style={{ paddingLeft: 24 }}>
                    <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg, var(--neon-blue), var(--neon-purple), var(--neon-pink))', borderRadius: 1 }} />
                    {historyData.map(record => {
                        const deltaEntries = Object.entries(record.delta || {});
                        return (
                            <div key={record.id} className="relative mb-16">
                                <div style={{ position: 'absolute', left: -18, top: 18, width: 12, height: 12, borderRadius: '50%', background: 'var(--neon-blue)', border: '2px solid var(--bg-secondary)', boxShadow: '0 0 8px rgba(0,200,255,0.4)' }} />
                                <div className="cyber-card" style={{ borderLeft: '3px solid var(--neon-blue)', marginLeft: 8 }}>
                                    <div className="flex-between mb-6">
                                        <div>
                                            <h4 className="text-md font-semibold" style={{ margin: 0 }}>第{record.chapterNumber}章 · {record.characterName || record.characterId}</h4>
                                            <div className="text-sm text-muted">{toBeijingTime(record.updatedAt)}</div>
                                        </div>
                                        <span className="text-sm rounded" style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(0,200,255,0.1)', color: 'var(--neon-cyan)' }}>{deltaEntries.length} 项变更</span>
                                    </div>
                                    {deltaEntries.length > 0 && (
                                        <div className="grid-auto-200">
                                            {deltaEntries.map(([key, change]) => {
                                                const from = change?.from ?? '(无)';
                                                const to = change?.to ?? change;
                                                return (
                                                    <div key={key} className="rounded text-sm p-4" style={{ background: 'var(--bg-secondary)' }}>
                                                        <span className="text-muted">{key}:</span>{' '}
                                                        <span className="text-red">{String(from)}</span>{' → '}
                                                        <span className="text-green">{String(to)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
