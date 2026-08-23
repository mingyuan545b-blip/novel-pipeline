import { pipelineApi, projectsApi } from '../../services/api';
import logger from '../../shared/logger';
import InjectionMapPanel from './InjectionMapPanel';
import AgentConfigPanel from './AgentConfigPanel';
import { STATUS_VALUES } from './pipelineConstants';
import s from './PipelineSettingsPanel.module.css';

export default function PipelineSettingsPanel({
    currentProject, infiniteStatus, infiniteOptions, setInfiniteOptions,
    projectTargets, setProjectTargets, chapters, completedChapters,
    contextBudgetInfo, setContextBudgetInfo,
    injectionMapInfo, setInjectionMapInfo, supplementOutlines,
    onRerunMaterialManager, onGenerateSubplaneMaterials,
    agentModelConfig, setAgentModelConfig, testResults, setTestResults,
    showAgentConfig, setShowAgentConfig,
}) {
    const saveTargets = async () => {
        if (!currentProject) return;
        try {
            await projectsApi.saveTargets(currentProject.id, {
                // Schema-First：统一使用标准字段名targetChapters
                targetChapters: projectTargets.targetChapters ? parseInt(projectTargets.targetChapters) : null,
                targetWordCount: projectTargets.targetWordCount ? parseInt(projectTargets.targetWordCount) : null
            });
            alert('目标已保存');
        } catch (e) { alert('保存失败: ' + e.message); }
    };

    const loadContextBudget = async () => {
        if (!currentProject) return;
        try { const res = await pipelineApi.getContextBudget(currentProject.id); setContextBudgetInfo(res.data || res); }
        catch (e) { logger.error('PipelineSettings', 'Load budget failed:', e.message); }
    };

    const loadInjectionMap = async () => {
        if (!currentProject) return;
        try { const res = await pipelineApi.getOutlineInjectionMap(currentProject.id); setInjectionMapInfo(res.data || res); }
        catch (e) { logger.error('PipelineSettings', 'Load map failed:', e.message); }
    };

    return (
        <>
            <div className="cyber-section-title">无限流水线设置</div>
            <div className={`cyber-card ${s.settingsCard}`}>
                <div className={s.settingsRow}>
                    <div className={s.fieldGroup}>
                        <label className={`form-label ${s.fieldLabelOrange}`}>🎯 目标章数</label>
                        <input className={`cyber-input ${s.inputMd}`} type="number" value={projectTargets.targetChapters} onChange={e => setProjectTargets(p => ({ ...p, targetChapters: e.target.value.replace(/[^\d]/g, '') }))} placeholder="如 200" />
                    </div>
                    <div className={s.fieldGroup}>
                        <label className={`form-label ${s.fieldLabelOrange}`}>🎯 目标字数</label>
                        <input className={`cyber-input ${s.inputLg}`} type="number" value={projectTargets.targetWordCount} onChange={e => setProjectTargets(p => ({ ...p, targetWordCount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="如 1000000" />
                    </div>
                    <button className={`cyber-btn ${s.saveBtn}`} onClick={saveTargets}>💾 保存目标</button>
                    <span className={s.hint}>达到目标后自动停止并规划结局</span>
                </div>
            </div>
            <div className={`cyber-card ${s.settingsCard}`}>
                <div className={s.settingsRow}>
                    <div className={s.fieldGroup}>
                        <label className={`form-label ${s.fieldLabel}`}>每次补充章数:</label>
                        <input className={`cyber-input ${s.inputSm}`} type="number" value={infiniteOptions.chaptersPerBatch} onChange={e => setInfiniteOptions(p => ({ ...p, chaptersPerBatch: parseInt(e.target.value) || 30 }))} min={1} max={60} />
                    </div>
                    <div className={s.fieldGroup}>
                        <label className={`form-label ${s.fieldLabel}`}>最大审核轮次</label>
                        <input className={`cyber-input ${s.inputSm}`} type="number" value={infiniteOptions.maxRounds} onChange={e => setInfiniteOptions(p => ({ ...p, maxRounds: parseInt(e.target.value) || 5 }))} min={1} max={10} />
                    </div>
                    <div className={s.fieldGroup}>
                        <label className={`form-label ${s.fieldLabel}`}>最大补充次数</label>
                        <input className={`cyber-input ${s.inputSm}`} type="number" value={infiniteOptions.maxSupplements} onChange={e => setInfiniteOptions(p => ({ ...p, maxSupplements: parseInt(e.target.value) || 999 }))} min={1} max={9999} />
                    </div>
                    <div className={s.fieldGroup}>
                        <label className={`form-label ${s.fieldLabel}`}>停止章节号</label>
                        <input className={`cyber-input ${s.inputMd}`} type="number" value={infiniteOptions.stopAfterChapter} onChange={e => setInfiniteOptions(p => ({ ...p, stopAfterChapter: e.target.value }))} placeholder="不限" />
                    </div>
                    <button className="cyber-btn" onClick={supplementOutlines} disabled={infiniteStatus.running}>手动补充大纲</button>
                    <button className="cyber-btn" onClick={onRerunMaterialManager} disabled={infiniteStatus.running}>🔄 补跑素材管理</button>
                    <button className="cyber-btn" onClick={loadContextBudget}>📊 计算上下文容</button>
                    <button className="cyber-btn" onClick={loadInjectionMap}>🗺️ 注入层级表</button>
                    <button className="cyber-btn" onClick={onGenerateSubplaneMaterials}>🧪 生成次位面素材</button>
                    <span className={s.progressHint}>已完 {completedChapters}/{chapters.length} | 大纲待写: {chapters.filter(ch => ch.status === STATUS_VALUES.OUTLINED).length}</span>
                </div>
                {contextBudgetInfo && (
                    <div className={s.budgetPanel}>
                        <div className={s.budgetHeader}>
                            <span className={s.budgetTitle}>📐 上下文容量分析{contextBudgetInfo.model}</span>
                            <button className="cyber-btn cyber-btn-sm" onClick={() => setContextBudgetInfo(null)}></button>
                        </div>
                        <div className={s.budgetGrid}>
                            <div className={`${s.budgetCard} ${s.budgetCardGreen}`}>
                                <div className={`${s.budgetValue} ${s.budgetValueLg} ${s.budgetValueGreen}`}>{contextBudgetInfo.recommendedMax}</div>
                                <div className={s.budgetLabel}>推荐批量章数</div>
                            </div>
                            <div className={`${s.budgetCard} ${s.budgetCardOrange}`}>
                                <div className={`${s.budgetValue} ${s.budgetValueLg} ${s.budgetValueOrange}`}>{contextBudgetInfo.safeMax}</div>
                                <div className={s.budgetLabel}>安全上限</div>
                            </div>
                            <div className={`${s.budgetCard} ${s.budgetCardBlue}`}>
                                <div className={`${s.budgetValue} ${s.budgetValueLg} ${s.budgetValueBlue}`}>{contextBudgetInfo.maxChapters}</div>
                                <div className={s.budgetLabel}>理论极限</div>
                            </div>
                            <div className={`${s.budgetCard} ${s.budgetCardPurple}`}>
                                <div className={`${s.budgetValue} ${s.budgetValueMd} ${s.budgetValuePurple}`}>{(contextBudgetInfo.totalBudget / 1000).toFixed(0)}k</div>
                                <div className={s.budgetLabel}>总上下文</div>
                            </div>
                        </div>
                        <div className={s.budgetDetail}>
                            <span>固定开销: {contextBudgetInfo.fixedCost.toLocaleString()} tokens ({Object.entries(contextBudgetInfo.fixedBreakdown).filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(', ')})</span>
                            <span>每章开销: {contextBudgetInfo.perChapterTotal.toLocaleString()} tokens (输入{contextBudgetInfo.perChapterInput} + 输出{contextBudgetInfo.perChapterOutput})</span>
                            <span>可用章节空间: {contextBudgetInfo.availableForChapters.toLocaleString()} tokens</span>
                            <span>素材: 世界观{contextBudgetInfo.worldviewMatCount} | 角色{contextBudgetInfo.characterMatCount} | 其他{contextBudgetInfo.otherMatCount}</span>
                        </div>
                    </div>
                )}
                <InjectionMapPanel currentProject={currentProject} injectionMapInfo={injectionMapInfo} setInjectionMapInfo={setInjectionMapInfo} />
                <AgentConfigPanel currentProject={currentProject} showAgentConfig={showAgentConfig} setShowAgentConfig={setShowAgentConfig} agentModelConfig={agentModelConfig} setAgentModelConfig={setAgentModelConfig} testResults={testResults} setTestResults={setTestResults} />
            </div>
        </>
    );
}
