const express = require('express');
const router = express.Router();
const logger = require('../utils/logger'); // Adjust path if your utils folder is elsewhere

router.post('/log', (req, res) => {
  console.log('[SERVER DEBUG auditLogRoutes] POST /api/audit/log: Received request to log event.');
  const { level = 'info', type, message, user, details } = req.body;

  console.log('[SERVER DEBUG auditLogRoutes] Request body:', JSON.stringify(req.body, null, 2));

  if (!type || !message) {
    console.error('[SERVER ERROR auditLogRoutes] Bad Request: Log type and message are required.');
    return res.status(400).json({ error: 'Log type and message are required.' });
  }

  // Prepare user object for the logger, which expects { firstname, lastname }
  let userForLog = null;
  if (user && typeof user === 'object' && user.firstname && user.lastname) {
    userForLog = { firstname: user.firstname, lastname: user.lastname };
    // Any other user details (id, email) are expected to be in the 'details' object if needed for the log entry
  } else if (user) {
    console.warn(`[SERVER WARN auditLogRoutes] User data received is not in the expected format (object with firstname, lastname). User data:`, user);
    // If user is just an ID or email, it might be better to pass it in 'details'
    // For now, we'll pass it as is, and the logger might not pick up 'user.name'
  }

  try {
    console.log(`[SERVER DEBUG auditLogRoutes] Calling logger with: level=${level}, type=${type}, message=${message}, user=${JSON.stringify(userForLog)}, details=${JSON.stringify(details)}`);

    switch (level.toLowerCase()) {
      case 'error':
        // logger.error expects (type, message, errorObject, user, details)
        // The client should send error information (e.g., errorMessage, stack) within 'details'.
        const errorObject = {
            message: details && details.errorMessage ? details.errorMessage : 'Client-reported error',
            stack: details && details.stack ? details.stack : undefined
        };
        logger.error(type, message, errorObject, userForLog, details);
        break;
      case 'warn':
        logger.warn(type, message, userForLog, details);
        break;
      case 'debug':
        logger.debug(type, message, userForLog, details);
        break;
      case 'info':
      default:
        logger.info(type, message, userForLog, details);
        break;
    }
    console.log(`[SERVER INFO auditLogRoutes] Log event (type: ${type}) processed successfully by logger.`);
    res.status(200).json({ success: true, message: 'Log received and processed' });
  } catch (e) {
    console.error('[SERVER CRITICAL auditLogRoutes] CRITICAL ERROR while processing log request with server logger:', e);
    // Fallback logging if logger itself fails or an unexpected error occurs
    console.error(`[SERVER FALLBACK LOG auditLogRoutes] Level: ${level}, Type: ${type}, Message: "${message}", User: ${JSON.stringify(userForLog)}, Details: ${JSON.stringify(details)}`);
    res.status(500).json({ success: false, message: 'Failed to record log on server due to an internal error' });
  }
});

module.exports = router;