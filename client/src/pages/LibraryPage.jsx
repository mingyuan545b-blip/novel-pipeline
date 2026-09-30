/**
 * LibraryPage — 藏经阁（写作技法库）
 *
 * 2026-10-01 重设计要点（用户反馈："很多东西没数据就占个位置，我都不知道哪些有、哪些是空的"）：
 *   1. 顶部数据条：完整 / 部分 / 空壳 一眼可见，点数字即筛选
 *   2. 条目徽标：每条直接标出"3条规则"/"空壳"，空壳降透明度，绿色才值得点
 *   3. 「按来源」视图：每本提取过的书一张卡，回答"前面那本提取过什么"
 *   4. 默认排序与视图：有内容的优先、按来源开局
 * 状态与数据在 useLibraryState；树/筛选/统计为纯函数在 libraryTreeBuild。
 */
import useLibraryState from './library/useLibraryState';
import { VIEW_TABS } from './library/libraryConstants';
import LibraryStatsBar from './library/LibraryStatsBar';
import LibraryFilters from './library/LibraryFilters';
import LibraryTree from './library/LibraryTree';
import SourceList from './library/SourceList';
import TechListItem from './library/TechListItem';
import LibraryDetail from './library/LibraryDetail';
import FeedbackPanel from './library/FeedbackPanel';
import ExtractDialog from './library/ExtractDialog';
import useExtractState from './library/useExtractState';
import s from './library/library.module.css';

export default function LibraryPage() {
    const st = useLibraryState();
    const extractState = useExtractState({ onFinished: () => st.reload?.() });
    const { counts, filters, setFilter } = st;

    return (
        <div className={s.pageContainer}>
            <header className={s.pageHead}>
                <div>
                    <h2 className={s.pageTitle}>📚 藏经阁</h2>
                    <p className={s.pageSub}>
                        写作技法知识库 · {counts.total} 条技法 · {st.sources.length} 个提取来源
                        {filters.completeness || filters.source ? ' · 已筛选' : ''}
                    </p>
                </div>
                <div className={s.headActions}>
                    <button type="button" className={s.primaryBtn} onClick={() => extractState.setOpen(true)}>⬆ 一键提取</button>
                    <button type="button" className={s.toolbarBtn} onClick={st.expandAll}>展开全部</button>
                    <button type="button" className={s.toolbarBtn} onClick={st.collapseAll}>折叠全部</button>
                </div>
            </header>

            <LibraryStatsBar counts={counts} sourceCount={st.sources.length}
                disabled={st.stats?.disabled} onPick={(v) => setFilter('completeness', v)} />

            <LibraryFilters
                completeness={filters.completeness} onCompleteness={(v) => setFilter('completeness', v)}
                sourceFilter={filters.source} onSource={(v) => setFilter('source', v)} sources={st.sources}
                modeFilter={filters.mode} onMode={(v) => setFilter('mode', v)}
                keyword={st.searchQuery} onKeyword={st.setSearchQuery} onSearch={st.doSearch} />

            {st.stats?.disabled > 0 && (
                <div className={s.warnBanner}>⚠ {st.stats.disabled} 条技法因成功率过低已被自动禁用</div>
            )}

            <div className={s.layout}>
                <section className={s.leftPanel}>
                    <div className={s.viewTabs}>
                        {VIEW_TABS.map(tab => (
                            <button key={tab.key} type="button"
                                className={st.viewMode === tab.key ? s.tabOn : s.tabOff}
                                onClick={() => st.setViewMode(tab.key)}>{tab.label}</button>
                        ))}
                    </div>

                    {st.showSearch ? (
                        <div className={s.searchPanel}>
                            <div className={s.searchHead}>
                                <span>搜索结果（{st.searchResults.length}）</span>
                                <button type="button" className={s.linkBtn} onClick={st.closeSearch}>✕ 关闭</button>
                            </div>
                            {st.searchResults.length === 0
                                ? <div className={s.emptyTip}>没有匹配的技法</div>
                                : st.searchResults.map(r => (
                                    <TechListItem key={r.id} tech={r} selected={st.selectedTech === r.id}
                                        onClick={() => st.handleSelectTech(r.id)} />
                                ))}
                        </div>
                    ) : st.viewMode === 'source' ? (
                        <SourceList sources={st.sources} active={filters.source} loading={st.sourcesLoading}
                            onPick={(v) => setFilter('source', v)} />
                    ) : (
                        <LibraryTree viewMode={st.viewMode} treeData={st.treeData} depthTree={st.depthTree}
                            expandedNodes={st.expandedNodes} toggleNode={st.toggleNode}
                            selectedTech={st.selectedTech} onSelect={st.handleSelectTech} />
                    )}
                </section>

                <section className={s.rightPanel}>
                    <LibraryDetail detail={st.techDetail} editing={st.editingField} setEditing={st.setEditingField}
                        value={st.editValue} setValue={st.setEditValue} onSave={st.handleSaveField}
                        onBack={() => { st.handleSelectTech(null); }}
                        onToggleDisabled={() => st.handleToggleDisabled(st.selectedTech, st.techDetail?._meta?.auto_disabled)}
                        onReset={() => st.handleResetMeta(st.selectedTech)} />
                </section>
            </div>

            <ExtractDialog state={extractState} />
            <FeedbackPanel feedbackData={st.feedbackData} projectId={st.currentProject?.id} onRefresh={st.loadFeedback} />
        </div>
    );
}
