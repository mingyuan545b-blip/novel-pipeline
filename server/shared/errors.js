'use strict';

const { ERROR_CODES } = require('./errorCodes');

/**
 * 错误类型层级定义
 *
 * 所有错误码从 errorCodes.js 集中注册表引用，消除硬编码字符串。
 * 层级：AppError → DomainError/InfrastructureError → 业务子类
 *
 * 文件位置：server/shared/errors.js
 */

class AppError extends Error {
    constructor(message, code, statusCode) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.timestamp = new Date().toISOString();
    }
}

class DomainError extends AppError {
    constructor(message, code) {
        super(message, code, ERROR_CODES.INVALID_TRANSITION.statusCode);
    }
}

class InfrastructureError extends AppError {
    constructor(message, code) {
        super(message, code, ERROR_CODES.STORAGE_ERROR.statusCode);
    }
}

class ValidationError extends AppError {
    constructor(message, field) {
        super(message, ERROR_CODES.VALIDATION_ERROR.code, ERROR_CODES.VALIDATION_ERROR.statusCode);
        this.field = field;
    }
}

class NotFoundError extends AppError {
    constructor(resource, id) {
        super(`${resource} not found: ${id}`, ERROR_CODES.NOT_FOUND.code, ERROR_CODES.NOT_FOUND.statusCode);
        this.resource = resource;
        this.resourceId = id;
    }
}

class StateTransitionError extends DomainError {
    constructor(from, to, reason) {
        super(`Invalid transition: ${from} -> ${to}. ${reason}`, ERROR_CODES.INVALID_TRANSITION.code);
        this.fromState = from;
        this.toState = to;
    }
}

class PipelineError extends InfrastructureError {
    constructor(message, code) {
        super(message, code || ERROR_CODES.PIPELINE_ERROR.code);
        this.retryable = ERROR_CODES.PIPELINE_ERROR.retryable;
    }
}

class LLMOverloadedError extends PipelineError {
    constructor(message) {
        super(message, ERROR_CODES.LLM_OVERLOADED.code);
        this.retryable = ERROR_CODES.LLM_OVERLOADED.retryable;
    }
}

class LLMTimeoutError extends PipelineError {
    constructor(message) {
        super(message, ERROR_CODES.LLM_TIMEOUT.code);
        this.retryable = ERROR_CODES.LLM_TIMEOUT.retryable;
    }
}

class ContextOverflowError extends PipelineError {
    constructor(message, estimatedTokens, budget) {
        super(message, ERROR_CODES.CONTEXT_OVERFLOW.code);
        this.retryable = ERROR_CODES.CONTEXT_OVERFLOW.retryable;
        this.estimatedTokens = estimatedTokens;
        this.budget = budget;
        // 向后兼容标志：部分下游代码通过 error.isContextOverflow 判定
        this.isContextOverflow = true;
    }
}

class ReviewRejectionError extends DomainError {
    constructor(message, reviewOutput, overrideType) {
        super(message, ERROR_CODES.REVIEW_REJECTION.code);
        this.reviewOutput = reviewOutput;
        this.overrideType = overrideType;
    }
}

class PipelineStoppedError extends PipelineError {
    constructor(projectId) {
        super(`Pipeline stopped for project ${projectId}`, ERROR_CODES.PIPELINE_STOPPED.code);
        this.projectId = projectId;
    }
}

class ContractViolationError extends PipelineError {
    constructor(message, violations) {
        super(message, ERROR_CODES.PIPELINE_CONTRACT_VIOLATION.code);
        this.violations = violations;
    }
}

class StorageError extends InfrastructureError {
    constructor(message, code) {
        super(message, code || ERROR_CODES.STORAGE_ERROR.code);
    }
}

class ConcurrencyError extends StorageError {
    constructor(message) {
        super(message || 'Concurrent modification conflict', ERROR_CODES.CONCURRENCY_ERROR.code);
    }
}

class DataCorruptionError extends StorageError {
    constructor(message, dataType, dataId) {
        super(message, ERROR_CODES.DATA_CORRUPTION.code);
        this.dataType = dataType;
        this.dataId = dataId;
    }
}

class AuthError extends AppError {
    constructor(message) {
        super(message, ERROR_CODES.AUTH_ERROR.code, ERROR_CODES.AUTH_ERROR.statusCode);
    }
}

// 错误分类函数从 errorClassifier.js 导入并重新导出，保持向后兼容
const classifier = require('./errorClassifier');

module.exports = {
    AppError,
    DomainError,
    InfrastructureError,
    ValidationError,
    NotFoundError,
    StateTransitionError,
    PipelineError,
    LLMOverloadedError,
    LLMTimeoutError,
    ContextOverflowError,
    ReviewRejectionError,
    PipelineStoppedError,
    ContractViolationError,
    StorageError,
    ConcurrencyError,
    DataCorruptionError,
    AuthError,
    ...classifier
};
