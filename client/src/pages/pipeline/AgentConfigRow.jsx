import { PROVIDER_DEFAULTS, PROVIDER_OPTIONS } from './agentConfigConstants';
import s from './AgentConfigRow.module.css';

export default function AgentConfigRow({ step, label, defaultProvider, defaultModel, cfg, testResult, onProviderChange, onFieldChange, onTest }) {
    const resultColor = testResult?.success ? '#2ed573' : testResult?.success === false ? '#ff6b6b' : '#ffffff';
    const resultText = testResult?.success ? `✅ ${testResult.message || '成功'}` : testResult?.success === false ? `❌ ${testResult.message || '失败'}` : testResult?.testing ? '⏳ 测试中...' : '—';

    return (
        <div className={s.row}>
            <span className={s.stepLabel}>
                {label}
                <span className={s.stepModel}>{cfg.model || defaultModel || '未指定'}</span>
            </span>
            <select value={cfg.provider || defaultProvider} onChange={e => onProviderChange(step, e.target.value)} className={s.select}>
                {PROVIDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input placeholder="API Key" value={cfg.apiKey || ''} onChange={e => onFieldChange(step, 'apiKey', e.target.value)} className={s.input} />
            <input placeholder="模型名称" value={cfg.model || ''} onChange={e => onFieldChange(step, 'model', e.target.value)} className={s.input} />
            <input placeholder="Base URL (可选)" value={cfg.baseURL || ''} onChange={e => onFieldChange(step, 'baseURL', e.target.value)} className={s.input} />
            <button className={`cyber-btn cyber-btn-sm ${s.testBtn}`} onClick={() => onTest(step, label, defaultProvider, defaultModel)}>
                {testResult?.testing ? '...' : '测试'}
            </button>
            <span title={testResult?.message} className={s.testResult} style={{ color: resultColor }}>
                {resultText}
            </span>
        </div>
    );
}
