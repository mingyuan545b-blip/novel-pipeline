/**
 * CharacterSettingPanel — 角色设定：方言 / 语体 / 性格 / 背景
 *
 * 左侧角色列表（可搜）、右侧编辑表单。保存写入素材库（materials），
 * 后续章节的执笔人与意图规划会读到这里改过的值。
 */
import { INTENSITY_OPTIONS, roleLabel, roleColor, charSummary, hasLanguageProfile, asText } from './storyBibleConstants';
import s from './storyBible.module.css';

function Field({ label, hint, children }) {
    return (
        <div className={s.fieldRow}>
            <label className={s.fieldLabel}>{label}{hint && <span className={s.rowHint}>{hint}</span>}</label>
            <div className={s.fieldBody}>{children}</div>
        </div>
    );
}

/** 方言 / 语体：可下拉选已有，也可手输（后端就是字符串字段） */
function PresetSelect({ value, onChange, options, placeholder, valueKey }) {
    const listId = `sb-preset-${valueKey}`;
    return (
        <div className={s.presetWrap}>
            <input className={s.input} list={listId} value={value} placeholder={placeholder}
                onChange={e => onChange(e.target.value)} />
            <datalist id={listId}>
                {(options || []).map(o => <option key={o[valueKey]} value={o[valueKey]}>{o.label}</option>)}
            </datalist>
        </div>
    );
}

export default function CharacterSettingPanel({ cs, dialects, speechStyles }) {
    const { draft } = cs;
    return (
        <section className={s.card}>
            <h3 className={s.cardTitle}>角色设定（方言 / 性格 / 背景）</h3>
            <div className={s.charLayout}>
                <div className={s.charList}>
                    <input className={s.input} placeholder={`搜索角色（共 ${cs.total} 个）`} value={cs.keyword}
                        onChange={e => cs.setKeyword(e.target.value)} />
                    {cs.characters.length === 0 && <p className={s.muted}>没有匹配的角色</p>}
                    {cs.characters.map(c => (
                        <button key={c.id} type="button"
                            className={`${s.charItem} ${cs.selectedId === c.id ? s.charItemOn : ''}`}
                            onClick={() => cs.open(c)}>
                            <span className={s.charDot} style={{ background: roleColor(c.roleLevel) }} />
                            <span className={s.charName}>{c.name}</span>
                            <span className={s.charRole} style={{ color: roleColor(c.roleLevel) }}>{roleLabel(c.roleLevel)}</span>
                            {hasLanguageProfile(c) && <span className={s.charFlag} title="已设方言/语体">语</span>}
                        </button>
                    ))}
                </div>

                <div className={s.charForm}>
                    {!draft ? <p className={s.muted}>从左侧选一个角色开始编辑</p> : (
                        <>
                            <p className={s.charHint}>{charSummary(cs.characters.find(c => c.id === cs.selectedId) || {})}</p>

                            <Field label="方言" hint="留空=不说方言">
                                <PresetSelect value={asText(draft.dialectRegion)} onChange={v => cs.setField('dialectRegion', v)}
                                    options={dialects} valueKey="region" placeholder="如：东北 / 上海 / 广东" />
                            </Field>
                            <Field label="方言强度">
                                <select className={s.input} value={draft.dialectIntensity} onChange={e => cs.setField('dialectIntensity', e.target.value)}>
                                    {INTENSITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </Field>
                            <Field label="语体" hint="说话风格，如 抽象话 / 官腔 / 中二">
                                <PresetSelect value={asText(draft.speechStyle)} onChange={v => cs.setField('speechStyle', v)}
                                    options={speechStyles} valueKey="id" placeholder="如：abstract / 官腔" />
                            </Field>
                            <Field label="语体强度">
                                <select className={s.input} value={draft.speechStyleIntensity} onChange={e => cs.setField('speechStyleIntensity', e.target.value)}>
                                    {INTENSITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </Field>

                            <Field label="所属位面 / 势力" hint="影响世界域可见性与阵营归属">
                                <input className={s.input} value={asText(draft.parentPlane)} placeholder="位面" onChange={e => cs.setField('parentPlane', e.target.value)} />
                                <input className={s.input} value={asText(draft.parentFaction)} placeholder="势力" onChange={e => cs.setField('parentFaction', e.target.value)} />
                            </Field>

                            <Field label="简介" hint="一句话定位，列表与卡片上显示">
                                <input className={s.input} value={asText(draft.description)} onChange={e => cs.setField('description', e.target.value)} />
                            </Field>
                            <Field label="性格与背景" hint="写进素材正文，执笔人按此塑造该角色">
                                <textarea className={s.textareaLg} rows={12} value={asText(draft.currentContent)} onChange={e => cs.setField('currentContent', e.target.value)} />
                            </Field>

                            <div className={s.actions}>
                                <button type="button" className={s.primaryBtn} onClick={cs.save} disabled={cs.saving}>
                                    {cs.saving ? '保存中…' : '保存角色设定'}
                                </button>
                                {cs.notice && <span className={s.notice}>{cs.notice}</span>}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
