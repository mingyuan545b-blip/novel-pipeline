import { projectsApi } from '../../services/api';
import logger from '../../shared/logger';
import { PROVIDER_DEFAULTS, AGENT_STEPS } from './agentConfigConstants';
import AgentConfigRow from './AgentConfigRow';
import s from './AgentConfigPanel.module.css';

export default function AgentConfigPanel({ currentProject, showAgentConfig, setShowAgentConfig, agentModelConfig, setAgentModelConfig, testResults, setTestResults }) {
    const handleToggle = async () => {
        if (!currentProject) return;
        if (!showAgentConfig) {
            try {
                const res = await projectsApi.getAgentModelConfig(currentProject.id);
                setAgentModelConfig(res.data || {});
            } catch (e) { logger.error('AgentConfig', 'Save failed:', e.message); }
        }
        setShowAgentConfig(!showAgentConfig);
    };

    const handleProviderChange = (step, newProvider) => {
        const defaults = PROVIDER_DEFAULTS[newProvider] || {};
        const newCfg = { ...agentModelConfig };
        newCfg[step] = { ...newCfg[step], provider: newProvider, model: defaults.model || '', baseURL: defaults.baseURL || '', apiKey: '' };
        setAgentModelConfig({ ...newCfg });
    };

    const handleFieldChange = (step, field, value) => {
        const newCfg = { ...agentModelConfig };
        newCfg[step] = { ...newCfg[step], [field]: value };
        setAgentModelConfig({ ...newCfg });
    };

    const handleTestConnection = async (step, label, defaultProvider, defaultModel) => {
        const c = agentModelConfig?.[step] || { provider: defaultProvider };
        if (!c.provider) c.provider = defaultProvider;
        if (!c.model) c.model = defaultModel;
        c.agentLabel = label;
        setTestResults(prev => ({ ...prev, [step]: { testing: true } }));
        try {
            const res = await projectsApi.testConnection(c);
            setTestResults(prev => ({ ...prev, [step]: res.data }));
        } catch (e) {
            setTestResults(prev => ({ ...prev, [step]: { success: false, message: e.message } }));
        }
    };

    const handleSave = async () => {
        if (!currentProject) return;
        try {
            await projectsApi.saveAgentModelConfig(currentProject.id, agentModelConfig);
            alert('Agent API 配置已保存');
        } catch (e) { alert('保存失败: ' + e.message); }
    };

    const handleTestAll = async () => {
        if (!currentProject) return;
        for (const { step } of AGENT_STEPS) {
            const c = agentModelConfig?.[step] || { provider: 'aliyunCoding' };
            setTestResults(prev => ({ ...prev, [step]: { testing: true } }));
            try {
                const res = await projectsApi.testConnection(c);
                setTestResults(prev => ({ ...prev, [step]: res.data }));
            } catch (e) {
                setTestResults(prev => ({ ...prev, [step]: { success: false, message: e.message } }));
            }
        }
    };

    return (
        <div className={s.wrapper}>
            <div className={s.toggleRow}>
                <button className={`cyber-btn cyber-btn-sm ${s.toggleBtn}`} onClick={handleToggle}>
                    ⚙️ Agent API 配置 {showAgentConfig ? '▲' : '▼'}
                </button>
                {agentModelConfig && <span className={s.configCount}>已配{Object.keys(agentModelConfig).length}个步骤</span>}
            </div>
            {showAgentConfig && (
                <div className={s.configPanel}>
                    <div className={s.configTitle}>⚙️ Agent API 配置 每个步骤可独立设置模</div>
                    <div className={s.configGrid}>
                        {AGENT_STEPS.map(({ step, label, defaultProvider, defaultModel }) => (
                            <AgentConfigRow key={step} step={step} label={label} defaultProvider={defaultProvider}
                                defaultModel={defaultModel} cfg={agentModelConfig?.[step] || {}}
                                testResult={testResults[step]} onProviderChange={handleProviderChange}
                                onFieldChange={handleFieldChange} onTest={handleTestConnection} />
                        ))}
                    </div>
                    {testResults && Object.values(testResults).some(r => r?.message) && (
                        <div className={s.testResults}>
                            {Object.entries(testResults).filter(([,r]) => r?.message).map(([step, r]) => (
                                <div key={step} className={`${s.testResultRow} ${r.success ? s.testResultSuccess : s.testResultFail}`}>
                                    {step}: {r.message.substring(0, 80)}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className={s.actionRow}>
                        <button className={`cyber-btn ${s.actionBtn}`} onClick={handleSave}>💾 保存配置</button>
                        <button className={`cyber-btn ${s.actionBtn}`} onClick={handleTestAll}>🧪 全部测试</button>
                    </div>
                </div>
            )}
        </div>
    );
}
