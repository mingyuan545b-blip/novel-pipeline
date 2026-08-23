const { detectGenre } = require('./genreConfig');

// 陷阱#78修复：三类分离，不再混叫"管线元数据"
// ①管线内部标记泄露：pipeline内部技术标记，绝不该出现在正文（所有题材通用）
const PIPELINE_MARKER_PATTERNS = [
    { pattern: /藏经阁[·\.]?技法注入/g, type: '管线标记泄露', suggestion: '删除此标记，技法应融入叙事不可直述' },
    { pattern: /【藏经阁/g, type: '管线标记泄露', suggestion: '删除此标记' },
    { pattern: /技法注入[^】]/g, type: '管线标记泄露', suggestion: '删除此标记' },
    { pattern: /技法融入[】]/g, type: '管线标记泄露', suggestion: '删除此标记，技法应自然融入不可标注' },
];

// ②管线术语泄露：pipeline后台概念泄露（题材可配置，默认全题材拦截）
// 陷阱#78：程序员题材的"参数同步/循环数据归档"是正文用语，需题材插件覆盖
const DEFAULT_PIPELINE_TERM_PATTERNS = [
    { pattern: /伏笔追踪报告/g, type: '管线术语泄露', suggestion: '旧笔记/手写记录/盖着章的文件' },
    { pattern: /伏笔追踪日志/g, type: '管线术语泄露', suggestion: '旧笔记本/手写记录' },
    { pattern: /异常波动归零/g, type: '管线术语泄露', suggestion: '数字变正常了' },
    { pattern: /参数校准进度/g, type: '管线术语泄露', suggestion: '屏幕上的小绿线' },
    { pattern: /系统提示光点/g, type: '管线术语泄露', suggestion: '机器上的小灯' },
    { pattern: /参数同步/g, type: '管线术语泄露', suggestion: '机器滴滴响' },
    { pattern: /循环数据归档/g, type: '管线术语泄露', suggestion: '记好的数字' },
    { pattern: /主控逻辑/g, type: '管线术语泄露', suggestion: '管事的规矩' },
];

// ③元叙事章回引用：打破第四面墙（收窄，只拦"上一章/前一章"，不拦"第X章"标题）
const META_NARRATIVE_PATTERNS = [
    { pattern: /上[一二三四五六七八九十\d]+章/g, type: '元叙事章回引用', suggestion: '删除章回引用，改"之前"' },
    { pattern: /前[一二三四五六七八九十\d]+章/g, type: '元叙事章回引用', suggestion: '删除章回引用，改"之前"' },
    // 陷阱#74修复：第X章标题allowable，正文中"X章"需结合上下文判断
    { pattern: /[一二三四五六七八九十百千万\d]+章[前后以]?/g, type: '元叙事章回引用', suggestion: '删除章回引用' },
];

/**
 * 陷阱#78修复：从题材插件加载管线术语覆盖配置
 * 题材可通过 config.pipelineTermOverrides 覆盖默认管线术语词表
 * 例如程序员题材可设置 pipelineTermOverrides: { skip: ['参数同步', '循环数据归档', '主控逻辑'] }
 * 表示这些词在该题材正文里是合理用语，不拦截
 */
function _loadPipelineTermPatterns(styleProfile) {
    const genre = detectGenre(styleProfile);
    const overrides = genre?.pipelineTermOverrides || {};
    const skipPatterns = overrides.skip || [];
    if (skipPatterns.length === 0) return DEFAULT_PIPELINE_TERM_PATTERNS;
    // 过滤掉题材声明为正文用语的词
    return DEFAULT_PIPELINE_TERM_PATTERNS.filter(p => {
        for (const skip of skipPatterns) {
            if (p.pattern.source.includes(skip)) return false;
        }
        return true;
    });
}

