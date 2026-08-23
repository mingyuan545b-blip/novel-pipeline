import c from './common.module.css';
import e from './editors.module.css';

export default function ConstraintTab({ constraints, editData, requiredIds, incompatibleIds, onChange, onAdd, onRemove, isLoading, isError, error }) {
    const items = editData?.constraints || constraints;

    return (
        <div>
            {isLoading && <div className={c.loadingCenter}><span className="cyber-loading"></span> 加载约束词...</div>}
            {!isLoading && isError && (
                <div className={c.errorCenter}>加载失败: {error?.response?.data?.error || error?.message}</div>
            )}
            {!isLoading && !isError && (
                <>
                    <div className={`${c.warningBanner} ${c.bannerRed}`}>
                        ⚠️ <strong>题材铁律</strong>——以下约束词在Pipeline运行时强制注入所有Agent的提示词中。违反任何一条即判定不合格！
                        修改后点击底部"保存到内存"按钮立即生效，无需重启服务器。
                    </div>

                    <div className={c.listHeader}>
                        <div className={c.listTitle} style={{ color: 'var(--neon-purple)' }}>
                            🔒 约束词列表 ({items.length} 条)
                        </div>
                        <button className={c.btnAdd} onClick={onAdd}>+ 添加约束</button>
                    </div>

                    {items.map((item, index) => {
                        const isRequired = requiredIds.includes(item.id);
                        const isIncompatible = incompatibleIds.includes(item.id);
                        const borderColor = isRequired ? 'var(--neon-green)' : isIncompatible ? 'var(--neon-red)' : 'var(--neon-purple)';

                        return (
                            <div key={item.id || index} className={c.cardItem} style={{ borderLeft: `3px solid ${borderColor}` }}>
                                <div className={e.constraintRow}>
                                    <div className={e.constraintFields}>
                                        <div className={e.constraintIdRow}>
                                            <input value={item.id || ''} readOnly className={c.inputId} />
                                            {isRequired && <span className={e.tagRequired}>🔒必须</span>}
                                            {isIncompatible && <span className={e.tagIncompatible}>🚫移除</span>}
                                        </div>
                                        <div className={e.constraintFieldRow}>
                                            <span className={e.constraintLabel}>标签:</span>
                                            <input
                                                value={item.label || ''}
                                                onChange={ev => onChange(index, 'label', ev.target.value)}
                                                className={`${c.inputField} ${c.inputFieldPrimary}`}
                                                style={{ flex: 1 }}
                                            />
                                        </div>
                                        <div className={e.constraintFieldRow}>
                                            <span className={`${e.constraintLabel} ${e.constraintLabelTop}`}>描述:</span>
                                            <textarea
                                                value={item.desc || ''}
                                                onChange={ev => onChange(index, 'desc', ev.target.value)}
                                                rows={2}
                                                className={c.inputField}
                                                style={{ flex: 1 }}
                                            />
                                        </div>
                                    </div>
                                    <button className={c.btnRemove} onClick={() => onRemove(index)}>✕</button>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}
