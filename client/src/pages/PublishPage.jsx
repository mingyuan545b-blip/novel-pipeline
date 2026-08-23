import { useState } from 'react';
import { usePublish, TABS } from './publish/usePublish';
import PublishConfigPanel from './publish/PublishConfigPanel';
import PlatformPanel from './publish/PlatformPanel';
import PublishQueuePanel from './publish/PublishQueuePanel';
import InteractionPanel from './publish/InteractionPanel';
import UpdateDialog from './publish/UpdateDialog';

export default function PublishPage() {
    const [activeTab, setActiveTab] = useState('auto-publish');
    const pub = usePublish();

    if (!pub.currentProject) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title">发布中心</h1>
                    <p className="page-subtitle">多平台批量发布 | 定时上传 | 读者互动</p>
                </div>
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">◈</div>
                    <div>请先在仪表盘选择一个项目</div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">发布中心</h1>
                <p className="page-subtitle">多平台批量发布 | 定时上传 | 读者互动</p>
            </div>

            <StatsBar publishStats={pub.publishStats} approvedCount={pub.approvedCount} />

            <div className="cyber-tabs publish-tabs">
                {TABS.map(tab => (
                    <button key={tab.key}
                        className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={activeTab === tab.key ? { borderColor: tab.color, color: tab.color } : undefined}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'auto-publish' && (
                <PublishConfigPanel
                    multiConfigs={pub.multiConfigs} setMultiConfigs={pub.setMultiConfigs}
                    multiStatuses={pub.multiStatuses} multiLogs={pub.multiLogs}
                    expandedPlatform={pub.expandedPlatform} setExpandedPlatform={pub.setExpandedPlatform}
                    loginChecking={pub.loginChecking} loginResults={pub.loginResults}
                    onCheckLogin={pub.handleCheckLogin} onOpenWriter={pub.handleOpenWriter}
                    onOpenEditor={pub.handleOpenEditor} onPublish={pub.handleMultiPublish}
                    onStop={pub.handleMultiStop} onUpdate={pub.handleMultiUpdate}
                    onCloseBrowser={pub.handleMultiCloseBrowser}
                    getLoginStatusBadge={pub.getLoginStatusBadge} />
            )}

            {activeTab === 'platforms' && (
                <PlatformPanel
                    platforms={pub.platforms} accounts={pub.accounts}
                    showAddAccount={pub.showAddAccount} setShowAddAccount={pub.setShowAddAccount}
                    newAccount={pub.newAccount} setNewAccount={pub.setNewAccount}
                    onAddAccount={pub.handleAddAccount} onDeleteAccount={pub.handleDeleteAccount}
                    onVerifyAccount={pub.handleVerifyAccount} onOpenPlatform={pub.handleOpenPlatform}
                    onEditAccount={pub.handleEditAccount} />
            )}

            {activeTab === 'queue' && (
                <PublishQueuePanel
                    chapters={pub.chapters} accounts={pub.accounts} queue={pub.queue}
                    batchConfig={pub.batchConfig} setBatchConfig={pub.setBatchConfig}
                    onAddToQueue={pub.handleAddToQueue} onBatchAdd={pub.handleBatchAdd}
                    onMarkPublished={pub.handleMarkPublished} onMarkFailed={pub.handleMarkFailed}
                    onDeleteQueueItem={pub.handleDeleteQueueItem}
                    onFormatContent={pub.handleFormatContent}
                    getStatusLabel={pub.getStatusLabel} />
            )}

            {activeTab === 'interactions' && (
                <InteractionPanel
                    interactions={pub.interactions} interactionStats={pub.interactionStats}
                    showAddInteraction={pub.showAddInteraction} setShowAddInteraction={pub.setShowAddInteraction}
                    newInteraction={pub.newInteraction} setNewInteraction={pub.setNewInteraction}
                    onAddInteraction={pub.handleAddInteraction}
                    onReplyInteraction={pub.handleReplyInteraction}
                    onMarkRead={pub.handleMarkRead}
                    onDeleteInteraction={pub.handleDeleteInteraction} />
            )}

            <UpdateDialog
                show={pub.showUpdateDialog} onClose={() => pub.setShowUpdateDialog(false)}
                onConfirm={pub.confirmMultiUpdate}
                updateChapterInput={pub.updateChapterInput} setUpdateChapterInput={pub.setUpdateChapterInput}
                updateRangeStart={pub.updateRangeStart} setUpdateRangeStart={pub.setUpdateRangeStart}
                updateRangeEnd={pub.updateRangeEnd} setUpdateRangeEnd={pub.setUpdateRangeEnd} />
        </div>
    );
}

function StatsBar({ publishStats, approvedCount }) {
    return (
        <div className="publish-stats-grid">
            <div className="cyber-card text-center">
                <div className="publish-stat-value text-blue">{publishStats?.totalPublished || 0}</div>
                <div className="text-sm text-muted">已发布</div>
                <div className="publish-stat-sub text-orange">{publishStats?.totalQueued || 0} 待发布</div>
            </div>
            <div className="cyber-card text-center">
                <div className="publish-stat-value text-green">{approvedCount}</div>
                <div className="text-sm text-muted">可发布章节</div>
                <div className="text-base text-muted">状态: approved / material-updated</div>
            </div>
        </div>
    );
}
