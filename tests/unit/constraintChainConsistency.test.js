/**
 * 约束传递链路一致性测试
 * 断言执笔和所有审核员收到相同的povRule，防止视角违规反复打回
 *
 * SOP校验逻辑链：
 * 1. styleProfile.povRule 存在
 * 2. writer 的 slots 包含 style-profile
 * 3. 所有 review agent 的 slots 包含 style-profile
 * 4. 所有 review agent 的 user prompt 包含 povSection
 * 5. final-editor 优先使用 styleProfile.povRule
 * 6. reviewShared.js 不包含"叙事视角是否无意泄露"旧措辞
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SERVER = path.join(ROOT, 'server');

function readFile(relPath) {
    const fullPath = path.join(SERVER, relPath);
    return fs.readFileSync(fullPath, 'utf8');
}

function readGenreStyleProfile(genre) {
    const stylePath = path.join(SERVER, 'services', 'genres', genre, 'styleProfile.js');
    if (!fs.existsSync(stylePath)) return null;
    return fs.readFileSync(stylePath, 'utf8');
}

function listGenres() {
    const genresDir = path.join(SERVER, 'services', 'genres');
    return fs.readdirSync(genresDir).filter(d => {
        const stat = fs.statSync(path.join(genresDir, d));
        return stat.isDirectory() && !d.startsWith('.');
    });
}

describe('约束传递链路一致性', () => {

    describe('SOP第1环：大纲/意图层视角约束', () => {
        test('所有题材的styleProfile都应定义povRule', () => {
            const genres = listGenres();
            expect(genres.length).toBeGreaterThan(0);
            for (const genre of genres) {
                const content = readGenreStyleProfile(genre);
                if (content === null) continue; // 跳过没有styleProfile的题材
                expect(content).toContain('povRule');
            }
        });

        test('高武穿越题材的povRule应定义局外人+吐槽役视角', () => {
            const content = readGenreStyleProfile('high-martial-crossplane');
            expect(content).not.toBeNull();
            expect(content).toContain('povRule');
            expect(content).toContain('局外人');
            expect(content).toContain('吐槽役');
        });
    });

    describe('SOP第2环：执笔收到povRule约束', () => {
        test('writer的slots应包含style-profile', () => {
            const content = readFile('services/prompts/agentJobTemplates.js');
            const writerMatch = content.match(/'writer':\s*\{[^}]*slots:\s*\[([^\]]*)\]/s);
            expect(writerMatch).not.toBeNull();
            expect(writerMatch[1]).toContain("'style-profile'");
        });

        test('styleHierarchy应将povRule标记为最高优先级', () => {
            const content = readFile('services/prompts/styleHierarchy.js');
            expect(content).toContain('【视角规则·最高优先级】');
        });
    });

    describe('SOP第3环：约束词完整性', () => {
        test('constraintScopes不应包含视角相关约束词', () => {
            const content = readFile('services/prompts/constraintScopes.js');
            // povRule通过style-profile slot注入，不是constraints slot
            expect(content).not.toContain('perspective');
            expect(content).not.toContain('povRule');
        });

        test('character-consistency约束应包含越权行为说明', () => {
            const content = readFile('services/prompts/constraintInjector.js');
            expect(content).toContain('越权行为视为OOC崩坏');
        });
    });

    describe('SOP第4环：审核员依据的约束与执笔一致', () => {
        const reviewAgents = [
            { name: 'first-review', file: 'services/pipeline/steps/review/firstReview.js' },
            { name: 'second-review', file: 'services/pipeline/steps/review/secondReview.js' },
            { name: 'fast-review', file: 'services/pipeline/steps/review/fastReview.js' },
            { name: 'final-editor', file: 'services/pipeline/steps/finalEditor.js' },
        ];

        for (const agent of reviewAgents) {
            test(`${agent.name}的slots应包含style-profile`, () => {
                const content = readFile('services/prompts/agentJobTemplates.js');
                const regex = new RegExp(`'${agent.name}':\\s*\\{[^}]*slots:\\s*\\[([^\\]]*)\\]`, 's');
                const match = content.match(regex);
                expect(match).not.toBeNull();
                expect(match[1]).toContain("'style-profile'");
            });

            test(`${agent.name}的user prompt应包含povSection注入`, () => {
                const content = readFile(agent.file);
                // 检查是否包含povSection相关变量
                const hasPovSection = content.includes('PovSection') ||
                                      content.includes('povSection') ||
                                      content.includes('_fePovSection');
                expect(hasPovSection).toBe(true);
            });
        }

        test('reviewShared.js不应包含"叙事视角是否无意泄露"旧措辞', () => {
            const content = readFile('services/pipeline/steps/review/reviewShared.js');
            expect(content).not.toContain('叙事视角是否无意泄露');
        });

        test('限知约束段应包含"视角切换本身不是违规"明确说明（迁移到characterSectionBuilders.js）', () => {
            // 措辞已从reviewShared.js迁移到characterSectionBuilders.js的buildKnowledgeAccessSection
            const content = readFile('services/pipeline/characterSectionBuilders.js');
            expect(content).toContain('视角切换本身不是违规');
        });
    });

    describe('SOP第5环：final-editor视角规则来源统一', () => {
        test('final-editor应优先使用styleProfile.povRule', () => {
            const content = readFile('services/pipeline/steps/finalEditor.js');
            expect(content).toContain('_feStyleProfile.povRule');
        });

        test('final-editor不应单独依赖getGenreReviewRules', () => {
            const content = readFile('services/pipeline/steps/finalEditor.js');
            // 允许fallback到getGenreReviewRules，但不能是唯一来源
            const hasStyleProfileSource = content.includes('_feStyleProfile.povRule');
            expect(hasStyleProfileSource).toBe(true);
        });
    });

    describe('防重复SOP机制', () => {
        test('verifyConstraintChain.js校验脚本应存在', () => {
            const scriptPath = path.join(ROOT, 'scripts', 'verifyConstraintChain.js');
            expect(fs.existsSync(scriptPath)).toBe(true);
        });
    });
});
