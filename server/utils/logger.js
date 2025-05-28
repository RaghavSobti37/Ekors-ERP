const fs = require('fs');
const path = require('path');

const logDirectory = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Define log file paths for different types
const logFilePaths = {
  userActivity: path.join(logDirectory, 'userActivity.log'), // Merged user, login, and logtime functionality
  quotation: path.join(logDirectory, 'quotation.log'),
  ticket: path.join(logDirectory, 'ticket.log'),
  challan: path.join(logDirectory, 'challan.log'),
  item: path.join(logDirectory, 'item.log'),
  delete: path.join(logDirectory, 'delete_operations.log'), // For generic delete operations
  general: path.join(logDirectory, 'general.log'),         // For other activities or fallback
};

// Create write streams for each log file type
const logStreams = {};
for (const type in logFilePaths) {
  const streamPath = logFilePaths[type];
  const stream = fs.createWriteStream(streamPath, { flags: 'a' });
  stream.on('error', (err) => {
    // Log critical errors related to stream creation/writing to console
    console.error(`[LOGGER_CRITICAL_ERROR] Failed to create or write to log file ${streamPath}. Error: ${err.message}. Subsequent logs of type '${type}' may be lost or only go to console.`);
  });
  logStreams[type] = stream;
}

const log = (level, type, message, user = null, details = {}) => {
  const isoTimestamp = new Date().toISOString();
  // Ensure 'type' is valid, otherwise default to 'general'
  const logType = type && logStreams[type] ? type : 'general';
  const stream = logStreams[logType];

  const logEntry = {
    timestamp: isoTimestamp,
    level: level.toUpperCase(),
    logType, // The actual type being logged to (e.g., 'general' if original 'type' was invalid)
    message,
    // Safely include user details if user object is provided and has expected properties
    ...(user && typeof user === 'object' && user.firstname && user.lastname && {
        user: {
            // id: user.id, // Uncomment if user.id is available and needed
            name: `${user.firstname} ${user.lastname}`
        }
    }),
    ...details,
  };

  const logStringToFile = JSON.stringify(logEntry) + '\n';

  // Console logging (more human-readable)
  const consoleTimestamp = new Date().toLocaleString();
  let consoleOutput = `[${consoleTimestamp}] [${level.toUpperCase()}] [${logType}]`;
  if (user && typeof user === 'object' && user.firstname && user.lastname) {
    consoleOutput += ` [User: ${user.firstname} ${user.lastname}]`;
  }
  consoleOutput += ` - ${message}`;

  // Use console.error for 'error' level, console.warn for 'warn', etc.
  const consoleLogFunction = console[level.toLowerCase()] || console.log;

  if (Object.keys(details).length > 0) {
    consoleLogFunction(consoleOutput, details);
  } else {
    consoleLogFunction(consoleOutput);
  }

  // File logging
  if (stream && stream.writable) { // Check if stream is writable and exists
    stream.write(logStringToFile, (err) => {
      if (err) {
        console.error(`[LOGGER_WRITE_ERROR] Failed to write to log stream for type '${logType}'. Message: "${message}". Error: ${err.message}.`);
        // Log the original entry to console as a fallback if file write fails
        console.error('[LOGGER_FALLBACK_CONSOLE]', logEntry);
      }
    });
  } else {
    console.error(`[LOGGER_ERROR] Stream for type '${logType}' is not available or not writable. Log message not written to file: "${message}".`);
    // Log the original entry to console as a fallback
    console.error('[LOGGER_FALLBACK_CONSOLE]', logEntry);
  }
};

const logger = {
  // Updated logger methods to include 'type' and 'user'
  info: (type, message, user = null, details = {}) => log('info', type, message, user, details),
  warn: (type, message, user = null, details = {}) => log('warn', type, message, user, details),
  error: (type, message, error, user = null, details = {}) => {
    // Ensure error is an actual Error object or provide a sensible default for error.message and error.stack
    const errorDetails = {
        errorMessage: error instanceof Error ? error.message : String(error),
        ...(error instanceof Error && { stack: error.stack }), // only add stack if it's an Error object
        ...details
    };
    log('error', type, message, user, errorDetails);
  },
  debug: (type, message, user = null, details = {}) => process.env.NODE_ENV === 'development' ? log('debug', type, message, user, details) : null,
};

module.exports = logger;