function detectPipelineMetadataLeak(content, styleProfile) {
    if (!content) return { count: 0, instances: [] };
    // 陷阱#78修复：三类分离，第②类题材可配置
    const METADATA_PATTERNS = [
        ...PIPELINE_MARKER_PATTERNS,
        ..._loadPipelineTermPatterns(styleProfile),
        ...META_NARRATIVE_PATTERNS,
    ];
    const PROFESSIONAL_TERMS = [
        { pattern: /归档日志/g, type: '专业术语', suggestion: '旧记录/小本本' },
        { pattern: /观测数据/g, type: '专业术语', suggestion: '记下来的数字' },
        { pattern: /指标曲线/g, type: '专业术语', suggestion: '屏幕上的线' },
        { pattern: /反馈曲线/g, type: '专业术语', suggestion: '屏幕上的线' },
        { pattern: /拓扑图/g, type: '专业术语', suggestion: '连线图/地图' },
        { pattern: /坐标反馈/g, type: '专业术语', suggestion: '位置标记' },
        { pattern: /归档时间戳/g, type: '专业术语', suggestion: '记下的时间' },
        { pattern: /时间戳/g, type: '专业术语', suggestion: '日期/时间标记/小数字' },
        { pattern: /背景数据/g, type: '专业术语', suggestion: '背后的数字' }
    ];
    const genre = detectGenre(styleProfile);
    const genrePerspective = genre?.perspective;
    const ADULT_CONTEXT_MARKERS = genrePerspective?.adultViewMarkers || [];
    const BABY_VIEW_MARKERS = genrePerspective?.babyViewMarkers || [];
    const ADULT_CONTEXT_REGEX = ADULT_CONTEXT_MARKERS.length > 0 ? new RegExp(ADULT_CONTEXT_MARKERS.join('|')) : /(?!.*)/;
    const BABY_VIEW_REGEX = BABY_VIEW_MARKERS.length > 0 ? new RegExp(BABY_VIEW_MARKERS.join('|')) : /(?!.*)/;
    const instances = [];
    for (const { pattern, type, suggestion } of METADATA_PATTERNS) {
        const regex = new RegExp(pattern.source, 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
            // 章回引用误判修复：书名号内的"前X章/上X章/X章"是书籍章节引用，不是小说章回引用
            // 例如"《弟子规》前三章"是《弟子规》这本书的章节，合规
            let allowable = false;
            if (type === '打破第四面墙') {
                const before = content.substring(Math.max(0, match.index - 30), match.index);
                const after = content.substring(match.index + match[0].length, Math.min(content.length, match.index + match[0].length + 10));
                // 检查是否在书名号《》内或紧邻书名
                const inBookTitle = /《[^》]*$/.test(before) && /^[^《]*》/.test(after);
                const nearBookName = /《[^》]+》/.test(before.substring(before.length - 15));
                // 陷阱#74修复：章节标题"第X章：标题"是合规格式，不是打破第四面墙
                // match前面紧跟"第"（如"第1章"）属于章节标题，allowable=true
                // 真正的打破第四面墙是正文中"上一章/前一章"等元叙事引用，不带"第"
                const isChapterTitle = /第$/.test(before);
                if (inBookTitle || nearBookName || isChapterTitle) allowable = true;
            }
            instances.push({ match: match[0], type, suggestion, position: match.index, allowable });
        }
    }
    const paragraphs = content.split(/\n\n+/);
    const paragraphContexts = paragraphs.map(p => {
        if (ADULT_CONTEXT_REGEX.test(p) && !BABY_VIEW_REGEX.test(p)) return 'adult';
        if (BABY_VIEW_REGEX.test(p) && !ADULT_CONTEXT_REGEX.test(p)) return 'baby';
        if (ADULT_CONTEXT_REGEX.test(p) && BABY_VIEW_REGEX.test(p)) return 'mixed';
        return 'unknown';
    });
    let charOffset = 0;
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        const para = paragraphs[pIdx];
        const context = paragraphContexts[pIdx];
        for (const { pattern, type, suggestion } of PROFESSIONAL_TERMS) {
            const regex = new RegExp(pattern.source, 'g');
            let match;
            while ((match = regex.exec(para)) !== null) {
                const globalPos = charOffset + match.index;
                const matchStart = Math.max(0, match.index - 60);
                const matchEnd = Math.min(para.length, match.index + match[0].length + 60);
                const sentenceContext = para.substring(matchStart, matchEnd);
                const isNearAdult = ADULT_CONTEXT_REGEX.test(sentenceContext);
                const isNearBaby = BABY_VIEW_REGEX.test(sentenceContext);
                const isAllowable = isNearAdult && !isNearBaby;
                instances.push({ match: match[0], type, suggestion, position: globalPos, perspective: context, allowable: isAllowable, note: isAllowable ? '成人角色语境中专业术语使用合理' : (context === 'baby' ? '幼崽视角中专业术语需降维' : '视角不确定，需确认') });
            }
        }
        charOffset += para.length + 2;
    }
    const metadataCount = instances.filter(i => !i.allowable).length;
    return { count: metadataCount, instances: instances.slice(0, 20), totalMatches: instances.length, adultAllowable: instances.filter(i => i.allowable).length };
}

module.exports = { detectPipelineMetadataLeak };
