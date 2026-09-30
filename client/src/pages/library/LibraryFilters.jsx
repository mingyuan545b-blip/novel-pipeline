/**
 * LibraryFilters — 藏经阁筛选条（完整度 chips + 来源筛选 + 搜索）
 *
 * 「来源筛选」用于回答"前面那本提取过什么"：选中某本书后只显示它贡献的技法。
 */
import { COMPLETENESS_FILTERS, cleanDept } from './libraryConstants';
import s from './library.module.css';

export default function LibraryFilters({
    completeness, onCompleteness, sourceFilter, onSource, sources, modeFilter, onMode, keyword, onKeyword, onSearch,
}) {
    return (
        <div className={s.filterBar}>
            <div className={s.chipGroup}>
                {COMPLETENESS_FILTERS.map(f => (
                    <button key={f.key || 'all'} type="button"
                        className={completeness === f.key ? s.chipOn : s.chipOff}
                        onClick={() => onCompleteness(f.key)}>
                        {f.label}
                    </button>
                ))}
            </div>
            <select className={s.select} value={sourceFilter} onChange={e => onSource(e.target.value)} title="只看从某本小说提取的技法">
                <option value="">全部来源</option>
                {(sources || []).map(src => (
                    <option key={src.novel} value={src.novel}>
                        {src.novel}（{src.total}条{src.full ? ` · 完整${src.full}` : ''}）
                    </option>
                ))}
            </select>
            <select className={s.select} value={modeFilter} onChange={e => onMode(e.target.value)}>
                <option value="">全部模式</option>
                <option value="novel">长篇</option>
                <option value="shuangwen">爽文</option>
                <option value="tomato-short">番茄短篇</option>
            </select>
            <div className={s.searchWrap}>
                <input className={s.searchInput} value={keyword} placeholder="搜索技法名/标签…"
                    onChange={e => onKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch()} />
                <button type="button" className={s.searchBtn} onClick={onSearch}>搜索</button>
            </div>
            {sourceFilter && (
                <button type="button" className={s.clearFilter} onClick={() => onSource('')}>
                    ✕ 取消来源「{cleanDept(sourceFilter).substring(0, 12)}…」
                </button>
            )}
        </div>
    );
}
