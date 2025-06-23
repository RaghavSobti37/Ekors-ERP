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
const frontendLogRoute = require('./routes/frontendLogRoute.js');const backupRoutes = require('./routes/backupRoutes'); 

const app = express();
connectDB();

// Middleware - Increase payload size limit for JSON and URL-encoded bodies
app.use(express.json({ limit: '10mb' })); // Allows up to 10MB JSON payloads
app.use(express.urlencoded({ limit: '10mb', extended: true })); // Allows up to 10MB URL-encoded payloads
app.use(morgan('dev'));

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'https://ekors-erp-dyix.vercel.app',
  'https://ekors-erp-dyix-5f954a0so-raghavsobti37s-projects.vercel.app',
  'https://ekors-erp-dyix-git-raghav-raghavsobti37s-projects.vercel.app',
  'ekors-erp-dyix-go5ebgnnz-raghavsobti37s-projects.vercel.app'
  // Removed trailing slash for consistency
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Normalize the origin by removing a trailing slash if it exists
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    if (allowedOrigins.indexOf(normalizedOrigin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Create uploads folder if not exists
const serverUploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(serverUploadsPath)) {
  fs.mkdirSync(serverUploadsPath, { recursive: true });
  console.log(`[SETUP] Created directory: ${serverUploadsPath}`);
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
app.use('/api/backups', backupRoutes);
app.use('/api/uploads', express.static(serverUploadsPath));

// Optional: Add a root route for the API to confirm it's running
app.get('/', (req, res) => res.json({ message: 'Ekors ERP API is live and running!' }));

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
