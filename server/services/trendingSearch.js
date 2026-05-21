const axios = require('axios');

const TRENDING_CACHE = {
    data: null,
    timestamp: 0,
    ttl: 30 * 60 * 1000
};

async function searchTrendingMemes(genre, keywords) {
    const now = Date.now();
    if (TRENDING_CACHE.data && (now - TRENDING_CACHE.timestamp) < TRENDING_CACHE.ttl) {
        return TRENDING_CACHE.data;
    }

    const results = {
        hotWords: [],
        memes: [],
        slang: [],
        abstract: []
    };

    try {
        const searchQueries = [
            `${genre}小说 热梗 2026`,
            `网络热词 抽象文学 2026`,
            `${keywords || genre} 梗 爽文 流行语`
        ];

        for (const query of searchQueries) {
            try {
                const res = await axios.get('https://suggest.taobao.com/sug', {
                    params: { code: 'utf-8', q: query },
                    timeout: 5000
                });
                if (res.data?.result) {
                    const words = res.data.result.map(r => r[0]).filter(Boolean);
                    results.hotWords.push(...words);
                }
            } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        }

        results.hotWords = [...new Set(results.hotWords)].slice(0, 20);
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

    const genreMemes = getGenreDefaultMemes(genre);
    results.memes = genreMemes.memes;
    results.slang = genreMemes.slang;
    results.abstract = genreMemes.abstract;

    const finalResult = {
        hotWords: results.hotWords.slice(0, 15),
        memes: results.memes,
        slang: results.slang,
        abstract: results.abstract,
        injectionHint: buildInjectionHint(results)
    };

    TRENDING_CACHE.data = finalResult;
    TRENDING_CACHE.timestamp = now;

    return finalResult;
}

function getGenreDefaultMemes(genre) {
    const MEME_DB = {
        '玄幻': {
            memes: ['开局一个碗', '这波啊这波是', '我有一个大胆的想法', '格局打开', '不愧是你', '就这？', '你礼貌吗', '好家伙', '离谱给离谱开门', '赢麻了', '蚌埠住了', '绷不住了', '6', '绝绝子', '真的会谢'],
            slang: ['逆天', '炸裂', '恐怖如斯', '此子断不可留', '大恐怖', '道友请留步', '恐怖如斯', '恐怖如斯'],
            abstract: ['遥遥领先', '尊嘟假嘟', '哈基米', 'i人e人', '显眼包', '绝绝子', '泰裤辣', '你个老六', '主打一个', '特种兵式']
        },
        '都市异能': {
            memes: ['格局小了', '这波赢麻了', '我直接好家伙', '不愧是你', '就这？', '你礼貌吗', '好家伙', '赢麻了', '蚌埠住了', '6', '真的会谢'],
            slang: ['降维打击', '降维', '碾压', '吊打', '秒杀', '血虐', '完爆', '降维碾压'],
            abstract: ['遥遥领先', '尊嘟假嘟', '哈基米', 'i人e人', '显眼包', '泰裤辣', '你个老六', '主打一个', '特种兵式', 'city不city']
        },
        '科幻': {
            memes: ['格局打开', '这波啊这波是', '我有一个大胆的想法', '不愧是你', '好家伙', '赢麻了', '蚌埠住了', '6'],
            slang: ['降维打击', '黑暗森林', '面壁者', '执剑人', '二向箔', '水滴'],
            abstract: ['遥遥领先', '尊嘟假嘟', '哈基米', 'i人e人', '显眼包', '泰裤辣', '你个老六', '主打一个']
        },
        'default': {
            memes: ['这波啊这波是', '我有一个大胆的想法', '格局打开', '不愧是你', '就这？', '好家伙', '赢麻了', '蚌埠住了', '6', '真的会谢'],
            slang: ['逆天', '炸裂', '碾压', '吊打', '秒杀', '血虐', '完爆'],
            abstract: ['遥遥领先', '尊嘟假嘟', '哈基米', 'i人e人', '显眼包', '泰裤辣', '你个老六', '主打一个', '特种兵式', 'city不city']
        }
    };

    return MEME_DB[genre] || MEME_DB['default'];
}

function buildInjectionHint(results) {
    const allWords = [
        ...results.memes.slice(0, 5),
        ...results.slang.slice(0, 3),
        ...results.abstract.slice(0, 3)
    ];

    if (allWords.length === 0) return '';

    return `【热梗/流行语注入提示 - 自然融入，不突兀】
可用热梗/流行语：${allWords.join('、')}
使用规则：
1. 只在对话或内心独白中使用，不要在旁白/描写中使用
2. 必须符合角色身份（年轻人/搞笑角色适合，严肃角色不适合）
3. 每章最多使用2-3个，不要堆砌
4. 融入方式：角色吐槽、内心OS、调侃对话
5. 示例："这波啊，这波是降维打击" "好家伙，直接赢麻了" "就这？我还以为多厉害呢"`;
}

module.exports = {
    searchTrendingMemes,
    getGenreDefaultMemes,
    buildInjectionHint
};
