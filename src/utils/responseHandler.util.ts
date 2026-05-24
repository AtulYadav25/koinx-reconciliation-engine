import { Response } from "express";

export const successResponse = <T>(res: Response, statusCode: number = 200, message: string = "Success", data: T) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data: data as T,
    });
};

export const errorResponse = <T>(res: Response, statusCode: number = 500, message: string = "Error", error: string | null = null, data: T | null = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        data: data as T,
        error,
    });
};

/**
 * Standard pagination response formatter
 * @param {Object} reply - Fastify reply object
 * @param {Array} data - Array of results
 * @param {Number} page - Current page number
 * @param {Number} limit - Records per page
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code (default 200)
 */

export const paginationResponse = <T>(
    res: Response,
    statusCode = 200,
    message: string,
    data: T[],
    page: number,
    limit: number
) => {

    return res
        .status(statusCode)
        .send({
            success: true,
            message,
            data: data as T,
            meta: {
                page,
                limit,
                hasNextPage: data.length === limit,
                hasPrevPage: page > 1,
            },
        });
};