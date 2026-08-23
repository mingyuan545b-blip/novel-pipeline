/**
 * 章节状态常量定义（单一数据源）
 * 所有前端组件统一从此文件引用，避免多处重复定义导致不一致
 */

export const STATUS_LABELS = {
    draft: '草稿', outlined: '已规划', written: '已创作',
    'first-reviewing': '初审中', 'second-reviewing': '复审中', 'final-editing': '定稿中',
    approved: '已定稿', 'material-updated': '素材已更新'
};

export const STATUS_COLORS = {
    draft: 'blue', outlined: 'purple', written: 'blue',
    'first-reviewing': 'green', 'second-reviewing': 'orange', 'final-editing': 'pink',
    approved: 'green', 'material-updated': 'purple'
};

// 已写状态：包含所有"已有正文内容"的章节状态
export const WRITTEN_STATUSES = ['written', 'first-reviewing', 'second-reviewing', 'final-editing', 'approved', 'material-updated'];

// 头部统计的已写状态（不含material-updated，因为素材更新不算独立写作状态）
export const HEADER_WRITTEN_STATUSES = ['written', 'first-reviewing', 'second-reviewing', 'final-editing', 'approved'];
