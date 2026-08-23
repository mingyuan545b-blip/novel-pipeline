/**
 * factExtractors.js — 从素材内容中提取事实的辅助函数
 * 从factSync.js拆出，保持factSync.js在200行以内
 */

/** 世界观事实提取：禁止规则 + 核心设定 + 逻辑铁律 */
function extractWorldviewFacts(content, sourceName) {
    const facts = [];

    const prohibitionPatterns = [
        /(?:不可|不能|禁止|不得|绝不|严禁|必须)[^。，；\n]{2,30}/g,
        /(?:铁律|硬规则|绝对规则)[：:]\s*[^。，；\n]{2,50}/g
    ];
    for (const pattern of prohibitionPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const ruleText = match[0].trim();
            if (ruleText.length >= 4 && ruleText.length <= 60) {
                facts.push(`[${sourceName}] ${ruleText}`);
            }
        }
    }

    const settingPatterns = [
        /(?:无超自然设定|无魔法|无灵力|无修仙)[^。，；\n]{0,30}/g,
        /(?:底层基调|底层逻辑|核心基调)[是为：:]\s*[^。，；\n]{2,40}/g,
        /(?:世界观|世界|设定)[内中]?[^。，；\n]{0,5}(?:没有|不存在|只有|仅靠|全凭)[^。，；\n]{2,40}/g
    ];
    for (const pattern of settingPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const text = match[0].trim();
            if (text.length >= 4 && text.length <= 60 && !facts.some(f => f.includes(text))) {
                facts.push(`[${sourceName}] 世界观铁律: ${text}`);
            }
        }
    }

    if (facts.length === 0 && content.length >= 20) {
        const sentences = content.split(/[。；\n]/).map(s => s.trim()).filter(s => s.length >= 10 && s.length <= 60);
        for (const s of sentences.slice(0, 3)) {
            facts.push(`[${sourceName}] 世界观核心: ${s}`);
        }
    }

    return facts;
}

/** 力量体系事实提取 */
function extractPowerSystemFacts(content, sourceName) {
    const facts = [];

    const prohibitionPatterns = [
        /(?:不可|不能|禁止|不得|绝不|严禁|必须)[^。，；\n]{2,30}/g,
        /(?:铁律|硬规则|绝对规则|核心规则)[：:]\s*[^。，；\n]{2,50}/g
    ];
    for (const pattern of prohibitionPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const ruleText = match[0].trim();
            if (ruleText.length >= 4 && ruleText.length <= 60) {
                facts.push(`[${sourceName}] ${ruleText}`);
            }
        }
    }

    if (facts.length === 0 && content.length >= 20) {
        const sentences = content.split(/[。；\n]/).map(s => s.trim()).filter(s => s.length >= 10 && s.length <= 60);
        for (const s of sentences.slice(0, 3)) {
            facts.push(`[${sourceName}] 体系核心: ${s}`);
        }
    }

    return facts;
}

/** 角色核心事实提取：身份/动机/性格/立场 */
function extractCharacterFacts(content, charName) {
    const facts = [];

    const identityPatterns = [
        /(?:身份|职业|职位|身份是)[是为：:]\s*([^。，；\n]{2,30})/g,
        /^([^。，；\n]{2,30}?)(?:，|,)\s*(?:动机|立场|性格|习惯)/m
    ];
    for (const pattern of identityPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const identity = (match[1] || match[0]).trim();
            if (identity.length >= 2 && identity.length <= 40) {
                facts.push(`[${charName}] 身份: ${identity}`);
            }
        }
    }

    const motivationPatterns = [
        /(?:动机|核心欲望|内在驱动)[：:是为]\s*([^。，；\n]{2,40})/g,
        /(?:目标|追求)[是为：:]\s*([^。，；\n]{2,40})/g
    ];
    for (const pattern of motivationPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const motivation = match[1].trim();
            if (motivation.length >= 2) {
                facts.push(`[${charName}] 动机: ${motivation}`);
            }
        }
    }

    const traitPatterns = [
        /性格[弧光]?[是为：:]\s*([^。，；\n]{2,40})/g,
        /核心特质[：:]\s*([^。，；\n]{2,30})/g,
        /人格[类型]?[：:]\s*([^。，；\n]{2,30})/g,
        /立场[是为：:]\s*([^。，；\n]{2,40})/g,
        /习惯[动作]?[是为：:]\s*([^。，；\n]{2,40})/g
    ];
    for (const pattern of traitPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const trait = match[1].trim();
            if (trait.length >= 2) {
                facts.push(`[${charName}] 性格必须一致: ${trait}`);
            }
        }
    }

    if (facts.length === 0 && content.length >= 10) {
        const firstSentence = content.split(/[。，；\n]/)[0].trim();
        if (firstSentence.length >= 4 && firstSentence.length <= 60) {
            facts.push(`[${charName}] 身份: ${firstSentence}`);
        }
    }

    return facts;
}

/** 关系事实提取 */
function extractRelationshipFacts(content, relName) {
    const facts = [];

    const relPatterns = [
        /(?:关系|状态|性质)[是为：:]\s*([^。，；\n]{2,40})/g,
        /(?:互相|彼此|之间)[^。，；\n]{2,30}(?:依赖|信任|对抗|利用|扶持)/g
    ];
    for (const pattern of relPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const text = match[0].trim();
            if (text.length >= 4 && text.length <= 60) {
                facts.push(`[${relName}] ${text}`);
            }
        }
    }

    if (facts.length === 0 && content.length >= 10) {
        const firstSentence = content.split(/[。，；\n]/)[0].trim();
        if (firstSentence.length >= 4 && firstSentence.length <= 60) {
            facts.push(`[${relName}] 关系核心: ${firstSentence}`);
        }
    }

    return facts;
}

/** 装备/势力事实提取 */
function extractEquipFactionFacts(content, name, type) {
    const facts = [];

    const typeLabel = type === 'equipment' ? '装备' : '势力';
    const patterns = [
        /(?:功能|能力|效果|作用)[是为：:]\s*([^。，；\n]{2,40})/g,
        /(?:限制|代价|弱点|缺陷)[是为：:]\s*([^。，；\n]{2,40})/g,
        /(?:目标|宗旨|信条)[是为：:]\s*([^。，；\n]{2,40})/g
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const text = match[1].trim();
            if (text.length >= 2) {
                facts.push(`[${name}] ${typeLabel}属性: ${text}`);
            }
        }
    }

    if (facts.length === 0 && content.length >= 10) {
        const firstSentence = content.split(/[。，；\n]/)[0].trim();
        if (firstSentence.length >= 4 && firstSentence.length <= 60) {
            facts.push(`[${name}] ${typeLabel}核心: ${firstSentence}`);
        }
    }

    return facts;
}

module.exports = {
    extractWorldviewFacts, extractPowerSystemFacts,
    extractCharacterFacts, extractRelationshipFacts,
    extractEquipFactionFacts,
};
