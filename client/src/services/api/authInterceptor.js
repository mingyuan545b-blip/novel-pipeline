import axios from 'axios';
import {
    api, longApi, API_BASE,
    _generateRequestId, _registerRequest, _unregisterRequest, _addRequestIdToConfig
} from './httpClient';
import logger from '../../shared/logger';
import {
    extractTraceIdFromResponse,
    extractTraceIdFromError,
    recordTraceId
} from './traceIdHelper';

let _authToken = '';
let _authReady = false;
let _authPromise = null;
let _isRefreshing = false;
let _refreshSubscribers = [];

function _onTokenRefreshed(newToken) {
    _refreshSubscribers.forEach(cb => cb(newToken));
    _refreshSubscribers = [];
}

function _addRefreshSubscriber(cb) {
    _refreshSubscribers.push(cb);
}

function _clearStaleToken() {
    _authToken = '';
    localStorage.removeItem('auth_token');
}

async function fetchAuthToken(forceRefresh = false) {
    if (!forceRefresh && _authPromise && _authReady) return _authPromise;
    _authPromise = (async () => {
        const envSecret = import.meta.env.VITE_REQUEST_SECRET || '';
        if (!envSecret) {
            _authToken = '';
            localStorage.removeItem('auth_token');
            _authReady = true;
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/auth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: envSecret })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.token) {
                    _authToken = data.token;
                    localStorage.setItem('auth_token', data.token);
                } else if (data.mode === 'open') {
                    _authToken = '';
                    localStorage.removeItem('auth_token');
                }
            } else {
                _clearStaleToken();
                _authToken = envSecret;
            }
        } catch (e) {
            logger.warn('API', 'Failed to fetch auth token:', e.message);
            _authToken = envSecret;
        }
        _authReady = true;
    })();
    return _authPromise;
}

fetchAuthToken();

function addAuthInterceptor(instance) {
    instance.interceptors.request.use(async config => {
        if (!_authReady) await _authPromise;
        const token = _authToken || localStorage.getItem('auth_token') || '';
        if (token && !config.url?.includes('/health')) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        const axiosSource = axios.CancelToken.source();
        config.cancelToken = axiosSource.token;
        const requestId = _registerRequest(_generateRequestId(), axiosSource);
        _addRequestIdToConfig(config);
        config.metadata._requestId = requestId;
        return config;
    });

    instance.interceptors.response.use(
        response => {
            const requestId = response.config?.metadata?._requestId;
            if (requestId) _unregisterRequest(requestId);
            const renewedToken = response.headers?.['x-renewed-token'];
            if (renewedToken) {
                _authToken = renewedToken;
                localStorage.setItem('auth_token', renewedToken);
            }
            // 提取并记录 traceId（成功响应也会携带，便于关联完整请求链路）
            const traceId = extractTraceIdFromResponse(response);
            if (traceId) recordTraceId(traceId);
            return response;
        },
        async error => {
            // 提取 traceId 并挂到 error 对象，下游 UI 可直接读取 error.traceId
            const traceId = extractTraceIdFromError(error);
            if (traceId) {
                recordTraceId(traceId);
                error.traceId = traceId;
            }

            const originalRequest = error.config;
            if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
                originalRequest._retry = true;
                if (_isRefreshing) {
                    return new Promise((resolve, reject) => {
                        _addRefreshSubscriber(newToken => {
                            if (!newToken) {
                                reject(new Error('Token refresh failed'));
                            } else {
                                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                                resolve(instance(originalRequest));
                            }
                        });
                    });
                }
                _isRefreshing = true;
                try {
                    _authReady = false;
                    _authPromise = null;
                    await fetchAuthToken(true);
                    _isRefreshing = false;
                    _onTokenRefreshed(_authToken);
                    if (_authToken) {
                        originalRequest.headers['Authorization'] = `Bearer ${_authToken}`;
                        return instance(originalRequest);
                    }
                    delete originalRequest.headers['Authorization'];
                    return instance(originalRequest);
                } catch (refreshErr) {
                    _isRefreshing = false;
                    _clearStaleToken();
                    _refreshSubscribers.forEach(cb => cb(null));
                    _refreshSubscribers = [];
                    logger.error('API', 'Token refresh failed:', refreshErr.message);
                }
            }
            // 错误日志补充 traceId 上下文
            const traceTag = traceId ? `[${traceId}] ` : '';
            if (error.response?.status === 401) logger.warn('API', `${traceTag}Authentication required`);
            else if (error.response?.status === 403) logger.warn('API', `${traceTag}Access forbidden:`, error.response?.data?.error || 'Permission denied');
            else if (error.response?.status === 409) logger.warn('API', `${traceTag}Conflict:`, error.response?.data?.error || 'Resource conflict');
            else if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') logger.warn('API', `${traceTag}Request timeout or cancelled:`, error.config?.url);
            else if (!error.response) logger.warn('API', `${traceTag}Network error - server may be offline`);
            else if (error.response?.status >= 500) logger.error('API', `${traceTag}Server error:`, error.response?.status, error.response?.data?.error || error.response?.statusText || 'Internal Server Error');
            return Promise.reject(error);
        }
    );
}

addAuthInterceptor(api);
addAuthInterceptor(longApi);

export { fetchAuthToken };
