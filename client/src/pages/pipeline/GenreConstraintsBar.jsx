import { useNavigate } from 'react-router-dom';
import s from './GenreConstraintsBar.module.css';

export default function GenreConstraintsBar({ genreId, genreConstraints, genreConstraintsData, genreStyleProfile }) {
    const navigate = useNavigate();
    if (!genreConstraints || genreConstraints.length === 0) return null;

    return (
        <div className={`cyber-card ${s.constraintsBar}`}>
            <div className={s.barHeader}>
                <div className={s.barTitleGroup}>
                    <span className={s.barTitle}>🔒 当前题材约束词</span>
                    <span className={`cyber-badge ${s.barBadge}`}>{genreId}</span>
                    <span className={s.barCount}>{genreConstraints.length}条约束</span>
                </div>
                <button type="button" onClick={() => navigate('/genre-debug')} className={s.barLink}>前往编辑 →</button>
            </div>
            <div className={s.tagList}>
                {genreConstraints.map((c, i) => {
                    const isRequired = genreConstraintsData?.requiredConstraints?.includes(c.id);
                    return (
                        <span key={c.id || i} title={c.desc} className={`${s.tag} ${isRequired ? s.tagRequired : s.tagOptional}`}>
                            {isRequired ? '🔒' : '•'} {c.label}
                        </span>
                    );
                })}
            </div>
            {genreStyleProfile.titleRule && (
                <div className={s.titleRule}>
                    📝 标题规则: {genreStyleProfile.titleRule.substring(0, 120)}{genreStyleProfile.titleRule.length > 120 ? '...' : ''}
                </div>
            )}
        </div>
    );
}
