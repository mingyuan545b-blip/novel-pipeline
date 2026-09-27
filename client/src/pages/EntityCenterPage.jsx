import './entitycenter/entityCenter.css';
import './entitycenter/entityCenterComponents.css';
import useEntityCenterState from './entitycenter/useEntityCenterState';
import { StatCard, LoadingSkeleton } from './entitycenter/UiComponents';
import { TABS, STATS_CONFIG } from './entitycenter/constants';
import TreeSidebar from './entitycenter/TreeSidebar';
import CharacterTab from './entitycenter/CharacterTab';
import GenreConstraintsPanel from './entitycenter/GenreConstraintsPanel';
import ChronicleTab from './entitycenter/ChronicleTab';
import WorldScopeTab from './entitycenter/WorldScopeTab';
import CrossWorldTraceTab from './entitycenter/CrossWorldTraceTab';
import { EquipmentTab, TechniquesTab } from './entitycenter/EntityCard';
import { PetsTab, ServantsTab } from './entitycenter/PetServantTab';
import EntityGraph from './entitycenter/EntityGraph';
import StateTrackingTab from './entitycenter/StateTrackingTab';
import KnowledgeTab from './entitycenter/KnowledgeTab';
import { SummaryTab } from './entitycenter/SummarySystemTab';
import SystemTab from './entitycenter/SystemTab';
import { projectsApi } from '../services/api';
import useAppStore from '../store/useAppStore';

