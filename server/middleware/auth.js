const jwt = require('jsonwebtoken');
const User = require('../models/users');

module.exports = async (req, res, next) => {
  console.log("[DEBUG] Auth middleware triggered");
  
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      console.log("[DEBUG] No auth header present");
      return res.status(401).json({ error: 'No token, authorization denied' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    console.log("[DEBUG] Token extracted:", token ? "present" : "missing");
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // Verify token
    console.log("[DEBUG] Verifying token with secret:", process.env.JWT_SECRET ? "present" : "missing");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("[DEBUG] Decoded token:", decoded);
    
    // Find user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      console.log("[DEBUG] User not found for ID:", decoded.id);
      return res.status(401).json({ error: 'User not found' });
    }
    
    console.log("[DEBUG] Authentication successful for user:", user.email);
    req.user = user;
    next(); // Properly call next() to continue middleware chain
    
  } catch (err) {
    console.error("[ERROR] Auth middleware error:", err);
    
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