import { FILE_TYPE_LABELS } from './constants';

export default function CreateFranchiseModal({ show, onClose, franchiseForm, setFranchiseForm,
    createFranchise, importSourceProjectId, setImportSourceProjectId, importOverview,
    importCategories, setImportCategories, loadingOverview, loadProjectOverview, toggleImportCategory,
    fileParsedData, fileCategories, setFileCategories, setFileParsedData,
    uploadingFile, handleFileUpload, toggleFileCategory, projects }) {
    if (!show) return null;

    return (
        <div className="cyber-modal-overlay" onClick={onClose}>
            <div className="cyber-modal modal-wider" onClick={e => e.stopPropagation()}>
                <h2>🌍 创建世界观</h2>
                <div className="form-group">
                    <label className="form-label">世界观名称 *</label>
                    <input className="cyber-input" value={franchiseForm.name}
                        onChange={e => setFranchiseForm({ ...franchiseForm, name: e.target.value })}
                        placeholder="如：修仙宇宙、星际联邦..." />
                </div>
                <div className="form-group">
                    <label className="form-label">题材类型</label>
                    <input className="cyber-input" value={franchiseForm.genre}
                        onChange={e => setFranchiseForm({ ...franchiseForm, genre: e.target.value })}
                        placeholder="如：玄幻、科幻、都市..." />
                </div>
                <div className="form-group">
                    <label className="form-label">世界观描述</label>
                    <textarea className="cyber-textarea" value={franchiseForm.description}
                        onChange={e => setFranchiseForm({ ...franchiseForm, description: e.target.value })}
                        placeholder="描述这个世界观的核心设定、规则、历史背景..." rows={3} />
                </div>
                <FileImportSection fileParsedData={fileParsedData} fileCategories={fileCategories}
                    setFileCategories={setFileCategories} setFileParsedData={setFileParsedData}
                    uploadingFile={uploadingFile} handleFileUpload={handleFileUpload}
                    toggleFileCategory={toggleFileCategory} />
                <ProjectImportSection importSourceProjectId={importSourceProjectId}
                    setImportSourceProjectId={setImportSourceProjectId} importOverview={importOverview}
                    importCategories={importCategories} setImportCategories={setImportCategories}
                    loadingOverview={loadingOverview} loadProjectOverview={loadProjectOverview}
                    toggleImportCategory={toggleImportCategory} projects={projects} />
                <div className="flex gap-12 justify-end mt-16">
                    <button className="cyber-btn" onClick={onClose}>取消</button>
                    <button className="cyber-btn cyber-btn-primary" onClick={createFranchise}
                        disabled={!franchiseForm.name.trim()}>创建世界观</button>
                </div>
            </div>
        </div>
    );
}

function FileImportSection({ fileParsedData, fileCategories, setFileCategories, setFileParsedData,
    uploadingFile, handleFileUpload, toggleFileCategory }) {
    return (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 8 }}>
            <h3 className="text-md text-orange mb-12">📄 从文件导入设定</h3>
            <div className={`file-drop-zone ${uploadingFile ? 'file-drop-zone-uploading' : ''}`}
                onClick={() => document.getElementById('franchise-file-input').click()}>
                {uploadingFile ? (
                    <div className="text-base text-blue">解析中...</div>
                ) : (
                    <>
                        <div className="text-xl mb-8">📂</div>
                        <div className="text-base text-secondary">点击选择 TXT / Markdown 文件</div>
                        <div className="text-sm text-muted mt-4">支持多文件上传，自动按标题拆分章节并分类</div>
                    </>
                )}
                <input id="franchise-file-input" type="file" accept=".txt,.md,.markdown" multiple
                    style={{ display: 'none' }} onChange={handleFileUpload} />
            </div>
            {fileParsedData && (
                <div className="mt-12">
                    <div className="flex-between mb-8">
                        <span className="text-sm text-green">✅ 已解析 {fileParsedData.length} 个文件</span>
                        <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10 }} onClick={() => {
                            const allKeys = new Set();
                            fileParsedData.forEach(p => Object.keys(p.categories).forEach(k => allKeys.add(k)));
                            if (fileCategories.length === allKeys.size) setFileCategories([]);
                            else setFileCategories([...allKeys]);
                        }}>{fileCategories.length === 0 ? '全选' : '取消全选'}</button>
                    </div>
                    <div className="grid-2 gap-6">
                        {(() => {
                            const mergedCats = {};
                            fileParsedData.forEach(p => {
                                for (const [type, items] of Object.entries(p.categories)) {
                                    if (!mergedCats[type]) mergedCats[type] = [];
                                    mergedCats[type].push(...items);
                                }
                            });
                            return Object.entries(mergedCats).map(([type, items]) => (
                                <div key={type} className={`import-category-item ${fileCategories.includes(type) ? 'import-category-item-selected' : ''}`}
                                    onClick={() => toggleFileCategory(type)}>
                                    <div className="flex-between">
                                        <span className={`text-sm ${fileCategories.includes(type) ? 'text-blue' : 'text-secondary'}`}>
                                            {FILE_TYPE_LABELS[type] || type}
                                        </span>
                                        <span className={`text-sm font-bold ${fileCategories.includes(type) ? 'text-blue' : 'text-muted'}`}>
                                            {items.length}
                                        </span>
                                    </div>
                                    {fileCategories.includes(type) && items.length > 0 && (
                                        <div className="mt-4 text-xs text-muted lh-1-5">
                                            {items.slice(0, 4).map((item, i) => (
                                                <div key={i} className="truncate">· {item.name}</div>
                                            ))}
                                            {items.length > 4 && <div>...还有 {items.length - 4} 项</div>}
                                        </div>
                                    )}
                                </div>
                            ));
                        })()}
                    </div>
                    {fileCategories.length > 0 && <div className="mt-8 text-sm text-green">将导入 {fileCategories.length} 类设定</div>}
                    <button className="cyber-btn cyber-btn-sm mt-8" style={{ fontSize: 10, color: 'var(--neon-red)' }}
                        onClick={() => { setFileParsedData(null); setFileCategories([]); }}>✕ 清除文件</button>
                </div>
            )}
        </div>
    );
}

