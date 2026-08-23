const { isLLMOverloaded, isLLMTimeout, isContextOverflow } = require('../../shared/errors');

function classifyError(error, step) {
    const isOverloaded = isLLMOverloaded(error);
    const isContextErr = isContextOverflow(error);
    const isTimeout = isLLMTimeout(error);
    const stepLabel = step || error._step || '';
    const errorDetail = isOverloaded
        ? `AI服务繁忙/限流，步${stepLabel}执行失败`
        : isTimeout
        ? `步骤${stepLabel}超时`
        : isContextErr
        ? `步骤${stepLabel}上下文溢出`
        : `步骤${stepLabel}执行出错: ${error.message}`;

    return { isOverloaded, isContextErr, isTimeout, errorDetail };
}

module.exports = { classifyError };
