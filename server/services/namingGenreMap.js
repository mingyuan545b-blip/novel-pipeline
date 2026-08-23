const GENRE_NAMING_MAP = {
    'xuanhuan': { id: 'xuanhuan', label: '玄幻修仙', tag: 'fantasy',
        surnamePool: ['叶', '萧', '林', '陈', '苏', '秦', '顾', '沈', '楚', '云', '风', '凌', '白', '墨', '陆'],
        maleGivenPool: ['辰', '逸', '轩', '墨', '渊', '凌', '尘', '昊', '衍', '玄', '清', '明', '远', '泽', '天'],
        femaleGivenPool: ['瑶', '月', '雪', '霜', '灵', '薇', '琳', '芸', '芷', '清', '梦', '烟', '素', '婉', '灵'],
        compoundRate: 0.3, maxSurnameLen: 1, titleWords: ['仙', '道', '圣', '尊', '帝', '神']
    },
    'urban': { id: 'urban', label: '都市', tag: 'modern',
        surnamePool: ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡'],
        maleGivenPool: ['浩', '磊', '鑫', '鹏', '强', '伟', '军', '杰', '涛', '明', '华', '峰', '博', '宇', '飞'],
        femaleGivenPool: ['婷', '雪', '静', '敏', '丽', '芳', '娟', '燕', '玲', '琳', '颖', '萍', '慧', '蕾', '薇'],
        compoundRate: 0.1, maxSurnameLen: 1, titleWords: ['总', '董', '长', '师', '哥', '姐']
    },
    'scifi': { id: 'scifi', label: '科幻', tag: 'scifi',
        surnamePool: ['星', '光', '银', '铁', '雷', '电', '风', '云', '天', '海'],
        maleGivenPool: ['航', '宇', '辰', '锋', '远', '极', '维', '域', '核', '芯'],
        femaleGivenPool: ['星', '月', '光', '影', '弦', '维', '晶', '虹', '澜', '漾'],
        compoundRate: 0.5, maxSurnameLen: 2, titleWords: ['长', '官', '师', '博士', '指挥']
    },
    'wuxia': { id: 'wuxia', label: '武侠', tag: 'wuxia',
        surnamePool: ['令狐', '独孤', '欧阳', '西门', '慕容', '南宫', '东方', '上官', '司空', '诸葛'],
        maleGivenPool: ['冲', '求败', '锋', '无敌', '天', '云', '风', '剑', '啸', '鸣'],
        femaleGivenPool: ['蓉', '盈', '昭', '婉', '霜', '冰', '月', '雪', '灵', '芷'],
        compoundRate: 0.6, maxSurnameLen: 2, titleWords: ['侠', '剑', '掌门', '长老', '宗师']
    },
    'horror': { id: 'horror', label: '灵异', tag: 'horror',
        surnamePool: ['阴', '鬼', '冥', '幽', '寒', '冷', '暗', '夜', '影', '魂'],
        maleGivenPool: ['冥', '幽', '寒', '寂', '灭', '绝', '封', '镇', '渡', '归'],
        femaleGivenPool: ['幽', '冥', '寒', '影', '魂', '魄', '怨', '怜', '寂', '殇'],
        compoundRate: 0.2, maxSurnameLen: 1, titleWords: ['师', '先生', '道长', '大师']
    },
    'game': { id: 'game', label: '网游', tag: 'game',
        surnamePool: ['暗', '光', '龙', '凤', '影', '风', '雷', '火', '冰', '星'],
        maleGivenPool: ['杀', '神', '皇', '帝', '王', '霸', '狂', '傲', '战', '灭'],
        femaleGivenPool: ['舞', '梦', '幻', '影', '月', '雪', '冰', '霜', '灵', '魅'],
        compoundRate: 0.7, maxSurnameLen: 2, titleWords: ['王', '皇', '神', '帝', '尊']
    }
};

function inferFromGenre(genreId) {
    if (!genreId) return null;
    const normalized = genreId.toLowerCase().replace(/[_-]/g, '');
    for (const [key, val] of Object.entries(GENRE_NAMING_MAP)) {
        if (normalized.includes(key) || key.includes(normalized)) return val;
    }
    return GENRE_NAMING_MAP['xuanhuan'];
}

module.exports = { GENRE_NAMING_MAP, inferFromGenre };
