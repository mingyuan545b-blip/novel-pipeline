/**
 * DefinitionDensityPanel.jsx — 详情栏内的「信息密度 + 成长阶段」面板
 *
 * 概要优先：默认加载最低密度（概要），用户按需切换到摘要/详细/设定；
 * 装备/功法若带 propertiesJson.stages，则展示阶段选择器，点击阶段才载入该阶段属性/特效。
 */
import { useState } from 'react';
import { densitiesOf, defaultDensityKey, densityText, stagesOf, attributesOf, resolveStageKey, materialBodyText } from './definitionLevels';
import { tagLabel } from './constants';
import s from './definitionDensity.module.css';

export function AttrTable({ attrs }) {
    const rows = Object.entries(attrs || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined);
    if (!rows.length) return null;
    return (
        <div className={s.attrs}>
            {rows.map(([k, v]) => (
                <div key={k} className={s.attrRow}>
                    <span className={s.attrKey}>{tagLabel(k)}</span>
                    <span className={s.attrVal}>{Array.isArray(v) ? v.join('、') : String(v)}</span>
                </div>
            ))}
        </div>
    );
}

export default function DefinitionDensityPanel({ item, material, currentChapter }) {
    const densities = densitiesOf(item, material);
    const stages = stagesOf(item);
    const attrs = attributesOf(item);
    const curKey = resolveStageKey(item, stages, currentChapter);
    const [level, setLevel] = useState(() => defaultDensityKey(densities));
    const [stageKey, setStageKey] = useState(() => curKey);
    const stage = stages.find(x => x.key === stageKey) || null;
    const active = densities.find(d => d.key === level) || densities[0];
    const noGrowth = stages.length === 0 && Object.keys(attrs).length === 0;
    const hasBody = !!materialBodyText(material);

    return (
        <div className={s.root}>
            <div className={s.head}>
                <span className={s.headLabel}>信息密度</span>
                <span className={s.headHint}>{active?.hint}</span>
            </div>
            <div className={s.chips}>
                {densities.map(d => (
                    <button key={d.key} type="button" disabled={!d.available}
                        className={`${s.chip} ${level === d.key ? s.chipOn : ''} ${d.available ? '' : s.chipOff}`}
                        title={d.available ? d.hint : '该密度暂无内容'}
                        onClick={() => setLevel(d.key)}>
                        {d.label}{d.available && d.tokens ? <em>{d.tokens}</em> : null}
                    </button>
                ))}
            </div>
            <div className={`${s.desc} ec-desc-block`}>{densityText(densities, level)}</div>

            {stages.length > 0 && (
                <>
                    <div className={s.head}>
                        <span className={s.headLabel}>成长阶段</span>
                        <span className={s.headHint}>点击阶段载入该阶段属性 / 特效</span>
                    </div>
                    <div className={s.chips}>
                        {stages.map(st => (
                            <button key={st.key} type="button" className={`${s.chip} ${stageKey === st.key ? s.chipOn : ''}`}
                                onClick={() => setStageKey(st.key)}>
                                {st.label}
                                {st.key === curKey && <em className={s.cur}>当前</em>}
                                {st.chapter ? <em>{`Ch${st.chapter}`}</em> : null}
                            </button>
                        ))}
                    </div>
                    {stage && (
                        <div className={s.stageBox}>
                            <AttrTable attrs={stage.attributes} />
                            {stage.effects.length > 0 && (
                                <ul className={s.effects}>{stage.effects.map((e, i) => <li key={i}>{e}</li>)}</ul>
                            )}
                            {stage.desc && <div className={`${s.desc} ec-desc-block`}>{stage.desc}</div>}
                            {!Object.keys(stage.attributes).length && !stage.effects.length && !stage.desc &&
                                <div className={s.note}>该阶段暂无结构化数据</div>}
                        </div>
                    )}
                </>
            )}

            {stages.length === 0 && Object.keys(attrs).length > 0 && (
                <>
                    <div className={s.head}><span className={s.headLabel}>当前属性</span></div>
                    <AttrTable attrs={attrs} />
                </>
            )}

            {noGrowth && (
                <div className={s.note}>
                    {hasBody
                        ? '该条目暂无分阶段属性 / 特效数据，以上为素材概要内容。'
                        : '暂无结构化数据：该条目只登记了身份，未写入描述或阶段属性。'}
                </div>
            )}
        </div>
    );
}
