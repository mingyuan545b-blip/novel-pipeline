import useGenreDebugState from './genre-debug/useGenreDebugState';
import GenreSelector from './genre-debug/GenreSelector';
import GenreInfoCard from './genre-debug/GenreInfoCard';
import AgentsTab from './genre-debug/AgentsTab';
import ConstraintTab from './genre-debug/ConstraintTab';
import FoundationTab from './genre-debug/FoundationTab';
import StyleTab from './genre-debug/StyleTab';
import ConstraintModulesTab from './genre-debug/ConstraintModulesTab';
import SaveBar from './genre-debug/SaveBar';
import { TAB_LIST } from './genre-debug/constants';
import s from './genre-debug/layout.module.css';

export default function GenreDebugPage() {
    const state = useGenreDebugState();

    const showSaveBar = state.activeTab !== 'agents' && state.editData;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">题材调试面板</h1>
                <p className="page-subtitle">查看题材下各Agent的素材访问配置、约束信息与提示词预览 · 约束词可实时编辑生效</p>
            </div>

            <div className={s.mainGrid}>
                <GenreSelector
                    genres={state.genres}
                    selectedGenreId={state.selectedGenreId}
                    onSelect={state.handleSelectGenre}
                    isLoading={state.genresQuery.isLoading}
                />

                <div key={state.selectedGenreId || 'empty'} style={{ overflow: 'auto' }}>
                    {!state.selectedGenreId ? (
                        <div className={s.emptyState}>
                            <div className={s.emptyIcon}>🔍</div>
                            <div className={s.emptyTitle}>选择左侧题材查看Agent配置与约束词</div>
                            <div className={s.emptySubtitle}>点击题材名称开始调试</div>
                        </div>
                    ) : (
                        <div>
                            <GenreInfoCard
                                genreInfo={state.genreInfo}
                                selectedGenreId={state.selectedGenreId}
                                agents={state.agents}
                                materialFocus={state.materialFocus}
                                requiredConstraints={state.requiredConstraints}
                                incompatibleConstraints={state.incompatibleConstraints}
                            />

                            <div className={s.tabBar}>
                                {TAB_LIST.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => state.setActiveTab(tab.key)}
                                        className={`${s.tabButton} ${state.activeTab === tab.key ? s.tabButtonActive : ''}`}
                                    >
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>

                            {state.activeTab === 'agents' && (
                                <AgentsTab
                                    agents={state.agents}
                                    expandedAgent={state.expandedAgent}
                                    onToggle={state.handleToggleAgent}
                                    promptQuery={state.promptQuery}
                                />
                            )}

                            {state.activeTab === 'constraints' && (
                                <ConstraintTab
                                    constraints={state.constraints}
                                    editData={state.editData}
                                    requiredIds={state.requiredIds}
                                    incompatibleIds={state.incompatibleIds}
                                    onChange={state.handleConstraintChange}
                                    onAdd={state.handleAddConstraint}
                                    onRemove={state.handleRemoveConstraint}
                                    isLoading={state.constraintsQuery.isLoading}
                                    isError={state.constraintsQuery.isError}
                                    error={state.constraintsQuery.error}
                                />
                            )}

                            {state.activeTab === 'modules' && (
                                <ConstraintModulesTab
                                    modulesData={state.constraintModulesQuery.data}
                                    isLoading={state.constraintModulesQuery.isLoading}
                                    isError={state.constraintModulesQuery.isError}
                                    error={state.constraintModulesQuery.error}
                                    expandedModule={state.expandedModule}
                                    onToggleModule={state.setExpandedModule}
                                />
                            )}

                            {state.activeTab === 'foundation' && (
                                <FoundationTab
                                    foundationRules={state.foundationRules}
                                    editData={state.editData}
                                    onChange={state.handleFoundationRuleChange}
                                    onAdd={state.handleAddFoundationRule}
                                    onRemove={state.handleRemoveFoundationRule}
                                    isLoading={state.constraintsQuery.isLoading}
                                />
                            )}

                            {state.activeTab === 'style' && (
                                <StyleTab
                                    styleProfile={state.styleProfile}
                                    editData={state.editData}
                                    onChange={state.handleStyleChange}
                                    pacingConfig={state.pacingConfig}
                                    isLoading={state.constraintsQuery.isLoading}
                                />
                            )}

                            {showSaveBar && (
                                <SaveBar
                                    saveStatus={state.saveStatus}
                                    saveMutation={state.saveMutation}
                                    onReset={state.handleReset}
                                    onSave={state.handleSave}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
