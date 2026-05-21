const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const license = require('./services/license');
const projectRoutes = require('./routes/projects');
const chapterRoutes = require('./routes/chapters');
const materialRoutes = require('./routes/materials');
const reviewRoutes = require('./routes/reviews');
const pipelineRoutes = require('./routes/pipeline');
const agentRoutes = require('./routes/agents');
const settingsRoutes = require('./routes/settings');
const guideRoutes = require('./routes/guide');
const workshopRoutes = require('./routes/workshop');
const publishRoutes = require('./routes/publish');
const comicRoutes = require('./routes/comic');
const questRoutes = require('./routes/quests');
const styleTemplateRoutes = require('./routes/style-templates');
const knowledgeRoutes = require('./routes/knowledge');
const franchiseRoutes = require('./routes/franchises');
const mapRoutes = require('./routes/map');
const worldviewProfileRoutes = require('./routes/worldview-profiles');
const libraryRoutes = require('./routes/library');
const promptConfigRoutes = require('./routes/prompt-config');
const optimizerRoutes = require('./routes/optimizer');
const chapterAuditRoutes = require('./routes/chapterAudit');
const flavorRoutes = require('./routes/flavors');
const { errorHandler } = require('./middleware/errorHandler');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3001;
let REQUEST_SECRET = process.env.REQUEST_SECRET || '';
if (!REQUEST_SECRET) {
    REQUEST_SECRET = crypto.randomBytes(16).toString('hex');
    console.log(`[AUTH] No REQUEST_SECRET in .env, generated a random one. Add REQUEST_SECRET=<your-secret> to .env for persistence.`);
}
const { createAuthMiddleware, getAuthStatus } = require('./middleware/auth');
const { encrypt: encryptApiKey, decrypt: decryptApiKey, isEncrypted: isApiKeyEncrypted } = require('./services/cryptoUtil');
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '';
const _encryptionEnabled = !!ENCRYPTION_SECRET;
if (!_encryptionEnabled) {
    console.warn('[SECURITY] ⚠️ ENCRYPTION_SECRET not configured! API Keys will be stored in PLAINTEXT. Add ENCRYPTION_SECRET to .env for security.');
}
const _effectiveEncryptionSecret = ENCRYPTION_SECRET;

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3001', 'http://127.0.0.1:5173'];
const corsOptions = allowedOrigins.length > 0
    ? { origin: allowedOrigins }
    : { origin: false };
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { success: false, error: '请求过于频繁，请稍后再试' } });
app.use(globalLimiter);

const pipelineLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'Pipeline操作过于频繁，每分钟最多10次' } });
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(createAuthMiddleware({ secret: REQUEST_SECRET }));
app.use('/output', express.static(path.join(__dirname, 'output')));

