import { useEffect, useRef, useCallback } from 'react';
import { healthApi } from '../services/api';

const CHECK_INTERVAL_MS = 60_000;
const VERSION_MISMATCH_KEY = 'server_version_mismatch_dismissed';

/**
 * 前端版本校验hook — 定期检查后端服务是否重启
 * 如果后端重启（startedAt变化），提示用户刷新页面以加载新代码
 */
export default function useServerVersionGuard() {
    const initialStartedAt = useRef(null);
    const dismissed = useRef(false);

    const checkVersion = useCallback(async () => {
        try {
            const { data } = await healthApi.check();
            if (!data?.startedAt) return;

            if (!initialStartedAt.current) {
                initialStartedAt.current = data.startedAt;
                return;
            }

            if (data.startedAt !== initialStartedAt.current && !dismissed.current) {
                const wasDismissed = sessionStorage.getItem(VERSION_MISMATCH_KEY);
                if (wasDismissed === data.startedAt) return;

                const shouldReload = window.confirm(
                    '服务端已更新，建议刷新页面以加载最新版本。是否立即刷新？'
                );
                if (shouldReload) {
                    window.location.reload();
                } else {
                    dismissed.current = true;
                    sessionStorage.setItem(VERSION_MISMATCH_KEY, data.startedAt);
                }
            }
        } catch {
            // health检查失败不阻塞UI
        }
    }, []);

    useEffect(() => {
        checkVersion();
        const timer = setInterval(checkVersion, CHECK_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [checkVersion]);
}
