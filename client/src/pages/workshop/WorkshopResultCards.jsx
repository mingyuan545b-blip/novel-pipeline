import s from './workshop.module.css';
import p from './preview.module.css';

export function ImportResult({ result }) {
    return (
        <div className="cyber-card">
            {result.materials && (
                <div className={p.resultBlock}>
                    <h4 className={p.sectionTitleBlue}>素材库生成</h4>
                    <span className={`cyber-badge ${result.materials.count > 0 ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                        {result.materials.count > 0 ? `成功生成 ${result.materials.count} 个素材` : '生成失败'}
                    </span>
                    {result.materials.error && (
                        <div className={s.errorText} style={{ marginTop: 8 }}>错误: {result.materials.error}</div>
                    )}
                </div>
            )}
            {result.outlines && (
                <div className={p.resultBlock}>
                    <h4 className={p.sectionTitleGreen}>章节大纲生成</h4>
                    <span className={`cyber-badge ${result.outlines.count > 0 ? 'cyber-badge-green' : 'cyber-badge-red'}`}>
                        {result.outlines.count > 0 ? `成功生成 ${result.outlines.count} 章大纲` : '生成失败'}
                    </span>
                    {result.outlines.created?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            {result.outlines.created.map((ch, i) => (
                                <div key={i} className={s.infoText} style={{ padding: '4px 0' }}>
                                    第{ch.chapterNumber}章: {ch.title}
                                </div>
                            ))}
                        </div>
                    )}
                    {result.outlines.error && (
                        <div className={s.errorText} style={{ marginTop: 8 }}>错误: {result.outlines.error}</div>
                    )}
                </div>
            )}
            {result.settingFile && (
                <div className={s.filePath}>设定文件已保存: {result.settingFile}</div>
            )}
        </div>
    );
}

export function TechniquesResult({ techniques }) {
    if (!techniques) return null;
    return (
        <div className={`cyber-card ${p.resultBlock}`}>
            <h4 className={p.sectionTitleBlue}>写作手法分析</h4>
            {techniques.error ? (
                <div className={s.errorText}>{techniques.error}</div>
            ) : techniques.techniques ? (
                <div>
                    <div className={p.styleSummary}>{techniques.styleSummary}</div>
                    {techniques.techniques.map((tech, i) => (
                        <div key={i} className={p.techniqueItem}>
                            <div className={p.techniqueName}>[{tech.category}] {tech.name}</div>
                            <div className={p.techniqueDesc}>{tech.description}</div>
                            {tech.examples?.length > 0 && (
                                <div className={p.techniqueExample}>示例: {tech.examples[0].substring(0, 100)}...</div>
                            )}
                        </div>
                    ))}
                    {techniques.commonPatterns?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div className={p.subTitleGreen}>共同模式</div>
                            {techniques.commonPatterns.map((pt, i) => (
                                <div key={i} className={p.listItem}>• {pt}</div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <pre className={p.rawOutput}>
                    {typeof techniques.raw === 'string' ? techniques.raw : JSON.stringify(techniques, null, 2)}
                </pre>
            )}
        </div>
    );
}

export function ElementsResult({ elements }) {
    if (!elements) return null;
    return (
        <div className={`cyber-card ${p.resultBlock}`}>
            <h4 className={p.sectionTitleGreen}>写作元素提炼</h4>
            {elements.error ? (
                <div className={s.errorText}>{elements.error}</div>
            ) : elements.elements ? (
                <div>
                    <div className={p.styleSummary}>{elements.elementSummary}</div>
                    {elements.elements.map((elem, i) => (
                        <div key={i} className={p.elementItem}>
                            <div className={p.elementName}>[{elem.category}] {elem.name}</div>
                            <div className={p.elementDesc}>{elem.description}</div>
                            {elem.reusability && (
                                <div className={p.elementReusability}>可复用性: {elem.reusability}</div>
                            )}
                        </div>
                    ))}
                    {elements.recommendedCombinations?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div className={p.subTitleOrange}>推荐组合</div>
                            {elements.recommendedCombinations.map((c, i) => (
                                <div key={i} className={p.listItem}>• {c}</div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <pre className={p.rawOutput}>
                    {typeof elements.raw === 'string' ? elements.raw : JSON.stringify(elements, null, 2)}
                </pre>
            )}
        </div>
    );
}

export function FusionResult({ fusion }) {
    if (!fusion) return null;
    return (
        <div className={`cyber-card ${p.resultBlock}`}>
            <h4 className={p.sectionTitlePink}>融合分析方案</h4>
            {fusion.error ? (
                <div className={s.errorText}>{fusion.error}</div>
            ) : fusion.fusionStrategy ? (
                <div>
                    <div className={p.fusionCore}>
                        <div className={p.fusionCoreTitle}>融合核心理念</div>
                        <div className={p.fusionCoreDesc}>{fusion.fusionStrategy.coreIdea}</div>
                    </div>
                    {fusion.novelStrengths?.length > 0 && (
                        <div className={p.resultBlock}>
                            <div className={p.subTitleBlue}>各小说优势</div>
                            {fusion.novelStrengths.map((ns, i) => (
                                <div key={i} className={s.detailText}>
                                    小说{ns.novelIndex}: {ns.strengths?.join(', ')} | 独特价值: {ns.uniqueValue}
                                </div>
                            ))}
                        </div>
                    )}
                    {fusion.writingPlan && (
                        <div className={p.resultBlock}>
                            <div className={p.subTitleGreen}>写作方案</div>
                            <div className={s.detailText}>
                                <div>推荐类型: {fusion.writingPlan.recommendedGenre}</div>
                                <div>目标读者: {fusion.writingPlan.targetAudience}</div>
                                <div>开篇策略: {fusion.writingPlan.openingStrategy}</div>
                                {fusion.writingPlan.keySellingPoints?.length > 0 && (
                                    <div>卖点: {fusion.writingPlan.keySellingPoints.join(' | ')}</div>
                                )}
                            </div>
                        </div>
                    )}
                    {fusion.innovationPoints?.length > 0 && (
                        <div>
                            <div className={p.subTitleOrange}>创新点</div>
                            {fusion.innovationPoints.map((ip, i) => (
                                <div key={i} className={p.listItem}>• {ip}</div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <pre className={p.rawOutput}>
                    {typeof fusion.raw === 'string' ? fusion.raw : JSON.stringify(fusion, null, 2)}
                </pre>
            )}
        </div>
    );
}
