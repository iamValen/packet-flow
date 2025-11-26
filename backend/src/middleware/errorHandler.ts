import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

/**
 * Custom error class for handling application-specific errors
 * makes it easier to throw errors with specific status codes throughout the app
 */
export class AppError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.name = "AppError";
    }
}

/**
 * Global error handler middleware
 * Catches all errors thrown in the application and sends consistent error responses
 * Should be the last middleware in server.ts !!!
 */
export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error("Error occurred:", err.message);

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                statusCode: err.statusCode
            }
        });
    }

    // unexpected errors
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
            message: "Something went wrong on the server",
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR
        }
    });
};
/**
 * Wrapper for async route handlers to avoid repetitive try-catch
 * example: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};