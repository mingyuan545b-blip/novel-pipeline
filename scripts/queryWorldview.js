/**
 * 查询目标项目的完整settings和世界观框架
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const store = require('../server/store');

const TARGET_PROJECT_ID = 'fee2bcd3-d73a-4ce9-8899-12b2e1350724';

(async () => {
    try {
        await store.ensureBackend();
        const project = await store.getItem('projects', TARGET_PROJECT_ID);
        if (!project) {
            console.log('未找到项目');
            return;
        }
        console.log('=== 项目基本信息 ===');
        console.log(`title: ${project.title || project.name}`);
        console.log(`genre: ${project.genre}`);
        console.log(`\n=== settings完整内容 ===`);
        console.log(JSON.stringify(project.settings, null, 2));
    } catch (err) {
        console.error('查询失败:', err.message);
    } finally {
        process.exit(0);
    }
})();
