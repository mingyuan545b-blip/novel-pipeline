/**
 * 图标基座：统一 stroke 风格 SVG 容器。
 * 文件位置：client/src/components/IconBase.jsx
 */
export function Icon({ size = 18, strokeWidth = 1.7, children, ...rest }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...rest}
        >
            {children}
        </svg>
    );
}
