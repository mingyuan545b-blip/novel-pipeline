import { MULTI_PLATFORMS } from './publishConstants';

export default function PlatformPanel({
    platforms, accounts, showAddAccount, setShowAddAccount,
    newAccount, setNewAccount,
    onAddAccount, onDeleteAccount, onVerifyAccount,
    onOpenPlatform, onEditAccount
}) {
    return (
        <div>
            <div className="flex-between mb-16">
                <div className="cyber-section-title" style={{ margin: 0 }}>已配置平台</div>
                <button className="cyber-btn cyber-btn-primary" onClick={() => setShowAddAccount(true)}>+ 添加平台</button>
            </div>

            {showAddAccount && (
                <AddAccountForm
                    platforms={platforms} newAccount={newAccount} setNewAccount={setNewAccount}
                    onSave={onAddAccount} onCancel={() => setShowAddAccount(false)} />
            )}

            {accounts.length === 0 ? (
                <div className="cyber-card text-center text-muted p-20">暂无平台账号，点击上方按钮添加</div>
            ) : (
                <div className="cyber-grid cyber-grid-2">
                    {accounts.map(account => (
                        <AccountCard key={account.id} account={account} platforms={platforms}
                            onVerify={onVerifyAccount} onOpen={onOpenPlatform}
                            onDelete={onDeleteAccount} onEdit={onEditAccount} />
                    ))}
                </div>
            )}

            <div className="cyber-section-title mt-20">支持的平台</div>
            <div className="cyber-grid cyber-grid-3">
                {platforms.map(p => (
                    <div key={p.id} className="cyber-card platform-card-center">
                        <div className="platform-color-dot" style={{ background: p.color }} />
                        <div className="font-bold text-md" style={{ color: p.color }}>{p.name}</div>
                        <div className="text-sm text-muted mt-4">{p.minWordsPerChapter}-{p.maxWordsPerChapter}字/章</div>
                        <div className="platform-features">
                            {p.features.map(f => <span key={f} className="cyber-badge cyber-badge-blue text-xs">{f}</span>)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AddAccountForm({ platforms, newAccount, setNewAccount, onSave, onCancel }) {
    const field = (key, label, placeholder, type) => (
        <div className="form-group">
            <label className="form-label">{label}</label>
            {type === 'select' ? (
                <select className="cyber-input" value={newAccount[key]}
                    onChange={e => setNewAccount(prev => ({ ...prev, [key]: e.target.value }))}>
                    {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            ) : type === 'time' ? (
                <input className="cyber-input" type="time" value={newAccount[key]}
                    onChange={e => setNewAccount(prev => ({ ...prev, [key]: e.target.value }))} />
            ) : (
                <input className="cyber-input" value={newAccount[key]}
                    onChange={e => setNewAccount(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder} />
            )}
        </div>
    );

    return (
        <div className="cyber-card mb-16" style={{ borderColor: 'var(--neon-blue)' }}>
            <h4 className="text-blue mb-12">添加平台账号</h4>
            <div className="config-grid">
                {field('platformId', '平台', '', 'select')}
                {field('penName', '笔名', '在该平台的笔名')}
                {field('bookId', '作品ID/书号', '平台作品ID')}
                {field('bookTitle', '作品名称', '在平台上的书名')}
                {field('bookUrl', '作品链接', 'https://...')}
                {field('defaultSchedule', '默认发布时间', '', 'time')}
            </div>
            <div className="form-group">
                <label className="form-label">备注</label>
                <textarea className="cyber-input" value={newAccount.notes}
                    onChange={e => setNewAccount(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2} placeholder="Cookie、API Key等信息（注意安全）" />
            </div>
            <div className="action-row">
                <button className="cyber-btn" onClick={onCancel}>取消</button>
                <button className="cyber-btn cyber-btn-primary" onClick={onSave}>添加</button>
            </div>
        </div>
    );
}

function AccountCard({ account, platforms, onVerify, onOpen, onDelete, onEdit }) {
    const platform = platforms.find(p => p.id === account.platformId);
    return (
        <div className="cyber-card">
            <div className="account-card-header">
                <div className="account-info-row">
                    <div className="account-color-dot" style={{ background: platform?.color || '#888' }} />
                    <span className="font-bold" style={{ color: platform?.color || 'var(--text-secondary)' }}>{account.platformName}</span>
                    <span className={`cyber-badge ${account.status === 'active' ? 'cyber-badge-green' : 'cyber-badge-red'} text-xs`}>
                        {account.status === 'active' ? '已连接' : '未连接'}
                    </span>
                </div>
                <div className="account-actions">
                    <button className="cyber-btn cyber-btn-sm text-xs text-green" onClick={() => onVerify(account)}>验证登录</button>
                    <button className="cyber-btn cyber-btn-sm text-xs text-blue" onClick={() => onOpen(account)}>打开平台</button>
                    <button className="cyber-btn cyber-btn-sm text-xs text-red" onClick={() => onDelete(account.id)}>删除</button>
                </div>
            </div>
            <div className="account-detail">
                <div>笔名: {account.penName || '-'}</div>
                <div>作品: {account.bookTitle || '-'}</div>
                {account.bookUrl && <div><a href={account.bookUrl} target="_blank" rel="noreferrer" className="text-blue text-sm">{account.bookUrl.substring(0, 40)}...</a></div>}
                <div>默认发布: {account.defaultSchedule}</div>
                <div>Cookie: {account.cookie ? '已配置' : '未配置'}</div>
            </div>
            <div className="account-config-row">
                <button className="cyber-btn cyber-btn-sm text-xs" onClick={() => {
                    const cookie = prompt('请输入Cookie（从浏览器开发者工具复制）:', account.cookie || '');
                    if (cookie !== null) onEdit(account.id, { cookie });
                }}>配置Cookie</button>
                <button className="cyber-btn cyber-btn-sm text-xs ml-8" onClick={() => {
                    const apiKey = prompt('请输入平台API Key（如有）:', account.apiKey || '');
                    if (apiKey !== null) onEdit(account.id, { apiKey });
                }}>配置API Key</button>
            </div>
        </div>
    );
}
