import { useState, useEffect } from 'react';
import styles from './OfflineBanner.module.css';

export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className={styles.banner}>
            <span className={styles.icon}>📡</span>
            <span>网络连接已断开，部分功能可能不可用</span>
            <button
                className={styles.closeButton}
                onClick={() => setIsOffline(false)}
                aria-label="关闭提示"
            >
                ✕
            </button>
        </div>
    );
}
