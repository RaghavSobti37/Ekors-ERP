const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

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

// Helper to get full IP address
function getIp(req) {
  // Try to get the full IP address, including IPv6 if present
  return (
    req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req?.connection?.remoteAddress ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    'unknown'
  );
}

// Helper to get WiFi SSID (server-side only, best effort)
function getWifiSSID() {
  try {
    if (process.platform === 'win32') {
      // Windows: use netsh
      const output = execSync('netsh wlan show interfaces').toString();
      const match = output.match(/SSID\s*:\s*(.+)/i);
      return match ? match[1].trim() : 'N/A';
    } else if (process.platform === 'darwin') {
      // macOS: use airport
      const output = execSync("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I").toString();
      const match = output.match(/ SSID: (.+)/);
      return match ? match[1].trim() : 'N/A';
    } else if (process.platform === 'linux') {
      // Linux: use nmcli
      const output = execSync('nmcli -t -f active,ssid dev wifi | egrep "^yes"').toString();
      const match = output.match(/yes:(.+)/);
      return match ? match[1].trim() : 'N/A';
    }
    return 'N/A';
  } catch {
    return 'N/A';
  }
}

// Main log function (only for login)
function log({ user, page, action, req, message = '', level = 'info' }) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);
  const userString = user
    ? user.name || user.email || user.id || user.firstname + ' ' + user.lastname || 'N/A'
    : 'System';
  const pageString = page || 'N/A';
  const actionString = action || 'N/A';
  const ip = req ? getIp(req) : 'N/A';
  const device = req ? getDeviceName(req) : os.hostname();
  const wifiSSID = getWifiSSID();

  let logLine = `[${date}][${time}][${userString}][${pageString}][${actionString}]`;

  if (message) logLine += ` ${message}`;
  if (ip) logLine += ` [IP:${ip}]`;
  if (device) logLine += ` [Device:${device}]`;
  if (wifiSSID) logLine += ` [WiFi:${wifiSSID}]`;

  fs.appendFileSync(getLogFilePath(), logLine + '\n', { encoding: 'utf8' });
  // Also output to terminal/console
  if (level === 'error') {
    console.error(logLine);
  } else if (level === 'warn') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }
}

// Express middleware for login logging (only logs on /login POST)
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
      req,
      message: 'User login attempt',
      level: 'info'
    });
  }
  next();
}

module.exports = {
  log,
  loginLogger,
};