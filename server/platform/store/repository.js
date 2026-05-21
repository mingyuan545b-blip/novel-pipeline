const store = require('../../db/store');
const logger = require('../../shared/logger');
const { NotFoundError, ValidationError } = require('../../shared/errors');

class BaseRepository {
    constructor(type) {
        if (!type) throw new Error('Repository type is required');
        this.type = type;
    }

    findById(id) {
        if (!id) return null;
        return store.getItem(this.type, id);
    }

    findAll(filter) {
        return store.queryItems(this.type, filter || {});
    }

    findByProject(projectId, options = {}) {
        if (this.type === 'materials') {
            return store.queryMaterialsByProject(projectId, options);
        }
        if (this.type === 'chapters') {
            return store.queryChaptersByProject(projectId, options);
        }
        return store.queryItems(this.type, { projectId, ...options });
    }

    create(data) {
        if (!data || !data.id) {
            throw new ValidationError('Item must have an id', 'id');
        }
        return store.setItem(this.type, data.id, data);
    }

    update(id, data) {
        const existing = this.findById(id);
        if (!existing) {
            throw new NotFoundError(this.type, id);
        }
        const merged = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
        return store.setItem(this.type, id, merged);
    }

    delete(id) {
        return store.deleteItem(this.type, id);
    }

    exists(id) {
        return this.findById(id) !== null;
    }

    count(filter) {
        return store.countItems(this.type, filter);
    }

    isFoundation(item) {
        if (this.type !== 'materials') return false;
        return store.isFoundationMaterial(item);
    }
}

class ProjectRepository extends BaseRepository {
    constructor() { super('projects'); }
}

class ChapterRepository extends BaseRepository {
    constructor() { super('chapters'); }

    findByChapterNumber(projectId, chapterNumber) {
        const chapters = this.findByProject(projectId);
        return chapters.find(c => c.chapterNumber === chapterNumber) || null;
    }

    findByStatus(projectId, status) {
        return this.findByProject(projectId, { status });
    }
}

class MaterialRepository extends BaseRepository {
    constructor() { super('materials'); }

    findByName(projectId, name) {
        const materials = this.findByProject(projectId);
        return materials.filter(m => m.name === name);
    }

    findByType(projectId, type) {
        return this.findByProject(projectId, { type });
    }

    findByPlane(parentPlane) {
        return this.findAll({ parentPlane });
    }

    findArchived(projectId) {
        return this.findByProject(projectId, { archived: true });
    }

    findNonArchived(projectId) {
        return this.findByProject(projectId, { archived: false });
    }
}

module.exports = {
    BaseRepository,
    ProjectRepository,
    ChapterRepository,
    MaterialRepository
};
