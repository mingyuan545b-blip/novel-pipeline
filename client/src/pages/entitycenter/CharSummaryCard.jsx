/* eslint-disable react-refresh/only-export-components */
import { GENRE_LABELS, GENRE_COLORS } from './constants';

const SUMMARY_FIELDS = [
    { key: 'position', label: '身份', color: '#00d4ff' },
    { key: 'factionName', label: '阵营', color: '#ff6b9d' },
    { key: 'personality', label: '性格', color: '#ffd93d' },
    { key: 'speakingTone', label: '语气', color: '#6bcb77' },
    { key: 'signatureDetail', label: '标志', color: '#c084fc' },
    { key: 'craftStyle', label: '风格', color: '#f97316' },
    { key: 'roleLevel', label: '等级', color: '#94a3b8' },
];

function parseCharacterBlock(text) {
    if (!text || text === '暂无数据' || text === '暂无角色数据') return [];
    const blocks = [];
    const lines = text.split('\n').filter(l => l.trim());
    let current = null;
    for (const line of lines) {
        const headerMatch = line.match(/【(.+?)】(.*)/);
        if (headerMatch) {
            if (current) blocks.push(current);
            current = { name: headerMatch[1], fields: {}, inlineParts: headerMatch[2]?.trim() || '' };
            if (current.inlineParts) {
                for (const part of current.inlineParts.split(', ')) {
                    const kv = part.match(/(.+?)=(.+)/);
                    if (kv) current.fields[kv[1].trim()] = kv[2].trim();
                }
            }
        } else if (current) {
            const kv = line.match(/(.+?)[:：]\s*(.+)/);
            if (kv) current.fields[kv[1].trim()] = kv[2].trim();
        }
    }
    if (current) blocks.push(current);
    return blocks;
}

export default function CharSummaryCard({ block, index }) {
    const fieldEntries = Object.entries(block.fields);
    const hasData = fieldEntries.some(([, v]) => v && v !== '');
    return (
        <div className="cyber-card ec-summary-card" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="ec-flex ec-justify-between ec-items-center ec-mb-8">
                <h4 className="ec-text-14 ec-font-600 ec-color-cyan">{block.name}</h4>
                {!hasData && <span className="ec-badge ec-badge-muted">暂无详细数据</span>}
            </div>
            {hasData && (
                <div className="ec-flex ec-flex-wrap ec-gap-6">
                    {fieldEntries.map(([label, value]) => {
                        if (!value || value === '') return null;
                        const fieldDef = SUMMARY_FIELDS.find(f => f.label === label);
                        const color = fieldDef?.color || '#888';
                        return (
                            <span key={label} className="ec-summary-tag" style={{ '--tag-color': color, '--tag-bg': `${color}15` }}>
                                <span className="ec-summary-tag-label">{label}</span>
                                <span className="ec-summary-tag-value">{value}</span>
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export { parseCharacterBlock, SUMMARY_FIELDS };
