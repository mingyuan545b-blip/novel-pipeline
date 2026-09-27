/**
 * 通用操作图标（搜索/折叠/皮肤/命令面板等）。
 * 文件位置：client/src/components/ActionIcons.jsx
 */
import { Icon } from './IconBase';

/* ---------- 通用操作图标 ---------- */
export const IconSearch = (p) => (
    <Icon {...p}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Icon>
);

export const IconCollapse = (p) => (
    <Icon {...p}>
        <polyline points="11 17 6 12 11 7" />
        <polyline points="18 17 13 12 18 7" />
    </Icon>
);

export const IconExpand = (p) => (
    <Icon {...p}>
        <polyline points="13 17 18 12 13 7" />
        <polyline points="6 17 11 12 6 7" />
    </Icon>
);

export const IconBrush = (p) => (
    <Icon {...p}>
        <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
        <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </Icon>
);

export const IconCommand = (p) => (
    <Icon {...p}>
        <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </Icon>
);

export const IconEnter = (p) => (
    <Icon {...p}>
        <polyline points="9 10 4 15 9 20" />
        <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </Icon>
);
