export default function UpdateDialog({
    show, onClose, onConfirm,
    updateChapterInput, setUpdateChapterInput,
    updateRangeStart, setUpdateRangeStart,
    updateRangeEnd, setUpdateRangeEnd
}) {
    if (!show) return null;

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') onConfirm();
    };

    return (
        <div className="update-dialog-overlay">
            <div className="update-dialog">
                <h3 className="update-dialog-title">🔄 修改章节到七猫</h3>
                <div className="mb-16">
                    <p className="update-dialog-hint">指定章节号（多个用逗号分隔）</p>
                    <input className="cyber-input w-full text-md" value={updateChapterInput}
                        onChange={e => setUpdateChapterInput(e.target.value)}
                        placeholder="如: 1,17,37,88"
                        onKeyDown={handleKeyDown} />
                </div>
                <div className="update-range-row">
                    <span className="update-dialog-hint" style={{ whiteSpace: 'nowrap' }}>批量范围</span>
                    <input className="cyber-input update-range-input" value={updateRangeStart}
                        onChange={e => setUpdateRangeStart(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="起始章"
                        onKeyDown={handleKeyDown} />
                    <span className="update-range-sep">—</span>
                    <input className="cyber-input update-range-input" value={updateRangeEnd}
                        onChange={e => setUpdateRangeEnd(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="结束章"
                        onKeyDown={handleKeyDown} />
                    <span className="update-range-hint">如 1 — 190</span>
                </div>
                <div className="action-row">
                    <button className="cyber-btn text-base" onClick={onClose}
                        style={{ color: '#aaa', borderColor: '#555' }}>取消</button>
                    <button className="cyber-btn cyber-btn-primary text-base" onClick={onConfirm}
                        style={{ borderColor: '#F39C12', color: '#F39C12' }}>确认修改</button>
                </div>
            </div>
        </div>
    );
}
