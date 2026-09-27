import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';
import { useRunStep, useRunFullPipeline, useTaskStatusPoll, PIPELINE_KEYS } from '../../hooks/queries';


/** 把 full-pipeline 返回的逐轮/逐步骤日志摊平到执行日志（含章号/轮次/细节） */
function appendRoundLogs(addPipelineLog, result, chapterNumber, selectedChapter) {
    const log = (result && result.log) || [];
    if (!Array.isArray(log) || log.length === 0) return;
    for (const entry of log) {
        if (!entry || !entry.step) continue;
        const feedback = entry.feedback || {};
        const issues = (feedback.issues || []).map((i) => i.desc || i.description).filter(Boolean);
        const detail = [feedback.summary, ...issues.slice(0, 2)].filter(Boolean).join(' ｜ ');
        addPipelineLog({
            step: entry.step,
            status: entry.passed ? 'done' : 'error',
            round: entry.round,
            chapterNumber: entry.chapterNumber || chapterNumber,
            result: { passed: entry.passed, feedback },
            detail: detail || undefined,
            timestamp: entry.timestamp || new Date().toISOString(),
            _chapterTitle: selectedChapter?.title,
        });
    }
}

const TASK_ID_DISPLAY_LENGTH = 12;
const POLL_INTERVAL_MS = 3000;
// 与服务端 asyncTaskManager.TERMINAL_STATUSES 对齐：失败类终止态（含看门狗的超时）
const TERMINAL_FAILURE_STATUSES = ['failed', 'error', 'timeout', 'cancelled'];

