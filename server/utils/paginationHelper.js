export const calculatePagination = (count, page, limit) => {
    const totalPages = Math.ceil(count / limit);
    return {
        total: count,
        page,
        totalPages,
        limit,
        currentRowsCount: count,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null
    };
};
