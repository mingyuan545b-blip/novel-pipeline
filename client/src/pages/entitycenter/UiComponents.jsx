import { useState, useEffect, useRef } from 'react';
import { RARITY_COLORS, RARITY_LABELS } from './constants';
import s from './uiComponents.module.css';
import { hashStr } from './uiHelpers';

export function GenerativeAvatar({ name, size = 40 }) {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let _cancelled = false;
        const ctx = canvas.getContext('2d');
        const s = size * 2;
        canvas.width = s;
        canvas.height = s;
        ctx.clearRect(0, 0, s, s);
        const h = hashStr(name || 'x');
        const hue1 = h % 360;
        const hue2 = (h * 7) % 360;
        const hue3 = (h * 13) % 360;
        const cx = s / 2, cy = s / 2, r = s / 2 - 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        const grad = ctx.createRadialGradient(cx * 0.7, cy * 0.7, 0, cx, cy, r);
        grad.addColorStop(0, `hsl(${hue1}, 65%, 55%)`);
        grad.addColorStop(0.5, `hsl(${hue2}, 60%, 40%)`);
        grad.addColorStop(1, `hsl(${hue3}, 55%, 25%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, s, s);
        const rings = 2 + (h % 3);
        for (let i = 0; i < rings; i++) {
            const ringR = r * (0.3 + (i / rings) * 0.6);
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${(hue1 + i * 47) % 360}, 70%, 70%, 0.3)`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        const points = 3 + (h % 4);
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2 + (h % 100) * 0.01;
            const dist = r * (0.2 + ((h * (i + 1)) % 50) / 100);
            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;
            const dotR = 1.5 + (h * (i + 3)) % 3;
            ctx.beginPath();
            ctx.arc(px, py, dotR, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${(hue2 + i * 30) % 360}, 80%, 80%, 0.6)`;
            ctx.fill();
        }
        const lines = 2 + (h % 3);
        for (let i = 0; i < lines; i++) {
            const a1 = ((h * (i + 2)) % 360) * Math.PI / 180;
            const a2 = ((h * (i + 5)) % 360) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a1) * r * 0.3, cy + Math.sin(a1) * r * 0.3);
            ctx.lineTo(cx + Math.cos(a2) * r * 0.7, cy + Math.sin(a2) * r * 0.7);
            ctx.strokeStyle = `hsla(${(hue3 + i * 60) % 360}, 70%, 70%, 0.25)`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
        return () => { _cancelled = true; };
    }, [name, size]);
    return <canvas ref={canvasRef} className={s.avatarCanvas} style={{ width: size, height: size }} aria-hidden="true" />;
}

export function RadialProgress({ value, max = 100, size = 36, strokeWidth = 3, color = 'var(--neon-cyan)' }) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size} className="ec-svg-rotate" aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-secondary)" strokeWidth={strokeWidth} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                className="ec-svg-transition" />
        </svg>
    );
}

export function ProgressBar({ value, max = 100, color = 'var(--neon-cyan)', height = 6, label }) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className="ec-progress-wrapper">
            {label && <div className="ec-text-11 ec-text-muted ec-mb-2">{label}</div>}
            <div className="ec-bar-track" style={{ height }}>
                <div className="ec-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

export function StrengthBar({ value, max = 100 }) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    const color = pct < 30 ? '#888' : pct < 60 ? 'var(--neon-blue)' : '#ffd700';
    return (
        <div className="ec-bar-track">
            <div className="ec-bar-fill ec-bar-gradient" style={{ width: `${pct}%`, '--strength-color': color }} />
        </div>
    );
}

export function RarityBadge({ rarity }) {
    const color = RARITY_COLORS[rarity] || '#888';
    const _isLegendary = rarity === 'legendary';
    return (
        <span className={`rarity-badge rarity-${rarity || 'common'} ec-badge-lg ec-badge-rarity`}
            style={{
                '--rarity-color': color,
                '--rarity-bg': `${color}15`,
                '--rarity-border': `${color}40`,
            }}>
            {RARITY_LABELS[rarity] || rarity}
        </span>
    );
}

export function StatCard({ label, value, color, icon }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let start = 0;
        const end = value;
        let cancelled = false;
        if (end === 0) return;
        const duration = 600;
        const stepTime = 16;
        const steps = Math.ceil(duration / stepTime);
        const increment = end / steps;
        const timer = setInterval(() => {
            start += increment;
            if (cancelled) { clearInterval(timer); return; }
            if (start >= end) { setDisplay(end); clearInterval(timer); }
            else { setDisplay(Math.floor(start)); }
        }, stepTime);
        return () => { cancelled = true; clearInterval(timer); };
    }, [value]);
    return (
        <div className="ec-stat-card" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
            <div className="ec-stat-top-line" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
            <div className="ec-text-20 ec-font-700 ec-tabular" style={{ color }}>{display}</div>
            <div className="ec-text-10 ec-text-muted"><span aria-hidden="true">{icon}</span> {label}</div>
        </div>
    );
}

export function LoadingSkeleton() {
    return (
        <div className="ec-grid-auto">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="cyber-card ec-skeleton-card">
                    <div className="ec-skeleton ec-skeleton-w60" />
                    <div className="ec-skeleton ec-skeleton-w90" />
                    <div className="ec-skeleton ec-skeleton-w40" />
                </div>
            ))}
        </div>
    );
}
