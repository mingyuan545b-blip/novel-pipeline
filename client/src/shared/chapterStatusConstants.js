/**
 * 章节状态展示常量 —— 自动生成，请勿手改！
 * 生成器：scripts/generateChapterStatusConstants.js（源：server/services/chapterStatus.js）
 * 校验：npm run gen:chapter-status -- --check（漂移会被闸门/CI 拦截）
 */

export const ALL_STATUSES = ["first-reviewing","first-reviewed","second-reviewing","second-reviewed","final-editing","written","polishing","approved","material-updated","failed-skipped","timeout-skipped","context-error","pipeline-failed","cooldown-waiting","outlined","draft"];

export const STATUS_ORDER = ["outlined","draft","written","first-reviewing","first-reviewed","second-reviewing","second-reviewed","final-editing","polishing","approved","material-updated","cooldown-waiting"];

export const STATUS_LABELS = {"outlined":"已规划","draft":"草稿","written":"已创作","first-reviewing":"初审中","first-reviewed":"初审通过","second-reviewing":"复审中","second-reviewed":"复审通过","final-editing":"定稿中","polishing":"润色中","approved":"已定稿","material-updated":"素材已更新","cooldown-waiting":"冷却等待","failed-skipped":"失败跳过","timeout-skipped":"超时跳过","context-error":"上下文错误","pipeline-failed":"流水线失败"};

export const STATUS_COLORS = {"outlined":"purple","draft":"blue","written":"blue","first-reviewing":"green","first-reviewed":"green","second-reviewing":"orange","second-reviewed":"orange","final-editing":"pink","polishing":"pink","approved":"green","material-updated":"purple","cooldown-waiting":"orange","failed-skipped":"red","timeout-skipped":"red","context-error":"red","pipeline-failed":"red"};

// 已写状态：包含所有"已有正文内容"的章节状态
export const WRITTEN_STATUSES = ["written","first-reviewing","first-reviewed","second-reviewing","second-reviewed","final-editing","polishing","approved","material-updated"];

// 头部统计的已写状态（不含 material-updated）
export const HEADER_WRITTEN_STATUSES = ["written","first-reviewing","first-reviewed","second-reviewing","second-reviewed","final-editing","polishing","approved"];
