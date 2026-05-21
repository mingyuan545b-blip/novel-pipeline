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
        super(message, code, 422);
    }
}

class InfrastructureError extends AppError {
    constructor(message, code) {
        super(message, code, 500);
    }
}

class ValidationError extends AppError {
    constructor(message, field) {
        super(message, 'VALIDATION_ERROR', 400);
        this.field = field;
    }
}

class NotFoundError extends AppError {
    constructor(resource, id) {
        super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
        this.resource = resource;
        this.resourceId = id;
    }
}

class StateTransitionError extends DomainError {
    constructor(from, to, reason) {
        super(`Invalid transition: ${from} -> ${to}. ${reason}`, 'INVALID_TRANSITION');
        this.fromState = from;
        this.toState = to;
    }
}

module.exports = {
    AppError,
    DomainError,
    InfrastructureError,
    ValidationError,
    NotFoundError,
    StateTransitionError
};
