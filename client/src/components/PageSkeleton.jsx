import { useMemo } from 'react';
import styles from './PageSkeleton.module.css';

const SKELETON_WIDTHS = [75, 85, 92, 68, 80, 88, 72, 95, 78, 82];

export default function PageSkeleton({ rows = 5 }) {
    const widths = useMemo(() =>
        Array.from({ length: rows }, (_, i) => SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]),
        [rows]
    );
    return (
        <div className={styles.container} role="status" aria-label="加载中">
            <div className={styles.header} />
            <div className={styles.body}>
                {widths.map((w, i) => (
                    <div key={i} className={styles.row} style={{ width: `${w}%` }} />
                ))}
            </div>
        </div>
    );
}
