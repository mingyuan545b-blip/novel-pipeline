/**
 * verifyMaterialMigrationConfig.js — 素材构建器迁移校验配置
 * 校验规则常量和Agent文件清单
 * 被 verifyMaterialMigration.js 引用
 */

// 6个核心Agent文件（必须调用scheduleMaterials）
const AGENT_FILES = [
    'services/pipeline/steps/writer/writerMaterialBuilder.js',
    'services/pipeline/steps/reviserPrompt.js',
    'services/pipeline/steps/polisher.js',
    'services/pipeline/steps/finalEditor.js',
    'services/pipeline/steps/review/reviewShared.js',
    'services/pipeline/steps/reader.js',
];

// 允许的素材段构建来源（character段除外，由专用formatter处理）
const ALLOWED_MATERIAL_SOURCES = [
    'materialInjector',
    'writerCharacterFormatter',
    'reviewShared', // review的素材通过reviewShared统一处理
];

// 已知未迁移到materialInjector的文件（有合理定制理由）
// 格式: { file, reason, phase }
// 当所有Phase完成后，此列表应为空
const KNOWN_NOT_MIGRATED = [];

module.exports = { AGENT_FILES, ALLOWED_MATERIAL_SOURCES, KNOWN_NOT_MIGRATED };
