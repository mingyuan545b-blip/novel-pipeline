const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const store = require('../store');
const crypto = require('crypto');

const LICENSE_FILE = path.join(__dirname, '..', '..', 'data', 'license.json');
const VERSION = '1.0.0';
const VERSION_FILE = path.join(__dirname, '..', '..', 'version.json');

const MEMBERSHIP_LEVELS = {
    free: {
        name: '免费版',
        features: ['manual-write', 'materials', 'chapters', 'workshop-import', 'guide', 'settings', 'comic-config'],
        pipelineLimit: 0,
        maxChapters: 10,
        maxProjects: 2,
        maxMaterials: 30
    },
    pro: {
        name: '专业版',
        features: ['manual-write', 'materials', 'chapters', 'workshop-import', 'guide', 'settings', 'comic-config',
            'pipeline', 'infinite-pipeline', 'auto-supplement', 'consolidate', 'workshop-fusion',
            'comic-workflows', 'comic-storyboard', 'comic-render', 'publish', 'multi-api-key'],
        pipelineLimit: -1,
        maxChapters: -1,
        maxProjects: -1,
        maxMaterials: -1
    }
};

const GATED_FEATURES = {
    'pipeline': 'pro',
    'infinite-pipeline': 'pro',
    'auto-supplement': 'pro',
    'workshop-fusion': 'pro',
    'comic-workflows': 'pro',
    'comic-storyboard': 'pro',
    'comic-render': 'pro',
    'multi-api-key': 'pro'
};

function getLicense() {
    try {
        if (fs.existsSync(LICENSE_FILE)) {
            return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8'));
        }
    } catch {}
    return null;
}

function saveLicense(license) {
    const dir = path.dirname(LICENSE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(license, null, 2), 'utf-8');
}

function verifyLicenseKey(key) {
    if (!key || typeof key !== 'string') return { valid: false, reason: 'Key is empty' };

    if (key.startsWith('NP-PRO-')) {
        const hash = key.substring(7);
        if (hash.length >= 16) {
            return { valid: true, level: 'pro', key };
        }
    }

    if (key.startsWith('NP-TRIAL-')) {
        const timestamp = parseInt(key.substring(9));
        if (!isNaN(timestamp)) {
            const expiry = new Date(timestamp + 30 * 24 * 60 * 60 * 1000);
            if (new Date() < expiry) {
                return { valid: true, level: 'pro', key, trial: true, expiresAt: expiry.toISOString() };
            }
            return { valid: false, reason: '试用已过期' };
        }
    }

    return { valid: false, reason: 'Key format invalid' };
}

function activateLicense(key) {
    const result = verifyLicenseKey(key);
    if (!result.valid) return result;

    const license = {
        id: uuidv4(),
        key: result.key,
        level: result.level,
        trial: result.trial || false,
        expiresAt: result.expiresAt || null,
        activatedAt: new Date().toISOString(),
        machineId: getMachineId(),
        version: VERSION
    };

    saveLicense(license);
    return { valid: true, level: license.level, trial: license.trial, expiresAt: license.expiresAt };
}

function deactivateLicense() {
    if (fs.existsSync(LICENSE_FILE)) {
        fs.unlinkSync(LICENSE_FILE);
    }
    return { success: true };
}

function getMachineId() {
    const os = require('os');
    const hostname = os.hostname();
    const cpus = os.cpus();
    const cpuInfo = cpus && cpus[0] ? cpus[0].model : 'unknown';
    const totalMem = os.totalmem();
    return crypto.createHash('sha256').update(`${hostname}-${cpuInfo}-${totalMem}`).digest('hex').substring(0, 32);
}

function checkMembership() {
    const license = getLicense();

    if (!license) {
        return { level: 'free', ...MEMBERSHIP_LEVELS.free, licensed: false };
    }

    if (license.machineId && license.machineId !== getMachineId()) {
        return { level: 'free', ...MEMBERSHIP_LEVELS.free, licensed: false, error: 'Machine mismatch' };
    }

    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
        return { level: 'free', ...MEMBERSHIP_LEVELS.free, licensed: false, error: 'License expired' };
    }

    const level = MEMBERSHIP_LEVELS[license.level] || MEMBERSHIP_LEVELS.free;
    return { level: license.level, ...level, licensed: true, trial: license.trial, expiresAt: license.expiresAt };
}

function canAccess(feature) {
    const membership = checkMembership();
    const requiredLevel = GATED_FEATURES[feature];

    if (!requiredLevel) return { allowed: true };

    if (membership.level === requiredLevel || membership.level === 'pro') {
        return { allowed: true };
    }

    return {
        allowed: false,
        feature,
        requiredLevel,
        currentLevel: membership.level,
        message: `「${feature}」功能需要专业版会员`
    };
}

function checkResourceLimit(type, currentCount) {
    const membership = checkMembership();
    switch (type) {
        case 'projects':
            if (membership.maxProjects !== -1 && currentCount >= membership.maxProjects) {
                return { allowed: false, message: `免费版最多创建${membership.maxProjects}个项目，请升级专业版` };
            }
            break;
        case 'chapters':
            if (membership.maxChapters !== -1 && currentCount >= membership.maxChapters) {
                return { allowed: false, message: `免费版每项目最多${membership.maxChapters}章，请升级专业版` };
            }
            break;
        case 'materials':
            if (membership.maxMaterials !== -1 && currentCount >= membership.maxMaterials) {
                return { allowed: false, message: `免费版最多${membership.maxMaterials}个素材，请升级专业版` };
            }
            break;
    }
    return { allowed: true };
}

function generateTrialKey() {
    const timestamp = Date.now();
    return `NP-TRIAL-${timestamp}`;
}

function getVersionInfo() {
    try {
        if (fs.existsSync(VERSION_FILE)) {
            return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'));
        }
    } catch {}
    return {
        currentVersion: VERSION,
        buildNumber: 1,
        releaseDate: new Date().toISOString(),
        changelog: [],
        minClientVersion: VERSION,
        forceUpdate: false
    };
}

function checkForUpdate(remoteVersionInfo) {
    const local = getVersionInfo();
    if (!remoteVersionInfo) return { needsUpdate: false, local };

    const current = local.currentVersion;
    const remote = remoteVersionInfo.currentVersion;

    const needsUpdate = compareVersions(remote, current) > 0;

    return {
        needsUpdate,
        forceUpdate: remoteVersionInfo.forceUpdate || false,
        localVersion: current,
        remoteVersion: remote,
        changelog: remoteVersionInfo.changelog || [],
        downloadUrl: remoteVersionInfo.downloadUrl || null
    };
}

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

function signRequest(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
}

function verifyRequestSignature(payload, signature, secret) {
    const expected = signRequest(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

module.exports = {
    VERSION,
    MEMBERSHIP_LEVELS,
    GATED_FEATURES,
    getLicense,
    activateLicense,
    deactivateLicense,
    checkMembership,
    canAccess,
    checkResourceLimit,
    generateTrialKey,
    getVersionInfo,
    checkForUpdate,
    signRequest,
    verifyRequestSignature
};
