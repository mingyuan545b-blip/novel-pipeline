/**
 * ProjectSettingForm — 全书设定面板（类型 / 走向 / 风格 / 目标）
 *
 * 类型(genre)只读：它驱动题材插件、约束链与实体 schema，施工中改动会让既有章节失配。
 */
import { STYLE_FIELDS, WORD_FIELDS } from './storyBibleConstants';
import s from './storyBible.module.css';

function Row({ label, hint, children }) {
    return (
        <div className={s.row}>
            <label className={s.rowLabel}>{label}{hint && <span className={s.rowHint}>{hint}</span>}</label>
            <div className={s.rowBody}>{children}</div>
        </div>
    );
}

export default function ProjectSettingForm({ st }) {
    const d = st.draft;
    if (!d) return <section className={s.card}><h3 className={s.cardTitle}>全书设定</h3><p className={s.muted}>请先选择一个项目</p></section>;
    const p = st.project || {};
    return (
        <section className={s.card}>
            <h3 className={s.cardTitle}>全书设定（类型 / 走向 / 风格）</h3>

            <Row label="作品名"><input className={s.input} value={d.name} onChange={e => st.setField('name', e.target.value)} /></Row>

            <Row label="类型" hint="题材插件决定约束与实体结构，施工中不可改">
                <span className={s.readonly}>{p.genre || '—'}</span>
                <span className={s.readonlySub}>子类型（分支）</span>
                <input className={s.input} value={d.subGenre} onChange={e => st.setField('subGenre', e.target.value)} />
            </Row>

            <Row label="题材画像" hint="如 武侠 / 都市 / 科幻，影响素材与风格模板">
                <input className={s.input} value={d.genreProfile} onChange={e => st.setField('genreProfile', e.target.value)} />
            </Row>

            <Row label="目标章数 / 目标字数" hint="影响停机条件；改后对后续生效">
                <input className={s.inputSm} type="number" value={d.targetChapters} onChange={e => st.setField('targetChapters', e.target.value)} />
                <span className={s.unit}>章</span>
                <input className={s.inputSm} type="number" value={d.targetWordCount} onChange={e => st.setField('targetWordCount', e.target.value)} />
                <span className={s.unit}>字</span>
            </Row>

            <Row label="走向 / 剧情主线" hint="世界观、力量体系、人物关系与分章规划都写这里；后续章节的规划会读它">
                <textarea className={s.textareaLg} rows={12} value={d.description} onChange={e => st.setField('description', e.target.value)} />
                <p className={s.counter}>{d.description.length} / 10000 字</p>
            </Row>

            <h4 className={s.subTitle}>风格画像</h4>
            {STYLE_FIELDS.map(f => (
                <Row key={f.key} label={f.label} hint={f.hint}>
                    {f.long
                        ? <textarea className={s.textarea} rows={3} value={d.style[f.key] || ''} onChange={e => st.setStyle(f.key, e.target.value)} />
                        : <input className={s.input} value={d.style[f.key] || ''} onChange={e => st.setStyle(f.key, e.target.value)} />}
                </Row>
            ))}

            <h4 className={s.subTitle}>字数配置（影响执笔长度门禁）</h4>
            <div className={s.wordGrid}>
                {WORD_FIELDS.map(f => (
                    <div key={f.key} className={s.wordCell}>
                        <span className={s.cellKey}>{f.label}</span>
                        <input className={s.inputSm} type="number" value={d.word[f.key] || 0} onChange={e => st.setWord(f.key, e.target.value)} />
                    </div>
                ))}
            </div>

            <div className={s.actions}>
                <button type="button" className={s.primaryBtn} onClick={st.save} disabled={st.saving}>
                    {st.saving ? '保存中…' : '保存全书设定'}
                </button>
                <button type="button" className={s.ghostBtn} onClick={st.reset} disabled={st.saving}>放弃修改</button>
                {st.notice && <span className={s.notice}>{st.notice}</span>}
            </div>
        </section>
    );
}
