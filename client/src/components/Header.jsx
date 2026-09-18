import { useNavigate, useLocation } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { THEME_LABEL, nextTheme } from '../shared/themes';
import { showSuccess } from './notifications';
import { IconSearch, IconBrush, IconGuide, IconPipeline } from './Icons';

// 补全所有路由标题（原先仅7条，其余页面头部显示默认名，导航定位感差）
const PAGE_TITLES = {
    '/': '仪表盘',
    '/pipeline': '流水线控制台',
    '/materials': '素材库管理',
    '/chapters': '章节管理',
    '/agents': 'Agent 配置',
    '/settings': '系统设置',
    '/guide': '操作指南',
    '/workshop': '创作工坊',
    '/publish': '发布中心',
    '/comic/config': 'ComfyUI 配置',
    '/comic/workflows': '工作流管理',
    '/comic/storyboard': '分镜管理',
    '/comic/render': '渲染队列',
    '/comic/export': '漫剧导出',
    '/style-templates': '风格模板',
    '/knowledge': '知识库',
    '/library': '藏经阁',
    '/entity-center': '实体中心',
    '/genre-debug': '题材调试',
    '/metrics': '系统监控',
    '/context-assembly': '上下文装配图',
    '/debug-logs': '调试日志'
};

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentProject, pipelineState, theme, setTheme, setPaletteOpen } = useAppStore();

    const pageTitle = PAGE_TITLES[location.pathname] || 'NOVEL PIPELINE';
    const moduleLabel = location.pathname.startsWith('/comic') ? '漫剧' : '长篇';

    const cycleTheme = () => {
        const next = nextTheme(theme);
        setTheme(next);
        showSuccess(`已切换皮肤：${THEME_LABEL[next]}`);
    };

    return (
        <header className="app-header">
            <div className="header-breadcrumb" title={pageTitle}>
                <span className="header-breadcrumb-module">{moduleLabel}</span>
                <span className="header-breadcrumb-sep">/</span>
                <span className="header-breadcrumb-page">{pageTitle}</span>
                {currentProject && (
                    <span className="header-project-chip" title={`当前项目：${currentProject.name}`}>
                        {currentProject.name}
                    </span>
                )}
            </div>
            <div className="header-actions">
                {pipelineState.running && (
                    <div className="header-running" title={`流水线运行中 - 第${pipelineState.currentRound}轮`}>
                        <span className="cyber-loading"></span>
                        <span>第{pipelineState.currentRound}轮</span>
                    </div>
                )}
                <button className="header-icon-btn" onClick={() => setPaletteOpen(true)}
                    title="命令面板 (Ctrl+K)" aria-label="打开命令面板">
                    <IconSearch size={15} />
                    <kbd className="header-kbd">Ctrl K</kbd>
                </button>
                <button className="header-icon-btn" onClick={cycleTheme}
                    title={`切换皮肤（当前：${THEME_LABEL[theme] || theme}）`} aria-label="切换皮肤">
                    <IconBrush size={15} />
                </button>
                <button className="cyber-btn cyber-btn-sm header-plain-btn" onClick={() => navigate('/guide')} title="操作指南">
                    <IconGuide size={14} />
                    <span>指南</span>
                </button>
                <button className="cyber-btn cyber-btn-sm cyber-btn-primary header-plain-btn" onClick={() => navigate('/pipeline')} title="启动流水线">
                    <IconPipeline size={14} />
                    <span>启动流水线</span>
                </button>
            </div>
        </header>
    );
}
