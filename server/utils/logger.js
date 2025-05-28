const fs = require('fs');
const path = require('path');

// Variables to hold the current log stream and its date marker
let currentLogStream = null;
let currentLogFileDateMarker = null; // Stores YYYY-MM-DD of the current stream's file

// Helper function to get date parts and construct log paths
const getDailyLogInfo = () => {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // MM format
  const day = now.getDate().toString().padStart(2, '0'); // DD format
  const monthName = now.toLocaleString('default', { month: 'long' }); // Full month name, e.g., "December"

  const dateStringForFile = `${year}-${month}-${day}`; // YYYY-MM-DD for filename
  // Directory structure: logs/YYYY/MonthName/
  const logDirectoryForToday = path.join(__dirname, '..', 'logs', year, monthName);
  const logFilePath = path.join(logDirectoryForToday, `${dateStringForFile}.log`);

  return {
    logDirectoryForToday,
    logFilePath,
    currentDateString: dateStringForFile // Used to detect when the day changes
  };
};

// Function to ensure the daily log stream is active and correct
const ensureDailyLogStream = () => {
  const { logDirectoryForToday, logFilePath, currentDateString } = getDailyLogInfo();

  if (currentDateString !== currentLogFileDateMarker || !currentLogStream || !currentLogStream.writable) {
    if (currentLogStream) {
      currentLogStream.end(); // Close the old stream if it exists
    }
    fs.mkdirSync(logDirectoryForToday, { recursive: true }); // Ensure directory exists
    currentLogStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    currentLogStream.on('error', (err) => {
      console.error(`[LOGGER_CRITICAL_ERROR] Failed to create or write to daily log file ${logFilePath}. Error: ${err.message}. Subsequent logs may be lost or only go to console.`);
      currentLogStream = null; // Mark stream as unusable on error
    });
    currentLogFileDateMarker = currentDateString;
  }
  return currentLogStream;
};

const log = (level, type, message, user = null, details = {}) => {
  const isoTimestamp = new Date().toISOString();
  // 'type' is now for categorization within the log entry, not for file selection.
  // Default to 'general' if type is not provided.
  const logType = type || 'general';
  const stream = ensureDailyLogStream(); // Get the single, daily-rotated stream

  // Prepare user details for logEntry, prioritizing email
  const userPayload = {};
  if (user && typeof user === 'object') {
    if (user.email) {
      userPayload.email = user.email;
    }
    if (user.firstname && user.lastname) {
      userPayload.name = `${user.firstname} ${user.lastname}`;
    }
    // Fallback to user.id if no email or name is present
    if (Object.keys(userPayload).length === 0 && user.id) {
      userPayload.id = user.id;
    }
  }

  const logEntry = {
    timestamp: isoTimestamp,
    level: level.toUpperCase(),
    logType, // The actual type being logged to (e.g., 'general' if original 'type' was invalid)
    message,
    ...(Object.keys(userPayload).length > 0 && { user: userPayload }),
    ...details,
  };

  // --- New File Log Formatting ---
  const formatDateForFile = (isoDateString) => {
    const d = new Date(isoDateString);
    // YYYY-MM-DD HH:MM:SS format
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const fileTimestamp = formatDateForFile(logEntry.timestamp);
  const userIdentifier = logEntry.user ? (logEntry.user.name || 'UnknownUser') : 'System';

  let fileLogLine = `[${fileTimestamp}] [${userIdentifier}] [${logEntry.level}] [${logEntry.logType}] - ${logEntry.message}`;

  // Append error-specific details for ERROR level logs
  if (logEntry.level === 'ERROR') {
    if (logEntry.errorMessage && logEntry.errorMessage !== logEntry.message) {
      fileLogLine += ` | Error: ${logEntry.errorMessage}`;
    }
    if (logEntry.stack) {
      const indentedStack = String(logEntry.stack).split('\n').map(line => `  ${line}`).join('\n'); // Indent stack for readability
      fileLogLine += `\n  Stack Trace:\n${indentedStack}`;
    }
  }

  // Append any other details that were part of the logEntry (excluding already used fields)
  const otherDetailsForFile = {};
  const standardKeys = ['timestamp', 'level', 'logType', 'message', 'user', 'errorMessage', 'stack'];
  for (const key in logEntry) {
    if (Object.prototype.hasOwnProperty.call(logEntry, key) && !standardKeys.includes(key)) {
      otherDetailsForFile[key] = logEntry[key];
    }
  }
  if (Object.keys(otherDetailsForFile).length > 0) {
    fileLogLine += ` | Details: ${JSON.stringify(otherDetailsForFile)}`;
  }

  const logStringToFile = fileLogLine + '\n';
  // --- End New File Log Formatting ---

  // Console logging (more human-readable)
  const consoleTimestamp = new Date().toLocaleString();
  let baseConsoleOutput = `[${consoleTimestamp}] [${level.toUpperCase()}] [${logType}]`;

  if (user && typeof user === 'object' && user.firstname && user.lastname) {
    baseConsoleOutput += ` [User: ${user.firstname} ${user.lastname}]`;
  }
  baseConsoleOutput += ` - ${message}`;

  // Use console.error for 'error' level, console.warn for 'warn', etc.
  const consoleLogFunction = console[level.toLowerCase()] || console.log;

  // For errors, the primary message is the custom one.
  // details.errorMessage comes from the error object itself. Append if different and useful.
  if (level.toLowerCase() === 'error' && details.errorMessage && details.errorMessage !== message) {
    baseConsoleOutput += ` | Caused by: ${details.errorMessage}`;
  }

  consoleLogFunction(baseConsoleOutput); // Log the main, formatted line

  // If it's an error and a stack trace is available in details, print it separately.
  // console.error() (or .log() etc.) handles stack trace string formatting well.
  if (level.toLowerCase() === 'error' && details.stack) {
    consoleLogFunction(details.stack);
  }

  // Log any remaining original details (details passed to logger.error, not the error's own message/stack)
  // or general details for other log levels.
  const additionalDetails = { ...details };
  if (level.toLowerCase() === 'error') {
    delete additionalDetails.errorMessage; // Already handled or part of the main message
    delete additionalDetails.stack;     // Printed separately
  }

  if (Object.keys(additionalDetails).length > 0) {
    consoleLogFunction('Additional Details:', additionalDetails); // Logs the object for inspection
  }

  // File logging
  if (stream && stream.writable) { // Check if stream is writable and exists
    stream.write(logStringToFile, (err) => {
      if (err) {
        console.error(`[LOGGER_WRITE_ERROR] Failed to write to daily log stream. Message: "${message}". Error: ${err.message}.`);
        // Log the original entry to console as a fallback if file write fails
        console.error('[LOGGER_FALLBACK_CONSOLE]', logEntry);
      }
    });
  } else {
    console.error(`[LOGGER_ERROR] Daily log stream is not available or not writable. Log message not written to file: "${message}".`);
    // Log the original entry to console as a fallback
    console.error('[LOGGER_FALLBACK_CONSOLE]', logEntry);
  }
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
    log('error', type, message, user, combinedDetails);
  },
  debug: (type, message, user = null, details = {}) => process.env.NODE_ENV === 'development' ? log('debug', type, message, user, details) : null,
};

module.exports = logger;