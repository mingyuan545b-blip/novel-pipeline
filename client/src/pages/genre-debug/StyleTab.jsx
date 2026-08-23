import { STYLE_FIELDS } from './constants';
import c from './common.module.css';
import e from './editors.module.css';

export default function StyleTab({ styleProfile, editData, onChange, pacingConfig, isLoading }) {
    const sp = editData?.styleProfile || styleProfile;
    const hasPacing = pacingConfig && Object.keys(pacingConfig).length > 0;

    return (
        <div>
            {isLoading && <div className={c.loadingCenter}><span className="cyber-loading"></span> 加载风格配置...</div>}
            {!isLoading && (
                <>
                    <div className={`${c.warningBanner} ${c.bannerOrange}`}>
                        🎨 <strong>风格配置</strong>——题材特有的写作风格规则，控制视角、对话、行为、基调、标题等维度的写作方式。
                    </div>

                    <div className={c.listTitle} style={{ color: 'var(--neon-orange)', marginBottom: 10 }}>
                        🎨 风格字段
                    </div>

                    {STYLE_FIELDS.map(field => (
                        <div key={field.key} className={`${c.cardItem} ${e.styleFieldCard}`}>
                            <div className={e.styleFieldHeader}>
                                <span className={e.styleFieldIcon}>{field.icon}</span>
                                <span className={e.styleFieldName}>{field.label}</span>
                                <span className={e.styleFieldKey}>({field.key})</span>
                            </div>
                            <div className={e.styleFieldDesc}>{field.desc}</div>
                            <textarea
                                value={sp?.[field.key] || ''}
                                onChange={ev => onChange(field.key, ev.target.value)}
                                rows={2}
                                className={`${c.inputField} ${e.styleTextarea}`}
                            />
                        </div>
                    ))}

                    {hasPacing && (
                        <div className={e.pacingSection}>
                            <div className={e.pacingTitle}>⏱ 节奏配置（只读）</div>
                            <pre className={c.preBlock}>
                                {JSON.stringify(pacingConfig, null, 2)}
                            </pre>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
