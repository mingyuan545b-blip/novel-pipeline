const DEDICATED_TABLES = new Set([
    'materials', 'chapters', 'projects', 'api_keys', 'agent_bindings',
    'reviews', 'pipeline_logs', 'infinite_pipeline_state', 'quests', 'timelines',
    'character_states', 'state_kv_index', 'character_state_cache',
    'entity_registry', 'item_definitions', 'character_binds', 'character_relations',
    'pet_entities', 'servant_entities', 'entities', 'entity_state_history',
    'entity_relations', 'entity_binds', 'foreshadow_ledger', 'knowledge_facts',
    'narrative_state', 'consistency_checks', 'craft_materials', 'timeline',
    'character_chronicle', 'knowledge_access', 'memory_layers',
    'world_scopes', 'world_factions', 'cross_world_traces'
]);

const TABLE_ALIASES = {
    'api-keys': 'api_keys',
    'agent-bindings': 'agent_bindings',
    'state-kv-index': 'state_kv_index',
    'character-states': 'character_states',
    'character-state-cache': 'character_state_cache',
    'entity-registry': 'entity_registry',
    'item-definitions': 'item_definitions',
    'character-binds': 'character_binds',
    'character-relations': 'character_relations',
    'pet-entities': 'pet_entities',
    'servant-entities': 'servant_entities',
    'entity-state-history': 'entity_state_history',
    'entity-relations': 'entity_relations',
    'entity-binds': 'entity_binds',
    'foreshadow-ledger': 'foreshadow_ledger',
    'knowledge-facts': 'knowledge_facts',
    'narrative-state': 'narrative_state',
    'consistency-checks': 'consistency_checks',
    'craft-materials': 'craft_materials',
    'timeline-events': 'timeline',
    'character-chronicle': 'character_chronicle',
    'knowledge-access': 'knowledge_access',
    'memory-layers': 'memory_layers',
    'pipeline-logs': 'pipeline_logs',
    'infinite-pipeline-state': 'infinite_pipeline_state',
    'world-scopes': 'world_scopes',
    'world-factions': 'world_factions',
    'cross-world-traces': 'cross_world_traces'
};

module.exports = { DEDICATED_TABLES, TABLE_ALIASES };