export default function EntityCenterPage() {
    const state = useEntityCenterState();
    const {
        currentProject, activeTab, setActiveTab,
        selectedCharId, setSelectedCharId, expandedIds, descLevel,
        kvScopeFilter, setKvScopeFilter, historyCharId, setHistoryCharId,
        summaryCharId, setSummaryCharId, selectedChapter, setSelectedChapter,
        syncFrom, setSyncFrom, syncTo, setSyncTo,
        regLoading, characters, equipment, techniques, pets, servants,
        allBinds, allRelations, csCharactersData, kvData, summaryData,
        statesData, csMeta, historyData, syncMut, chapterOptions,
        getCharName, toBeijingTime, handleSync, handleMigrateChineseKeys,
        selectedChar, charBinds, charRelations, toggleExpand, toggleDesc,
        statsValues, handleRepaired, materialsByName, patchLifecycle,
    } = state;
    const onPatchLifecycle = (id, patch) => patchLifecycle.mutate({ id, patch });

    if (!currentProject) {
        return (
            <div>
                <div className="page-header"><h1 className="page-title">实体管理中心</h1></div>
                <div className="cyber-card cyber-empty">请先在仪表盘选择一个项目</div>
            </div>
        );
    }

    const statsCards = STATS_CONFIG.map(s => ({ ...s, value: statsValues[s.key] }));

    return (
        <div>
            <div className="page-header">
                <div className="ec-flex ec-justify-between ec-items-center ec-flex-wrap ec-gap-12">
                    <div>
                        <h1 className="page-title">实体管理中心</h1>
                        <p className="page-subtitle">角色 · 装备 · 功法 · 宠物 · 仆人 · 关系 · 状态追踪 全局管理</p>
                    </div>
                    <div className="ec-flex ec-gap-10 ec-flex-wrap">
                        {statsCards.map(s => <StatCard key={s.label} label={s.label} value={s.value} color={s.color} icon={s.icon} />)}
                    </div>
                </div>
            </div>

            <div className="ec-mindmap-layout">
                <TreeSidebar activeTab={activeTab} onTabChange={setActiveTab} />
                <div className="ec-mindmap-content">
                {activeTab === 'characters' && (
                    <>
                        <CharacterTab characters={characters} selectedCharId={selectedCharId} setSelectedCharId={setSelectedCharId}
                            regLoading={regLoading} selectedChar={selectedChar} charBinds={charBinds} charRelations={charRelations}
                            getCharName={getCharName} LoadingSkeleton={LoadingSkeleton}
                            projectId={currentProject?.id} onRepaired={handleRepaired} />
                        <GenreConstraintsPanel projectId={currentProject?.id} />
                    </>
                )}
                {activeTab === 'chronicle' && (
                    <ChronicleTab projectId={currentProject?.id} project={currentProject}
                        onUpdateProject={async (patch) => {
                            // 只发送 patch（如 {settings: newSettings}），id 从 currentProject 取
                            const pid = currentProject?.id;
                            if (!pid) return;
                            await projectsApi.update(pid, patch);
                            // 合并 patch 到 currentProject 并更新本地状态
                            const merged = { ...currentProject, ...patch, settings: { ...(currentProject.settings || {}), ...(patch.settings || {}) } };
                            useAppStore.getState().setCurrentProject(merged);
                        }}
                    />
                )}
                {activeTab === 'worldscope' && (
                    <WorldScopeTab projectId={currentProject?.id} project={currentProject}
                        onUpdateProject={async (patch) => {
                            const pid = currentProject?.id;
                            if (!pid) return;
                            await projectsApi.update(pid, patch);
                            const merged = { ...currentProject, ...patch, settings: { ...(currentProject.settings || {}), ...(patch.settings || {}) } };
                            useAppStore.getState().setCurrentProject(merged);
                        }}
                    />
                )}
                {activeTab === 'cross-world-trace' && (
                    <CrossWorldTraceTab projectId={currentProject?.id} />
                )}
                {activeTab === 'knowledge' && (
                    <KnowledgeTab projectId={currentProject?.id} characters={characters} />
                )}
                {activeTab === 'equipment' && (
                    <EquipmentTab equipment={equipment} expandedIds={expandedIds} descLevel={descLevel}
                        toggleExpand={toggleExpand} toggleDesc={toggleDesc} allBinds={allBinds} getCharName={getCharName}
                        materialsByName={materialsByName} onPatchLifecycle={onPatchLifecycle} />
                )}
                {activeTab === 'techniques' && (
                    <TechniquesTab techniques={techniques} expandedIds={expandedIds} descLevel={descLevel}
                        toggleExpand={toggleExpand} toggleDesc={toggleDesc} allBinds={allBinds} getCharName={getCharName}
                        materialsByName={materialsByName} onPatchLifecycle={onPatchLifecycle} />
                )}
                {activeTab === 'pets' && (
                    <PetsTab pets={pets} expandedIds={expandedIds} toggleExpand={toggleExpand} getCharName={getCharName} />
                )}
                {activeTab === 'servants' && (
                    <ServantsTab servants={servants} expandedIds={expandedIds} toggleExpand={toggleExpand} getCharName={getCharName} />
                )}
                {activeTab === 'relations' && (
                    <EntityGraph allRelations={allRelations} getCharName={getCharName}
                        characters={characters} onCreateRelation={state.handleCreateRelation} />
                )}
                {activeTab === 'state-tracking' && (
                    <StateTrackingTab kvData={kvData} kvScopeFilter={kvScopeFilter} setKvScopeFilter={setKvScopeFilter}
                        historyCharId={historyCharId} setHistoryCharId={setHistoryCharId} historyData={historyData}
                        csCharactersData={csCharactersData} statesData={statesData} toBeijingTime={toBeijingTime} />
                )}
                {activeTab === 'summary' && (
                    <SummaryTab summaryCharId={summaryCharId} setSummaryCharId={setSummaryCharId}
                        selectedChapter={selectedChapter} setSelectedChapter={setSelectedChapter}
                        characters={characters} summaryData={summaryData} csMeta={csMeta} chapterOptions={chapterOptions} />
                )}
                {activeTab === 'system' && (
                    <SystemTab csMeta={csMeta} syncFrom={syncFrom} setSyncFrom={setSyncFrom}
                        syncTo={syncTo} setSyncTo={setSyncTo} handleSync={handleSync}
                        syncMut={syncMut} handleMigrateChineseKeys={handleMigrateChineseKeys} />
                )}
                </div>
            </div>
        </div>
    );
}
