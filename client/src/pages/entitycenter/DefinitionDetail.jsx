/**
 * DefinitionDetail.jsx — 定义详情的公共片段
 * 说明：卡片不再内联展开（改为右栏 DefinitionDetailPane），此处仅保留「绑定角色」列表供详情栏复用。
 */

export function BindersList({ binders, getCharName }) {
    return (
        <div className="ec-mt-8">
            <div className="ec-text-11 ec-text-muted ec-mb-4">绑定角色:</div>
            <div className="ec-flex ec-gap-4 ec-flex-wrap">
                {binders.map(b => <span key={b.id} className="ec-badge ec-badge-cyan">{getCharName(b.characterId)}</span>)}
            </div>
        </div>
    );
}
