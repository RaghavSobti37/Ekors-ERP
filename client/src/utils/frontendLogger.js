// client/src/utils/frontendLogger.js
import axios from 'axios';

const logToServer = async ({ level = 'info', type = 'frontend', message = '', user = null, details = {} }) => {
  try {
    await axios.post('/api/frontend-log', {
      level,
      type,
      message,
      user,
      details,
    });
  } catch (err) {
    console.error('Frontend logging failed', err);
  }
};

const frontendLogger = {
  info: (type, message, user = null, details = {}) => logToServer({ level: 'info', type, message, user, details }),
  warn: (type, message, user = null, details = {}) => logToServer({ level: 'warn', type, message, user, details }),
  error: (type, message, user = null, details = {}) => logToServer({ level: 'error', type, message, user, details }),
  debug: (type, message, user = null, details = {}) => {
    if (process.env.NODE_ENV === 'development') {
      logToServer({ level: 'debug', type, message, user, details });
    }
  },
};

export default frontendLogger;
