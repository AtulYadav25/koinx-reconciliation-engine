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
 * @param res - Express response object
 * @param statusCode - HTTP status code (default 200)
 * @param message - Success message
 * @param data - Non-paginated metadata/context object
 * @param entries - Paginated array of results
 * @param page - Current page number
 * @param limit - Records per page
 */
export const paginationResponse = <T, E>(
    res: Response,
    statusCode = 200,
    message: string,
    data: T,
    entries: E[],
    page: number,
    limit: number
) => {
    return res
        .status(statusCode)
        .send({
            success: true,
            message,
            data,
            entries,
            meta: {
                page,
                limit,
                hasNextPage: entries.length === limit,
                hasPrevPage: page > 1,
            },
        });
};