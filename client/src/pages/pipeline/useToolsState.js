import { useState } from 'react';
import {
    usePipelineContextBudget,
    usePipelineInjectionMap,
    usePipelineHookBudget,
    usePipelineRuleStack,
    usePipelineChapterIntent,
    usePipelinePromptAudit,
    useRunOptimizerReport,
    useApplyOptimizerPattern,
} from '../../hooks/queries';

export function useToolsState(currentProject, selectedChapter) {
    const [contextBudgetInfo, setContextBudgetInfo] = useState(null);
    const [injectionMapInfo, setInjectionMapInfo] = useState(null);
    const [hookBudgetInfo, setHookBudgetInfo] = useState(null);
    const [ruleStackInfo, setRuleStackInfo] = useState(null);
    const [chapterIntentInfo, setChapterIntentInfo] = useState(null);
    const [promptAuditInfo, setPromptAuditInfo] = useState(null);
    const [promptAuditLoading, setPromptAuditLoading] = useState(false);
    const [optimizerReport, setOptimizerReport] = useState(null);
    const [optimizerLoading, setOptimizerLoading] = useState(false);
    const [optimizerApplying, setOptimizerApplying] = useState(null);

    const contextBudgetQuery = usePipelineContextBudget(currentProject?.id);
    const injectionMapQuery = usePipelineInjectionMap(currentProject?.id);
    const hookBudgetQuery = usePipelineHookBudget(currentProject?.id);
    const ruleStackQuery = usePipelineRuleStack(currentProject?.id);
    const chapterIntentQuery = usePipelineChapterIntent(currentProject?.id, selectedChapter?.chapterNumber);
    const promptAuditQuery = usePipelinePromptAudit(currentProject?.id);
    const runOptimizerReport = useRunOptimizerReport();
    const applyOptimizerPattern = useApplyOptimizerPattern();

    return {
        contextBudgetInfo, setContextBudgetInfo,
        injectionMapInfo, setInjectionMapInfo,
        hookBudgetInfo, setHookBudgetInfo,
        ruleStackInfo, setRuleStackInfo,
        chapterIntentInfo, setChapterIntentInfo,
        promptAuditInfo, setPromptAuditInfo,
        promptAuditLoading, setPromptAuditLoading,
        optimizerReport, setOptimizerReport,
        optimizerLoading, setOptimizerLoading,
        optimizerApplying, setOptimizerApplying,
        contextBudgetQuery,
        injectionMapQuery,
        hookBudgetQuery,
        ruleStackQuery,
        chapterIntentQuery,
        promptAuditQuery,
        runOptimizerReport,
        applyOptimizerPattern,
    };
}
