function checkViolation(action, rule) {
    if (!rule.content || !action) return null;
    const content = rule.content.toLowerCase();
    const actionLower = action.toLowerCase();

    const prohibitionPatterns = [
        /不可|不能|禁止|不得|绝不|严禁|必须/,
        /不允许|不可以|勿|忌|杜绝/
    ];

    for (const pattern of prohibitionPatterns) {
        const match = content.match(pattern);
        if (match) {
            const beforeMatch = content.substring(0, match.index);
            const afterMatch = content.substring(match.index + match[0].length);
            const subject = beforeMatch.split(/[，。；、\s]/).pop() || '';
            const object = afterMatch.split(/[，。；、\s]/)[0] || '';

            if (subject && actionLower.includes(subject) && object && actionLower.includes(object)) {
                return `规则 ${rule.id} 禁止: ${subject} ${match[0]} ${object}`;
            }
        }
    }

    return null;
}

function extractProhibitionRules(content, sourceName) {
    const rules = [];
    const patterns = [
        /(?:不可|不能|禁止|不得|绝不|严禁|必须)[^。，；\n]{2,30}/g,
        /(?:铁律|硬规则|绝对规则)[：:]\s*[^。，；\n]{2,50}/g
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const ruleText = match[0].trim();
            if (ruleText.length >= 4 && ruleText.length <= 60) {
                rules.push({ content: `[${sourceName}] ${ruleText}` });
            }
        }
    }

    return rules;
}

function extractCoreTraits(content, charName) {
    const traits = [];
    const traitPatterns = [
        /性格[：:]\s*([^。，；\n]{2,30})/g,
        /核心特质[：:]\s*([^。，；\n]{2,30})/g,
        /人格[类型]?[：:]\s*([^。，；\n]{2,30})/g
    ];

    for (const pattern of traitPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const trait = match[1].trim();
            if (trait.length >= 2) {
                traits.push(`[${charName}] 性格必须一致: ${trait}`);
            }
        }
    }

    return traits;
}

module.exports = { checkViolation, extractProhibitionRules, extractCoreTraits };
