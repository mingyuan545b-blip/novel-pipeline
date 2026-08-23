const CHECKLIST = {
    steps: [
        { id: 1, name: '创建测试项目', status: 'pending', result: null },
        { id: 2, name: '配置写作约束', status: 'pending', result: null },
        { id: 3, name: '创建人物素材', status: 'pending', result: null },
        { id: 4, name: '创建大纲', status: 'pending', result: null },
        { id: 5, name: '运行Writer Agent', status: 'pending', result: null },
        { id: 6, name: '运行Reviewer Agent', status: 'pending', result: null },
        { id: 7, name: '运行Reviser Agent', status: 'pending', result: null },
        { id: 8, name: '运行Final Editor Agent', status: 'pending', result: null },
        { id: 9, name: '验证输出质量', status: 'pending', result: null },
    ],
    updateStep(id, status, result) {
        const step = this.steps.find(s => s.id === id);
        if (step) { step.status = status; step.result = result; }
    },
    printReport() {
        console.log('\n' + '='.repeat(60) + '\n📋 监工审核报告\n' + '='.repeat(60));
        this.steps.forEach(step => {
            const icon = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
            console.log(`  ${icon} Step ${step.id}: ${step.name} [${step.status}]`);
            if (step.result) console.log(`     ${step.result}`);
        });
        console.log('='.repeat(60));
        const completed = this.steps.filter(s => s.status === 'completed').length;
        const failed = this.steps.filter(s => s.status === 'failed').length;
        console.log(`\n总计: ${completed}/${this.steps.length} 完成, ${failed} 失败`);
        console.log(failed > 0 ? '❌ 测试未通过' : '✅ 全部通过！');
    }
};

module.exports = CHECKLIST;
