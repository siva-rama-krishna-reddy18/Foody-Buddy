const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    // Default error
    let error = {
        message: err.message || 'Internal Server Error',
        status: err.statusCode || 500
    };
    
    // Prisma errors
    if (err.code === 'P2002') {
        error.message = 'Resource already exists';
        error.status = 409;
    }
    
    // Validation errors
    if (err.name === 'ValidationError') {
        error.message = 'Validation Error';
        error.status = 400;
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error.message = 'Invalid token';
        error.status = 401;
    }
    
    if (err.name === 'TokenExpiredError') {
        error.message = 'Token expired';
        error.status = 401;
    }
    
    res.status(error.status).json({
        success: false,
        error: error.message
    });
};

module.exports = { errorHandler };