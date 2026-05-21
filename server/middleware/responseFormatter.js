function success(data, message = 'ok') {
    return { success: true, message, data };
}

function error(errorMsg, code = 400, details = null) {
    const result = { success: false, error: errorMsg, code };
    if (details) result.details = details;
    return result;
}

function paginated(data, total, page, pageSize) {
    return {
        success: true,
        data,
        pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
    };
}

module.exports = { success, error, paginated };
