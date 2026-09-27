/**
 * 侧边栏导航清单（长篇/漫剧/系统），供 Sidebar 与命令面板共用。
 * 文件位置：client/src/components/navConstants.js
 */
import {
    IconDashboard, IconPipeline, IconWorkshop, IconMaterials, IconEntity,
    IconLibrary, IconKnowledge, IconMap, IconPalette, IconChapters, IconPublish,
    IconSliders, IconWorkflow, IconStoryboard, IconRender, IconExport,
    IconMetrics, IconTerminal, IconCpu, IconFlask, IconSettings, IconGuide,
} from './Icons';

export const NOVEL_NAV = [
    { path: '/', icon: IconDashboard, label: '仪表盘' },
    { path: '/pipeline', icon: IconPipeline, label: '流水线' },
    { path: '/workshop', icon: IconWorkshop, label: '创作工坊' },
    { path: '/materials', icon: IconMaterials, label: '素材库' },
    { path: '/entity-center', icon: IconEntity, label: '实体中心' },
    { path: '/library', icon: IconLibrary, label: '藏经阁' },
    { path: '/knowledge', icon: IconKnowledge, label: '知识库' },
    { path: '/context-assembly', icon: IconMap, label: '上下文装配图' },
    { path: '/token-ledger', icon: IconMetrics, label: 'Token 去向' },
    { path: '/style-templates', icon: IconPalette, label: '风格模板' },
    { path: '/chapters', icon: IconChapters, label: '章节管理' },
    { path: '/publish', icon: IconPublish, label: '发布中心' }
];

export const COMIC_NAV = [
    { path: '/comic/config', icon: IconSliders, label: 'ComfyUI配置' },
    { path: '/comic/workflows', icon: IconWorkflow, label: '工作流管理' },
    { path: '/comic/storyboard', icon: IconStoryboard, label: '分镜管理' },
    { path: '/comic/render', icon: IconRender, label: '渲染队列' },
    { path: '/comic/export', icon: IconExport, label: '漫剧导出' }
];

export const SYSTEM_NAV = [
    { path: '/metrics', icon: IconMetrics, label: '系统监控' },
    { path: '/debug-logs', icon: IconTerminal, label: '调试日志' },
    { path: '/agents', icon: IconCpu, label: 'Agent配置' },
    { path: '/genre-debug', icon: IconFlask, label: '题材调试' },
    { path: '/settings', icon: IconSettings, label: '系统设置' },
    { path: '/guide', icon: IconGuide, label: '操作指南' }
];
