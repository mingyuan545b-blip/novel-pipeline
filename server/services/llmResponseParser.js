const logger = require('../shared/logger');

/**
 * Parse think tags from LLM response content.
 * Strips <think...</think[>]> blocks and returns the remaining content.
 */
function stripThinkTags(content) {
    if (!content || typeof content !== 'string') return content;

    const thinkEnd = content.indexOf('</think');
    if (thinkEnd !== -1) {
        const afterThink = content.substring(thinkEnd);
        const closeTag = afterThink.indexOf('>');
        if (closeTag !== -1) {
            const extracted = afterThink.substring(closeTag + 1).trim();
            if (extracted.length > 0) return extracted;
            const thinkStart = content.indexOf('<think');
            if (thinkStart > 0) return content.substring(0, thinkStart).trim();
        }
    } else if (content.includes('<think')) {
        const thinkStart = content.indexOf('<think');
        const beforeThink = content.substring(0, thinkStart).trim();
        if (beforeThink.length > 0) return beforeThink;
    }
    return content;
}

/**
 * Normalize LLM response message content.
 * - Converts array content blocks to string
 * - Falls back to reasoning_content if content is empty
 * - Strips think tags
 */
function normalizeMessageContent(msg) {
    if (!msg) return;

    if (Array.isArray(msg.content)) {
        msg.content = msg.content
            .filter(block => block.type === 'text' && block.text)
            .map(block => block.text)
            .join('\n');
        logger.info('llm', `[LLM] Converted array content to string, length: ${msg.content.length}`);
    }

    if (!msg.content && msg.reasoning_content) {
        if (Array.isArray(msg.reasoning_content)) {
            msg.reasoning_content = msg.reasoning_content
                .filter(block => block.type === 'text' && block.text)
                .map(block => block.text)
                .join('\n');
        }
        msg.content = String(msg.reasoning_content);
    }

    if (msg.content && typeof msg.content === 'string') {
        msg.content = stripThinkTags(msg.content);
    }
}

module.exports = { stripThinkTags, normalizeMessageContent };
