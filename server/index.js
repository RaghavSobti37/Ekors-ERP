const express = require('express');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const cors = require('cors');
const logger = require('./utils/logger');
require('dotenv').config();

const connectDB = require('./db.js');

// Routes
const authRoutes = require("./routes/authRoutes");
const quotationRoutes = require('./routes/quotations.js');
const logtimeRoutes = require('./routes/logTimeRoutes.js');
const itemRoutes = require('./routes/itemlistRoutes.js');
const challanRoutes = require('./routes/challanRoutes.js');
const initRouter = require('./routes/init');
const userRoutes = require('./routes/userRoutes'); 
const clientRoutes = require('./routes/clients');
const ticketsRouter = require('./routes/tickets'); 
const reportRoutes = require("./routes/reportRoutes");
const auditLogRoutes = require('./routes/auditLogRoutes');
const frontendLogRoute = require('./routes/frontendLogRoute.js');

const app = express();
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Create uploads folder if not exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// ---------------------------
// API Routes with Logging
function mountRoute(path, router) {
  app.use(path, router);
  console.log(`[ROUTE MOUNTED] ${path}`);
  logger.info('route-mount', `Mounted: ${path}`);
}

mountRoute('/api/auth', authRoutes);
mountRoute('/api/users', userRoutes);
mountRoute('/api/clients', clientRoutes);
mountRoute('/api/items', itemRoutes);
mountRoute('/api/quotations', quotationRoutes);
mountRoute('/api/tickets', ticketsRouter);
mountRoute('/api/challans', challanRoutes);
mountRoute('/api/logtime', logtimeRoutes);
mountRoute('/api/reports', reportRoutes);
mountRoute('/api/audit', auditLogRoutes);
mountRoute('/api/init', initRouter);
mountRoute('/api', frontendLogRoute);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log(`[ROUTE MOUNTED] /uploads (static)`);

// ---------------------------
// Static Serving for Frontend (React)
app.use(express.static(path.join(__dirname, '../client/dist')));
console.log('[STATIC] Serving React frontend');

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
console.log('[CATCH-ALL] React Router fallback enabled');

// ---------------------------
// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR] Unhandled:', err);
  logger.error('general', `Unhandled error on ${req.path}`, err, null, {
    requestMethod: req.method
  });
  res.status(500).send('Something broke!');
});

// ---------------------------
// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SERVER STARTED] Listening on port ${PORT}`);
  logger.info('server-lifecycle', `Server running on port ${PORT}`);
});
