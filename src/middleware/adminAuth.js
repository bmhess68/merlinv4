const requireAdmin = (req, res, next) => {
    if (!req.session?.user?.permissions?.admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

module.exports = requireAdmin; 