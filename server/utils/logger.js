const fs = require('fs');
const path = require('path');

const logDirectory = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const logFilePath = path.join(logDirectory, 'delete_operations.log');

const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

const log = (level, message, details = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...details,
  };
  const logString = JSON.stringify(logEntry) + '\n';

  // Log to console
  if (level === 'error' || level === 'warn') {
    console.error(logString.trim());
  } else {
    console.log(logString.trim());
  }

  // Log to file
  logStream.write(logString);
};

const logger = {
  info: (message, details) => log('info', message, details),
  warn: (message, details) => log('warn', message, details),
  error: (message, error, details) => log('error', message, { ...details, errorMessage: error.message, stack: error.stack }),
  debug: (message, details) => process.env.NODE_ENV === 'development' ? log('debug', message, details) : null,
};

module.exports = logger;