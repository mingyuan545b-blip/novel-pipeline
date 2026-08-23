const { section, getStats } = require('./checks/checkUtils');
const { checkStorageSafety, checkApiValidation, checkSecurityConfig } = require('./checks/checkSecurity');
const { checkCodeQuality, checkFoundationProtection, checkDataIntegrity } = require('./checks/checkQuality');
const { checkTestCoverage, checkTypeSync, checkIpViolations, checkProtagonistHardcode } = require('./checks/checkCompliance');

checkStorageSafety();
checkApiValidation();
checkSecurityConfig();
checkCodeQuality();
checkFoundationProtection();
checkDataIntegrity();
checkTestCoverage();
checkTypeSync();
checkIpViolations();
checkProtagonistHardcode();

section('汇总');

const { errors, warnings, checks } = getStats();
console.log(`\n  检查项: ${checks}`);
console.log(`  ❌ 失败: ${errors}`);
console.log(`  ⚠️  警告: ${warnings}`);
console.log(`  ✅ 通过: ${checks - errors - warnings}`);

if (errors > 0) {
    console.log(`\n  🚨 存在${errors}个必须修复的问题！运行 npm run check 确认修复。`);
    process.exit(1);
} else if (warnings > 0) {
    console.log(`\n  ⚡ 存在${warnings}个警告，建议修复。`);
    process.exit(0);
} else {
    console.log(`\n  🎉 所有检查通过！`);
    process.exit(0);
}
