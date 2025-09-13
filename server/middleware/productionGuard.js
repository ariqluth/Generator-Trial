const productionGuard = (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return res.redirect('/');
    }
    next();
};

export default productionGuard;
