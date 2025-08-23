const { errorHandler } = require('../../src/middleware/errorHandler'); // make sure path is correct

describe('errorHandler middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {}); // silence console logs
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('handles generic error', () => {
        const error = new Error('Something went wrong');

        errorHandler(error, req, res, next);

        expect(console.error).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Something went wrong'
        });
    });

    test('handles Prisma P2002 error', () => {
        const error = { code: 'P2002', message: 'Duplicate key', stack: 'stack trace' };

        errorHandler(error, req, res, next);

        expect(console.error).toHaveBeenCalledWith(error.stack);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Resource already exists'
        });
    });

    test('handles ValidationError', () => {
        const error = { name: 'ValidationError', message: 'Invalid data', stack: 'stack trace' };

        errorHandler(error, req, res, next);

        expect(console.error).toHaveBeenCalledWith(error.stack);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Validation Error'
        });
    });

    test('handles JsonWebTokenError', () => {
        const error = { name: 'JsonWebTokenError', message: 'Invalid token', stack: 'stack trace' };

        errorHandler(error, req, res, next);

        expect(console.error).toHaveBeenCalledWith(error.stack);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Invalid token'
        });
    });

    test('handles TokenExpiredError', () => {
        const error = { name: 'TokenExpiredError', message: 'Expired', stack: 'stack trace' };

        errorHandler(error, req, res, next);

        expect(console.error).toHaveBeenCalledWith(error.stack);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Token expired'
        });
    });

    test('handles error with custom statusCode', () => {
        const error = { message: 'Custom error', statusCode: 418, stack: 'stack trace' };

        errorHandler(error, req, res, next);

        expect(console.error).toHaveBeenCalledWith(error.stack);
        expect(res.status).toHaveBeenCalledWith(418);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Custom error'
        });
    });

    test('handles error without message or stack (defaults to 500)', () => {
        const error = {}; // no message, no stack

        errorHandler(error, req, res, next);

        expect(console.error).toHaveBeenCalled(); // will log undefined
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Internal Server Error'
        });
    });
});
