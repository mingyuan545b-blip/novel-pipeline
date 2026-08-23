const store = require('../store');
const { getDataContext } = require('./dataContext');

const BEAT_TEMPLATES = {
    novel: {
        name: '长篇节拍',
        beatsPerChapter: { min: 3, max: 6 },
        pattern: ['setup', 'tension', 'escalation', 'climax', 'resolution'],
        requiredBeats: ['setup', 'climax'],
        chapterEndBeat: 'hook'
    }
};

const BEAT_DESCRIPTIONS = {
    setup: '铺垫：建立场景、角色状态、当前局势',
    tension: '张力：引入矛盾或压力，打破平衡',
    escalation: '升级：冲突加剧，风险提升',
    climax: '高潮：核心冲突爆发，关键对决或揭示',
    resolution: '收束：冲突暂时解决或转移',
    hook: '钩子：章末悬念，让读者想继续阅读',
    provocation: '挑衅：对手或环境对主角施压',
    reversal: '反转：局势突然变化',
    face_slap: '打脸：主角反击/翻盘的爽点时刻',
    aftermath: '余波：打脸后的反应和影响',
    twist: '转折：出人意料的变化',
    cliffhanger: '悬念结尾：危机未解或新威胁出现'
};

class BeatAllocator {
    constructor(projectId) {
        this.projectId = projectId;
    }

    async _getProject() {
        const _baCtx = await getDataContext(this.projectId);
        return await _baCtx.getProject();
    }

    async _getBeatStore() {
        const project = await this._getProject();
        if (!project) return null;
        if (!project._beatAllocator) {
            project._beatAllocator = {
                chapterBeats: {},
                techniqueBindings: {}
            };
        }
        return project._beatAllocator;
    }

    async _saveBeatStore(bs) {
        const project = await this._getProject();
        if (!project) return;
        project._beatAllocator = bs;
        store.setItem('projects', this.projectId, project);
    }

    async allocateBeatsForChapter(chapterNumber, chapterOutline, mode) {
        const template = BEAT_TEMPLATES[mode] || BEAT_TEMPLATES.novel;
        const beats = [];
        const outline = chapterOutline || '';

        const beatCount = Math.min(
            template.beatsPerChapter.max,
            Math.max(template.beatsPerChapter.min, Math.ceil(outline.length / 50) + 2)
        );

        const pattern = template.pattern.slice(0, beatCount);
        if (!pattern.includes(template.chapterEndBeat)) {
            pattern[pattern.length - 1] = template.chapterEndBeat;
        }

        for (const required of template.requiredBeats) {
            if (!pattern.includes(required)) {
                pattern.splice(pattern.length - 2, 0, required);
            }
        }

        for (let i = 0; i < pattern.length; i++) {
            const beatType = pattern[i];
            beats.push({
                index: i,
                type: beatType,
                description: BEAT_DESCRIPTIONS[beatType] || beatType,
                targetWordRatio: this._getWordRatio(i, pattern.length),
                techniqueHint: this._getTechniqueHint(beatType, mode)
            });
        }

        const bs = await this._getBeatStore();
        if (bs) {
            bs.chapterBeats[chapterNumber] = beats;
            await this._saveBeatStore(bs);
        }

        return beats;
    }

    _getWordRatio(index, total) {
        if (total <= 1) return 1.0;
        if (index === 0) return 0.15;
        if (index === total - 1) return 0.15;
        return 0.7 / (total - 2);
    }

    _getTechniqueHint(beatType, mode) {
        const hints = {
            setup: ['氛围式开头', '环境映射法', '逐步揭示法'],
            tension: ['桌下炸弹', '信息差设计', '命运悬丝'],
            escalation: ['复合型', '蝴蝶效应', '人与环境'],
            climax: ['物理高潮', '心理高潮', '复合型高潮', '身份反转'],
            resolution: ['闭合式', '首尾呼应式'],
            hook: ['章末钩子', '悬念式开头', '命运悬丝'],
            provocation: ['人与自我', '复合型', '道德困境引导'],
            reversal: ['信息反转', '目标反转', '情感反转'],
            face_slap: ['读者爽感', '打脸', '反差破除法'],
            aftermath: ['情绪过山车', '复合情感叠加'],
            twist: ['结构反转', '身份反转', '不可靠叙述者'],
            cliffhanger: ['命运悬丝', '桌下炸弹', '倒计时模型']
        };
        return hints[beatType] || [];
    }

    async bindTechniqueToBeat(chapterNumber, beatIndex, techId) {
        const bs = await this._getBeatStore();
        if (!bs) return;
        const key = `${chapterNumber}_${beatIndex}`;
        bs.techniqueBindings[key] = techId;
        await this._saveBeatStore(bs);
    }

    async formatBeatsForPrompt(chapterNumber, mode, beatsOverride) {
        const bs = await this._getBeatStore();
        const beats = beatsOverride || bs?.chapterBeats?.[chapterNumber];
        if (!beats || !beats.length) return '';

        const lines = ['\n【节拍分配】'];
        for (const beat of beats) {
            const techBinding = bs?.techniqueBindings?.[`${chapterNumber}_${beat.index}`];
            const techNote = techBinding ? ` → 技法:${techBinding}` : '';
            lines.push(`  ${beat.index + 1}. [${beat.type}] ${beat.description}${techNote}`);
        }
        return lines.join('\n');
    }

    async getChapterBeats(chapterNumber) {
        const bs = await this._getBeatStore();
        return bs?.chapterBeats?.[chapterNumber] || [];
    }
}

function getBeatAllocator(projectId) {
    return new BeatAllocator(projectId);
}

module.exports = { BeatAllocator, getBeatAllocator, BEAT_TEMPLATES, BEAT_DESCRIPTIONS };
