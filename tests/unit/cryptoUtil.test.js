const { encrypt, decrypt, isEncrypted } = require('../../server/services/cryptoUtil');

describe('cryptoUtil', () => {
    const secret = 'test-encryption-secret-12345';

    test('encrypt returns encrypted string with 4 colon-separated parts', () => {
        const result = encrypt('my-api-key-12345', secret);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        const parts = result.split(':');
        expect(parts.length).toBe(4);
    });

    test('decrypt reverses encrypt', () => {
        const original = 'my-api-key-12345';
        const encrypted = encrypt(original, secret);
        const decrypted = decrypt(encrypted, secret);
        expect(decrypted).toBe(original);
    });

    test('encrypt produces different ciphertext each time (random IV/salt)', () => {
        const original = 'same-input';
        const enc1 = encrypt(original, secret);
        const enc2 = encrypt(original, secret);
        expect(enc1).not.toBe(enc2);
        expect(decrypt(enc1, secret)).toBe(original);
        expect(decrypt(enc2, secret)).toBe(original);
    });

    test('isEncrypted returns true for encrypted strings', () => {
        const encrypted = encrypt('test', secret);
        expect(isEncrypted(encrypted)).toBe(true);
    });

    test('isEncrypted returns false for plain strings', () => {
        expect(isEncrypted('plain-api-key')).toBe(false);
        expect(isEncrypted('')).toBe(false);
        expect(isEncrypted(null)).toBe(false);
        expect(isEncrypted(undefined)).toBe(false);
    });

    test('decrypt with wrong secret throws error', () => {
        const encrypted = encrypt('test', secret);
        expect(() => decrypt(encrypted, 'wrong-secret')).toThrow();
    });

    test('encrypt/decrypt handles empty string', () => {
        const encrypted = encrypt('', secret);
        const decrypted = decrypt(encrypted, secret);
        expect(decrypted).toBe('');
    });

    test('encrypt/decrypt handles unicode content', () => {
        const original = '中文密钥🔑日本語キー';
        const encrypted = encrypt(original, secret);
        const decrypted = decrypt(encrypted, secret);
        expect(decrypted).toBe(original);
    });

    test('encrypt/decrypt handles very long content', () => {
        const original = 'a'.repeat(10000);
        const encrypted = encrypt(original, secret);
        const decrypted = decrypt(encrypted, secret);
        expect(decrypted).toBe(original);
    });

    test('encrypt throws without secret', () => {
        expect(() => encrypt('test', '')).toThrow('Encryption secret is required');
        expect(() => encrypt('test', null)).toThrow('Encryption secret is required');
    });

    test('decrypt throws without secret', () => {
        const encrypted = encrypt('test', secret);
        expect(() => decrypt(encrypted, '')).toThrow('Decryption secret is required');
    });

    test('decrypt returns original string for non-encrypted format', () => {
        expect(decrypt('plain-text', secret)).toBe('plain-text');
    });
});
