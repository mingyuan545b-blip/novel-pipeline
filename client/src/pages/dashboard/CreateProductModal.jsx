export default function CreateProductModal({ show, onClose, productForm, setProductForm,
    createProduct, availableCharacters, selectedCharacters, loadingChars,
    toggleCharacter, selectAllCharacters, creatingProduct }) {
    if (!show) return null;

    return (
        <div className="cyber-modal-overlay" onClick={onClose}>
            <div className="cyber-modal modal-wider" onClick={e => e.stopPropagation()}>
                <h2>📖 创建新产品</h2>
                <div className="form-group">
                    <label className="form-label">产品名称 *</label>
                    <input className="cyber-input" value={productForm.name}
                        onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="如：第二部、外传、前传..." />
                </div>
                <div className="form-group">
                    <label className="form-label">目标章节数</label>
                    <input className="cyber-input" type="number" value={productForm.targetChapters}
                        onChange={e => setProductForm({ ...productForm, targetChapters: parseInt(e.target.value) || 100 })}
                        min={1} />
                </div>
                <div className="form-group">
                    <label className="form-label">新系列焦点（可选）</label>
                    <textarea className="cyber-textarea" value={productForm.newSeriesFocus}
                        onChange={e => setProductForm({ ...productForm, newSeriesFocus: e.target.value })}
                        placeholder="描述这部新作品的焦点，如：以XX角色为主角、讲述XX时间线的故事..." rows={3} />
                </div>
                <div className="form-group">
                    <label className="flex gap-8 text-secondary text-base cursor-pointer">
                        <input type="checkbox" checked={productForm.importWorldview}
                            onChange={e => setProductForm({ ...productForm, importWorldview: e.target.checked })} />
                        🌍 导入完整世界观（世界观素材 + 地点 + 地图节点）
                    </label>
                    <div className="text-xs text-muted mt-4" style={{ paddingLeft: 24 }}>
                        勾选后将从前作复制世界观设定、地点素材和世界地图到新产品
                    </div>
                </div>
                <div className="form-group">
                    <div className="flex-between mb-8">
                        <label className="form-label" style={{ marginBottom: 0 }}>继承角色（可选）</label>
                        <button className="cyber-btn cyber-btn-sm" onClick={selectAllCharacters}>
                            {selectedCharacters.length === availableCharacters.length ? '取消全选' : '全选'}
                        </button>
                    </div>
                    {loadingChars ? (
                        <div className="p-20 text-center">加载角色中...</div>
                    ) : availableCharacters.length === 0 ? (
                        <div className="hint-box">该世界观下暂无角色，请先在现有产品中创建角色</div>
                    ) : (
                        <div className="char-grid">
                            {availableCharacters.map(c => (
                                <button key={c.id} type="button"
                                    className={`cyber-btn cyber-btn-sm ${selectedCharacters.includes(c.id) ? 'cyber-btn-primary' : ''}`}
                                    style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 11 }}
                                    onClick={() => toggleCharacter(c.id)} title={c.sourceProjectName}>
                                    ✓ {c.name} <span style={{ opacity: 0.5, fontSize: 10 }}>({c.sourceProjectName})</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedCharacters.length > 0 && (
                        <div className="mt-8 text-sm text-blue">已选择 {selectedCharacters.length} 个角色，将自动继承其设定和关系</div>
                    )}
                </div>
                <div className="flex gap-12 justify-end mt-16">
                    <button className="cyber-btn" onClick={onClose}>取消</button>
                    <button className="cyber-btn cyber-btn-primary" onClick={createProduct}
                        disabled={!productForm.name.trim() || creatingProduct}>
                        {creatingProduct ? '创建中...' : '创建产品'}
                    </button>
                </div>
            </div>
        </div>
    );
}
