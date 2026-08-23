import { useState } from 'react';
import { parsePowerValue, parseHiddenPower } from './powerUtils';
import './knowledge.css';

export default function PowerTracker({ powerData, onCharSelect: _onCharSelect, selectedCharId, charTimeline }) {
    const [compareChars, setCompareChars] = useState([]);
    const [compareMode, setCompareMode] = useState('same');

    if (!powerData) return <div className="knowledge-loading-placeholder">加载中...</div>;

    // 防御性处理：确保数组和子数组都是数组
    const characters = Array.isArray(powerData.characters) ? powerData.characters : [];
    const systems = Array.isArray(powerData.powerFramework) ? powerData.powerFramework : [];
    const safeCharTimeline = Array.isArray(charTimeline) ? charTimeline : [];

    const toggleCompare = (charId) => {
        setCompareChars(prev => prev.includes(charId) ? prev.filter(c => c !== charId) : [...prev, charId]);
    };

    const compareCharData = characters.filter(c => compareChars.includes(c.id));

    return (
        <div>
            {systems.length > 0 && (
                <div className="power-system-card">
                    <h3 className="power-system-title">修炼体系</h3>
                    <div className="power-system-list">
                        {systems.map((ps, i) => (
                            <div key={ps.id || i} className="power-system-item">
                                <div className="power-system-item-name">{ps.name}</div>
                                <div className="power-system-item-desc">{(ps.content || '').substring(0, 200)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="power-compare-card">
                <div className="power-compare-header">
                    <h3 className="power-compare-title">选择对比人物（点击添加/移除）</h3>
                    <div className="power-compare-modes">
                        <button className={`cyber-btn cyber-btn-sm ${compareMode === 'same' ? 'cyber-btn-primary' : ''}`}
                            onClick={() => setCompareMode('same')}>同体系对比</button>
                        <button className={`cyber-btn cyber-btn-sm ${compareMode === 'cross' ? 'cyber-btn-primary' : ''}`}
                            onClick={() => setCompareMode('cross')}>跨体系对比</button>
                    </div>
                </div>
                <div className="power-char-list">
                    {characters.map(c => {
                        const isSelected = compareChars.includes(c.id);
                        const pv = parsePowerValue(c.currentPower);
                        return (
                            <button key={c.id} className={`cyber-btn cyber-btn-sm ${isSelected ? 'cyber-btn-primary' : ''}`}
                                onClick={() => toggleCompare(c.id)}>
                                {c.name} {pv.hasData ? `(${pv.numeric}%)` : ''}
                            </button>
                        );
                    })}
                </div>
            </div>

            {compareCharData.length > 0 && <PowerCompareChart compareCharData={compareCharData} />}

            {selectedCharId && safeCharTimeline.length > 0 && <PowerGrowthTimeline charTimeline={safeCharTimeline} />}
        </div>
    );
}

function PowerCompareChart({ compareCharData }) {
    return (
        <div className="power-chart-card">
            <h3 className="power-chart-title">战力对比图</h3>
            <svg width="100%" viewBox={`0 0 ${Math.max(600, compareCharData.length * 180)} 320`} className="power-chart-svg">
                {compareCharData.map((c, i) => {
                    const x = 80 + i * 170;
                    const barWidth = 45;
                    const maxH = 220;
                    const official = parsePowerValue(c.currentPower);
                    const hidden = parseHiddenPower(c);
                    const officialH = official.hasData ? Math.max(15, (official.numeric / 100) * maxH) : 15;
                    const hiddenH = hidden.hasData ? Math.max(15, (hidden.numeric / 100) * maxH) : 0;
                    return (
                        <g key={c.id}>
                            <rect x={x} y={290 - officialH} width={barWidth} height={officialH}
                                fill="rgba(0,240,255,0.25)" stroke="var(--neon-blue)" strokeWidth="1.5" rx={3} />
                            <text x={x + barWidth / 2} y={290 - officialH - 5} textAnchor="middle" fill="var(--neon-blue)" fontSize="9">
                                {official.hasData ? `${official.numeric}%` : '未知'}
                            </text>
                            {hiddenH > 0 && (
                                <rect x={x + barWidth + 5} y={290 - hiddenH} width={barWidth} height={hiddenH}
                                    fill="rgba(165,94,234,0.25)" stroke="var(--neon-purple)" strokeWidth="1.5" rx={3} strokeDasharray="4,2" />
                            )}
                            {hiddenH > 0 && (
                                <text x={x + barWidth + 5 + barWidth / 2} y={290 - hiddenH - 5} textAnchor="middle" fill="var(--neon-purple)" fontSize="9">
                                    {hidden.estimated ? '~' : ''}{hidden.numeric}%
                                </text>
                            )}
                            <text x={x + (hiddenH > 0 ? barWidth + 2 : barWidth / 2)} y={305} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="600">{c.name}</text>
                            <text x={x + barWidth / 2} y={290 - officialH - 16} textAnchor="middle" fill="var(--neon-blue)" fontSize="8" opacity={0.7}>明面</text>
                            {hiddenH > 0 && (
                                <text x={x + barWidth + 5 + barWidth / 2} y={290 - hiddenH - 16} textAnchor="middle" fill="var(--neon-purple)" fontSize="8" opacity={0.7}>{hidden.estimated ? '推测' : '真实'}</text>
                            )}
                        </g>
                    );
                })}
                <line x1={60} y1={290} x2={80 + compareCharData.length * 170} y2={290} stroke="var(--border-color)" strokeWidth="1" />
                {[0, 25, 50, 75, 100].map(pct => {
                    const y = 290 - (pct / 100) * 220;
                    return (
                        <g key={pct}>
                            <line x1={65} y1={y} x2={80 + compareCharData.length * 170} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                            <text x={58} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="8">{pct}%</text>
                        </g>
                    );
                })}
            </svg>
            <div className="power-chart-legend">
                <div className="power-chart-legend-item">
                    <div className="power-chart-legend-dot" style={{ background: 'rgba(0,240,255,0.25)', border: '1.5px solid var(--neon-blue)' }} />
                    明面等级
                </div>
                <div className="power-chart-legend-item">
                    <div className="power-chart-legend-dot" style={{ background: 'rgba(165,94,234,0.25)', border: '1.5px dashed var(--neon-purple)' }} />
                    真实战力
                </div>
            </div>
        </div>
    );
}

function PowerGrowthTimeline({ charTimeline }) {
    return (
        <div className="power-timeline-card">
            <h3 className="power-timeline-title">战力成长曲线</h3>
            <div className="power-timeline-list">
                {charTimeline.map((t, i) => (
                    <div key={i} className="power-timeline-item">
                        <span className="power-timeline-chapter">第{t.chapterNumber}章</span>
                        <div className="power-timeline-bar-bg">
                            <div className="power-timeline-bar-fill" style={{ width: `${Math.min(100, (i + 1) / charTimeline.length * 100)}%` }} />
                        </div>
                        <span className="power-timeline-level">{t.state?.powerLevel || '未知'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
