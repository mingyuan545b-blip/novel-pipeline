'use strict';
process.env.NODE_PATH = require('path').join(__dirname, '..', '..', 'server');
require('module').Module._initPaths();
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const llm = require('../../server/services/llm');
const { getOutlineApiConfig } = require('../../server/services/pipeline/constants');
const terms = process.argv.slice(2);
(async () => {
    const apiConfig = await getOutlineApiConfig();
    for (const t of terms) {
        const msgs = [{ role: 'user', content: '请用一句话描写这个场景：' + t }];
        try { const r = await llm.chat(msgs, { maxTokens: 200, temperature: 0.5, apiConfig, skipBudgetGuard: true }); console.log('OK   |', t, '→', (r.choices?.[0]?.message?.content || '').slice(0, 30)); }
        catch (e) { console.log('FAIL |', t, '→', e.message.slice(0, 90)); }
    }
    process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