export function useFullPipelineHandler(currentProject, selectedChapter) {
    const queryClient = useQueryClient();
    const { addPipelineLog, clearPipelineLogs, setPipelineState, pipelineState } = useAppStore();
    const [fullPipelineTaskId, setFullPipelineTaskId] = useState(null);
    const [fullPipelinePolling, setFullPipelinePolling] = useState(false);
    const [fullPipelinePollErrors, setFullPipelinePollErrors] = useState(0);
    const runStepMut = useRunStep();
    const runFullPipelineMut = useRunFullPipeline();

    const runStep = async (step) => {
        if (!currentProject || !selectedChapter) return;
        setPipelineState({ running: true, currentStep: step });
        addPipelineLog({ step, status: 'running', timestamp: new Date().toISOString() });
        try {
            const res = await runStepMut.mutateAsync({ projectId: currentProject.id, chapterId: selectedChapter.id, step, round: pipelineState.currentRound || 1, context: {} });
            addPipelineLog({ step, status: 'done', result: res, timestamp: new Date().toISOString() });
        } catch (e) {
            addPipelineLog({ step, status: 'error', error: e.message, timestamp: new Date().toISOString() });
        } finally {
            setPipelineState({ running: false, currentStep: null });
        }
    };

    const runFullPipeline = async (maxRounds) => {
        if (!currentProject) { alert('请先选择一个项目'); return; }
        if (!selectedChapter) { alert('请先选择一个章节'); return; }
        setPipelineState({ running: true, currentStep: 'full', currentRound: 1 });
        clearPipelineLogs();
        addPipelineLog({ step: 'full-pipeline', status: 'running', message: `第${selectedChapter.chapterNumber}章 正在提交任务...`, chapterNumber: selectedChapter.chapterNumber, detail: `《${selectedChapter.title || ''}》最多${maxRounds}轮`, timestamp: new Date().toISOString() });
        try {
            const res = await runFullPipelineMut.mutateAsync({
                projectId: currentProject.id, chapterId: selectedChapter.id, maxRounds,
            });
            const taskId = res?.taskId;
            if (!taskId) {
                const errMsg = res?.error || '服务端未返回任务ID，可能流水线启动失败';
                addPipelineLog({ step: 'full-pipeline', status: 'error', error: errMsg, timestamp: new Date().toISOString() });
                alert('本章流水线启动失败：' + errMsg);
                setPipelineState({ running: false, currentStep: null });
                return;
            }
            setFullPipelineTaskId(taskId);
            setFullPipelinePolling(true);
            setFullPipelinePollErrors(0);
            addPipelineLog({
                step: 'full-pipeline', status: 'running',
                message: `任务已提交(ID: ${taskId.substring(0, TASK_ID_DISPLAY_LENGTH)})，AI正在写作..`,
                timestamp: new Date().toISOString(),
            });
        } catch (e) {
            const errMsg = e.code === 'ECONNABORTED'
                ? '请求超时，服务器可能正在处理'
                : e.response?.data?.error || e.response?.data?.message || e.message || '未知错误';
            const detail = e.response?.status === 403 ? '授权已过期，请检查许可证'
                : e.response?.status === 404 ? 'API路由不存在，请检查服务器版本'
                : e.response?.status >= 500 ? '服务器内部错误: ' + errMsg
                : errMsg;
            addPipelineLog({ step: 'full-pipeline', status: 'error', error: detail, timestamp: new Date().toISOString() });
            alert('本章流水线失败: ' + detail);
            setPipelineState({ running: false, currentStep: null });
        }
    };

    const { data: taskStatusData } = useTaskStatusPoll(fullPipelineTaskId, {
        refetchInterval: POLL_INTERVAL_MS,
        enabled: fullPipelinePolling && !!fullPipelineTaskId,
    });

    useEffect(() => {
        if (!taskStatusData || !fullPipelinePolling) return;
        if (taskStatusData.status === 'completed') {
            appendRoundLogs(addPipelineLog, taskStatusData.result, selectedChapter?.chapterNumber, selectedChapter);
            addPipelineLog({ step: 'full-pipeline', status: 'done', result: taskStatusData.result, chapterNumber: selectedChapter?.chapterNumber, detail: `第${selectedChapter?.chapterNumber}章 完成（${taskStatusData.result?.rounds || '?'}轮）`, timestamp: new Date().toISOString() });
            setFullPipelinePolling(false);
            setFullPipelineTaskId(null);
            queryClient.invalidateQueries({ queryKey: PIPELINE_KEYS.outputPaths(currentProject?.id) });
        } else if (TERMINAL_FAILURE_STATUSES.includes(taskStatusData.status)) {
            // 修复：原来只认 'failed'，看门狗把卡死任务标成 'timeout' 后前端会永远轮询下去
            const isTimeout = taskStatusData.status === 'timeout';
            const failMsg = taskStatusData.error
                || taskStatusData.result?.error
                || taskStatusData.result?.message
                || (isTimeout ? '任务超时（服务端看门狗判定，疑似LLM调用悬挂），请重试本章' : '流水线执行失败');
            addPipelineLog({ step: 'full-pipeline', status: 'error', error: failMsg, chapterNumber: selectedChapter?.chapterNumber, detail: `第${selectedChapter?.chapterNumber}章 ${isTimeout ? '超时终止' : '失败'}：` + failMsg, timestamp: new Date().toISOString() });
            alert('本章流水线' + (isTimeout ? '超时终止' : '执行失败') + '：' + failMsg);
            setFullPipelinePolling(false);
            setFullPipelineTaskId(null);
        } else if (taskStatusData.progress && typeof taskStatusData.progress === 'string') {
            addPipelineLog({ step: 'full-pipeline', status: 'running', message: taskStatusData.progress, chapterNumber: selectedChapter?.chapterNumber, timestamp: new Date().toISOString() });
        }
    }, [taskStatusData, fullPipelinePolling, currentProject?.id, addPipelineLog, queryClient]);

    return {
        runStep,
        runFullPipeline,
        fullPipelineTaskId,
        fullPipelinePolling,
        fullPipelinePollErrors,
        runStepMut,
        runFullPipelineMut,
    };
}
