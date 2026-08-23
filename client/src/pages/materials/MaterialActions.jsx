import { MATERIAL_TYPE_LABELS } from './materialConstants';
import styles from './materials.module.css';

export default function MaterialActions({
    activeView, setActiveView, searchTerm, setSearchTerm,
    filterType, setFilterType, activeCount, archivedCount,
    filteredCount, showCreate: _showCreate, setShowCreate,
    collapsedTypes, setCollapsedTypes, onCheckIntegrity, onShowPrompt,
    currentProject,
}) {
    return (
        <>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className="page-title">素材库管理</h1>
                    <p className="page-subtitle">
                        管理小说世界观、人物、装备、关系等素材 - 支持初始/当前状态对比
                    </p>
                </div>
                {currentProject && (
                    <div className={styles.headerActions}>
                        <button className="cyber-btn cyber-btn-sm" onClick={onCheckIntegrity}>
                            🏥 健康检查
                        </button>
                        <button className="cyber-btn cyber-btn-sm" onClick={onShowPrompt}>
                            🔍 查看注入Prompt
                        </button>
                    </div>
                )}
            </div>

            <div className={styles.filterBar}>
                <div className="cyber-tabs">
                    <button
                        className={`cyber-tab ${activeView === 'active' ? 'cyber-tab-active' : ''}`}
                        onClick={() => setActiveView('active')}
                    >
                        活跃素材 ({activeCount})
                    </button>
                    <button
                        className={`cyber-tab ${activeView === 'archived' ? 'cyber-tab-active' : ''}`}
                        onClick={() => setActiveView('archived')}
                    >
                        登记表 ({archivedCount})
                    </button>
                </div>
                <input
                    className="cyber-input"
                    placeholder="搜索素材..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <select
                    className="cyber-select"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="all">全部类型</option>
                    {Object.entries(MATERIAL_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                {activeView === 'active' && (
                    <button className="cyber-btn cyber-btn-primary" onClick={() => setShowCreate(true)}>
                        + 新建素材
                    </button>
                )}
                <span className={styles.filterCount}>共 {filteredCount} 条</span>
                <button
                    className="cyber-btn cyber-btn-sm"
                    onClick={() => setCollapsedTypes(prev =>
                        prev.size > 0 ? new Set() : new Set(['__mw__', '__sp__'])
                    )}
                >
                    {collapsedTypes.size > 0 ? '展开全部' : '折叠全部'}
                </button>
            </div>
        </>
    );
}
