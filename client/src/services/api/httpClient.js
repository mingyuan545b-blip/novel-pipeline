import axios from 'axios';

const API_BASE = '/api';

let _requestIdCounter = 0;
const _pendingRequests = new Map();

function _generateRequestId() {
    return `req_${++_requestIdCounter}_${Date.now()}`;
}

function _registerRequest(requestId, cancelToken) {
    _pendingRequests.set(requestId, cancelToken);
    return requestId;
}

function _unregisterRequest(requestId) {
    _pendingRequests.delete(requestId);
}

function _addRequestIdToConfig(config) {
    if (!config.metadata) config.metadata = {};
    config.metadata.requestId = _generateRequestId();
    return config;
}

export function cancelRequest(requestId) {
    const cancelToken = _pendingRequests.get(requestId);
    if (cancelToken) {
        cancelToken.cancel(`请求已取消: ${requestId}`);
        _unregisterRequest(requestId);
    }
}

export function cancelAllRequests() {
    _pendingRequests.forEach((cancelToken) => {
        cancelToken.cancel('所有请求已取消');
    });
    _pendingRequests.clear();
}

const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
});

const longApi = axios.create({
    baseURL: API_BASE,
    timeout: 600000,
    headers: { 'Content-Type': 'application/json' }
});

export {
    api, longApi, API_BASE,
    _generateRequestId, _registerRequest, _unregisterRequest, _addRequestIdToConfig
};
