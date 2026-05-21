function success(data, message = 'ok') {
    return { success: true, message, data, timestamp: new Date().toISOString() };
}

function error(errorMsg, code = 400, details = null) {
    const result = { success: false, error: errorMsg, code, timestamp: new Date().toISOString() };
    if (details) result.details = details;
    return result;
}

function paginated(data, total, page, pageSize) {
    return {
        success: true,
        data,
        pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
        timestamp: new Date().toISOString()
    };
}

function created(data, message = 'created') {
    return { success: true, message, data, timestamp: new Date().toISOString() };
}

function noContent() {
    return { success: true, message: 'deleted', timestamp: new Date().toISOString() };
}

module.exports = { success, error, paginated, created, noContent };
