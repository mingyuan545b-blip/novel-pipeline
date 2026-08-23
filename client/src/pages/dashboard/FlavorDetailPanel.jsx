export default function FlavorDetailPanel({ expandedFlavorDetail, flavorDetailData, flavorDetailLoading, closeDetail }) {
    if (!expandedFlavorDetail) return null;

    if (flavorDetailLoading) {
        return <div className="flavor-detail-panel text-sm text-muted text-center">加载中...</div>;
    }

    if (!flavorDetailData || flavorDetailData.error) {
        return <div className="flavor-detail-error">{flavorDetailData?.message || '加载失败'}</div>;
    }

    const d = flavorDetailData;
    const sectionTitle = (text) => <div className="flavor-section-title">{text}</div>;
    const sectionContent = (text) => <div className="flavor-section-content">{text}</div>;

    if (expandedFlavorDetail === 'dialect') {
        const features = d.features || {};
        return (
            <div className="flavor-detail-panel">
                <div className="flex-between mb-6">
                    <div className="text-sm font-semibold text-green">🗣 方言详情</div>
                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, padding: '1px 6px' }} onClick={closeDetail}>收起</button>
                </div>
                {features.sentenceFinal?.length > 0 && <div>{sectionTitle('句尾词')}{sectionContent(features.sentenceFinal.slice(0, 5).join('、'))}</div>}
                {features.pronouns && Object.keys(features.pronouns).length > 0 && <div>{sectionTitle('代词映射')}{sectionContent(Object.entries(features.pronouns).slice(0, 4).map(([k, v]) => `${k}→${v}`).join('、'))}</div>}
                {features.vocabulary?.length > 0 && <div>{sectionTitle('核心词汇')}{sectionContent(features.vocabulary.slice(0, 8).join('、'))}</div>}
                {d.prompt && <div>{sectionTitle('强度说明')}{sectionContent(d.prompt.substring(0, 200))}</div>}
                {d.example && <div>{sectionTitle('示例句子')}{sectionContent(d.example)}</div>}
            </div>
        );
    }

    if (expandedFlavorDetail === 'speechStyle') {
        const features = d.features || {};
        return (
            <div className="flavor-detail-panel">
                <div className="flex-between mb-6">
                    <div className="text-sm font-semibold" style={{ color: 'var(--neon-pink)' }}>🎭 说话风格详情</div>
                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, padding: '1px 6px' }} onClick={closeDetail}>收起</button>
                </div>
                {features.signaturePhrases?.length > 0 && <div>{sectionTitle('标志性短语')}{sectionContent(features.signaturePhrases.slice(0, 6).join('、'))}</div>}
                {features.patterns?.length > 0 && <div>{sectionTitle('模式')}{sectionContent(features.patterns.slice(0, 3).join('、'))}</div>}
                {features.forbidden?.length > 0 && <div>{sectionTitle('禁忌')}{sectionContent(features.forbidden.join('、'))}</div>}
                {d.prompt && <div>{sectionTitle('强度说明')}{sectionContent(d.prompt.substring(0, 200))}</div>}
                {d.example && <div>{sectionTitle('示例句子')}{sectionContent(d.example)}</div>}
            </div>
        );
    }

    if (expandedFlavorDetail === 'namingStyle') {
        return (
            <div className="flavor-detail-panel">
                <div className="flex-between mb-6">
                    <div className="text-sm font-semibold text-orange">✒️ 命名风格详情</div>
                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, padding: '1px 6px' }} onClick={closeDetail}>收起</button>
                </div>
                {d.prompt && <div>{sectionTitle('注入提示词')}{sectionContent(d.prompt)}</div>}
            </div>
        );
    }

    if (expandedFlavorDetail === 'systemPersona') {
        return (
            <div className="flavor-detail-panel">
                <div className="flex-between mb-6">
                    <div className="text-sm font-semibold" style={{ color: '#9b59b6' }}>🤖 系统人格详情</div>
                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, padding: '1px 6px' }} onClick={closeDetail}>收起</button>
                </div>
                {d.writerPrompt && <div>{sectionTitle('执笔人提示词')}{sectionContent(d.writerPrompt.substring(0, 300))}</div>}
                {d.reviewerPrompt && <div>{sectionTitle('审核人提示词')}{sectionContent(d.reviewerPrompt.substring(0, 300))}</div>}
                {d.interface && <div>{sectionTitle('界面风格')}{sectionContent(typeof d.interface === 'string' ? d.interface : JSON.stringify(d.interface, null, 2).substring(0, 300))}</div>}
                {d.interactionRules && <div>{sectionTitle('互动规则')}{sectionContent(typeof d.interactionRules === 'string' ? d.interactionRules : JSON.stringify(d.interactionRules, null, 2).substring(0, 300))}</div>}
            </div>
        );
    }

    if (expandedFlavorDetail === 'worldviewTemplate') {
        return (
            <div className="flavor-detail-panel">
                <div className="flex-between mb-6">
                    <div className="text-sm font-semibold text-blue">🌍 世界观模板详情</div>
                    <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10, padding: '1px 6px' }} onClick={closeDetail}>收起</button>
                </div>
                {d.phases?.length > 0 && (
                    <div>
                        {sectionTitle('阶段配置')}
                        {d.phases.map((phase, i) => (
                            <div key={i} className="flavor-phase-item">
                                <span className="font-semibold text-blue">阶段{i + 1}</span>
                                {phase.label && `: ${phase.label}`}
                                {phase.ceiling && ` | 天花板: ${phase.ceiling}`}
                                {phase.pace && ` | 节奏: ${phase.pace}`}
                            </div>
                        ))}
                    </div>
                )}
                {d.description && <div>{sectionTitle('描述')}{sectionContent(d.description)}</div>}
            </div>
        );
    }

    return null;
}
