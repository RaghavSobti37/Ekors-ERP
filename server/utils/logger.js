const winston = require('winston');
const { combine, timestamp, printf, errors, json, colorize } = winston.format;

// Determine log level based on environment
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Custom format for development (human-readable)
const devFormat = printf(({ level, message, timestamp: ts, logType, user, details, stack }) => {
  const userString = user ? `[User: ${user.name || user.email || user.id || 'N/A'}]` : '[User: System]';
  const detailsString = details && Object.keys(details).length > 0 ? ` Details: ${JSON.stringify(details)}` : '';
  const stackString = stack ? `\nStack: ${stack}` : '';
  return `${ts} [${level}] [${logType || 'general'}] ${userString} ${message}${detailsString}${stackString}`;
});

// Configure transports
const transports = [];

if (process.env.NODE_ENV === 'production') {
  // In production (Vercel), log JSON to console. Vercel will pick this up.
  transports.push(new winston.transports.Console({
    format: combine(
      timestamp(),
      errors({ stack: true }), // Log stack trace for errors
      json() // Log in JSON format
    ),
  }));
} else {
  // In development, log pretty, colored output to console.
  transports.push(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      devFormat
    ),
  }));
}

const winstonLogger = winston.createLogger({
  level: logLevel,
  levels: winston.config.npm.levels,
  transports: transports,
  exitOnError: false,
});

// Main log function that adapts to Winston
const log = (level, type, message, user = null, details = {}) => {
  const logType = type || 'general';

  const userPayload = {};
  if (user && typeof user === 'object') {
    if (user.email) userPayload.email = user.email;
    if (user.firstname && user.lastname) userPayload.name = `${user.firstname} ${user.lastname}`;
    if (Object.keys(userPayload).length === 0 && (user.id || user._id)) userPayload.id = user.id || user._id;
  }

  const meta = {
    logType,
    message,
    user: Object.keys(userPayload).length > 0 ? userPayload : undefined,
    details, // This will include errorMessage and stack for errors from the logger.error wrapper
  };

  // If an actual Error object is in details.error (e.g. from logger.error),
  // Winston's `errors({ stack: true })` will handle it.
  if (details.error instanceof Error) {
    meta.error = details.error; // Pass the actual error object for Winston to process
  }

  winstonLogger.log(level, message, meta);
};

const logger = {
  // Updated logger methods to include 'type' and 'user'
  info: (type, message, user = null, details = {}) => log('info', type, message, user, details),
  warn: (type, message, user = null, details = {}) => log('warn', type, message, user, details),
  error: (type, message, error, user = null, details = {}) => {
    // `error` can be an Error instance or an object with error-like properties (e.g., from frontend)
    let errorMessageFromErrorObj = '';
    let stackFromErrorObj = '';

    if (error instanceof Error) {
        errorMessageFromErrorObj = error.message;
        stackFromErrorObj = error.stack;
    } else if (error && typeof error === 'object') {
        // Handle plain objects, like those from JSON.stringify/parse or frontend
        errorMessageFromErrorObj = error.message || String(error); // Fallback if no .message
        stackFromErrorObj = error.stack;
    } else if (error) { // If error is a string or something else
        errorMessageFromErrorObj = String(error);
    }

    const combinedDetails = {
        ...(errorMessageFromErrorObj && { errorMessage: errorMessageFromErrorObj }),
        ...(stackFromErrorObj && { stack: stackFromErrorObj }),
        ...details
    };
    // Pass the original error object to Winston if it exists, for better stack trace handling
    if (error instanceof Error) combinedDetails.error = error;

    log('error', type, message, user, combinedDetails);
  },
  debug: (type, message, user = null, details = {}) => log('debug', type, message, user, details), // Winston level handles if it's logged
};

module.exports = logger;