const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;

function deriveKey(secret, salt) {
    return crypto.pbkdf2Sync(secret, salt, ITERATIONS, 32, 'sha256');
}

function encrypt(text, secret) {
    if (!text) return text;
    if (!secret) throw new Error('[CRYPTO] Encryption secret is required');
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(secret, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText, secret) {
    if (!encryptedText) return encryptedText;
    if (!secret) throw new Error('[CRYPTO] Decryption secret is required');
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
        return encryptedText;
    }
    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    const key = deriveKey(secret, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function isEncrypted(text) {
    if (!text || typeof text !== 'string') return false;
    const parts = text.split(':');
    if (parts.length !== 4) return false;
    try {
        Buffer.from(parts[0], 'hex');
        Buffer.from(parts[1], 'hex');
        Buffer.from(parts[2], 'hex');
        return parts[3].length > 0;
    } catch (_) {
        return false;
    }
}

module.exports = { encrypt, decrypt, isEncrypted };
