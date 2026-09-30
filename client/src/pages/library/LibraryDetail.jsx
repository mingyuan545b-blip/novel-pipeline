/**
 * LibraryDetail — 藏经阁右侧详情面板
 *
 * 相比旧版增加：内容完整度横幅（空壳时直接告诉用户"这条用不了，为什么"），
 * 以及来源作品展示（可追溯这条技法从哪本书提的）。
 */
import { SLOT_LABELS, INJECTION_LABELS, cleanName, DEPT_COLORS } from './useLibraryState';
import { COMPLETENESS } from './libraryConstants';
import s from './library.module.css';

function FieldList({ items, emptyHint, danger }) {
    if (!items || items.length === 0) {
        return <p className={s.fieldEmpty}>{emptyHint}</p>;
    }
    return (
        <ul className={s.fieldList} style={danger ? { color: '#ff6b6b' } : undefined}>
            {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
    );
}

export default function LibraryDetail({ detail: t, editing, setEditing, value, setValue, onSave, onBack, onToggleDisabled, onReset }) {
    if (!t) {
        return (
            <div className={s.emptyDetail}>
                <div className={s.emptyIcon}>📖</div>
                <p>从左侧选一条技法查看详情</p>
                <p className={s.emptySub}>绿色「可直接注入」的条目才有实施规则，能真正指导写作</p>
            </div>
        );
    }
    const meta = COMPLETENESS[t.completeness] || COMPLETENESS.empty;
    const disabled = t._meta && t._meta.auto_disabled;

    const info = [
        { k: '上下文层级', v: SLOT_LABELS[t.context_slot] || t.context_slot },
        { k: '注入点', v: INJECTION_LABELS[t.injection_point] || t.injection_point },
        { k: '适用模式', v: (t.applicable_modes || []).join('、') || '—' },
        { k: '成功率', v: `${(t._meta && t._meta.success_rate) ?? 50}%`, warn: ((t._meta && t._meta.success_rate) ?? 50) < 40 },
        { k: '使用次数', v: `${(t._meta && t._meta.attempts) || 0} 次` },
        { k: '来源', v: t.source_novel || '—' },
    ];

    return (
        <div className={s.detailWrap}>
            <div className={s.detailHead}>
                <div className={s.detailTitleRow}>
                    <button type="button" className={s.linkBtn} onClick={onBack}>← 返回</button>
                    <div className={s.detailActions}>
                        {disabled && <span className={s.badgeDanger}>已禁用</span>}
                        <button type="button" className={s.toolbarBtn} onClick={onToggleDisabled}>
                            {disabled ? '启用' : '禁用'}
                        </button>
                        <button type="button" className={s.toolbarBtn} onClick={onReset}>重置统计</button>
                    </div>
                </div>
                <h3 className={s.detailName}>{t.display_name}</h3>
                <p className={s.detailPath}>
                    {cleanName(t.department)} / {cleanName(t.subcategory)}
                    {t.sourceNovel ? ` · 提取自《${t.sourceNovel}》` : ''}
                </p>
                <div className={s.completenessBanner} style={{ borderColor: meta.color }}>
                    <span className={s.completenessDot} style={{ background: meta.color }} />
                    <b style={{ color: meta.color }}>{meta.label}</b>
                    <span className={s.completenessHint}>{meta.hint}</span>
                </div>
            </div>

            <div className={s.detailBody}>
                <div className={s.infoGrid}>
                    {info.map(row => (
                        <div key={row.k} className={s.infoItem}>
                            <span className={s.infoKey}>{row.k}</span>
                            <span className={s.infoVal} style={row.warn ? { color: '#ffa502' } : undefined} title={row.v}>{row.v}</span>
                        </div>
                    ))}
                </div>

                <div className={s.block}>
                    <h4 className={s.blockTitle}>检索标签</h4>
                    {editing === 'retrieval_tags' ? (
                        <div className={s.editRow}>
                            <input className={s.editInput} value={value} onChange={e => setValue(e.target.value)} />
                            <button type="button" className={s.saveBtn} onClick={() => onSave('retrieval_tags', value.split(',').map(x => x.trim()).filter(Boolean))}>保存</button>
                            <button type="button" className={s.cancelBtn} onClick={() => setEditing(null)}>取消</button>
                        </div>
                    ) : (
                        <div className={s.tagRow}>
                            {(t.retrieval_tags || []).length === 0
                                ? <span className={s.fieldEmpty}>暂无标签</span>
                                : (t.retrieval_tags || []).map((tag, i) => (
                                    <span key={i} className={s.tagChip} style={{ color: DEPT_COLORS[t.department] || '#888' }}>{tag}</span>
                                ))}
                            <button type="button" className={s.linkBtn} onClick={() => { setEditing('retrieval_tags'); setValue((t.retrieval_tags || []).join(', ')); }}>编辑</button>
                        </div>
                    )}
                </div>

                {[['implementation_rules', '实施规则', '这条是空壳：没有可执行的规则，注入时只能给模型一个名词'],
                  ['anti_patterns', '反模式（避免）', '暂无反模式']].map(([field, title, emptyHint]) => (
                    <div key={field} className={s.block}>
                        <h4 className={s.blockTitle}>{title}</h4>
                        {editing === field ? (
                            <div>
                                <textarea className={s.editArea} rows={5} value={value} onChange={e => setValue(e.target.value)} />
                                <div className={s.editRow}>
                                    <button type="button" className={s.saveBtn} onClick={() => onSave(field, value.split('\n').filter(Boolean))}>保存</button>
                                    <button type="button" className={s.cancelBtn} onClick={() => setEditing(null)}>取消</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <FieldList items={t[field]} emptyHint={emptyHint} danger={field === 'anti_patterns'} />
                                <button type="button" className={s.linkBtn}
                                    onClick={() => { setEditing(field); setValue((t[field] || []).join('\n')); }}>
                                    手动补充
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
