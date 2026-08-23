import s from './ChapterIntentDisplay.module.css';

const COLOR_MAP = {
    blue: s.colorBlue, green: s.colorGreen, red: s.colorRed,
    gold: s.colorGold, orange: s.colorOrange, purple: s.colorPurple,
    cyan: s.colorCyan, pink: s.colorPink, lavender: s.colorLavender,
};

export default function ChapterIntentDisplay({ selectedChapter, chapterIntentInfo, setChapterIntentInfo }) {
    if (!selectedChapter || !chapterIntentInfo) return null;

    const intent = chapterIntentInfo.intent;

    const renderIntentField = (label, icon, colorKey, value) => {
        if (!value) return null;
        const display = typeof value === 'string' ? value : JSON.stringify(value);
        return (
            <div className={s.intentField}>
                <span className={`${s.intentFieldLabel} ${COLOR_MAP[colorKey]}`}>{icon} {label}:</span> {display}
            </div>
        );
    };

    const renderListField = (label, icon, colorKey, items) => {
        if (!items?.length) return null;
        return (
            <div className={s.intentField}>
                <span className={`${s.intentFieldLabel} ${COLOR_MAP[colorKey]}`}>{icon} {label}:</span> {items.map(i => typeof i === 'string' ? i : JSON.stringify(i)).join(' | ')}
            </div>
        );
    };

    return (
        <div className={s.intentPanel}>
            <div className={s.intentHeader}>
                <span className={s.intentTitle}>📋 章节意图 第{selectedChapter.chapterNumber}</span>
                <button className="cyber-btn cyber-btn-sm" onClick={() => setChapterIntentInfo(null)}></button>
            </div>
            <div className={s.intentBody}>
                {renderIntentField('目标', '🎯', 'blue', intent.goal)}
                {renderListField('必须保持', '✅', 'green', intent.mustKeep)}
                {renderListField('必须避免', '🚫', 'red', intent.mustAvoid)}
                {renderIntentField('风格强调', '🎨', 'gold', intent.styleEmphasis)}
                {renderIntentField('冲突', '⚔️', 'orange', intent.conflictDesign)}
                {renderIntentField('章末钩子', '🪝', 'purple', intent.chapterEndHook)}
                {renderListField('推进伏笔', '📌', 'cyan', intent.hookAdvance)}
                {renderListField('回收伏笔', '🔓', 'pink', intent.hookResolve)}
                {intent.hookAgenda && (
                    <div className={s.intentField}>
                        <span className={`${s.intentFieldLabel} ${s.colorLavender}`}>📊 伏笔预算:</span> {intent.hookAgenda.budgetUsed || 0}/{intent.hookAgenda.budgetMax || '?'} 已用
                    </div>
                )}
            </div>
        </div>
    );
}
