import logger from '../utils/logger.js';

// Error handling middleware
export const errorHandler = (err, req, res, next) => {
    // Create detailed error log
    const errorDetails = {
        message: err.message,
        stack: err.stack,
        name: err.name,
        code: err.code,
        errors: err.errors,
        // Include Sequelize specific error details
        sql: err.sql,                           // SQL query that caused error
        parameters: err.parameters,             // Query parameters
        parent: err.parent?.message,           // Native database error
        original: err.original?.message,       // Original error message
        modelName: err.modelName,              // Model that caused error
        instanceErrors: err.errors?.map(e => ({
            message: e.message,
            type: e.type,
            path: e.path,
            value: e.value
        })),
        requestInfo: {
            method: req.method,
            url: req.url,
            query: req.query,
            body: req.body,
            params: req.params,
            ip: req.ip,
            userId: req?.user?.id,
            headers: {
                ...req.headers,
                authorization: undefined // Don't log auth token
            }
        }
    };

    // Log the detailed error
    logger.error('API Error:', errorDetails);

    // Handle Sequelize specific errors
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            status: 'error',
            message: 'Validation error',
            errors: err.errors.map(e => ({
                field: e.path,
                message: e.message
            }))
        });
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
            status: 'error',
            message: 'Database relation error',
            detail: 'This record is referenced by another table and cannot be modified'
        });
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
            status: 'error',
            message: 'Unique constraint error',
            detail: 'A record with this value already exists'
        });
    }

    // Handle transaction errors
    if (err.message.includes('ROLLBACK') || err.message.includes('transaction')) {
        return res.status(500).json({
            status: 'error',
            message: 'Transaction failed',
            detail: err.message,
            hint: 'Check if all required fields are provided and valid'
        });
    }    // Handle Sequelize query errors
    if (err.name === 'SequelizeDatabaseError') {
        return res.status(400).json({
            status: 'error',
            message: 'Database query error',
            detail: process.env.NODE_ENV === 'development' ? err.message : 'Invalid query or data format',
            code: 'DATABASE_ERROR'
        });
    }

    // Handle JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid JSON format',
            detail: 'The request body contains invalid JSON',
            code: 'INVALID_JSON'
        });
    }

    // Default error response with error code
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        status: 'error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        detail: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        code: err.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    });
};
