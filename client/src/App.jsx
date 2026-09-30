import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import useAppStore from './store/useAppStore';
import useAppInit from './hooks/useAppInit';
import useServerVersionGuard from './hooks/useServerVersionGuard';
import { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import NotificationContainer from './components/NotificationContainer';
import appStyles from './App.module.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CommandPalette from './components/CommandPalette';
import useKonami from './hooks/useKonami';
import Dashboard from './pages/Dashboard';
import PipelinePage from './pages/PipelinePage';
import MaterialsPage from './pages/MaterialsPage';
import ChaptersPage from './pages/ChaptersPage';
import AgentsPage from './pages/AgentsPage';
import SettingsPage from './pages/SettingsPage';
import GuidePage from './pages/GuidePage';
import WorkshopPage from './pages/WorkshopPage';
import PublishPage from './pages/PublishPage';
import ComicConfigPage from './pages/ComicConfigPage';
import ComicWorkflowsPage from './pages/ComicWorkflowsPage';
import ComicStoryboardPage from './pages/ComicStoryboardPage';
import ComicRenderPage from './pages/ComicRenderPage';
import ComicExportPage from './pages/ComicExportPage';
import StyleTemplatesPage from './pages/StyleTemplatesPage';
import KnowledgePage from './pages/KnowledgePage';
import LibraryPage from './pages/LibraryPage';
import ProgressPage from './pages/ProgressPage';
import StoryBiblePage from './pages/StoryBiblePage';
import CharacterStatePage from './pages/CharacterStatePage';
import EntityCenterPage from './pages/EntityCenterPage';
import GenreDebugPage from './pages/GenreDebugPage';
import MetricsPage from './pages/metrics/MetricsPage';
import ContextAssemblyPage from './pages/contextAssembly/ContextAssemblyPage';
import TokenLedgerPage from './pages/tokenLedger/TokenLedgerPage';
import DebugLogsPage from './pages/debug/DebugLogsPage';

function App() {
    const location = useLocation();
    const { setActivePage, theme, bgImage, bgOpacity, bgBlur } = useAppStore();
    const { initError, clearInitError, retryInit } = useAppInit();
    useServerVersionGuard();
    useKonami();

    // 全局快捷键：Ctrl+B 折叠/展开侧边栏（输入框内不触发）
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
                const t = e.target;
                if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
                e.preventDefault();
                useAppStore.getState().toggleSidebar();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        setActivePage(location.pathname);
    }, [location.pathname, setActivePage]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        document.documentElement.style.setProperty('--app-bg-image', bgImage ? `url(${bgImage})` : 'none');
    }, [bgImage]);

    useEffect(() => {
        document.documentElement.style.setProperty('--app-bg-opacity', String(bgOpacity));
    }, [bgOpacity]);

    useEffect(() => {
        document.documentElement.style.setProperty('--app-bg-blur', `${bgBlur}px`);
    }, [bgBlur]);

    return (
        <ErrorBoundary>
            <OfflineBanner />
            <NotificationContainer />
            <CommandPalette />
            <div className="app-layout" data-theme={theme}>
                <div className="app-bg-layer"></div>
                {initError && (
                    <div className={appStyles.initErrorBanner}>
                        {initError}
                        <button onClick={retryInit} className={appStyles.retryButton}>重试</button>
                        <button onClick={clearInitError} className={appStyles.closeButton}>关闭</button>
                    </div>
                )}
                <Sidebar />
                <div className="app-main">
                    <Header />
                    <div className="app-content">
                        <Routes>
                            <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                            <Route path="/pipeline" element={<ErrorBoundary><PipelinePage /></ErrorBoundary>} />
                            <Route path="/materials" element={<ErrorBoundary><MaterialsPage /></ErrorBoundary>} />
                            <Route path="/chapters" element={<ErrorBoundary><ChaptersPage /></ErrorBoundary>} />
                            <Route path="/agents" element={<ErrorBoundary><AgentsPage /></ErrorBoundary>} />
                            <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                            <Route path="/guide" element={<GuidePage />} />
                            <Route path="/workshop" element={<WorkshopPage />} />
                            <Route path="/publish" element={<ErrorBoundary><PublishPage /></ErrorBoundary>} />
                            <Route path="/comic/config" element={<ComicConfigPage />} />
                            <Route path="/comic/workflows" element={<ComicWorkflowsPage />} />
                            <Route path="/comic/storyboard" element={<ComicStoryboardPage />} />
                            <Route path="/comic/render" element={<ComicRenderPage />} />
                            <Route path="/comic/export" element={<ComicExportPage />} />
                            <Route path="/style-templates" element={<StyleTemplatesPage />} />
                            <Route path="/knowledge" element={<ErrorBoundary><KnowledgePage /></ErrorBoundary>} />
                            <Route path="/library" element={<LibraryPage />} />
                            <Route path="/progress" element={<ErrorBoundary><ProgressPage /></ErrorBoundary>} />
                            <Route path="/story-bible" element={<ErrorBoundary><StoryBiblePage /></ErrorBoundary>} />
                            <Route path="/map" element={<Navigate to="/context-assembly" replace />} />
                            <Route path="/character-states" element={<Navigate to="/entity-center?tab=state-tracking" replace />} />
                            <Route path="/entity-center" element={<EntityCenterPage />} />
                            <Route path="/genre-debug" element={<ErrorBoundary><GenreDebugPage /></ErrorBoundary>} />
                            <Route path="/metrics" element={<ErrorBoundary><MetricsPage /></ErrorBoundary>} />
                            <Route path="/context-assembly" element={<ErrorBoundary><ContextAssemblyPage /></ErrorBoundary>} />
                            <Route path="/token-ledger" element={<ErrorBoundary><TokenLedgerPage /></ErrorBoundary>} />
                            <Route path="/context-map" element={<Navigate to="/context-assembly" replace />} />
                            <Route path="/debug-logs" element={<ErrorBoundary><DebugLogsPage /></ErrorBoundary>} />
                            {/* 陷阱#21：必须有通配符路由，否则用户访问 /projects 等未定义路径时
                                 Dashboard 不渲染，项目数据不显示，用户以为"前端没数据" */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}

export default App;
