import CharSummaryCard, { parseCharacterBlock } from './CharSummaryCard';

export function SummaryTab({ summaryCharId, setSummaryCharId, selectedChapter, setSelectedChapter, characters, summaryData, csMeta, chapterOptions }) {
    const dataSource = summaryData?.source || 'unknown';
    const isEntityFallback = dataSource === 'entity';
    const charBlocks = parseCharacterBlock(summaryData?.detailedSummary || '');

    return (
        <div>
            <div className="ec-flex ec-gap-12 ec-mb-16 ec-items-center ec-flex-wrap">
                <label className="ec-text-13 ec-text-muted">角色筛选:</label>
                <select className="cyber-select ec-select-max-200" value={summaryCharId || ''} onChange={e => setSummaryCharId(e.target.value || null)}>
                    <option value="">全部角色</option>
                    {characters.map(c => {
                        const cName = c._adapted?.name || c.name || c.id;
                        return <option key={c.id} value={c.id}>{cName}</option>;
                    })}
                </select>
                <label className="ec-text-13 ec-text-muted ec-ml-12">章节筛选:</label>
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

            {charBlocks.length > 0 ? (
                <div className="ec-flex-col ec-gap-12">
                    {charBlocks.map((block, i) => (
                        <CharSummaryCard key={block.name} block={block} index={i} />
                    ))}
                </div>
            ) : (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon" aria-hidden="true">📋</div>
                    <div>暂无角色摘要数据</div>
                    <div className="ec-text-12 ec-text-muted ec-mt-8">角色摘要在大纲生成和Pipeline运行时自动构建</div>
                </div>
            )}

            {summaryData?.briefSummary && charBlocks.length > 0 && (
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