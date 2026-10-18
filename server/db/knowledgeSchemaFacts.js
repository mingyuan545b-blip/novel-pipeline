const KNOWLEDGE_FACTS_SQL = `
-- ============================================================
-- 知识库统一Schema v2 - 知识库部分
-- ============================================================

CREATE TABLE IF NOT EXISTS foreshadow_ledger (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planted',
    plantChapter INTEGER DEFAULT 0,
    lastAdvanceChapter INTEGER DEFAULT 0,
    resolveChapter INTEGER DEFAULT NULL,
    expectedResolveWindow TEXT DEFAULT '',
    importance TEXT DEFAULT 'normal',
    relatedEntityIds JSONB DEFAULT '[]'::jsonb,
    relatedPlotThreads JSONB DEFAULT '[]'::jsonb,
    advanceLog JSONB DEFAULT '[]'::jsonb,
    resolutionNotes TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foreshadow_project ON foreshadow_ledger(projectId);
CREATE INDEX IF NOT EXISTS idx_foreshadow_status ON foreshadow_ledger(projectId, status);
CREATE INDEX IF NOT EXISTS idx_foreshadow_importance ON foreshadow_ledger(projectId, importance);
CREATE INDEX IF NOT EXISTS idx_foreshadow_chapter ON foreshadow_ledger(projectId, plantChapter);

CREATE TABLE IF NOT EXISTS knowledge_facts (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'M2',
    category TEXT NOT NULL DEFAULT 'plot',
    entityId TEXT DEFAULT NULL,
    chapterNumber INTEGER DEFAULT 0,
    factText TEXT NOT NULL DEFAULT '',
    importance INTEGER DEFAULT 50,
    accessCount INTEGER DEFAULT 0,
    lastAccessedChapter INTEGER DEFAULT 0,
    decayScore REAL DEFAULT 1.0,
    expiresAtChapter INTEGER DEFAULT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kfact_project ON knowledge_facts(projectId);
CREATE INDEX IF NOT EXISTS idx_kfact_project_level ON knowledge_facts(projectId, level);
CREATE INDEX IF NOT EXISTS idx_kfact_project_category ON knowledge_facts(projectId, category);
CREATE INDEX IF NOT EXISTS idx_kfact_entity ON knowledge_facts(entityId);
CREATE INDEX IF NOT EXISTS idx_kfact_decay ON knowledge_facts(projectId, decayScore);
CREATE INDEX IF NOT EXISTS idx_kfact_chapter ON knowledge_facts(projectId, chapterNumber);

CREATE TABLE IF NOT EXISTS narrative_state (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL,
    phase TEXT NOT NULL DEFAULT 'setup',
    tension INTEGER DEFAULT 50,
    pacing TEXT DEFAULT 'moderate',
    activePlotThreads JSONB DEFAULT '[]'::jsonb,
    completedPlotThreads JSONB DEFAULT '[]'::jsonb,
    milestone TEXT DEFAULT '',
    emotionalArc JSONB DEFAULT '{}'::jsonb,
    readerExpectation JSONB DEFAULT '{}'::jsonb,
    notes TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_narr_project_ch ON narrative_state(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_narr_project_phase ON narrative_state(projectId, phase);

CREATE TABLE IF NOT EXISTS consistency_checks (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL,
    checkType TEXT NOT NULL DEFAULT 'name',
    severity TEXT NOT NULL DEFAULT 'warning',
    entityId TEXT DEFAULT NULL,
    description TEXT NOT NULL DEFAULT '',
    expectedValue TEXT DEFAULT '',
    actualValue TEXT DEFAULT '',
    isResolved BOOLEAN DEFAULT false,
    resolvedChapter INTEGER DEFAULT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccheck_project ON consistency_checks(projectId);
CREATE INDEX IF NOT EXISTS idx_ccheck_project_ch ON consistency_checks(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_ccheck_severity ON consistency_checks(projectId, severity);
CREATE INDEX IF NOT EXISTS idx_ccheck_unresolved ON consistency_checks(projectId, isResolved) WHERE isResolved = false;

CREATE TABLE IF NOT EXISTS timeline (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL DEFAULT 0,
    eventTime TEXT DEFAULT '',
    eventType TEXT NOT NULL DEFAULT 'event',
    actorIds JSONB DEFAULT '[]'::jsonb,
    locationId TEXT DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    precedingEventIds JSONB DEFAULT '[]'::jsonb,
    duration TEXT DEFAULT '',
    significance TEXT DEFAULT 'normal',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_project ON timeline(projectId);
CREATE INDEX IF NOT EXISTS idx_timeline_project_chapter ON timeline(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_timeline_project_time ON timeline(projectId, eventTime);
CREATE INDEX IF NOT EXISTS idx_timeline_project_type ON timeline(projectId, eventType);

CREATE TABLE IF NOT EXISTS knowledge_access (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    factId TEXT NOT NULL,
    entityId TEXT NOT NULL,
    factText TEXT DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'certain',
    sourceHow TEXT DEFAULT '',
    sinceChapter INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ka_entity ON knowledge_access(entityId);
CREATE INDEX IF NOT EXISTS idx_ka_fact ON knowledge_access(factId);
CREATE INDEX IF NOT EXISTS idx_ka_project_entity ON knowledge_access(projectId, entityId);
CREATE INDEX IF NOT EXISTS idx_ka_project_fact ON knowledge_access(projectId, factId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ka_unique ON knowledge_access(factId, entityId);
`;

module.exports = { KNOWLEDGE_FACTS_SQL };
