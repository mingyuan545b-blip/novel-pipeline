export const TABS = [
    { key: 'auto-publish', label: '批量发布', icon: '⚡', color: 'var(--neon-orange)' },
    { key: 'platforms', label: '平台管理', icon: '⬡', color: 'var(--neon-blue)' },
    { key: 'queue', label: '发布队列', icon: '⟐', color: 'var(--neon-green)' },
    { key: 'interactions', label: '读者互动', icon: '◈', color: 'var(--neon-pink)' }
];

export const MULTI_PLATFORMS = [
    { key: 'fanqie', name: '番茄小说', icon: '🍅', color: '#FF6B35', writerUrl: 'https://fanqienovel.com/main/writer/book-manage' },
    { key: 'qimao', name: '七猫小说', icon: '🐱', color: '#E74C3C', writerUrl: 'https://zuozhe.qimao.com' },
    { key: 'douyin', name: '抖音小说', icon: '🎵', color: '#1A1A2E', writerUrl: 'https://creator.douyin.com/creator-micro/content/publish' },
    { key: 'zhangyue', name: '掌阅 iReader', icon: '📖', color: '#3498DB', writerUrl: 'https://writer.zhangyue.com' },
    { key: 'shuqi', name: '书旗小说', icon: '📚', color: '#27AE60', writerUrl: 'https://writer.shuqi.com' }
];

export const defaultConfig = {
    cdpUrl: '', bookId: '', mode: 'immediate', scheduleInterval: 30,
    startFrom: 1, endAt: 0, limit: 0, fillOnly: false, dailyLimitChars: 500000
};

export const DEFAULT_ACCOUNT = {
    platformId: 'fanqie', penName: '', bookId: '', bookTitle: '',
    bookUrl: '', defaultSchedule: '09:00', notes: '', cookie: '', apiKey: ''
};

export const DEFAULT_INTERACTION = {
    platformName: '', chapterNumber: 0, type: 'comment',
    author: '', content: '', rating: null, needsReply: false
};

export const STATUS_LABELS = {
    published: '已发布',
    pending: '待发布',
    failed: '失败'
};

export const LOGIN_STATUS_MAP = {
    'logged-in': { text: '已登录', color: 'var(--neon-green)', bg: 'rgba(0,255,100,0.15)' },
    'waiting': { text: '等待登录', color: 'var(--neon-orange)', bg: 'rgba(255,165,0,0.15)' },
    'not-logged-in': { text: '未登录', color: 'var(--neon-red)', bg: 'rgba(255,0,0,0.15)' },
    'timeout': { text: '登录超时', color: 'var(--neon-red)', bg: 'rgba(255,0,0,0.15)' },
    'error': { text: '检测失败', color: 'var(--neon-red)', bg: 'rgba(255,0,0,0.15)' }
};

export const DEFAULT_LOGIN_BADGE = { text: '未检测', color: 'var(--text-muted)', bg: 'rgba(128,128,128,0.15)' };
