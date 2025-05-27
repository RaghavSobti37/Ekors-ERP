const fs = require('fs');
const path = require('path');

const logDirectory = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Define log file paths for different types
const logFilePaths = {
  login: path.join(logDirectory, 'login.log'),
  quotation: path.join(logDirectory, 'quotation.log'),
  ticket: path.join(logDirectory, 'ticket.log'),
  challan: path.join(logDirectory, 'challan.log'),
  item: path.join(logDirectory, 'item.log'), // Added item log
  user: path.join(logDirectory, 'user.log'), // Added user log
  logtime: path.join(logDirectory, 'logtime.log'), // Assuming a 'logtime' type exists
  delete: path.join(logDirectory, 'delete_operations.log'), // Keep existing delete log
  general: path.join(logDirectory, 'general.log'), // For other activities
};

// Create write streams for each log file type
const logStreams = {};
for (const type in logFilePaths) {
  logStreams[type] = fs.createWriteStream(logFilePaths[type], { flags: 'a' });
}

const log = (level, type, message, user = null, details = {}) => {
  const timestamp = new Date().toISOString();
  const logType = type && logStreams[type] ? type : 'general'; // Default to 'general' if type is invalid or missing
  const stream = logStreams[logType];

  if (!stream) {
      console.error(`[LOGGER_ERROR] No stream found for log type: ${logType}. Log message not written to file.`);
      // Still log to console if it's an error/warn
       if (level === 'error' || level === 'warn') {
            console.error(`[${level.toUpperCase()}] ${message}`, details);
        } else {
             console.log(`[${level.toUpperCase()}] ${message}`, details);
        }
      return; // Cannot proceed without a valid stream
  }

  const userPrefix = user ? `[ ${user.firstname} ${user.lastname} ] - ` : '';
  const formattedTimestamp = new Date().toLocaleString(); // Use toLocaleString for easier reading
  const prefix = `[ ${formattedTimestamp} ] ${userPrefix}`;

  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    type: logType, // Include the determined type in the JSON details
    ...details,
  };

  const logString = `${prefix}${JSON.stringify(logEntry)}\n`;

  // Log to console (always log to console for visibility, especially errors/warnings)
  console.log(logString.trim());

  // Log to file using the determined stream
  stream.write(logString);
};

const logger = {
  // Updated logger methods to include 'type' and 'user'
  info: (type, message, user = null, details = {}) => log('info', type, message, user, details),
  warn: (type, message, user = null, details = {}) => log('warn', type, message, user, details),
  error: (type, message, error, user = null, details = {}) => log('error', type, message, user, { ...details, errorMessage: error.message, stack: error.stack }),
  debug: (type, message, user = null, details = {}) => process.env.NODE_ENV === 'development' ? log('debug', type, message, user, details) : null,
};

module.exports = logger;