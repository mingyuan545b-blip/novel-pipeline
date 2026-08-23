const path = require('path');

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;

if (!ENCRYPTION_SECRET) {
    console.error('ERROR: ENCRYPTION_SECRET must be set in environment or .env file');
    process.exit(1);
}

async function main() {
    const store = require('../server/store');
    await store.initialize();

    const { encryptApiKey, isApiKeyEncrypted } = require('../server/index');

    const allKeys = store.queryItems('api-keys', {}).filter(k => k.type === 'key');
    const plaintextKeys = allKeys.filter(k => !k._encrypted && !isApiKeyEncrypted(k.apiKey || ''));

    if (plaintextKeys.length === 0) {
        console.log('No plaintext API Keys found. All keys are already encrypted.');
        return;
    }

    console.log(`Found ${plaintextKeys.length} plaintext API Key(s). Encrypting...`);

    let encrypted = 0;
    let failed = 0;

    for (const key of plaintextKeys) {
        try {
            const encryptedKey = encryptApiKey(key.apiKey, ENCRYPTION_SECRET);
            key.apiKey = encryptedKey;
            key._encrypted = true;
            key.updatedAt = new Date().toISOString();
            store.setItem('api-keys', key.id, key);
            encrypted++;
            console.log(`  ✓ Encrypted: ${key.name || key.id}`);
        } catch (e) {
            failed++;
            console.error(`  ✗ Failed: ${key.name || key.id} - ${e.message}`);
        }
    }

    console.log(`\nDone: ${encrypted} encrypted, ${failed} failed`);
}

main().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
