import { useState } from 'react';
import { integrityApi, flavorsApi } from '../../services/api';

export function useMaterialsIntegrityState(currentProject, refreshMaterials) {
    const [projectPromptData, setProjectPromptData] = useState(null);
    const [showPromptPanel, setShowPromptPanel] = useState(false);
    const [integrityReport, setIntegrityReport] = useState(null);
    const [showIntegrityPanel, setShowIntegrityPanel] = useState(false);
    const [fixResult, setFixResult] = useState(null);

    const checkIntegrity = async () => {
        try {
            const res = await integrityApi.check(currentProject.id);
            setIntegrityReport(res.data);
            setFixResult(null);
            setShowIntegrityPanel(true);
        } catch { /* integrity check optional */ }
    };

    const showPrompt = async () => {
        try {
            const res = await flavorsApi.getProjectPrompt(currentProject.id);
            setProjectPromptData(res.data);
            setShowPromptPanel(true);
        } catch { /* prompt optional */ }
    };

    const runIntegrityFix = async (dryRun) => {
        try {
            const res = await integrityApi.fix(currentProject.id, { dryRun });
            setFixResult(res.data);
            if (!dryRun) {
                const recheck = await integrityApi.check(currentProject.id);
                setIntegrityReport(recheck.data);
                refreshMaterials();
            }
        } catch { /* fix optional */ }
    };

    return {
        projectPromptData, showPromptPanel, setShowPromptPanel,
        integrityReport, showIntegrityPanel, setShowIntegrityPanel,
        fixResult, setFixResult,
        checkIntegrity, showPrompt, runIntegrityFix,
    };
}
