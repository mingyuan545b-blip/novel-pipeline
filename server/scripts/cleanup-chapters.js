const fs = require('fs');
const path = require('path');

const chaptersDir = path.join(__dirname, '../../data/chapters');
const PROJECT_ID = '2aee955b-d35c-437f-9ee3-c50fb6753b58';

const CORRECT_IDS = [
  '36ec599c-253b-4b62-bd4c-367e25f7f705',
  '62506e9b-856d-4011-95fb-ee4433e6cdf9',
  '13d56edd-006a-43fb-a872-c7d327fbb18f',
  'de07c086-6c5e-4dae-89b2-114a0300e66b',
  '1a20dc07-55ab-4e79-b1dd-1f9ad9889055',
  '5c07e56a-fc9b-40c6-aae2-d083f66c6824',
  'e093ae6f-e71f-4b46-baf4-5d4b63383e0b',
  'e1d43075-92d5-43d6-a1b0-b733f8042dd5',
  '0e191c68-9118-49b8-81ea-8587509b8035',
  '2b47afb5-c718-4d9f-bdba-d5cfa4662aee',
  'a3474a0c-b6fd-466c-973d-1a7c58f406b0',
  '28fb8061-a827-439a-81f4-f4f93cb4c449',
  '6569224a-88a0-48d2-95e2-4822141cbaea',
  '83304045-d20c-4d3d-ad87-d79ab32589c3',
  '69b48c2b-34aa-4c45-a198-cf8d6456f7cd',
  '6dc98628-8bde-4730-a013-a76841678e86',
  '38cefb1c-6276-4e33-80e7-c32be79c4b07',
  'b6c2f3e1-cc11-4713-a7f6-5f1fe4a3c5f7',
  '0e32537d-28b9-4b8e-bafe-06c4ecfc8136',
  '7b11eb68-9e4e-4771-a05f-7a2a48ac47af'
];

const files = fs.readdirSync(chaptersDir);
let deleted = 0;
let kept = 0;

for (const file of files) {
  const filePath = path.join(chaptersDir, file);
  const id = file.replace('.json', '');
  
  // Keep correct IDs
  if (CORRECT_IDS.includes(id)) {
    kept++;
    continue;
  }
  
  // Check if it belongs to our project
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (content.projectId === PROJECT_ID && CORRECT_IDS.includes(content.id)) {
      kept++;
      continue;
    }
  } catch (e) {}
  
  // Delete everything else that's a chapter file
  if (file.endsWith('.json')) {
    fs.unlinkSync(filePath);
    deleted++;
  }
}

console.log('Deleted: ' + deleted + ' files');
console.log('Kept: ' + kept + ' files');

// Verify remaining files
const remaining = fs.readdirSync(chaptersDir);
console.log('Remaining files: ' + remaining.length);
for (const file of remaining) {
  const filePath = path.join(chaptersDir, file);
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log('  ' + file + ' -> Ch' + content.chapterNumber + ': ' + (content.chapterTitle || content.title || 'NO_TITLE'));
  } catch (e) {
    console.log('  ' + file + ' -> PARSE_ERROR');
  }
}
