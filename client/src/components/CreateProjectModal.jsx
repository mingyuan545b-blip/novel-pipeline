import { useState, useRef, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { projectsApi, pipelineApi, materialsApi, chaptersApi, styleTemplateApi, promptConfigApi, flavorsApi } from '../services/api';

const GENRE_PRESETS = [
    { label: '🔮 玄幻修仙', value: '玄幻' },
    { label: '⚔ 都市异能', value: '都市异能' },
    { label: '🚀 科幻未来', value: '科幻' },
    { label: '🗡 武侠江湖', value: '武侠' },
    { label: '👻 灵异悬疑', value: '灵异' },
    { label: '🎮 网游虚拟', value: '网游' },
    { label: '👑 历史穿越', value: '历史' },
    { label: '💫 奇幻冒险', value: '奇幻' },
    { label: '🏢 都市商战', value: '商战' },
    { label: '🎭 言情古言', value: '言情' }
];

const ELEMENT_PRESETS = {
    '玄幻': ['修仙', '炼丹', '阵法', '渡劫', '飞升', '宗门', '秘境', '天劫', '道心', '灵根'],
    '都市异能': ['异能觉醒', '唯一', '隐藏身份', '势力对抗', '血脉', '契约', '觉醒', '进化', '禁区', '组织'],
    '科幻': ['未来科技', '星际', 'AI', '基因改造', '时空', '赛博朋克', '末世', '虫族', '机甲', '虚拟现实'],
    '武侠': ['内功', '轻功', '绝学', '门派', '江湖', '侠义', '秘籍', '暗器', '毒术', '奇遇'],
    '灵异': ['鬼怪', '阴阳眼', '驱魔', '诅咒', '轮回', '风水', '通灵', '封印', '灵异事件', '古墓'],
    '网游': ['全息', '职业', '副本', 'PK', '公会', 'BOSS', '隐藏任务', '神器', '转职', '国战'],
    '历史': ['穿越', '争霸', '权谋', '军事', '改革', '后宫', '朝堂', '名将', '盛世', '变法'],
    '奇幻': ['魔法', '龙族', '精灵', '矮人', '圣战', '预言', '神器', '异族', '冒险', '勇者'],
    '商战': ['创业', '金融', '科技', '商界', '资本', '并购', '逆袭', '天才', '市场', '黑幕'],
    '言情': ['甜宠', '虐恋', '重生', '穿越', '宫斗', '权谋', '世家', '青梅竹马', '先婚后爱', '追妻']
};

const STYLE_PRESETS = [
    { label: '热血爽文', value: '热血爽文' },
    { label: '暗黑深沉', value: '暗黑深沉' },
    { label: '轻松幽默', value: '轻松幽默' },
    { label: '悬疑烧脑', value: '悬疑烧脑' },
    { label: '唯美文艺', value: '唯美文艺' },
    { label: '硬核写实', value: '硬核写实' }
];

const TONE_PRESETS = [
    { label: '积极向上', value: '积极向上' },
    { label: '灰色压抑', value: '灰色压抑' },
    { label: '讽刺幽默', value: '讽刺幽默' },
    { label: '热血激昂', value: '热血激昂' },
    { label: '温情治愈', value: '温情治愈' }
];

const POV_PRESETS = [
    { label: '第一人称', value: '第一人称' },
    { label: '第三人称限制', value: '第三人称限制视角' },
    { label: '第三人称全知', value: '第三人称全知视角' },
    { label: '多视角切换', value: '多视角切换' }
];

const NOVEL_DEFAULT_CONSTRAINTS = ['no-derailment', 'proper-introduction', 'character-consistency', 'worldview-consistency', 'no-random-plot'];
const SHUANGWEN_DEFAULT_CONSTRAINTS = ['no-derailment', 'character-consistency', 'worldview-consistency', 'hook-every-chapter', 'fast-escalation', 'reader-satisfaction'];
const TOMATO_SHORT_DEFAULT_CONSTRAINTS = ['no-derailment', 'character-consistency', 'worldview-consistency', 'hook-every-chapter', 'fast-escalation', 'reader-satisfaction', 'tomato-metrics'];

const MODE_OPTIONS = [
    { value: 'shuangwen', label: '⚡ 爽文模式', desc: '番茄/七猫风格，快节奏短章，1500-2000字/章，3Agent精简流水线' },
    { value: 'tomato-short', label: '🍅 番茄爽文', desc: '番茄短篇爽文，1900-2100字/章，对话≤28%，8Agent流水线+硬校验' },
    { value: 'novel', label: '📖 长篇小说', desc: '超长篇深度创作，2500-3000字/章，5Agent完整流水线' }
];

export default function CreateProjectModal({ onClose, onCreated }) {
    const { setProjects, setMaterials, setChapters } = useAppStore();
    const [mode, setMode] = useState('template');
    const [projectMode, setProjectMode] = useState('novel');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [selectedElements, setSelectedElements] = useState([]);
    const [selectedConstraints, setSelectedConstraints] = useState(NOVEL_DEFAULT_CONSTRAINTS);
    const mountedRef = useRef(true);

    const isShuangwen = projectMode === 'shuangwen' || projectMode === 'tomato-short';

    const [form, setForm] = useState({
        name: '',
        genre: '',
        elements: '',
        targetChapters: 100,
        targetWords: '',
        style: '',
        tone: '',
        pov: '',
        setting: '',
        conflict: '',
        themes: '',
        description: '',
        styleTemplateId: '',
        settings: { autoPipeline: false, chapterRounds: 3 }
    });

    const [styleTemplates, setStyleTemplates] = useState([]);
    const [constraintPresets, setConstraintPresets] = useState([]);
    const [namingStyles, setNamingStyles] = useState([]);
    const [inferredNaming, setInferredNaming] = useState(null);
    const [selectedNamingStyle, setSelectedNamingStyle] = useState('');
    const [genreFullConfig, setGenreFullConfig] = useState(null);

    useEffect(() => {
        styleTemplateApi.listTemplates().then(res => setStyleTemplates(res.data || [])).catch(() => {});
        promptConfigApi.listConstraintPresets().then(res => setConstraintPresets(res.data || [])).catch(() => {});
        flavorsApi.getNamingStyles().then(res => setNamingStyles(res.data || [])).catch(() => {});
    }, []);

    const handleGenreSelect = (genre) => {
        setForm(f => ({ ...f, genre }));
        setSelectedElements([]);
        setSelectedNamingStyle('');
        setGenreFullConfig(null);
        if (genre) {
            flavorsApi.inferNamingStyle(genre).then(res => {
                setInferredNaming(res.data?.inferred || null);
            }).catch(() => setInferredNaming(null));
            flavorsApi.resolveGenreProfile(genre).then(res => {
                const cfg = res.data?.fullConfig;
                if (cfg) {
                    setGenreFullConfig(cfg);
                    if (cfg.styleHints?.style) setForm(f => ({ ...f, style: f.style || cfg.styleHints.style }));
                    if (cfg.styleHints?.tone) setForm(f => ({ ...f, tone: f.tone || cfg.styleHints.tone }));
                    if (cfg.styleHints?.pov) setForm(f => ({ ...f, pov: f.pov || cfg.styleHints.pov }));
                    if (cfg.defaultMode) setProjectMode(cfg.defaultMode);
                    if (cfg.wordConfig) setForm(f => ({ ...f, targetWords: f.targetWords || String(cfg.wordConfig.targetWords) }));
                }
            }).catch(() => setGenreFullConfig(null));
        } else {
            setInferredNaming(null);
        }
    };

    const toggleElement = (element) => {
        setSelectedElements(prev => {
            const next = prev.includes(element)
                ? prev.filter(e => e !== element)
                : prev.length >= 5 ? prev : [...prev, element];
            setForm(f => ({ ...f, elements: next.join('、') }));
            return next;
        });
    };

    const toggleConstraint = (id) => {
        setSelectedConstraints(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleProjectModeChange = (newMode) => {
        setProjectMode(newMode);
        setSelectedConstraints(newMode === 'shuangwen' ? SHUANGWEN_DEFAULT_CONSTRAINTS : newMode === 'tomato-short' ? TOMATO_SHORT_DEFAULT_CONSTRAINTS : NOVEL_DEFAULT_CONSTRAINTS);
        setForm(f => ({
            ...f,
            settings: { ...f.settings, chapterRounds: newMode === 'shuangwen' || newMode === 'tomato-short' ? 2 : 3, targetChapters: newMode === 'tomato-short' ? 28 : f.settings?.targetChapters }
        }));
    };

    const handleShuangwenOneClick = async (params) => {
        setProgress('⚡ 搜索热梗 + AI构思爽文设定...');
        const res = await pipelineApi.shuangwenOneClick(params);

        const taskId = res.data?.taskId;
        if (!taskId) {
            alert('启动爽文一键成型任务失败');
            setLoading(false);
            return null;
        }

        let projectId = null;
        const pollStart = Date.now();
        const MAX_POLL_TIME = 10 * 60 * 1000;
        while (true) {
            if (!mountedRef.current) return null;
            if (Date.now() - pollStart > MAX_POLL_TIME) {
                alert('生成超时(10分钟)，请稍后在项目列表中查看');
                break;
            }
            await new Promise(r => setTimeout(r, 3000));
            if (!mountedRef.current) return null;
            const taskRes = await pipelineApi.getTaskStatus(taskId);
            const task = taskRes.data;

            if (task.status === 'completed') {
                projectId = task.result?.projectId;
                break;
            } else if (task.status === 'failed') {
                alert('生成失败: ' + (task.error || task.result?.error || '未知错误'));
                setLoading(false);
                setProgress('');
                return null;
            }
            const elapsed = Math.round((Date.now() - task.startedAt) / 1000);
            const progressMsg = task.progress || 'AI正在生成中...';
            setProgress(`⚡ ${progressMsg} 已用时${elapsed}秒`);
        }

        if (projectId) {
            setProgress('爽文生成完成，加载数据...');
            const projRes = await projectsApi.list();
            setProjects(projRes.data);
            try {
                const matList = await materialsApi.list({ projectId });
                setMaterials(matList.data || []);
            } catch (_) {}
            try {
                const chList = await chaptersApi.list({ projectId });
                setChapters(chList.data || []);
            } catch (_) {}
            const project = projRes.data?.find(p => p.id === projectId);
            if (project) onCreated?.(project);
        }
        return projectId;
    };

    const handleTemplateGenerate = async (templateParams) => {
        setProgress('AI正在构思世界观、人物、任务、时间线和大纲...');
        const res = await pipelineApi.generateFromTemplate(templateParams);

        const taskId = res.data?.taskId;
        if (!taskId) {
            alert('启动生成任务失败');
            setLoading(false);
            return null;
        }

        let projectId = null;
        const pollStart = Date.now();
        const MAX_POLL_TIME = 10 * 60 * 1000;
        while (true) {
            if (!mountedRef.current) return null;
            if (Date.now() - pollStart > MAX_POLL_TIME) {
                alert('生成超时(10分钟)，请稍后在项目列表中查看');
                break;
            }
            await new Promise(r => setTimeout(r, 3000));
            if (!mountedRef.current) return null;
            const taskRes = await pipelineApi.getTaskStatus(taskId);
            const task = taskRes.data;

            if (task.status === 'completed') {
                projectId = task.result?.projectId;
                break;
            } else if (task.status === 'failed') {
                alert('生成失败: ' + (task.error || task.result?.error || '未知错误'));
                setLoading(false);
                setProgress('');
                return null;
            }
            const elapsed = Math.round((Date.now() - task.startedAt) / 1000);
            setProgress(`AI正在生成中... 已用时${elapsed}秒`);
        }

        if (projectId) {
            setProgress('生成完成，加载数据...');
            const projRes = await projectsApi.list();
            setProjects(projRes.data);
            try {
                const matList = await materialsApi.list({ projectId });
                setMaterials(matList.data || []);
            } catch (_) {}
            try {
                const chList = await chaptersApi.list({ projectId });
                setChapters(chList.data || []);
            } catch (_) {}
            const project = projRes.data?.find(p => p.id === projectId);
            if (project) onCreated?.(project);
        }
        return projectId;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setLoading(true);

        try {
            if (mode === 'template' && isShuangwen) {
                await handleShuangwenOneClick({
                    name: form.name,
                    genre: form.genre,
                    elements: form.elements,
                    targetChapters: form.targetChapters,
                    style: form.style,
                    tone: form.tone,
                    pov: form.pov,
                    setting: form.setting,
                    conflict: form.conflict,
                    themes: form.themes,
                    constraints: selectedConstraints,
                    namingStyle: selectedNamingStyle || (inferredNaming?.id || '') || (genreFullConfig?.namingStyle || ''),
                    worldviewTemplate: genreFullConfig?.worldviewTemplate || '',
                    systemPersona: genreFullConfig?.defaultSystemPersona || '',
                    genreProfile: genreFullConfig?.genreProfile || ''
                });
            } else if (mode === 'template') {
                await handleTemplateGenerate({
                    name: form.name,
                    genre: form.genre,
                    elements: form.elements,
                    targetChapters: form.targetChapters,
                    targetWords: form.targetWords,
                    style: form.style,
                    tone: form.tone,
                    pov: form.pov,
                    setting: form.setting,
                    conflict: form.conflict,
                    themes: form.themes,
                    styleTemplateId: form.styleTemplateId,
                    constraints: selectedConstraints,
                    mode: projectMode,
                    namingStyle: selectedNamingStyle || (inferredNaming?.id || '') || (genreFullConfig?.namingStyle || ''),
                    worldviewTemplate: genreFullConfig?.worldviewTemplate || '',
                    systemPersona: genreFullConfig?.defaultSystemPersona || '',
                    genreProfile: genreFullConfig?.genreProfile || ''
                });
            } else {
                if (form.autoSupplement && form.genre) {
                    await handleTemplateGenerate({
                        name: form.name,
                        genre: form.genre,
                        elements: form.elements,
                        targetChapters: form.targetChapters,
                        style: form.style,
                        tone: form.tone || '',
                        pov: form.pov || '',
                        setting: form.description || '',
                        conflict: '',
                        themes: '',
                        styleTemplateId: form.styleTemplateId,
                        constraints: selectedConstraints,
                        mode: projectMode,
                        namingStyle: selectedNamingStyle || (inferredNaming?.id || '') || (genreFullConfig?.namingStyle || ''),
                        worldviewTemplate: genreFullConfig?.worldviewTemplate || '',
                        systemPersona: genreFullConfig?.defaultSystemPersona || '',
                        genreProfile: genreFullConfig?.genreProfile || ''
                    });
                } else {
                    const res = await projectsApi.create({
                        name: form.name,
                        description: form.description,
                        genre: form.genre,
                        mode: projectMode,
                        targetChapters: form.targetChapters,
                        styleTemplateId: form.styleTemplateId,
                        constraints: selectedConstraints,
                        settings: form.settings,
                        styleProfile: {
                            namingStyle: selectedNamingStyle || (inferredNaming?.id || '') || (genreFullConfig?.namingStyle || ''),
                            namingStyleIntensity: genreFullConfig?.namingStyleIntensity || 'medium',
                            worldviewTemplate: genreFullConfig?.worldviewTemplate || '',
                            systemPersona: genreFullConfig?.defaultSystemPersona || '',
                            genreProfile: genreFullConfig?.genreProfile || '',
                            reviewFocus: genreFullConfig?.reviewFocus?.join('；') || '',
                            materialFocus: genreFullConfig?.materialFocus?.join('、') || '',
                            constraintOverrides: genreFullConfig?.constraintOverrides || []
                        },
                        wordConfig: genreFullConfig?.wordConfig || undefined
                    });
                    const listRes = await projectsApi.list();
                    setProjects(listRes.data);
                    onCreated?.(res.data);
                }
            }
            onClose();
        } catch (err) {
            console.error('Create project error:', err);
            alert('创建失败: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
            setProgress('');
        }
    };

    const currentElementPresets = ELEMENT_PRESETS[form.genre] || [];

    const renderConstraintSection = () => (
        <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>🔒 写作约束</label>
                <button type="button" className="cyber-btn cyber-btn-sm" style={{ fontSize: 11 }}
                    onClick={() => setSelectedConstraints(
                        selectedConstraints.length === constraintPresets.length ? [] : constraintPresets.map(c => c.id)
                    )}>
                    {selectedConstraints.length === constraintPresets.length ? '取消全选' : '全选'}
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {constraintPresets.map(c => (
                    <button key={c.id} type="button"
                        className={`cyber-btn cyber-btn-sm ${selectedConstraints.includes(c.id) ? 'cyber-btn-primary' : ''}`}
                        style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 12, padding: '6px 10px' }}
                        title={c.desc}
                        onClick={() => toggleConstraint(c.id)}>
                        {c.label}
                    </button>
                ))}
            </div>
            {selectedConstraints.length > 0 && (
                <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(0,240,255,0.05)', borderRadius: 6, borderLeft: '3px solid var(--neon-blue)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {selectedConstraints.map(id => constraintPresets.find(c => c.id === id)).filter(Boolean).map(c => (
                        <div key={c.id}><span style={{ color: 'var(--neon-blue)' }}>{c.label}</span> {c.desc}</div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="cyber-modal-overlay">
            <div className="cyber-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh' }}>
                <h2>{mode === 'template' ? '🚀 一键生成小说' : '创建新项目'}</h2>

                <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">创作模式</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {MODE_OPTIONS.map(opt => (
                            <button key={opt.value} type="button"
                                className={`cyber-btn ${projectMode === opt.value ? 'cyber-btn-primary' : ''}`}
                                style={{ flex: 1, padding: '12px 16px', textAlign: 'left' }}
                                onClick={() => handleProjectModeChange(opt.value)}>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{opt.label}</div>
                                <div style={{ fontSize: 11, color: projectMode === opt.value ? 'var(--text-secondary)' : 'var(--text-tertiary)', lineHeight: 1.4 }}>{opt.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="cyber-tabs" style={{ marginBottom: 16 }}>
                    <button className={`cyber-tab ${mode === 'template' ? 'cyber-tab-active' : ''}`}
                        onClick={() => setMode('template')}
                        style={mode === 'template' ? { borderColor: 'var(--neon-blue)', color: 'var(--neon-blue)' } : {}}>
                        🚀 模板一键生成
                    </button>
                    <button className={`cyber-tab ${mode === 'manual' ? 'cyber-tab-active' : ''}`}
                        onClick={() => setMode('manual')}
                        style={mode === 'manual' ? { borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)' } : {}}>
                        ✏ 手动创建
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">小说名称 *</label>
                        <input className="cyber-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="输入小说名称..." required />
                    </div>

                    <div className="form-group">
                        <label className="form-label">题材/类型 *</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {GENRE_PRESETS.map(g => (
                                <button key={g.value} type="button" className={`cyber-btn cyber-btn-sm ${form.genre === g.value ? 'cyber-btn-primary' : ''}`}
                                    onClick={() => handleGenreSelect(g.value)}>
                                    {g.label}
                                </button>
                            ))}
                        </div>
                        {!GENRE_PRESETS.find(g => g.value === form.genre) && form.genre && (
                            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--neon-blue)' }}>自定义: {form.genre}</div>
                        )}
                        <input className="cyber-input" style={{ marginTop: 8 }} value={form.genre} onChange={e => { setForm({ ...form, genre: e.target.value }); if (e.target.value) { flavorsApi.inferNamingStyle(e.target.value).then(res => setInferredNaming(res.data?.inferred || null)).catch(() => setInferredNaming(null)); } else { setInferredNaming(null); } }} placeholder="或输入自定义题材..." />
                    </div>

                    {form.genre && (
                        <div style={{ padding: '10px 14px', background: 'rgba(255,200,0,0.06)', borderRadius: 6, borderLeft: '3px solid var(--neon-orange)', marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-orange)', marginBottom: 6 }}>✒️ 命名风格</div>
                            {inferredNaming && !selectedNamingStyle && (
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                    🎯 题材「{form.genre}」推荐：<span style={{ color: 'var(--neon-orange)', fontWeight: 600 }}>{inferredNaming.label}</span>（{inferredNaming.tag}）— 系统将自动应用此风格为角色命名规范
                                </div>
                            )}
                            <select className="cyber-select" value={selectedNamingStyle} onChange={e => setSelectedNamingStyle(e.target.value)} style={{ fontSize: 12 }}>
                                <option value="">{inferredNaming ? `自动推断：${inferredNaming.label}（${inferredNaming.tag}）` : '自动推断（选择题材后推荐）'}</option>
                                {namingStyles.map(s => <option key={s.id} value={s.id}>{s.label}（{s.tag}）</option>)}
                            </select>
                            {selectedNamingStyle && (
                                <div style={{ fontSize: 11, color: 'var(--neon-blue)', marginTop: 4 }}>
                                    ✅ 已手动覆盖为：{namingStyles.find(s => s.id === selectedNamingStyle)?.label || selectedNamingStyle}
                                </div>
                            )}
                        </div>
                    )}

                    {genreFullConfig && form.genre && (
                        <div style={{ padding: '10px 14px', background: 'rgba(0,240,255,0.04)', borderRadius: 6, borderLeft: '3px solid var(--neon-blue)', marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-blue)', marginBottom: 8 }}>🎯 题材「{form.genre}」自动适配配置</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                                <div>🌍 世界观：<span style={{ color: 'var(--neon-cyan)' }}>{genreFullConfig.worldviewTemplate || '自动推断'}</span></div>
                                <div>✒️ 命名：<span style={{ color: 'var(--neon-orange)' }}>{genreFullConfig.namingStyle || '自动推断'}</span></div>
                                <div>📖 模式：<span style={{ color: 'var(--neon-green)' }}>{genreFullConfig.defaultMode === 'shuangwen' ? '爽文' : genreFullConfig.defaultMode === 'tomato-short' ? '番茄爽文' : '长篇'}</span></div>
                                <div>📝 字数：<span style={{ color: 'var(--neon-pink)' }}>{genreFullConfig.wordConfig?.targetWords || 2800}字/章</span></div>
                                <div>🤖 系统人格：<span style={{ color: 'var(--neon-purple)' }}>{genreFullConfig.defaultSystemPersona || '自动推断'}</span></div>
                            </div>
                            {genreFullConfig.defaultArchetypes?.length > 0 && (
                                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                                    🃏 推荐人设：{genreFullConfig.defaultArchetypes.join('、')}
                                </div>
                            )}
                            {genreFullConfig.reviewFocus?.length > 0 && (
                                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                                    🔍 审核重点：{genreFullConfig.reviewFocus.slice(0, 3).join('；')}
                                </div>
                            )}
                            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
                                以上配置将在创建项目时自动写入，可在项目设置中调整
                            </div>
                        </div>
                    )}

                    {mode === 'template' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">核心元素（选择或输入，最多5个）</label>
                                {currentElementPresets.length > 0 && (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                        {currentElementPresets.map(el => (
                                            <button key={el} type="button"
                                                className={`cyber-btn cyber-btn-sm ${selectedElements.includes(el) ? 'cyber-btn-primary' : ''}`}
                                                onClick={() => toggleElement(el)}>
                                                {el}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <input className="cyber-input" value={form.elements} onChange={e => {
                                    setForm(f => ({ ...f, elements: e.target.value }));
                                    setSelectedElements(e.target.value.split(/[、,，\s]+/).filter(Boolean));
                                }} placeholder="如：异能、唯一、未来科技（用顿号或逗号分隔）" />
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ flex: '0 0 140px' }}>
                                    <label className="form-label">目标章节数</label>
                                    <input className="cyber-input" type="number" value={form.targetChapters} onChange={e => setForm({ ...form, targetChapters: parseInt(e.target.value) || 100 })} min={1} />
                                </div>
                                <div className="form-group" style={{ flex: '0 0 140px' }}>
                                    <label className="form-label">目标字数</label>
                                    <input className="cyber-input" value={form.targetWords} onChange={e => setForm({ ...form, targetWords: e.target.value })} placeholder="如：300万" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">风格模板</label>
                                    <select className="cyber-select" value={form.styleTemplateId} onChange={e => setForm({ ...form, styleTemplateId: e.target.value })}>
                                        <option value="">不指定</option>
                                        {styleTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">写作风格</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {STYLE_PRESETS.map(s => (
                                        <button key={s.value} type="button" className={`cyber-btn cyber-btn-sm ${form.style === s.value ? 'cyber-btn-primary' : ''}`}
                                            onClick={() => setForm(f => ({ ...f, style: f.style === s.value ? '' : s.value }))}>
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">基调</label>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {TONE_PRESETS.map(t => (
                                            <button key={t.value} type="button" className={`cyber-btn cyber-btn-sm ${form.tone === t.value ? 'cyber-btn-primary' : ''}`}
                                                onClick={() => setForm(f => ({ ...f, tone: f.tone === t.value ? '' : t.value }))}>
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">叙事视角</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {POV_PRESETS.map(p => (
                                        <button key={p.value} type="button" className={`cyber-btn cyber-btn-sm ${form.pov === p.value ? 'cyber-btn-primary' : ''}`}
                                            onClick={() => setForm(f => ({ ...f, pov: f.pov === p.value ? '' : p.value }))}>
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">世界设定方向（可选）</label>
                                <input className="cyber-input" value={form.setting} onChange={e => setForm({ ...form, setting: e.target.value })} placeholder="如：末世废土、星际帝国、修仙大陆..." />
                            </div>

                            <div className="form-group">
                                <label className="form-label">核心冲突（可选）</label>
                                <input className="cyber-input" value={form.conflict} onChange={e => setForm({ ...form, conflict: e.target.value })} placeholder="如：人类vs异族、正道vs魔道、个人vs命运..." />
                            </div>

                            <div className="form-group">
                                <label className="form-label">主题（可选）</label>
                                <input className="cyber-input" value={form.themes} onChange={e => setForm({ ...form, themes: e.target.value })} placeholder="如：成长、自由、正义、救赎..." />
                            </div>

                            {renderConstraintSection()}
                        </>
                    )}

                    {mode === 'manual' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">描述</label>
                                <textarea className="cyber-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="描述你的小说需求、目标、选题..." rows={4} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">核心元素（选择或输入，最多5个）</label>
                                {currentElementPresets.length > 0 && (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                        {currentElementPresets.map(el => (
                                            <button key={el} type="button"
                                                className={`cyber-btn cyber-btn-sm ${selectedElements.includes(el) ? 'cyber-btn-primary' : ''}`}
                                                onClick={() => toggleElement(el)}>
                                                {el}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <input className="cyber-input" value={form.elements} onChange={e => {
                                    setForm(f => ({ ...f, elements: e.target.value }));
                                    setSelectedElements(e.target.value.split(/[、,，\s]+/).filter(Boolean));
                                }} placeholder="如：异能、唯一、未来科技（用顿号或逗号分隔）" />
                            </div>
                            <div className="form-row">
                                <div className="form-group" style={{ flex: '0 0 140px' }}>
                                    <label className="form-label">目标章节数</label>
                                    <input className="cyber-input" type="number" value={form.targetChapters} onChange={e => setForm({ ...form, targetChapters: parseInt(e.target.value) || 100 })} min={1} />
                                </div>
                                <div className="form-group" style={{ flex: '0 0 140px' }}>
                                    <label className="form-label">审核轮次</label>
                                    <input className="cyber-input" type="number" value={form.settings.chapterRounds} onChange={e => setForm({ ...form, settings: { ...form.settings, chapterRounds: parseInt(e.target.value) || 3 } })} min={1} max={10} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">风格模板</label>
                                    <select className="cyber-select" value={form.styleTemplateId} onChange={e => setForm({ ...form, styleTemplateId: e.target.value })}>
                                        <option value="">不指定</option>
                                        {styleTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">写作风格</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {STYLE_PRESETS.map(s => (
                                        <button key={s.value} type="button" className={`cyber-btn cyber-btn-sm ${form.style === s.value ? 'cyber-btn-primary' : ''}`}
                                            onClick={() => setForm(f => ({ ...f, style: f.style === s.value ? '' : s.value }))}>
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">叙事视角</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {POV_PRESETS.map(p => (
                                        <button key={p.value} type="button" className={`cyber-btn cyber-btn-sm ${form.pov === p.value ? 'cyber-btn-primary' : ''}`}
                                            onClick={() => setForm(f => ({ ...f, pov: f.pov === p.value ? '' : p.value }))}>
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {renderConstraintSection()}

                            <div style={{ padding: '10px 14px', background: 'rgba(126,87,194,0.08)', borderRadius: 6, borderLeft: '3px solid var(--neon-purple)', marginBottom: 12 }}>
                                <div style={{ fontSize: 13, color: 'var(--neon-purple)', fontWeight: 600, marginBottom: 4 }}>💡 自动补充设定</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    勾选后，AI 将根据你的描述和元素自动生成世界观、人物、大纲等完整设定，创建后可直接开始写作
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                                    <input type="checkbox" checked={form.autoSupplement || false} onChange={e => setForm({ ...form, autoSupplement: e.target.checked })} />
                                    启用AI自动补充完善设定
                                </label>
                            </div>
                        </>
                    )}

                    {progress && (
                        <div style={{ padding: '10px 14px', background: 'rgba(0,240,255,0.05)', borderRadius: 6, marginBottom: 12, fontSize: 13, color: 'var(--neon-blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="cyber-loading"></span>
                            {progress}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                        <button type="button" className="cyber-btn" onClick={onClose}>取消</button>
                        <button type="submit" className="cyber-btn cyber-btn-primary" disabled={loading || !form.name.trim() || !form.genre.trim()}>
                            {loading ? <><span className="cyber-loading"></span> {isShuangwen ? '⚡ 爽文成型中...' : '生成中(3-5分钟)...'}</> : mode === 'template' ? (isShuangwen ? '⚡ 爽文一键成型' : '🚀 一键生成') : (form.autoSupplement ? '🚀 创建并AI补充设定' : '创建项目')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
