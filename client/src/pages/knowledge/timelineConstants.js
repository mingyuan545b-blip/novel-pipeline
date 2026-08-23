export const EVENT_TYPE_LABELS = {
    battle: { label: '⚔ 战斗', color: '#ff4757' },
    meeting: { label: '🤝 会面', color: '#2ed573' },
    discovery: { label: '💡 发现', color: '#ffa502' },
    travel: { label: '🚶 旅行', color: '#1e90ff' },
    death: { label: '💀 死亡', color: '#ff6b81' },
    birth: { label: '👶 诞生', color: '#7bed9f' },
    ceremony: { label: '🎭 仪式', color: '#a29bfe' },
    betrayal: { label: '🗡 背叛', color: '#ff4757' },
    alliance: { label: '🤝 结盟', color: '#2ed573' },
    breakthrough: { label: '⬆ 突破', color: '#ffd700' },
    event: { label: '📌 事件', color: '#70a1ff' }
};

export const SIGNIFICANCE_LABELS = {
    critical: { label: '核心', color: '#ff4757' },
    major: { label: '重大', color: '#ffa502' },
    normal: { label: '普通', color: '#70a1ff' },
    minor: { label: '次要', color: '#747d8c' }
};

export const STORYLINE_LABELS = {
    main: { label: '主线', color: '#ff4757' },
    sub: { label: '支线', color: '#70a1ff' }
};

export const INITIAL_FORM = {
    chapterNumber: '', eventTime: '', eventType: 'event',
    actorIds: '', locationId: '', description: '',
    precedingEventIds: '', duration: '', significance: 'normal', storyline: 'sub'
};
