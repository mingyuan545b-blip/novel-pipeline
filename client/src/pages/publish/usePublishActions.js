import { publishApi } from '../../services/api';
import logger from '../../shared/logger';
import { MULTI_PLATFORMS, DEFAULT_ACCOUNT, DEFAULT_INTERACTION } from './publishConstants';

function createMultiPlatformActions(state) {
    const { currentProject, multiConfigs, setLoginResults, setUpdatePlatform, setUpdateChapterInput, setUpdateRangeStart, setUpdateRangeEnd, setShowUpdateDialog } = state;

    const handleCheckLogin = async (platformKey) => {
        const config = multiConfigs[platformKey];
        setLoginResults(prev => ({ ...prev, [platformKey]: null }));
        try {
            const res = await publishApi.multiCheckLogin(platformKey, config.cdpUrl);
            const loggedIn = res.data?.loggedIn;
            setLoginResults(prev => ({ ...prev, [platformKey]: loggedIn ? 'logged-in' : 'not-logged-in' }));
            const pName = MULTI_PLATFORMS.find(p => p.key === platformKey)?.name || platformKey;
            alert(loggedIn ? `${pName} 已登录！` : `${pName} 未登录：${res.data?.reason || '请先登录'}`);
        } catch (e) {
            setLoginResults(prev => ({ ...prev, [platformKey]: 'error' }));
            alert(`检测失败: ${e.message}`);
        }
    };

    const handleOpenWriter = async (platformKey) => {
        const config = multiConfigs[platformKey];
        try {
            const res = await publishApi.multiOpenWriter(platformKey, config.cdpUrl);
            alert(res.data?.success ? `已打开${MULTI_PLATFORMS.find(p => p.key === platformKey)?.name}创作后台` : `打开失败: ${res.data?.error || '未知错误'}`);
        } catch (e) { alert(`打开失败: ${e.message}`); }
    };

    const handleOpenEditor = async (platformKey) => {
        const config = multiConfigs[platformKey];
        if (!config.bookId) { alert('请先填写作品ID'); return; }
        try {
            const res = await publishApi.multiOpenEditor(platformKey, config.cdpUrl, config.bookId);
            alert(res.data?.success ? '已打开作品编辑页' : `打开失败: ${res.data?.error || '未知错误'}`);
        } catch (e) { alert(`打开失败: ${e.message}`); }
    };

    const handleMultiPublish = async (platformKey) => {
        if (!currentProject) { alert('请先选择项目'); return; }
        const config = multiConfigs[platformKey];
        if (!config.bookId && platformKey === 'fanqie') { alert('请先填写番茄作品ID'); return; }
        try {
            const res = await publishApi.multiPublish({ projectId: currentProject.id, platform: platformKey, ...config });
            const pName = MULTI_PLATFORMS.find(p => p.key === platformKey)?.name;
            alert(res.data?.started ? `${pName} 发布已启动，请查看实时状态` : `发布失败: ${res.data?.error || '未知错误'}`);
        } catch (e) { alert(`发布请求失败: ${e.response?.data?.error || e.message}`); }
    };

    const handleMultiStop = async (platformKey) => {
        try { await publishApi.multiStop(platformKey); } catch (e) { alert(e.message); }
    };

    const handleMultiUpdate = (platformKey) => {
        if (!currentProject) { alert('请先选择项目'); return; }
        if (!multiConfigs[platformKey].bookId) { alert('请先填写作品ID'); return; }
        setUpdatePlatform(platformKey);
        setUpdateChapterInput('');
        setUpdateRangeStart('');
        setUpdateRangeEnd('');
        setShowUpdateDialog(true);
    };

    const confirmMultiUpdate = async () => {
        const chapterNumbers = new Set();
        state.updateChapterInput.split(/[,，\s]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n > 0).forEach(n => chapterNumbers.add(n));
        const rs = parseInt(state.updateRangeStart, 10);
        const re = parseInt(state.updateRangeEnd, 10);
        if (!isNaN(rs) && !isNaN(re) && rs > 0 && re > 0) {
            for (let i = Math.min(rs, re); i <= Math.max(rs, re); i++) chapterNumbers.add(i);
        } else if (!isNaN(rs) && rs > 0 && (!state.updateRangeEnd || state.updateRangeEnd === '')) {
            chapterNumbers.add(rs);
        }
        if (chapterNumbers.size === 0) { alert('未输入有效章节号'); return; }
        const sorted = [...chapterNumbers].sort((a, b) => a - b);
        const config = multiConfigs[state.updatePlatform];
        try {
            const res = await publishApi.multiUpdate({ projectId: currentProject.id, platform: state.updatePlatform, chapterNumbers: sorted, cdpUrl: config.cdpUrl || '', bookId: config.bookId || '' });
            const pName = MULTI_PLATFORMS.find(p => p.key === state.updatePlatform)?.name;
            alert(res.data?.started ? `${pName} 修改模式已启动（${sorted.length}章），请查看实时状态` : `修改失败: ${res.data?.error || '未知错误'}`);
        } catch (e) { alert(`修改请求失败: ${e.response?.data?.error || e.message}`); }
        setShowUpdateDialog(false);
    };

    const handleMultiCloseBrowser = async (platformKey) => {
        try { await publishApi.multiCloseBrowser(platformKey); setLoginResults(prev => ({ ...prev, [platformKey]: null })); } catch (e) { logger.error('Publish', 'Close browser failed:', e.message); }
    };

    return { handleCheckLogin, handleOpenWriter, handleOpenEditor, handleMultiPublish, handleMultiStop, handleMultiUpdate, confirmMultiUpdate, handleMultiCloseBrowser };
}