function ProjectImportSection({ importSourceProjectId, setImportSourceProjectId, importOverview,
    importCategories, setImportCategories, loadingOverview, loadProjectOverview,
    toggleImportCategory, projects }) {
    return (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 8 }}>
            <h3 className="text-md text-orange mb-12">📥 从已有项目导入设定</h3>
            <div className="form-group">
                <label className="form-label">选择源项目</label>
                <select className="cyber-input" value={importSourceProjectId}
                    onChange={e => { setImportSourceProjectId(e.target.value); loadProjectOverview(e.target.value); }}>
                    <option value="">-- 不导入，手动创建 --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            {loadingOverview && <div className="p-16 text-center text-muted text-sm">加载项目素材概览...</div>}
            {importOverview && (
                <div className="mt-8">
                    <div className="flex-between mb-8">
                        <span className="text-sm text-secondary">{importOverview.projectName} · 共 {importOverview.totalMaterials} 个素材</span>
                        <button className="cyber-btn cyber-btn-sm" style={{ fontSize: 10 }} onClick={() => {
                            if (importCategories.length === importOverview.categories.length) setImportCategories([]);
                            else setImportCategories(importOverview.categories.map(c => c.key));
                        }}>{importCategories.length === importOverview.categories.length ? '取消全选' : '全选'}</button>
                    </div>
                    <div className="grid-2 gap-6">
                        {importOverview.categories.map(cat => (
                            <div key={cat.key} className={`import-category-item ${importCategories.includes(cat.key) ? 'import-category-item-selected' : ''}`}
                                onClick={() => toggleImportCategory(cat.key)}>
                                <div className="flex-between">
                                    <span className={`text-sm ${importCategories.includes(cat.key) ? 'text-blue' : 'text-secondary'}`}>
                                        {cat.icon} {cat.label}
                                    </span>
                                    <span className={`text-sm font-bold ${importCategories.includes(cat.key) ? 'text-blue' : 'text-muted'}`}>
                                        {cat.count}
                                    </span>
                                </div>
                                {importCategories.includes(cat.key) && cat.items.length > 0 && (
                                    <div className="mt-4 text-xs text-muted lh-1-5">
                                        {cat.items.slice(0, 5).map(item => (
                                            <div key={item.id} className="truncate">· {item.name}</div>
                                        ))}
                                        {cat.items.length > 5 && <div>...还有 {cat.items.length - 5} 项</div>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {importCategories.length > 0 && <div className="mt-8 text-sm text-green">将导入 {importCategories.length} 类设定</div>}
                </div>
            )}
            {!importSourceProjectId && (
                <div className="hint-box mt-8">💡 选择已有项目可直接导入人物、势力、世界观、背景、剧情、元素等完整设定，缺少的部分可以在创建后手动补充</div>
            )}
        </div>
    );
}
