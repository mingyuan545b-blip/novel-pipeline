/**
 * 临时调试脚本：检测chapter的hardBlock拦截情况
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const chapterId = process.argv[2];

const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/chapters/${chapterId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        try {
            const j = JSON.parse(d);
            const content = j.content || '';
            console.log('chapter:', j.chapterNumber, 'wordCount:', j.wordCount);
            console.log('content length:', content.length);
            console.log('content preview:', content.substring(0, 500));

            // 调用detectors检测
            const detectors = require('../server/services/genres/high-martial-crossplane/detectors');
            const styleProfile = j.styleProfile || {};

            console.log('\n=== hardBlock检测结果 ===');

            const literaryCheck = detectors.literaryBloat(content);
            console.log('literaryBloat:', literaryCheck.isViolation, literaryCheck.count);

            const comedyCheck = detectors.comedyCheck(content);
            console.log('comedyCheck:', comedyCheck.isInsufficient, comedyCheck.comedyCount, '/', comedyCheck.required);

            const paceCheck = detectors.paceCheck(content);
            console.log('paceCheck:', paceCheck.isSlow);

            const termCheck = detectors.terminology(content, styleProfile);
            console.log('terminology:', termCheck.violationCount, termCheck.count);

            const perspectiveCheck = detectors.perspective(content, styleProfile);
            console.log('perspective:', perspectiveCheck.isViolation);

            const aiTrace = detectors.aiTraceDetection(content);
            console.log('aiTrace:', aiTrace.isViolation);

            const nameCheck = detectors.namingElegance(content);
            console.log('namingElegance:', nameCheck.isViolation, nameCheck.issues);

            const scalingCheck = detectors.powerScalingCheck(content);
            console.log('powerScaling:', scalingCheck.isViolation);

            const timeLimitCheck = detectors.timeLimitWeakening(content);
            console.log('timeLimitWeakening:', timeLimitCheck.isViolation);

            const ipCheck = detectors.ipDirectNaming(content);
            console.log('ipDirectNaming:', ipCheck.isViolation, ipCheck.issues);

            const paraCheck = detectors.paragraphLength(content);
            console.log('paragraphLength:', paraCheck.isViolation, paraCheck.longParagraphs, '/', paraCheck.totalParagraphs);
        } catch (e) {
            console.log('Error:', e.message);
        }
    });
});

req.on('error', e => console.log('Error:', e.message));
req.end();
