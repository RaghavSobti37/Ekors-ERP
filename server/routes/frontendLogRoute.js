// server/routes/frontendLogRoute.js
const express = require('express');
const logger = require('../utils/logger.js');

const router = express.Router();

router.post('/frontend-log', (req, res) => {
  const { level, type, message, user, details } = req.body;

  // Basic validation
  if (!level || !message) {
    // Log this attempt to log, but don't crash
    logger.warn('frontend-routing', 'Received incomplete log data from frontend', null, { receivedBody: req.body });
    return res.status(400).json({ success: false, error: 'Incomplete log data: level and message are required.' });
  }

  try {
    // Dynamically call logger method
    if (logger[level]) {
      if (level === 'error') {
        // For errors from frontend:
        // `message` is the primary log message.
        // `details` (from frontend) contains specifics like stack, url, originalMessage.
        // We construct an `errorForLogger` object for logger.error's 3rd param.
        // `details` (from frontend) are passed as the 5th param for additional context.
        const errorForLogger = {
          message: details?.errorMessage || details?.originalMessage || message, // Prefer specific error message from details
          stack: details?.stack
        };
        logger.error(type, message, errorForLogger, user, details);
      } else {
        // For info, warn, debug
        logger[level](type, message, user, details);
      }
    } else {
      logger.warn('frontend-routing', `Unknown log level received: ${level}`, user, { originalMessage: message, originalDetails: details, originalLevel: level });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    // This catches errors within this route handler itself
    logger.error('frontend-route-error', 'Failed to process/log frontend message', error, user, { originalLogRequest: req.body });
    res.status(500).json({ success: false, error: 'Logging failed on server' });
  }
});

module.exports = router;
