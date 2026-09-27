/**
 * 全局主题皮肤清单（与 styles/skin-*.css 的 data-theme 对应）
 * 供 Header 快捷切换、命令面板、设置页共用，避免多处硬编码漂移。
 * 文件位置：client/src/shared/themes.js
 */
export const THEMES = [
    { key: 'aurora', label: '炫彩动态' },
    { key: 'glass', label: '磨砂玻璃' },
    { key: 'liquid', label: '液态玻璃' },
    { key: 'ceramic', label: '渐变陶瓷' },
    { key: 'ripple', label: '动态水波纹' },
    { key: 'mario', label: '马里奥' }
];

export const THEME_LABEL = Object.fromEntries(THEMES.map(t => [t.key, t.label]));

export function nextTheme(current) {
    const idx = THEMES.findIndex(t => t.key === current);
    return THEMES[(idx + 1) % THEMES.length].key;
}