function createAccountActions(state) {
    const { currentProject, newAccount, setNewAccount, setShowAddAccount, refreshData, platforms } = state;

    const handleAddAccount = async () => {
        if (!currentProject) return;
        try { await publishApi.addAccount({ projectId: currentProject.id, ...newAccount }); setNewAccount({ ...DEFAULT_ACCOUNT }); setShowAddAccount(false); refreshData(); } catch (e) { alert('添加失败: ' + e.message); }
    };
    const handleDeleteAccount = async (id) => {
        try { await publishApi.deleteAccount(id); refreshData(); } catch (e) { alert(e.message); }
    };
    const handleVerifyAccount = async (account) => {
        try {
            const res = await publishApi.verifyAccount(account.id);
            alert(res.data?.valid ? `${account.platformName} 账号验证成功！\n笔名: ${res.data.penName || account.penName}\n状态: 已登录` : `${account.platformName} 账号验证失败：${res.data?.message || 'Cookie已过期或无效'}\n请重新配置Cookie。`);
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

    return { handleAddAccount, handleDeleteAccount, handleVerifyAccount, handleOpenPlatform, handleEditAccount };
}

function createQueueActions(state) {
    const { currentProject, batchConfig, accounts, chapters, refreshData } = state;

    const handleAddToQueue = async (chapter) => {
        if (!currentProject || !batchConfig.platformAccountId) { alert('请先选择发布平台'); return; }
        const account = accounts.find(a => a.id === batchConfig.platformAccountId);
        try {
            await publishApi.addToQueue({ projectId: currentProject.id, chapterId: chapter.id, chapterNumber: chapter.chapterNumber, chapterTitle: chapter.title, content: chapter.content, platformAccountId: batchConfig.platformAccountId, platformName: account?.platformName || '', scheduledTime: new Date(Date.now() + state.queue.length * batchConfig.scheduleInterval * 60000).toISOString() });
            refreshData();
        } catch (e) { alert('添加失败: ' + e.message); }
    };
    const handleBatchAdd = async () => {
        if (!currentProject || !batchConfig.platformAccountId) { alert('请先选择发布平台'); return; }
        const account = accounts.find(a => a.id === batchConfig.platformAccountId);
        const completed = chapters.filter(ch => ch.content);
        if (completed.length === 0) { alert('没有已完成的章节'); return; }
        try { await publishApi.batchAddToQueue({ projectId: currentProject.id, chapters: completed, platformAccountId: batchConfig.platformAccountId, platformName: account?.platformName || '', scheduleInterval: batchConfig.scheduleInterval }); refreshData(); } catch (e) { alert('批量添加失败: ' + e.message); }
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

    return { handleAddToQueue, handleBatchAdd, handleMarkPublished, handleMarkFailed, handleDeleteQueueItem, handleFormatContent };
}

function createInteractionActions(state) {
    const { currentProject, newInteraction, setNewInteraction, setShowAddInteraction, refreshData } = state;

    const handleAddInteraction = async () => {
        if (!currentProject) return;
        try { await publishApi.addInteraction({ projectId: currentProject.id, ...newInteraction }); setNewInteraction({ ...DEFAULT_INTERACTION }); setShowAddInteraction(false); refreshData(); } catch (e) { alert('添加失败: ' + e.message); }
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

    return { handleAddInteraction, handleReplyInteraction, handleMarkRead, handleDeleteInteraction };
}

export function usePublishActions(state) {
    const multi = createMultiPlatformActions(state);
    const account = createAccountActions(state);
    const queue = createQueueActions(state);
    const interaction = createInteractionActions(state);

    return { ...multi, ...account, ...queue, ...interaction };
}
