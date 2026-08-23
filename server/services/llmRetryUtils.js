/**
 * Retry delay utility with abort-signal support.
 */
function waitForRetry(delayMs, externalSignal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        if (externalSignal) {
            if (externalSignal.aborted) {
                clearTimeout(timer);
                reject(new Error('LLM request aborted during retry'));
                return;
            }
            externalSignal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('LLM request aborted during retry'));
            }, { once: true });
        }
    });
}

/**
 * Classify an API error into overload / network / context-overflow categories.
 */
const { OVERLOAD_PATTERNS, NETWORK_PATTERNS, CONTEXT_OVERFLOW_PATTERNS } = require('../shared/errors');

function classifyApiError(errMsg, statusCode) {
    const msg = (errMsg || '').toLowerCase();

    const isOverloaded = statusCode === 529 || statusCode === 2064
        || OVERLOAD_PATTERNS.some(p => msg.includes(p));

    const isNetworkError = errMsg && NETWORK_PATTERNS.some(p => msg.includes(p));

    const isContextOverflow = errMsg && (
        CONTEXT_OVERFLOW_PATTERNS.some(p => msg.includes(p))
        || errMsg.includes('maximum context length')
        || errMsg.includes('token limit exceeded') || errMsg.includes('too many tokens')
        || errMsg.includes('input is too long') || errMsg.includes('上下文长度超')
        || (errMsg.includes('context window') && errMsg.includes('exceed'))
        || (errMsg.includes('reduce the length') && errMsg.includes('input'))
        || (statusCode === 400 && errMsg.includes('context_length'))
    );

    return { isOverloaded, isNetworkError, isContextOverflow };
}

module.exports = { waitForRetry, classifyApiError };
