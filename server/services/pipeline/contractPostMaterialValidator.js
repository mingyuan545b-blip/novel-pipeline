/**
 * contractPostMaterialValidator.js — 素材落库校验器
 *
 * 从contractValidator.js拆分，负责material-manager的post-material校验
 * 涉及IO（stateKVIndex + entityCenter），与纯字段校验职责分离
 *
 * 陷阱#79防护：material-manager执行后，深度字段必须落库到stateKVIndex
 */
const logger = require('../../shared/logger');
const stateKVIndex = require('../stateKVIndex');
const entityCenter = require('../entityCenter');
const { routeBySeverity } = require('./contractFieldChecker');

/**
 * post-material校验（material-manager专属，校验素材已落库）
 * @param {Object} contract - material-manager契约对象
 * @param {string} projectId
 * @param {number} chapterNumber
 * @returns {Promise<Object>} { passed, errors, warnings }
 */
async function validatePostMaterial(contract, projectId, chapterNumber) {
    const errors = [];
    const warnings = [];

    if (!contract || !contract.postMaterial) {
        return { passed: true, errors, warnings };
    }

    // character-states表校验（陷阱#79断链检测）
    const stateRule = contract.postMaterial.characterStates;
    if (stateRule) {
        try {
            const hasState = await stateKVIndex.hasChapterState(projectId, chapterNumber);
            if (!hasState) {
                routeBySeverity(errors, warnings, {
                    severity: stateRule.severity || 'CRITICAL',
                    errorCode: stateRule.errorCode,
                    message: stateRule.message
                });
            }
        } catch (e) {
            logger.warn('contractValidator', `post-material stateKV校验异常: ${e.message}`);
            warnings.push({
                severity: 'WARN',
                errorCode: 'MM-POST-CHECK-ERR',
                message: `character-states校验异常: ${e.message}`
            });
        }
    }

    // entityCenter角色数校验
    const charRule = contract.postMaterial.entityCenterCharacters;
    if (charRule) {
        try {
            const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
            const minCount = charRule.minCount || 1;
            if (entities.length < minCount) {
                routeBySeverity(errors, warnings, {
                    severity: charRule.severity || 'CRITICAL',
                    errorCode: charRule.errorCode,
                    message: `${charRule.message}（实际${entities.length}<${minCount}）`
                });
            }
        } catch (e) {
            logger.warn('contractValidator', `post-material entityCenter校验异常: ${e.message}`);
            warnings.push({
                severity: 'WARN',
                errorCode: 'MM-POST-CHECK-ERR',
                message: `entityCenter校验异常: ${e.message}`
            });
        }
    }

    return { passed: errors.length === 0, errors, warnings };
}

module.exports = { validatePostMaterial };
