/**
 * uiHelpers — 实体中心 UI 的非组件工具函数
 *
 * 从 UiComponents.jsx 拆出（E6c）：该文件导出 React 组件，若同时导出普通函数，
 * react-refresh/only-export-components 会失效（HMR 退化为整页刷新）。
 * 非组件导出集中在这里，组件文件只导出组件。
 */

/** 字符串稳定散列（用于生成式头像的确定性配色/形状） */
export function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
}

/** 把点击回调包成键盘可达事件（Enter/Space） */
export const handleCardKey = (fn) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
};
