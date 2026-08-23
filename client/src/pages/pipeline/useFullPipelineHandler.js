import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';
import { useRunStep, useRunFullPipeline, useTaskStatusPoll, PIPELINE_KEYS } from '../../hooks/queries';

const TASK_ID_DISPLAY_LENGTH = 12;
const POLL_INTERVAL_MS = 3000;

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
        addPipelineLog({ step: 'full-pipeline', status: 'running', message: '正在提交任务...', timestamp: new Date().toISOString() });
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
            addPipelineLog({ step: 'full-pipeline', status: 'done', result: taskStatusData.result, timestamp: new Date().toISOString() });
            setFullPipelinePolling(false);
            setFullPipelineTaskId(null);
            queryClient.invalidateQueries({ queryKey: PIPELINE_KEYS.outputPaths(currentProject?.id) });
        } else if (taskStatusData.status === 'failed') {
            const failMsg = taskStatusData.error || taskStatusData.result?.error || taskStatusData.result?.message || '流水线执行失败';
            addPipelineLog({ step: 'full-pipeline', status: 'error', error: failMsg, timestamp: new Date().toISOString() });
            alert('本章流水线执行失败：' + failMsg);
            setFullPipelinePolling(false);
            setFullPipelineTaskId(null);
        } else if (taskStatusData.progress && typeof taskStatusData.progress === 'string') {
            addPipelineLog({ step: 'full-pipeline', status: 'running', message: taskStatusData.progress, timestamp: new Date().toISOString() });
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
