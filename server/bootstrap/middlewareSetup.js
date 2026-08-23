'use strict';

/**
 * Express 中间件挂载
 *
 * 职责：挂载 cors/json/securityHeaders/inputSanitizer/traceId/httpMetrics/rateLimit/auth/apiResponse
 * 文件位置：server/bootstrap/middlewareSetup.js
 */

const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('shared/logger');
const { SERVER_DEFAULTS } = require('../config/systemConfig');
const { errorHandler } = require('../middleware/errorHandler');
const { apiResponse } = require('../middleware/apiResponse');
const { traceIdMiddleware } = require('../middleware/traceIdMiddleware');
const { securityHeaders } = require('../middleware/securityHeaders');
const { inputSanitizer } = require('../middleware/inputSanitizer');
const { httpMetricsMiddleware } = require('../middleware/httpMetricsMiddleware');
const { createAuthMiddleware } = require('../middleware/auth');

/**
 * 挂载中间件到 app
 * @param {import('express').Application} app
 * @param {string} REQUEST_SECRET
 */
function setupMiddleware(app, REQUEST_SECRET) {
    const allowedOrigins = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
        : [`http://localhost:${SERVER_DEFAULTS.DEFAULT_FRONTEND_PORT}`, `http://localhost:${SERVER_DEFAULTS.DEFAULT_PORT}`, `http://127.0.0.1:${SERVER_DEFAULTS.DEFAULT_FRONTEND_PORT}`];
    app.use(require('cors')(allowedOrigins.length > 0 ? { origin: allowedOrigins } : { origin: false }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use(securityHeaders);
    app.use(inputSanitizer);
    app.use(traceIdMiddleware);
    app.use(httpMetricsMiddleware);

    const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { success: false, error: '请求过于频繁，请稍后再试' } });
    app.use(globalLimiter);

    const pipelineLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'Pipeline操作过于频繁，每分钟最多60次' } });
    app.use(apiResponse);
    app.use(createAuthMiddleware({ secret: REQUEST_SECRET }));
    app.use('/output', express.static(path.join(__dirname, '..', 'output')));

    return { pipelineLimiter };
}

module.exports = { setupMiddleware };