const dataDir = path.join(__dirname, '..', 'data');
[ 'projects', 'materials', 'chapters', 'reviews', 'platform-accounts', 'publish-queue', 'interactions', 'comic-config', 'comic-workflows', 'comic-storyboards', 'comic-render-queue', 'api-keys', 'quests', 'timelines', 'style-templates', 'memory-layers', 'state-snapshots', 'consistency-reports', 'franchises', 'franchise-materials', 'map-nodes', 'agent-templates', 'style-profiles', 'constraint-presets', 'foundation-prompts', 'circuit-breakers' ].forEach(dir => {
    const full = path.join(dataDir, dir);
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

function requireFeature(feature) {
    return (req, res, next) => {
        const access = license.canAccess(feature);
        if (!access.allowed) {
            return res.status(403).json({
                error: access.message,
                code: 'MEMBERSHIP_REQUIRED',
                requiredLevel: access.requiredLevel,
                currentLevel: access.currentLevel
            });
        }
        next();
    };
}

app.use('/api/pipeline', requireFeature('pipeline'), pipelineLimiter, pipelineRoutes);
app.use('/api/workshop', (req, res, next) => {
    if (req.path.includes('fuse')) {
        return requireFeature('workshop-fusion')(req, res, next);
    }
    next();
}, workshopRoutes);
app.use('/api/publish', requireFeature('publish'), publishRoutes);
app.use('/api/comic', comicRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/style-templates', styleTemplateRoutes);

app.use('/api/projects', projectRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/guide', guideRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/franchises', franchiseRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/worldview-profiles', worldviewProfileRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/prompt-config', promptConfigRoutes);
app.use('/api/optimizer', optimizerRoutes);
app.use('/api/chapter-audit', chapterAuditRoutes);
app.use('/api/flavors', flavorRoutes);

app.get('/api/comic/config', (req, res, next) => { next(); });

app.get('/api/license/status', (req, res) => {
    const membership = license.checkMembership();
    res.json(membership);
});

app.post('/api/license/activate', (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'License key is required' });
    const result = license.activateLicense(key);
    if (result.valid) {
        res.json({ success: true, level: result.level, trial: result.trial, expiresAt: result.expiresAt });
    } else {
        res.status(400).json({ error: result.reason || 'Invalid license key' });
    }
});

app.post('/api/license/deactivate', (req, res) => {
    license.deactivateLicense();
    res.json({ success: true });
});

app.post('/api/license/trial', (req, res) => {
    const trialKey = license.generateTrialKey();
    const result = license.activateLicense(trialKey);
    if (result.valid) {
        res.json({ success: true, key: trialKey, level: 'pro', trial: true, expiresAt: result.expiresAt });
    } else {
        res.status(400).json({ error: 'Failed to generate trial' });
    }
});

app.get('/api/version', (req, res) => {
    const versionInfo = license.getVersionInfo();
    res.json(versionInfo);
});

app.get('/api/health', (req, res) => {
    const healthMonitor = require('./services/healthMonitor');
    const healthData = healthMonitor.getHealthStatus();
    res.json({
        status: healthData.status || 'ok',
        uptime: healthData.uptime,
        encryption: { enabled: _encryptionEnabled }
    });
});

app.get('/api/health/alerts', (req, res) => {
    const healthMonitor = require('./services/healthMonitor');
    res.json(healthMonitor.getAlerts({
        level: req.query.level,
        category: req.query.category,
        limit: parseInt(req.query.limit) || 50
    }));
});

app.post('/api/health/check', (req, res) => {
    const healthMonitor = require('./services/healthMonitor');
    healthMonitor.runHealthCheck();
    res.json({ success: true, message: 'Health check triggered' });
});

app.post('/api/version/check', (req, res) => {
    const remoteInfo = req.body;
    const updateCheck = license.checkForUpdate(remoteInfo);
    res.json(updateCheck);
});

app.get('/api/api-keys', (req, res) => {
    const access = license.canAccess('multi-api-key');
    const store = require('./store');
    const keys = store.queryItems('api-keys', {}).filter(k => k.type === 'key');
    const processedKeys = keys.map(k => {
        const rawKey = k.apiKey || '';
        let decryptedKey = '';
        if (isApiKeyEncrypted(rawKey) && _encryptionEnabled) {
            try { decryptedKey = decryptApiKey(rawKey, _effectiveEncryptionSecret); } catch (_) { decryptedKey = ''; }
        } else if (isApiKeyEncrypted(rawKey) && !_encryptionEnabled) {
            decryptedKey = '';
        } else {
            decryptedKey = rawKey;
        }
        return { ...k, apiKey: decryptedKey && decryptedKey.length > 4 ? `****${decryptedKey.substring(decryptedKey.length - 4)}` : '' };
    });
    if (!access.allowed) {
        return res.json(processedKeys.slice(0, 1));
    }
    res.json(processedKeys);
});

app.post('/api/api-keys', (req, res) => {
    const access = license.canAccess('multi-api-key');
    if (!access.allowed) {
        const store = require('./store');
        const existing = store.queryItems('api-keys', {}).filter(k => k.type === 'key');
        if (existing.length >= 1) {
            return res.status(403).json({ error: '免费版仅支持1个API Key，请升级专业版', code: 'MEMBERSHIP_REQUIRED' });
        }
    }
    const store = require('./store');
    const { v4: uuidv4 } = require('uuid');
    const { name, apiKey, groupId, model, provider, baseURL } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'apiKey is required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    const storedApiKey = _encryptionEnabled ? encryptApiKey(apiKey, _effectiveEncryptionSecret) : apiKey;
    store.setItem('api-keys', id, { id, type: 'key', name: name || 'Unnamed Key', apiKey: storedApiKey, groupId: groupId || '', model: model || 'MiniMax-M2.7', provider: provider || 'minimax', baseURL: baseURL || '', _encrypted: _encryptionEnabled, createdAt: now, updatedAt: now });
    res.json({ id, name: name || 'Unnamed Key', groupId, model, provider: provider || 'minimax', baseURL: baseURL || '' });
});

app.delete('/api/api-keys/:id', (req, res) => {
    const store = require('./store');
    const keyId = req.params.id;
    const bindings = store.queryItems('api-keys', {}).filter(k => k.type === 'agent-binding' && k.keyId === keyId);
    if (bindings.length > 0) {
        const boundAgents = bindings.map(b => b.agentType).join(', ');
        return res.status(409).json({ error: `该API Key正在被以下Agent绑定使用: ${boundAgents}，请先解绑再删除`, code: 'KEY_IN_USE', boundAgents });
    }
    store.deleteItem('api-keys', keyId);
    res.json({ success: true });
});

app.get('/api/api-keys/agent-bindings', (req, res) => {
    const store = require('./store');
    const bindings = store.queryItems('api-keys', {}).filter(k => k.type === 'agent-binding');
    res.json(bindings);
});

app.post('/api/api-keys/agent-bindings', (req, res) => {
    const access = license.canAccess('multi-api-key');
    if (!access.allowed) {
        return res.status(403).json({ error: '免费版不支持Agent绑定不同Key，请升级专业版', code: 'MEMBERSHIP_REQUIRED' });
    }
    const store = require('./store');
    const { agentType, keyId } = req.body;
    if (!agentType) return res.status(400).json({ error: 'agentType is required' });
    const bindingId = `agent-${agentType}`;
    if (keyId) {
        store.setItem('api-keys', bindingId, { id: bindingId, type: 'agent-binding', agentType, keyId, updatedAt: new Date().toISOString() });
    } else {
        store.deleteItem('api-keys', bindingId);
    }
    res.json({ success: true });
});

app.get('/api/providers', (req, res) => {
    const llm = require('./services/llm');
    res.json(llm.getProviders());
});

const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath, {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
        }
    }));
    app.get('/{*path}', (req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

app.use(errorHandler);

store.ensureBackend().then(() => {
    const { runStartupChecks } = require('./services/startupChecks');
    runStartupChecks();

    app.listen(PORT, () => {
        console.log(`[NOVEL-PIPELINE] Server running on port ${PORT} (v${license.VERSION})`);
        const securityIssues = [];
        if (!ENCRYPTION_SECRET) securityIssues.push('ENCRYPTION_SECRET 未配置 → API Key明文存储');
        if (!process.env.REQUEST_SECRET) securityIssues.push('REQUEST_SECRET 未配置 → 每次重启生成随机token');
        if (securityIssues.length > 0) {
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`  ⚠️  安全配置警告 (${securityIssues.length}项)`);
            console.log(`${'═'.repeat(60)}`);
            securityIssues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
            console.log(`  请在 .env 文件中配置以上变量以增强安全性`);
            console.log(`${'═'.repeat(60)}\n`);
        }
        const healthMonitor = require('./services/healthMonitor');
        healthMonitor.startHealthMonitor();
        try {
            const { cleanupStalePipelineStates } = require('./services/pipeline/infinitePipeline');
            const zombieCount = cleanupStalePipelineStates();
            if (zombieCount > 0) {
                console.log(`[NOVEL-PIPELINE] 🧹 Cleaned up ${zombieCount} zombie pipeline state(s) from previous crash`);
            }
        } catch (e) {
            console.warn('[NOVEL-PIPELINE] Zombie pipeline cleanup check failed:', e.message);
        }
    });
}).catch(err => {
    console.error('[NOVEL-PIPELINE] Storage backend initialization failed:', err.message);
    process.exit(1);
});
