// client/src/utils/frontendLogger.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const logToServer = async ({ level = 'info', type = 'frontend', message = '', user = null, details = {} }) => {
  try {
    let requestUrl;
    // If API_BASE_URL is defined (typically in production), use it.
    // Otherwise (typically in local dev), use a relative path for the Vite proxy.
    if (API_BASE_URL) {
      requestUrl = `${API_BASE_URL}/api/frontend-log`;
    } else {
      requestUrl = '/api/frontend-log'; // Relies on Vite proxy in dev
    }
    await axios.post(requestUrl, {
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
