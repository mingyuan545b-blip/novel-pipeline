const router = require('express').Router();
const license = require('../services/license');
const store = require('../store');
const { DEFAULT_MODEL } = require('../config/modelResolver');
const { encrypt: encryptApiKey, decrypt: decryptApiKey, isEncrypted: isApiKeyEncrypted } = require('../services/cryptoUtil');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, FORBIDDEN, CONFLICT } = ERROR_CODES;

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '';
const _encryptionEnabled = !!ENCRYPTION_SECRET;
const _effectiveEncryptionSecret = ENCRYPTION_SECRET;

router.get('/', async (req, res) => {
    const access = license.canAccess('multi-api-key');
    const keys = (await store.queryItems('api-keys', {})).filter(k => k.type === 'key');
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

router.post('/', async (req, res) => {
    const access = license.canAccess('multi-api-key');
    if (!access.allowed) {
        const existing = (await store.queryItems('api-keys', {})).filter(k => k.type === 'key');
        if (existing.length >= 1) {
            return res.apiError(FORBIDDEN.statusCode, '免费版仅支持1个API Key，请升级专业版', 'MEMBERSHIP_REQUIRED');
        }
    }
    const { v4: uuidv4 } = require('uuid');
    const { name, apiKey, groupId, model, provider, baseURL } = req.body;
    if (!apiKey) return res.apiError(VALIDATION_ERROR.statusCode, 'apiKey is required', VALIDATION_ERROR.code);
    const id = uuidv4();
    const now = new Date().toISOString();
    const storedApiKey = _encryptionEnabled ? encryptApiKey(apiKey, _effectiveEncryptionSecret) : apiKey;
    store.setItem('api-keys', id, { id, type: 'key', name: name || 'Unnamed Key', apiKey: storedApiKey, groupId: groupId || '', model: model || DEFAULT_MODEL, provider: provider || 'aliyunCoding', baseURL: baseURL || '', _encrypted: _encryptionEnabled, createdAt: now, updatedAt: now });
    res.json({ id, name: name || 'Unnamed Key', groupId, model, provider: provider || 'aliyunCoding', baseURL: baseURL || '' });
});

router.delete('/:id', async (req, res) => {
    const keyId = req.params.id;
    const bindings = (await store.queryItems('api-keys', {})).filter(k => k.type === 'agent-binding' && k.keyId === keyId);
    if (bindings.length > 0) {
        const boundAgents = bindings.map(b => b.agentType).join(', ');
        return res.apiError(
            CONFLICT.statusCode,
            `该API Key正在被以下Agent绑定使用: ${boundAgents}，请先解绑再删除`,
            'KEY_IN_USE',
            { boundAgents }
        );
    }
    store.deleteItem('api-keys', keyId);
    res.json({ success: true });
});

router.get('/agent-bindings', async (req, res) => {
    const bindings = (await store.queryItems('api-keys', {})).filter(k => k.type === 'agent-binding');
    res.json(bindings);
});

router.post('/agent-bindings', async (req, res) => {
    const access = license.canAccess('multi-api-key');
    if (!access.allowed) {
        return res.apiError(FORBIDDEN.statusCode, '免费版不支持Agent绑定不同Key，请升级专业版', 'MEMBERSHIP_REQUIRED');
    }
    const { agentType, keyId } = req.body;
    if (!agentType) return res.apiError(VALIDATION_ERROR.statusCode, 'agentType is required', VALIDATION_ERROR.code);
    const bindingId = `agent-${agentType}`;
    if (keyId) {
        await store.setItem('api-keys', bindingId, { id: bindingId, type: 'agent-binding', agentType, keyId, updatedAt: new Date().toISOString() });
    } else {
        await store.deleteItem('api-keys', bindingId);
    }
    res.json({ success: true });
});

router.get('/providers', (req, res) => {
    const llm = require('../services/llm');
    res.json(llm.getProviders());
});

module.exports = router;
