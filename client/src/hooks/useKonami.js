/**
 * 彩蛋：Konami 秘籍（↑↑↓↓←→←→ B A）切换马里奥皮肤。
 * 输入框/文本域内不触发，避免干扰正常输入。
 * 文件位置：client/src/hooks/useKonami.js
 */
import { useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { showSuccess } from '../components/notifications';

const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export default function useKonami() {
    useEffect(() => {
        let idx = 0;
        const onKey = (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { idx = 0; return; }
            const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            idx = key === SEQ[idx] ? idx + 1 : (key === SEQ[0] ? 1 : 0);
            if (idx === SEQ.length) {
                idx = 0;
                useAppStore.getState().setTheme('mario');
                showSuccess('蘑菇力量激活！已切换到马里奥皮肤');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
}
