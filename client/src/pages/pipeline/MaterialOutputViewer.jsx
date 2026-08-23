import { safeStr } from './pipelineConstants';
import SafeMarkdown from './SafeMarkdown';
import s from './MaterialOutputViewer.module.css';

const parseRawOutput = (raw) => {
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw); } catch { return null; }
};

const fmtContent = (u) => {
    if (!u.content) return '';
    if (typeof u.content === 'string') return u.content;
    if (typeof u.content === 'object') return Object.entries(u.content).map(([k, v]) => `**${k}**：${safeStr(v)}`).join('\n');
    return String(u.content);
};

const CreateItems = ({ items }) => (
    <div className={s.section}>
        <div className={`${s.sectionTitle} ${s.sectionTitleGreen}`}>🆕新建素材 ({items.length})</div>
        {items.map((u, i) => {
            const uContent = fmtContent(u);
            return (
                <div key={i} className={s.itemCard}>
                    <span className={s.typeTag}>[{safeStr(u.type)}]</span>
                    <span className={s.itemName}>{safeStr(u.name)}</span>
                    {u.reason && <span className={s.itemReason}>📝{safeStr(u.reason)}</span>}
                    {uContent && (
                        <div className={`markdown-content ${s.itemContent}`}>
                            <SafeMarkdown>{uContent.substring(0, 500)}{uContent.length > 500 ? '...' : ''}</SafeMarkdown>
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

const UpdateItems = ({ items }) => (
    <div className={s.section}>
        <div className={`${s.sectionTitle} ${s.sectionTitleBlue}`}>📝 更新素材 ({items.length})</div>
        {items.map((u, i) => (
            <div key={i} className={`${s.itemCard} ${s.itemCardBlue}`}>
                <span className={s.typeTag}>[{safeStr(u.type)}]</span>
                <span className={s.itemName}>{safeStr(u.name)}</span>
                {u.reason && <span className={s.itemReason}>?{safeStr(u.reason)}</span>}
            </div>
        ))}
    </div>
);

const ArchiveItems = ({ items }) => (
    <div className={s.section}>
        <div className={`${s.sectionTitle} ${s.sectionTitleOrange}`}>📦 归档素材 ({items.length})</div>
        {items.map((u, i) => (
            <div key={i} className={`${s.itemCard} ${s.itemCardOrange}`}>
                <span className={s.typeTag}>[{safeStr(u.type)}]</span>
                <span className={s.itemName}>{safeStr(u.name)}</span>
                <span className="cyber-badge" style={{ marginLeft: 8, fontSize: 10 }}>{safeStr(u.action)}</span>
                {u.reason && <span className={s.itemReason}>?{safeStr(u.reason)}</span>}
            </div>
        ))}
    </div>
);

const ForeshadowTracking = ({ items }) => (
    <div className={s.section}>
        <div className={`${s.sectionTitle} ${s.sectionTitlePurple}`}>🔮 伏笔追踪 ({items.length})</div>
        {items.map((ft, i) => {
            const isRecovered = ft.status === '已回收' || ft.status === '回收';
            let ftDetail = '';
            if (ft.detail) {
                if (typeof ft.detail === 'string') ftDetail = ft.detail;
                else if (typeof ft.detail === 'object') ftDetail = Object.entries(ft.detail).map(([k, v]) => `${k}：${safeStr(v)}`).join('；');
                else ftDetail = String(ft.detail);
            }
            return (
                <div key={i} className={s.itemCard} style={{ borderLeftColor: isRecovered ? 'var(--neon-green)' : 'var(--neon-orange)' }}>
                    <span className={s.itemName}>{safeStr(ft.name)}</span>
                    <span className={`cyber-badge ${isRecovered ? 'cyber-badge-green' : 'cyber-badge-purple'}`} style={{ marginLeft: 8, fontSize: 10 }}>{safeStr(ft.status)}</span>
                    {ftDetail && <span className={s.itemReason}>{ftDetail}</span>}
                </div>
            );
        })}
    </div>
);

const ArchiveLog = ({ items }) => (
    <div className={s.archiveLogBox}>
        <div className={`${s.sectionTitle} ${s.sectionTitleOrange}`}>📋 归档日志 ({items.length})</div>
        {items.map((log, i) => (
            <div key={i} className={s.archiveLogItem}>
                {typeof log === 'string' ? log : `${log.action || ''} ${log.name || ''}: ${log.reason || ''}`}
            </div>
        ))}
    </div>
);

export default function MaterialOutputViewer({ raw }) {
    const parsed = parseRawOutput(raw);
    if (!parsed) return <div className={`markdown-content ${s.rawFallback}`}><SafeMarkdown>{raw}</SafeMarkdown></div>;

    const updates = parsed.updates || [];
    const rawArchiveLog = parsed.archiveLog;
    const archiveLog = Array.isArray(rawArchiveLog) ? rawArchiveLog : (typeof rawArchiveLog === 'string' && rawArchiveLog ? [rawArchiveLog] : []);
    const rawForeshadow = parsed.foreshadowTracking;
    const foreshadowTracking = Array.isArray(rawForeshadow) ? rawForeshadow : (typeof rawForeshadow === 'string' && rawForeshadow ? [rawForeshadow] : []);
    const createItems = updates.filter(u => u.action === 'create' || !u.action);
    const updateItems = updates.filter(u => u.action === 'update');
    const archiveItems = updates.filter(u => ['retire', 'deprecate', 'recycle'].includes(u.action));

    return (
        <div className={s.mainContent}>
            {parsed.summary && <div className={`markdown-content ${s.summaryBox}`}><SafeMarkdown>{parsed.summary}</SafeMarkdown></div>}
            {createItems.length > 0 && <CreateItems items={createItems} />}
            {updateItems.length > 0 && <UpdateItems items={updateItems} />}
            {archiveItems.length > 0 && <ArchiveItems items={archiveItems} />}
            {foreshadowTracking.length > 0 && <ForeshadowTracking items={foreshadowTracking} />}
            {archiveLog.length > 0 && <ArchiveLog items={archiveLog} />}
        </div>
    );
}
