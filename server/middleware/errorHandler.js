const logger = require('../shared/logger');
const { AppError, DomainError, InfrastructureError, ValidationError, NotFoundError } = require('../shared/errors');
const { error: errorResponse } = require('./responseFormatter');

function errorHandler(err, req, res, _next) {
    if (err instanceof AppError) {
        logger.warn('api', `${req.method} ${req.path} → ${err.code}`, {
            code: err.code,
            statusCode: err.statusCode,
            message: err.message
        });
        return res.status(err.statusCode).json(errorResponse(err.message, err.code, err.field || null));
    }

    if (err.type === 'entity.parse.failed') {
        logger.warn('api', `Invalid JSON: ${req.method} ${req.path}`);
        return res.status(400).json(errorResponse('Invalid JSON body', 'PARSE_ERROR'));
    }

    if (err.type === 'entity.too.large') {
        logger.warn('api', `Payload too large: ${req.method} ${req.path}`);
        return res.status(413).json(errorResponse('Payload too large', 'PAYLOAD_TOO_LARGE'));
    }

    logger.error('api', `Unhandled error: ${req.method} ${req.path}`, {
        error: err.message,
        stack: err.stack
    });

    res.status(500).json(errorResponse(
        process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        'INTERNAL_ERROR'
    ));
}

function asyncHandler(fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = { errorHandler, asyncHandler };
