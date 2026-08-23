/**
 * fieldRegistryCharacter.js — 角色/物品/宠物/仆从/编年史表字段定义
 * 包含: item_definitions, character_binds, character_relations,
 *       pet_entities, servant_entities, character_chronicle
 */
module.exports = {
    item_definitions: {
        storeType: 'item-definitions',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, extractorDefault: '' },
            defType: { type: 'text', nullable: false, extractorDefault: 'equipment' },
            name: { type: 'text', nullable: false, extractorDefault: '' },
            rarity: { type: 'text', nullable: false, extractorDefault: 'common' },
            briefDesc: { type: 'text', nullable: false, extractorDefault: '' },
            summaryDesc: { type: 'text', nullable: false, extractorDefault: '' },
            detailDesc: { type: 'text', nullable: false, extractorDefault: '' },
            loreDesc: { type: 'text', nullable: false, extractorDefault: '' },
            briefTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            summaryTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            detailTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            loreTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            propertiesJson: { type: 'text', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            constraintsJson: { type: 'text', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            sourceChapter: { type: 'integer', nullable: true, extractorDefault: null },
            tags: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    character_binds: {
        storeType: 'character-binds',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, extractorDefault: '' },
            characterId: { type: 'text', nullable: false, extractorDefault: '' },
            defId: { type: 'text', nullable: false, extractorDefault: '' },
            bindType: { type: 'text', nullable: false, extractorDefault: 'equipment' },
            bindStatus: { type: 'text', nullable: false, extractorDefault: 'active' },
            permanence: { type: 'text', nullable: false, extractorDefault: 'semi-permanent' },
            acquiredChapter: { type: 'integer', nullable: false, extractorDefault: 0 },
            lostChapter: { type: 'integer', nullable: true, extractorDefault: null },
            masteryLevel: { type: 'text', nullable: false, extractorDefault: '初学' },
            masteryProgress: { type: 'integer', nullable: false, extractorDefault: 0 },
            personalNotes: { type: 'text', nullable: false, extractorDefault: '' },
            customName: { type: 'text', nullable: false, extractorDefault: '' },
            slotPosition: { type: 'text', nullable: false, extractorDefault: '' },
            bindOrder: { type: 'integer', nullable: false, extractorDefault: 0 },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    character_relations: {
        storeType: 'character-relations',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, extractorDefault: '' },
            fromCharacterId: { type: 'text', nullable: false, extractorDefault: '' },
            toCharacterId: { type: 'text', nullable: false, extractorDefault: '' },
            relType: { type: 'text', nullable: false, extractorDefault: 'other' },
            relLabel: { type: 'text', nullable: false, extractorDefault: '' },
            strength: { type: 'integer', nullable: false, extractorDefault: 50 },
            trustLevel: { type: 'integer', nullable: false, extractorDefault: 50 },
            startChapter: { type: 'integer', nullable: false, extractorDefault: 0 },
            endChapter: { type: 'integer', nullable: true, extractorDefault: null },
            isSecret: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            notes: { type: 'text', nullable: false, extractorDefault: '' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    pet_entities: {
        storeType: 'pet-entities',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, extractorDefault: '' },
            ownerId: { type: 'text', nullable: false, extractorDefault: '' },
            name: { type: 'text', nullable: false, extractorDefault: '' },
            species: { type: 'text', nullable: false, extractorDefault: '' },
            petClass: { type: 'text', nullable: false, extractorDefault: 'beast' },
            rarity: { type: 'text', nullable: false, extractorDefault: 'common' },
            growthStage: { type: 'text', nullable: false, extractorDefault: '幼体' },
            level: { type: 'integer', nullable: false, extractorDefault: 1 },
            hp: { type: 'integer', nullable: false, extractorDefault: 100 },
            mp: { type: 'integer', nullable: false, extractorDefault: 50 },
            loyalty: { type: 'integer', nullable: false, extractorDefault: 80 },
            intelligence: { type: 'integer', nullable: false, extractorDefault: 30 },
            abilitiesJson: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            equipmentSlots: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            briefDesc: { type: 'text', nullable: false, extractorDefault: '' },
            summaryDesc: { type: 'text', nullable: false, extractorDefault: '' },
            detailDesc: { type: 'text', nullable: false, extractorDefault: '' },
            acquiredChapter: { type: 'integer', nullable: false, extractorDefault: 0 },
            isActive: { type: 'boolean', nullable: false, extractorDefault: true, extractorTransform: 'boolNotFalse' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    servant_entities: {
        storeType: 'servant-entities',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, extractorDefault: '' },
            masterId: { type: 'text', nullable: false, extractorDefault: '' },
            name: { type: 'text', nullable: false, extractorDefault: '' },
            servantType: { type: 'text', nullable: false, extractorDefault: 'retainer' },
            loyalty: { type: 'integer', nullable: false, extractorDefault: 70 },
            competence: { type: 'integer', nullable: false, extractorDefault: 50 },
            specialty: { type: 'text', nullable: false, extractorDefault: '' },
            personality: { type: 'text', nullable: false, extractorDefault: '' },
            briefDesc: { type: 'text', nullable: false, extractorDefault: '' },
            summaryDesc: { type: 'text', nullable: false, extractorDefault: '' },
            detailDesc: { type: 'text', nullable: false, extractorDefault: '' },
            recruitedChapter: { type: 'integer', nullable: false, extractorDefault: 0 },
            dismissedChapter: { type: 'integer', nullable: true, extractorDefault: null },
            isActive: { type: 'boolean', nullable: false, extractorDefault: true, extractorTransform: 'boolNotFalse' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    character_chronicle: {
        storeType: 'character-chronicle',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, extractorDefault: '' },
            entityId: { type: 'text', nullable: false, extractorDefault: '' },
            entityName: { type: 'text', nullable: false, extractorDefault: '' },
            chapterNumber: { type: 'integer', nullable: false, extractorDefault: 0 },
            stance: { type: 'text', nullable: false, extractorDefault: '' },
            innerConflict: { type: 'text', nullable: false, extractorDefault: '' },
            quotes: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            deeds: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            stanceShiftReason: { type: 'text', nullable: false, extractorDefault: '' },
            level: { type: 'text', nullable: false, extractorDefault: 'basic' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    }
};
