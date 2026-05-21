import { useNavigate, useLocation } from 'react-router-dom';
import useAppStore from '../store/useAppStore';

const PAGE_TITLES = {
    '/': '仪表盘',
    '/pipeline': '流水线控制台',
    '/materials': '素材库管理',
    '/chapters': '章节管理',
    '/agents': 'Agent 配置',
    '/settings': '系统设置',
    '/guide': '操作指南'
};

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentProject, pipelineState } = useAppStore();

    return (
        <header className="app-header">
            <div className="header-title">
                {PAGE_TITLES[location.pathname] || 'NOVEL PIPELINE'}
                {currentProject && (
                    <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
                        / {currentProject.name}
                    </span>
                )}
            </div>
            <div className="header-actions">
                {pipelineState.running && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12 }}>
                        <span className="cyber-loading"></span>
                        <span style={{ fontSize: 12, color: 'var(--neon-blue)' }}>
                            流水线运行中 - 第{pipelineState.currentRound}轮
                        </span>
                    </div>
                )}
                <button className="cyber-btn cyber-btn-sm" onClick={() => navigate('/guide')}>
                    操作指南
                </button>
                <button className="cyber-btn cyber-btn-sm cyber-btn-primary" onClick={() => navigate('/pipeline')}>
                    启动流水线
                </button>
            </div>
        </header>
    );
}
