import s from './layout.module.css';
import c from './common.module.css';

export default function GenreSelector({ genres, selectedGenreId, onSelect, isLoading }) {
    return (
        <div className={s.sidebar}>
            <div className={s.sidebarTitle}>📂 已注册题材 ({genres.length})</div>
            {isLoading ? (
                <div className={c.loadingCenter}>
                    <span className="cyber-loading"></span> 加载中...
                </div>
            ) : genres.length === 0 ? (
                <div className={c.loadingCenter}>暂无题材</div>
            ) : (
                genres.map(genre => {
                    const gid = genre.id;
                    const isActive = selectedGenreId === gid;
                    return (
                        <div
                            key={gid}
                            onClick={() => onSelect(gid)}
                            className={`${s.genreItem} ${isActive ? s.genreItemActive : ''}`}
                        >
                            <div className={`${s.genreItemName} ${isActive ? s.genreItemNameActive : ''}`}>
                                {genre.label || gid}
                            </div>
                            <div className={s.genreItemId}>{gid}</div>
                            {genre.genreProfileIds?.length > 0 && (
                                <div className={s.genreItemProfile}>
                                    Profile: {genre.genreProfileIds.join(', ')}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}
