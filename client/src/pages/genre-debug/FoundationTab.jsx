import c from './common.module.css';
import e from './editors.module.css';

export default function FoundationTab({ foundationRules, editData, onChange, onAdd, onRemove, isLoading }) {
    const items = editData?.foundationRules || foundationRules;

    return (
        <div>
            {isLoading && <div className={c.loadingCenter}><span className="cyber-loading"></span> 加载基础规则...</div>}
            {!isLoading && (
                <>
                    <div className={`${c.warningBanner} ${c.bannerBlue}`}>
                        📐 <strong>基础规则</strong>——题材特有的写作节奏、爽点密度、文风等基础规则，注入大纲生成和章节写作的提示词中。
                    </div>

                    <div className={c.listHeader}>
                        <div className={c.listTitle} style={{ color: 'var(--neon-blue)' }}>
                            📐 基础规则列表 ({items.length} 条)
                        </div>
                        <button className={c.btnAdd} onClick={onAdd}>+ 添加规则</button>
                    </div>

                    {items.map((rule, index) => (
                        <div key={index} className={`${c.cardItem} ${e.foundationItem}`}>
                            <span className={e.foundationIndex}>{index + 1}.</span>
                            <textarea
                                value={rule || ''}
                                onChange={ev => onChange(index, ev.target.value)}
                                rows={1}
                                className={c.inputField}
                                style={{ flex: 1 }}
                            />
                            <button className={c.btnRemove} onClick={() => onRemove(index)}>✕</button>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
