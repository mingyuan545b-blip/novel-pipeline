/**
 * useExtractState — 藏经阁「一键提取」状态机
 *
 * 职责：文本来源（粘贴/上传）→ 提交提取任务 → 轮询进度 → 汇总结果。
 * 拆分原因：LibraryPage 已达组件复杂度上限，提取流程独立成 hook（见 PROJECT_STANDARDS 组件规范）。
 * 文件位置：client/src/pages/library/useExtractState.js
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { libraryApi } from '../../services/api';
import logger from '../../shared/logger';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 30 * 60 * 1000;
const DEFAULT_LABEL = '未命名作品';

export default function useExtractState({ onFinished } = {}) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ text: '', novelName: '', dimensions: [] });
    const [dimensions, setDimensions] = useState([]);
    const [task, setTask] = useState(null);
    const [error, setError] = useState('');
    const pollRef = useRef(null);
    const startedAtRef = useRef(0);

    useEffect(() => {
        if (!open || dimensions.length) return;
        libraryApi.getExtractDimensions()
            .then(res => setDimensions(Array.isArray(res) ? res : (res?.data || [])))
            .catch(e => logger.warn('useExtractState', '维度加载失败:', e.message));
    }, [open, dimensions.length]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    }, []);

    useEffect(() => stopPolling, [stopPolling]);

    const poll = useCallback(async (taskId) => {
        if (Date.now() - startedAtRef.current > MAX_POLL_MS) {
            setError('提取超时，请查看后端日志');
            setTask(prev => ({ ...prev, status: 'timeout', terminal: true }));
            return;
        }
        try {
            const res = await libraryApi.getExtractStatus(taskId);
            const data = res?.data || res;
            setTask(data);
            if (!data?.terminal) {
                pollRef.current = setTimeout(() => poll(taskId), POLL_INTERVAL_MS);
            } else if (data.status === 'completed') {
                onFinished?.(data.result);
            }
        } catch (e) {
            setError(e.message || '轮询失败');
        }
    }, [onFinished]);

    const readFile = useCallback(async (file) => {
        if (!file) return;
        const text = await file.text();
        const name = file.name.replace(/\.txt$/i, '');
        setForm(prev => ({ ...prev, text, novelName: prev.novelName || name }));
    }, []);

    const submit = useCallback(async () => {
        setError('');
        if (!form.text.trim()) { setError('请粘贴正文或上传txt文件'); return; }
        try {
            const res = await libraryApi.extractTechniques({
                text: form.text,
                novelName: form.novelName || DEFAULT_LABEL,
                dimensions: form.dimensions,
            });
            const taskId = res?.data?.taskId || res?.taskId;
            if (!taskId) { setError('后端未返回任务ID'); return; }
            startedAtRef.current = Date.now();
            setTask({ taskId, status: 'running', progress: 0, step: '已提交', terminal: false });
            pollRef.current = setTimeout(() => poll(taskId), POLL_INTERVAL_MS);
        } catch (e) {
            setError(e.message || '提交失败');
        }
    }, [form, poll]);

    const close = useCallback(() => {
        stopPolling();
        setOpen(false);
        setTask(null);
        setError('');
    }, [stopPolling]);

    const running = task?.status === 'running';

    return {
        open, setOpen: (v) => (v ? setOpen(true) : close()),
        form, setForm, dimensions, task, error, running,
        readFile, submit, close,
    };
}
