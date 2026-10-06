/**
 * DefinitionDetailPane.jsx — 双栏右侧的统一定义详情
 * 头部（名称/稀有度/类型）→ 信息密度与成长阶段 → 元数据 → 绑定角色 → 生命周期编辑。
 * 左侧卡片不再内联展开；所有细节在此栏呈现。
 */
import { BindersList } from './DefinitionDetail';
import DefinitionMetaColumn from './DefinitionMetaColumn';
import DefinitionDensityPanel from './DefinitionDensityPanel';
import MaterialLifecycleBar from './MaterialLifecycleBar';
import { GenerativeAvatar, RarityBadge } from './UiComponents';
import { DEF_TYPE_LABELS } from './constants';
import s from './definitionMeta.module.css';

export default function DefinitionDetailPane({ item, material, allBinds, getCharName, onPatchLifecycle, borderColor = 'var(--neon-cyan)', currentChapter, ownerText }) {
    const binders = (allBinds || []).filter(b => b.defId === item.id);
    const typeLabel = DEF_TYPE_LABELS[item.defType] || item.defType;
    return (
        <div className={s.pane} style={{ '--pane-accent': borderColor }}>
            <div className={s.paneHead}>
                <GenerativeAvatar name={item.name || item.id} size={34} />
                <div className={s.paneHeadBody}>
                    <div className={s.paneName}>
                        <span className="ec-ellipsis">{item.name || item.id}</span>
                        <RarityBadge rarity={item.rarity} />
                    </div>
                    <div className={s.paneHeadMeta}>
                        {typeLabel && <span className="ec-badge ec-badge-muted">{typeLabel}</span>}
                        {ownerText && <span className="ec-text-11 ec-text-muted ec-ellipsis">{ownerText}</span>}
                    </div>
                </div>
            </div>

            <DefinitionDensityPanel item={item} material={material} currentChapter={currentChapter} />
            <DefinitionMetaColumn item={item} material={material} />

            {binders.length > 0 && <BindersList binders={binders} getCharName={getCharName} />}
            <MaterialLifecycleBar material={material} onPatch={onPatchLifecycle} />
        </div>
    );
}
