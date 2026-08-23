/**
 * StepResult - Pipeline步骤统一返回类型
 * 所有Step.execute()必须返回此类型，禁止返回null/undefined
 */
class StepResult {
    /**
     * @param {object} opts
     * @param {string} opts.step - 步骤名称 (e.g. 'writer', 'fast-review')
     * @param {boolean} opts.passed - 是否通过
     * @param {object} [opts.result] - LLM原始返回
     * @param {object} [opts.feedback] - 结构化反馈 {summary, issues, suggestions}
     * @param {string} [opts.materialGuidance] - 素材指导(定稿人专用)
     * @param {object} [opts.chapter] - 修改后的chapter对象(用于持久化)
     */
    constructor({ step, passed, result, feedback, materialGuidance, chapter }) {
        if (!step) throw new Error('StepResult: step is required');
        if (typeof passed !== 'boolean') throw new Error('StepResult: passed must be boolean');
        this.step = step;
        this.passed = passed;
        this.result = result || { response: '' };
        this.feedback = feedback || { summary: `${step}${passed ? '通过' : '未通过'}`, issues: [], suggestions: [] };
        this.materialGuidance = materialGuidance || '';
        this.chapter = chapter || null;
    }

    /** 快捷构造：通过 */
    static pass(step, opts = {}) {
        return new StepResult({ step, passed: true, ...opts });
    }

    /** 快捷构造：失败 */
    static fail(step, opts = {}) {
        return new StepResult({ step, passed: false, ...opts });
    }

    /** 快捷构造：字数不足 */
    static wordCountFail(step, actual, min) {
        return new StepResult({
            step,
            passed: false,
            feedback: {
                summary: `【字数严重不足】当前${actual}字，距离最低${min}字还差${min - actual}字。必须大幅扩展内容。`,
                issues: [{ desc: `字数${actual}字低于最低要求${min}字`, severity: 'critical' }],
                suggestions: ['扩展环境描写', '增加角色互动细节', '补充过渡段落']
            }
        });
    }
}

module.exports = { StepResult };
