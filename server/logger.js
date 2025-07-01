const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper to get today's log file path
function getLogFilePath() {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(logsDir, `log-${date}.log`);
}

// Helper to get device name
function getDeviceName(req) {
  return req?.headers?.['user-agent'] || os.hostname();
}

// Helper to get IP address
function getIp(req) {
  return (
    req?.headers?.['x-forwarded-for']?.split(',')[0] ||
    req?.connection?.remoteAddress ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    'unknown'
  );
}

// Main log function
function log({ user, page, action, api, req, message = '', details = {}, level = 'info' }) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);
  const userString = user
    ? user.name || user.email || user.id || user.firstname + ' ' + user.lastname || 'N/A'
    : 'System';
  const pageString = page || 'N/A';
  const actionString = action || 'N/A';
  const apiString = api || (req ? req.originalUrl : 'N/A');
  const ip = req ? getIp(req) : 'N/A';
  const device = req ? getDeviceName(req) : os.hostname();

  let logLine = `[${date}][${time}][${userString}][${pageString}][${actionString}][${apiString}]`;

  if (message) logLine += ` ${message}`;
  if (ip) logLine += ` [IP:${ip}]`;
  if (device) logLine += ` [Device:${device}]`;
  if (details && Object.keys(details).length > 0)
    logLine += ` [Details:${JSON.stringify(details)}]`;

  fs.appendFileSync(getLogFilePath(), logLine + '\n', { encoding: 'utf8' });
}

// Express middleware for login logging
function loginLogger(req, res, next) {
  if (
    req.path === '/login' &&
    req.method === 'POST' &&
    req.body &&
    req.body.email
  ) {
    log({
      user: { email: req.body.email },
      page: 'Login',
      action: 'User Login Attempt',
      api: req.originalUrl,
      req,
      message: 'User login attempt',
      level: 'info'
    });
  }
  next();
}

// API endpoint logger for frontend logs
async function frontendLogHandler(req, res) {
  try {
    const { level = 'info', type, message, user, details } = req.body;
    log({
      user,
      page: type || 'Frontend',
      action: 'Frontend Event',
      api: req.originalUrl,
      req,
      message,
      details,
      level
    });
    res.status(200).json({ success: true, message: 'Frontend log recorded' });
  } catch (err) {
    log({
      page: 'Frontend',
      action: 'Frontend Log Error',
      api: req.originalUrl,
      req,
      message: 'Failed to record frontend log',
      details: { error: err.message },
      level: 'error'
    });
    res.status(500).json({ success: false, message: 'Failed to record frontend log' });
  }
}

module.exports = {
  log,
  loginLogger,
  frontendLogHandler,
};