
const fs = require('fs');
const path = require('path');
const store = require('../store');

const projectIdPath = path.join(__dirname, '../../lastProjectId.txt');
const PROJECT_ID = fs.readFileSync(projectIdPath, 'utf8').trim();

async function generateFullText() {
  console.log('正在生成完整小说...');
  
  const project = await store.getItem('projects', PROJECT_ID);
  
  let fullText = project.name + '\n';
  fullText += '==================================================\n\n';
  fullText += project.description + '\n\n';
  fullText += '==================================================\n\n';
  
  let i = 1;
  while (i &lt; 21) {
    const chapterId = PROJECT_ID + '-ch' + i;
    const chapter = await store.getItem('chapters', chapterId);
    
    if (chapter) {
      fullText += '\n' + chapter.chapterTitle + '\n';
      fullText += '----------------------------------------\n\n';
      fullText += chapter.content;
      fullText += '\n\n';
    }
    
    i++;
  }
  
  const outputPath = path.join(__dirname, '../../番茄短故事-破笼之鸟-完整20章.txt');
  fs.writeFileSync(outputPath, fullText, 'utf8');
  
  console.log('完整小说生成成功！');
  console.log('文件路径: ' + outputPath);
  console.log('总字数: ' + fullText.length + '字');
}

generateFullText().catch(function(err) {
  console.error('生成失败:', err);
  process.exit(1);
});
