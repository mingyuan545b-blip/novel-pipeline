import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import CreateProjectModal from '../components/CreateProjectModal';
import useDashboardState from './dashboard/useDashboardState';
import StatsPanel from './dashboard/StatsPanel';
import CardRenderer from './dashboard/CardRenderer';
import CleanupModal from './dashboard/CleanupModal';
import CreateFranchiseModal from './dashboard/CreateFranchiseModal';
import CreateProductModal from './dashboard/CreateProductModal';
import './dashboard/dashboard.css';
import './dashboard/dashboard-modals.css';

export default function Dashboard() {
    const s = useDashboardState();

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">仪表盘</h1>
                        <p className="page-subtitle">AI小说生产流水线 - 世界观与产品管理</p>
                    </div>
                    <button className="cyber-btn cyber-btn-sm" onClick={s.resetLayout} title="恢复默认布局">↺ 重置布局</button>
                </div>
            </div>

            {s.errorMsg && <div className="error-banner">{s.errorMsg}</div>}

            <StatsPanel franchises={s.franchises} projects={s.projects}
                totalChapters={s.totalChapters} approvedChapters={s.approvedChapters}
                currentProject={s.currentProject} />

            <DragDropContext onDragEnd={s.onDragEnd}>
                <div className="grid-2" style={{ gap: 20 }}>
                    {['left', 'right'].map(columnId => (
                        <div key={columnId}>
                            {columnId === 'left' && <div className="cyber-section-title">项目配置</div>}
                            {columnId === 'right' && (
                                <div className="flex-between mb-12">
                                    <div className="cyber-section-title">世界观与产品</div>
                                    <div className="flex gap-8">
                                        <button className="cyber-btn cyber-btn-sm" onClick={() => s.setShowCreateFranchise(true)}>+ 世界观</button>
                                        <button className="cyber-btn cyber-btn-primary cyber-btn-sm" onClick={() => s.setShowCreate(true)}>+ 独立产品</button>
                                    </div>
                                </div>
                            )}
                            <Droppable droppableId={columnId}>
                                {(provided, snapshot) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps}
                                        className={`droppable-area ${snapshot.isDraggingOver ? 'droppable-area-dragging' : ''}`}>
                                        {(s.cardLayout[columnId] || []).map((cardId, index) => (
                                            <Draggable key={cardId} draggableId={cardId} index={index}>
                                                {(provided) => (
                                                    <div ref={provided.innerRef} {...provided.draggableProps}
                                                        className="mb-12" style={{ ...provided.draggableProps.style }}>
                                                        <CardRenderer cardId={cardId}
                                                            dragHandleProps={provided.dragHandleProps} state={s} />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>

            {s.showCreate && <CreateProjectModal onClose={() => s.setShowCreate(false)} onCreated={s.selectProject} />}

            <CleanupModal cleanupModal={s.cleanupModal} setCleanupModal={s.setCleanupModal}
                cleanupStats={s.cleanupStats} cleanupTargets={s.cleanupTargets}
                setCleanupTargets={s.setCleanupTargets} cleanupKeepLocked={s.cleanupKeepLocked}
                setCleanupKeepLocked={s.setCleanupKeepLocked} cleanupLoading={s.cleanupLoading}
                cleanupResult={s.cleanupResult} executeCleanup={s.executeCleanup} />

            <CreateFranchiseModal show={s.showCreateFranchise}
                onClose={() => s.setShowCreateFranchise(false)}
                franchiseForm={s.franchiseForm} setFranchiseForm={s.setFranchiseForm}
                createFranchise={s.createFranchise}
                importSourceProjectId={s.importSourceProjectId}
                setImportSourceProjectId={s.setImportSourceProjectId}
                importOverview={s.importOverview} importCategories={s.importCategories}
                setImportCategories={s.setImportCategories}
                loadingOverview={s.loadingOverview} loadProjectOverview={s.loadProjectOverview}
                toggleImportCategory={s.toggleImportCategory}
                fileParsedData={s.fileParsedData} setFileParsedData={s.setFileParsedData}
                fileCategories={s.fileCategories} setFileCategories={s.setFileCategories}
                uploadingFile={s.uploadingFile} handleFileUpload={s.handleFileUpload}
                toggleFileCategory={s.toggleFileCategory} projects={s.projects} />

            <CreateProductModal show={s.showCreateProduct}
                onClose={() => s.setShowCreateProduct(null)}
                productForm={s.productForm} setProductForm={s.setProductForm}
                createProduct={s.createProduct} availableCharacters={s.availableCharacters}
                selectedCharacters={s.selectedCharacters} loadingChars={s.loadingChars}
                toggleCharacter={s.toggleCharacter} selectAllCharacters={s.selectAllCharacters}
                creatingProduct={s.creatingProduct} />
        </div>
    );
}
