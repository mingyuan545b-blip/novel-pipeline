/**
 * dataContextProject.js — DataContext项目/章节/素材查询mixin
 */
const store = require('../store');
const { detectGenre } = require('./genreConfig');
const { getGenreEntitySchema, getGenreRelationTypeKeywords, getGenreRelationTypes } = require('../config/genreEntitySchemas');
const { STATUS_VALUES } = require('./chapterStatus');

const ProjectChapterMaterialMixin = {
    async getProject() {
        return this._cached('project', () => store.getItem('projects', this.projectId));
    },

    async getStyleProfile() {
        const { getStyleProfileForProject } = require('./prompts/styleInjector');
        return this._cached('styleProfile', () => getStyleProfileForProject(this.projectId));
    },

    async getGenre() {
        return this._cached('genre', async () => {
            const sp = await this.getStyleProfile();
            return detectGenre(sp);
        });
    },

    async getGenreId() {
        const genre = await this.getGenre();
        return genre ? genre.id : '';
    },

    async getGenreSchema() {
        return this._cached('genreSchema', async () => {
            const genreId = await this.getGenreId();
            return getGenreEntitySchema(genreId);
        });
    },

    async getStyleTemplate() {
        return this._cached('styleTemplate', async () => {
            const project = await this.getProject();
            if (!project?.styleTemplateId) return null;
            return store.getItem('style-templates', project.styleTemplateId);
        });
    },

    async getChapter(chapterId) {
        return store.getItem('chapters', chapterId);
    },

    async getChapters(filter = {}) {
        return this._cached('chapters', () =>
            store.queryItems('chapters', { projectId: this.projectId, ...filter })
        );
    },

    async getPreviousChapter(currentChapterNumber) {
        const chapters = await this.getChapters();
        return chapters
            .filter(c => c.chapterNumber < currentChapterNumber && c.content && (c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED))
            .sort((a, b) => b.chapterNumber - a.chapterNumber)[0] || null;
    },

    async getSkippedChapters(beforeChapterNumber) {
        const chapters = await this.getChapters();
        return chapters.filter(c => c.status === 'cooldown-waiting' && c.chapterNumber < beforeChapterNumber);
    },

    async getMaterials(filter = {}) {
        const key = `materials_${JSON.stringify(filter)}`;
        return this._cached(key, () =>
            store.queryItems('materials', { projectId: this.projectId, ...filter })
        );
    },

    async getActiveMaterials(type = null) {
        const filter = type ? { type } : {};
        const mats = await this.getMaterials(filter);
        return mats.filter(m => !m.archived);
    },

    async getForeshadowingMaterials() { return this.getActiveMaterials('foreshadowing'); },
    async getCharacterMaterials() { return this.getActiveMaterials('character'); },
    async getNarrativeBridgeMaterials() { return this.getActiveMaterials('narrative-bridge'); },

    async getCoreSettingMaterials() {
        const mats = await this.getActiveMaterials();
        return mats.filter(m => m.isCoreSetting || m.type === 'worldview' || m.type === 'power-system');
    },

    async getMaterialByType(type) { return this.getActiveMaterials(type); },

    async getMode() {
        const project = await this.getProject();
        return project?.mode || 'novel';
    },

    async getWordConfig() {
        const project = await this.getProject();
        return project?.wordConfig || {};
    },

    async getRelationTypes() {
        const genreId = await this.getGenreId();
        return getGenreRelationTypes(genreId);
    },

    async getRelationTypeKeywords() {
        const genreId = await this.getGenreId();
        return getGenreRelationTypeKeywords(genreId);
    },

    async getAgentMaterialAccess(agentName) {
        const genre = await this.getGenre();
        return genre?.agentMaterialAccess?.[agentName] || null;
    },

    async getMaterialFocus() {
        const genre = await this.getGenre();
        const project = await this.getProject();
        return genre?.styleProfile?.materialFocus || project?.styleProfile?.materialFocus || {};
    },

    async getReviewRules() {
        const genre = await this.getGenre();
        const { getGenreReviewRules } = require('./genreConfig');
        return getGenreReviewRules(genre);
    },

    // ── 任务/时间线/已归档伏笔（Agent读取需求委托） ──

    async getQuests(filter = {}) {
        const key = `quests_${JSON.stringify(filter)}`;
        return this._cached(key, () =>
            store.queryItems('quests', { projectId: this.projectId, ...filter })
        );
    },

    async getTimelines(filter = {}) {
        const key = `timelines_${JSON.stringify(filter)}`;
        return this._cached(key, () =>
            store.queryItems('timelines', { projectId: this.projectId, ...filter })
        );
    },

    async getArchivedForeshadows() {
        return this._cached('archivedForeshadows', async () => {
            const allMats = await this.getMaterials();
            return allMats
                .filter(m => m.type === 'foreshadowing' && m.archived === true)
                .map(m => ({
                    name: m.name,
                    type: m.type,
                    content: m.currentContent || m.initialContent || '',
                    archived: true,
                }));
        });
    }
};

module.exports = ProjectChapterMaterialMixin;
