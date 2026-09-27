/**
 * TokenTrendChart.jsx — 逐章趋势折线图（纯 SVG，无第三方图表依赖）
 * 支持三种指标：总量 / 每千字效率 / 缓存命中率；悬停看数值，点击跳该章明细。
 */
import { useState } from 'react';
import { formatTokens, formatExact, formatPct } from './tokenLedgerFormat';
import s from './tokenLedger.module.css';

const W = 900, H = 240, PAD = { l: 62, r: 18, t: 18, b: 30 };

const METRICS = {
    total: { label: '总消耗', color: '#38bdf8', pick: t => t.totalTokens, fmt: formatTokens },
    perK: { label: '每千字', color: '#f59e0b', pick: t => t.tokensPerKChar, fmt: formatTokens },
    cache: { label: '缓存命中', color: '#22c55e', pick: t => t.cachedTokens, fmt: formatTokens },
};

export default function TokenTrendChart({ trend, metric, onSelectChapter }) {
    const [hover, setHover] = useState(-1);
    const cfg = METRICS[metric] || METRICS.total;
    const points = trend || [];

    if (points.length === 0) {
        return <div className={s.emptyHint}>暂无趋势数据（跑完章节后自动出现）</div>;
    }

    const values = points.map(cfg.pick);
    const maxV = Math.max(...values, 1);
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const x = i => PAD.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = v => PAD.t + innerH - (v / maxV) * innerH;

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(cfg.pick(p)).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${(PAD.t + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;
    const labelStep = Math.max(1, Math.ceil(points.length / 12));

    return (
        <div className={s.chartWrap}>
            <svg viewBox={`0 0 ${W} ${H}`} className={s.chartSvg} role="img" aria-label={`逐章${cfg.label}趋势`}>
                <defs>
                    <linearGradient id="tokenTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={cfg.color} stopOpacity="0.32" />
                        <stop offset="100%" stopColor={cfg.color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map(r => (
                    <g key={r}>
                        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + innerH * r} y2={PAD.t + innerH * r} className={s.chartGrid} />
                        <text x={PAD.l - 8} y={PAD.t + innerH * r + 4} className={s.chartAxis} textAnchor="end">
                            {cfg.fmt(Math.round(maxV * (1 - r)))}
                        </text>
                    </g>
                ))}
                <path d={area} fill="url(#tokenTrendFill)" />
                <path d={line} fill="none" stroke={cfg.color} strokeWidth="2" strokeLinejoin="round" />
                {points.map((p, i) => (
                    <g key={p.chapter}>
                        <circle cx={x(i)} cy={y(cfg.pick(p))} r={hover === i ? 5 : 3}
                            fill={hover === i ? cfg.color : '#0b1220'} stroke={cfg.color} strokeWidth="2"
                            className={s.chartPoint} onClick={() => onSelectChapter?.(p.chapter)}
                            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)} />
                        {i % labelStep === 0 && (
                            <text x={x(i)} y={H - 8} className={s.chartAxis} textAnchor="middle">第{p.chapter}章</text>
                        )}
                    </g>
                ))}
            </svg>
            {hover >= 0 && (
                <div className={s.chartTip} style={{ left: `${(x(hover) / W) * 100}%` }}>
                    <strong>第{points[hover].chapter}章</strong>
                    <span>{cfg.label}：{formatExact(cfg.pick(points[hover]))}</span>
                    <span>缓存命中：{formatPct(points[hover].promptTokens ? (points[hover].cachedTokens / points[hover].promptTokens) * 100 : 0)}</span>
                </div>
            )}
        </div>
    );
}
