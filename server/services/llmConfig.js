const providerRegistry = require('../config/providerRegistry');

const { PROVIDERS, DEFAULT_STEP_ASSIGNMENTS, fillProviderConfig, resolveStepConfig, resolveConfig, validateConfig, getAvailableProviders } = providerRegistry;

function loadEnv() {
    providerRegistry.getEnvVar('LLM_PROVIDER');
}

module.exports = {
    loadEnv,
    resolveStepConfig,
    resolveConfig,
    fillProviderConfig,
    getAvailableProviders,
    validateConfig,
    PROVIDER_DEFAULTS: PROVIDERS,
    DEFAULT_STEP_ASSIGNMENTS
};
