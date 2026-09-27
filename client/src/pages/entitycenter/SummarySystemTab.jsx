import { useState, useMemo } from 'react';
import CharSummaryCard, { parseCharacterBlock } from './CharSummaryCard';
import './categoryBrowser.css';
import { decorateBlocks, filterBlocks, groupBlocks, roleCounts } from './summaryUtils';
import { GROUP_META } from './characterListUtils';

const ROLE_CHIPS = [
    { key: 'all', label: '全部' },
    { key: 'protagonist', label: '主角' },
    { key: 'supporting', label: '配角' },
    { key: 'npc', label: 'NPC' },
];

export function SummaryTab({ summaryCharId, setSummaryCharId, selectedChapter, setSelectedChapter, characters, summaryData, csMeta, chapterOptions }) {
    const [query, setQuery] = useState('');
    const [role, setRole] = useState('all');
    const dataSource = summaryData?.source || 'unknown';
    const isEntityFallback = dataSource === 'entity';

    const blocks = useMemo(
        () => decorateBlocks(parseCharacterBlock(summaryData?.detailedSummary || ''), characters),
        [summaryData, characters]
    );
    const counts = useMemo(() => roleCounts(blocks), [blocks]);
    const shown = useMemo(() => filterBlocks(blocks, { query, role }), [blocks, query, role]);
    const groups = useMemo(() => groupBlocks(shown), [shown]);
    const withData = blocks.filter(b => b.filled > 0).length;

    return (
        <div>
            <div className="ec-flex ec-gap-12 ec-mb-12 ec-items-center ec-flex-wrap">
                <label className="ec-text-13 ec-text-muted">角色筛选:</label>
                <select className="cyber-select ec-select-max-200" value={summaryCharId || ''} onChange={e => setSummaryCharId(e.target.value || null)}>
                    <option value="">全部角色</option>
                    {characters.map(c => {
                        const cName = c._adapted?.name || c.name || c.id;
                        return <option key={c.id} value={c.id}>{cName}</option>;
                    })}
                </select>
                <label className="ec-text-13 ec-text-muted">章节筛选:</label>
                <select className="cyber-select ec-select-max-150" value={selectedChapter || ''} onChange={e => setSelectedChapter(e.target.value ? parseInt(e.target.value) : null)}>
                    <option value="">当前章节 (第{csMeta?.currentChapter || '?'}章)</option>
                    {(csMeta?.chapterOptions || chapterOptions || []).map(n => <option key={n} value={n}>第{n}章</option>)}
                </select>
                {isEntityFallback && (
                    <span className="ec-badge ec-badge-info" title="KV状态数据为空，当前显示来自实体注册表的基础数据">数据源: 实体注册表</span>
                )}
                {!isEntityFallback && dataSource === 'kv' && (
                    <span className="ec-badge ec-badge-green" title="数据来自章节状态追踪系统">数据源: 状态追踪</span>
                )}
            </div>

            {blocks.length > 0 && (
                <>
                    <div className="cb-tools ec-mb-10">
                        <input className="cb-search" placeholder="搜索角色 / 摘要内容…" value={query}
                            onChange={e => setQuery(e.target.value)} aria-label="搜索摘要" />
                        <span className="cb-count">{shown.length}/{blocks.length} · {withData} 个有详情</span>
                    </div>
                    <div className="cb-chips ec-mb-12">
                        {ROLE_CHIPS.map(c => (
                            <button key={c.key} className={`cb-chip ${role === c.key ? 'cb-chip-on' : ''}`} onClick={() => setRole(c.key)}>
                                {c.key !== 'all' && <span className="cb-chip-dot" style={{ background: GROUP_META[c.key].color }} />}
                                {c.label}{c.key === 'all' ? ` ${blocks.length}` : ` ${counts[c.key]}`}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {shown.length === 0 ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon" aria-hidden="true">📋</div>
                    <div>{blocks.length === 0 ? '暂无角色摘要数据' : '没有匹配的摘要（试试清空筛选）'}</div>
                    <div className="ec-text-12 ec-text-muted ec-mt-8">角色摘要在大纲生成和 Pipeline 运行时自动构建</div>
                </div>
            ) : (
                groups.map(g => (
                    <section key={g.role} className="cb-group">
                        <div className="cb-group-head">
                            <span className="cb-group-dot" style={{ background: g.meta.color }} />
                            <span className="cb-group-name" style={{ color: g.meta.color }}>{g.meta.label}</span>
                            <span className="cb-group-count">{g.members.length}</span>
                            <span className="cb-group-hint">{g.meta.hint}</span>
                        </div>
                        <div className="ec-flex-col ec-gap-12">
                            {g.members.map((block, i) => <CharSummaryCard key={block.name} block={block} index={i} />)}
                        </div>
                    </section>
                ))
            )}

            {summaryData?.briefSummary && blocks.length > 0 && (
                <details className="ec-mt-16">
                    <summary className="ec-text-12 ec-text-muted ec-cursor-pointer">查看原始简要摘要</summary>
                    <div className="cyber-card ec-mt-8">
                        <div className="ec-summary-content ec-text-12">{summaryData.briefSummary}</div>
                    </div>
                </details>
            )}
        </div>
    );
}

export default SummaryTab;
