import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Notifications.module.css';
import { registerContainer, unregisterContainer } from './notifications';

/**
 * 全局通知容器组件
 *
 * 挂载到应用根节点，渲染所有通过 showXxx 发送的通知。
 * 自带自动消失、手动关闭、最多显示 N 条的能力。
 *
 * 文件位置：client/src/components/NotificationContainer.jsx
 */
export default function NotificationContainer() {
    const [items, setItems] = useState([]);
    const timersRef = useRef(new Map());
    const navigate = useNavigate();

    const jumpToDebugLogs = useCallback((traceId) => {
        navigate(`/debug-logs?traceId=${encodeURIComponent(traceId)}`);
    }, [navigate]);

    const remove = useCallback((id) => {
        setItems(prev => prev.filter(n => n.id !== id));
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
    }, []);

    const push = useCallback((notification) => {
        setItems(prev => {
            const next = [...prev, notification];
            // 超过最大数量时移除最早的
            if (next.length > 5) next.shift();
            return next;
        });
        if (notification.duration > 0) {
            const timer = setTimeout(() => remove(notification.id), notification.duration);
            timersRef.current.set(notification.id, timer);
        }
    }, [remove]);

    useEffect(() => {
        registerContainer({ push });
        const timers = timersRef.current;
        return () => {
            unregisterContainer();
            timers.forEach(t => clearTimeout(t));
            timers.clear();
        };
    }, [push]);

    return (
        <div className={styles.notificationContainer} role="region" aria-label="通知区域">
            {items.map(n => (
                <div key={n.id} className={`${styles.notification} ${styles[n.type] || styles.info}`}>
                    <div className={styles.header}>
                        <span className={styles.message}>{n.message}</span>
                        <button
                            className={styles.closeButton}
                            onClick={() => remove(n.id)}
                            aria-label="关闭通知"
                        >
                            ✕
                        </button>
                    </div>
                    {n.traceId && (
                        <div>
                            <div
                                className={styles.traceIdBox}
                                onClick={() => jumpToDebugLogs(n.traceId)}
                                role="link"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter') jumpToDebugLogs(n.traceId); }}
                                title="点击查看该 traceId 的日志详情"
                                aria-label={`查看 traceId ${n.traceId} 的日志`}
                            >
                                <span className={styles.traceIdLabel}>追踪码:</span>
                                <span className={styles.traceIdValue}>{n.traceId}</span>
                            </div>
                            <div className={styles.traceIdHint}>点击查看日志 · 反馈此码可帮助快速定位问题</div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
