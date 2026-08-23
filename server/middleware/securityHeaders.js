/**
 * securityHeaders.js
 * 安全HTTP头中间件 — 不依赖helmet库，轻量实现
 *
 * G6：新增 Content-Security-Policy 头，防止 API 响应被当作 HTML 解析执行
 * 注意：CSP 策略需区分 API 响应和 SPA 页面/静态资源
 */
// API 响应 CSP：只返回 JSON，禁止任何内容加载
// - default-src 'none'：不允许任何资源加载
// - frame-ancestors 'none'：禁止被 iframe 嵌入（替代 X-Frame-Options: DENY）
const CSP_API_POLICY = "default-src 'none'; frame-ancestors 'none'";

// SPA 页面 CSP：允许同源资源加载（JS/CSS/图片/字体/API）+ 外部字体 CDN
const CSP_SPA_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.loli.net; img-src 'self' data: blob:; font-src 'self' data: https://fonts.loli.net https://gstatic.loli.net; connect-src 'self' ws: wss:; frame-ancestors 'none'";

const BASE_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'no-store'
};

function securityHeaders(req, res, next) {
    for (const [key, value] of Object.entries(BASE_HEADERS)) {
        if (!res.getHeader(key)) res.setHeader(key, value);
    }
    // API 响应用严格 CSP，页面/静态资源用宽松 CSP
    const csp = req.path.startsWith('/api/') ? CSP_API_POLICY : CSP_SPA_POLICY;
    if (!res.getHeader('Content-Security-Policy')) {
        res.setHeader('Content-Security-Policy', csp);
    }
    res.removeHeader('X-Powered-By');
    next();
}

module.exports = { securityHeaders, BASE_HEADERS, CSP_API_POLICY, CSP_SPA_POLICY };
