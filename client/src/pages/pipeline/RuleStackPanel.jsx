import { pipelineApi } from '../../services/api';
import logger from '../../shared/logger';
import s from './RuleStackPanel.module.css';

const LAYER_COLORS = { L1: '#ff6b6b', L2: '#ffa502', L3: '#54a0ff', L4: '#2ed573' };
const LAYER_NAMES = { L1: '硬事实', L2: '作者意图', L3: '规划', L4: '当前任务' };

export default function RuleStackPanel({ currentProject, ruleStackInfo, setRuleStackInfo }) {
    const refresh = async () => {
        if (!currentProject) return;
        try {
            const res = await pipelineApi.getRuleStack(currentProject.id, 'writer');
            setRuleStackInfo(res.data);
        } catch (e) { logger.error('RuleStack', 'Refresh failed:', e.message); }
    };

    return (
        <div className={s.ruleStackPanel}>
            <div className={s.panelHeader}>
                <span className={s.panelTitle}>📚 规则(Rule Stack)</span>
                <button className="cyber-btn cyber-btn-sm" onClick={refresh} style={{ fontSize: 10 }}>刷新</button>
            </div>
            {ruleStackInfo ? (
                <div>
                    <div className={s.layerGrid}>
                        {Object.entries(ruleStackInfo.summary.byLayer || {}).map(([layer, count]) => (
                            <div key={layer} className={s.layerCard} style={{ border: `1px solid ${LAYER_COLORS[layer] || '#636e72'}40` }}>
                                <div className={s.layerCount} style={{ color: LAYER_COLORS[layer] || '#ffffff' }}>{count}</div>
                                <div className={s.layerName}>{LAYER_NAMES[layer] || layer}</div>
                            </div>
                        ))}
                    </div>
                    <div className={s.priorityHint}>
                        优先 <span style={{ color: '#ff6b6b' }}>L1(100)</span> {'>'} <span style={{ color: '#ffa502' }}>L2(80)</span> {'>'} <span style={{ color: '#2ed573' }}>L4(70)</span> {'>'} <span style={{ color: '#54a0ff' }}>L3(60)</span> | 覆盖: L4→L3L4→L2L4→L1
                    </div>
                    {ruleStackInfo.effectiveRules?.length > 0 && (
                        <div className={s.rulesList}>
                            {ruleStackInfo.effectiveRules.slice(0, 10).map(r => (
                                <div key={r.id} className={s.ruleRow}>
                                    <span style={{ color: LAYER_COLORS[r.layer] || '#54a0ff', fontWeight: 700 }}>[{r.layer}]</span>
                                    <span className={s.ruleContent}>{r.content.substring(0, 60)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className={s.emptyHint}>点击"刷新"加载规则(Rule Stack)栈数</div>
            )}
        </div>
    );
}
