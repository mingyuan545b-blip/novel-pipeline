import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import useAppStore from './store/useAppStore';
import { useEffect, useState } from 'react';
import { projectsApi, settingsApi, pipelineApi, licenseApi, versionApi } from './services/api';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
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
import TimelinePage from './pages/TimelinePage';
import LibraryPage from './pages/LibraryPage';
import MapPage from './pages/MapPage';

function App() {
    const location = useLocation();
    const { setProjects, setSettings, setAgents, setActivePage, theme, bgImage, bgOpacity, bgBlur, setMembership, setUpdateInfo, membership } = useAppStore();
    const [forceUpdateModal, setForceUpdateModal] = useState(false);
    const [initError, setInitError] = useState(null);

    useEffect(() => {
        setActivePage(location.pathname);
    }, [location.pathname, setActivePage]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        const bgImageValue = bgImage ? `url(${bgImage})` : 'none';
        document.documentElement.style.setProperty('--app-bg-image', bgImageValue);
    }, [bgImage]);

    useEffect(() => {
        document.documentElement.style.setProperty('--app-bg-opacity', String(bgOpacity));
    }, [bgOpacity]);

    useEffect(() => {
        document.documentElement.style.setProperty('--app-bg-blur', `${bgBlur}px`);
    }, [bgBlur]);

    useEffect(() => {
        const initData = async () => {
            try {
                const [projectsRes, settingsRes, agentsRes, licenseRes] = await Promise.all([
                    projectsApi.list().catch(() => ({ data: [] })),
                    settingsApi.get().catch(() => ({ data: { hasKey: false } })),
                    pipelineApi.getAgents().catch(() => ({ data: [] })),
                    licenseApi.getStatus().catch(() => ({ data: { level: 'free', licensed: false } }))
                ]);
                setProjects(projectsRes.data || []);
                setSettings(settingsRes.data || { hasKey: false });
                setAgents(agentsRes.data || []);
                setMembership(licenseRes.data || { level: 'free', licensed: false });
            } catch (e) {
                console.error('Init data error:', e);
                setInitError('数据加载失败，请检查服务器是否正常运行');
            }
        };
        initData();

        const checkUpdate = async () => {
            try {
                const versionRes = await versionApi.getInfo().catch(() => null);
                if (versionRes?.data) {
                    setUpdateInfo(versionRes.data);
                }
            } catch {}
        };
        checkUpdate();
    }, [setProjects, setSettings, setAgents, setMembership, setUpdateInfo]);

    return (
        <ErrorBoundary>
            <div className="app-layout" data-theme={theme}>
                <div className="app-bg-layer"></div>
                {initError && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#ef4444', color: '#fff', padding: '8px 16px', textAlign: 'center', fontSize: '14px' }}>
                        {initError}
                        <button onClick={() => setInitError(null)} style={{ marginLeft: '12px', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px' }}>关闭</button>
                    </div>
                )}
                <Sidebar />
                <div className="app-main">
                    <Header />
                    <div className="app-content">
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/pipeline" element={<PipelinePage />} />
                            <Route path="/materials" element={<MaterialsPage />} />
                            <Route path="/chapters" element={<ChaptersPage />} />
                            <Route path="/agents" element={<AgentsPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/guide" element={<GuidePage />} />
                            <Route path="/workshop" element={<WorkshopPage />} />
                            <Route path="/publish" element={<PublishPage />} />
                            <Route path="/comic/config" element={<ComicConfigPage />} />
                            <Route path="/comic/workflows" element={<ComicWorkflowsPage />} />
                            <Route path="/comic/storyboard" element={<ComicStoryboardPage />} />
                            <Route path="/comic/render" element={<ComicRenderPage />} />
                            <Route path="/comic/export" element={<ComicExportPage />} />
                            <Route path="/style-templates" element={<StyleTemplatesPage />} />
                            <Route path="/knowledge" element={<KnowledgePage />} />
                            <Route path="/library" element={<LibraryPage />} />
                            <Route path="/timeline" element={<TimelinePage />} />
                            <Route path="/map" element={<MapPage />} />
                        </Routes>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}

export default App;
