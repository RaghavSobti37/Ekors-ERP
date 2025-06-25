/**
 * Middleware to check if the authenticated user has the 'super-admin' role.
 * This should be used AFTER an authentication middleware (like your auth.js)
 * has attached the user object to the request.
 */
const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super-admin') {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden. Requires Super Admin role.' });
};

module.exports = { isSuperAdmin };
