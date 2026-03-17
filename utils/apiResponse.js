// API Response helper functions

// Success response
const successResponse = (res, statusCode, data, message = 'Success') => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

// Error response
const errorResponse = (res, statusCode, message = 'Error', errors = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        errors
    });
};

// Pagination response
const paginatedResponse = (res, statusCode, data, pagination, message = 'Success') => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        pagination
    });
};

// Created response
const createdResponse = (res, data, message = 'Created successfully') => {
    return res.status(201).json({
        success: true,
        message,
        data
    });
};

// No content response
const noContentResponse = (res, message = 'No content') => {
    return res.status(204).json({
        success: true,
        message
    });
};

// Unauthorized response
const unauthorizedResponse = (res, message = 'Unauthorized') => {
    return res.status(401).json({
        success: false,
        message
    });
};

// Forbidden response
const forbiddenResponse = (res, message = 'Forbidden') => {
    return res.status(403).json({
        success: false,
        message
    });
};

// Not found response
const notFoundResponse = (res, message = 'Resource not found') => {
    return res.status(404).json({
        success: false,
        message
    });
};

// Bad request response
const badRequestResponse = (res, message = 'Bad request', errors = null) => {
    return res.status(400).json({
        success: false,
        message,
        errors
    });
};

// Server error response
const serverErrorResponse = (res, message = 'Internal server error') => {
    return res.status(500).json({
        success: false,
        message
    });
};

module.exports = {
    successResponse,
    errorResponse,
    paginatedResponse,
    createdResponse,
    noContentResponse,
    unauthorizedResponse,
    forbiddenResponse,
    notFoundResponse,
    badRequestResponse,
    serverErrorResponse
};
