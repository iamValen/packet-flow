import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

// custom error with status code
export class AppError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.name = "AppError";
    }
}

// global error handler
export function errorHandler(err: Error | AppError, req: Request, res: Response, next: NextFunction) {
    console.error("err:", err.message);

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message
        });
    }

    // unexpected error
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "server error"
    });
}

// wrapper to avoid try/catch everywhere
export function asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}