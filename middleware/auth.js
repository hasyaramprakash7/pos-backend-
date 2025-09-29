// middleware/auth.js
const jwt = require('jsonwebtoken');

// Mocked JWT secret - MUST be in .env in a real app
process.env.JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey'; 

/**
 * Middleware to verify JWT and authorize based on role(s).
 * Calling auth() with no argument allows access for all authenticated users.
 * * @param {string|string[]} [requiredRoles] - A single role string or an array of allowed roles.
 */
const auth = (requiredRoles) => async (req, res, next) => {
    // Get token from header
    const token = req.header('x-auth-token');

    // 1. Check if token exists
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach decoded user payload to the request
        req.user = decoded.user;
        
        // Crucial: Attach vendorId for controller use (menu ownership, staff linking)
        if (decoded.user && decoded.user.vendorId) {
            req.user.vendorId = decoded.user.vendorId;
        }

        // 2. Role-based access control
        // If requiredRoles is undefined/null, the array 'roles' will be empty or contain nulls/undefined.
        const roles = Array.isArray(requiredRoles) 
            ? requiredRoles.filter(Boolean) // Remove falsey values if array provided
            : [requiredRoles].filter(Boolean); // Create array and remove falsey values if single role provided

        // Only check roles if specific roles were actually requested (i.e., roles.length > 0)
        if (roles.length > 0) {
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ msg: `Access denied. Requires one of: ${roles.join(', ')}` });
            }
        }
        
        // If roles.length is 0, execution reaches here, allowing all authenticated users.
        next();

    } catch (err) {
        // console.error(err);
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

module.exports = auth;