const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    let status = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Prisma unique constraint
    if (err.code === 'P2002') {
        status = 409;
        message = 'Resource already exists';
    }

    // Validation error
    if (err.name === 'ValidationError') {
        status = 400;
        message = 'Validation Error';
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        status = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        status = 401;
        message = 'Token expired';
    }

    res.status(status).json({
        success: false,
        error: message
    });
};

module.exports = { errorHandler };


