import { useState, useEffect, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { publishApi, chaptersApi } from '../services/api';

const TABS = [
    { key: 'auto-publish', label: '批量发布', icon: '⚡', color: 'var(--neon-orange)' },
    { key: 'platforms', label: '平台管理', icon: '⬡', color: 'var(--neon-blue)' },
    { key: 'queue', label: '发布队列', icon: '⟐', color: 'var(--neon-green)' },
    { key: 'interactions', label: '读者互动', icon: '◈', color: 'var(--neon-pink)' }
];

const MULTI_PLATFORMS = [
    { key: 'fanqie', name: '番茄小说', icon: '🍅', color: '#FF6B35', writerUrl: 'https://fanqienovel.com/main/writer/book-manage' },
    { key: 'qimao', name: '七猫小说', icon: '🐱', color: '#E74C3C', writerUrl: 'https://zuozhe.qimao.com' },
    { key: 'douyin', name: '抖音小说', icon: '🎵', color: '#1A1A2E', writerUrl: 'https://creator.douyin.com/creator-micro/content/publish' },
    { key: 'zhangyue', name: '掌阅 iReader', icon: '📖', color: '#3498DB', writerUrl: 'https://writer.zhangyue.com' },
    { key: 'shuqi', name: '书旗小说', icon: '📚', color: '#27AE60', writerUrl: 'https://writer.shuqi.com' }
];

const defaultConfig = {
    cdpUrl: '', bookId: '', mode: 'immediate', scheduleInterval: 30,
    startFrom: 1, endAt: 0, limit: 0, fillOnly: false, dailyLimitChars: 500000
};

export default function PublishPage() {
    const { currentProject, chapters, setChapters } = useAppStore();
    const [activeTab, setActiveTab] = useState('auto-publish');
    const [platforms, setPlatforms] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [queue, setQueue] = useState([]);
    const [interactions, setInteractions] = useState([]);
    const [publishStats, setPublishStats] = useState(null);
    const [interactionStats, setInteractionStats] = useState(null);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [showAddInteraction, setShowAddInteraction] = useState(false);
    const [newAccount, setNewAccount] = useState({ platformId: 'fanqie', penName: '', bookId: '', bookTitle: '', bookUrl: '', defaultSchedule: '09:00', notes: '', cookie: '', apiKey: '' });
    const [newInteraction, setNewInteraction] = useState({ platformName: '', chapterNumber: 0, type: 'comment', author: '', content: '', rating: null, needsReply: false });
    const [batchConfig, setBatchConfig] = useState({ platformAccountId: '', scheduleInterval: 30 });

    const [multiConfigs, setMultiConfigs] = useState(() => {
        const c = {};
        MULTI_PLATFORMS.forEach(p => {
            const saved = localStorage.getItem(`publish_config_${p.key}`);
            c[p.key] = saved ? { ...defaultConfig, ...JSON.parse(saved) } : { ...defaultConfig };
        });
        return c;
    });
    useEffect(() => {
        for (const [key, cfg] of Object.entries(multiConfigs)) {
            localStorage.setItem(`publish_config_${key}`, JSON.stringify(cfg));
        }
    }, [multiConfigs]);
    const [multiStatuses, setMultiStatuses] = useState({});
    const [expandedPlatform, setExpandedPlatform] = useState('fanqie');
    const [multiLogs, setMultiLogs] = useState({});
    const [loginChecking, setLoginChecking] = useState({});
    const [loginResults, setLoginResults] = useState({});
    const [updateChapterInput, setUpdateChapterInput] = useState('');
    const [updateRangeStart, setUpdateRangeStart] = useState('');
    const [updateRangeEnd, setUpdateRangeEnd] = useState('');
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);
    const [updatePlatform, setUpdatePlatform] = useState('');
    const pollRef = useRef(null);

    useEffect(() => {
        publishApi.getPlatforms().then(res => setPlatforms(res.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (currentProject) {
            refreshData();
            chaptersApi.list({ projectId: currentProject.id }).then(res => setChapters(res.data || [])).catch(console.error);
        }
    }, [currentProject]);

    useEffect(() => {
        const pollAll = async () => {
            try {
                const res = await publishApi.multiGetAllStatus();
                const statuses = res.data || {};
                setMultiStatuses(prev => {
                    for (const [platform, status] of Object.entries(statuses)) {
                        const prevStatus = prev[platform];
                        if (prevStatus?.running && !status.running && (status.completedChapters > 0 || status.failedChapters > 0)) {
                            const pName = MULTI_PLATFORMS.find(p => p.key === platform)?.name || platform;
                            setTimeout(() => alert(`${pName} 发布完成！成功: ${status.completedChapters}章, 失败: ${status.failedChapters}章`), 100);
                        }
                    }
                    return statuses;
                });
                const logs = {};
                for (const [platform, status] of Object.entries(statuses)) {
                    if (status.logs) logs[platform] = status.logs;
                    if (status.loginStatus) {
                        setLoginResults(prev => ({ ...prev, [platform]: status.loginStatus === 'logged-in' ? 'logged-in' : status.loginStatus === 'waiting' ? 'waiting' : status.loginStatus }));
                    }
                }
                setMultiLogs(prev => ({ ...prev, ...logs }));
            } catch (e) { }
        };
        pollAll();
        pollRef.current = setInterval(pollAll, 3000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const refreshData = () => {
        if (!currentProject) return;
        publishApi.getAccounts(currentProject.id).then(res => setAccounts(res.data || [])).catch(() => {});
        publishApi.getQueue(currentProject.id).then(res => setQueue(res.data || [])).catch(() => {});
        publishApi.getInteractions(currentProject.id).then(res => setInteractions(res.data || [])).catch(() => {});
        publishApi.getPublishStats(currentProject.id).then(res => setPublishStats(res.data || null)).catch(() => {});
        publishApi.getInteractionStats(currentProject.id).then(res => setInteractionStats(res.data || null)).catch(() => {});
    };

    const handleCheckLogin = async (platformKey) => {
        const config = multiConfigs[platformKey];
        setLoginChecking(prev => ({ ...prev, [platformKey]: true }));
        setLoginResults(prev => ({ ...prev, [platformKey]: null }));
        try {
            const res = await publishApi.multiCheckLogin(platformKey, config.cdpUrl);
            const loggedIn = res.data?.loggedIn;
            setLoginResults(prev => ({ ...prev, [platformKey]: loggedIn ? 'logged-in' : 'not-logged-in' }));
            if (loggedIn) {
                alert(`${MULTI_PLATFORMS.find(p => p.key === platformKey)?.name} 已登录！`);
            } else {
                alert(`${MULTI_PLATFORMS.find(p => p.key === platformKey)?.name} 未登录：${res.data?.reason || '请先登录'}`);
            }
        } catch (e) {
            setLoginResults(prev => ({ ...prev, [platformKey]: 'error' }));
            alert(`检测失败: ${e.message}`);
        } finally {
            setLoginChecking(prev => ({ ...prev, [platformKey]: false }));
        }
    };

    const handleOpenWriter = async (platformKey) => {
        const config = multiConfigs[platformKey];
        try {
            const res = await publishApi.multiOpenWriter(platformKey, config.cdpUrl);
            if (res.data?.success) {
                alert(`已打开${MULTI_PLATFORMS.find(p => p.key === platformKey)?.name}创作后台`);
            } else {
                alert(`打开失败: ${res.data?.error || '未知错误'}`);
            }
        } catch (e) {
            alert(`打开失败: ${e.message}`);
        }
    };

    const handleOpenEditor = async (platformKey) => {
        const config = multiConfigs[platformKey];
        if (!config.bookId) { alert('请先填写作品ID'); return; }
        try {
            const res = await publishApi.multiOpenEditor(platformKey, config.cdpUrl, config.bookId);
            if (res.data?.success) {
                alert(`已打开作品编辑页`);
            } else {
                alert(`打开失败: ${res.data?.error || '未知错误'}`);
            }
        } catch (e) {
            alert(`打开失败: ${e.message}`);
        }
    };

    const handleMultiPublish = async (platformKey) => {
        if (!currentProject) { alert('请先选择项目'); return; }
        const config = multiConfigs[platformKey];
        if (!config.bookId && platformKey === 'fanqie') { alert('请先填写番茄作品ID'); return; }
        try {
            const res = await publishApi.multiPublish({
                projectId: currentProject.id,
                platform: platformKey,
                ...config
            });
            if (res.data?.started) {
                alert(`${MULTI_PLATFORMS.find(p => p.key === platformKey)?.name} 发布已启动，请查看实时状态`);
            } else {
                alert(`发布失败: ${res.data?.error || '未知错误'}`);
            }
        } catch (e) {
            alert(`发布请求失败: ${e.response?.data?.error || e.message}`);
        }
    };

    const handleMultiStop = async (platformKey) => {
        try { await publishApi.multiStop(platformKey); } catch (e) { alert(e.message); }
    };

    const handleMultiUpdate = (platformKey) => {
        if (!currentProject) { alert('请先选择项目'); return; }
        const config = multiConfigs[platformKey];
        if (!config.bookId) { alert('请先填写作品ID'); return; }
        setUpdatePlatform(platformKey);
        setUpdateChapterInput('');
        setUpdateRangeStart('');
        setUpdateRangeEnd('');
        setShowUpdateDialog(true);
    };

    const confirmMultiUpdate = async () => {
        const chapterNumbers = new Set();
        updateChapterInput.split(/[,，\s]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n > 0).forEach(n => chapterNumbers.add(n));
        const rangeStart = parseInt(updateRangeStart, 10);
        const rangeEnd = parseInt(updateRangeEnd, 10);
        if (!isNaN(rangeStart) && !isNaN(rangeEnd) && rangeStart > 0 && rangeEnd > 0) {
            const lo = Math.min(rangeStart, rangeEnd);
            const hi = Math.max(rangeStart, rangeEnd);
            for (let i = lo; i <= hi; i++) chapterNumbers.add(i);
        } else if (!isNaN(rangeStart) && rangeStart > 0 && (!updateRangeEnd || updateRangeEnd === '')) {
            chapterNumbers.add(rangeStart);
        }
        if (chapterNumbers.size === 0) { alert('未输入有效章节号'); return; }
        const sortedNumbers = [...chapterNumbers].sort((a, b) => a - b);
        const config = multiConfigs[updatePlatform];
        try {
            const res = await publishApi.multiUpdate({
                projectId: currentProject.id,
                platform: updatePlatform,
                chapterNumbers: sortedNumbers,
                cdpUrl: config.cdpUrl || '',
                bookId: config.bookId || ''
            });
            if (res.data?.started) {
                alert(`${MULTI_PLATFORMS.find(p => p.key === updatePlatform)?.name} 修改模式已启动（${sortedNumbers.length}章），请查看实时状态`);
            } else {
                alert(`修改失败: ${res.data?.error || '未知错误'}`);
            }
        } catch (e) {
            alert(`修改请求失败: ${e.response?.data?.error || e.message}`);
        }
        setShowUpdateDialog(false);
    };

    const handleMultiCloseBrowser = async (platformKey) => {
        try {
            await publishApi.multiCloseBrowser(platformKey);
            setLoginResults(prev => ({ ...prev, [platformKey]: null }));
        } catch (e) { console.error(e); }
    };

    const handleAddAccount = async () => {
        if (!currentProject) return;
        try {
            await publishApi.addAccount({ projectId: currentProject.id, ...newAccount });
            setNewAccount({ platformId: 'fanqie', penName: '', bookId: '', bookTitle: '', bookUrl: '', defaultSchedule: '09:00', notes: '', cookie: '', apiKey: '' });
            setShowAddAccount(false);
            refreshData();
        } catch (e) { alert('添加失败: ' + e.message); }
    };

    const handleDeleteAccount = async (id) => {
        try { await publishApi.deleteAccount(id); refreshData(); } catch (e) { alert(e.message); }
    };

    const handleVerifyAccount = async (account) => {
        try {
            const res = await publishApi.verifyAccount(account.id);
            if (res.data?.valid) {
                alert(`${account.platformName} 账号验证成功！\n笔名: ${res.data.penName || account.penName}\n状态: 已登录`);
            } else {
                alert(`${account.platformName} 账号验证失败：${res.data?.message || 'Cookie已过期或无效'}\n请重新配置Cookie。`);
            }
            refreshData();
        } catch (e) { alert('验证请求失败: ' + e.message); }
    };

    const handleOpenPlatform = (account) => {
        const platform = platforms.find(p => p.id === account.platformId);
        if (platform?.url) window.open(platform.url, '_blank');
    };

    const handleEditAccount = async (id, data) => {
        try { await publishApi.updateAccount(id, data); refreshData(); } catch (e) { alert('更新失败: ' + e.message); }
    };

    const handleAddToQueue = async (chapter) => {
        if (!currentProject || !batchConfig.platformAccountId) { alert('请先选择发布平台'); return; }
        const account = accounts.find(a => a.id === batchConfig.platformAccountId);
        try {
            await publishApi.addToQueue({
                projectId: currentProject.id, chapterId: chapter.id, chapterNumber: chapter.chapterNumber,
                chapterTitle: chapter.title, content: chapter.content, platformAccountId: batchConfig.platformAccountId,
                platformName: account?.platformName || '',
                scheduledTime: new Date(Date.now() + queue.length * batchConfig.scheduleInterval * 60000).toISOString()
            });
            refreshData();
        } catch (e) { alert('添加失败: ' + e.message); }
    };

    const handleBatchAdd = async () => {
        if (!currentProject || !batchConfig.platformAccountId) { alert('请先选择发布平台'); return; }
        const account = accounts.find(a => a.id === batchConfig.platformAccountId);
        const completedChapters = chapters.filter(ch => ch.content);
        if (completedChapters.length === 0) { alert('没有已完成的章节'); return; }
        try {
            await publishApi.batchAddToQueue({
                projectId: currentProject.id, chapters: completedChapters,
                platformAccountId: batchConfig.platformAccountId, platformName: account?.platformName || '',
                scheduleInterval: batchConfig.scheduleInterval
            });
            refreshData();
        } catch (e) { alert('批量添加失败: ' + e.message); }
    };

    const handleMarkPublished = async (id) => {
        try { await publishApi.updateQueueItem(id, { status: 'published', publishedAt: new Date().toISOString() }); refreshData(); } catch (e) { alert(e.message); }
    };

    const handleMarkFailed = async (id, error) => {
        try { await publishApi.updateQueueItem(id, { status: 'failed', errorMessage: error }); refreshData(); } catch (e) { alert(e.message); }
    };

    const handleDeleteQueueItem = async (id) => {
        try { await publishApi.deleteQueueItem(id); refreshData(); } catch (e) { alert(e.message); }
    };

    const handleFormatContent = async (chapter, platformId) => {
        try {
            const res = await publishApi.formatContent({ content: chapter.content, platformId, chapterNumber: chapter.chapterNumber, chapterTitle: chapter.title });
            const formatted = res.data;
            await navigator.clipboard.writeText(formatted.content);
            alert(`已复制 ${formatted.platformName} 格式内容到剪贴板！\n字数: ${formatted.wordCount}\n${formatted.withinLimit ? '字数在限制内' : `超出字数限制(${formatted.maxWords})`}`);
        } catch (e) { alert('格式化失败: ' + e.message); }
    };

    const handleAddInteraction = async () => {
        if (!currentProject) return;
        try {
            await publishApi.addInteraction({ projectId: currentProject.id, ...newInteraction });
            setNewInteraction({ platformName: '', chapterNumber: 0, type: 'comment', author: '', content: '', rating: null, needsReply: false });
            setShowAddInteraction(false);
            refreshData();
        } catch (e) { alert('添加失败: ' + e.message); }
    };

    const handleReplyInteraction = async (id, reply) => {
        try { await publishApi.updateInteraction(id, { reply, repliedAt: new Date().toISOString(), isRead: true }); refreshData(); } catch (e) { alert(e.message); }
    };

    const handleMarkRead = async (id) => {
        try { await publishApi.updateInteraction(id, { isRead: true }); refreshData(); } catch (e) { alert(e.message); }
    };

    const handleDeleteInteraction = async (id) => {
        try { await publishApi.deleteInteraction(id); refreshData(); } catch (e) { alert(e.message); }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'published': return '已发布';
            case 'pending': return '待发布';
            case 'failed': return '失败';
            default: return status;
        }
    };

    const getLoginStatusBadge = (platformKey) => {
        const status = loginResults[platformKey];
        const stateStatus = multiStatuses[platformKey]?.loginStatus;
        const effective = status || stateStatus;
        if (effective === 'logged-in') return { text: '已登录', color: 'var(--neon-green)', bg: 'rgba(0,255,100,0.15)' };
        if (effective === 'waiting') return { text: '等待登录', color: 'var(--neon-orange)', bg: 'rgba(255,165,0,0.15)' };
        if (effective === 'not-logged-in') return { text: '未登录', color: 'var(--neon-red)', bg: 'rgba(255,0,0,0.15)' };
        if (effective === 'timeout') return { text: '登录超时', color: 'var(--neon-red)', bg: 'rgba(255,0,0,0.15)' };
        if (effective === 'error') return { text: '检测失败', color: 'var(--neon-red)', bg: 'rgba(255,0,0,0.15)' };
        return { text: '未检测', color: 'var(--text-muted)', bg: 'rgba(128,128,128,0.15)' };
    };

    const approvedCount = chapters.filter(ch => ch.status === 'approved' || ch.status === 'material-updated').length;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">发布中心</h1>
                <p className="page-subtitle">多平台批量发布 | 定时上传 | 读者互动</p>
            </div>

            {!currentProject ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">◈</div>
                    <div>请先在仪表盘选择一个项目</div>
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div className="cyber-card" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--neon-blue)' }}>{publishStats?.totalPublished || 0}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>已发布</div>
                            <div style={{ fontSize: 14, color: 'var(--neon-orange)' }}>{publishStats?.totalQueued || 0} 待发布</div>
                        </div>
                        <div className="cyber-card" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--neon-green)' }}>{approvedCount}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>可发布章节</div>
                            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>状态: approved / material-updated</div>
                        </div>
                    </div>

                    <div className="cyber-tabs" style={{ marginBottom: 24 }}>
                        {TABS.map(tab => (
                            <button key={tab.key} className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                                style={activeTab === tab.key ? { borderColor: tab.color, color: tab.color } : {}}>
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'auto-publish' && (
                        <div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                {MULTI_PLATFORMS.map(p => {
                                    const status = multiStatuses[p.key];
                                    const isRunning = status?.running;
                                    const hasLogs = (multiLogs[p.key]?.length || 0) > 0;
                                    const loginBadge = getLoginStatusBadge(p.key);
                                    return (
                                        <button key={p.key}
                                            className={`cyber-btn ${expandedPlatform === p.key ? 'cyber-btn-primary' : ''}`}
                                            onClick={() => setExpandedPlatform(p.key)}
                                            style={{
                                                fontSize: 13, padding: '8px 16px',
                                                borderColor: expandedPlatform === p.key ? p.color : undefined,
                                                color: expandedPlatform === p.key ? p.color : undefined,
                                                position: 'relative'
                                            }}>
                                            {p.icon} {p.name}
                                            {isRunning && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: '#FF4444', animation: 'pulse 1s infinite' }} />}
                                            {!isRunning && loginBadge.text !== '未检测' && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: loginBadge.color }} />}
                                        </button>
                                    );
                                })}
                            </div>

                            {MULTI_PLATFORMS.map(p => {
                                const config = multiConfigs[p.key] || { ...defaultConfig };
                                const status = multiStatuses[p.key] || {};
                                const logs = multiLogs[p.key] || [];
                                const loginBadge = getLoginStatusBadge(p.key);
                                const isExpanded = expandedPlatform === p.key;
                                if (!isExpanded) return null;

                                return (
                                    <div key={p.key}>
                                        <div className="cyber-card" style={{ marginBottom: 16, borderColor: p.color }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontSize: 24 }}>{p.icon}</span>
                                                    <div>
                                                        <h4 style={{ color: p.color, margin: 0 }}>{p.name} 批量发布</h4>
                                                        <a href={p.writerUrl} target="_blank" rel="noreferrer"
                                                            style={{ fontSize: 11, color: 'var(--neon-blue)', textDecoration: 'none' }}>
                                                            {p.writerUrl}
                                                        </a>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <span style={{
                                                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                                        background: loginBadge.bg, color: loginBadge.color, fontWeight: 600
                                                    }}>
                                                        {loginBadge.text}
                                                    </span>
                                                    <span className={`cyber-badge ${status.running ? 'cyber-badge-red' : 'cyber-badge-green'}`} style={{ fontSize: 11 }}>
                                                        {status.running ? '发布中' : '空闲'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                                    📋 账号与登录
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button className="cyber-btn" onClick={() => handleCheckLogin(p.key)}
                                                        disabled={loginChecking[p.key]}
                                                        style={{ fontSize: 12, color: 'var(--neon-blue)', borderColor: 'var(--neon-blue)' }}>
                                                        {loginChecking[p.key] ? '⏳ 检测中...' : '🔍 检测登录'}
                                                    </button>
                                                    <button className="cyber-btn" onClick={() => handleOpenWriter(p.key)}
                                                        style={{ fontSize: 12, color: 'var(--neon-green)', borderColor: 'var(--neon-green)' }}>
                                                        🌐 打开创作后台
                                                    </button>
                                                    <button className="cyber-btn" onClick={() => handleOpenEditor(p.key)}
                                                        style={{ fontSize: 12, color: 'var(--neon-orange)', borderColor: 'var(--neon-orange)' }}>
                                                        ✏️ 打开作品编辑
                                                    </button>
                                                    <button className="cyber-btn" onClick={() => handleMultiCloseBrowser(p.key)} style={{ fontSize: 12 }}>
                                                        🚪 关闭浏览器
                                                    </button>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                                                    点击"检测登录"会启动浏览器并自动检测{p.name}的登录状态，未登录时请在浏览器中手动扫码登录
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                                <div className="form-group">
                                                    <label className="form-label">CDP连接地址（可选）</label>
                                                    <input className="cyber-input" value={config.cdpUrl}
                                                        onChange={e => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], cdpUrl: e.target.value } }))}
                                                        placeholder="http://127.0.0.1:9222" />
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                                        留空则启动本地浏览器；填CDP地址可接管已登录的Chrome
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">作品ID/书号</label>
                                                    <input className="cyber-input" value={config.bookId}
                                                        onChange={e => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], bookId: e.target.value } }))}
                                                        placeholder={`${p.name}作品ID`} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">发布模式</label>
                                                    <select className="cyber-input" value={config.mode}
                                                        onChange={e => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], mode: e.target.value } }))}>
                                                        <option value="immediate">立即发布</option>
                                                        <option value="scheduled">定时发布</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">定时间隔（分钟）</label>
                                                    <input className="cyber-input" type="number" value={config.scheduleInterval}
                                                        onChange={e => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], scheduleInterval: parseInt(e.target.value) || 30 } }))}
                                                        min={5} disabled={config.mode !== 'scheduled'} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">从第几章开始</label>
                                                    <input className="cyber-input" type="number" value={config.startFrom}
                                                        onChange={e => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], startFrom: parseInt(e.target.value) || 1 } }))}
                                                        min={1} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">到第几章结束（0=不限）</label>
                                                    <input className="cyber-input" type="number" value={config.endAt}
                                                        onChange={e => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], endAt: parseInt(e.target.value) || 0 } }))}
                                                        min={0} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">发布章数限制（0=全部）</label>
                                                    <input className="cyber-input" type="number" value={config.limit}
                                                        onChange={e => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], limit: parseInt(e.target.value) || 0 } }))}
                                                        min={0} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">每日字数上限</label>
                                                    <input className="cyber-input" type="number" value={config.dailyLimitChars}
                                                        onChange={e => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], dailyLimitChars: parseInt(e.target.value) || 50000 } }))}
                                                        min={10000} step={10000} />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, marginTop: 24 }}>
                                                        <input type="checkbox" checked={config.fillOnly}
                                                            onChange={e => setMultiConfigs(prev => ({ ...prev, [p.key]: { ...prev[p.key], fillOnly: e.target.checked } }))} />
                                                        仅填充模式（不点击发布按钮）
                                                    </label>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                {status.running ? (
                                                    <button className="cyber-btn" onClick={() => handleMultiStop(p.key)}
                                                        style={{ fontSize: 12, color: 'var(--neon-red)', borderColor: 'var(--neon-red)' }}>
                                                        ⏹ 停止
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button className="cyber-btn cyber-btn-primary" onClick={() => handleMultiPublish(p.key)}
                                                            style={{ fontSize: 12, borderColor: p.color, color: p.color }}>
                                                            ⚡ 批量发布
                                                        </button>
                                                        {p.key === 'qimao' && (
                                                            <button className="cyber-btn" onClick={() => handleMultiUpdate(p.key)}
                                                                style={{ fontSize: 12, borderColor: '#F39C12', color: '#F39C12' }}>
                                                                🔄 修改章节
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {status && (status.totalChapters > 0 || status.running || status.completedChapters > 0 || status.failedChapters > 0) && (
                                            <div className="cyber-card" style={{ marginBottom: 16 }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: 24, fontWeight: 700, color: status.running ? p.color : 'var(--neon-green)' }}>
                                                            {status.running ? '运行中' : '空闲'}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>状态</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--neon-blue)' }}>
                                                            {status.totalChapters || 0}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>总章数</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--neon-green)' }}>
                                                            {status.completedChapters || 0}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>已发布</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--neon-red)' }}>
                                                            {status.failedChapters || 0}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>失败</div>
                                                    </div>
                                                </div>
                                                {status.currentChapter && (
                                                    <div style={{ padding: '8px 12px', background: `${p.color}22`, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                                                        当前: 第{status.currentChapter.chapterNumber}章 {status.currentChapter.title}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="cyber-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <div className="cyber-section-title" style={{ margin: 0 }}>执行日志</div>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{logs.length} 条</span>
                                            </div>
                                            <div style={{
                                                maxHeight: 400, overflowY: 'auto', background: 'rgba(0,0,0,0.3)',
                                                borderRadius: 6, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12
                                            }}>
                                                {logs.length === 0 ? (
                                                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                                                        暂无日志，点击"检测登录"或"开始批量发布"启动
                                                    </div>
                                                ) : logs.map((log, i) => (
                                                    <div key={i} style={{ marginBottom: 4, lineHeight: 1.6 }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>
                                                            {new Date(log.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </span>
                                                        <span style={{ marginLeft: 8, color: log.msg.includes('失败') || log.msg.includes('异常') ? 'var(--neon-red)' : log.msg.includes('成功') ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                                                            {log.msg}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="cyber-card" style={{ marginTop: 16 }}>
                                            <div className="cyber-section-title" style={{ marginBottom: 8 }}>使用说明</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 2 }}>
                                                <div>1. <strong>检测登录</strong>：点击"检测登录"按钮，系统会启动浏览器并自动检测{p.name}的登录状态</div>
                                                <div>2. <strong>手动登录</strong>：如果未登录，在弹出的浏览器中手动扫码登录，系统会自动检测登录成功</div>
                                                <div>3. <strong>打开创作后台</strong>：登录后可点击"打开创作后台"查看作品管理页面</div>
                                                <div>4. <strong>打开作品编辑</strong>：填入作品ID后，点击"打开作品编辑"可直接进入章节编辑页面</div>
                                                <div>5. 填入{p.name}的<strong>作品ID</strong>（从作者后台URL中获取）</div>
                                                <div>6. 设置从第几章开始、发布章数限制等参数</div>
                                                <div>7. 点击"开始批量发布"，系统会自动逐章创建并发布</div>
                                                <div style={{ color: 'var(--neon-orange)' }}>⚠ 番茄发布流程：填标题→填正文→下一步→填章节序号→确定→下一步→忽略敏感词→确认发布</div>
                                                <div style={{ color: 'var(--neon-orange)' }}>⚠ 部分平台有每日发布字数上限，超出会自动停止</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'platforms' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div className="cyber-section-title" style={{ margin: 0 }}>已配置平台</div>
                                <button className="cyber-btn cyber-btn-primary" onClick={() => setShowAddAccount(true)}>+ 添加平台</button>
                            </div>

                            {showAddAccount && (
                                <div className="cyber-card" style={{ marginBottom: 16, borderColor: 'var(--neon-blue)' }}>
                                    <h4 style={{ color: 'var(--neon-blue)', marginBottom: 12 }}>添加平台账号</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div className="form-group">
                                            <label className="form-label">平台</label>
                                            <select className="cyber-input" value={newAccount.platformId}
                                                onChange={e => setNewAccount(prev => ({ ...prev, platformId: e.target.value }))}>
                                                {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">笔名</label>
                                            <input className="cyber-input" value={newAccount.penName}
                                                onChange={e => setNewAccount(prev => ({ ...prev, penName: e.target.value }))}
                                                placeholder="在该平台的笔名" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">作品ID/书号</label>
                                            <input className="cyber-input" value={newAccount.bookId}
                                                onChange={e => setNewAccount(prev => ({ ...prev, bookId: e.target.value }))}
                                                placeholder="平台作品ID" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">作品名称</label>
                                            <input className="cyber-input" value={newAccount.bookTitle}
                                                onChange={e => setNewAccount(prev => ({ ...prev, bookTitle: e.target.value }))}
                                                placeholder="在平台上的书名" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">作品链接</label>
                                            <input className="cyber-input" value={newAccount.bookUrl}
                                                onChange={e => setNewAccount(prev => ({ ...prev, bookUrl: e.target.value }))}
                                                placeholder="https://..." />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">默认发布时间</label>
                                            <input className="cyber-input" type="time" value={newAccount.defaultSchedule}
                                                onChange={e => setNewAccount(prev => ({ ...prev, defaultSchedule: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">备注</label>
                                        <textarea className="cyber-input" value={newAccount.notes}
                                            onChange={e => setNewAccount(prev => ({ ...prev, notes: e.target.value }))}
                                            rows={2} placeholder="Cookie、API Key等信息（注意安全）" />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button className="cyber-btn" onClick={() => setShowAddAccount(false)}>取消</button>
                                        <button className="cyber-btn cyber-btn-primary" onClick={handleAddAccount}>添加</button>
                                    </div>
                                </div>
                            )}

                            {accounts.length === 0 ? (
                                <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                                    暂无平台账号，点击上方按钮添加
                                </div>
                            ) : (
                                <div className="cyber-grid cyber-grid-2">
                                    {accounts.map(account => {
                                        const platform = platforms.find(p => p.id === account.platformId);
                                        return (
                                            <div key={account.id} className="cyber-card">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: platform?.color || '#888' }}></div>
                                                        <span style={{ fontWeight: 700, color: platform?.color || 'var(--text-secondary)' }}>{account.platformName}</span>
                                                        <span className={`cyber-badge ${account.status === 'active' ? 'cyber-badge-green' : 'cyber-badge-red'}`} style={{ fontSize: 10 }}>
                                                            {account.status === 'active' ? '已连接' : '未连接'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-green)', fontSize: 10 }}
                                                            onClick={() => handleVerifyAccount(account)}>验证登录</button>
                                                        <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-blue)', fontSize: 10 }}
                                                            onClick={() => handleOpenPlatform(account)}>打开平台</button>
                                                        <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-red)', fontSize: 10 }}
                                                            onClick={() => handleDeleteAccount(account.id)}>删除</button>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                                    <div>笔名: {account.penName || '-'}</div>
                                                    <div>作品: {account.bookTitle || '-'}</div>
                                                    {account.bookUrl && <div><a href={account.bookUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--neon-blue)', fontSize: 12 }}>{account.bookUrl.substring(0, 40)}...</a></div>}
                                                    <div>默认发布: {account.defaultSchedule}</div>
                                                    <div>Cookie: {account.cookie ? '已配置' : '未配置'}</div>
                                                </div>
                                                <div style={{ marginTop: 8 }}>
                                                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10 }}
                                                        onClick={() => {
                                                            const cookie = prompt('请输入Cookie（从浏览器开发者工具复制）:', account.cookie || '');
                                                            if (cookie !== null) handleEditAccount(account.id, { cookie });
                                                        }}>配置Cookie</button>
                                                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, marginLeft: 4 }}
                                                        onClick={() => {
                                                            const apiKey = prompt('请输入平台API Key（如有）:', account.apiKey || '');
                                                            if (apiKey !== null) handleEditAccount(account.id, { apiKey });
                                                        }}>配置API Key</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="cyber-section-title" style={{ marginTop: 24 }}>支持的平台</div>
                            <div className="cyber-grid cyber-grid-3">
                                {platforms.map(p => (
                                    <div key={p.id} className="cyber-card" style={{ textAlign: 'center', padding: 16 }}>
                                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: p.color, margin: '0 auto 8px' }}></div>
                                        <div style={{ fontWeight: 700, color: p.color, fontSize: 14 }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                            {p.minWordsPerChapter}-{p.maxWordsPerChapter}字/章
                                        </div>
                                        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {p.features.map(f => (
                                                <span key={f} className="cyber-badge cyber-badge-blue" style={{ fontSize: 9 }}>{f}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'queue' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div className="cyber-section-title" style={{ margin: 0 }}>发布队列</div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <select className="cyber-input" value={batchConfig.platformAccountId}
                                        onChange={e => setBatchConfig(prev => ({ ...prev, platformAccountId: e.target.value }))}
                                        style={{ width: 150 }}>
                                        <option value="">选择平台</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.platformName} - {a.penName}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <label className="form-label" style={{ margin: 0, fontSize: 12 }}>间隔(分):</label>
                                        <input className="cyber-input" type="number" value={batchConfig.scheduleInterval}
                                            onChange={e => setBatchConfig(prev => ({ ...prev, scheduleInterval: parseInt(e.target.value) || 30 }))}
                                            min={5} style={{ width: 50 }} />
                                    </div>
                                    <button className="cyber-btn cyber-btn-primary" onClick={handleBatchAdd}
                                        disabled={!batchConfig.platformAccountId}>
                                        批量加入队列
                                    </button>
                                </div>
                            </div>

                            <div className="cyber-section-title">已完成章节（点击加入队列）</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                                {chapters.filter(ch => ch.content).map(ch => (
                                    <button key={ch.id} className="cyber-btn cyber-btn-sm"
                                        onClick={() => handleAddToQueue(ch)}
                                        disabled={!batchConfig.platformAccountId}>
                                        第{ch.chapterNumber}章 {ch.title}
                                    </button>
                                ))}
                            </div>

                            <div className="cyber-section-title">格式化复制（一键复制平台格式）</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                                {accounts.map(account => (
                                    <div key={account.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{account.platformName}:</span>
                                        {chapters.filter(ch => ch.content).slice(0, 5).map(ch => (
                                            <button key={ch.id} className="cyber-btn cyber-btn-sm"
                                                onClick={() => handleFormatContent(ch, account.platformId)}
                                                style={{ fontSize: 10 }}>
                                                第{ch.chapterNumber}章
                                            </button>
                                        ))}
                                        {chapters.filter(ch => ch.content).length > 5 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>...</span>}
                                    </div>
                                ))}
                            </div>

                            <div className="cyber-section-title">队列列表</div>
                            {queue.length === 0 ? (
                                <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                                    队列为空，选择章节和平台后添加
                                </div>
                            ) : (
                                <div className="cyber-card">
                                    <table className="cyber-table">
                                        <thead>
                                            <tr>
                                                <th>章节</th>
                                                <th>平台</th>
                                                <th>计划时间</th>
                                                <th>状态</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {queue.map(item => (
                                                <tr key={item.id}>
                                                    <td style={{ fontWeight: 600 }}>第{item.chapterNumber}章 {item.chapterTitle}</td>
                                                    <td>{item.platformName}</td>
                                                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                                                        {new Date(item.scheduledTime).toLocaleString('zh-CN')}
                                                    </td>
                                                    <td>
                                                        <span className={`cyber-badge ${item.status === 'published' ? 'cyber-badge-green' : item.status === 'failed' ? 'cyber-badge-red' : 'cyber-badge-blue'}`}>
                                                            {getStatusLabel(item.status)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            {item.status === 'pending' && (
                                                                <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, color: 'var(--neon-green)' }}
                                                                    onClick={() => handleMarkPublished(item.id)}>标记已发布</button>
                                                            )}
                                                            {item.status === 'pending' && (
                                                                <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, color: 'var(--neon-red)' }}
                                                                    onClick={() => handleMarkFailed(item.id, '手动标记失败')}>标记失败</button>
                                                            )}
                                                            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, color: 'var(--neon-red)' }}
                                                                onClick={() => handleDeleteQueueItem(item.id)}>删除</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'interactions' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div className="cyber-section-title" style={{ margin: 0 }}>读者互动</div>
                                <button className="cyber-btn cyber-btn-primary" onClick={() => setShowAddInteraction(true)}>+ 添加互动</button>
                            </div>

                            {showAddInteraction && (
                                <div className="cyber-card" style={{ marginBottom: 16, borderColor: 'var(--neon-pink)' }}>
                                    <h4 style={{ color: 'var(--neon-pink)', marginBottom: 12 }}>添加互动记录</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div className="form-group">
                                            <label className="form-label">平台</label>
                                            <input className="cyber-input" value={newInteraction.platformName}
                                                onChange={e => setNewInteraction(prev => ({ ...prev, platformName: e.target.value }))}
                                                placeholder="番茄/七猫/抖音/掌阅/书旗" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">类型</label>
                                            <select className="cyber-input" value={newInteraction.type}
                                                onChange={e => setNewInteraction(prev => ({ ...prev, type: e.target.value }))}>
                                                <option value="comment">评论</option>
                                                <option value="review">书评</option>
                                                <option value="tip">打赏</option>
                                                <option value="question">提问</option>
                                                <option value="suggestion">建议</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">读者昵称</label>
                                            <input className="cyber-input" value={newInteraction.author}
                                                onChange={e => setNewInteraction(prev => ({ ...prev, author: e.target.value }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">章节号</label>
                                            <input className="cyber-input" type="number" value={newInteraction.chapterNumber}
                                                onChange={e => setNewInteraction(prev => ({ ...prev, chapterNumber: parseInt(e.target.value) || 0 }))} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">内容</label>
                                        <textarea className="cyber-input" value={newInteraction.content}
                                            onChange={e => setNewInteraction(prev => ({ ...prev, content: e.target.value }))}
                                            rows={3} placeholder="读者评论/反馈内容" />
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                                            <input type="checkbox" checked={newInteraction.needsReply}
                                                onChange={e => setNewInteraction(prev => ({ ...prev, needsReply: e.target.checked }))} />
                                            需要回复
                                        </label>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            <label className="form-label" style={{ margin: 0 }}>评分:</label>
                                            <input className="cyber-input" type="number" value={newInteraction.rating || ''}
                                                onChange={e => setNewInteraction(prev => ({ ...prev, rating: e.target.value ? parseFloat(e.target.value) : null }))}
                                                min={1} max={5} step={0.5} style={{ width: 60 }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                                        <button className="cyber-btn" onClick={() => setShowAddInteraction(false)}>取消</button>
                                        <button className="cyber-btn cyber-btn-primary" onClick={handleAddInteraction}>添加</button>
                                    </div>
                                </div>
                            )}

                            {interactionStats && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                                    <div className="cyber-card" style={{ textAlign: 'center', padding: 12 }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-blue)' }}>{interactionStats.comments}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>评论</div>
                                    </div>
                                    <div className="cyber-card" style={{ textAlign: 'center', padding: 12 }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-green)' }}>{interactionStats.tips}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>打赏</div>
                                    </div>
                                    <div className="cyber-card" style={{ textAlign: 'center', padding: 12 }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-orange)' }}>{interactionStats.questions}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>提问</div>
                                    </div>
                                    <div className="cyber-card" style={{ textAlign: 'center', padding: 12 }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-pink)' }}>{interactionStats.avgRating}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>平均评分</div>
                                    </div>
                                </div>
                            )}

                            {interactions.length === 0 ? (
                                <div className="cyber-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                                    暂无互动记录
                                </div>
                            ) : (
                                interactions.map(interaction => (
                                    <div key={interaction.id} className="cyber-card" style={{
                                        marginBottom: 12,
                                        borderLeft: `3px solid ${interaction.needsReply && !interaction.reply ? 'var(--neon-orange)' : interaction.isRead ? 'var(--neon-green)' : 'var(--neon-blue)'}`,
                                        opacity: interaction.isRead ? 0.8 : 1
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <span className="cyber-badge" style={{
                                                    background: interaction.type === 'tip' ? 'rgba(255,200,0,0.2)' :
                                                        interaction.type === 'question' ? 'rgba(0,240,255,0.2)' :
                                                            interaction.type === 'review' ? 'rgba(255,0,255,0.2)' : 'rgba(0,255,100,0.2)',
                                                    color: interaction.type === 'tip' ? '#FFC800' :
                                                        interaction.type === 'question' ? 'var(--neon-blue)' :
                                                            interaction.type === 'review' ? 'var(--neon-pink)' : 'var(--neon-green)'
                                                }}>
                                                    {interaction.type === 'comment' ? '评论' :
                                                        interaction.type === 'review' ? '书评' :
                                                            interaction.type === 'tip' ? '打赏' :
                                                                interaction.type === 'question' ? '提问' : '建议'}
                                                </span>
                                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13 }}>{interaction.author}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{interaction.platformName}</span>
                                                {interaction.chapterNumber > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>第{interaction.chapterNumber}章</span>}
                                                {interaction.rating && <span style={{ fontSize: 12, color: '#FFC800' }}>★{interaction.rating}</span>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                {!interaction.isRead && (
                                                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10 }}
                                                        onClick={() => handleMarkRead(interaction.id)}>已读</button>
                                                )}
                                                <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, color: 'var(--neon-red)' }}
                                                    onClick={() => handleDeleteInteraction(interaction.id)}>删除</button>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 8 }}>
                                            {interaction.content}
                                        </div>
                                        {interaction.reply ? (
                                            <div style={{ padding: '8px 12px', background: 'rgba(0,255,100,0.05)', borderRadius: 6, fontSize: 12, color: 'var(--neon-green)' }}>
                                                回复: {interaction.reply}
                                            </div>
                                        ) : (
                                            <ReplyInput id={interaction.id} onReply={handleReplyInteraction} />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </>
            )}
            {showUpdateDialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#1a1a2e', border: '1px solid var(--neon-cyan)', borderRadius: 8, padding: 24, minWidth: 440, maxWidth: 520 }}>
                        <h3 style={{ color: 'var(--neon-cyan)', marginBottom: 16, fontSize: 16 }}>🔄 修改章节到七猫</h3>
                        <div style={{ marginBottom: 16 }}>
                            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 6 }}>指定章节号（多个用逗号分隔）</p>
                            <input className="cyber-input" value={updateChapterInput}
                                onChange={e => setUpdateChapterInput(e.target.value)}
                                placeholder="如: 1,17,37,88"
                                style={{ width: '100%', fontSize: 14 }}
                                onKeyDown={e => { if (e.key === 'Enter') confirmMultiUpdate(); }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <span style={{ color: '#aaa', fontSize: 13, whiteSpace: 'nowrap' }}>批量范围</span>
                            <input className="cyber-input" value={updateRangeStart}
                                onChange={e => setUpdateRangeStart(e.target.value.replace(/[^\d]/g, ''))}
                                placeholder="起始章"
                                style={{ width: 100, fontSize: 14, textAlign: 'center' }}
                                onKeyDown={e => { if (e.key === 'Enter') confirmMultiUpdate(); }} />
                            <span style={{ color: '#666', fontSize: 14 }}>—</span>
                            <input className="cyber-input" value={updateRangeEnd}
                                onChange={e => setUpdateRangeEnd(e.target.value.replace(/[^\d]/g, ''))}
                                placeholder="结束章"
                                style={{ width: 100, fontSize: 14, textAlign: 'center' }}
                                onKeyDown={e => { if (e.key === 'Enter') confirmMultiUpdate(); }} />
                            <span style={{ color: '#555', fontSize: 12, whiteSpace: 'nowrap' }}>如 1 — 190</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button className="cyber-btn" onClick={() => setShowUpdateDialog(false)}
                                style={{ fontSize: 13, color: '#aaa', borderColor: '#555' }}>取消</button>
                            <button className="cyber-btn cyber-btn-primary" onClick={confirmMultiUpdate}
                                style={{ fontSize: 13, borderColor: '#F39C12', color: '#F39C12' }}>确认修改</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ReplyInput({ id, onReply }) {
    const [reply, setReply] = useState('');
    const [show, setShow] = useState(false);
    if (!show) {
        return <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10 }} onClick={() => setShow(true)}>回复</button>;
    }
    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="cyber-input" value={reply} onChange={e => setReply(e.target.value)}
                placeholder="输入回复内容..." style={{ flex: 1 }} />
            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, color: 'var(--neon-green)' }}
                onClick={() => { onReply(id, reply); setReply(''); setShow(false); }}>发送</button>
            <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10 }} onClick={() => setShow(false)}>取消</button>
        </div>
    );
}
