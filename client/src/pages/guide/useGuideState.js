import { useState, useEffect } from 'react';
import { guideApi } from '../../services/api';
import logger from '../../shared/logger';

export const TABS = [
    { key: 'quickStart', label: '🚀 快速开始' },
    { key: 'templateGuide', label: '📋 模板生成' },
    { key: 'styleTemplateGuide', label: '🎨 风格模板' },
    { key: 'pipelineFlow', label: '⚙ 流水线流程' },
    { key: 'comicGuide', label: '🎬 漫剧指南' },
    { key: 'agentRoles', label: '🤖 Agent角色' }
];

export default function useGuideState() {
    const [activeTab, setActiveTab] = useState('quickStart');
    const [guideData, setGuideData] = useState(null);

    useEffect(() => {
        guideApi.getAll().then(res => setGuideData(res.data)).catch(e => logger.error('Guide', 'Load failed:', e.message));
    }, []);

    const quickStart = guideData?.quickStart || {};
    const templateGuide = guideData?.templateGuide || {};
    const styleGuide = guideData?.styleTemplateGuide || {};
    const pipelineFlow = guideData?.pipelineFlow || {};
    const comicGuide = guideData?.comicGuide || {};
    const agentRoles = guideData?.agentRoles || {};
    const aipyProGuide = guideData?.aipyProGuide || {};

    return {
        activeTab, setActiveTab, guideData,
        quickStart, templateGuide, styleGuide, pipelineFlow, comicGuide, agentRoles, aipyProGuide,
    };
}
