/**
 * characterFieldSpec — 角色字段规范的四个对外函数（活代码：materialOrganizer 消费）
 *
 * 背景：这些函数此前只被 server/tests 下**永不执行**的测试覆盖（假覆盖）；
 * 死测试树清理后覆盖率被棘轮抓到下降，故补真测试。
 */
const {
    BASE_FIELDS, ROLE_LEVEL_FIELDS, GENRE_FIELD_OVERRIDES,
    getRequiredFields, getInitialMaterialTemplate, getOrganizerFieldHints, getFieldValidationRules,
} = require('../../server/config/characterFieldSpec');

describe('characterFieldSpec', () => {
    test('getRequiredFields：只返回 required 字段，且随角色等级变化', () => {
        const base = getRequiredFields('npc', 'unknown-genre');
        expect(Object.keys(base).length).toBeGreaterThan(0);
        expect(Object.values(base).every(s => s.required)).toBe(true);
        expect(base.name).toBeDefined();

        const protagonist = getRequiredFields('protagonist', 'unknown-genre');
        expect(Object.keys(protagonist).length).toBeGreaterThanOrEqual(Object.keys(base).length);
    });

    test('getRequiredFields：题材 override 的必填字段会并入', () => {
        const genreId = Object.keys(GENRE_FIELD_OVERRIDES)[0];
        if (!genreId) return;                       // 当前无题材 override 时跳过（数据驱动）
        const override = GENRE_FIELD_OVERRIDES[genreId];
        const requiredExtra = (override.extraPromptFields || []).filter(f => f.required);
        if (requiredExtra.length === 0) return;
        const fields = getRequiredFields('npc', genreId);
        for (const f of requiredExtra) expect(fields[f.key]).toBeDefined();
    });

    test('getInitialMaterialTemplate：含基础标签，题材 note 在时追加', () => {
        const tpl = getInitialMaterialTemplate('unknown-genre');
        expect(tpl).toContain('【身份/职位】');
        expect(tpl).toContain('【性格】');
        expect(tpl).toContain('【说话语气】');
        const genreId = Object.keys(GENRE_FIELD_OVERRIDES).find(g => GENRE_FIELD_OVERRIDES[g].characterPromptNote);
        // 有带 note 的题材时，模板必须带上"题材要求："（蕴含断言，不用条件内 expect）
        const tplWithNote = genreId ? getInitialMaterialTemplate(genreId) : '';
        expect(genreId === undefined || tplWithNote.includes('题材要求：')).toBe(true);
    });

    test('getOrganizerFieldHints：主角/配角带深度必填字段，NPC 不带', () => {
        const npc = getOrganizerFieldHints('npc').join('\n');
        expect(npc).toContain('personalityNote');
        expect(npc).not.toContain('innerConflictNote');

        const prot = getOrganizerFieldHints('protagonist').join('\n');
        expect(prot).toContain('innerConflictNote');
        expect(prot).toContain('必填');

        const sup = getOrganizerFieldHints('supporting').join('\n');
        expect(sup).toContain('fateArcNote');
        expect(sup).not.toContain('innerConflictNote');
    });

    test('getFieldValidationRules：规则与 required 字段一一对应', () => {
        const rules = getFieldValidationRules('protagonist', 'unknown-genre');
        const required = getRequiredFields('protagonist', 'unknown-genre');
        expect(rules.map(r => r.field).sort()).toEqual(Object.keys(required).sort());
        for (const r of rules) {
            expect(r.required).toBe(true);
            expect(r.emptyAllowed).toBe(false);
            expect(typeof r.label).toBe('string');
        }
    });

    test('PRODUCERS/CONSUMERS 与字段声明一致（每个字段都标注了生产/消费方）', () => {
        // 失败时直接列出缺声明的字段（不用 expect 第二参数：本仓库 vitest/jest 只允许一个参数）
        const missingDecl = Object.entries(BASE_FIELDS)
            .filter(([, s]) => !s.producers || !s.consumers)
            .map(([k]) => k);
        expect(missingDecl).toEqual([]);
        expect(Object.keys(ROLE_LEVEL_FIELDS).length).toBeGreaterThan(0);
    });
});
