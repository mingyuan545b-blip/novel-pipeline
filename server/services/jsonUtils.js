function extractJSON(text) {
    if (!text) return null;
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
        try { return JSON.parse(jsonBlockMatch[1].trim()); } catch (e) { /* fall through */ }
    }
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
        let candidate = braceMatch[0];
        for (let depth = 0, i = 0; i < candidate.length; i++) {
            if (candidate[i] === '{') depth++;
            if (candidate[i] === '}') depth--;
            if (depth === 0) {
                candidate = candidate.substring(0, i + 1);
                break;
            }
        }
        try { return JSON.parse(candidate); } catch (e) {
            const cleaned = candidate.replace(/,\s*([}\]])/g, '$1').replace(/\\n/g, '\\n');
            try { return JSON.parse(cleaned); } catch (e2) { /* fall through */ }
        }
    }
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { return null; }
}

module.exports = { extractJSON };
