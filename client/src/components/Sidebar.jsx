import { useNavigate, useLocation } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { settingsApi, comicApi } from '../services/api';
import { useEffect, useState } from 'react';
import { IconCollapse, IconExpand } from './Icons';
import { NOVEL_NAV, COMIC_NAV, SYSTEM_NAV } from './navConstants';

function NavItem({ item, active, collapsed, onNavigate }) {
    const IconComp = item.icon;
    return (
        <div
            className={`sidebar-link ${active ? 'sidebar-link-active' : ''} ${collapsed ? 'sidebar-link-collapsed' : ''}`}
            onClick={() => onNavigate(item.path)}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigate(item.path)}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
        >
            <span className="sidebar-link-icon" aria-hidden="true"><IconComp size={17} /></span>
            {!collapsed && <span className="sidebar-link-label">{item.label}</span>}
        </div>
    );
}

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentProject, activeModule, setActiveModule, sidebarCollapsed, toggleSidebar } = useAppStore();
    const [apiStatus, setApiStatus] = useState('unknown');
    const [comfyuiStatus, setComfyuiStatus] = useState('unknown');
    const collapsed = sidebarCollapsed;

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
        <aside className={`app-sidebar ${collapsed ? 'app-sidebar-collapsed' : ''}`}>
            <div className="sidebar-logo" onClick={() => navigate('/')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/')} style={{ cursor: 'pointer' }} aria-label="返回首页">
                <div className="sidebar-logo-icon">⬡</div>
                {!collapsed && (
                    <div className="sidebar-logo-texts">
                        <div className="sidebar-logo-text">NOVEL PIPELINE</div>
                        <div className="sidebar-logo-sub">AI 长篇 · 漫剧 生产流水线</div>
                    </div>
                )}
            </div>

            {!collapsed ? (
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
            ) : (
                <div className="sidebar-module-switch sidebar-module-switch-vertical">
                    <button
                        className={`module-switch-btn ${activeModule === 'novel' ? 'module-switch-active' : ''}`}
                        onClick={() => { setActiveModule('novel'); navigate('/'); }}
                        title="长篇模式"
                        aria-label="切换到长篇模式"
                        aria-pressed={activeModule === 'novel'}
                    >
                        ✎
                    </button>
                    <button
                        className={`module-switch-btn ${activeModule === 'comic' ? 'module-switch-active' : ''}`}
                        onClick={() => { setActiveModule('comic'); navigate('/comic/config'); }}
                        title="漫剧模式"
                        aria-label="切换到漫剧模式"
                        aria-pressed={activeModule === 'comic'}
                    >
                        ◈
                    </button>
                </div>
            )}

            <nav className="sidebar-nav">
                {!collapsed && (
                    <div className="sidebar-section-label">
                        {activeModule === 'comic' ? '◈ 漫剧' : '✎ 长篇小说'}
                    </div>
                )}
                {currentNav.map(item => (
                    <NavItem key={item.path} item={item} collapsed={collapsed}
                        active={location.pathname === item.path} onNavigate={navigate} />
                ))}

                {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 8 }}>系统</div>}
                {collapsed && <div className="sidebar-divider" aria-hidden="true"></div>}
                {SYSTEM_NAV.map(item => (
                    <NavItem key={item.path} item={item} collapsed={collapsed}
                        active={location.pathname === item.path} onNavigate={navigate} />
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-status">
                    <div className="sidebar-status-item" title={`LLM: ${apiStatus === 'online' ? '已连接' : apiStatus === 'unknown' ? '检测中' : '未配置'}`}>
                        <span className={`cyber-status-dot ${apiStatus === 'online' ? 'cyber-status-dot-online' : 'cyber-status-dot-offline'}`}></span>
                        {!collapsed && <span className="sidebar-status-text">LLM: {apiStatus === 'online' ? '已连接' : apiStatus === 'unknown' ? '检测中' : '未配置'}</span>}
                    </div>
                    <div className="sidebar-status-item" title={`ComfyUI: ${comfyuiStatus === 'online' ? '运行中' : comfyuiStatus === 'unknown' ? '检测中' : '未启动'}`}>
                        <span className={`cyber-status-dot ${comfyuiStatus === 'online' ? 'cyber-status-dot-online' : 'cyber-status-dot-offline'}`}></span>
                        {!collapsed && <span className="sidebar-status-text">ComfyUI: {comfyuiStatus === 'online' ? '运行中' : comfyuiStatus === 'unknown' ? '检测中' : '未启动'}</span>}
                    </div>
                    {currentProject && (
                        <div className="sidebar-status-item" title={`当前项目: ${currentProject.name}`}>
                            <span className="cyber-status-dot cyber-status-dot-online"></span>
                            {!collapsed && <span className="sidebar-status-text sidebar-status-ellipsis">项目: {currentProject.name}</span>}
                        </div>
                    )}
                </div>
                <button className="sidebar-collapse-btn" onClick={toggleSidebar}
                    aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
                    title={collapsed ? '展开侧边栏' : '折叠侧边栏 (Ctrl+B)'}>
                    {collapsed ? <IconExpand size={16} /> : <IconCollapse size={16} />}
                    {!collapsed && <span>收起</span>}
                </button>
            </div>
        </aside>
    );
}
