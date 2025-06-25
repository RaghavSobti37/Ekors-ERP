const jwt = require('jsonwebtoken');
const User = require('../models/users');
const logger = require('../utils/logger'); // Assuming logger is in utils

module.exports = async (req, res, next) => {
  // logger.debug('auth-middleware', "Auth middleware triggered", null, { method: req.method, path: req.originalUrl }); // Can be too verbose
  
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      logger.warn('auth-middleware', "No auth header present", null, { method: req.method, path: req.originalUrl });
      return res.status(401).json({ error: 'No token, authorization denied. Please include a Bearer token in the Authorization header.' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    // logger.debug('auth-middleware', `Token extracted: ${token ? "present" : "missing"}`, null, { method: req.method, path: req.originalUrl });
    
    if (!token) {
      return res.status(401).json({ error: 'No token after Bearer, authorization denied' });
    }

    // Verify token
    // logger.debug('auth-middleware', `Verifying token with secret: ${process.env.JWT_SECRET ? "present" : "MISSING!"}`, null, { method: req.method, path: req.originalUrl });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // logger.debug('auth-middleware', "Decoded token", null, { decodedId: decoded.id, method: req.method, path: req.originalUrl });
    
    // Find user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      logger.warn('auth-middleware', `User not found for ID: ${decoded.id}`, null, { method: req.method, path: req.originalUrl });
      return res.status(401).json({ error: 'User not found' });
    }
    
    logger.info('auth-middleware', `Authentication successful for user: ${user.email}`, user, { method: req.method, path: req.originalUrl });
    req.user = user;
    next(); // Properly call next() to continue middleware chain
    
  } catch (err) {
    logger.error('auth-middleware', "Auth middleware error", err, null, { method: req.method, path: req.originalUrl });
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Pass other errors to Express error handler
    next(err);
  }
};