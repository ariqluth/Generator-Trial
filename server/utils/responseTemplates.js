export const successResponse = (res, data, pagination = null) => {
    const response = {
        status: 'success',
        data
    };

    if (pagination) {
        response.pagination = pagination;
    }

    res.status(200).json(response);
};

export const errorResponse = (res, message, statusCode = 500) => {
    res.status(statusCode).json({
        status: 'error',
        message
    });
};
