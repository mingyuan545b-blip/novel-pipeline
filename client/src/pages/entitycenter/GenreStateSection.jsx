
const GENRE_STATE_KEY_LABELS = {
    relationshipProgress: '关系进度', jobTitle: '职业', company: '公司',
    abilityLevel: '能力等级', dungeonLevel: '副本等级', sanity: '理智值',
    cultivationStage: '修炼境界', combatPowerLevel: '战力等级',
    sugarLevel: '甜度', chemistryLevel: '化学反应', craftMastery: '手艺精通',
    communityBond: '社区羁绊', emotionalWall: '心墙',
    techniques: '功法', magicTreasures: '法宝', sectRank: '宗门排名',
    spiritualRoot: '灵根', mp: '灵力', arcPhase: '叙事阶段',
    innerVoiceCount: '内心独白数', autonomousDecisionCount: '自主决策数',
    subversiveBehaviorCount: '颠覆行为数',
};

function StateTag({ label, value }) {
    if (value === undefined || value === '' || value === 0) return null;
    const display = Array.isArray(value) ? value.join(', ') : String(value);
    return (
        <div className="ec-state-tag">
            <span className="ec-state-label">{label}</span>
            <span className="ec-state-value">{display}</span>
        </div>
    );
}

export default function GenreStateSection({ adapted }) {
    // 已移除一个无效请求（2026-09-26）：
    // 原代码用 adapted.genreId（题材 id，如 high-martial-comedy）去调
    // GET /api/projects/:id/genre-constraints（该接口要的是**项目 id**），必然 404；
    // 且返回值只写进从未被读取的 _genreSchema。属于既浪费请求又污染控制台的死代码。
    // 题材约束另由 GenreConstraintsPanel 用真正的 projectId 获取。
    const genreState = adapted?.genreState || {};
    const genreId = adapted?.genreId || '';
    const hasState = Object.entries(genreState).some(([, v]) =>
        v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
    );

    if (!hasState && !genreId) {
        return (
            <div className="cyber-card ec-border-cyan">
                <h4 className="ec-section-title ec-color-cyan">
                    <span aria-hidden="true">⚡</span> 题材状态
                </h4>
                <div className="ec-text-12 ec-text-muted">暂无题材状态数据</div>
            </div>
        );
    }

    return (
        <div className="cyber-card ec-border-cyan">
            <h4 className="ec-section-title ec-color-cyan">
                <span aria-hidden="true">⚡</span> 题材状态
                {genreId && <span className="ec-badge ec-badge-cyan ec-ml-8">{genreId}</span>}
            </h4>
            {hasState ? (
                <div className="ec-state-grid">
                    {Object.entries(genreState).map(([key, value]) => (
                        <StateTag key={key} label={GENRE_STATE_KEY_LABELS[key] || key} value={value} />
                    ))}
                </div>
            ) : (
                <div className="ec-text-12 ec-text-muted">题材状态尚未初始化，首章Pipeline后自动填充</div>
            )}
        </div>
    );
}
