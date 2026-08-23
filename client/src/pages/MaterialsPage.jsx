import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { TABS } from './materials/materialConstants';
import useMaterialsState from './materials/useMaterialsState';
import useQuestState from './materials/useQuestState';
import MaterialActions from './materials/MaterialActions';
import MaterialTreePanel from './materials/MaterialTreePanel';
import MaterialEditor from './materials/MaterialEditor';
import QuestPanel from './materials/QuestPanel';
import CreateMaterialForm from './materials/CreateMaterialForm';
import PromptPanel from './materials/PromptPanel';
import IntegrityPanel from './materials/IntegrityPanel';
import QuestFormModal from './materials/QuestFormModal';
import styles from './materials/materials.module.css';

export default function MaterialsPage() {
    const navigate = useNavigate();
    const { currentProject, materials, setMaterials, chapters } = useAppStore();
    const [activeTab, setActiveTab] = useState('materials');

    const mat = useMaterialsState(currentProject, materials, setMaterials);
    const quest = useQuestState(currentProject, activeTab);

    const goToChapter = useCallback((chapterNumber) => {
        const ch = chapters.find(c => c.chapterNumber === chapterNumber);
        navigate(ch ? '/pipeline?chapterId=' + ch.id : '/pipeline?chapter=' + chapterNumber);
    }, [chapters, navigate]);

    const selectedMat = mat.selectedMaterialId
        ? mat.filteredMaterials.find(m => m.id === mat.selectedMaterialId)
        : null;

    return (
        <div>
            <MaterialActions
                activeView={mat.activeView} setActiveView={mat.setActiveView}
                searchTerm={mat.searchTerm} setSearchTerm={mat.setSearchTerm}
                filterType={mat.filterType} setFilterType={mat.setFilterType}
                activeCount={mat.activeMaterials.length}
                archivedCount={mat.archivedMaterials.length}
                filteredCount={mat.filteredMaterials.length}
                showCreate={mat.showCreate} setShowCreate={mat.setShowCreate}
                collapsedTypes={mat.collapsedTypes} setCollapsedTypes={mat.setCollapsedTypes}
                onCheckIntegrity={mat.checkIntegrity} onShowPrompt={mat.showPrompt}
                currentProject={currentProject}
            />

            <div className={styles.tabBar}>
                {TABS.map(tab => (
                    <button key={tab.key}
                        className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {!currentProject ? (
                <div className="cyber-card cyber-empty">
                    <div className="cyber-empty-icon">⬡</div>
                    <div>请先在仪表盘选择一个项目</div>
                </div>
            ) : (
                <>
                    {activeTab === 'materials' && (
                        mat.filteredMaterials.length === 0 ? (
                            <div className="cyber-card cyber-empty">
                                <div className="cyber-empty-icon">⬡</div>
                                <div>暂无素材，请在仪表盘生成素材库或手动创建</div>
                            </div>
                        ) : (
                            <div className={styles.materialsGrid}>
                                <MaterialTreePanel
                                    filteredMaterials={mat.filteredMaterials}
                                    selectedMaterialId={mat.selectedMaterialId}
                                    selectMaterial={mat.selectMaterial}
                                    collapsedTypes={mat.collapsedTypes}
                                    setCollapsedTypes={mat.setCollapsedTypes}
                                    expandedPlanes={mat.expandedPlanes}
                                    setExpandedPlanes={mat.setExpandedPlanes}
                                />
                                <div className={styles.detailScroll}>
                                    <MaterialEditor
                                        mat={selectedMat}
                                        filteredMaterials={mat.filteredMaterials}
                                        isEditing={mat.isEditing} editForm={mat.editForm}
                                        setEditForm={mat.setEditForm}
                                        startEdit={mat.startEdit} saveEdit={mat.saveEdit}
                                        deleteMaterial={mat.deleteMaterial}
                                        setIsEditing={mat.setIsEditing}
                                        showHistoryFor={mat.showHistoryFor}
                                        setShowHistoryFor={mat.setShowHistoryFor}
                                        goToChapter={goToChapter}
                                        availableDialects={mat.dialectsData}
                                        availableStyles={mat.stylesData}
                                        availableNamingStyles={mat.namingData}
                                        availableArchetypes={mat.archetypesData}
                                        flavorPreview={mat.flavorPreview}
                                        setFlavorPreview={mat.setFlavorPreview}
                                        currentProject={currentProject}
                                        onRefresh={mat.refreshMaterials}
                                    />
                                </div>
                            </div>
                        )
                    )}

                    {activeTab === 'quests' && (
                        <QuestPanel
                            quests={quest.quests}
                            questStatusFilter={quest.questStatusFilter}
                            setQuestStatusFilter={quest.filterQuestsByStatus}
                            currentProject={currentProject}
                            showQuestForm={quest.showQuestForm}
                            setShowQuestForm={quest.setShowQuestForm}
                            editingQuest={quest.editingQuest}
                            setEditingQuest={quest.setEditingQuest}
                            questForm={quest.questForm}
                            setQuestForm={quest.setQuestForm}
                            expandedQuests={quest.expandedQuests}
                            toggleQuestExpand={quest.toggleQuestExpand}
                            loadQuests={quest.loadQuests}
                            saveQuest={quest.saveQuest}
                            deleteQuest={quest.deleteQuest}
                        />
                    )}
                </>
            )}

            {mat.showCreate && (
                <div className="cyber-modal-overlay">
                    <div className="cyber-modal" onClick={e => e.stopPropagation()}>
                        <h2>新建素材</h2>
                        <CreateMaterialForm
                            onSubmit={mat.createMaterial}
                            onCancel={() => mat.setShowCreate(false)}
                        />
                    </div>
                </div>
            )}

            <QuestFormModal
                show={quest.showQuestForm}
                editingQuest={quest.editingQuest}
                questForm={quest.questForm}
                setQuestForm={quest.setQuestForm}
                onSave={quest.saveQuest}
                onCancel={() => { quest.setShowQuestForm(false); quest.setEditingQuest(null); }}
            />

            <PromptPanel
                data={mat.projectPromptData}
                onClose={() => mat.setShowPromptPanel(false)}
            />

            <IntegrityPanel
                report={mat.integrityReport}
                fixResult={mat.fixResult}
                onFix={mat.runIntegrityFix}
                onClose={() => mat.setShowIntegrityPanel(false)}
            />
        </div>
    );
}
