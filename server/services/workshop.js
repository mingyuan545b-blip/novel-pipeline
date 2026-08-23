const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const store = require('../store');
const pipeline = require('./pipeline');
const logger = require('../shared/logger');

const WORKSHOP_DIR = path.join(__dirname, '..', '..', 'output', 'workshop');

function ensureWorkshopDir(subDir) {
    const dir = path.join(WORKSHOP_DIR, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function generateMaterials(projectId, settingText, project) {
    return pipeline.generateInitialMaterials(projectId, `【设定文本】\n${settingText}`);
}

async function generateOutlines(projectId, settingText, project, chapterCount = 10) {
    return pipeline.generateChapterOutlines(projectId, `【设定文本】\n${settingText}\n\n请生成${chapterCount}章大纲。`);
}

async function importSettingAndGenerate(projectId, settingText, options = {}) {
    const project = await store.getItem('projects', projectId);
    if (!project) throw new Error('Project not found');

    const { generateMaterials = true, generateOutlines = true, chapterCount = 10 } = options;

    if (settingText.length > 20000) {
        settingText = settingText.substring(0, 20000) + '\n...(内容过长已截断)';
    }

    const dir = ensureWorkshopDir(projectId);
    const settingFile = path.join(dir, 'imported-setting.txt');
    fs.writeFileSync(settingFile, settingText, 'utf-8');

    let materialsResult = null;
    let outlinesResult = null;

    if (generateMaterials) {
        try {
            materialsResult = await generateMaterials(projectId, settingText, project);
        } catch (error) {
            logger.error('workshop', 'Materials generation failed:', { errorMessage: error.message });
            materialsResult = { created: [], count: 0, error: error.message };
        }
    }

    if (generateOutlines) {
        try {
            outlinesResult = await generateOutlines(projectId, settingText, project, chapterCount);
        } catch (error) {
            logger.error('workshop', 'Outlines generation failed:', { errorMessage: error.message });
            outlinesResult = { created: [], count: 0, error: error.message };
        }
    }

    return {
        materials: materialsResult,
        outlines: outlinesResult,
        settingFile
    };
}

module.exports = {
    importSettingAndGenerate,
    generateMaterials,
    generateOutlines,
    fuseNovels: require('./workshopFusion').fuseNovels
};
