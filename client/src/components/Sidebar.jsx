import { useNavigate, useLocation } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { settingsApi, comicApi } from '../services/api';
import { useEffect, useState } from 'react';

const NOVEL_NAV = [
    { path: '/', icon: '◈', label: '仪表盘' },
    { path: '/pipeline', icon: '⟐', label: '流水线' },
    { path: '/workshop', icon: '⬡', label: '创作工坊' },
    { path: '/materials', icon: '⬡', label: '素材库' },
    { path: '/entity-center', icon: '⬡', label: '实体中心' },
    { path: '/library', icon: '📚', label: '藏经阁' },
    { path: '/knowledge', icon: '⬢', label: '知识库' },
    { path: '/context-map', icon: '🗺', label: '上下文电路图' },
    { path: '/style-templates', icon: '🎨', label: '风格模板' },
    { path: '/chapters', icon: '▦', label: '章节管理' },
    { path: '/publish', icon: '▲', label: '发布中心' }
];

const COMIC_NAV = [
    { path: '/comic/config', icon: '⬢', label: 'ComfyUI配置' },
    { path: '/comic/workflows', icon: '⟁', label: '工作流管理' },
    { path: '/comic/storyboard', icon: '▦', label: '分镜管理' },
    { path: '/comic/render', icon: '◈', label: '渲染队列' },
    { path: '/comic/export', icon: '▲', label: '漫剧导出' }
];

const SYSTEM_NAV = [
    { path: '/metrics', icon: '📊', label: '系统监控' },
    { path: '/debug-logs', icon: '🔍', label: '调试日志' },
    { path: '/agents', icon: '⧫', label: 'Agent配置' },
    { path: '/genre-debug', icon: '🔬', label: '题材调试' },
    { path: '/settings', icon: '⚙', label: '系统设置' },
    { path: '/guide', icon: '◈', label: '操作指南' }
];

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentProject, activeModule, setActiveModule } = useAppStore();
    const [apiStatus, setApiStatus] = useState('unknown');
    const [comfyuiStatus, setComfyuiStatus] = useState('unknown');

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await settingsApi.get();
                const data = res.data || res;
                setApiStatus(data.hasKey ? 'online' : 'offline');
            } catch {
                setApiStatus('offline');
            }
        };
        const checkComfyUI = async () => {
            try {
                const res = await comicApi.getComfyUIStatus();
                setComfyuiStatus(res.data?.running ? 'online' : 'offline');
            } catch {
                setComfyuiStatus('offline');
            }
        };
        checkStatus();
        checkComfyUI();
        const interval = setInterval(() => { checkStatus(); checkComfyUI(); }, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (location.pathname.startsWith('/comic')) {
            setActiveModule('comic');
        } else {
            setActiveModule('novel');
        }
    }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    const currentNav = activeModule === 'comic' ? COMIC_NAV : NOVEL_NAV;

    return (
        <aside className="app-sidebar">
            <div className="sidebar-logo" onClick={() => navigate('/')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/')} style={{ cursor: 'pointer' }} aria-label="返回首页">
                <div className="sidebar-logo-icon">⬡</div>
                <div>
                    <div className="sidebar-logo-text">NOVEL PIPELINE</div>
                    <div className="sidebar-logo-sub">AI 长篇 · 漫剧 生产流水线</div>
                </div>
            </div>

            <div className="sidebar-module-switch">
                <button
                    className={`module-switch-btn ${activeModule === 'novel' ? 'module-switch-active' : ''}`}
                    onClick={() => { setActiveModule('novel'); navigate('/'); }}
                    aria-label="切换到长篇模式"
                    aria-pressed={activeModule === 'novel'}
                >
                    <span className="module-switch-icon">✎</span>
                    长篇
                </button>
                <button
                    className={`module-switch-btn ${activeModule === 'comic' ? 'module-switch-active' : ''}`}
                    onClick={() => { setActiveModule('comic'); navigate('/comic/config'); }}
                    aria-label="切换到漫剧模式"
                    aria-pressed={activeModule === 'comic'}
                >
                    <span className="module-switch-icon">◈</span>
                    漫剧
                </button>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section-label">
                    {activeModule === 'comic' ? '◈ 漫剧' : '✎ 长篇小说'}
                </div>
                {currentNav.map(item => (
                    <div
                        key={item.path}
                        className={`sidebar-link ${location.pathname === item.path ? 'sidebar-link-active' : ''}`}
                        onClick={() => navigate(item.path)}
                        role="link"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(item.path)}
                        aria-current={location.pathname === item.path ? 'page' : undefined}
                    >
                        <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
                        <span>{item.label}</span>
                    </div>
                ))}

                <div className="sidebar-section-label" style={{ marginTop: 8 }}>系统</div>
                {SYSTEM_NAV.map(item => (
                    <div
                        key={item.path}
                        className={`sidebar-link ${location.pathname === item.path ? 'sidebar-link-active' : ''}`}
                        onClick={() => navigate(item.path)}
                        role="link"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(item.path)}
                        aria-current={location.pathname === item.path ? 'page' : undefined}
                    >
                        <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
                        <span>{item.label}</span>
                    </div>
                ))}
            </nav>

            <div className="sidebar-status">
                <div className="sidebar-status-item">
                    <span className={`cyber-status-dot ${apiStatus === 'online' ? 'cyber-status-dot-online' : apiStatus === 'unknown' ? 'cyber-status-dot-offline' : 'cyber-status-dot-offline'}`}></span>
                    LLM: {apiStatus === 'online' ? '已连接' : apiStatus === 'unknown' ? '检测中' : '未配置'}
                </div>
                <div className="sidebar-status-item">
                    <span className={`cyber-status-dot ${comfyuiStatus === 'online' ? 'cyber-status-dot-online' : 'cyber-status-dot-offline'}`}></span>
                    ComfyUI: {comfyuiStatus === 'online' ? '运行中' : comfyuiStatus === 'unknown' ? '检测中' : '未启动'}
                </div>
                {currentProject && (
                    <div className="sidebar-status-item">
                        <span className="cyber-status-dot cyber-status-dot-online"></span>
                        项目: {currentProject.name}
                    </div>
                )}
            </div>
        </aside>
    );
}
