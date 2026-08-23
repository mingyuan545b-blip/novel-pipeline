import { useEffect } from 'react';

export default function useForceLayout({ graph, filteredNodes, filteredEdges, filteredCount, filteredEdgeCount, viewMode, currentPos, animRef, draggingRef, setPositions }) {
    useEffect(() => {
        if (!graph || filteredCount === 0) return;
        const pos = {};
        const cx = 450, cy = 300;
        filteredNodes.forEach((n, i) => {
            const angle = (2 * Math.PI * i) / filteredCount;
            const r = 150 + Math.random() * 100;
            pos[n.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 };
        });
        currentPos.current = pos;
        setPositions(pos);

        let frame = 0;
        const maxFrames = 200;
        const tick = () => {
            if (frame >= maxFrames) return;
            const p = { ...currentPos.current };
            const nodeIds = Object.keys(p);
            if (nodeIds.length === 0) { frame++; animRef.current = requestAnimationFrame(tick); return; }
            nodeIds.forEach(id => { if (p[id]) p[id] = { ...p[id], vx: 0, vy: 0 }; });
            filteredEdges.forEach(e => {
                const s = p[e.source], t = p[e.target];
                if (!s || !t) return;
                const dx = t.x - s.x, dy = t.y - s.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 180) * 0.005;
                const fx = (dx / dist) * force, fy = (dy / dist) * force;
                s.vx += fx; s.vy += fy; t.vx -= fx; t.vy -= fy;
            });
            for (let i = 0; i < nodeIds.length; i++) {
                for (let j = i + 1; j < nodeIds.length; j++) {
                    const a = p[nodeIds[i]], b = p[nodeIds[j]];
                    if (!a || !b) continue;
                    const dx = b.x - a.x, dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    if (dist < 200) {
                        const repulse = (200 - dist) * 0.02;
                        const fx = (dx / dist) * repulse, fy = (dy / dist) * repulse;
                        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
                    }
                }
            }
            nodeIds.forEach(id => {
                const n = p[id];
                if (!n) return;
                n.vx += (450 - n.x) * 0.001; n.vy += (300 - n.y) * 0.001;
                n.vx *= 0.8; n.vy *= 0.8;
                if (draggingRef.current !== id) {
                    n.x += n.vx; n.y += n.vy;
                    n.x = Math.max(50, Math.min(850, n.x));
                    n.y = Math.max(50, Math.min(550, n.y));
                }
            });
            currentPos.current = p;
            setPositions(p);
            frame++;
            animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    /* eslint-disable react-hooks/exhaustive-deps */
    }, [graph, filteredCount, filteredEdgeCount, viewMode]);
    /* eslint-enable react-hooks/exhaustive-deps */
}
